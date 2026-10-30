import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authoredGraph,argument,selector,csv} from './feedback-observations-fixtures.mjs';
import {exportCompactGraphV2} from './feedback-observations-compact-fixtures-v2.mjs';
import {authoredCapacityArguments,authoredLogicalTextBytes,authoredExactLogicalTextGraph} from './feedback-observations-capacity-fixtures-v3.mjs';
import {evaluateBrowserFeedbackObservationsCompactV2 as oldEvaluate} from './feedback-observations-compact-core-v2.mjs';
const load=()=>import('./feedback-observations-capacity-core-v3.mjs');
const base=new URL('./',import.meta.url);
const oldModel=JSON.parse(readFileSync(new URL('feedback-observations-compact-source-model-v2.json',base)));
const newModel=()=>JSON.parse(readFileSync(new URL('feedback-observations-capacity-source-model-v3.json',base)));
const expectedLimits={csvBytes:2097152,totalCSVBytes:4194304,decodedCSVBytes:2097152,rowsPerCSV:98304,totalRows:196608,targetTableRows:[4096,8192,32768,4096,1024,1,4096],scopeTableRows:[4096,8192,32768,4096,1024,1],compactTableRows:[16384,4096,8192,8192,32768,4096,1024,1,4096],registrySets:8192,logicalArguments:32768,logicalTextBytes:16777216,maxRegistrySliceRefs:8192};
test('fixed V3 model changes only enumerated identities and resource limits',()=>{
 const m=newModel();assert.equal(m.schema,'browser-presentation-feedback-observations-capacity-v3');assert.equal(m.capacityProfile,'whole-graph-capacity-v3');assert.equal(m.wireFormat,'compact-v2');
 const {schema,capacityProfile,wireFormat,limits,...rest}=m;const {schema:oldSchema,limits:oldLimits,...oldRest}=oldModel;
 assert.deepEqual(rest,oldRest);assert.deepEqual(limits,{...oldLimits,...expectedLimits});
});
test('source normalization proves all semantic routines and work meters unchanged',()=>{
 const previous=readFileSync(new URL('feedback-observations-compact-core-v2.mjs',base),'utf8');
 const actual=readFileSync(new URL('feedback-observations-capacity-core-v3.mjs',base),'utf8');
 const expected=previous.replace('feedback-observations-compact-source-model-v2.json','feedback-observations-capacity-source-model-v3.json').replace('refs<=4096n','refs<=BigInt(L.maxRegistrySliceRefs)').replace('evaluateBrowserFeedbackObservationsCompactV2','evaluateBrowserFeedbackObservationsCapacityV3').replace('schema: policy.schema,','schema: policy.schema,\n    capacityProfile: policy.capacityProfile,\n    wireFormat: policy.wireFormat,');
 assert.equal(actual,expected);
});
test('all result paths carry explicit new profile and unestablished origin',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),f=exportCompactGraphV2(authoredGraph());
 for(const r of [e(f.target.bytes,f.scope.bytes,selector),e(Buffer.from('bad'),f.scope.bytes,selector)]){assert.equal(r.schema,'browser-presentation-feedback-observations-capacity-v3');assert.equal(r.capacityProfile,'whole-graph-capacity-v3');assert.equal(r.wireFormat,'compact-v2');assert.equal(r.fps,null);assert.equal(r.nativeSupported,false);assert.equal(r.captureQualified,false);assert.equal(r.traceOrigin,'unestablished');assert.ok(Object.isFrozen(r));}
});
test('complete authored graph exceeds old physical and logical argument bounds and is observed',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),g=authoredGraph();
 for(let i=0;i<9000;i++)g.nodes.find(n=>n.name==='SetLayerTreeId').args.push(argument('authored_unknown_primitive','int','0'));
 const f=exportCompactGraphV2(g);assert.ok(f.target.tables[4].length>8192);assert.ok(f.target.bytes.length>262144);assert.ok(f.target.bytes.length<2097152);
 assert.equal(oldEvaluate(f.target.bytes,f.scope.bytes,selector).status,'unavailable');const r=e(f.target.bytes,f.scope.bytes,selector);assert.equal(r.status,'observed',JSON.stringify(r));assert.equal(r.count,'1');
});
test('complete authored dictionary reuse exceeds old text cap without expanded CSV',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),g=authoredGraph(),template=g.nodes.at(-1);
 for(let i=0;i<1000;i++)g.nodes.push({...structuredClone(template),id:String(100+i),ts:'500',argSet:'100',args:[],trackName:'x'.repeat(400)});
 const f=exportCompactGraphV2(g);assert.ok(f.target.bytes.length<262144);assert.equal(oldEvaluate(f.target.bytes,f.scope.bytes,selector).reason,'logical-text-bytes');assert.equal(e(f.target.bytes,f.scope.bytes,selector).status,'observed');
});
test('new raw per-export and pair limits refuse before malformed CSV or graph traversal',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),f=exportCompactGraphV2(authoredGraph());
 assert.equal(e(Buffer.alloc(2097153,10),f.scope.bytes,selector).reason,'csv-bytes');
 // A pair over4MiB necessarily exceeds an individual2MiB bound first.
 assert.equal(e(Buffer.alloc(2097153,10),Buffer.alloc(2097152,10),selector).reason,'csv-bytes');
 assert.notEqual(e(Buffer.alloc(2097152,10),Buffer.alloc(2097152,10),selector).reason,'total-csv-bytes');
 assert.notEqual(e(Buffer.alloc(2097152,10),f.scope.bytes,selector).reason,'csv-bytes');
});
for(const [refs,expected] of [['8192','registry-reference-count'],['8193','registry-count']])test('registry slice references boundary '+refs,async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),f=exportCompactGraphV2(authoredGraph());f.target.tables[3][0][2]=refs;
 assert.equal(e(csv(f.target.tables,f.target.headers),f.scope.bytes,selector).reason,expected);
});
test('fanout count is precharged against fixed logical 32768 bound',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),f=exportCompactGraphV2(authoredGraph());f.target.tables[3][0][1]='32769';
 assert.equal(e(csv(f.target.tables,f.target.headers),f.scope.bytes,selector).reason,'registry-count');
});
test('exact logical argument admission32768 and plus1 refusal preserve the whole graph',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),baseline=exportCompactGraphV2(authoredGraph()).legacy.targetTables[2].length;
 for(const n of [32768,32769]){const f=exportCompactGraphV2(authoredCapacityArguments(n-baseline)),r=e(f.target.bytes,f.scope.bytes,selector);assert.equal(f.legacy.targetTables[2].length,n);if(n===32768)assert.equal(r.status,'observed',JSON.stringify(r));else assert.equal(r.reason,'table-rows');}
});
test('logical fanout32769 refuses even when all physical argument rows fit',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),baseline=exportCompactGraphV2(authoredGraph()).legacy.targetTables[2].length,g=authoredCapacityArguments(32768-baseline),n=structuredClone(g.nodes.find(n=>n.name==='SetLayerTreeId'));
 n.id='99999';n.argSet='99999';n.args=[];g.nodes.push(n);const f=exportCompactGraphV2(g);assert.equal(f.target.tables[4].length,32768);assert.equal(f.legacy.targetTables[2].length,32769);assert.equal(e(f.target.bytes,f.scope.bytes,selector).reason,'logical-arguments');
});
test('exact16MiB logical text is observed and one extra reference byte refuses',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load();
 for(const n of [16777216,16777217]){const f=exportCompactGraphV2(authoredExactLogicalTextGraph(n));assert.equal(authoredLogicalTextBytes(f.target),n);assert.ok(f.target.bytes.length<2097152);const r=e(f.target.bytes,f.scope.bytes,selector);if(n===16777216)assert.equal(r.status,'observed',JSON.stringify(r));else assert.equal(r.reason,'logical-text-bytes');}
});
for(const [table,cap] of [[0,16384],[1,4096],[2,8192],[3,8192],[4,32768],[5,4096],[6,1024],[7,1],[8,4096]])test('physical table'+table+' fixed cap'+cap+' plus1 refuses before decoding',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),f=exportCompactGraphV2(authoredGraph()),row=f.target.tables[table][0];
 f.target.tables[table]=Array.from({length:cap+1},()=>[...row]);const r=e(csv(f.target.tables,f.target.headers),f.scope.bytes,selector);assert.equal(r.reason,'table-rows');
});
test('fixed raw row98304 bound refuses at98305 before table dispatch',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),f=exportCompactGraphV2(authoredGraph());
 assert.equal(e(Buffer.from('\n'.repeat(98305)),f.scope.bytes,selector).reason,'csv-rows');
 assert.notEqual(e(Buffer.from('\n'.repeat(98304)),f.scope.bytes,selector).reason,'csv-rows');
});
test('deterministic work exhaustion is retained with a fixed unavailable closure',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),f=exportCompactGraphV2(authoredGraph()),r=e(f.target.bytes,f.scope.bytes,selector+' '.repeat(16777216));
 assert.equal(r.reason,'logical-work-limit');assert.equal(r.count,null);assert.deepEqual(r.events,[]);assert.equal(r.fps,null);
});
test('complete authored8192 slices are observed and8193 refuses without shrinking population',async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load();
 for(const count of [8192,8193]){const g=authoredGraph(),initial=exportCompactGraphV2(g).target.tables[2].length,template=g.nodes.at(-1);for(let i=initial;i<count;i++)g.nodes.push({...structuredClone(template),id:String(100+i),name:'BeginFrame',ts:'500',dur:'0',argSet:'100',args:[]});const f=exportCompactGraphV2(g);assert.equal(f.target.tables[2].length,count);const r=e(f.target.bytes,f.scope.bytes,selector);if(count===8192)assert.equal(r.status,'observed',JSON.stringify(r));else assert.equal(r.reason,'table-rows');}
});
for(const [field,index]of [['name',0],['severity',2],['source',3]])for(const value of ['[NULL]',null])test('V3 stats '+field+' preserves '+JSON.stringify(value),async()=>{
 const {evaluateBrowserFeedbackObservationsCapacityV3:e}=await load(),g=authoredGraph(),stat=['authored_warning',null,'info','trace','1'];stat[index]=value;g.stats=[stat];g.scopeStats=[structuredClone(stat)];const f=exportCompactGraphV2(g),r=e(f.target.bytes,f.scope.bytes,selector);assert.equal(r.status,'observed',JSON.stringify(r));for(const kind of ['target','scope'])assert.equal(r.diagnostics.stats[kind][0][field],value);
});
