import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {analyzeChrome156CpuProfileV2, CPU_PROFILE_V2_LIMITS} from './aimock-cpu-profile-v2.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex'),lines=rows=>hash(rows.map(r=>JSON.stringify(r)+'\n').join(''));
const ORIGIN='https://bench.test',ASSET='a'.repeat(64);
function context(){return {schema:'chrome156-cpu-source-context-v2',browserVersion:'156.0.8078.4',chromiumRevision:'f842f52ef39fd97b449eb27cff414bf05a98ddce',origin:ORIGIN,assetHashes:{'assets/main.js':ASSET}};}
function frame(name,url=''){return {functionName:name,scriptId:'1',url,lineNumber:0,columnNumber:0};}
function profile(){return {nodes:[{id:1,callFrame:frame('(root)'),children:[2,3]},{id:2,callFrame:frame('parent',ORIGIN+'/assets/main.js'),children:[4]},{id:3,callFrame:frame('(idle)')},{id:4,callFrame:frame('leaf',ORIGIN+'/assets/main.js')}],startTime:100,endTime:110,samples:[4,2,4],timeDeltas:[4,-2,3]};}
const analyze=(p=profile(),c=context())=>analyzeChrome156CpuProfileV2(JSON.stringify(p),JSON.stringify(c));
const rejectProfile=(change,reason)=>{const p=profile();change(p);assert.throws(()=>analyze(p),reason);};
test('signed adjacent pairs preserve all original records and exact stable permutation',()=>{
 const p=profile(),input=JSON.stringify(p),r=analyze(p);
 assert.equal(r.schema,'chrome156-sampled-stacks-v2');assert.equal(r.status,'validated-data-only');
 assert.equal(r.input.profileSha256,hash(input));assert.equal(JSON.stringify(p),input);
 assert.deepEqual(r.counts,{nodes:4,samples:3});
 assert.equal(r.conservation.originalPairSha256,lines([[0,4,4,104],[1,2,-2,102],[2,4,3,105]]));
 assert.equal(r.conservation.orderedPairSha256,lines([[1,2,-2,102],[0,4,4,104],[2,4,3,105]]));
 assert.equal(r.conservation.permutationSha256,hash('1\n0\n2\n'));
 assert.equal(r.conservation.frequencySha256,lines([[2,1],[4,2]]));
 assert.equal(r.conservation.indexCount,3);assert.equal(r.conservation.indexBijection,true);assert.equal(r.conservation.pairsConserved,true);assert.equal(r.conservation.frequenciesConserved,true);assert.equal(r.conservation.rawInputUnchanged,true);
 assert.deepEqual(r.window,{startUs:100,endUs:110,minSampleUs:102,maxSampleUs:105});
 assert.deepEqual(r.deltas,{negative:1,zero:0,positive:2,minUs:-2,maxUs:4,negativeSumUs:-2});
 const leaf=r.topSelf.find(n=>n.id===4),parent=r.topInclusive.find(n=>n.id===2);assert.equal(leaf.selfSamples,2);assert.equal(leaf.inclusiveSamples,2);assert.equal(parent.selfSamples,1);assert.equal(parent.inclusiveSamples,3);assert.equal(parent.asset.sha256,ASSET);
 assert.equal(r.performance,false);assert.equal(r.scoringEligibility,false);assert.equal(r.FPS,null);assert.equal(r.cpuTime,null);assert(!Object.hasOwn(r,'permutation'));assert(!Object.hasOwn(r,'samples'));
});
test('equal timestamps and repeated sample IDs preserve original-index ties',()=>{const p=profile();p.timeDeltas=[2,0,0];const r=analyze(p);assert.equal(r.conservation.permutationSha256,hash('0\n1\n2\n'));assert.equal(r.conservation.originalPairSha256,r.conservation.orderedPairSha256);assert.equal(r.counts.samples,3);});
test('inclusive counts match an independent ancestor oracle and deterministic top ties',()=>{
 const p=profile(),r=analyze(p),parent=new Map([[2,1],[3,1],[4,2]]),self=new Map(),inclusive=new Map();
 for(const id of p.samples){self.set(id,(self.get(id)??0)+1);for(let at=id;at!==undefined;at=parent.get(at))inclusive.set(at,(inclusive.get(at)??0)+1);}
 for(const row of r.topInclusive){assert.equal(row.selfSamples,self.get(row.id)??0);assert.equal(row.inclusiveSamples,inclusive.get(row.id)??0);}
 assert.deepEqual(r.topInclusive.map(n=>n.id),[2,1,4,3]);assert.deepEqual(r.topSelf.map(n=>n.id),[4,2,1,3]);
 const q=profile();q.samples=[2,3];q.timeDeltas=[0,0];assert.deepEqual(analyze(q).topSelf.slice(0,2).map(n=>n.id),[2,3]);
});
test('changing a single paired value changes conservation digests without dropping records',()=>{const p=profile(),a=analyze(p);p.samples[0]=2;const b=analyze(p);assert.notEqual(a.input.profileSha256,b.input.profileSha256);assert.notEqual(a.conservation.originalPairSha256,b.conservation.originalPairSha256);assert.notEqual(a.conservation.frequencySha256,b.conservation.frequencySha256);assert.equal(b.counts.samples,3);});
test('optional pinned CDP node fields are validated and included in graph identity',()=>{const p=profile(),a=analyze(p);Object.assign(p.nodes[1],{hitCount:2,positionTicks:[{line:1,ticks:2}],deoptReason:'not optimized'});const b=analyze(p);assert.notEqual(a.input.graphSha256,b.input.graphSha256);assert.equal(a.counts.samples,b.counts.samples);});
test('canonical primitive JSON refuses duplicate keys, alternate encodings and coercion hooks',()=>{
 const p=JSON.stringify(profile()),c=JSON.stringify(context());assert.throws(()=>analyzeChrome156CpuProfileV2(' '+p,c),/canonical/);assert.throws(()=>analyzeChrome156CpuProfileV2(p.replace('"startTime":100','"startTime":99,"startTime":100'),c),/canonical/);assert.throws(()=>analyzeChrome156CpuProfileV2(p.replace('100','1e2'),c),/canonical/);
 let effects=0;for(const value of [{get toJSON(){effects++;return ()=>profile();}},new Proxy({},{get(){effects++;throw Error('effect');}}),new String(p),Buffer.from(p)])assert.throws(()=>analyzeChrome156CpuProfileV2(value,c),/input-type/);assert.equal(effects,0);assert.throws(()=>analyzeChrome156CpuProfileV2(p,{}),/input-type/);
});
test('unknown browser/source tuples and unknown binding keys always refuse',()=>{for(const [key,value]of [['browserVersion','156.0.8078.5'],['chromiumRevision','0'.repeat(40)],['schema','v1']]){const c=context();c[key]=value;assert.throws(()=>analyze(profile(),c),/binding/);}const c=context();c.extra=true;assert.throws(()=>analyze(profile(),c),/binding/);});
test('all original prefixes stay inside original endpoints, never repaired',()=>{
 for(const deltas of [[-1,5,1],[4,9,-10],[4,-5,6]])rejectProfile(p=>p.timeDeltas=deltas,/sample-window/);
 const p=profile();p.timeDeltas=[0,10,-10];assert.deepEqual(analyze(p).window,{startUs:100,endUs:110,minSampleUs:100,maxSampleUs:110});
 for(const deltas of [[4,-2147483649,3],[2147483648,-2,3],[4,0.5,3],[4,'-2',3],[4,null,3],[4,true,3]])rejectProfile(p=>p.timeDeltas=deltas,/delta/);
 for(const change of [p=>p.startTime=-1,p=>p.endTime=p.startTime,p=>p.endTime=Number.MAX_SAFE_INTEGER+1,p=>p.endTime=p.startTime+240000001])rejectProfile(change,/profile-time/);
 const near=profile();near.startTime=Number.MAX_SAFE_INTEGER-10;near.endTime=Number.MAX_SAFE_INTEGER;near.timeDeltas=[4,-2,3];assert.equal(analyze(near).window.maxSampleUs,Number.MAX_SAFE_INTEGER-5);
});
test('length/count, unknown samples and unknown node/frame/tick keys refuse',()=>{
 rejectProfile(p=>p.timeDeltas.pop(),/samples/);rejectProfile(p=>p.samples[0]=999,/unknown-sample/);rejectProfile(p=>p.nodes[0].extra=1,/node/);rejectProfile(p=>p.nodes[0].callFrame.extra=1,/frame/);rejectProfile(p=>p.extra=1,/profile-shape/);
 for(const change of [n=>n.hitCount=-1,n=>n.hitCount=1.5,n=>n.positionTicks=[{line:0,ticks:1}],n=>n.positionTicks=[{line:1,ticks:1,extra:0}],n=>n.deoptReason=1])rejectProfile(p=>change(p.nodes[0]),/node/);
 for(const key of ['lineNumber','columnNumber'])rejectProfile(p=>p.nodes[0].callFrame[key]=-2,/frame/);
});
test('original tree must be single-rooted, connected, acyclic and nonduplicate',()=>{
 for(const change of [p=>p.nodes[0].children=[2,2],p=>p.nodes[1].children=[3],p=>p.nodes[0].children=[1,2],p=>p.nodes[0].children=[2,999],p=>p.nodes[3].id=2,p=>{p.nodes[0].children=[3];p.nodes[3].children=[2];},p=>{p.nodes[0].children=[2];p.nodes[1].children=[4];p.nodes[3].children=[1];}])rejectProfile(change,/node-id|tree/);
});
test('strict source identity refuses inherited/map tricks and URL aliases',()=>{
 for(const key of ['__proto__','constructor','toString','assets/../main.js','assets//main.js','assets/%2Fmain.js','assets/%252e.js','assets\\main.js','assets/./main.js']){const c=context();c.assetHashes=JSON.parse('{'+JSON.stringify(key)+':'+JSON.stringify(ASSET)+'}');assert.throws(()=>analyze(profile(),c),/asset/);}
 for(const url of [ORIGIN+'/assets/%6dain.js',ORIGIN+'/assets/%2Fmain.js',ORIGIN+'/assets/%2e%2e/assets/main.js',ORIGIN+'/assets/%252fmain.js',ORIGIN+'/assets/../assets/main.js',ORIGIN+'/assets\\main.js',ORIGIN+'/assets/main.js?x',ORIGIN+'/assets/main.js#x','https://other.test/assets/main.js',ORIGIN+'/missing.js','pptr:evaluate;1'])rejectProfile(p=>p.nodes[1].callFrame.url=url,/source/);
 const c=context();c.assetHashes['assets/%6dain.js']=ASSET;assert.throws(()=>analyze(profile(),c),/asset/);
});
test('unattributed program/idle/root/native-like empty URLs remain separate and counted',()=>{const p=profile();p.nodes[1].callFrame=frame('(program)');p.nodes[3].callFrame=frame('native-looking');const r=analyze(p);assert.equal(r.unattributedSelf.program,1);assert.equal(r.unattributedSelf.other,2);assert.equal(r.topSelf.find(n=>n.id===4).asset,null);});
test('real caps:200000 samples accepted,200001 refused without overrides',()=>{const p=profile();p.samples=Array(200000).fill(4);p.timeDeltas=Array(200000).fill(0);const r=analyze(p);assert.equal(r.counts.samples,200000);assert.equal(r.topSelf[0].selfSamples,200000);p.samples.push(4);p.timeDeltas.push(0);assert.throws(()=>analyze(p),/samples/);assert.equal(CPU_PROFILE_V2_LIMITS.maxSamples,200000);assert(Object.isFrozen(CPU_PROFILE_V2_LIMITS));});
test('real2MiB boundary accepted and +1 byte refused, bounded output does not return huge names',()=>{const p=profile();const initial=JSON.stringify(p);p.nodes[0].callFrame.functionName+='x'.repeat(2097152-Buffer.byteLength(initial));const input=JSON.stringify(p);assert.equal(Buffer.byteLength(input),2097152);const r=analyzeChrome156CpuProfileV2(input,JSON.stringify(context()));assert(Buffer.byteLength(JSON.stringify(r))<=32768);assert(r.topInclusive.find(n=>n.id===1).frame.functionName.truncated);p.nodes[0].callFrame.functionName+='x';assert.throws(()=>analyze(p),/profile-byte-cap/);});
test('independent defensive node count is not claimed jointly admissible with raw cap',()=>{const p=profile();p.nodes=Array(100001).fill(null);assert.throws(()=>analyze(p),/nodes/);p.nodes.pop();assert.throws(()=>analyze(p),/node/);assert.equal(CPU_PROFILE_V2_LIMITS.maxNodes,100000);});
test('deep valid original graph under real cap aggregates iteratively',()=>{const n=10000,p={nodes:Array.from({length:n},(_,i)=>({id:i+1,callFrame:frame('n'),...(i+1<n?{children:[i+2]}:{})})),startTime:100,endTime:110,samples:[n,n],timeDeltas:[2,-1]};assert(Buffer.byteLength(JSON.stringify(p))<2097152);const r=analyze(p);assert.equal(r.counts.nodes,n);assert.equal(r.topInclusive.find(n=>n.id===1).inclusiveSamples,2);assert.equal(r.topSelf[0].id,n);});
test('long Unicode displays and top8 output stay within fixed result cap',()=>{const p=profile();p.nodes=Array.from({length:20},(_,i)=>({id:i+1,callFrame:frame('😀'.repeat(1000)),...(i===0?{children:Array.from({length:19},(_,j)=>j+2)}:{})}));p.samples=Array.from({length:19},(_,i)=>i+2);p.timeDeltas=Array(19).fill(0);const r=analyze(p);assert.equal(r.topSelf.length,8);assert.equal(r.topInclusive.length,8);assert(Buffer.byteLength(JSON.stringify(r))<=32768);for(const n of r.topSelf){assert(Buffer.byteLength(n.frame.functionName.text)<=128);assert.equal(n.frame.functionName.sha256,hash(JSON.stringify('😀'.repeat(1000))));}});
test('empty-source function names never inherit a classifier from object prototypes',()=>{for(const name of ['__proto__','constructor','toString','valueOf']){const p=profile();p.nodes[3].callFrame=frame(name);const r=analyze(p);assert.equal(r.topSelf.find(n=>n.id===4).sourceKind,'unattributed-other');assert.equal(r.unattributedSelf.other,2);}});
test('real64KiB binding boundary accepted and +1 byte refused without policy ports',()=>{const p=profile();for(const n of p.nodes)n.callFrame.url='';const c=context();c.assetHashes={x:ASSET};const old=Buffer.byteLength(JSON.stringify(c)),key='x'.repeat(65536-old+1);c.assetHashes={[key]:ASSET};assert.equal(Buffer.byteLength(JSON.stringify(c)),65536);assert.equal(analyze(p,c).counts.samples,3);c.assetHashes={[key+'x']:ASSET};assert.throws(()=>analyze(p,c),/binding-byte-cap/);});
test('original240s window exact boundary passes and +1 microsecond refuses',()=>{const p=profile();p.endTime=p.startTime+240000000;p.timeDeltas=[0,240000000,-240000000];assert.deepEqual(analyze(p).window,{startUs:100,endUs:240000100,minSampleUs:100,maxSampleUs:240000100});p.endTime++;assert.throws(()=>analyze(p),/profile-time/);});
test('signed-int32 boundaries never waive the narrower original-window check',()=>{for(const delta of [-2147483648,2147483647])rejectProfile(p=>p.timeDeltas=[delta,0,0],/sample-window/);for(const delta of [-2147483649,2147483648])rejectProfile(p=>p.timeDeltas=[delta,0,0],/delta/);});
test('origin, optional fields and array shapes never gain permissive fallbacks',()=>{for(const origin of [ORIGIN+'/',ORIGIN+'/path','https://user@bench.test','file:///tmp',{},null]){const c=context();c.origin=origin;assert.throws(()=>analyze(profile(),c),/binding-origin/);}rejectProfile(p=>p.nodes[0].children={},/node/);rejectProfile(p=>p.nodes[0].positionTicks={},/node/);rejectProfile(p=>p.nodes[0].callFrame=null,/frame/);rejectProfile(p=>p.nodes[0].callFrame.lineNumber=Number.MAX_SAFE_INTEGER+1,/frame/);rejectProfile(p=>p.samples=[],/samples/);});
