import {describe,it,expect} from 'vitest';
import * as policy from './hosted-copilot-production-policy.ts';
import {assertFullAudit,capturedStreamComplete,assertProviderSnapshot,classifyVendorDiagnostics,assertProviderNextLink,normalizeReference,assertEmbeddedSvg,assertReferenceCount,assertMappings,assertManifest,assertExpectedAudit,assertExpectedVendor,classifyJsReference,type ProviderRun,type ProviderSnapshot} from './hosted-copilot-production-policy.ts';
const sha='a'.repeat(40),hash='b'.repeat(64),id='hosted-copilot-react-production-build-v1';
const run:ProviderRun={id:'10',headSha:sha,title:id,event:'workflow_dispatch',workflowId:'20',attempt:1,tag:id};
const page=<T>(records:readonly T[],totalCount:number|null)=>({page:1,totalCount,hasNext:false,records,status:200,bodyComplete:true});
function snapshot():ProviderSnapshot{return {repository:'cacheplane/chat-ui-bench',workflowId:'20',candidateSha:sha,releaseId:id,currentRunId:'10',currentRun:{...run},runPages:[page([{...run}],1)],releasePages:[page([],null)],releaseLookupStatus:404,acquisitionClosed:true,draftVisibility:'unverified'};}
const original=(exitCode:number)=>({exitCode,signal:null,stdoutBytes:10,stderrBytes:0,stdoutRetainedBytes:10,stderrRetainedBytes:0,closed:true,streamsComplete:true});
describe('bounded production module ownership capacity',()=>{
 const mappings=(count:number)=>Array.from({length:count},(_,index)=>({id:`\0virtual:${index}`,kind:'virtual' as const,external:false}));
 it.each([9212,16384])('retains all %i distinct module mappings',count=>expect(assertMappings(mappings(count))).toMatchObject({physical:0,virtual:count,qualification:false}));
 it('denies module count before accessing an oversized row',()=>{const rows=mappings(16385);let reads=0;Object.defineProperty(rows,0,{get(){reads++;throw new Error('row accessed');}});expect(()=>assertMappings(rows)).toThrow('Module ownership count exceeds 16384');expect(reads).toBe(0);});
 const guard=(id:unknown,index:number)=>(policy as unknown as {assertModuleOwnershipId:(id:unknown,index:number)=>void}).assertModuleOwnershipId(id,index);
 it('distinguishes a full native module slot from an invalid ID',()=>{expect(()=>guard(null,16384)).toThrow('Module ownership count exceeds 16384');expect(()=>guard(null,0)).toThrow('Module ownership ID shape/length denied');});
 it('admits exactly4096 ID characters and UTF8 bytes',()=>{const id='\0'+'a'.repeat(4095);expect(()=>guard(id,16383)).not.toThrow();expect(assertMappings([{id,kind:'virtual',external:false}])).toMatchObject({virtual:1});});
 it('denies character overflow before the byte scanner',()=>{const original=Buffer.byteLength;let calls=0;let failure:unknown;try {Buffer.byteLength=()=>{calls++;throw new Error('byte scanner reached');};try {guard('a'.repeat(4097),0);}catch(error){failure=error;}}finally {Buffer.byteLength=original;}expect(calls).toBe(0);expect(failure).toBeInstanceOf(Error);expect((failure as Error).message).toBe('Module ownership ID shape/length denied');});
 it('denies UTF8 byte overflow with bounded character length',()=>{const id='\0'+'é'.repeat(2048);expect(id.length).toBeLessThan(4096);expect(()=>guard(id,0)).toThrow('Module ownership ID byte bound');});
});
describe('supplied provider observations',()=>{
 it('excludes exactly validated current run and leaves draft/race scope open',()=>{const v=assertProviderSnapshot(snapshot());expect(v.observedUnused).toBe(true);expect(v.atomicLease).toBe(false);expect(v.draftVisibility).toBe('unverified');expect(v.qualification).toBe(false);});
 it('denies missing current row',()=>{const v=snapshot();v.runPages=[page([],0)];expect(()=>assertProviderSnapshot(v)).toThrow();});
 it.each(['headSha','title','workflowId','event'])('denies changed current %s',key=>{const v=snapshot();v.currentRun={...run,[key]:'wrong'};expect(()=>assertProviderSnapshot(v)).toThrow();});
 it('denies attempt2',()=>{const v=snapshot();v.currentRun.attempt=2;expect(()=>assertProviderSnapshot(v)).toThrow();});
 it('denies duplicate records',()=>{const v=snapshot();v.runPages=[page([run,run],2)];expect(()=>assertProviderSnapshot(v)).toThrow();});
 it('denies prior same identity even on other SHA',()=>{const v=snapshot();v.runPages=[page([run,{...run,id:'11',headSha:'c'.repeat(40)}],2)];expect(()=>assertProviderSnapshot(v)).toThrow();});
 it('denies prior same SHA with other title/tag',()=>{const v=snapshot();v.runPages=[page([run,{...run,id:'11',title:'other',tag:'other'}],2)];expect(()=>assertProviderSnapshot(v)).toThrow();});
 it('denies missing last page',()=>{const v=snapshot();v.runPages[0]!.hasNext=true;expect(()=>assertProviderSnapshot(v)).toThrow();});
 it('denies page/total disagreement',()=>{const v=snapshot();v.runPages[0]!.totalCount=2;expect(()=>assertProviderSnapshot(v)).toThrow();});
 it('denies sparse record/page arrays',()=>{const v=snapshot();v.runPages[0]!.records=new Array<ProviderRun>(1);expect(()=>assertProviderSnapshot(v)).toThrow();});
 it('denies unclosed original body',()=>{const v=snapshot();v.runPages[0]!.bodyComplete=false;expect(()=>assertProviderSnapshot(v)).toThrow();});
 it('denies published release lookup or listed tag',()=>{const v=snapshot();v.releaseLookupStatus=200;expect(()=>assertProviderSnapshot(v)).toThrow();v.releaseLookupStatus=404;v.releasePages=[page([{id:'1',tag:id}],null)];expect(()=>assertProviderSnapshot(v)).toThrow();});
 it('denies unverified list status despite lookup404',()=>{const v=snapshot();v.releasePages[0]!.status=403;expect(()=>assertProviderSnapshot(v)).toThrow();});
});
describe('normalized supplied resource references',()=>{
 const names=['index.html','assets/main.js','assets/chunk.js','styles/a.css'];
 it('resolves relative and root-relative assets',()=>{expect(normalizeReference('assets/main.js','./chunk.js',names).target).toBe('assets/chunk.js');expect(normalizeReference('styles/a.css','/assets/chunk.js',names).target).toBe('assets/chunk.js');});
 it('retains same-document and asset fragments',()=>{expect(normalizeReference('styles/a.css','#filter',names)).toMatchObject({target:'styles/a.css',fragment:'filter',sameDocument:true});expect(normalizeReference('index.html','assets/chunk.js#id',names).fragment).toBe('id');});
 it.each(['https://remote/x','//remote/x','../../escape','./%2fchunk.js','./%2e%2e/x','./%252e/x','./chunk.js?x','\\remote','./%GG.js','missing.js'])('denies unsupported URL %s',url=>expect(()=>normalizeReference('assets/main.js',url,names)).toThrow());
 it('permits one percent-decoded ordinary filename',()=>expect(normalizeReference('assets/main.js','./%63hunk.js',names).target).toBe('assets/chunk.js'));
 it('rejects unknown referring source',()=>expect(()=>normalizeReference('unknown.js','assets/main.js',names)).toThrow());
 it('rejects computed imports but ignores endpoints',()=>{expect(()=>classifyJsReference({kind:'dynamic-import',specifier:null,base:null})).toThrow();expect(classifyJsReference({kind:'endpoint',specifier:'https://api.example',base:null})).toBe(null);});
 it('new URL requires literal import.meta.url base',()=>expect(()=>classifyJsReference({kind:'new-url',specifier:'asset.svg',base:null})).toThrow());
});
describe('exact default embedded SVG and graph limits',()=>{
 const svg="<svg viewBox='0 0 16 16' fill='#fff' xmlns='http://www.w3.org/2000/svg'><path d='M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z'/></svg>";
 const uri='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 it('retains raw hash and exact decoded identity',()=>expect(assertEmbeddedSvg(uri)).toMatchObject({decodedBytes:212,decodedSha256:'5ca272b5c51f5790821b50ebfb5f2868f20230a839431baf92f45bfff38861ea',rawSha256:expect.stringMatching(/^[a-f0-9]{64}$/)}));
 it.each([uri.replace('svg+xml','svg'),uri.replace('%23fff','%23f00'),uri+'x','data:image/svg+xml;base64,abc'])('denies changed embedded data',value=>expect(()=>assertEmbeddedSvg(value)).toThrow());
 it('counts4096 occurrences before dedup and denies4097',()=>{expect(assertReferenceCount([4096])).toBe(4096);expect(()=>assertReferenceCount([4096,1])).toThrow();});
 it('denies sparse counts and seventeenth embedded occurrence',()=>{expect(()=>assertReferenceCount(new Array<number>(1))).toThrow();expect(()=>assertEmbeddedSvg(uri,17)).toThrow();});
});
describe('supplied manifest/module mappings',()=>{
 it('resolves manifest keys to actual files',()=>expect(assertManifest([{key:'entry',file:'index.html',imports:['chunk'],dynamicImports:[],css:[],assets:[]},{key:'chunk',file:'assets/chunk.js',imports:[],dynamicImports:[],css:[],assets:[]}],['index.html','assets/chunk.js']).references).toContainEqual({from:'index.html',target:'assets/chunk.js'}));
 it('denies missing manifest key',()=>expect(()=>assertManifest([{key:'entry',file:'index.html',imports:['missing'],dynamicImports:[],css:[],assets:[]}],['index.html'])).toThrow());
 it('keeps virtual and physical ownership separate',()=>expect(assertMappings([{id:'/owned/source.js',kind:'physical',path:'source.js',sha256:hash,external:false},{id:'\0virtual:owned',kind:'virtual',external:false}])).toMatchObject({physical:1,virtual:1,qualification:false}));
 it('denies external or duplicate module ownership',()=>{expect(()=>assertMappings([{id:'x',kind:'virtual',external:true}])).toThrow();expect(()=>assertMappings([{id:'\0x',kind:'virtual',external:false},{id:'\0x',kind:'virtual',external:false}])).toThrow();});
 it('denies sparse mapping and manifest arrays',()=>{expect(()=>assertMappings(new Array(1))).toThrow();expect(()=>assertManifest(new Array(1),['index.html'])).toThrow();});
});
describe('declared known audit/vendor exceptions preserve original failures',()=>{
 it('keeps original full audit exit1 while high-threshold passes',()=>expect(assertExpectedAudit(original(1),original(0),{info:0,low:9,moderate:0,high:0,critical:0,total:9})).toMatchObject({fullAuditExitCode:1,fullAuditSuccess:false,policyMayContinue:true}));
 it('denies changed audit or truncated original output',()=>{expect(()=>assertExpectedAudit(original(1),original(0),{info:0,low:10,moderate:0,high:0,critical:0,total:10})).toThrow();expect(()=>assertExpectedAudit({...original(1),streamsComplete:false},original(0),{info:0,low:9,moderate:0,high:0,critical:0,total:9})).toThrow();});
 const categories=[['mcpAppsRenderer',1677],['ai',8],['reactCore',6],['runtimeClientGql',3],['shared',3],['channelsCore',1],['runtime',1],['mcpSdk',1],['urql',1],['mermaid',1]].map(([category,count])=>({category:String(category),count:Number(count)}));
 it('preserves vendor exit1 and exact1702 categories',()=>expect(assertExpectedVendor(original(1),0,categories)).toMatchObject({vendorExitCode:1,vendorSuccess:false,policyMayContinue:true,total:1702}));
 it('denies owned/new vendor errors',()=>{expect(()=>assertExpectedVendor(original(1),1,categories)).toThrow();expect(()=>assertExpectedVendor(original(1),0,[...categories,{category:'new',count:1}])).toThrow();});
});

describe('supplied native API pagination link facts',()=>{
 const path='/repos/cacheplane/chat-ui-bench/releases';
 it('recognizes exact next link',()=>expect(assertProviderNextLink(`<https://api.github.com${path}?per_page=100&page=2>; rel="next"`,path,1)).toBe(true));
 it('empty link means no observed next',()=>expect(assertProviderNextLink(null,path,1)).toBe(false));
 it.each(['rel=next','rel="unknown"','rel="next" extra'])('denies unsupported link grammar %s',rel=>expect(()=>assertProviderNextLink(`<https://api.github.com${path}?per_page=100&page=2>; ${rel}`,path,1)).toThrow());
 it('denies wrong host/next/duplicate even though URLs are never followed',()=>{expect(()=>assertProviderNextLink(`<https://evil.example${path}?per_page=100&page=2>; rel="next"`,path,1)).toThrow();expect(()=>assertProviderNextLink(`<https://api.github.com${path}?per_page=100&page=3>; rel="next"`,path,1)).toThrow();const part=`<https://api.github.com${path}?per_page=100&page=2>; rel="next"`;expect(()=>assertProviderNextLink(part+','+part,path,1)).toThrow();});
 it('denies six-page provider chain',()=>expect(()=>assertProviderNextLink(`<https://api.github.com${path}?per_page=100&page=6>; rel="last"`,path,1)).toThrow());
});
describe('manifest named-file input remains bounded/ordinary',()=>{
 const rows=[{key:'entry',file:'index.html',imports:[],dynamicImports:[],css:[],assets:[]}];
 it('denies duplicate admitted names',()=>expect(()=>assertManifest(rows,['index.html','index.html'])).toThrow());
 it('denies malformed additional admitted name',()=>expect(()=>assertManifest(rows,['index.html','../unowned'])).toThrow());
});

describe('module URL grammar and Link-chain completeness',()=>{
 it('denies bare ESM specifiers even if similarly named asset exists',()=>expect(()=>classifyJsReference({kind:'import',specifier:'chunk.js',base:null})).toThrow());
 it('preserves literal relative ESM and newURL file semantics',()=>{expect(classifyJsReference({kind:'import',specifier:'./chunk.js',base:null})).toBe('./chunk.js');expect(classifyJsReference({kind:'new-url',specifier:'asset.svg',base:'import-meta-url'})).toBe('asset.svg');});
 it('denies last-page evidence without the required next link',()=>{const path='/repos/cacheplane/chat-ui-bench/releases';expect(()=>assertProviderNextLink(`<https://api.github.com${path}?per_page=100&page=2>; rel="last"`,path,1)).toThrow();});
 it('denies next link beyond an explicitly current last page',()=>{const path='/repos/cacheplane/chat-ui-bench/releases';expect(()=>assertProviderNextLink(`<https://api.github.com${path}?per_page=100&page=2>; rel="next", <https://api.github.com${path}?per_page=100&page=1>; rel="last"`,path,1)).toThrow();});
});

describe('original compiler diagnostic continuation parsing',()=>{
 it('counts known vendor headers without converting exit1',()=>{const text=Array.from({length:1677},()=> 'node_modules/@copilotkit/mcp-apps-renderer/a.d.ts(1,1): error TS2322: mismatch').concat(Array(8).fill('node_modules/ai/a.d.ts(1,1): error TS2322: mismatch'),Array(6).fill('node_modules/@copilotkit/react-core/a.d.ts(1,1): error TS2322: mismatch'),Array(3).fill('node_modules/@copilotkit/runtime-client-gql/a.d.ts(1,1): error TS2322: mismatch'),Array(3).fill('node_modules/@copilotkit/shared/a.d.ts(1,1): error TS2322: mismatch'),...['@copilotkit/channels-core','@copilotkit/runtime','@modelcontextprotocol/sdk','@urql/core','mermaid'].map(name=>`node_modules/${name}/a.d.ts(1,1): error TS2322: mismatch`)).join('\n');expect(classifyVendorDiagnostics(text)).toMatchObject({owned:0,total:1702});});
 it('retains owned and unknown vendor headers as blockers',()=>expect(classifyVendorDiagnostics('apps/copilotkit/src/main.tsx(1,1): error TS2322: mismatch\nnode_modules/unknown/a.d.ts(1,1): error TS2322: mismatch')).toMatchObject({owned:2,total:2}));
});

describe('original file closure and full audit counts',()=>{
 const stream={readableEOF:true,writerFinish:true,writerClose:true,writerError:false,seen:10,retained:10,retainedBytesKnown:true};
 it('requires original finish plus original file close',()=>{expect(capturedStreamComplete(stream)).toBe(true);expect(capturedStreamComplete({...stream,writerClose:false})).toBe(false);});
 it('denies premature close and errors',()=>{expect(capturedStreamComplete({...stream,writerFinish:false,readableEOF:false})).toBe(false);expect(capturedStreamComplete({...stream,writerError:true})).toBe(false);});
 it('denies unknown retained bytes even for empty streams',()=>expect(capturedStreamComplete({...stream,seen:0,retained:0,retainedBytesKnown:false})).toBe(false));
 it('validates full audit independently before the later audit-high step',()=>{expect(()=>assertFullAudit(original(1),{info:0,low:9,moderate:0,high:0,critical:0,total:9})).not.toThrow();expect(()=>assertFullAudit(original(1),{info:0,low:9,moderate:0,high:0,critical:0,total:10})).toThrow();});
 it.each([{info:1,total:10},{info:0,total:10}])('denies changed original full audit info or total %j',change=>expect(()=>assertExpectedAudit(original(1),original(0),{low:9,moderate:0,high:0,critical:0,...change})).toThrow());
});

describe('production output capacity v3 namespace and manifest',()=>{
 const names=(count:number)=>Array.from({length:count},(_,i)=>`assets/${i}.js`);
 const records=(count:number):policy.ManifestRecord[]=>Array.from({length:count},(_,i)=>({key:`key-${i}`,file:`assets/${i}.js`,imports:[],dynamicImports:[],css:[],assets:[]}));
 const normalize=(from:string,raw:string,files:string[])=>policy.normalizeProductionReference(from,raw,files);
 const manifest=(rows:ReturnType<typeof records>,files:string[])=>policy.assertProductionManifest(rows,files);
 it('resolves target inside129 names while generic namespace remains128',()=>{expect(normalize('assets/0.js','./128.js',names(129)).target).toBe('assets/128.js');expect(()=>normalizeReference('assets/0.js','./128.js',names(129))).toThrow();});
 it('admits129 manifest rows while generic rows remain128',()=>{expect(manifest(records(129),names(129)).referenceCount).toBe(129);expect(()=>assertManifest(records(129),names(129))).toThrow();});
 it('bounds production names1025 and rejects1026 before reading elements',()=>{expect(normalize('assets/0.js','./1024.js',names(1025)).target).toBe('assets/1024.js');const input=names(1026);let reads=0;Object.defineProperty(input,0,{get(){reads++;throw Error('namespace read');}});expect(()=>normalize('assets/0.js','./1.js',input)).toThrow('production-output-files observed=1026 limit=1025');expect(reads).toBe(0);});
 it('bounds manifest rows1024 and rejects1025 before reading elements',()=>{expect(manifest(records(1024),names(1025)).referenceCount).toBe(1024);const rows=records(1025);let reads=0;Object.defineProperty(rows,0,{get(){reads++;throw Error('manifest read');}});expect(()=>manifest(rows,names(1025))).toThrow('production-manifest-records observed=1025 limit=1024');expect(reads).toBe(0);});
 it('refuses sparse production rows and names within expanded bounds',()=>{const rows=records(129);delete rows[64];expect(()=>manifest(rows,names(129))).toThrow('Sparse');const files=names(129);delete files[64];expect(()=>normalize('assets/0.js','./1.js',files)).toThrow('Sparse');});
 it('preserves external query encoded traversal and unresolved denial',()=>{for(const raw of ['https://remote/a.js','./1.js?x','./%2e%2e/a.js','./missing.js'])expect(()=>normalize('assets/0.js',raw,names(129))).toThrow();});
 it('preserves duplicate owners and unresolved manifest imports',()=>{expect(()=>manifest([records(1)[0]!,records(1)[0]!],names(129))).toThrow();expect(()=>manifest([{...records(1)[0]!,imports:['missing']}],names(129))).toThrow();});
 it('preserves4096 occurrence counting including owner rows',()=>{const rows=records(1024).map(value=>({...value,assets:Array(3).fill('assets/0.js')}));expect(policy.assertProductionManifest(rows,names(1025)).referenceCount).toBe(4096);rows[0]!.assets.push('assets/0.js');expect(()=>policy.assertProductionManifest(rows,names(1025))).toThrow('Reference occurrence overflow');});
});
