import {afterEach, describe, expect, it, vi} from 'vitest';
import {mkdtemp, readFile, writeFile, mkdir, symlink, rename, rm, open, realpath, lstat, chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {appendFileSync} from 'node:fs';
import {constants} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ComparisonArtifactWriter, type ComparisonDatasetSlotSource, type ComparisonFileOperations} from './comparison-artifacts.js';
import {comparisonDatasetInventorySchema, comparisonDatasetFinalizationFailureSchema, comparisonCaptureStatusSchema, canonicalSerialize, type ComparisonDatasetInventory} from '@chat-ui-bench/contract';
import {parseLongThreadArgs} from './long-thread-cli.js';
import {createLongThreadLedger} from './long-thread-run.js';
const roots: string[] = [];
async function root() { const dir = await mkdtemp(join(tmpdir(), 'comparison-writer-')); roots.push(dir); return dir; }
afterEach(async () => { await Promise.all(roots.splice(0).map(r => rm(r, {recursive: true, force: true}))); });
/** File facts are independently authored from actual retained bytes, never the publisher's hashes. */
async function dataset(rounds=1,io:ComparisonFileOperations={},extras:Record<string,unknown>={},interruptFirstPage=false,omitCaptureStatus=false) {
  const directory=await realpath(await root()), parsed=parseLongThreadArgs(['--out',directory,'--mode','headless','--rounds',String(rounds)]);
  if(parsed.help) throw new Error('unexpected help');
  const ledger=createLongThreadLedger(parsed), writer=await ComparisonArtifactWriter.create(directory,io,{candidateLimit:16});
  const {schemaVersion,suite,suiteVersion,collectorVersion,analyzerVersion}=ledger;
  const claim={schemaVersion,suite,suiteVersion,collectorVersion,analyzerVersion,kind:'invocation-ownership-claim',invocationId:'46dcd970-87f8-4d58-b9c1-490a5d9b9c05',createdAt:ledger.createdAt,purpose:ledger.purpose,configuration:ledger.configuration};
  await writer.claimEmptyRoot('invocation-claim.json',claim);
  const sources:ComparisonDatasetSlotSource[]=[];
  for(const [index,row] of ledger.runs.entries()) {
    row.status=index%3===0?'valid':index%3===1?'invalid':'failed'; row.reasons=row.status==='valid'?[]:['diagnostic journey outcome'];
    const identity={schemaVersion,suite,suiteVersion,collectorVersion,analyzerVersion,repetition:row.repetition,scenarioId:row.scenarioId,round:row.round,caseIndex:row.caseIndex,adapterProfile:row.adapterProfile};
    const slot=await writer.createSlotWriter(row.artifactDirectory);
    await slot.json('descriptor.json',{...identity,seed:ledger.configuration.seed,mode:ledger.configuration.mode,artifactDirectory:row.artifactDirectory});
    await slot.json('validation.json',{...identity,status:row.status,reasons:row.reasons,checks:[{name:'fixture ownership only',passed:row.status==='valid',reason:row.status==='valid'?null:row.reasons[0],evidencePaths:[]}]});
    await slot.json('exceptions.json',{...identity,exceptions:[]});
    await slot.text('page.jsonl','original exact raw bytes\n');
    if(interruptFirstPage && index===0) {
      await expect(slot.scoped(()=>{}).appendSerialized('page.jsonl',['{"actual":"record"}'])).rejects.toThrow('interrupted actual append before fsync');
      row.status='failed'; row.reasons=['interrupted actual append before fsync'];
      await slot.json('validation.json',{...identity,status:'failed',reasons:row.reasons,checks:[{name:'actual interrupted append',passed:false,reason:row.reasons[0],evidencePaths:['page.jsonl']}]});
    }
    const rawPaths=[...new Set(['descriptor.json','exceptions.json','page.jsonl','validation.json',...Object.keys(extras).filter(path=>path!=='capture-status.json')])].sort();
    const payloads=rawPaths.map(path=>({path,status:interruptFirstPage && index===0 && path==='page.jsonl'?'partial' as const:'complete' as const,...(interruptFirstPage && index===0 && path==='page.jsonl'?{reason:'interrupted actual append before fsync'}:{})}));
    const unavailable={status:'unavailable' as const,reason:'Storage fixture has no acquired browser metadata'};
    if(!omitCaptureStatus) await slot.json('capture-status.json',comparisonCaptureStatusSchema.parse({...identity,status:'partial',reasons:[unavailable.reason,...row.reasons],captureMetadata:unavailable,evidenceMetadata:unavailable,payloads,unavailablePaths:[],terminalPageDrain:unavailable,terminalProducerDrain:unavailable,finalPageInstrumentation:unavailable,traceEof:unavailable}));
    for(const [path,value] of Object.entries(extras)) await slot.json(path,value);
    const files=[];
    for(const path of [...rawPaths,...(omitCaptureStatus?[]:['capture-status.json'])].sort()) {
      const bytes=await readFile(join(slot.directory,path)); files.push({path,status:interruptFirstPage && index===0 && path==='page.jsonl'?'partial':'complete',...(interruptFirstPage && index===0 && path==='page.jsonl'?{reason:'interrupted actual append before fsync'}:{}),byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    }
    await slot.json('raw-inventory.json',{...identity,status:'partial',reason:'Storage fixture has no browser acquisition',files});
    await slot.seal(); sources.push({writer:slot,identity,artifactDirectory:row.artifactDirectory,status:row.status,ownershipSettled:true,finalizationSucceeded:true});
  }
  ledger.status='failed'; await writer.json('invocation.json',ledger);
  const build=(checked:Readonly<ComparisonDatasetInventory>)=>{
    expect(canonicalSerialize(checked.invocationClaim)).toBe(canonicalSerialize(claim)); expect(canonicalSerialize(checked.invocationLedger)).toBe(canonicalSerialize(ledger)); return structuredClone(checked);
  };
  return {writer,sources,ledger,claim,build,directory};
}
describe('durable whole dataset publication',()=>{
  it('rejects every real registered slot missing the required owner capture-status',async()=>{
    const d=await dataset(1,{}, {},false,true);
    await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/requires.*capture-status/);
    await expect(readFile(join(d.directory,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});
  },30000);
  it('uses admission-time source cardinality and copied source identity despite synchronous caller mutations',async()=>{
    const d=await dataset(),expectedIdentity={...d.sources[0]!.identity},expectedDirectory=d.sources[0]!.artifactDirectory;
    const publication=d.writer.publishDatasetSeal(d.sources,d.build);
    while(d.sources.length<=36) d.sources.push(d.sources[0]!);
    d.sources[0]!.identity.repetition='caller-mutated-after-admission';
    d.sources[0]!.artifactDirectory='runs/round-1/case-1/profile-0'; d.sources[0]!.ownershipSettled=false;
    d.sources[0]!.writer=d.sources[1]!.writer;
    await publication;
    const seal=comparisonDatasetInventorySchema.parse(JSON.parse(await readFile(join(d.directory,'dataset-seal.json'),'utf8')));
    expect(seal.slots).toHaveLength(12); expect(seal.slots[0]).toMatchObject({identity:expectedIdentity,artifactDirectory:expectedDirectory});
    await expect(readFile(join(d.directory,'dataset-finalization-failure.json'))).rejects.toMatchObject({code:'ENOENT'});
  },30000);
  it.each(['identity','raw-membership','evidence-availability'] as const)('rejects actual capture-status %s disagreement even with independently refreshed file hashes',async mode=>{
    const d=await dataset(),slot=d.sources[0]!.writer,statusPath=join(slot.directory,'capture-status.json');
    const status=comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(statusPath,'utf8')));
    if(mode==='identity') status.repetition='different-retained-status-identity';
    if(mode==='raw-membership') status.payloads[0]={...status.payloads[0]!,status:'partial',reason:'Inventoried bytes did not acquire this claimed status'};
    if(mode==='evidence-availability') status.evidenceMetadata={status:'available'};
    const bytes=Buffer.from(JSON.stringify(comparisonCaptureStatusSchema.parse(status))+'\n'); await writeFile(statusPath,bytes);
    const manifestPath=join(slot.directory,'raw-inventory.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
    const file=manifest.files.find((f:{path:string})=>f.path==='capture-status.json');
    file.byteLength=bytes.length; file.sha256=createHash('sha256').update(bytes).digest('hex'); await writeFile(manifestPath,JSON.stringify(manifest)+'\n');
    await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/Capture status/);
    await expect(readFile(join(d.directory,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});
  },30000);
  it.each([false,true])('uses a real readonly file durability barrier for pre-fsync interrupted append bytes (barrier fails=%s)',async fails=>{
    let armed=false,selected='',barriers=0,appendSynced=false,actualAppend:Awaited<ReturnType<typeof open>>|undefined,readHandle:Awaited<ReturnType<typeof open>>|undefined;
    const d=await dataset(1,{open:async(...args)=>{
      const handle=await open(...args),path=String(args[0]),flags=Number(args[1]);
      if(path.includes('/case-0/profile-0/') && path.endsWith('/page.jsonl') && (flags & constants.O_APPEND)!==0) {
        actualAppend=handle; handle.writeFile=async()=>{await handle.write(Buffer.from('actual partial tail')); throw new Error('interrupted actual append before fsync');};
        const sync=handle.sync.bind(handle); handle.sync=async()=>{appendSynced=true; await sync();};
      }
      if(armed && path===selected && (await handle.stat()).isFile()) {
        readHandle=handle; const sync=handle.sync.bind(handle);
        handle.sync=async()=>{barriers++; if(fails) throw new Error('actual readonly partial-file fsync failed'); await sync();};
      }
      return handle;
    }},{},true);
    selected=join(d.sources[0]!.writer.directory,'page.jsonl'); armed=true;
    expect(appendSynced).toBe(false); await expect(actualAppend!.stat()).rejects.toThrow(/closed/);
    const original=await readFile(selected); expect(original.toString()).toBe('original exact raw bytes\nactual partial tail');
    if(fails) {await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/readonly partial-file fsync/); await expect(readFile(join(d.directory,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'}); await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/retry/);}
    else {await d.writer.publishDatasetSeal(d.sources,d.build); expect(JSON.parse(await readFile(join(d.directory,'dataset-seal.json'),'utf8')).status).toBe('sealed');}
    expect(barriers).toBe(1); await expect(readHandle!.stat()).rejects.toThrow(/closed/); expect(await readFile(selected)).toEqual(original);
    const manifest=JSON.parse(await readFile(join(d.sources[0]!.writer.directory,'raw-inventory.json'),'utf8'));
    expect(manifest.files.find((f:{path:string})=>f.path==='page.jsonl')).toMatchObject({status:'partial',reason:'interrupted actual append before fsync',sha256:createHash('sha256').update(original).digest('hex')});
  },30000);
  it('closes a genuine publication handle when the second real stat acquisition rejects',async()=>{
    let armed=false,owned:Awaited<ReturnType<typeof open>>|undefined,closeOwned:(()=>Promise<void>)|undefined;
    const d=await dataset(1,{open:async(...args)=>{const handle=await open(...args); if(armed && /dataset-seal\.json\..*\.tmp$/.test(String(args[0]))) {owned=handle; closeOwned=handle.close.bind(handle); const stat=handle.stat.bind(handle); let calls=0; handle.stat=async(...statArgs)=>{if(++calls===2) throw new Error('actual second seal stat failed'); return stat(...statArgs);};} return handle;}}); armed=true;
    try {await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/actual second seal stat failed/); await expect(owned!.stat()).rejects.toThrow(/closed/);}
    finally {await closeOwned?.();}
  },30000);
  it('rejects a genuine nested declared directory fsync failure before seal creation, closes the actual handle, and preserves raw bytes',async()=>{
    let armed=false,selected='',attempted=false,closed=false,owned:Awaited<ReturnType<typeof open>>|undefined;
    const d=await dataset(1,{open:async(...args)=>{
      const handle=await open(...args);
      if(armed && String(args[0])===selected && (await handle.stat()).isDirectory()) {
        owned=handle; const close=handle.close.bind(handle);
        handle.sync=async()=>{attempted=true; throw new Error('nested declared directory fsync failed');};
        handle.close=async()=>{closed=true; await close();};
      }
      return handle;
    }}); selected=join(d.directory,'runs/round-1/case-0'); armed=true;
    await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/nested declared directory fsync/);
    expect(attempted).toBe(true); expect(closed).toBe(true); await expect(owned!.stat()).rejects.toThrow(/closed/);
    expect(await readFile(join(d.sources[0]!.writer.directory,'page.jsonl'),'utf8')).toBe('original exact raw bytes\n');
    await expect(readFile(join(d.directory,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});
    await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/retry/);
  },30000);
  it('independently rejects malformed actual capture-status even when the raw manifest hashes are fresh',async()=>{
    const d=await dataset(1,{}, {'capture-status.json':{forged:true}});
    await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/capture|identity|Invalid/);
  },30000);
  it('preserves both genuine publication file fsync and close errors and closes the retained real handle in test cleanup',async()=>{
    let armed=false,owned:Awaited<ReturnType<typeof open>>|undefined,closeOwned:(()=>Promise<void>)|undefined;
    const d=await dataset(1,{open:async(...args)=>{
      const handle=await open(...args);
      if(armed && /dataset-seal\.json\..*\.tmp$/.test(String(args[0]))) {
        owned=handle; closeOwned=handle.close.bind(handle);
        handle.sync=async()=>{throw new Error('genuine seal file fsync error');};
        handle.close=async()=>{throw new Error('genuine seal close error');};
      }
      return handle;
    }}); armed=true;
    try {await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/file fsync error.*close error/);}
    finally {await closeOwned?.();}
    expect(owned).toBeDefined(); await expect(owned!.stat()).rejects.toThrow(/closed/);
  },30000);
  it('rejects a real open root stream without inventing owner settlement',async()=>{
    let owned:Awaited<ReturnType<typeof open>>|undefined,closeOwned:(()=>Promise<void>)|undefined;
    const d=await dataset(1,{open:async(...args)=>{const handle=await open(...args); if(String(args[0]).endsWith('/root-stream')) {owned=handle; closeOwned=handle.close.bind(handle);} return handle;}});
    const stream=await d.writer.stream('root-stream'); await stream.write(Buffer.from('actual stream bytes'));
    try {
      await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/streams/);
      await expect(d.writer.seal()).rejects.toThrow(/publication.*frozen/);
      await expect(d.writer.text('late-after-failed-seal','forbidden')).rejects.toThrow(/sealed/);
      await expect(stream.write(Buffer.from('forbidden late bytes'))).rejects.toThrow(/sealed/);
      await stream.complete(); await expect(owned!.stat()).rejects.toThrow(/closed/);
      await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/retry/);
    }
    finally {await closeOwned?.();} // Actual test-owned FD cleanup is not claimed as publisher settlement.
  },30000);
  it('keeps a raw stream with a rejected actual close unsealable even after test-owned FD cleanup',async()=>{
    let owned:Awaited<ReturnType<typeof open>>|undefined,closeOwned:(()=>Promise<void>)|undefined;
    const d=await dataset(1,{open:async(...args)=>{
      const handle=await open(...args);
      if(String(args[0]).endsWith('/root-stream')) {owned=handle; closeOwned=handle.close.bind(handle); handle.close=async()=>{throw new Error('actual stream close rejected');};}
      return handle;
    }});
    const stream=await d.writer.stream('root-stream'); await stream.write(Buffer.from('retained actual stream bytes'));
    try {
      await expect(stream.complete()).rejects.toThrow('actual stream close rejected');
      expect((await owned!.stat()).isFile()).toBe(true);
      await closeOwned!(); await expect(owned!.stat()).rejects.toThrow(/closed/);
      await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/streams/);
      await expect(readFile(join(d.directory,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});
    } finally {await closeOwned?.();}
  },30000);
  it('freezes normal admission before draining a genuine earlier queued write without nested queue deadlock',async()=>{
    let armed=false,entered!:()=>void,release!:()=>void;
    const started=new Promise<void>(r=>entered=r), blocked=new Promise<void>(r=>release=r);
    const d=await dataset(1,{open:async(...args)=>{if(armed && /invocation\.json\..*\.tmp$/.test(String(args[0]))) {entered(); await blocked;} return open(...args);}});
    armed=true; const pending=d.writer.json('invocation.json',d.ledger); await started;
    const publication=d.writer.publishDatasetSeal(d.sources,d.build);
    await expect(d.writer.text('late-unregistered','forbidden')).rejects.toThrow(/sealed/);
    armed=false; release(); await pending; await publication;
    expect(JSON.parse(await readFile(join(d.directory,'dataset-seal.json'),'utf8')).status).toBe('sealed');
  },30000);
  it.each([1,3])('checks independently authored whole %i round collection and every raw hash',async rounds=>{
    const d=await dataset(rounds); await d.writer.publishDatasetSeal(d.sources,d.build);
    const seal=comparisonDatasetInventorySchema.parse(JSON.parse(await readFile(join(d.directory,'dataset-seal.json'),'utf8')));
    expect(seal.slots).toHaveLength(rounds*12); expect(seal.members).toHaveLength(2+rounds*12*6);
    for(const member of seal.members) {const bytes=await readFile(join(d.directory,member.path)); expect(member.byteLength).toBe(bytes.length); expect(member.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));}
    await expect(d.writer.json('late.json',{})).rejects.toThrow(/sealed/);
    await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/retry/);
  },30000);
  it.each(['missing-source','duplicate-source','wrong-prefix','wrong-identity','unsettled-owner','failed-finalizer','stale-manifest','stale-ledger','missing-member','unknown-file','unknown-directory','symlink','replaced-leaf','replaced-directory','replaced-root','builder-hash'] as const)('rejects %s against real checked filesystem facts',async mode=>{
    const d=await dataset(), first=d.sources[0]!, slot=first.writer;
    let sources=d.sources, build=d.build;
    if(mode==='missing-source') sources=sources.slice(1);
    if(mode==='duplicate-source') sources=[sources[0]!,sources[0]!,...sources.slice(2)];
    if(mode==='wrong-prefix') sources=[{...first,artifactDirectory:'runs/round-1/case-1/profile-0'},...sources.slice(1)];
    if(mode==='wrong-identity') sources=[{...first,identity:{...first.identity,repetition:'substituted'}},...sources.slice(1)];
    if(mode==='unsettled-owner') sources=[{...first,ownershipSettled:false},...sources.slice(1)];
    if(mode==='failed-finalizer') sources=[{...first,finalizationSucceeded:false},...sources.slice(1)];
    if(mode==='stale-manifest') await writeFile(join(slot.directory,'page.jsonl'),'changed bytes without manifest update');
    if(mode==='stale-ledger') {const changed=structuredClone(d.ledger); changed.createdAt='2026-10-09T00:00:00.000Z'; await writeFile(join(d.directory,'invocation.json'),JSON.stringify(changed));}
    if(mode==='missing-member') await rm(join(slot.directory,'page.jsonl'));
    if(mode==='unknown-file') await writeFile(join(slot.directory,'unknown-raw'),'unknown bytes');
    if(mode==='unknown-directory') await mkdir(join(slot.directory,'unknown-directory'));
    if(mode==='symlink') {const outside=await root(); await writeFile(join(outside,'sentinel'),'unread outside'); await symlink(join(outside,'sentinel'),join(slot.directory,'unknown-link'));}
    if(mode==='replaced-leaf') {await rename(join(slot.directory,'page.jsonl'),join(slot.directory,'original')); await writeFile(join(slot.directory,'page.jsonl'),'replacement');}
    if(mode==='replaced-directory') {await rename(slot.directory,slot.directory+'-original'); await mkdir(slot.directory);}
    if(mode==='replaced-root') {const saved=d.directory+'-original'; roots.push(saved); await rename(d.directory,saved); await mkdir(d.directory); await writeFile(join(d.directory,'sentinel'),'replacement root untouched');}
    if(mode==='builder-hash') build=checked=>({...d.build(checked),members:checked.members.map((m,i)=>i===0?{...m,sha256:'0'.repeat(64)}:m)});
    await expect(d.writer.publishDatasetSeal(sources,build)).rejects.toThrow();
    await expect(readFile(join(d.directory,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});
    await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/retry/);
    if(mode==='replaced-root') expect(await readFile(join(d.directory,'sentinel'),'utf8')).toBe('replacement root untouched');
  },30000);
  it.each(['create','write','rename','directory-fsync','postcheck','all-retention-fails'] as const)('retains actual publication %s failure without reporting success or retrying',async mode=>{
    let armed=false,renamed=false,rootPath='',created:Awaited<ReturnType<typeof open>>|undefined;
    const io:ComparisonFileOperations={open:async(...args)=>{
      const path=String(args[0]);
      if(armed && mode==='all-retention-fails' && (/dataset-finalization-failure\.json\..*\.tmp$/.test(path) || /invocation\.json\..*\.tmp$/.test(path))) throw new Error('ALL error retention writes failed');
      const temporary=/dataset-seal\.json\..*\.tmp$/.test(path);
      if(armed && temporary && mode==='create') throw new Error('seal create failed');
      const handle=await open(...args);
      if(armed && temporary) {created=handle; if(mode==='write') handle.writeFile=async()=>{await handle.write(Buffer.from('actual partial seal')); throw new Error('seal write failed');};}
      if(armed && renamed && path===rootPath && (await handle.stat()).isDirectory() && ['directory-fsync','all-retention-fails'].includes(mode)) {const sync=handle.sync.bind(handle); handle.sync=async()=>{if(mode==='all-retention-fails' || renamed) {renamed=false; throw new Error('seal parent fsync failed after real rename');} await sync();};}
      if(armed && renamed && path===join(rootPath,'dataset-seal.json') && mode==='postcheck') handle.readFile=async()=>{throw new Error('seal postcheck failed');};
      return handle;
    },rename:async(source,destination)=>{
      if(armed && String(destination).endsWith('/dataset-seal.json')) {if(mode==='rename') throw new Error('seal rename failed'); await rename(source,destination); renamed=true; return;}
      await rename(source,destination);
    }};
    const d=await dataset(1,io); rootPath=d.directory; armed=true;
    await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/seal|retention/);
    if(created) await expect(created.stat()).rejects.toThrow(/closed/);
    if(mode==='write') {
      const actual=await d.writer.reconcilePayloadCandidates(), temporary=actual.present.find(f=>/^dataset-seal\.json\..*\.tmp$/.test(f.path));
      expect(temporary).toMatchObject({status:'partial'}); expect(await readFile(join(d.directory,temporary!.path),'utf8')).toBe('actual partial seal');
    }
    await expect(d.writer.publishDatasetSeal(d.sources,d.build)).rejects.toThrow(/retry/);
    await expect(d.writer.json('arbitrary-reopening.json',{})).rejects.toThrow(/sealed/);
    if(['directory-fsync','postcheck','all-retention-fails'].includes(mode)) expect(JSON.parse(await readFile(join(d.directory,'dataset-seal.json'),'utf8')).status).toBe('sealed');
    if(mode==='all-retention-fails') {
      await expect(readFile(join(d.directory,'dataset-finalization-failure.json'))).rejects.toMatchObject({code:'ENOENT'});
      expect(JSON.parse(await readFile(join(d.directory,'invocation.json'),'utf8'))).toEqual(d.ledger);
      // This surviving consistent seal cannot prove unpersisted command success or crash durability.
    } else {
      const failure=comparisonDatasetFinalizationFailureSchema.parse(JSON.parse(await readFile(join(d.directory,'dataset-finalization-failure.json'),'utf8')));
      expect(failure.sealState).toBe(['directory-fsync','postcheck'].includes(mode)?'present-unusable':'absent');
    }
  },30000);
});
describe('comparison artifact writer', () => {
  it.each(['reconciliation','inventory'] as const)('rejects post-open replacement during %s while preserving acquired and previously pinned identities',async(operation)=>{
    for(const {pinned,swapBeforeOpen} of [{pinned:false,swapBeforeOpen:false},{pinned:true,swapBeforeOpen:false},{pinned:true,swapBeforeOpen:true}]) {
      const dir=await realpath(await root()), outside=await root(); await writeFile(join(outside,'sentinel'),'outside unchanged');
      let swapped=false, acquired:Awaited<ReturnType<typeof open>>|undefined;
      const writer=await ComparisonArtifactWriter.create(dir,{open:async(...args)=>{
        const swap=async()=>{await rename(join(dir,'page.jsonl'),join(dir,'original')); await writeFile(join(dir,'page.jsonl'),'SUBSTITUTED BYTES');};
        const shouldSwap=!swapped && args[0]===join(dir,'page.jsonl');
        if(shouldSwap && swapBeforeOpen) await swap();
        const handle=await open(...args);
        if(shouldSwap) {
          swapped=true; acquired=handle;
          if(!swapBeforeOpen) await swap();
        }
        return handle;
      }});
      if(pinned) await writer.text('page.jsonl','previously owned');
      await expect(writer.scoped(()=>{}).appendSerialized('page.jsonl',['true'])).rejects.toThrow(/identity|replaced/i);
      expect(acquired).toBeDefined(); await expect(acquired!.stat()).rejects.toThrow(/closed|filehandle/i);
      if(operation==='reconciliation') await expect(writer.reconcilePayloadCandidates()).rejects.toThrow(/identity|replaced/i);
      else await expect(writer.inventory([{path:'page.jsonl',status:'partial',reason:'open rejected'}])).rejects.toThrow(/identity|replaced/i);
      expect(await readFile(join(dir,'page.jsonl'),'utf8')).toBe('SUBSTITUTED BYTES');
      expect(await readFile(join(dir,'original'),'utf8')).toBe(pinned?'previously owned':'');
      expect(await readFile(join(outside,'sentinel'),'utf8')).toBe('outside unchanged');
    }
  });
  it('rejects slot candidate4097 before mutation while bounded queued candidates settle under their original guard',async()=>{
    const dir=await root(); await writeFile(join(dir,'sentinel'),'unchanged');
    let active=true, opens=0, entered!:()=>void, release!:()=>void, original:Awaited<ReturnType<typeof open>>|undefined;
    const started=new Promise<void>(resolve=>entered=resolve), blocked=new Promise<void>(resolve=>release=resolve);
    const writer=await ComparisonArtifactWriter.create(dir,{open:async(...args)=>{opens++; const handle=await open(...args); original=handle; entered(); await blocked; return handle;}},{candidateLimit:4096});
    const scope=writer.scoped(()=>{if(!active) throw new Error('original slot generation revoked');});
    const pending=[scope.append('journal-0',[])]; await started;
    for(let i=1;i<4096;i++) pending.push(scope.append(`journal-${i}`,[]));
    await expect(scope.append('never-created/candidate4097',[])).rejects.toThrow(/capacity/i);
    await expect(lstat(join(dir,'never-created'))).rejects.toMatchObject({code:'ENOENT'});
    const settling=Promise.allSettled(pending); active=false; release();
    expect((await settling).every(result=>result.status==='rejected')).toBe(true); expect(opens).toBe(1);
    expect(original).toBeDefined(); await expect(original!.stat()).rejects.toThrow(/closed|filehandle/i);
    const candidates=await writer.reconcilePayloadCandidates();
    expect(candidates.present).toEqual([{path:'journal-0',status:'partial',reason:'original slot generation revoked'}]);
    expect(candidates.absent).toHaveLength(4095); expect(candidates.absent.every(file=>file.reason==='original slot generation revoked')).toBe(true);
    expect(await readFile(join(dir,'sentinel'),'utf8')).toBe('unchanged');
    await expect(lstat(join(dir,'never-created'))).rejects.toMatchObject({code:'ENOENT'});
  },30000);
  it('rejects removed genuinely pinned ancestors while retaining never-created candidate absence',async()=>{
    const dir=await root(), writer=await ComparisonArtifactWriter.create(dir); await writer.text('nested/raw','owned');
    await rename(join(dir,'nested'),join(dir,'moved'));
    await expect(writer.reconcilePayloadCandidates()).rejects.toThrow(/ancestor.*(removed|identity)/i);
    const other=await ComparisonArtifactWriter.create(await root()); let active=true;
    const pending=other.scoped(()=>{if(!active) throw new Error('revoked before parent creation');}).appendSerialized('never-created/raw',['true']); active=false;
    await expect(pending).rejects.toThrow(/revoked/);
    expect(await other.reconcilePayloadCandidates()).toEqual({present:[],absent:[{path:'never-created/raw',reason:'revoked before parent creation'}]});
  });
  it('preserves both genuine post-open expiry and actual handle-close failure',async()=>{
    const dir=await realpath(await root()); let active=true, cleanup:(()=>Promise<void>)|undefined;
    const writer=await ComparisonArtifactWriter.create(dir,{open:async(...args)=>{
      const handle=await open(...args);
      if(String(args[0])===join(dir,'raw')) {
        cleanup=handle.close.bind(handle); vi.spyOn(handle,'close').mockRejectedValueOnce(new Error('actual handle close failed')); active=false;
      }
      return handle;
    }});
    try {await expect(writer.scoped(()=>{if(!active) throw new Error('actual post-open expiry');}).appendSerialized('raw',['true'])).rejects.toThrow(/post-open expiry.*close failed/);}
    finally {await cleanup?.();}
  });
  it('retains a safely readable real temporary when its checked cleanup genuinely fails',async()=>{
    const dir=await root();
    const writer=await ComparisonArtifactWriter.create(dir,{rename:async()=>{await chmod(dir,0o500); throw new Error('actual rename failure before denied cleanup');}});
    try {
      await expect(writer.text('raw','surviving temporary bytes')).rejects.toThrow();
      const candidates=await writer.reconcilePayloadCandidates();
      expect(candidates.present).toHaveLength(1);
      expect(candidates.present[0]).toMatchObject({status:'partial',reason:expect.stringMatching(/incomplete atomic temporary.*(rename|permission|EACCES)/)});
      const files=await writer.inventory(candidates.present);
      expect(files).toMatchObject([{byteLength:25,sha256:createHash('sha256').update('surviving temporary bytes').digest('hex')}]);
    } finally {await chmod(dir,0o700);}
  });
  it('reserves atomic destination plus temporary before any missing parent is created',async()=>{
    const dir=await root(), writer=await ComparisonArtifactWriter.create(dir,{}, {candidateLimit:16});
    for(let i=0;i<15;i++) await writer.append(`journal-${i}`,[]);
    await expect(writer.text('absent-parent/raw','no')).rejects.toThrow(/capacity/i);
    await expect(lstat(join(dir,'absent-parent'))).rejects.toMatchObject({code:'ENOENT'});
    expect((await writer.reconcilePayloadCandidates()).present).toHaveLength(15);
  });
  it('retains exact interrupted serialized tail and releases batch admission after actual rejection',async()=>{
    const dir=await root(); let fail=true;
    const writer=await ComparisonArtifactWriter.create(dir,{open:async(...args)=>{
      const handle=await open(...args);
      if(String(args[0]).endsWith('/page.jsonl') && fail) {
        const write=handle.writeFile.bind(handle);
        vi.spyOn(handle,'writeFile').mockImplementation(async()=>{await write('{"partial'); fail=false; throw new Error('actual interrupted serialized write');});
      }
      return handle;
    }});
    await expect(writer.scoped(()=>{}).appendSerialized('page.jsonl',['{"original":1}'])).rejects.toThrow(/interrupted/);
    expect(await readFile(join(dir,'page.jsonl'),'utf8')).toBe('{"partial');
    expect(await writer.reconcilePayloadCandidates()).toMatchObject({present:[{path:'page.jsonl',status:'partial',reason:'actual interrupted serialized write'}]});
    await writer.scoped(()=>{}).appendSerialized('other',['true']);
  });
  it('keeps a genuine temporary created before a post-open guard failure as partial raw bytes',async()=>{
    const dir=await root(); let active=true;
    const writer=await ComparisonArtifactWriter.create(dir,{open:async(...args)=>{const handle=await open(...args); if(String(args[0]).endsWith('.tmp')) active=false; return handle;}});
    await expect(writer.scoped(()=>{if(!active) throw new Error('actual temporary post-open expiry');}).text('raw','unwritten')).rejects.toThrow(/expiry/);
    const candidates=await writer.reconcilePayloadCandidates();
    expect(candidates.present).toHaveLength(1); expect(candidates.present[0]).toMatchObject({status:'partial',reason:expect.stringContaining('incomplete atomic temporary')});
    expect(candidates.absent).toMatchObject([{path:'raw',reason:'actual temporary post-open expiry'}]);
    expect(await writer.inventory(candidates.present)).toMatchObject([{byteLength:0,sha256:createHash('sha256').update('').digest('hex')}]);
  });
  it('checks actual UTF8 and LF-inclusive batch bounds, primitive types and code units before mutation', async () => {
    const dir=await root(), writer=await ComparisonArtifactWriter.create(dir), scope=writer.scoped(()=>{});
    const invalid:unknown[][]=[Array(65).fill('a'),['a\nb'],['a\rb'],[{}],[new String('a')],['a'.repeat(4194305)],['🙂'.repeat(1048577)],Array(4).fill('a'.repeat(4194304))];
    for(const records of invalid) await expect(scope.appendSerialized('raw',records as string[])).rejects.toThrow();
    expect((await writer.reconcilePayloadCandidates()).present).toHaveLength(0);
    await scope.appendSerialized('raw',['a'.repeat(4194304)]);
    expect((await readFile(join(dir,'raw'))).length).toBe(4194305);
  });
  it('rejects serialized append stream ownership immediately and queued acquisition at execution',async()=>{
    const writer=await ComparisonArtifactWriter.create(await root()), scope=writer.scoped(()=>{});
    const stream=await scope.stream('raw'); await expect(scope.appendSerialized('raw',['a'])).rejects.toThrow(/stream/i); await stream.complete();
    const acquiring=scope.stream('other'); const appending=scope.appendSerialized('other',['a']);
    const other=await acquiring; await expect(appending).rejects.toThrow(/stream/i); await other.complete();
  });
  it('rejects regular leaf and ancestor replacement during owner reconciliation',async()=>{
    const dir=await root(), writer=await ComparisonArtifactWriter.create(dir); await writer.text('nested/raw','owned');
    await rename(join(dir,'nested/raw'),join(dir,'nested/original')); await writeFile(join(dir,'nested/raw'),'substituted');
    await expect(writer.reconcilePayloadCandidates()).rejects.toThrow(/identity|replaced/i);
    await rm(join(dir,'nested/raw')); await rename(join(dir,'nested/original'),join(dir,'nested/raw'));
    await rename(join(dir,'nested'),join(dir,'old')); await mkdir(join(dir,'nested')); await writeFile(join(dir,'nested/raw'),'substituted');
    await expect(writer.reconcilePayloadCandidates()).rejects.toThrow(/ancestor|identity/i);
  });
  it('refuses unregistered submitted inventory paths without hashing outside candidates',async()=>{
    const dir=await root(), writer=await ComparisonArtifactWriter.create(dir); await writeFile(join(dir,'unregistered'),'actual');
    await expect(writer.inventory([{path:'unregistered',status:'complete'}])).rejects.toThrow(/registered/i);
  });
  it('excludes partial inventory manifests from their own payload inventory',async()=>{
    const writer=await ComparisonArtifactWriter.create(await root()); await writer.text('raw-inventory.json','actual manifest bytes');
    await expect(writer.inventory([{path:'raw-inventory.json',status:'complete'}])).rejects.toThrow(/inventory|derived|manifest/i);
  });
  it('exposes exact append only through a guarded scope and retains original spellings across generations', async () => {
    const dir = await root(), writer = await ComparisonArtifactWriter.create(dir), scope = writer.scoped(() => {});
    expect(typeof scope.appendSerialized).toBe('function');
    expect('appendSerialized' in writer).toBe(false);
    const records = ['{"v":"\\u0061", "n":1e0}', '"🙂"'];
    const pending = scope.appendSerialized('page.jsonl', records); records[0] = 'changed'; await pending;
    await writer.scoped(() => {}).appendSerialized('page.jsonl', ['true']);
    expect(await readFile(join(dir, 'page.jsonl'), 'utf8')).toBe('{"v":"\\u0061", "n":1e0}\n"🙂"\ntrue\n');
  });
  it('rejects a second serialized batch until actual settlement and rejects accessors without invoking them', async () => {
    const writer = await ComparisonArtifactWriter.create(await root()), scope = writer.scoped(() => {});
    expect(typeof scope.appendSerialized).toBe('function');
    let calls = 0; const records: string[] = []; Object.defineProperty(records, 0, {get() {calls++; return 'x';}}); records.length = 1;
    await expect(scope.appendSerialized('page.jsonl', records)).rejects.toThrow(); expect(calls).toBe(0);
    const first = scope.appendSerialized('page.jsonl', ['a']);
    await expect(scope.appendSerialized('page.jsonl', ['b'])).rejects.toThrow(/outstanding/i); await first;
    await scope.appendSerialized('page.jsonl', ['c']);
  });
  it('registers failed-created leaves and can reconcile and hash after seal', async () => {
    const dir = await realpath(await root()); let active = true;
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (...args: Parameters<typeof open>) => {
      const handle = await open(...args); if (String(args[0]) === join(dir, 'page.jsonl')) active = false; return handle;
    }});
    expect(typeof writer.reconcilePayloadCandidates).toBe('function');
    await expect(writer.scoped(() => {if (!active) throw new Error('generation expired after creation');}).appendSerialized('page.jsonl', ['actual'])).rejects.toThrow(/expired/);
    await writer.seal();
    expect(await writer.reconcilePayloadCandidates()).toMatchObject({present:[{path:'page.jsonl',status:'partial',reason:'generation expired after creation'}],absent:[]});
    expect(await writer.inventory([{path:'page.jsonl',status:'partial',reason:'generation expired after creation'}])).toMatchObject([{byteLength:0,sha256:createHash('sha256').update('').digest('hex')}]);
  });
  it('exhausts candidate admission before creating parents or destinations', async () => {
    const dir = await root(), writer = await ComparisonArtifactWriter.create(dir, {}, {candidateLimit:16});
    for (let i = 0; i < 16; i++) await writer.append(`journal-${i}`, []);
    await expect(writer.text('new-parent/raw', 'no')).rejects.toThrow(/candidate|capacity/i);
    await expect(readFile(join(dir, 'new-parent/raw'))).rejects.toMatchObject({code:'ENOENT'});
    expect((await writer.reconcilePayloadCandidates()).present).toHaveLength(16);
  });
  it('rejects real parent fsync after a successful rename and closes its actual directory handle', async () => {
    const dir = await realpath(await root()); let renamed = false, closeAttempted = false, directoryHandle:Awaited<ReturnType<typeof open>>|undefined;
    const writer = await ComparisonArtifactWriter.create(dir, {
      rename: async (from, to) => {await rename(from, to); renamed = true;},
      open: async (...args: Parameters<typeof open>) => {
        const handle = await open(...args);
        if (String(args[0]) === dir && renamed && (await handle.stat()).isDirectory()) {
          directoryHandle=handle;
          vi.spyOn(handle, 'sync').mockRejectedValueOnce(new Error('actual parent fsync failed'));
          const close = handle.close.bind(handle);
          vi.spyOn(handle, 'close').mockImplementation(async () => {closeAttempted = true; await close();});
        }
        return handle;
      },
    });
    await expect(writer.text('raw', 'actual bytes')).rejects.toThrow('actual parent fsync failed');
    expect(renamed).toBe(true); expect(closeAttempted).toBe(true);
    expect(directoryHandle).toBeDefined(); await expect(directoryHandle!.stat()).rejects.toThrow(/closed|filehandle/i);
    expect(await readFile(join(dir, 'raw'), 'utf8')).toBe('actual bytes');
    expect(await writer.reconcilePayloadCandidates()).toMatchObject({present:[{path:'raw',status:'partial',reason:'actual parent fsync failed'}],absent:[]});
    expect(await writer.inventory([{path:'raw',status:'partial',reason:'actual parent fsync failed'}])).toMatchObject([{byteLength:12,sha256:createHash('sha256').update('actual bytes').digest('hex')}]);
    expect(await writer.inventory([{path:'raw',status:'complete'}])).toMatchObject([{status:'partial',reason:'actual parent fsync failed'}]);
  });
  it('serializes concurrent whole-line appends and nested atomic writes', async () => {
    const dir = await root(), writer = await ComparisonArtifactWriter.create(dir);
    await writer.json('runs/1-0-threadplane/trace.json', {ready: true});
    await Promise.all(Array.from({length: 20}, (_, i) => writer.append('page.jsonl', [{i}])));
    expect(JSON.parse(await readFile(join(dir, 'runs/1-0-threadplane/trace.json'), 'utf8'))).toEqual({ready: true});
    expect((await readFile(join(dir, 'page.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)).toEqual(Array.from({length: 20}, (_, i) => ({i})));
  });
  it.each(['/x', '../x', 'a/../x', 'a//x', 'a/./x', 'a\\x', 'https://x', 'C:/x', '', 'a\u0000b', 'é'])('rejects member syntax %j', async path => {
    const writer = await ComparisonArtifactWriter.create(await root());
    await expect(writer.text(path, 'bad')).rejects.toThrow();
  });
  it.each(['outside', 'inside', 'dangling', 'prefix-sibling'])('rejects %s ancestor links without changing sentinels', async kind => {
    const dir = await root(), outside = await root();
    const sibling = dir + '-sibling'; roots.push(sibling); await mkdir(sibling);
    await writeFile(join(outside, 'sentinel'), 'outside');
    await writeFile(join(dir, 'sentinel'), 'inside');
    await symlink(kind === 'inside' ? dir : kind === 'dangling' ? join(outside, 'missing') : kind === 'prefix-sibling' ? sibling : outside, join(dir, 'link'));
    const writer = await ComparisonArtifactWriter.create(dir);
    await expect(writer.text('link/sentinel', 'bad')).rejects.toThrow();
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('outside');
    expect(await readFile(join(dir, 'sentinel'), 'utf8')).toBe('inside');
  });
  it('rejects existing leaf links and directories', async () => {
    const dir = await root(), outside = await root(); await writeFile(join(outside, 'sentinel'), 'outside');
    await symlink(join(outside, 'sentinel'), join(dir, 'link')); await mkdir(join(dir, 'folder'));
    const writer = await ComparisonArtifactWriter.create(dir);
    await expect(writer.append('link', [{bad: true}])).rejects.toThrow();
    await expect(writer.text('folder', 'bad')).rejects.toThrow();
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('outside');
  });
  it('pins canonical root identity and rejects its replacement', async () => {
    const dir = await root(), writer = await ComparisonArtifactWriter.create(dir), moved = dir + '-original'; roots.push(moved);
    await rename(dir, moved); await mkdir(dir);
    await expect(writer.text('new', 'bad')).rejects.toThrow(/root|identity|replaced/i);
  });
  it('rejects a caller root leaf symlink while allowing its ordinary ancestor resolution', async () => {
    const dir = await root(), outside = await root(); await symlink(outside, join(dir, 'root-link'));
    await expect(ComparisonArtifactWriter.create(join(dir, 'root-link'))).rejects.toThrow(/root|symlink/i);
    await mkdir(join(outside, 'actual-root')); const writer = await ComparisonArtifactWriter.create(join(dir, 'root-link/actual-root'));
    await writer.text('safe', 'yes'); expect(await readFile(join(outside, 'actual-root/safe'), 'utf8')).toBe('yes');
  });
  it('rejects a FIFO leaf before opening it', async () => {
    const dir = await root(); execFileSync('mkfifo', [join(dir, 'fifo')]); const writer = await ComparisonArtifactWriter.create(dir);
    await expect(writer.append('fifo', [{bad: true}])).rejects.toThrow(/regular file/i);
  });
  it('does not append a partially serialized JSON batch', async () => {
    const dir = await root(), writer = await ComparisonArtifactWriter.create(dir);
    await writer.text('page.jsonl', '{malformed');
    await expect(writer.append('page.jsonl', [{good: true}, {bad: 1n}])).rejects.toThrow();
    expect(await readFile(join(dir, 'page.jsonl'), 'utf8')).toBe('{malformed');
  });
  it('checks generation again when queued work executes', async () => {
    const dir = await root(); let release!: () => void, entered!: () => void;
    const opened = new Promise<void>(r => entered = r), blocker = new Promise<void>(r => release = r);
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (...args) => {if (String(args[0]).includes('first.')) {entered(); await blocker;} return open(...args);}});
    let active = true; const scoped = writer.scoped(() => {if (!active) throw new Error('revoked');});
    const first = writer.text('first', 'x'); await opened; const queued = scoped.append('page.jsonl', [{late: true}]);
    active = false; release();
    await Promise.allSettled([first]); await expect(queued).rejects.toThrow('revoked');
    await expect(readFile(join(dir, 'page.jsonl'))).rejects.toThrow();
  });
  it('retains old JSON and cleans only owned temporaries after rename failure', async () => {
    const dir = await root(); await writeFile(join(dir, 'validation.json'), '{"old":true}');
    const writer = await ComparisonArtifactWriter.create(dir, {rename: async () => {throw new Error('rename failed');}});
    await expect(writer.json('validation.json', {new: true})).rejects.toThrow('rename failed');
    expect(await readFile(join(dir, 'validation.json'), 'utf8')).toBe('{"old":true}');
  });
  it('preserves an actual interrupted JSONL tail and inventories those exact partial bytes', async () => {
    const dir = await root(); await writeFile(join(dir, 'page.jsonl'), '{"old":true}\n');
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (...args) => {
      const handle = await open(...args);
      if (String(args[0]).endsWith('/page.jsonl') && Number(args[1]) !== 0) {
        const write = handle.writeFile.bind(handle);
        vi.spyOn(handle, 'writeFile').mockImplementation(async () => {await write('{"bad'); throw new Error('interrupted write');});
      }
      return handle;
    }});
    await expect(writer.append('page.jsonl', [{bad: true}])).rejects.toThrow('interrupted write');
    const bytes = await readFile(join(dir, 'page.jsonl')); expect(bytes.toString()).toBe('{"old":true}\n{"bad');
    expect((await writer.inventory([{path: 'page.jsonl', status: 'partial', reason: 'interrupted write'}]))[0]).toMatchObject({byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), status: 'partial'});
  });
  it('never removes an outside same-name sentinel when a temp parent is replaced during rename', async () => {
    const dir = await root(), outside = await root(); let sentinel = '';
    const writer = await ComparisonArtifactWriter.create(dir, {rename: async source => {
      await rename(join(dir, 'nested'), join(dir, 'owned-original')); await symlink(outside, join(dir, 'nested'));
      sentinel = join(outside, basename(String(source))); await writeFile(sentinel, 'outside sentinel'); throw new Error('injected rename failure');
    }});
    await expect(writer.json('nested/value.json', {value: 1})).rejects.toThrow();
    expect(await readFile(sentinel, 'utf8')).toBe('outside sentinel');
  });
  it('rejects an opened hash handle substituted for the checked pathname', async () => {
    const dir = await root(); await writeFile(join(dir, 'raw'), 'original'); await writeFile(join(dir, 'other'), 'wrong');
    let hashing=false;
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (path, flags, mode) => open(hashing && String(path).endsWith('/raw') ? join(dir, 'other') : path, flags, mode)});
    await writer.append('raw',[]); hashing=true;
    await expect(writer.inventory([{path: 'raw', status: 'complete'}])).rejects.toThrow(/handle|identity|path/i);
  });
  it('rejects pathname replacement after opening a readable original hash handle', async () => {
    const dir = await root(); await writeFile(join(dir, 'raw'), 'original');
    let hashing=false;
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (...args) => {
      const handle = await open(...args); if (hashing && String(args[0]).endsWith('/raw')) {await rename(join(dir, 'raw'), join(dir, 'old')); await writeFile(join(dir, 'raw'), 'replacement');} return handle;
    }});
    await writer.append('raw',[]); hashing=true;
    await expect(writer.inventory([{path: 'raw', status: 'complete'}])).rejects.toThrow(/changed|path/i);
    expect(await readFile(join(dir, 'old'), 'utf8')).toBe('original');
  });
  it('rejects file mutation during streamed hashing', async () => {
    const dir = await root(); await writeFile(join(dir, 'raw'), Buffer.alloc(262144, 1));
    let hashing=false;
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (...args) => {
      const handle = await open(...args), create = handle.createReadStream.bind(handle);
      if(hashing) vi.spyOn(handle, 'createReadStream').mockImplementation(options => {const stream = create({...options, highWaterMark: 1024}); stream.once('data', () => appendFileSync(join(dir, 'raw'), 'changed')); return stream;});
      return handle;
    }});
    await writer.append('raw',[]); hashing=true;
    await expect(writer.inventory([{path: 'raw', status: 'complete'}])).rejects.toThrow(/changed|hash/i);
  });
  it('streams exact bytes and refuses inventory with an unfinished stream', async () => {
    const dir = await root(), writer = await ComparisonArtifactWriter.create(dir);
    const stream = await writer.stream('trace.json'); await stream.write(Buffer.from([0, 255, 3]));
    await expect(writer.inventory([{path: 'trace.json', status: 'complete'}])).rejects.toThrow(/stream/i);
    await stream.complete();
    const files = await writer.inventory([{path: 'trace.json', status: 'complete'}]);
    expect(files[0]).toMatchObject({byteLength: 3, sha256: createHash('sha256').update(Buffer.from([0, 255, 3])).digest('hex')});
  });
  it('allows an initialized empty trace to become a checked stream without truncating existing evidence', async () => {
    const writer = await ComparisonArtifactWriter.create(await root()); await writer.text('trace.json', '');
    const stream = await writer.stream('trace.json'); await stream.write(Buffer.from('trace')); await stream.complete();
    await expect(writer.stream('trace.json')).rejects.toThrow(/empty|exists/i);
  });
  it('hashes only explicit payload files with actual bytes and partial reasons', async () => {
    const writer = await ComparisonArtifactWriter.create(await root());
    await writer.text('empty', ''); await writer.text('unicode', '🙂'); await writer.text('page.jsonl', '{partial'); await writer.text('unlisted', 'ignore');
    const files = await writer.inventory([{path: 'unicode', status: 'complete'}, {path: 'empty', status: 'complete'}, {path: 'page.jsonl', status: 'partial', reason: 'interrupted'}]);
    expect(files.map(f => f.path)).toEqual(['empty', 'page.jsonl', 'unicode']); expect(files.map(f => f.byteLength)).toEqual([0, 8, 4]);
    await expect(writer.inventory([{path: 'empty', status: 'complete'}, {path: 'empty', status: 'complete'}])).rejects.toThrow(/duplicate/i);
    await expect(writer.inventory([{path: 'evidence.json', status: 'complete'}])).rejects.toThrow(/derived|evidence/i);
  });
  it('seals permanently after queued writes finish', async () => {
    const writer = await ComparisonArtifactWriter.create(await root()); const pending = writer.text('before', 'yes'); await writer.seal(); await pending;
    await expect(writer.text('after', 'no')).rejects.toThrow(/seal/i); await expect(writer.stream('after')).rejects.toThrow(/seal/i);
  });
  it('allows only one exclusive claim on an empty root and preserves prior partial members', async () => {
    const dir = await root(), a = await ComparisonArtifactWriter.create(dir), b = await ComparisonArtifactWriter.create(dir);
    const claims = await Promise.allSettled([a.claimEmptyRoot('invocation-claim.json', {id: 'a'}), b.claimEmptyRoot('invocation-claim.json', {id: 'b'})]);
    expect(claims.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(['a', 'b']).toContain(JSON.parse(await readFile(join(dir, 'invocation-claim.json'), 'utf8')).id);
    const partial = await root(); await writeFile(join(partial, 'partial-trace'), 'incomplete raw bytes');
    const writer = await ComparisonArtifactWriter.create(partial); await expect(writer.claimEmptyRoot('invocation-claim.json', {id: 'new'})).rejects.toThrow(/empty|existing|initialized/i);
    expect(await readFile(join(partial, 'partial-trace'), 'utf8')).toBe('incomplete raw bytes');
  });
});
