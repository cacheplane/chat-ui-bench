import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {projectAuthoredRequestWindowWorkerResultV2 as project,projectAuthoredRequestWindowWorkerResultV1 as legacy} from './request-window-result.mjs';
const policy='request-window-trace-preroll-1000-v1';
async function fixture(){
 const core=await import('./request-window-core.mjs'),source=await fs.readFile(new URL('./request-window-acquisition.node.mjs',import.meta.url),'utf8');
 const a=source.indexOf('function authored(){'),b=source.indexOf('\ntest(',a);
 const f=Function('recipe','runId','createRequestWindowInput','createRequestWindowGesture',source.slice(a,b)+';return authored();')(core.REQUEST_WINDOW_RECIPE,core.REQUEST_WINDOW_RUN_ID,core.createRequestWindowInput,core.createRequestWindowGesture);
 f.request.mode='real-chat-stock033-request-window-scroll-v2';f.request.phaseInspectionPolicy=f.custody.phaseInspectionPolicy='request-window-postcapture-owned-v12-v1';
 f.value.phase={policy:'source-owned-request-window-deferred-phase-v2',phaseInspectionPolicy:f.request.phaseInspectionPolicy,status:'deferred',originalTraceIdentity:{dev:1,ino:2},target:{frameId:'frame',loaderId:'loader',targetId:'cdp-target'},marks:{...f.value.input.marks},trace:{bytes:f.value.collection.trace.bytes,sha256:f.value.collection.trace.sha256},analysisEligible:false,FPS:null};
 f.request.captureProtocol=f.custody.captureProtocol=f.value.captureProtocol=policy;
 f.value.input.preRoll={policy,requestedMs:1000,elapsedNs:'1000000000',state:'fulfilled'};
 return f;
}
test('selected pre-roll result binds protocol and bounded elapsed receipt without granting analysis',async()=>{
 const f=await fixture(),r=project(f.raw(),f.request,f.requestFact,f.custody);
 assert.equal(r.analysisEligible,false);assert.equal(r.value.captureProtocol,policy);assert.deepEqual(r.value.input.preRoll,f.value.input.preRoll);
 assert.throws(()=>legacy(f.raw(),f.request,f.requestFact,f.custody));
});
for(const elapsedNs of ['1000000000','2000000000'])test('pre-roll elapsed inclusive boundary '+elapsedNs,async()=>{const f=await fixture();f.value.input.preRoll.elapsedNs=elapsedNs;assert.equal(project(f.raw(),f.request,f.requestFact,f.custody).analysisEligible,false);});
const mutations=[
 f=>delete f.request.captureProtocol,f=>delete f.custody.captureProtocol,f=>delete f.value.captureProtocol,f=>delete f.value.input.preRoll,
 f=>f.request.captureProtocol='wrong',f=>f.custody.captureProtocol='wrong',f=>f.value.captureProtocol='wrong',f=>f.value.input.preRoll.policy='wrong',
 f=>f.value.input.preRoll.requestedMs=999,f=>f.value.input.preRoll.state='pending',f=>f.value.input.preRoll.extra=true,
 ...['999999999','2000000001','01000000000','1e9','1000000000.0','-1','',1000000000,null].map(v=>f=>f.value.input.preRoll.elapsedNs=v),
 f=>f.value.FPS=60,f=>f.value.phase.analysisEligible=true,f=>f.value.input.request.requestSha256='0'.repeat(64),
];
for(const [i,mutate]of mutations.entries())test('pre-roll result rejects crossed policy, receipt or authority '+i,async()=>{const f=await fixture();mutate(f);assert.throws(()=>project(f.raw(),f.request,f.requestFact,f.custody));});
for(const where of ['request','custody'])test('pre-roll policy accessor refuses without invocation on '+where,async()=>{const f=await fixture();let calls=0;Object.defineProperty(f[where],'captureProtocol',{get(){calls++;throw Error('getter');},enumerable:true});assert.throws(()=>project(f.raw(),f.request,f.requestFact,f.custody));assert.equal(calls,0);});

async function closedHarness(mutate=()=>{}){
 const source=await fs.readFile(new URL('./request-window-run-v2.mjs',import.meta.url),'utf8'),a=source.indexOf('async function verifyClosed('),b=source.indexOf('\n\n\nfunction processIdentity(',a),c=source.indexOf('function captureProtocolFields('),d=source.indexOf('\nfunction absent(',c);
 const preRoll={policy,requestedMs:1000,elapsedNs:'1000000000',state:'fulfilled'},root='/authored',template={captureProtocol:policy},reference={captureProtocol:policy,manifest:{},template:{}},request={captureProtocol:policy},publication={captureProtocol:policy,preRoll:{...preRoll},observedCollection:{input:{preRoll:{...preRoll}}}};
 const facts={trace:{path:root+'/trace'},publication:{path:root+'/outer.json'}},owned={root,template,reference,requestFact:{},before:{stable:true},facts,captureProtocol:policy,preRoll};
 mutate({owned,template,reference,request,publication});const seen=[];
 const verify=Function('preparation','verifyOwnedFile','unavailable',source.slice(c,d)+'\n'+source.slice(a,b)+';return verifyClosed;')({verifyRequestWindowOriginalsV2:async()=>({stable:true})},async(path,_fact,cap)=>{seen.push([path,cap]);if(path.endsWith('/template.json'))return Buffer.from(JSON.stringify(template));if(path.endsWith('/request.json'))return Buffer.from(JSON.stringify(request));if(path.endsWith('/outer.json'))return Buffer.from(JSON.stringify(publication));return Buffer.from('authored');},()=>Error('closed-refused'));
 return{verify,owned,facts,seen};
}
test('selected acquisition rechecks policy and receipt through original verified file bytes',async()=>{const h=await closedHarness();assert.equal(await h.verify(h.owned),h.facts);assert.deepEqual(h.seen.map(x=>x[1]),[4096,4096,33554432,65536]);assert.equal(Object.hasOwn(h.facts,'captureProtocol'),false);});
for(const [i,mutate]of [
 h=>delete h.owned.captureProtocol,h=>delete h.reference.captureProtocol,h=>delete h.request.captureProtocol,h=>delete h.publication.captureProtocol,
 h=>h.publication.preRoll.elapsedNs='1500000000',h=>h.publication.observedCollection.input.preRoll.elapsedNs='1500000000',h=>h.owned.preRoll.elapsedNs='999999999',
].entries())test('closed acquisition rejects protocol sidecar/readback drift '+i,async()=>{const h=await closedHarness(mutate);await assert.rejects(h.verify(h.owned));});
