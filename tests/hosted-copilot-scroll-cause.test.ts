import {test,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdtemp,mkdir,readFile,writeFile,link,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';

test('current diagnostic package profile authenticates patched Zod and rejects stale or forged physical lock identities',async()=>{
 const api=await import('./support/hosted-copilot-scroll-cause-build.ts');
 const {MOUNTED_PACKAGE_PINS}=await import('./support/hosted-copilot-mounted-policy.ts');
 const patched={version:'4.6.6',integrity:'sha512-4UmzQUF5fxvfcYHlbjBmejU+w+hbDnWFx4aS8kBx7nPBHcO2SqPbpAG8snbdg+Xse4pRefR98hgjFgIMCI/UhA=='};
 expect(api.SCROLL_CAUSE_PACKAGE_PROFILE.id).toBe('scroll-cause-security-pins-v2');
 expect(Object.isFrozen(api.SCROLL_CAUSE_PACKAGE_PROFILE)&&Object.isFrozen(api.SCROLL_CAUSE_PACKAGE_PROFILE.packages)&&Object.isFrozen(api.SCROLL_CAUSE_PACKAGE_PROFILE.packages['node_modules/zod'])).toBe(true);
 expect(Object.entries(api.SCROLL_CAUSE_PACKAGE_PROFILE.packages).filter(([path,pin])=>JSON.stringify(pin)!==JSON.stringify(MOUNTED_PACKAGE_PINS[path as keyof typeof MOUNTED_PACKAGE_PINS])).map(([path])=>path)).toEqual(['node_modules/zod']);
 const pins={...MOUNTED_PACKAGE_PINS,'node_modules/zod':patched};
 const root=await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-current-packages-')));
 for(const [path,pin]of Object.entries(pins)){await mkdir(resolve(root,path),{recursive:true});await writeFile(resolve(root,path,'package.json'),JSON.stringify({name:path.split('node_modules/').at(-1),version:pin.version}));}
 const publishLocks=async(accepted:unknown,installed:unknown)=>{await writeFile(resolve(root,'package-lock.json'),JSON.stringify({packages:accepted}));await writeFile(resolve(root,'node_modules/.package-lock.json'),JSON.stringify({packages:installed}));};
 await publishLocks(pins,pins);
 const packages=await api.validateDiagnosticInstalledPackages(root);
 expect(packages).toHaveLength(19);expect(packages.find(row=>row.path==='node_modules/zod/package.json')).toMatchObject(patched);
 expect(MOUNTED_PACKAGE_PINS['node_modules/zod'].version).toBe('4.6.5');
 for(const [accepted,installed,physicalVersion]of [
  [MOUNTED_PACKAGE_PINS,MOUNTED_PACKAGE_PINS,'4.6.5'],
  [{...pins,'node_modules/zod':{...patched,integrity:'forged'}},pins,'4.6.6'],
  [pins,{...pins,'node_modules/zod':{...patched,integrity:'forged'}},'4.6.6'],
  [pins,pins,'4.6.5'],
  [{...pins,'node_modules/react':{...pins['node_modules/react'],version:'19.2.0'}},pins,'4.6.6'],
 ]as const){await publishLocks(accepted,installed);await writeFile(resolve(root,'node_modules/zod/package.json'),JSON.stringify({name:'zod',version:physicalVersion}));await expect(api.validateDiagnosticInstalledPackages(root)).rejects.toThrow('diagnostic-installed-package');}
});

test('distinct diagnostic publisher reserves its fixed roles plus the actual launch-worker copy',async()=>{
 const helper=resolve('tests/support/hosted-copilot-scroll-cause-artifact.ts');
 const api=existsSync(helper)?await import(pathToFileURL(helper).href):null;
 expect(api?.SCROLL_CAUSE_ROLE_CAPS,'fixed diagnostic namespace must exist independently of normal inventories').toBeDefined();
 if(!api)throw Error('diagnostic helper absent');
 expect(Object.keys(api.SCROLL_CAUSE_ROLE_CAPS)).toHaveLength(31);
 expect(Object.values(api.SCROLL_CAUSE_ROLE_CAPS).reduce((a:number,b:unknown)=>a+Number(b),0)).toBe(104468480);
 expect(api.assertDiagnosticBudget(121245696,32)).toBeUndefined();
 expect(()=>api.assertDiagnosticBudget(134217729,32)).toThrow();
 expect(()=>api.assertDiagnosticBudget(1,129)).toThrow();
});

test('failed original command retains literal stack bytes and explicit closed stream originals',async()=>{
 const api=await import('./support/hosted-copilot-scroll-cause-artifact.js');
 expect((api as any).captureDiagnosticCommand).toBeTypeOf('function');
 const directory=await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-command-')));
 const sentinel='Error: original SDK sentinel\n    at original (sdk.js:1:2)\n';
 const result=await (api as any).captureDiagnosticCommand(directory,'application',[process.execPath,'-e',`process.stdout.write('literal-out');process.stderr.write(${JSON.stringify(sentinel)});process.exitCode=7`],10000,{});
 expect(result.exit).toEqual({exitCode:7,signal:null});
 expect(result).toMatchObject({spawned:true,exitObserved:true,closeObserved:true,timedOut:false,streamsComplete:true});
 expect(await readFile(resolve(directory,'application.stderr'),'utf8')).toBe(sentinel);
 expect(await readFile(resolve(directory,'application.stdout'),'utf8')).toBe('literal-out');
 for(const name of ['stdout','stderr'])expect(result.streams[name]).toMatchObject({readableEOF:true,writerFinish:true,writerClose:true,writerError:false,overflow:false});
 expect((api as any).assertDiagnosticCommandClosure).toBeTypeOf('function');
 const started=JSON.parse(await readFile(resolve(directory,'application-started.json'),'utf8'));
 const stdout=await (api as any).readDiagnosticRole(directory,'application.stdout'),stderr=await (api as any).readDiagnosticRole(directory,'application.stderr');
 expect(()=>(api as any).assertDiagnosticCommandClosure(started,result,{stdout,stderr},result.argv)).not.toThrow();
 for(const changed of [{...result,exitObserved:false},{...result,argv:['alien']},{...result,streams:{...result.streams,stderr:{...result.streams.stderr,seen:0}}}])expect(()=>(api as any).assertDiagnosticCommandClosure(started,changed,{stdout,stderr},result.argv)).toThrow();
});

test('physical role authentication refuses hardlinks and whole-byte mutation',async()=>{
 const api=await import('./support/hosted-copilot-scroll-cause-artifact.js');
 expect((api as any).readDiagnosticRole).toBeTypeOf('function');
 const directory=await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-role-')));
 await writeFile(resolve(directory,'application.stdout'),'sentinel');
 const original=await (api as any).readDiagnosticRole(directory,'application.stdout');
 await writeFile(resolve(directory,'application.stdout'),'changed!');
 await expect((api as any).revalidateDiagnosticRole(directory,original)).rejects.toThrow();
 await link(resolve(directory,'application.stdout'),resolve(directory,'linked'));
 await expect((api as any).readDiagnosticRole(directory,'application.stdout')).rejects.toThrow();
});

test('diagnostic HTML preserves the original named launch and only redirects its exact entry',async()=>{
 const path=resolve('tests/support/hosted-copilot-scroll-cause-build.ts');
 const api=existsSync(path)?await import(pathToFileURL(path).href):null;
 expect(api?.redirectScrollCauseHtml).toBeTypeOf('function');
 if(!api)throw Error('diagnostic builder absent');
 const original=await readFile(resolve('apps/copilotkit/index.html'),'utf8');
 const redirected=api.redirectScrollCauseHtml(original);
 expect(redirected.replace('/src/scroll-cause-main.ts','/src/main.tsx')).toBe(original);
 expect(redirected.match(/launchPage\(\)/g)).toHaveLength(1);
 expect(()=>api.redirectScrollCauseHtml(redirected)).toThrow();
 expect(()=>api.redirectScrollCauseHtml(original+original)).toThrow();
 const main=await readFile(resolve('apps/copilotkit/src/scroll-cause-main.ts'),'utf8');
 expect(main.indexOf("import './scroll-cause-frontend.ts'")).toBeLessThan(main.indexOf("export {launchPage}"));
 expect(main).toContain("export {launchPage} from './main.tsx'");
});

test('diagnostic transform resolves only its single canonical bridge and authenticates original vendor bytes',async()=>{
 const api=await import('./support/hosted-copilot-scroll-cause-build.js');
 expect((api as any).createScrollCauseFrontendPlugin).toBeTypeOf('function');
 const root=await realpath(resolve('.')),owned=(api as any).createScrollCauseFrontendPlugin(root);
 const bridge=resolve(root,'apps/copilotkit/src/scroll-cause-frontend.ts');
 expect(owned.plugin.resolveId(pathToFileURL(bridge).href)).toBe(bridge);
 expect(()=>owned.plugin.resolveId('file:///unowned.mjs')).toThrow();
 expect(owned.plugin.resolveId('react')).toBeNull();
 const source=await readFile(resolve(root,'node_modules/@tanstack/virtual-core/dist/esm/index.js'),'utf8');
 const id=resolve(root,'node_modules/@tanstack/virtual-core/dist/esm/index.js');
 expect(owned.plugin.transform(source,id).code).toContain('scrollCauseObserver as __scrollCauseV1');
 expect(()=>owned.plugin.transform(source+' ',id)).toThrow();
 expect(()=>owned.plugin.transform(source,id)).toThrow();
});

test('diagnostic bridge installs one frozen own-data capability using the imported observer singleton',async()=>{
 const path=resolve('apps/copilotkit/src/scroll-cause-frontend.ts');expect(existsSync(path)).toBe(true);
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),target={};Object.defineProperty(globalThis,'window',{configurable:true,value:target});
 try{
  const api=await import(pathToFileURL(path).href),d=Object.getOwnPropertyDescriptor(target,'__copilotkitScrollCauseDiagnostic')!;
  expect(d).toMatchObject({enumerable:true,writable:false,configurable:false});
  expect(Object.isFrozen(d.value)).toBe(true);expect(d.value.observer).toBe(api.scrollCauseObserver);
  expect(Object.keys(d.value)).toEqual(['protocol','observer','start','marker','seal']);
  const owner={};d.value.start.call(d.value,owner);d.value.marker.call(d.value,owner,{role:'pre',ordinal:1,slot:null});
  expect(d.value.seal.call(d.value)).toMatchObject({version:2,collectionState:'sealed',markers:{count:1},qualification:false,nativeGO:false,performance:false,FPS:'unavailable'});
 }finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});

test('optional publication absence is witnessed, never inferred from missing physical roles',async()=>{
 const api=await import('./support/hosted-copilot-scroll-cause-artifact.js');expect((api as any).diagnosticAbsentRoles).toBeTypeOf('function');
 const mandatory=(api as any).SCROLL_CAUSE_MANDATORY_ROLES as string[],present=new Set(mandatory);
 const missing=[['native-case-1.json','case-not-produced'],['native-case-2.json','case-not-produced'],['tracker-a-case-2-input.json','input-not-produced'],['tracker-a-case-2-transport.json','transport-not-produced'],['diagnostic-first-failure.json','first-failure-none'],['scroll-cause-ledger.json','ledger-unavailable'],['scroll-cause-export.json','export-not-created']].map(([path,reason])=>({path,reason}));
 const result=(api as any).diagnosticAbsentRoles(present,missing,{stdio:[]},{created:false,closed:false});
 expect(result).toHaveLength(10);expect(result).toContainEqual({path:'browser-stdout.bin',reason:'stdio-not-exposed'});
 expect(()=>(api as any).diagnosticAbsentRoles(present,missing.slice(1),{stdio:[]})).toThrow();
 expect(()=>(api as any).diagnosticAbsentRoles(new Set([...present,'native-case-1.json']),missing,{stdio:[]})).toThrow();
 expect(()=>(api as any).diagnosticAbsentRoles(new Set([...present].filter(x=>x!=='parent-result.json')),missing,{stdio:[]})).toThrow();
 expect(()=>(api as any).diagnosticAbsentRoles(present,missing,{stdio:[{index:1,kind:'stdout',attached:true,status:'pending'}]})).toThrow();
 for(const raw of [{created:true,closed:false},{created:false,closed:true},{created:true,closed:true}])expect(()=>(api as any).diagnosticAbsentRoles(present,missing,{stdio:[]},raw)).toThrow();
});

test('diagnostic JSON refuses duplicate keys, nonfinite/unsafe numbers and getter transport',async()=>{
 const api=await import('./support/hosted-copilot-scroll-cause-artifact.js');expect((api as any).parseDiagnosticJson).toBeTypeOf('function');
 expect((api as any).parseDiagnosticJson(Buffer.from('{"x":[1,0.5,null]}'))).toEqual({x:[1,0.5,null]});
 for(const raw of ['{"x":1,"x":2}','{"x":{"a":1,"a":2}}','{"x":1e999}','{"x":9007199254740993}','{"x":1} trailing'])expect(()=>(api as any).parseDiagnosticJson(Buffer.from(raw))).toThrow();
 let touched=false;expect(()=>api.diagnosticRecord({get x(){touched=true;return 1;}},['x'])).toThrow();expect(touched).toBe(false);
});

test('diagnostic worker AST adapter accepts exactly one fixed static binding and restores analysis input',async()=>{
 const api=await import('./support/hosted-copilot-scroll-cause-build.js');expect((api as any).collectDiagnosticWorkerImports).toBeTypeOf('function');
 const path='../../../../../node_modules/zod/index.js',statement=(type='ImportDeclaration',value=path)=>({type,source:{type:'Literal',value},specifiers:[],attributes:[]});
 const ast={type:'Program',body:[statement()]};expect((api as any).collectDiagnosticWorkerImports(ast)).toEqual([{specifier:path,kind:'static'}]);expect(ast.body[0]?.source.value).toBe(path);
 for(const body of [[],[statement(),statement()],[statement('ImportExpression')],[statement('ExportNamedDeclaration')],[statement('ImportDeclaration','../../../../node_modules/zod/index.js')],[{...statement(),attributes:[{type:'ImportAttribute'}]}],[statement('ImportDeclaration',path+'?alias')]])expect(()=>(api as any).collectDiagnosticWorkerImports({type:'Program',body})).toThrow();
});

test('child publication footer binds literal closed stdout and original raw sink facts without success promotion',async()=>{
 const api=await import('./support/hosted-copilot-scroll-cause-artifact.js');expect((api as any).encodeDiagnosticFooter).toBeTypeOf('function');
 const source='a'.repeat(40),run='123',ref={path:'diagnostic-strict-result.json',bytes:12,sha256:'b'.repeat(64)};
 const footer=(api as any).encodeDiagnosticFooter({protocol:'scroll-cause-child-publication-v1',source,run,rawTrace:{created:false,closed:false},strictResultRef:ref});
 const raw=Buffer.from('literal SDK original stack\n'+footer),expected={source,run,strictResultRef:ref};
 expect((api as any).parseDiagnosticFooter(raw,expected)).toMatchObject({rawTrace:{created:false,closed:false},stdoutRef:{path:'application.stdout',bytes:raw.length,sha256:api.diagnosticHash(raw)}});
 for(const wrong of [Buffer.from('no footer'),Buffer.from(footer+footer),Buffer.from(footer.replace('b'.repeat(64),'c'.repeat(64))),Buffer.alloc(262145,65)])expect(()=>(api as any).parseDiagnosticFooter(wrong,expected)).toThrow();
 expect(()=>(api as any).encodeDiagnosticFooter({protocol:'scroll-cause-child-publication-v1',source,run,rawTrace:{created:false,closed:true},strictResultRef:ref})).toThrow();
});

test('frontend ZIP closes the exact original asset bytes with CRC and bounded physical member joins',async()=>{
 const api=await import('./support/hosted-copilot-scroll-cause-artifact.js');expect((api as any).packDiagnosticFrontend).toBeTypeOf('function');
 const root=await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-assets-')));await writeFile(resolve(root,'index.html'),'sentinel html');
 const files=[{path:'index.html',bytes:13,sha256:api.diagnosticHash('sentinel html')}];
 const zip=await (api as any).packDiagnosticFrontend(root,files);
 expect(zip.readUInt32LE(0)).toBe(0x04034b50);expect(zip.readUInt32LE(zip.length-22)).toBe(0x06054b50);expect(zip.readUInt16LE(zip.length-12)).toBe(1);
 const {inflateRawSync}=await import('node:zlib');const n=zip.readUInt16LE(26),size=zip.readUInt32LE(18);expect(inflateRawSync(zip.subarray(30+n,30+n+size)).toString()).toBe('sentinel html');
 await writeFile(resolve(root,'index.html'),'changed bytes');await expect((api as any).packDiagnosticFrontend(root,files)).rejects.toThrow();
 await expect((api as any).packDiagnosticFrontend(root,[...files,files[0]])).rejects.toThrow();
});

const inactivePostCaptureDrain=()=>({schemaVersion:1,eligibility:'ineligible',reason:'no-measured-failure',original:'not-started',waiter:'not-started',outcome:'ineligible',requestedHostMs:null,targetHostMs:null,settledHostMs:null});
async function closedPublicationFixture(exit=2,postCaptureDrain:unknown=inactivePostCaptureDrain()){
 const a=await import('./support/hosted-copilot-scroll-cause-artifact.js'),directory=await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-publish-'))),worker=resolve(await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-worker-'))),'worker.mjs');await writeFile(worker,'export {};\n');
 const source={commitSha:'a'.repeat(40),treeSha:'b'.repeat(40),lockSha256:'c'.repeat(64)},run={repository:'cacheplane/chat-ui-bench',runId:'123',attempt:1,tag:'hosted-copilot-react-scroll-cause-v3'};
 const ref=async(path:any)=>a.diagnosticRef(await a.readDiagnosticRole(directory,path));
 await a.writeDiagnosticJson(directory,'diagnostic-profile.json',{source,run,qualification:false});
 await a.writeDiagnosticJson(directory,'diagnostic-source.json',{source,run,qualification:false});
 for(const path of ['diagnostic-transform.json','diagnostic-frontend-inventory.json','diagnostic-module-pins.json'] as const)await a.writeDiagnosticJson(directory,path,{qualification:false});
 await a.writeDiagnosticRole(directory,'diagnostic-worker.mjs',Buffer.from('export {};\n'));await a.writeDiagnosticRole(directory,'diagnostic-frontend.zip',Buffer.from('synthetic archive'));
 await a.writeDiagnosticRole(directory,'diagnostic-browser-registry.json',Buffer.from('{}\n'));
 await a.writeDiagnosticJson(directory,'diagnostic-build.json',{source,run,profilePath:'diagnostic-profile.json',profileSha256:(await ref('diagnostic-profile.json')).sha256,worker:{launchPath:worker,bytes:11,sha256:a.diagnosticHash('export {};\n')},qualification:false});
 await a.writeDiagnosticJson(directory,'tracker-a-profile.json',{source,run,recipeRef:await ref('diagnostic-profile.json'),buildRef:await ref('diagnostic-build.json'),qualification:false});
 const absent=[['native-case-1.json','case-not-produced'],['native-case-2.json','case-not-produced'],['tracker-a-case-2-input.json','input-not-produced'],['tracker-a-case-2-transport.json','transport-not-produced'],['diagnostic-first-failure.json','first-failure-none'],['scroll-cause-ledger.json','ledger-unavailable']].map(([path,reason])=>({path,reason}));
 await a.writeDiagnosticJson(directory,'diagnostic-strict-result.json',{schemaVersion:1,kind:'unqualified-scroll-cause-strict-result',profileRef:await ref('tracker-a-profile.json'),strict:{status:'incomplete',hasPrimary:true,firstFailure:null,cleanupFailureCount:0},caseEvidence:[],originals:[{label:'browserConnect',status:'fulfilled'},{label:'clientClose',status:'fulfilled'},{label:'clientDisconnected',status:'fulfilled'}],browserVersion:null,anchorDiagnostic:null,postCaptureDrain,publicationAbsence:absent,attributionCoverage:{availability:'unavailable'},qualification:false,nativeGO:false,performance:false,fps:'unavailable'});
 await a.writeDiagnosticJson(directory,'scroll-cause-export.json',{status:'not-started',requestedHostMs:null,targetHostMs:null,settledHostMs:null,waiter:'not-started',failure:null});
 const footer=a.encodeDiagnosticFooter({protocol:'scroll-cause-child-publication-v1',source:source.commitSha,run:run.runId,rawTrace:{created:false,closed:false},strictResultRef:await ref('diagnostic-strict-result.json')});
 const childArgv=[process.execPath,'-e',`process.stdout.write(${JSON.stringify(footer)});process.exitCode=${exit}`],parentArgv=[process.execPath,'-e',`process.exitCode=${exit}`];
 await a.captureDiagnosticCommand(directory,'application',childArgv,10000);await a.captureDiagnosticCommand(directory,'parent',parentArgv,10000);
 const childPublication=a.parseDiagnosticFooter(await readFile(resolve(directory,'application.stdout')),{source:source.commitSha,run:run.runId,strictResultRef:await ref('diagnostic-strict-result.json')});
 await a.writeDiagnosticJson(directory,'diagnostic-browser-process.json',{coverage:'post-bind-only',binaryByteIdentity:'unestablished',descendants:'unqualified',closePromise:'fulfilled',closeEvent:'fulfilled',stdio:[],childPublication,qualification:false});
 return {a,directory,context:{source,run,parentArgv,childArgv,launchWorker:worker}};
}

test('manifest-last retains a closed failed command and reauthenticates namespace, references and original lifetime',async()=>{
 const {a,directory,context}=await closedPublicationFixture();expect((a as any).publishDiagnosticInventory).toBeTypeOf('function');
 const manifest=await (a as any).publishDiagnosticInventory(directory,context);
 expect(manifest).toMatchObject({kind:'unqualified-scroll-cause-manifest',qualification:false,nativeGO:false,performance:false,fps:'unavailable'});
 expect(manifest.strictResultRef.path).toBe('diagnostic-strict-result.json');expect(manifest.trackerProfileRef.path).toBe('tracker-a-profile.json');
 await expect((a as any).verifyDiagnosticInventory(directory,context)).resolves.toMatchObject({qualification:false});
 await writeFile(resolve(directory,'application.stderr'),'mutation after manifest');await expect((a as any).verifyDiagnosticInventory(directory,context)).rejects.toThrow();
});

test('hosted diagnostic context refuses mixed source, release, attempt and runtime flags before any SDK import',async()=>{
 const path=resolve('tests/support/hosted-copilot-scroll-cause-launch.ts');const api=existsSync(path)?await import(pathToFileURL(path).href):null;expect(api?.selectScrollCauseHostedContext).toBeTypeOf('function');if(!api)throw Error('launcher absent');
 const c={sourceSha:'a'.repeat(40),checkoutSha:'a'.repeat(40),tagSha:'a'.repeat(40),githubSha:'a'.repeat(40),workflowSha:'a'.repeat(40),repository:'cacheplane/chat-ui-bench',runId:'123',attempt:'1',ref:'refs/tags/hosted-copilot-react-scroll-cause-v3',workflowRef:'cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-scroll-cause.yml@refs/tags/hosted-copilot-react-scroll-cause-v3',event:'workflow_dispatch',actions:'true',platform:'linux',runner:'Linux',node:'v24.20.0',npm:'11.19.0',execArgv:['--experimental-import-meta-resolve']};
 expect(api.selectScrollCauseHostedContext(c)).toMatchObject({sourceSha:c.sourceSha,runId:'123'});
 for(const changed of [{ref:'refs/tags/hosted-copilot-react-scroll-cause-v2',workflowRef:'cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-scroll-cause.yml@refs/tags/hosted-copilot-react-scroll-cause-v2'},{attempt:'2'},{checkoutSha:'b'.repeat(40)},{ref:'refs/heads/main'},{ref:'refs/tags/hosted-copilot-react-scroll-cause-v1',workflowRef:'cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-scroll-cause.yml@refs/tags/hosted-copilot-react-scroll-cause-v1'},{node:'v25.0.0'},{execArgv:[]},{execArgv:['--experimental-import-meta-resolve','--import=alien']}])expect(()=>api.selectScrollCauseHostedContext({...c,...changed})).toThrow();
});

test('owned raw trace writer exposes actual fsync and close originals and refuses concurrent or post-finish writes',async()=>{
 const path=resolve('tests/support/hosted-copilot-scroll-cause-launch.ts');const api=existsSync(path)?await import(pathToFileURL(path).href):null;expect(api?.reserveDiagnosticTrace).toBeTypeOf('function');if(!api)throw Error('launcher absent');
 const directory=await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-raw-'))),state={attempted:false,created:false,closed:false};
 const sink=await api.reserveDiagnosticTrace(directory,state);expect(state).toMatchObject({attempted:true,created:true,closed:false});await sink.write(Buffer.from('{"traceEvents":[]}'));
 const ref=await sink.finish();expect(ref).toMatchObject({path:'tracker-a-case-2-trace.json',bytes:18});await expect(sink.fsync).resolves.toBeUndefined();await expect(sink.fileClose).resolves.toBeUndefined();expect(state.closed).toBe(true);
 await expect(sink.write(Buffer.from('late'))).rejects.toThrow();await expect(api.reserveDiagnosticTrace(directory,state)).rejects.toThrow();
});

test('separate workflow sequences closed outer run before independent inventory and uses only the distinct namespace',async()=>{
 const workflow=resolve('.github/workflows/hosted-copilot-scroll-cause.yml'),tool=resolve('tools/hosted-copilot-scroll-cause.mjs');expect(existsSync(workflow)).toBe(true);expect(existsSync(tool)).toBe(true);
 const yaml=await readFile(workflow,'utf8'),source=await readFile(resolve('tests/support/hosted-copilot-scroll-cause-launch.ts'),'utf8');
 expect(yaml.indexOf('id: runtime')).toBeLessThan(yaml.indexOf('id: inventory'));expect(yaml).toContain("if: always() && (steps.runtime.outcome == 'success' || steps.runtime.outcome == 'failure')");expect(yaml).toContain("if: always() && steps.inventory.outcome == 'success' && steps.finalcheck.outcome == 'success'");
 expect(yaml).not.toContain('continue-on-error');expect(yaml).toContain('copilot-scroll-cause-${{ github.run_id }}-${{ github.run_attempt }}');expect(source).toContain("captureDiagnosticCommand(directory,'parent'");expect(source).toContain("captureDiagnosticCommand(directory,'application'");expect(source).not.toContain('hosted-copilot-mounted-bootstrap');
 const {spawnSync}=await import('node:child_process');const refused=spawnSync(process.execPath,['--experimental-import-meta-resolve',tool,'invalid'],{cwd:resolve('.'),env:{PATH:'/usr/bin:/bin'},encoding:'utf8'});expect(refused.status).toBe(1);expect(refused.stderr).toBe('scroll-cause-diagnostic-refused\n');expect(refused.stdout).toBe('');
});

test.each(['extra','hardlink','open-command','bad-argv','other-role-ref','duplicate-footer','raw-created','raw-present','browser-open','absent-unwitnessed'] as const)('publisher refuses hostile original %s before a manifest exists',async attack=>{
 const {a,directory,context}=await closedPublicationFixture();
 const change=async(path:string,mutate:(r:any)=>unknown)=>{const r=JSON.parse(await readFile(resolve(directory,path),'utf8'));await writeFile(resolve(directory,path),JSON.stringify(mutate(r))+'\n');};
 if(attack==='extra')await writeFile(resolve(directory,'unowned'),'no');
 if(attack==='hardlink')await link(resolve(directory,'application.stderr'),resolve(await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-link-'))),'copy'));
 if(attack==='open-command')await change('parent-result.json',r=>({...r,streams:{...r.streams,stdout:{...r.streams.stdout,writerClose:false}}}));
 if(attack==='bad-argv')context.childArgv=['alien'];
 if(attack==='other-role-ref'){const other=a.diagnosticRef(await a.readDiagnosticRole(directory,'diagnostic-source.json'));await change('tracker-a-profile.json',r=>({...r,recipeRef:other}));}
 if(attack==='duplicate-footer'){const raw=await readFile(resolve(directory,'application.stdout'));await writeFile(resolve(directory,'application.stdout'),Buffer.concat([raw,raw]));}
 if(attack==='raw-created')await change('diagnostic-browser-process.json',r=>({...r,childPublication:{...r.childPublication,rawTrace:{created:true,closed:false}}}));
 if(attack==='raw-present')await writeFile(resolve(directory,'tracker-a-case-2-trace.json'),'unclaimed');
 if(attack==='browser-open')await change('diagnostic-browser-process.json',r=>({...r,closeEvent:'pending'}));
 if(attack==='absent-unwitnessed')await change('diagnostic-strict-result.json',r=>({...r,publicationAbsence:[]}));
 await expect(a.publishDiagnosticInventory(directory,context)).rejects.toThrow();expect(existsSync(resolve(directory,'diagnostic-manifest.json'))).toBe(false);
});

test.each(['original','manifest','interrupted'] as const)('manifest physically existing never grants upload after %s publication fault',async attack=>{
 const {a,directory,context}=await closedPublicationFixture();
 await expect(a.publishDiagnosticInventory(directory,context,async(dir,name,value)=>{await a.writeDiagnosticJson(dir,name,value);if(attack==='original')await writeFile(resolve(dir,'application.stderr'),'after manifest sentinel');else if(attack==='manifest')await writeFile(resolve(dir,name),'{}\n');else throw Error('interrupted after fsync');})).rejects.toThrow();
 expect(existsSync(resolve(directory,'diagnostic-manifest.json'))).toBe(true);if(attack!=='interrupted')await expect(a.verifyDiagnosticInventory(directory,context)).rejects.toThrow();
});

test('closed infrastructure exit1 refuses publication even with a valid footer and every physical role',async()=>{
 const {a,directory,context}=await closedPublicationFixture(1);await expect(a.publishDiagnosticInventory(directory,context)).rejects.toThrow();expect(existsSync(resolve(directory,'diagnostic-manifest.json'))).toBe(false);
});

test.each(['spawn','overflow'] as const)('actual command %s failure never manufactures stream completion',async kind=>{
 const a=await import('./support/hosted-copilot-scroll-cause-artifact.ts'),directory=await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-capture-refusal-')));
 const argv=kind==='spawn'?['/no/such/scroll-cause-command']:[process.execPath,'-e','process.stdout.write(Buffer.alloc(262145,65))'];
 const result=await a.captureDiagnosticCommand(directory,'application',argv,10000);
 if(kind==='spawn')expect(result).toMatchObject({spawned:false,spawnError:'spawn-refused'});else expect(result.streams.stdout).toMatchObject({overflow:true,retained:262144});
 expect(()=>a.assertDiagnosticCommandClosure(JSON.parse('{}'),result,{stdout:{bytes:0},stderr:{bytes:0}},argv)).toThrow();
});

test('closed pending-completionACK failure stays refused while independent command forensics retain exact eight originals',async()=>{
 const {a,directory,context}=await closedPublicationFixture();
 const {MOUNTED_CASE_WITNESS_LABELS}=await import('./support/hosted-copilot-mounted-policy.ts');
 const strict=JSON.parse(await readFile(resolve(directory,'diagnostic-strict-result.json'),'utf8'));
 strict.caseEvidence=[{caseNumber:2,originals:MOUNTED_CASE_WITNESS_LABELS.map(label=>({label,status:label==='completionACK'?'pending':'fulfilled'}))}];
 await writeFile(resolve(directory,'diagnostic-strict-result.json'),JSON.stringify(strict)+'\n');
 await expect(a.publishDiagnosticInventory(directory,context)).rejects.toThrow('diagnostic-case-open');
 expect((a as any).admitScrollCauseCommandForensics).toBeTypeOf('function');
 const stage=directory+'-command-forensics',manifest=await (a as any).admitScrollCauseCommandForensics(directory,stage,context);
 expect(manifest).toMatchObject({kind:'unqualified-scroll-cause-command-forensics',diagnosticArtifactAdmission:'not-established',qualification:false,nativeGO:false,performance:false,fps:'unavailable'});
 expect(manifest.files).toHaveLength(8);expect(manifest.outcomes.application.exit).toEqual({exitCode:2,signal:null});
 for(const row of manifest.files)expect(await readFile(resolve(stage,row.path))).toEqual(await readFile(resolve(directory,row.path)));
 expect(existsSync(resolve(stage,'diagnostic-strict-result.json'))).toBe(false);expect(existsSync(resolve(directory,'diagnostic-manifest.json'))).toBe(false);
 await expect((a as any).verifyScrollCauseCommandForensics(directory,stage,context)).resolves.toMatchObject({qualification:false});
});

test('command forensic reservation charges original ceiling, all copies and manifest within unchanged union cap',async()=>{
 const a=await import('./support/hosted-copilot-scroll-cause-artifact.ts');expect((a as any).SCROLL_CAUSE_FORENSIC_RESERVATION).toEqual({bytes:130240512,files:41});
 a.assertDiagnosticBudget(134217728,128);expect(()=>a.assertDiagnosticBudget(134217729,128)).toThrow();expect(()=>a.assertDiagnosticBudget(1,129)).toThrow();
 expect((a as any).SCROLL_CAUSE_FORENSIC_ROLES).toHaveLength(8);expect(Object.hasOwn(a.SCROLL_CAUSE_ROLE_CAPS,'forensic-manifest.json')).toBe(false);
});

test('workflow independent command fallback runs after failed diagnostic admission and preserves original failure',async()=>{
 const yaml=await readFile(resolve('.github/workflows/hosted-copilot-scroll-cause.yml'),'utf8'),source=await readFile(resolve('tests/support/hosted-copilot-scroll-cause-launch.ts'),'utf8');
 expect(yaml).toContain("if: always() && (steps.runtime.outcome == 'success' || steps.runtime.outcome == 'failure') && (steps.inventory.outcome == 'failure' || steps.finalcheck.outcome == 'failure')");
 expect(yaml).toContain("if: always() && steps.forensic.outcome == 'success' && steps.forensic_finalcheck.outcome == 'success'");expect(yaml).toContain('copilot-scroll-cause-command-forensics-${{ github.run_id }}-${{ github.run_attempt }}');expect(yaml).not.toContain('continue-on-error');
 const dispatcher=source.slice(source.indexOf('export async function runScrollCauseAction'));expect(dispatcher.indexOf("action==='forensic'")).toBeGreaterThan(0);expect(dispatcher.indexOf("action==='forensic'")).toBeLessThan(dispatcher.indexOf('const loaded=await authenticateDiagnosticBuild'));
 expect(source.indexOf('diagnosticPrimaryLine(result.strict.primary)')).toBeGreaterThan(source.indexOf('const result=await imported.runNativeMountedScrollCauseDiagnostic'));expect(source.indexOf('diagnosticPrimaryLine(result.strict.primary)')).toBeLessThan(source.indexOf('const footer=encodeDiagnosticFooter'));
});

test.each(['missing','hardlink','open','overflow','argv','extra','existing-stage','nonsibling'] as const)('command forensics refuses %s before manifest publication',async attack=>{
 const {a,directory,context}=await closedPublicationFixture();let stage=directory+'-forensics';
 if(attack==='missing'){const {unlink}=await import('node:fs/promises');await unlink(resolve(directory,'application.stderr'));}
 if(attack==='hardlink')await link(resolve(directory,'application.stderr'),directory+'-linked-stderr');
 if(attack==='open'||attack==='overflow'){const path=resolve(directory,'application-result.json'),r=JSON.parse(await readFile(path,'utf8'));if(attack==='open')r.streams.stderr.writerClose=false;else r.streams.stderr.overflow=true;await writeFile(path,JSON.stringify(r)+'\n');}
 if(attack==='argv')context.childArgv=['foreign-command'];
 if(attack==='extra')await writeFile(resolve(directory,'foreign-role'),'foreign');
 if(attack==='existing-stage'){const {mkdir}=await import('node:fs/promises');await mkdir(stage);await writeFile(resolve(stage,'sentinel'),'unchanged');}
 if(attack==='nonsibling')stage=resolve(directory,'nested-stage');
 await expect(a.admitScrollCauseCommandForensics(directory,stage,context)).rejects.toThrow();expect(existsSync(resolve(stage,'forensic-manifest.json'))).toBe(false);
 if(attack==='existing-stage')expect(await readFile(resolve(stage,'sentinel'),'utf8')).toBe('unchanged');
});

test.each(['original','copy','manifest','namespace','interrupted'] as const)('command manifest physically exists but admission rejects after %s fault',async attack=>{
 const {a,directory,context}=await closedPublicationFixture(),stage=directory+'-forensics';
 await expect(a.admitScrollCauseCommandForensics(directory,stage,context,async(dir,raw)=>{
  await writeFile(resolve(dir,'forensic-manifest.json'),raw,{flag:'wx'});
  if(attack==='original')await writeFile(resolve(directory,'application.stderr'),'after-manifest original sentinel');
  if(attack==='copy')await writeFile(resolve(dir,'application.stderr'),'after-manifest copy sentinel');
  if(attack==='manifest')await writeFile(resolve(dir,'forensic-manifest.json'),'{}\n');
  if(attack==='namespace')await writeFile(resolve(dir,'foreign-role'),'unowned');
  if(attack==='interrupted')throw Error('interrupted after manifest');
 })).rejects.toThrow();
 expect(existsSync(resolve(stage,'forensic-manifest.json'))).toBe(true);
 if(attack!=='interrupted')await expect(a.verifyScrollCauseCommandForensics(directory,stage,context)).rejects.toThrow();
});

test('command-only evidence honestly retains infrastructure failure without diagnostic admission and finalcheck rejects later mutation',async()=>{
 const {a,directory,context}=await closedPublicationFixture(1),stage=directory+'-forensics';
 await expect(a.publishDiagnosticInventory(directory,context)).rejects.toThrow('diagnostic-infrastructure-exit');
 const manifest=await a.admitScrollCauseCommandForensics(directory,stage,context);expect(manifest.outcomes.application).toMatchObject({exit:{exitCode:1,signal:null},timedOut:false});expect(manifest.diagnosticArtifactAdmission).toBe('not-established');
 await writeFile(resolve(stage,'parent.stdout'),'later mutation');await expect(a.verifyScrollCauseCommandForensics(directory,stage,context)).rejects.toThrow();
});

test('command forensics preserves actual timed-out signal exit and literal sentinel bytes without promoting closure scope',async()=>{
 const {a,directory,context}=await closedPublicationFixture(),{unlink}=await import('node:fs/promises');
 for(const name of ['application-started.json','application-result.json','application.stdout','application.stderr'])await unlink(resolve(directory,name));
 context.childArgv=[process.execPath,'-e',"process.stdout.write('literal timeout sentinel');setInterval(()=>{},1000)"];
 const result=await a.captureDiagnosticCommand(directory,'application',context.childArgv,300);
 expect(result).toMatchObject({timedOut:true,terminationRequested:true,exit:{exitCode:null,signal:'SIGTERM'},streamsComplete:true});
 const stage=directory+'-forensics',manifest=await a.admitScrollCauseCommandForensics(directory,stage,context);
 expect(await readFile(resolve(stage,'application.stdout'),'utf8')).toBe('literal timeout sentinel');expect(manifest.outcomes.application).toMatchObject({timedOut:true,terminationRequested:true});
 expect(manifest).toMatchObject({browserClosure:'unestablished',rawTraceClosure:'unestablished',descendants:'unqualified',qualification:false});
});

test.each([{attempt:2},{runId:'0'},{tag:'hosted-copilot-react-scroll-cause-v1'}])('command forensics refuses invalid caller context %j',async changed=>{
 const {a,directory,context}=await closedPublicationFixture();await expect(a.admitScrollCauseCommandForensics(directory,directory+'-forensics',{...context,run:{...context.run,...changed}})).rejects.toThrow('diagnostic-context-join');
});

for(const [name,receipt] of Object.entries({missing:undefined,extra:{...inactivePostCaptureDrain(),extra:1},enum:{...inactivePostCaptureDrain(),reason:'alien'},nonfinite:{...inactivePostCaptureDrain(),requestedHostMs:-1},inconsistent:{...inactivePostCaptureDrain(),original:'fulfilled'},pending:{schemaVersion:1,eligibility:'eligible',reason:'eligible',original:'pending',waiter:'not-started',outcome:'pending',requestedHostMs:1,targetHostMs:10,settledHostMs:null},rejected:{schemaVersion:1,eligibility:'eligible',reason:'eligible',original:'rejected',waiter:'rejected',outcome:'rejected',requestedHostMs:1,targetHostMs:10,settledHostMs:2},timeout:{schemaVersion:1,eligibility:'eligible',reason:'eligible',original:'pending',waiter:'timed-out',outcome:'timed-out',requestedHostMs:1,targetHostMs:10,settledHostMs:null},late:{schemaVersion:1,eligibility:'eligible',reason:'eligible',original:'fulfilled',waiter:'timed-out',outcome:'timed-out',requestedHostMs:1,targetHostMs:10,settledHostMs:11}})) test(`publisher independently refuses postcapture ${name}`,async()=>{
 const {a,directory,context}=await closedPublicationFixture(2,receipt===undefined?null:receipt);
 if(name==='missing'){const path=resolve(directory,'diagnostic-strict-result.json'),row=JSON.parse(await readFile(path,'utf8'));delete row.postCaptureDrain;await writeFile(path,JSON.stringify(row)+'\n');}
 await expect(a.publishDiagnosticInventory(directory,context)).rejects.toThrow();expect(existsSync(resolve(directory,'diagnostic-manifest.json'))).toBe(false);
});
test('publisher admits a fulfilled drain while retaining failed strict status and exit',async()=>{
 const receipt={schemaVersion:1,eligibility:'eligible',reason:'eligible',original:'fulfilled',waiter:'fulfilled',outcome:'fulfilled',requestedHostMs:1,targetHostMs:10,settledHostMs:2};
 const {a,directory,context}=await closedPublicationFixture(2,receipt);await expect(a.publishDiagnosticInventory(directory,context)).resolves.toMatchObject({qualification:false,nativeGO:false,performance:false});
 expect(JSON.parse(await readFile(resolve(directory,'diagnostic-strict-result.json'),'utf8')).strict).toMatchObject({status:'incomplete',hasPrimary:true});
});

test('v3 profile explicitly describes the unscored postcapture drain and preserves pilot protocol v2',async()=>{
 const source=await readFile(resolve('tests/support/hosted-copilot-scroll-cause-launch.ts'),'utf8');
 expect(source).toContain("postCaptureDrain:POST_CAPTURE_DRAIN_PROFILE");
 const api=await import('./support/hosted-copilot-scroll-cause-launch.ts');
 expect((api as any).POST_CAPTURE_DRAIN_PROFILE).toEqual({schemaVersion:1,mode:'unscored-postcapture-natural-drain',caseNumber:2,position:'after-capture-cleanup-before-owner-close',deadline:'original-overall-deadline',completion:'existing-public-validation-once',scoring:false});
 expect(source).toContain("strictMode:'tracker-json-a-pilot-v2'");
});

test('publisher receipt admission reads no accessor, proxy trap, coercion or error field',async()=>{
 const {assertDiagnosticPostCaptureDrain:admit}=await import('./support/hosted-copilot-scroll-cause-artifact.ts');let reads=0;
 const accessor={...inactivePostCaptureDrain()};Object.defineProperty(accessor,'reason',{enumerable:true,get(){reads++;throw Error('read');}});
 const proxy=new Proxy(inactivePostCaptureDrain(),{getPrototypeOf(){reads++;throw Error('trap');},ownKeys(){reads++;throw Error('trap');}});
 const coercion={...inactivePostCaptureDrain(),reason:{toString(){reads++;return 'no-measured-failure';}}};
 for(const receipt of [accessor,proxy,coercion])expect(()=>admit(receipt)).toThrow();
 expect(reads).toBe(0);
});

for(const reason of ['cleanup-timeout','cleanup-rejected'] as const)test(`publisher refuses ${reason} without its actual waiter state`,async()=>{
 const {a,directory,context}=await closedPublicationFixture(2,{...inactivePostCaptureDrain(),reason});
 await expect(a.publishDiagnosticInventory(directory,context)).rejects.toThrow();expect(existsSync(resolve(directory,'diagnostic-manifest.json'))).toBe(false);
});

for(const [name,receipt] of Object.entries({lateSuccess:{schemaVersion:1,eligibility:'eligible',reason:'eligible',original:'fulfilled',waiter:'fulfilled',outcome:'fulfilled',requestedHostMs:1,targetHostMs:10,settledHostMs:11},unpairedTimes:{...inactivePostCaptureDrain(),reason:'admission-closed',requestedHostMs:1},cleanupWithoutTimes:{...inactivePostCaptureDrain(),reason:'cleanup-rejected',waiter:'rejected'},earlyWithTimes:{...inactivePostCaptureDrain(),requestedHostMs:1,targetHostMs:10}}))test(`publisher refuses impossible drain time ${name}`,async()=>{
 const {a,directory,context}=await closedPublicationFixture(2,receipt);await expect(a.publishDiagnosticInventory(directory,context)).rejects.toThrow();expect(existsSync(resolve(directory,'diagnostic-manifest.json'))).toBe(false);
});
