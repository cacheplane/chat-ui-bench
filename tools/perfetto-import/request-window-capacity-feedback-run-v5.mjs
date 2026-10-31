import {constants} from 'node:fs';
import {open,lstat,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {isAbsolute,resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as acquisition from '../native-real-chat/request-window-run-v2.mjs';
import {REQUEST_WINDOW_RECIPE,projectRequestWindow} from '../native-real-chat/request-window-core.mjs';
import {runBrowserPresentationFeedbackObservationsCapacityV4,inspectFeedbackCapacityRunV4,verifyFeedbackCapacityRunV4,readFeedbackCapacityEventV4} from './feedback-observations-capacity-run-v4.mjs';
import {meterBrowserFeedbackCapacityCompositionV4,chargeBrowserFeedbackCapacityWorkV4} from './feedback-observations-capacity-core-v4.mjs';
import {createPackedResultAccountV1,chargePackedResultWorkV1,validatePackedResultV1,meterPackedCompositionV1,readPackedFeedbackSummaryV1,readPackedFeedbackEventV1} from './feedback-observations-packed-result-v1.mjs';

const SCHEMA='native-stock033-request-window-capacity-feedback-v5',BASE=dirname(fileURLToPath(import.meta.url));
const FEEDBACK_POLICY='browser-feedback-whole-graph-packed-result-capacity-v4';
const C=Object.freeze({schema:'browser-presentation-feedback-observations-capacity-v4',capacityProfile:'whole-graph-packed-result-capacity-v4',wireFormat:'compact-v2',resultFormat:'browser-feedback-packed-result-v1'});
const PINS=Object.freeze({
 '../native-real-chat/request-window-core.mjs':{bytes:6727,sha256:'2c8f21b18505fca77fe87773a22ed2905993f0797f3078295306a3a8bc0750c8'},
 '../native-real-chat/request-window-run-v2.mjs':{bytes:18089,sha256:'94b0f202f1dc8ef791fba7a8c7cc7d4f2dec4808a153d8be7be1a255ea02fe11'},
 'feedback-observations-capacity-run-v4.mjs':{bytes:27821,sha256:'d2b78c0d5b727f35fba9a23528b18d17240be4e0b1df6d936d7884c31818d1ad'},
 'feedback-observations-capacity-core-v4.mjs':{bytes:54402,sha256:'60c0c879ff77eafb867fc745478ec2bd3ddb8652f42bacd9b2303ec9dd54e669'},
 'feedback-observations-capacity-source-model-v4.json':{bytes:18202,sha256:'f15d05b82985895349b04c046a0f4c585919e7bbd2102f80e2d9cdd26a106d00'},
 'feedback-observations-packed-result-v1.mjs':{bytes:23405,sha256:'04cc81394cd535909ad245425f59eb82e8c1c7a8c2a9cc47e4c6bf5b18eeedbe'},
 'feedback-observations-capacity-export-v3.mjs':{bytes:17275,sha256:'2d202948c18ddcfe5cd24b55802683c8b4f6a2a2814a1c96a331e0be1cbf2fa9'},
 'feedback-observations-capacity-source-model-v3.json':{bytes:15907,sha256:'02807672dea27faa9f09bb1bc820c629d25ff97713b972d8f45b16f919c887ca'},
 'feedback-target-compact-v2.sql':{bytes:9542,sha256:'ddec24b51eca013800a209acaa6f544c9cc4acfc6e9354a7353f246efc11e27a'},
 'feedback-scope-compact-v2.sql':{bytes:10477,sha256:'cdb643939620ed2e8985ee48eb95d1d6397caf349dfb632ae728f1eee992c10d'}
});
const BOUNDARIES=Object.freeze({fps:null,exhaustivePopulation:false,nativeSupported:false,captureQualified:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false});
const ensure=(condition,reason)=>{if(!condition)throw Error(reason);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function own(v,k){ensure(v&&typeof v==='object'&&!types.isProxy(v),'own-data');const d=Object.getOwnPropertyDescriptor(v,k);ensure(d&&Object.hasOwn(d,'value'),'own-data');return d.value;}
function decimal(v,pay){
 ensure(typeof v==='string'&&v.length<=40,'normalized-nanoseconds');
 pay(v.length);ensure(/^(0|[1-9][0-9]*)$/.test(v),'normalized-nanoseconds');
 pay(v.length);return BigInt(v);
}
function boundedData(root){const stack=[root];let nodes=0,width=0,strings=0;while(stack.length){const v=stack.pop();ensure(++nodes<=65536,'result-capacity');if(typeof v==='string'){const bytes=Buffer.byteLength(v);ensure(bytes<=524288&&strings+bytes<=524288,'result-capacity');strings+=bytes;width+=Buffer.byteLength(JSON.stringify(v));}else if(v===null||typeof v==='boolean'){width+=5;}else if(typeof v==='number'){ensure(Number.isFinite(v),'result-data');width+=String(v).length;}else{ensure(v&&typeof v==='object'&&!types.isProxy(v),'result-data');ensure(Array.isArray(v)||[null,Object.prototype].includes(Object.getPrototypeOf(v)),'result-data');const keys=Reflect.ownKeys(v);width+=keys.length*3+2;ensure(keys.length<=65536,'result-capacity');for(const key of keys){if(Array.isArray(v)&&key==='length')continue;ensure(typeof key==='string','result-data');ensure(nodes+stack.length+2<=65536,'result-capacity');stack.push(key,own(v,key));}}ensure(width<=1048576&&strings<=524288,'result-capacity');}return root;}

function closed(value,keys,pay){
 pay(1);ensure(value&&typeof value==='object'&&!types.isProxy(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),'own-data');
 // One raw key-list qualification is permitted before its discovered count is
 // known. Pay that count immediately, then use ONLY bounded expected names.
 const actual=Reflect.ownKeys(value);pay(actual.length);ensure(actual.length===keys.length,'closed-data');
 for(const key of keys){pay(3+key.length);own(value,key);}
}
function paidOwn(value,key,pay){pay(3+key.length);return own(value,key);}
function paidExpected(value,key,expected,pay,reason){
 const actual=paidOwn(value,key,pay);pay(2);
 if(typeof expected==='string'){
  ensure(typeof actual==='string'&&actual.length===expected.length,reason);
  pay(actual.length+expected.length);ensure(actual===expected,reason);
 }else{pay(2);ensure(actual===expected,reason);}
}
function projection(summary,read,facts,pay,official){
 const get=(value,key)=>paidOwn(value,key,pay);
 pay(256);const inputRecipe=get(facts,'inputRecipe'),phaseInspectionPolicy=get(facts,'phaseInspectionPolicy');
 ensure(typeof inputRecipe==='string'&&inputRecipe.length===REQUEST_WINDOW_RECIPE.length,'input-recipe');
 pay(inputRecipe.length);ensure(inputRecipe===REQUEST_WINDOW_RECIPE,'input-recipe');
 ensure(typeof phaseInspectionPolicy==='string'&&phaseInspectionPolicy.length==='request-window-postcapture-owned-v12-v1'.length,'phase-inspection-policy');
 pay(phaseInspectionPolicy.length);ensure(phaseInspectionPolicy==='request-window-postcapture-owned-v12-v1','phase-inspection-policy');
 const binding=get(facts,'binding'),names=get(facts,'phaseNames'),interval=get(summary,'interval');
 closed(binding,['nonce','requestSha256','manifestSha256','sourceRevision'],pay);closed(names,['start','end'],pay);
 const nonce=get(binding,'nonce'),requestSha256=get(binding,'requestSha256'),manifestSha256=get(binding,'manifestSha256'),sourceRevision=get(binding,'sourceRevision'),fixtureProfile=get(facts,'fixtureProfile');
 for(const[value,length]of [[nonce,32],[requestSha256,64],[manifestSha256,64],[sourceRevision,40]]){
  pay(4);ensure(typeof value==='string'&&value.length===length,'acquisition-binding');
  pay(length);ensure(/^[a-f0-9]+$/.test(value),'acquisition-binding');
 }
 // These are the unchanged acquisition recipe's only fixture profiles.
 ensure(typeof fixtureProfile==='string'&&fixtureProfile.length<=32,'fixture-profile');
 pay(128);ensure(fixtureProfile==='native-history100-v1'||fixtureProfile==='native-history1000-v1'||fixtureProfile==='native-history10000-v1','fixture-profile');
 const startName=get(names,'start'),endName=get(names,'end');
 ensure(typeof startName==='string'&&startName.length<=256&&typeof endName==='string'&&endName.length<=256,'capacity-phase-names');
 const startText=get(interval,'startTs'),endText=get(interval,'endTs'),start=decimal(startText,pay),end=decimal(endText,pay);
 const membership=get(interval,'membership');ensure(typeof membership==='string'&&membership.length==='terminal-in-[start,end)'.length,'capacity-interval');
 pay(membership.length);ensure(membership==='terminal-in-[start,end)','capacity-interval');
 pay(128);ensure(decimal(get(interval,'durationNs'),pay)===end-start,'capacity-interval');
 pay(128);const low=start+500000000n,high=start+1500000000n;
 // Canonical source ns is <=40 digits; either addition has at most41 digits.
 pay(41);const lowText=low.toString();pay(41);const highText=high.toString();
 // Independent prepayment for the fixed recipe helper's own-data/closed/freeze
 // passes (<=1024 fixed units), name+nonce regex passes, and its FOUR distinct
 // decimal-regex/BigInt pairs. Earlier parsing payments are never reused.
 pay(1024+nonce.length+startName.length+endName.length+2*(startText.length+endText.length+lowText.length+highText.length));
 const window=projectRequestWindow({schema:1,inputRecipe:REQUEST_WINDOW_RECIPE,nonce,start:{name:startName,tsNs:startText},end:{name:endName,tsNs:endText},window:{startNs:lowText,endNs:highText}});
 const eventCount=get(summary,'eventCount');pay(16);ensure(Number.isSafeInteger(eventCount)&&!Object.is(eventCount,-0)&&eventCount>=0&&eventCount<=8192,'capacity-events');
 const fullCount=decimal(get(summary,'count'),pay);pay(4);ensure(fullCount===BigInt(eventCount),'capacity-events');
 pay(4);const selected=[],seen=new Set();let previous=null;
 for(let i=0;i<eventCount;i++){
  // At most seven40-digit BigInt comparisons plus fixed loop/arithmetic work.
  // Pay this separately from every native string/hash/parse operation below.
  pay(512);const e=read(i),ts=decimal(get(e,'terminalTs'),pay),id=get(e,'displayTraceId');
  ensure(get(e,'index')===i&&typeof id==='string'&&id.length<=40,'capacity-display-identity');
  pay(id.length);ensure(/^(0|-?[1-9][0-9]*)$/.test(id),'capacity-display-identity');
  pay(id.length);const numericID=BigInt(id);
  pay(1+id.length);ensure(!seen.has(id),'capacity-display-identity');
  pay(1+id.length);seen.add(id);
  ensure(ts>=start&&ts<end&&(previous===null||ts>previous.ts||(ts===previous.ts&&numericID>previous.id)),'capacity-event-membership');previous={ts,id:numericID};
  if(ts>=low&&ts<high){pay(2);selected.push(i);}
 }
 pay(5);const count=String(selected.length);
 // Fixed DTO/property construction and the four-known-slot binding copy.
 pay(256);
 return {schema:SCHEMA,capacityProfile:C.capacityProfile,wireFormat:C.wireFormat,resultFormat:C.resultFormat,status:'observed',feedbackPolicy:FEEDBACK_POLICY,phaseInspectionPolicy:get(facts,'phaseInspectionPolicy'),executionEvidence:official?'source-owned-original-capacity-v4-composition':'authored-structural-projection-only',inputRecipe:REQUEST_WINDOW_RECIPE,fixtureProfile,binding:{nonce,requestSha256,manifestSha256,sourceRevision},phaseNames:{start:startName,end:endName},metric:'observed-successful-browser-feedback-hz',intervalMeaning:'request-anchored-includes-startup-and-queue-time',interval:{startTs:window.window.startNs,endTs:window.window.endNs,durationNs:'1000000000',membership:'terminal-in-[start,end)'},count,observedHz:{numerator:count,denominator:'1',unit:'s^-1',exact:true},proofReference:{kind:'owned-capacity-v4-core-proof',path:'originalCapacityV4.observation.core.proof'},selectedEventIndices:selected,coverageReference:{proofPath:'coverage'},diagnosticsReference:{proofPath:'diagnostics'},inputOrigin:official?'verified-generated-official-compact-csv':'caller-supplied-packed-proof',traceOrigin:official?'original-source-owned-request-window-acquisition':'unestablished',clockContract:official?'official-perfetto-normalized-nanoseconds-v1':'supplied-imported-nanoseconds',...BOUNDARIES};
}
// Structural inspection has its own declared account, never official ownership.
// Production below only queries the original branded wrapper and retained core.
export function projectAuthoredRequestWindowCapacityFeedbackV5(packedCoreDTO,facts){
 const account=createPackedResultAccountV1(),pay=n=>chargePackedResultWorkV1(account,n);
 pay(512);
 closed(packedCoreDTO,[...Object.keys(C),'status','stage','reason','proof','diagnosticsProof',...Object.keys(BOUNDARIES)],pay);
 pay(512);
 for(const [k,v]of Object.entries({...C,status:'observed',stage:null,reason:null,diagnosticsProof:null,...BOUNDARIES}))paidExpected(packedCoreDTO,k,v,pay,'whole-capacity-refusal');
 const proof=paidOwn(packedCoreDTO,'proof',pay),view=validatePackedResultV1(proof,account);
 meterPackedCompositionV1(view,packedCoreDTO);meterPackedCompositionV1(view,facts);
 closed(facts,['phaseInspectionPolicy','inputRecipe','fixtureProfile','binding','phaseNames'],pay);
 const summary=readPackedFeedbackSummaryV1(view);paidExpected(summary,'status','observed',pay,'whole-capacity-refusal');
 const result=projection(summary,i=>readPackedFeedbackEventV1(view,i),facts,pay,false);
 const meter=meterPackedCompositionV1(view,result);paidFreezeWith(n=>pay(n),result,meter);pay(1);return result;
}

const identity=s=>Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map(k=>[k,String(s[k])]));
async function checkExpectedIdentity(expected,id,handle){
 ensure(expected&&typeof expected==='object'&&!types.isProxy(expected)&&[Object.prototype,null].includes(Object.getPrototypeOf(expected)),'identity-codec');
 const keys=Reflect.ownKeys(expected),native=['dev','ino','size','mtimeMs','ctimeMs'],privateNs=['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'];
 const hasExact=fields=>keys.length===fields.length&&keys.every(key=>typeof key==='string'&&fields.includes(key));
 if(hasExact(native)){
  // Native preparation owns numeric Stats fields. Compare the same original
  // codec directly, never convert nanoseconds to a floating approximation.
  const numeric=await handle.stat();
  for(const key of native){const value=own(expected,key);ensure(Number.isFinite(value)&&!Object.is(value,-0)&&value===numeric[key]&&(!['dev','ino','size'].includes(key)||Number.isSafeInteger(value)),'file-commitment');}
 }else{
  ensure(hasExact(privateNs),'identity-codec');
  for(const key of privateNs){const value=own(expected,key);ensure(typeof value==='string'&&/^-?(0|[1-9][0-9]*)$/.test(value)&&value!=='-0'&&value===id[key],'file-commitment');}
 }
}
async function snapshot(path,limit,check,expected=null,retain=false){
 check();const ls=await lstat(path,{bigint:true});ensure(ls.isFile()&&ls.nlink===1n&&ls.size<=BigInt(limit),'file-custody');
 const h=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  check();const first=await h.stat({bigint:true}),id=identity(first);
  ensure(first.isFile()&&first.nlink===1n&&first.size<=BigInt(limit)&&equal(id,identity(ls))&&equal(id,identity(await lstat(path,{bigint:true}))),'file-custody');
  if(expected?.identity!==undefined)await checkExpectedIdentity(expected.identity,id,h);
  const digest=createHash('sha256'),parts=[],chunk=Buffer.alloc(65536);let bytes=0;
  for(;;){check();const n=(await h.read(chunk,0,Math.min(chunk.length,limit+1-bytes),bytes)).bytesRead;check();if(!n)break;bytes+=n;ensure(bytes<=limit,'file-capacity');digest.update(chunk.subarray(0,n));if(retain)parts.push(Buffer.from(chunk.subarray(0,n)));}
  ensure(BigInt(bytes)===first.size&&equal(id,identity(await h.stat({bigint:true})))&&equal(id,identity(await lstat(path,{bigint:true}))),'file-custody');
  const fact={path,bytes,sha256:digest.digest('hex'),identity:id};
  if(expected)ensure((expected.path===undefined||expected.path===path)&&(expected.bytes===undefined||expected.bytes===bytes)&&(expected.sha256===undefined||expected.sha256===fact.sha256),'file-commitment');
  return{fact,contents:retain?Buffer.concat(parts):null};
 }finally{await h.close();check();}
}
async function sources(check){const out={};let total=0;for(const [name,pin]of Object.entries(PINS)){out[name]=(await snapshot(join(BASE,name),name.endsWith('.sql')?16384:262144,check,pin)).fact;total+=out[name].bytes;}for(const path of[fileURLToPath(import.meta.url)]){const f=(await snapshot(path,262144,check)).fact;out[path]=f;total+=f.bytes;}ensure(total<=1048576,'source-capacity');return out;}
function configOf(raw){ensure(typeof raw==='string'&&Buffer.byteLength(raw)<=16384,'invalid-config');const c=JSON.parse(raw),expected={schema:c.schema,feedbackPolicy:c.feedbackPolicy,processor:{path:c.processor?.path,sha256:c.processor?.sha256},out:c.out,deadlineMs:c.deadlineMs};ensure(equal(c,expected)&&JSON.stringify(expected)===raw&&c.schema===SCHEMA&&c.feedbackPolicy===FEEDBACK_POLICY,'invalid-config');const pathOK=p=>typeof p==='string'&&p.isWellFormed()&&Buffer.byteLength(p)<=4096&&isAbsolute(p)&&resolve(p)===p&&!/[\x00-\x1f\x7f-\x9f]/.test(p);ensure(pathOK(c.processor.path)&&pathOK(c.out)&&typeof c.processor.sha256==='string'&&/^[a-f0-9]{64}$/.test(c.processor.sha256)&&Number.isSafeInteger(c.deadlineMs)&&c.deadlineMs>=1&&c.deadlineMs<=60000,'invalid-config');return c;}
function refused(stage,reason){return{schema:SCHEMA,status:'unavailable',stage,reason,publication:null,originalCapacityV4:null,projection:null,...BOUNDARIES};}
function classifyCapacityReturn(value){
 const plain=v=>v!==null&&typeof v==='object'&&!types.isProxy(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
 const token=v=>typeof v==='string'&&v.length<=96&&/^[a-z][a-z0-9-]{0,95}$/.test(v);
 try{
  if(!plain(value))return null;
  const status=own(value,'status');
  if(status==='observed')return{status};
  const stage=own(value,'stage'),reason=own(value,'reason'),publication=own(value,'publication'),observation=own(value,'observation');
  if(status!=='unavailable'||publication!==null||!['config','output','source','target','scope','core','custody','publication'].includes(stage)||!token(reason)||!plain(observation))return null;
  for(const [key,expected]of Object.entries({...C,status:'unavailable',executionEvidence:'untrusted-supplied-csv',inputOrigin:'caller-supplied-csv',traceOrigin:'unestablished',clockContract:'supplied-imported-nanoseconds',count:null,interval:null,observedHz:null,...BOUNDARIES}))if(own(observation,key)!==expected)return null;
  const events=own(observation,'events');if(types.isProxy(events)||!Array.isArray(events)||own(events,'length')!==0)return null;
  const core=own(observation,'core');let observationStage=null,observationReason=null;
  if(core!==null){if(!plain(core))return null;for(const[k,v]of Object.entries({...C,status:'unavailable',count:null,interval:null,observedHz:null,...BOUNDARIES}))if(own(core,k)!==v)return null;const e=own(core,'events');if(types.isProxy(e)||!Array.isArray(e)||own(e,'length')!==0)return null;observationStage=own(core,'stage');observationReason=own(core,'reason');if(!token(observationStage)||!token(observationReason))return null;}
  const diagnostic={schema:'capacity-refusal-diagnostic-v2',wrapperStage:stage,wrapperReason:reason,observationStage,observationReason};
  ensure(1+2*Object.keys(diagnostic).length<=16&&Buffer.byteLength(JSON.stringify(diagnostic))<=512,'refusal-capacity');return{status,diagnostic};
 }catch{return null;}
}
export async function runRequestWindowCapacityFeedbackV5(originalAcquisition,configJSON){
 let stage='config';try{
  const config=configOf(configJSON),started=performance.now();const check=()=>ensure(performance.now()-started<240000,'elapsed-budget');
  stage='acquisition';const facts=acquisition.inspectRequestWindowAcquisitionV2(originalAcquisition);ensure(equal(facts,await acquisition.verifyRequestWindowAcquisitionV2(originalAcquisition)),'acquisition-drift');boundedData(facts);
  ensure(facts.inputRecipe===REQUEST_WINDOW_RECIPE&&facts.trace.identity&&facts.publication.identity,'acquisition-origin');
  for(const path of[facts.trace.path,facts.publication.path,config.processor.path])ensure(config.out!==path&&!config.out.startsWith(path+'/')&&!path.startsWith(config.out+'/'),'output-alias');
  stage='phase-inspection';const phaseInspection=await acquisition.inspectRequestWindowPhaseQualificationV2(originalAcquisition);ensure(equal(phaseInspection.facts,facts),'phase-inspection-binding');boundedData(phaseInspection);const phaseIdentity=own(phaseInspection.publication,'identity'),phaseIdentityKeys=['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'];ensure(Array.isArray(phaseIdentity)&&Object.getPrototypeOf(phaseIdentity)===Array.prototype&&phaseIdentity.length===7&&Reflect.ownKeys(phaseIdentity).length===8&&Reflect.ownKeys(phaseIdentity).every(k=>['0','1','2','3','4','5','6','length'].includes(k))&&phaseIdentity.every(v=>typeof v==='string'&&/^-?(0|[1-9][0-9]*)$/.test(v)&&v!=='-0'),'phase-identity-codec');const expectedPhasePublication={...phaseInspection.publication,identity:Object.fromEntries(phaseIdentityKeys.map((k,i)=>[k,phaseIdentity[i]]))};const phasePublication=(await snapshot(phaseInspection.publication.path,65536,check,expectedPhasePublication)).fact;
  stage='source';const before=await sources(check),runtime=(await snapshot(process.execPath,268435456,check)).fact;
  const originalTrace=(await snapshot(facts.trace.path,33554432,check,facts.trace)).fact,originalPublication=(await snapshot(facts.publication.path,1048576,check,facts.publication)).fact;
  async function bookends(wholePublication){check();ensure(equal(facts,await acquisition.verifyRequestWindowAcquisitionV2(originalAcquisition)),'acquisition-drift');await snapshot(originalTrace.path,33554432,check,originalTrace);await snapshot(originalPublication.path,1048576,check,originalPublication);if(wholePublication)await snapshot(wholePublication.path,1048576,check,wholePublication);await snapshot(phasePublication.path,65536,check,phasePublication);ensure(equal(before,await sources(check)),'source-bookend');await snapshot(runtime.path,268435456,check,runtime);check();}
  await mkdir(config.out,{mode:0o700});
  stage='capacity-v4';const originalCapacityV4=await runBrowserPresentationFeedbackObservationsCapacityV4(JSON.stringify({...C,trace:{path:originalTrace.path,bytes:originalTrace.bytes,sha256:originalTrace.sha256},processor:config.processor,target:facts.target,phaseNames:facts.phaseNames,out:join(config.out,'capacity-v4'),deadlineMs:config.deadlineMs}));check();
  const classified=classifyCapacityReturn(originalCapacityV4);
  if(classified?.status==='unavailable'){stage='custody';await bookends(null);check();return{...refused('capacity-v4','whole-capacity-refusal'),underlyingFailure:classified.diagnostic};}
  ensure(classified?.status==='observed','whole-capacity-refusal');
  // WeakMap-first admission precedes any nested return/publication access.
  const summary=inspectFeedbackCapacityRunV4(originalCapacityV4);
  const verifiedSummary=await verifyFeedbackCapacityRunV4(originalCapacityV4);
  const observation=originalCapacityV4.observation,core=observation.core,pay=n=>chargeBrowserFeedbackCapacityWorkV4(core,n);
  pay(2);
  ensure(paidEqual(core,summary,verifiedSummary),'capacity-drift');
  pay(1024);
  for(const[k,v]of Object.entries({...C,status:'observed',executionEvidence:'source-owned-official-run',inputOrigin:'verified-generated-official-compact-csv',traceOrigin:'caller-supplied-persisted-trace',clockContract:'official-perfetto-normalized-nanoseconds-v1',...BOUNDARIES})){paidExpected(observation,k,v,pay,'capacity-origin');paidExpected(summary,k,v,pay,'capacity-origin');}
  paidExpected(originalCapacityV4,'stage',null,pay,'whole-capacity-refusal');paidExpected(originalCapacityV4,'reason',null,pay,'whole-capacity-refusal');
  ensure(paidEqual(core,paidOwn(summary,'publication',pay),paidOwn(originalCapacityV4,'publication',pay)),'whole-capacity-refusal');
  checkSourceJoins(core,paidOwn(observation,'evidence',pay),before);
  stage='capacity-publication';const published=await snapshot(originalCapacityV4.publication.path,1048576,check,originalCapacityV4.publication,true);
  const inner={...C,publicationState:'provisional-snapshot-requires-original-returned-receipt',observation:originalCapacityV4.observation};
  const innerMeter=prepare(core,inner),innerPayload=serialize(core,inner,innerMeter);pay(innerPayload.length+published.contents.length);ensure(innerPayload.equals(published.contents),'capacity-publication-content');
  stage='projection';const projected=projection(summary,i=>readFeedbackCapacityEventV4(originalCapacityV4,i),facts,pay,true);
  stage='custody';await bookends(published.fact);
  const result={schema:SCHEMA,feedbackPolicy:FEEDBACK_POLICY,status:'observed',stage:null,reason:null,publicationState:'provisional-snapshot-requires-original-returned-receipt',originalCapacityV4,projection:projected,evidence:{phaseInspectionPublication:phasePublication,sourcesBefore:before,runtimeBefore:runtime,acquisitionPublication:originalPublication,capacityPublication:published.fact,sourceExecutionAssumption:'fresh-trusted-process-reviewed-modules',localExecutionAssumption:'fresh-trusted-process-no-concurrent-local-mutation'},...BOUNDARIES};
  stage='publication';const meter=prepare(core,result),payload=serialize(core,result,meter);
  const publication=await writePublication(join(config.out,'result.json'),payload,check,core);
  const returned={...result,publication:{path:publication.path,bytes:publication.bytes,sha256:publication.sha256}};
  prepare(core,returned);
  stage='custody';await bookends(published.fact);await snapshot(publication.path,1048576,check,publication);await verifyFeedbackCapacityRunV4(originalCapacityV4);
  check();chargeBrowserFeedbackCapacityWorkV4(core,1);return returned;
 }catch(error){let reason=typeof error?.message==='string'&&/^[a-z][a-z0-9-]{0,95}$/.test(error.message)?error.message:'operation-failed';if(reason==='logical-work-limit')stage='projection';else if(/^packed-wire-(bytes|nodes|strings)$/.test(reason))stage='publication';return refused(stage,reason);}
}

function paidFreeze(core, value, meter) {
  const pay = units => chargeBrowserFeedbackCapacityWorkV4(core, units);
  pay(meter.nodes);
  pay(1); const stack = [value];
  while (stack.length) {
    pay(1); const v = stack.pop(); pay(1);
    if (v === null || typeof v !== 'object') continue;
    const keys = Reflect.ownKeys(v);
    for (let i = 0; i < keys.length; i++) {
      pay(1); const key = keys[i];
      pay(2 + key.length); const descriptor = Object.getOwnPropertyDescriptor(v, key);
      pay(1); const child = descriptor.value;
      pay(1); stack.push(child);
    }
    // Array own keys include builtin length, as does the freeze scan.
    pay(1 + keys.length); Object.freeze(v);
  }
  return value;
}
function prepare(core, value) {
  const meter = meterBrowserFeedbackCapacityCompositionV4(core, value);
  paidFreeze(core, value, meter);
  return meter;
}
function serialize(core, value, meter) {
  chargeBrowserFeedbackCapacityWorkV4(core, meter.bytes);
  const text = JSON.stringify(value);
  chargeBrowserFeedbackCapacityWorkV4(core, text.length);
  const bytes = Buffer.byteLength(text, 'utf8');
  ensure(Number.isSafeInteger(bytes) && bytes <= meter.bytes && bytes <= 1048576, 'packed-wire-bytes');
  chargeBrowserFeedbackCapacityWorkV4(core, bytes);
  return Buffer.from(text, 'utf8');
}

function paidFreezeWith(pay, value, meter) {
  pay(meter.nodes);
  pay(1); const stack = [value];
  while (stack.length) {
    pay(1); const v = stack.pop(); pay(1);
    if (v === null || typeof v !== 'object') continue;
    const keys = Reflect.ownKeys(v);
    for (let i = 0; i < keys.length; i++) {
      pay(1); const key = keys[i];
      pay(2 + key.length); const descriptor = Object.getOwnPropertyDescriptor(v, key);
      pay(1); const child = descriptor.value;
      pay(1); stack.push(child);
    }
    // Array own keys include builtin length, as does the freeze scan.
    pay(1 + keys.length); Object.freeze(v);
  }
  return value;
}

function paidEqual(core,a,b){
 const x=meterBrowserFeedbackCapacityCompositionV4(core,a),y=meterBrowserFeedbackCapacityCompositionV4(core,b);
 chargeBrowserFeedbackCapacityWorkV4(core,2*(x.bytes+y.bytes));return equal(a,b);
}
function checkSourceJoins(core,evidence,before){
 const same=(a,b)=>paidEqual(core,a,b);
 chargeBrowserFeedbackCapacityWorkV4(core,4096);
 const expected=['wrapper','core','model','codec','originalExporter','inputModel','targetSQL','scopeSQL'];
 const roles={wrapper:'feedback-observations-capacity-run-v4.mjs',core:'feedback-observations-capacity-core-v4.mjs',model:'feedback-observations-capacity-source-model-v4.json',codec:'feedback-observations-packed-result-v1.mjs',originalExporter:'feedback-observations-capacity-export-v3.mjs',inputModel:'feedback-observations-capacity-source-model-v3.json',targetSQL:'feedback-target-compact-v2.sql',scopeSQL:'feedback-scope-compact-v2.sql'};
 ensure(same(Object.keys(evidence.sourcesBefore),expected)&&same(Object.keys(evidence.sourcesAfter),expected),'capacity-source-membership');
 for(const role of expected)ensure(same(evidence.sourcesBefore[role],before[roles[role]])&&same(evidence.sourcesAfter[role],before[roles[role]]),'capacity-source-join');
 for(const name of ['target','scope']){
  const e=evidence.executions[name],manifest=e.originalReturnedManifest,sources=manifest.sourceBookends;
  for(const[k,role]of [['exporter','originalExporter'],['modelSource','inputModel'],['sqlSource',name+'SQL']])ensure(same(sources.before[k],evidence.sourcesBefore[role])&&same(sources.after[k],sources.before[k]),'capacity-exporter-source-join');
  ensure(same(sources.before.executedSql,e.files.sql)&&same(sources.after.executedSql,e.files.sql),'capacity-executed-source-join');
 }
}
async function writePublication(path,payload,check,core){
 ensure(payload.length<=1048576,'packed-wire-bytes');check();chargeBrowserFeedbackCapacityWorkV4(core,payload.length);const digest=hash(payload);
 const h=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);let id;
 try{let offset=0;while(offset<payload.length){check();chargeBrowserFeedbackCapacityWorkV4(core,payload.length-offset);const n=(await h.write(payload,offset,payload.length-offset,offset)).bytesWritten;check();ensure(Number.isSafeInteger(n)&&n>0&&n<=payload.length-offset,'publication-write');offset+=n;}await h.sync();id=identity(await h.stat({bigint:true}));check();}finally{await h.close();check();}
 return(await snapshot(path,1048576,check,{bytes:payload.length,sha256:digest,identity:id})).fact;
}
