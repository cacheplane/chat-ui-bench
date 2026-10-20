import {test,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdtemp,readFile,writeFile,link,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';

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

async function closedPublicationFixture(exit=2){
 const a=await import('./support/hosted-copilot-scroll-cause-artifact.js'),directory=await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-publish-'))),worker=resolve(await realpath(await mkdtemp(resolve(tmpdir(),'scroll-cause-worker-'))),'worker.mjs');await writeFile(worker,'export {};\n');
 const source={commitSha:'a'.repeat(40),treeSha:'b'.repeat(40),lockSha256:'c'.repeat(64)},run={repository:'cacheplane/chat-ui-bench',runId:'123',attempt:1,tag:'hosted-copilot-react-scroll-cause-v1'};
 const ref=async(path:any)=>a.diagnosticRef(await a.readDiagnosticRole(directory,path));
 await a.writeDiagnosticJson(directory,'diagnostic-profile.json',{source,run,qualification:false});
 await a.writeDiagnosticJson(directory,'diagnostic-source.json',{source,run,qualification:false});
 for(const path of ['diagnostic-transform.json','diagnostic-frontend-inventory.json','diagnostic-module-pins.json'] as const)await a.writeDiagnosticJson(directory,path,{qualification:false});
 await a.writeDiagnosticRole(directory,'diagnostic-worker.mjs',Buffer.from('export {};\n'));await a.writeDiagnosticRole(directory,'diagnostic-frontend.zip',Buffer.from('synthetic archive'));
 await a.writeDiagnosticRole(directory,'diagnostic-browser-registry.json',Buffer.from('{}\n'));
 await a.writeDiagnosticJson(directory,'diagnostic-build.json',{source,run,profilePath:'diagnostic-profile.json',profileSha256:(await ref('diagnostic-profile.json')).sha256,worker:{launchPath:worker,bytes:11,sha256:a.diagnosticHash('export {};\n')},qualification:false});
 await a.writeDiagnosticJson(directory,'tracker-a-profile.json',{source,run,recipeRef:await ref('diagnostic-profile.json'),buildRef:await ref('diagnostic-build.json'),qualification:false});
 const absent=[['native-case-1.json','case-not-produced'],['native-case-2.json','case-not-produced'],['tracker-a-case-2-input.json','input-not-produced'],['tracker-a-case-2-transport.json','transport-not-produced'],['diagnostic-first-failure.json','first-failure-none'],['scroll-cause-ledger.json','ledger-unavailable']].map(([path,reason])=>({path,reason}));
 await a.writeDiagnosticJson(directory,'diagnostic-strict-result.json',{schemaVersion:1,kind:'unqualified-scroll-cause-strict-result',profileRef:await ref('tracker-a-profile.json'),strict:{status:'incomplete',hasPrimary:true,firstFailure:null,cleanupFailureCount:0},caseEvidence:[],originals:[{label:'browserConnect',status:'fulfilled'},{label:'clientClose',status:'fulfilled'},{label:'clientDisconnected',status:'fulfilled'}],browserVersion:null,anchorDiagnostic:null,publicationAbsence:absent,attributionCoverage:{availability:'unavailable'},qualification:false,nativeGO:false,performance:false,fps:'unavailable'});
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
 const c={sourceSha:'a'.repeat(40),checkoutSha:'a'.repeat(40),tagSha:'a'.repeat(40),githubSha:'a'.repeat(40),workflowSha:'a'.repeat(40),repository:'cacheplane/chat-ui-bench',runId:'123',attempt:'1',ref:'refs/tags/hosted-copilot-react-scroll-cause-v1',workflowRef:'cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-scroll-cause.yml@refs/tags/hosted-copilot-react-scroll-cause-v1',event:'workflow_dispatch',actions:'true',platform:'linux',runner:'Linux',node:'v24.20.0',npm:'11.19.0',execArgv:['--experimental-import-meta-resolve']};
 expect(api.selectScrollCauseHostedContext(c)).toMatchObject({sourceSha:c.sourceSha,runId:'123'});
 for(const changed of [{attempt:'2'},{checkoutSha:'b'.repeat(40)},{ref:'refs/heads/main'},{node:'v25.0.0'},{execArgv:[]},{execArgv:['--experimental-import-meta-resolve','--import=alien']}])expect(()=>api.selectScrollCauseHostedContext({...c,...changed})).toThrow();
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
