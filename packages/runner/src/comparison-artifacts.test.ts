import {afterEach, describe, expect, it, vi} from 'vitest';
import {mkdtemp, readFile, writeFile, mkdir, symlink, rename, rm, open, realpath, lstat, chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ComparisonArtifactWriter} from './comparison-artifacts.js';
const roots: string[] = [];
async function root() { const dir = await mkdtemp(join(tmpdir(), 'comparison-writer-')); roots.push(dir); return dir; }
afterEach(async () => { await Promise.all(roots.splice(0).map(r => rm(r, {recursive: true, force: true}))); });
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
