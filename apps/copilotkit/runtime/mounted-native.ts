/** Hosted SOURCE adapter, never invoked by local tests or STATIC inspection. */
import {runMountedConformance,mountedPrerequisitesAccepted,createMountedSnapshotReader,awaitRestoredHistorySnapshot,closeAfterHistoryReadinessPublication,type MountedPrerequisites,type MountedConformanceResult,type MountedCaseOwner,type JourneyObservations} from './mounted-conformance.ts';
import {evaluateMountedOriginPolicy,MOUNTED_CASE_WITNESS_LABELS,type CaseRecord,type Witness,type OriginLease,type OriginalStatus} from '../../../tests/support/hosted-copilot-mounted-policy.ts';
import {assertProductionOutputInventory,ordinaryPath,type FileFact} from '../../../tests/support/hosted-copilot-contract.ts';
import type {NativeCaseObservation,NativeCaseWitness} from './ownership.ts';
import {boundedWait} from './ownership.ts';
import type {GeometrySnapshot,RestoredHistoryDiagnosticPort,AnchorPurpose} from '../src/geometry.ts';
import type {OwnedFrontendHost} from '../src/host.ts';
import type {CDPSession,Page,BrowserContext,Frame} from 'playwright';
import {evaluateMountedTrackerAPilotPrerequisites,type MountedTrackerAPilotPrerequisites} from '../../../tests/support/hosted-copilot-mounted-policy.ts';
import {runMountedTrackerA,initializeTrackerAPage,readTrackerAAnchorScalarEnvelope,readTrackerAGeometrySnapshot,exportTrackerAScrollCauseDiagnostic,type ScrollCausePageExport,type TrackerAHistoryOwner,type TrackerASequencerResult} from './mounted-tracker-a.ts';
import {createMountedTrackerATrace,TRACKER_A_TRACE_CONFIG,type TrackerATracePorts,type TrackerAProfileRef} from './mounted-tracker-a-trace.ts';

export interface NativeMountedOptions {prerequisites:MountedPrerequisites;browserEndpoint:string;assets:Readonly<{root:string;files:readonly FileFact[]}>}
export interface NativeMountedResult extends MountedConformanceResult {originals:readonly Witness[];browserVersion:string|null;caseEvidence:readonly CaseRecord[]}
export interface NativeMountedTrackerAPilotOptions extends Omit<NativeMountedOptions,'prerequisites'> {prerequisites:MountedTrackerAPilotPrerequisites}
/** Owned closures are passed directly by the application bootstrap, never serialized. */
export interface NativeMountedTrackerAPublication {wheelHandlerAfterGate:Readonly<{protocol:'tracker-a-wheel-handler-after-gate-v1';maxGates:40;entry:'unchanged';arm:'measured-before-existing-evaluate';wait:'measured-after-existing-evaluate';event:'same-original-wheel-listener'}>;profileRef:TrackerAProfileRef;anchorDiagnostic:Readonly<{protocol:'tracker-a-anchor-scalars-v1';role:'tracker-a-anchor-scalars-v1.json';cap:65536;maxObservations:82;g1Purpose:'tracker-a-G1-anchor-diagnostic-v1';metric:'min-positive-text-rect-viewport-y'}>;reserveTraceSink():Promise<TrackerATracePorts['sink']>}
export interface NativeMountedTrackerAPilotResult {pilot:TrackerASequencerResult;originals:readonly Witness[];browserVersion:string|null;caseEvidence:readonly CaseRecord[]}

/** Supplied original export and bounded waiter have independent live outcomes. */
export function createScrollCauseExportOwner(call:()=>Promise<unknown>,deadline:number,now:()=>number=()=>performance.now(),wait:(work:Promise<unknown>,milliseconds:number)=>Promise<unknown>=(work,ms)=>boundedWait(work,ms,'Scroll-cause export deadline')){
 const receipt:ScrollCauseExportReceipt={status:'not-started',requestedHostMs:null,targetHostMs:null,settledHostMs:null,waiter:'not-started',failure:null};let started=false,value:unknown;
 return {receipt,value:()=>value,async attempt(){
  if(started)return;started=true;const at=now();receipt.requestedHostMs=at;receipt.targetHostMs=Math.min(deadline,at+2000);
  if(!Number.isFinite(at)||!Number.isFinite(deadline)||at>=receipt.targetHostMs){receipt.failure='deadline';return;}
  receipt.status='pending';let original:Promise<unknown>;try{original=call();}catch{original=Promise.reject(null);}
  const observed=original.then(result=>{value=result;receipt.status='fulfilled';receipt.settledHostMs=now();return result;},()=>{receipt.status='rejected';receipt.settledHostMs=now();receipt.failure='export-refused';throw null;});void observed.catch(()=>{});
  try{await wait(observed,Math.max(0,receipt.targetHostMs-now()));receipt.waiter='fulfilled';}catch{if(receipt.status==='pending'){receipt.waiter='timed-out';receipt.failure='export-timeout';}else{receipt.waiter='rejected';receipt.failure='export-refused';}}
 }};
}
function scrollCauseOwn(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(typeof value!=='object'||value===null||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Diagnostic own-data object required');
 const d=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(d).length!==keys.length||Reflect.ownKeys(d).some(key=>typeof key!=='string'||!keys.includes(key)))throw Error('Diagnostic closed keys');
 const out:Record<string,unknown>={};for(const key of keys){const field=d[key];if(!field||!('value'in field)||!field.enumerable)throw Error('Diagnostic accessor denied');Object.defineProperty(out,key,{value:field.value,enumerable:true,writable:true,configurable:true});}return out;
}
function scrollCauseRef(value:unknown,path:string,cap:number){const r=scrollCauseOwn(value,['path','bytes','sha256']);if(r.path!==path||typeof r.bytes!=='number'||!Number.isSafeInteger(r.bytes)||r.bytes<0||r.bytes>cap||typeof r.sha256!=='string'||!/^[0-9a-f]{64}$/.test(r.sha256))throw Error('Diagnostic literal reference');return {path,bytes:r.bytes,sha256:r.sha256};}
/** Known source fields only; no Error prototypes, getters, cycles or truncation. */
export function copyScrollCauseData(value:unknown,cap:number):unknown{
 if(!Number.isSafeInteger(cap)||cap<1||cap>4194304)throw Error('Diagnostic byte budget');
 let nodes=0,bytes=0;const ancestors=new Set<object>();
 const charge=(n:number)=>{bytes+=n;if(bytes>cap)throw Error('Diagnostic encoded capacity');};
 const string=(v:string)=>{if(v.length>65536)throw Error('Diagnostic string capacity');charge(2);for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c===34||c===92)charge(2);else if(c<32)charge(c===8||c===9||c===10||c===12||c===13?2:6);else if(c<128)charge(1);else if(c<2048)charge(2);else if(c>=0xd800&&c<=0xdbff){const next=v.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('Diagnostic Unicode');charge(4);}else if(c>=0xdc00&&c<=0xdfff)throw Error('Diagnostic Unicode');else charge(3);}return v;};
 const walk=(v:unknown,depth:number):unknown=>{
  if(depth>32||++nodes>262144)throw Error('Diagnostic copy capacity');
  if(v===null||typeof v==='boolean'){charge(v===null||v===true?4:5);return v;}
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Diagnostic finite number');charge(JSON.stringify(v).length);return v;}
  if(typeof v==='string')return string(v);
  if(typeof v!=='object'||ancestors.has(v))throw Error('Diagnostic data required');ancestors.add(v);
  try{
   const array=Array.isArray(v);if(![Object.prototype,null,...(array?[Array.prototype]:[])].includes(Object.getPrototypeOf(v)))throw Error('Diagnostic prototype');
   const keys=Reflect.ownKeys(v);if(keys.length>262144)throw Error('Diagnostic member capacity');
   if(array){const length=Object.getOwnPropertyDescriptor(v,'length');if(!length||!('value'in length)||!Number.isSafeInteger(length.value)||length.value<0||length.value>8192||keys.length!==length.value+1)throw Error('Diagnostic dense array');charge(2+Math.max(0,length.value-1));const out:unknown[]=[];for(let i=0;i<length.value;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!('value'in d)||!d.enumerable)throw Error('Diagnostic array accessor');out.push(walk(d.value,depth+1));}return out;}
   charge(2+Math.max(0,keys.length-1));const out:Record<string,unknown>={};for(const key of keys){if(typeof key!=='string')throw Error('Diagnostic key');string(key);charge(1);const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!('value'in d)||!d.enumerable)throw Error('Diagnostic accessor');Object.defineProperty(out,key,{value:walk(d.value,depth+1),enumerable:true,writable:true,configurable:true});}return out;
  }finally{ancestors.delete(v);}
 };
 const out=walk(value,0);if(new TextEncoder().encode(JSON.stringify(out)).length>cap)throw Error('Diagnostic encoded capacity');return out;
}

function scrollCauseSnapshot(value:unknown):Record<string,unknown>{
 const r=scrollCauseOwn(copyScrollCauseData(value,1048576),['version','status','qualification','nativeGO','performance','FPS','complete','fault','exceptionalPaths','activeResizes','activeCauses','faultOccurrences','omittedRecords','instances','states','scrollers','keys','rows','collectionState','ownerId','startSequence','endSequence','diagnosticFault','markers']);
 const integer=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
 if(r.version!==2||r.status!=='unqualified'||r.qualification!==false||r.nativeGO!==false||r.performance!==false||r.FPS!=='unavailable'||r.omittedRecords!=='unavailable'||typeof r.complete!=='boolean'||!integer(r.fault,0,6)||!integer(r.diagnosticFault,0,5)||!['inactive','collecting','sealed'].includes(r.collectionState as string)||![r.exceptionalPaths,r.faultOccurrences].every(v=>integer(v,0,2147483647))||![r.activeResizes,r.activeCauses].every(v=>integer(v,0,32))||![r.instances,r.states,r.scrollers].every(v=>integer(v,0,4))||!integer(r.keys,0,1024)||!Array.isArray(r.rows)||r.rows.length>1024)throw Error('Diagnostic ledger schema');
 if(r.ownerId!==null&&!integer(r.ownerId,1,4)||r.startSequence!==null&&r.startSequence!==0||r.endSequence!==null&&!integer(r.endSequence,0,1024))throw Error('Diagnostic ledger boundary');
 const markers=scrollCauseOwn(r.markers,['count','firstOrdinal','lastOrdinal','pre','post','contiguous']);
 if(!integer(markers.count,0,82)||typeof markers.pre!=='boolean'||typeof markers.post!=='boolean'||typeof markers.contiguous!=='boolean'||[markers.firstOrdinal,markers.lastOrdinal].some(v=>v!==null&&!integer(v,1,82)))throw Error('Diagnostic marker summary');
 let firstOrdinal:number|null=null,lastOrdinal=0,markerCount=0,pre=false,post=false,contiguous=true;for(let i=0;i<r.rows.length;i++){
  const row:unknown=r.rows[i];if(!Array.isArray(row)||row.length!==32||row.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)||JSON.stringify(v).length>26))||new TextEncoder().encode(JSON.stringify(row)).length>896||row[1]!==i+1||!integer(row[0],1,8))throw Error('Diagnostic tuple');
  const event=row[0] as number,extent=event===1?8:event===2?20:event===3?7:event===4?8:event===5||event===6?10:event===7?7:9;
  if(row.slice(extent).some(v=>v!==null))throw Error('Diagnostic tuple padding');
  if(event===8){if(row[2]!==null||row[3]!==null||row[4]!==null||row[5]!==r.ownerId||!integer(row[6],1,4)||!integer(row[7],1,82)||row[7]<=lastOrdinal||!((row[6]===1&&row[7]===1&&row[8]===null)||(row[6]===4&&row[7]>=2&&row[8]===null)||((row[6]===2||row[6]===3)&&integer(row[8],0,39)&&row[7]===(row[6]===2?2:3)+2*row[8])))throw Error('Diagnostic marker tuple');contiguous&&=row[7]===lastOrdinal+1;firstOrdinal??=row[7];lastOrdinal=row[7];pre||=row[6]===1;post||=row[6]===4;markerCount++;}
  else if(!integer(row[2],1,4)||row[3]!==null&&!integer(row[3],1,1024)||row[4]!==null&&!integer(row[4],1,1024)||row[5]!==null&&!integer(row[5],1,4))throw Error('Diagnostic tuple identity');
  if(event===2&&(!row.slice(14,19).every(v=>v===0||v===1)||!integer(row[19],0,2)))throw Error('Diagnostic decision tuple');
  if(event===3&&!integer(row[6],1,2)||event===4&&![row[6],row[7]].every(v=>v===0||v===1)||event===7&&row[6]!==0&&row[6]!==1||(event===5||event===6)&&!integer(row[8],0,2)||event===6&&row[9]!==0&&row[9]!==1)throw Error('Diagnostic closed tuple');
 }
 if(markers.count!==markerCount||markers.firstOrdinal!==firstOrdinal||markers.lastOrdinal!==(markerCount?lastOrdinal:null)||markers.pre!==pre||markers.post!==post||markers.contiguous!==contiguous||r.collectionState==='sealed'&&r.endSequence!==(r.rows.length?r.rows.length:0)||r.complete===true&&(r.collectionState!=='sealed'||r.fault!==0||r.diagnosticFault!==0||r.exceptionalPaths!==0||r.activeResizes!==0||r.activeCauses!==0))throw Error('Diagnostic ledger completeness');return r;
}

function scrollCauseCoverage(strict:TrackerASequencerResult,receipt:ScrollCauseExportReceipt,page:ScrollCausePageExport|null):ScrollCauseCoverage{
 const c:ScrollCauseCoverage={protocol:'scroll-cause-attribution-v1',version:1,capability:page?.capability??'not-checked',host:page?.host??'not-checked',url:page?.url??'not-checked',sameScroller:page?.sameScroller??'not-checked',g1:page?.g1??'not-returned',originals:{inputDrain:strict.inputDrain.status,trace:strict.transport===null?'unavailable':strict.transport.outcome.capture.status==='complete'&&strict.transport.outcome.containment==='verified'?'closed':'not-closed',export:receipt.status},scalarJoin:{status:'unavailable',expected:null,observed:0,lastOrdinal:null},availability:'unavailable',reasons:[]};
 let ledger:Record<string,unknown>|null=null;try{if(page?.snapshot!==null&&page?.snapshot!==undefined)ledger=scrollCauseSnapshot(page.snapshot);}catch{}
 if(ledger){const rows=(ledger.rows as (number|null)[][]).filter(row=>row[0]===8),expected=strict.input?.scalarObservations.filter(row=>row.value!==null);c.scalarJoin.observed=rows.length;c.scalarJoin.lastOrdinal=rows.at(-1)?.[7]??null;if(expected){c.scalarJoin.expected=expected.length;c.scalarJoin.status=rows.length===expected.length&&rows.every((row,index)=>{const scalar=expected[index]!;return row[5]===ledger!.ownerId&&row[6]===({pre:1,before:2,after:3,post:4}[scalar.role])&&row[7]===scalar.ordinal&&row[8]===scalar.slot;})?'matched':'mismatched';}c.availability='partial';}
 if(c.capability==='not-checked')c.reasons.push('not-started');else if(c.capability==='changed')c.reasons.push('capability-changed');else if(c.capability!=='same')c.reasons.push('capability-unavailable');
 if(c.host==='changed'||c.url==='changed'||c.sameScroller==='changed')c.reasons.push('owner-changed');
 if(c.g1!=='raw-returned')c.reasons.push('g1-unavailable');if(!ledger)c.reasons.push('ledger-unavailable');else if(ledger.complete!==true)c.reasons.push('ledger-fault');
 if(c.scalarJoin.status!=='matched')c.reasons.push(c.scalarJoin.status==='mismatched'?'scalar-join-mismatch':'scalar-join-unavailable');
 if(c.originals.inputDrain!=='fulfilled')c.reasons.push('input-unclosed');if(c.originals.trace!=='closed')c.reasons.push('trace-unclosed');if(c.originals.export!=='fulfilled')c.reasons.push('export-unclosed');
 if(c.reasons.length===0&&c.host==='same'&&c.url==='same'&&c.sameScroller==='same')c.availability='closed';return c;
}
function scrollCauseCoverageCopy(value:unknown):ScrollCauseCoverage{
 const r=scrollCauseOwn(copyScrollCauseData(value,16384),['protocol','version','capability','host','url','sameScroller','g1','originals','scalarJoin','availability','reasons']);
 const o=scrollCauseOwn(r.originals,['inputDrain','trace','export']),join=scrollCauseOwn(r.scalarJoin,['status','expected','observed','lastOrdinal']);
 const reasonOrder=['not-started','capability-unavailable','capability-changed','owner-changed','g1-unavailable','ledger-unavailable','ledger-fault','scalar-join-unavailable','scalar-join-mismatch','input-unclosed','trace-unclosed','export-unclosed'];
 const integer=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
 if(r.protocol!=='scroll-cause-attribution-v1'||r.version!==1||!['not-checked','same','missing','changed','invalid'].includes(r.capability as string)||![r.host,r.url,r.sameScroller].every(v=>['not-checked','same','changed'].includes(v as string))||!['not-returned','raw-returned'].includes(r.g1 as string)||![o.inputDrain,o.export].every(v=>['not-started','pending','fulfilled','rejected','unavailable'].includes(v as string))||!['unavailable','closed','not-closed'].includes(o.trace as string)||!['unavailable','matched','mismatched'].includes(join.status as string)||join.expected!==null&&!integer(join.expected,0,82)||!integer(join.observed,0,82)||join.lastOrdinal!==null&&!integer(join.lastOrdinal,1,82)||!['unavailable','partial','closed'].includes(r.availability as string)||!Array.isArray(r.reasons)||r.reasons.length>12||r.reasons.some((v,i,a)=>typeof v!=='string'||!reasonOrder.includes(v)||i>0&&reasonOrder.indexOf(v)<=reasonOrder.indexOf(a[i-1])))throw Error('Diagnostic coverage schema');
 if((r.reasons.length===0)!==(r.availability==='closed'))throw Error('Diagnostic coverage completeness');return r as unknown as ScrollCauseCoverage;
}
function scrollCauseExportCopy(value:unknown):ScrollCauseExportReceipt{
 const r=scrollCauseOwn(copyScrollCauseData(value,16384),['status','requestedHostMs','targetHostMs','settledHostMs','waiter','failure']);
 if(!['not-started','pending','fulfilled','rejected'].includes(r.status as string)||!['not-started','fulfilled','rejected','timed-out'].includes(r.waiter as string)||r.failure!==null&&!['capability-unavailable','capability-changed','owner-changed','export-refused','export-timeout','deadline','closure-unavailable','copy-invalid'].includes(r.failure as string)||[r.requestedHostMs,r.targetHostMs,r.settledHostMs].some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)))||['fulfilled','rejected'].includes(r.status as string)&&r.settledHostMs===null||r.status==='pending'&&r.settledHostMs!==null||r.waiter==='fulfilled'&&r.status!=='fulfilled')throw Error('Diagnostic export receipt');return r as unknown as ScrollCauseExportReceipt;
}
function scrollCauseOriginalLane(value:unknown,lane:'input'|'transport',profile:Readonly<{bytes:number;sha256:string}>){
 const keys=lane==='input'?['schemaVersion','kind','mode','caseNumber','profileRef','handlerGates','wheelEvents','scrollEvents','motionEvents','losses','overflows','entry','phase','geometryCheckpoints','anchor','listeners','pointer','scalarObservations','wheelRequests','outcome','authority']:['schemaVersion','kind','mode','profileRef','raw','listeners','operations','completion','sessionClose','handles','handleOverflow','sink','portCalls','readCalls','knownReadBytes','outcome','authority'];
 const r=scrollCauseOwn(value,keys),authority=scrollCauseOwn(r.authority,['qualification','fps','ratio','scoring','ranking']);
 if(r.schemaVersion!==(lane==='input'?2:1)||r.kind!==(lane==='input'?'tracker-a-case-input':'tracker-a-transport')||r.mode!=='tracker-json-a-pilot-v2'||lane==='input'&&r.caseNumber!==2||authority.qualification!==false||authority.fps!=='unavailable'||authority.ratio!=='unavailable'||authority.scoring!==false||authority.ranking!==false)throw Error('Diagnostic original finite discriminant');
 const ref=scrollCauseRef(r.profileRef,'tracker-a-profile.json',16384);if(ref.bytes!==profile.bytes||ref.sha256!==profile.sha256)throw Error('Diagnostic original profile join');
 return value;
}

/** B receives only bounded selected original data, never a raw NativeResult. */
export function projectScrollCauseEvidence(result:NativeMountedScrollCauseResult,profileRef:TrackerAProfileRef){
 const r=scrollCauseOwn(result,['kind','schemaVersion','strict','originals','browserVersion','caseEvidence','attribution','qualification','nativeGO','performance','fps']);if(r.kind!=='scroll-cause-diagnostic-result'||r.schemaVersion!==1||r.qualification!==false||r.nativeGO!==false||r.performance!==false||r.fps!=='unavailable')throw Error('Diagnostic result schema');
 const profile=scrollCauseRef(profileRef,'tracker-a-profile.json',16384),source=r.strict;if(typeof source!=='object'||source===null)throw Error('Diagnostic strict result');
 const selected:Record<string,unknown>={};for(const key of ['status','hasPrimary','firstFailure','cleanupFailures','caseEvidence','snapshots','input','transport','inputDrain','anchorDiagnostic']){const d=Object.getOwnPropertyDescriptor(source,key);if(!d&&key==='anchorDiagnostic'){selected[key]=null;continue;}if(!d||!('value'in d)||!d.enumerable)throw Error('Diagnostic original field');selected[key]=d.value;}
 if(!['complete','incomplete'].includes(selected.status as string)||typeof selected.hasPrimary!=='boolean'||!Array.isArray(selected.cleanupFailures)||selected.cleanupFailures.length>128)throw Error('Diagnostic original status');
 const failure=selected.firstFailure===null?null:scrollCauseOwn(selected.firstFailure,['code','ordinal','previousOrdinal','slot']);
 if(failure){
  const allNull=failure.ordinal===null&&failure.previousOrdinal===null&&failure.slot===null,pre=failure.code==='baseline'&&failure.ordinal===1&&failure.previousOrdinal===null&&failure.slot===null;
  const scalar=typeof failure.ordinal==='number'&&Number.isInteger(failure.ordinal)&&failure.ordinal>=2&&failure.ordinal<=82&&failure.previousOrdinal===failure.ordinal-1&&(failure.slot===null||typeof failure.slot==='number'&&Number.isInteger(failure.slot)&&failure.slot>=0&&failure.slot<40&&(failure.ordinal===2+2*failure.slot||failure.ordinal===3+2*failure.slot));
  if(!['unclassified','baseline','timestamp-reverse','opposing-offset','end-stop'].includes(failure.code as string)||(failure.code==='unclassified'?!allNull:failure.code==='baseline'?!(allNull||pre||scalar):!scalar))throw Error('Diagnostic first failure');
 }
 const attr=scrollCauseOwn(r.attribution,['protocol','exportOriginal','coverage','snapshot']);if(attr.protocol!=='scroll-cause-attribution-v1')throw Error('Diagnostic attribution');
 const exportOriginal=scrollCauseExportCopy(attr.exportOriginal);if(exportOriginal.status==='pending'||exportOriginal.failure==='closure-unavailable')throw Error('Diagnostic export original still pending');
 const ledger=attr.snapshot===null?null:scrollCauseSnapshot(attr.snapshot);
 const input=selected.input===null?null:copyScrollCauseData(selected.input,262144),transport=selected.transport===null?null:copyScrollCauseData(selected.transport,1048576);
 if(input!==null)scrollCauseOriginalLane(input,'input',profile);if(transport!==null)scrollCauseOriginalLane(transport,'transport',profile);
 const caseEvidence=copyScrollCauseData(r.caseEvidence,524288) as CaseRecord[],originals=copyScrollCauseData(r.originals,65536) as Witness[];
 if(!Array.isArray(caseEvidence)||caseEvidence.length>2||!Array.isArray(originals)||originals.length!==3||originals.some((w,i)=>{scrollCauseOwn(w,['label','status']);return w.label!==['browserConnect','clientClose','clientDisconnected'][i]||!['pending','fulfilled','rejected','timed-out','unavailable'].includes(w.status);}))throw Error('Diagnostic original witnesses');
 for(const record of caseEvidence){scrollCauseOwn(record,['caseNumber','journey','threadId','seedRunId','continuationRunId','repetition','completed','publicIdle','storeEmpty','domainReleased','originals']);if(![1,2].includes(record.caseNumber)||record.journey!==(record.caseNumber===1?'follow':'history-reading')||['completed','publicIdle','storeEmpty','domainReleased'].some(key=>typeof (record as unknown as Record<string,unknown>)[key]!=='boolean')||!Array.isArray(record.originals)||record.originals.length!==19||record.originals.some((w,i)=>{scrollCauseOwn(w,['label','status']);return w.label!==MOUNTED_CASE_WITNESS_LABELS[i]||!['pending','fulfilled','rejected','timed-out','unavailable'].includes(w.status);}))throw Error('Diagnostic case witnesses');}
 const snapshots=copyScrollCauseData(selected.snapshots,4194304) as TrackerASequencerResult['snapshots'];if(!Array.isArray(snapshots)||snapshots.length>9)throw Error('Diagnostic snapshots');
 for(const row of snapshots){scrollCauseOwn(row,['caseNumber','snapshot']);if(![1,2].includes(row.caseNumber))throw Error('Diagnostic snapshot case');const shot=row.snapshot;if(shot.status==='available'){scrollCauseOwn(shot,['status','frame','evaluation','visibleMessages','scroll']);const a=scrollCauseOwn(shot.evaluation.authority,['input','nativeDOMQualified','visibleGlyphProof','presentationProof','scoringEligibility']);if(shot.frame.schemaVersion!==1||shot.frame.clockDomain!=='page-performance-ms'||a.input!=='supplied-data'||a.nativeDOMQualified!==false||a.visibleGlyphProof!==false||a.presentationProof!==false||a.scoringEligibility!==false)throw Error('Diagnostic snapshot authority');}else{scrollCauseOwn(shot,['status','reason']);if(!['unavailable','invalid'].includes(shot.status))throw Error('Diagnostic snapshot finite discriminant');}}
 const cases: {caseNumber:1|2;value:unknown}[]=[],absence:{path:string;reason:string}[]=[];
 for(const number of [1,2] as const){const rows=snapshots.filter(row=>row.caseNumber===number).map(row=>row.snapshot),records=caseEvidence.filter(row=>row.caseNumber===number);if(rows.length&&records.length)cases.push({caseNumber:number,value:copyScrollCauseData({caseNumber:number,cases:records,snapshots:rows,qualification:false},2097152)});else absence.push({path:`native-case-${number}.json`,reason:'case-not-produced'});}
 const anchorDiagnostic=selected.anchorDiagnostic===null?null:copyScrollCauseData(selected.anchorDiagnostic,65536);
 if(anchorDiagnostic!==null){const anchor=scrollCauseOwn(anchorDiagnostic,['selection','observations']),selection=scrollCauseOwn(anchor.selection,['snapshotRef','id','role','ownerToken','metric','contentTopCssPx','relativeTopCssPx','nativeViewportY']),ref=scrollCauseOwn(selection.snapshotRef,['path','index']);const case2=cases.find(c=>c.caseNumber===2)?.value as {snapshots:GeometrySnapshot[]}|undefined;if(ref.path!=='native-case-2.json'||typeof ref.index!=='number'||!Number.isInteger(ref.index)||ref.index<0||!case2||ref.index>=case2.snapshots.length||typeof selection.id!=='string'||typeof selection.ownerToken!=='number'||!Number.isSafeInteger(selection.ownerToken)||selection.ownerToken<1||selection.metric!=='min-positive-text-rect-viewport-y'||!Array.isArray(anchor.observations)||anchor.observations.length>82)throw Error('Diagnostic anchor original join');
  const shot=case2.snapshots[ref.index];if(!shot||shot.status!=='available')throw Error('Diagnostic anchor snapshot unavailable');const rows=shot.evaluation.rows.filter(row=>row.id===selection.id);if(rows.length!==1||['id','role','ownerToken','contentTopCssPx','relativeTopCssPx'].some(key=>(rows[0] as unknown as Record<string,unknown>)[key]!==selection[key])||shot.frame.nativeViewport.y!==selection.nativeViewportY)throw Error('Diagnostic anchor original identity');
 }
 if(input===null)absence.push({path:'tracker-a-case-2-input.json',reason:'input-not-produced'});if(transport===null)absence.push({path:'tracker-a-case-2-transport.json',reason:'transport-not-produced'});if(failure===null)absence.push({path:'diagnostic-first-failure.json',reason:'first-failure-none'});if(ledger===null)absence.push({path:'scroll-cause-ledger.json',reason:'ledger-unavailable'});
 const coverage=scrollCauseCoverageCopy(attr.coverage);
 const inputDrain=copyScrollCauseData(selected.inputDrain,4096) as TrackerASequencerResult['inputDrain'];scrollCauseOwn(inputDrain,['status','requestedHostMs','settledHostMs']);
 const actualCoverage=scrollCauseCoverage({input,transport,inputDrain} as TrackerASequencerResult,exportOriginal,{snapshot:ledger,capability:coverage.capability,host:coverage.host,url:coverage.url,sameScroller:coverage.sameScroller,g1:coverage.g1});
 if(JSON.stringify(actualCoverage)!==JSON.stringify(coverage))throw Error('Diagnostic coverage original join');
 const strictResult=copyScrollCauseData({schemaVersion:1,kind:'unqualified-scroll-cause-strict-result',profileRef:profile,strict:{status:selected.status,hasPrimary:selected.hasPrimary,firstFailure:failure,cleanupFailureCount:selected.cleanupFailures.length},caseEvidence,originals,browserVersion:r.browserVersion,anchorDiagnostic,publicationAbsence:absence,attributionCoverage:coverage,qualification:false,nativeGO:false,performance:false,fps:'unavailable'},524288);
 return {strictResult,cases,input,transport,firstFailure:failure,ledger,exportOriginal,absence};
}
/** Caller bootstrap must authenticate source/provider/archive/physical graph
 * BEFORE importing the emitted worker. These policies remain supplied-data only. */
export async function runNativeMountedConformance(options:NativeMountedOptions,diagnostics:RestoredHistoryDiagnosticPort):Promise<NativeMountedResult>{
 if(!mountedPrerequisitesAccepted(options.prerequisites))
  throw Error('Native prerequisites denied before SDK imports');
 return runNativeMountedOwner(options,diagnostics,{kind:'ordinary'});
}
export async function runNativeMountedTrackerAPilot(options:NativeMountedTrackerAPilotOptions,diagnostics:RestoredHistoryDiagnosticPort,publication:NativeMountedTrackerAPublication):Promise<NativeMountedTrackerAPilotResult>{
 if(evaluateMountedTrackerAPilotPrerequisites(options.prerequisites).status!=='accepted')throw Error('Fixed pilot prerequisites denied before SDK imports');
 const publicationDescriptors=Object.getOwnPropertyDescriptors(publication),capability=publicationDescriptors.anchorDiagnostic,gateCapability=publicationDescriptors.wheelHandlerAfterGate,profileDescriptor=publicationDescriptors.profileRef,reserveDescriptor=publicationDescriptors.reserveTraceSink;
 if(![Object.prototype,null].includes(Object.getPrototypeOf(publication))||Reflect.ownKeys(publicationDescriptors).length!==4||!gateCapability||!('value'in gateCapability)||!capability||!('value'in capability)||!profileDescriptor||!('value'in profileDescriptor)||!reserveDescriptor||!('value'in reserveDescriptor)||typeof reserveDescriptor.value!=='function')throw Error('Diagnostic publication denied before SDK imports');
 const expected={protocol:'tracker-a-anchor-scalars-v1',role:'tracker-a-anchor-scalars-v1.json',cap:65536,maxObservations:82,g1Purpose:'tracker-a-G1-anchor-diagnostic-v1',metric:'min-positive-text-rect-viewport-y'} as const;
 if(typeof capability.value!=='object'||capability.value===null)throw Error('Diagnostic capability absent');
 const fields=Object.getOwnPropertyDescriptors(capability.value);if(Reflect.ownKeys(fields).length!==6||Object.entries(expected).some(([k,v])=>!fields[k]||!('value'in fields[k]!)||fields[k]!.value!==v))throw Error('Diagnostic capability differs before SDK imports');
 const expectedGate={protocol:'tracker-a-wheel-handler-after-gate-v1',maxGates:40,entry:'unchanged',arm:'measured-before-existing-evaluate',wait:'measured-after-existing-evaluate',event:'same-original-wheel-listener'} as const;
 if(typeof gateCapability.value!=='object'||gateCapability.value===null||![Object.prototype,null].includes(Object.getPrototypeOf(gateCapability.value)))throw Error('Wheel handler capability absent before SDK imports');
 const gateFields=Object.getOwnPropertyDescriptors(gateCapability.value);if(Reflect.ownKeys(gateFields).length!==6||Object.entries(expectedGate).some(([k,v])=>!gateFields[k]||!('value'in gateFields[k]!)||gateFields[k]!.value!==v))throw Error('Wheel handler capability differs before SDK imports');
 const descriptors=Object.getOwnPropertyDescriptors(profileDescriptor.value);
 const bytes=descriptors.bytes?.value;
 if(Reflect.ownKeys(descriptors).length!==3||descriptors.path?.value!=='tracker-a-profile.json'||typeof bytes!=='number'||!Number.isSafeInteger(bytes)||bytes<0||bytes>16384||typeof descriptors.sha256?.value!=='string'||!/^[0-9a-f]{64}$/.test(descriptors.sha256.value))throw Error('Pilot publication denied before SDK imports');
 const copied:NativeMountedTrackerAPublication={wheelHandlerAfterGate:{...expectedGate},profileRef:{path:'tracker-a-profile.json',bytes,sha256:descriptors.sha256.value},anchorDiagnostic:{...expected},reserveTraceSink:reserveDescriptor.value};
 return runNativeMountedOwner(options,diagnostics,{kind:'pilot',publication:copied});
}
export interface NativeMountedScrollCauseOptions {kind:'scroll-cause-diagnostic-options';schemaVersion:1;source:{commitSha:string;treeSha:string;lockSha256:string};run:{repository:'cacheplane/chat-ui-bench';runId:string;attempt:1;tag:'hosted-copilot-react-scroll-cause-v1'};browserEndpoint:string;assets:NativeMountedOptions['assets'];buildRef:{path:'diagnostic-build.json';bytes:number;sha256:string}}
export interface NativeMountedScrollCausePublication extends NativeMountedTrackerAPublication {attribution:{protocol:'scroll-cause-attribution-v1';exportTimeoutMs:2000}}
export interface ScrollCauseExportReceipt {status:'not-started'|'pending'|'fulfilled'|'rejected';requestedHostMs:number|null;targetHostMs:number|null;settledHostMs:number|null;waiter:'not-started'|'fulfilled'|'rejected'|'timed-out';failure:null|'capability-unavailable'|'capability-changed'|'owner-changed'|'export-refused'|'export-timeout'|'deadline'|'closure-unavailable'|'copy-invalid'}
type ScrollCauseExportOwner=ReturnType<typeof createScrollCauseExportOwner>;
export type ScrollCauseCoverageReason='not-started'|'capability-unavailable'|'capability-changed'|'owner-changed'|'g1-unavailable'|'ledger-unavailable'|'ledger-fault'|'scalar-join-unavailable'|'scalar-join-mismatch'|'input-unclosed'|'trace-unclosed'|'export-unclosed';
export interface ScrollCauseCoverage {protocol:'scroll-cause-attribution-v1';version:1;capability:ScrollCausePageExport['capability'];host:ScrollCausePageExport['host'];url:ScrollCausePageExport['url'];sameScroller:ScrollCausePageExport['sameScroller'];g1:ScrollCausePageExport['g1'];originals:{inputDrain:'not-started'|'pending'|'fulfilled'|'rejected'|'unavailable';trace:'unavailable'|'closed'|'not-closed';export:ScrollCauseExportReceipt['status']|'unavailable'};scalarJoin:{status:'unavailable'|'matched'|'mismatched';expected:number|null;observed:number;lastOrdinal:number|null};availability:'unavailable'|'partial'|'closed';reasons:ScrollCauseCoverageReason[]}
export interface NativeMountedScrollCauseResult {kind:'scroll-cause-diagnostic-result';schemaVersion:1;strict:TrackerASequencerResult;originals:readonly Witness[];browserVersion:string|null;caseEvidence:readonly CaseRecord[];attribution:{protocol:'scroll-cause-attribution-v1';exportOriginal:ScrollCauseExportReceipt;coverage:ScrollCauseCoverage;snapshot:unknown};qualification:false;nativeGO:false;performance:false;fps:'unavailable'}
/** Explicit diagnostic lane; no fabricated normal prerequisite or SDK import. */
export async function runNativeMountedScrollCauseDiagnostic(options:NativeMountedScrollCauseOptions,diagnostics:RestoredHistoryDiagnosticPort,publication:NativeMountedScrollCausePublication):Promise<NativeMountedScrollCauseResult>{
 const o=scrollCauseOwn(options,['kind','schemaVersion','source','run','browserEndpoint','assets','buildRef']);
 if(o.kind!=='scroll-cause-diagnostic-options'||o.schemaVersion!==1)throw Error('Diagnostic options denied before SDK imports');
 const source=scrollCauseOwn(o.source,['commitSha','treeSha','lockSha256']),run=scrollCauseOwn(o.run,['repository','runId','attempt','tag']);
 if(typeof source.commitSha!=='string'||!/^[0-9a-f]{40}$/.test(source.commitSha)||typeof source.treeSha!=='string'||!/^[0-9a-f]{40}$/.test(source.treeSha)||typeof source.lockSha256!=='string'||!/^[0-9a-f]{64}$/.test(source.lockSha256)||run.repository!=='cacheplane/chat-ui-bench'||typeof run.runId!=='string'||!/^\d{1,20}$/.test(run.runId)||run.attempt!==1||run.tag!=='hosted-copilot-react-scroll-cause-v1'||typeof o.browserEndpoint!=='string')throw Error('Diagnostic context denied before SDK imports');
 scrollCauseRef(o.buildRef,'diagnostic-build.json',1048576);const asset=scrollCauseOwn(o.assets,['root','files']);
 if(typeof asset.root!=='string'||asset.root.length>4096||!Array.isArray(asset.files))throw Error('Diagnostic assets denied before SDK imports');
 const inventory=assertProductionOutputInventory(asset.files);
 const p=scrollCauseOwn(publication,['wheelHandlerAfterGate','profileRef','anchorDiagnostic','reserveTraceSink','attribution']);
 scrollCauseRef(p.profileRef,'tracker-a-profile.json',16384);
 for(const [value,expected] of [[p.wheelHandlerAfterGate,{protocol:'tracker-a-wheel-handler-after-gate-v1',maxGates:40,entry:'unchanged',arm:'measured-before-existing-evaluate',wait:'measured-after-existing-evaluate',event:'same-original-wheel-listener'}],[p.anchorDiagnostic,{protocol:'tracker-a-anchor-scalars-v1',role:'tracker-a-anchor-scalars-v1.json',cap:65536,maxObservations:82,g1Purpose:'tracker-a-G1-anchor-diagnostic-v1',metric:'min-positive-text-rect-viewport-y'}],[p.attribution,{protocol:'scroll-cause-attribution-v1',exportTimeoutMs:2000}]] as const){const fields=scrollCauseOwn(value,Object.keys(expected));if(Object.entries(expected).some(([key,value])=>fields[key]!==value))throw Error('Diagnostic publication denied before SDK imports');}
 if(typeof p.reserveTraceSink!=='function'||evaluateMountedOriginPolicy({schemaVersion:1,kind:'control-connect',boundEndpoint:o.browserEndpoint,requestedEndpoint:o.browserEndpoint,priorConnectCount:0}).status!=='accepted')throw Error('Diagnostic publication denied before SDK imports');
 const copiedOptions={kind:'scroll-cause-diagnostic-options',schemaVersion:1,source:{...source},run:{...run},browserEndpoint:o.browserEndpoint,assets:{root:asset.root,files:inventory.files},buildRef:scrollCauseRef(o.buildRef,'diagnostic-build.json',1048576)} as NativeMountedScrollCauseOptions;
 const copiedPublication={wheelHandlerAfterGate:{...scrollCauseOwn(p.wheelHandlerAfterGate,['protocol','maxGates','entry','arm','wait','event'])},profileRef:scrollCauseRef(p.profileRef,'tracker-a-profile.json',16384),anchorDiagnostic:{...scrollCauseOwn(p.anchorDiagnostic,['protocol','role','cap','maxObservations','g1Purpose','metric'])},reserveTraceSink:p.reserveTraceSink,attribution:{protocol:'scroll-cause-attribution-v1',exportTimeoutMs:2000}} as NativeMountedScrollCausePublication;
 const fs=await import('node:fs/promises'),path=await import('node:path'),crypto=await import('node:crypto');
 if(!path.isAbsolute(asset.root)||await fs.realpath(asset.root)!==asset.root)throw Error('Diagnostic assets root denied before SDK imports');
 for(const fact of inventory.files){let part=asset.root;for(const name of fact.path.split('/')){part=path.join(part,name);if((await fs.lstat(part)).isSymbolicLink())throw Error('Diagnostic asset symlink');}const handle=await fs.open(part,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{const before=await handle.stat({bigint:true});if(!before.isFile()||before.nlink!==1n||before.size!==BigInt(fact.bytes))throw Error('Diagnostic asset identity');const bytes=await handle.readFile(),after=await handle.stat({bigint:true});if(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].some(key=>(before as unknown as Record<string,unknown>)[key]!== (after as unknown as Record<string,unknown>)[key])||bytes.length!==fact.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==fact.sha256)throw Error('Diagnostic asset bytes');}finally{await handle.close();}}
 return runNativeMountedOwner(copiedOptions,diagnostics,{kind:'scroll-cause',publication:copiedPublication});
}
type NativeMode={kind:'ordinary'}|{kind:'pilot';publication:NativeMountedTrackerAPublication}|{kind:'scroll-cause';publication:NativeMountedScrollCausePublication};
function runNativeMountedOwner(options:NativeMountedOptions,diagnostics:RestoredHistoryDiagnosticPort,mode:{kind:'ordinary'}):Promise<NativeMountedResult>;
function runNativeMountedOwner(options:NativeMountedTrackerAPilotOptions,diagnostics:RestoredHistoryDiagnosticPort,mode:{kind:'pilot';publication:NativeMountedTrackerAPublication}):Promise<NativeMountedTrackerAPilotResult>;
function runNativeMountedOwner(options:NativeMountedScrollCauseOptions,diagnostics:RestoredHistoryDiagnosticPort,mode:{kind:'scroll-cause';publication:NativeMountedScrollCausePublication}):Promise<NativeMountedScrollCauseResult>;
async function runNativeMountedOwner(options:NativeMountedOptions|NativeMountedTrackerAPilotOptions|NativeMountedScrollCauseOptions,diagnostics:RestoredHistoryDiagnosticPort,mode:NativeMode):Promise<NativeMountedResult|NativeMountedTrackerAPilotResult|NativeMountedScrollCauseResult>{
 const p='prerequisites'in options?options.prerequisites:undefined;
 if(evaluateMountedOriginPolicy({schemaVersion:1,kind:'control-connect',boundEndpoint:options.browserEndpoint,requestedEndpoint:options.browserEndpoint,priorConnectCount:0}).status!=='accepted')throw Error('Native browser endpoint denied');
 const assetInventory=assertProductionOutputInventory(options.assets.files);
 const files=new Map(assetInventory.files.map(f=>[f.path,f]));if(!files.has('index.html'))throw Error('Qualified frontend entry absent');
 const [{chromium},{createCaseServer},contract,fs,path,crypto]=await Promise.all([import('playwright'),import('./server.js'),import('../../../packages/contract/src/long-thread.js'),import('node:fs/promises'),import('node:path'),import('node:crypto')]);
 const root=await fs.realpath(options.assets.root);
 if(root!==options.assets.root)throw Error('Qualified assets root must be real absolute path');
 const originals:{label:string;status:OriginalStatus}[]=['browserConnect','clientClose','clientDisconnected'].map(label=>({label,status:'pending'}));
 const markGlobal=(label:string)=>{originals.find(w=>w.label===label)!.status='fulfilled';};
 let browser:Awaited<ReturnType<typeof chromium.connect>>|undefined,browserVersion:string|null=null,disconnect:Promise<void>|undefined;
 const caseEvidence:CaseRecord[]=[];
 const overallDeadline=performance.now()+180000;
 let diagnosticTransport:TrackerASequencerResult['transport']|undefined;
 let exportPage:Page|undefined;
 const attributionExport=mode.kind==='scroll-cause'?createScrollCauseExportOwner(()=>exportPage?exportPage.evaluate(exportTrackerAScrollCauseDiagnostic):Promise.reject(Error('capability-unavailable')),overallDeadline):undefined;
 const checkDeadline=()=>{if(performance.now()>=overallDeadline)throw Error('Native matrix deadline exceeded');};
 async function assets(request:Request):Promise<Response>{
  const url=new URL(request.url),name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  const fact=files.get(name);if(request.method!=='GET'||!ordinaryPath(name)||!fact)return new Response('Not found',{status:404});
  let ancestor=root;for(const part of name.split('/')){ancestor=path.join(ancestor,part);if((await fs.lstat(ancestor)).isSymbolicLink())throw Error('Asset symlink denied');}
  const handle=await fs.open(path.join(root,name),fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  let bytes:Uint8Array;
  try{const before=await handle.stat();if(!before.isFile()||before.size!==fact.bytes)throw Error('Asset size/owner changed');bytes=await handle.readFile();const after=await handle.stat();if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||bytes.length!==fact.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==fact.sha256)throw Error('Asset bytes changed');}finally{await handle.close();}
  const ext=path.extname(name),mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
  return new Response(new Uint8Array(bytes),{headers:{'content-type':mime[ext]??'application/octet-stream','cache-control':'no-store'}});
 }
 const nativePorts={
  async connect(){
   checkDeadline();browser=await chromium.connect(options.browserEndpoint,{timeout:30000});
   // Public event and close promise remain distinct originals.
   disconnect=new Promise<void>(resolve=>browser!.once('disconnected',()=>{markGlobal('clientDisconnected');resolve();}));
   if(!browser.isConnected())throw Error('Original browser disconnected before bind');browserVersion=browser.version();markGlobal('browserConnect');
  },
  async openCase(journey:'follow'|'history-reading',number:1|2):Promise<MountedCaseOwner&{pilot?:TrackerAHistoryOwner}>{
   checkDeadline();if(!browser)throw Error('No original browser');
   const fixture=contract.createLongThreadFixture({historyCount:100,responseBytes:6400,journey,seed:1});
   const ids={threadId:`native-thread-${number}`,seedRunId:`native-seed-${number}`,continuationRunId:`native-continuation-${number}`,responseId:fixture.events[0]!.messageId};
   const repetition=`native-repetition-${number}`;
   const witnesses:{label:string;status:OriginalStatus}[]=MOUNTED_CASE_WITNESS_LABELS.map(label=>({label,status:'pending'}));
   const mark=(label:NativeCaseWitness)=>{const w=witnesses.find(x=>x.label===label)!;if(w.status!=='pending')throw Error('Duplicate original witness');w.status='fulfilled';};
   let history:readonly OriginLease[]=[],leases:readonly OriginLease[]=[],recordingFailed=false,localClosed=false,publicationFailed=false;
   let page:import('playwright').Page|undefined,context:import('playwright').BrowserContext|undefined;
   let remoteAdmission:Promise<void>|undefined,originalClose:Promise<CaseRecord>|undefined,completed=false,publicIdle=false;
   let pilot:ReturnType<typeof bindNativeTrackerA>|undefined;
   const observe=(event:NativeCaseObservation)=>{
    try{
     if(event.kind==='witness'){const w=witnesses.find(x=>x.label===event.label)!;if(w.status!=='pending')throw Error('Duplicate source witness');w.status=event.status;return;}
     const action=event.action==='listen'?{kind:'register' as const,role:event.role,origin:event.origin,listenObserved:true}:event.action==='close'?{kind:'release' as const,role:event.role,origin:event.origin,originalClose:'fulfilled' as const}:{kind:'request' as const,role:event.role,origin:event.origin,channel:'native-fetch' as const,method:event.method!,path:event.path!};
     const evaluation=evaluateMountedOriginPolicy({schemaVersion:1,kind:'origin-transition',caseId:journey,threadId:ids.threadId,registrationHistory:history,leases,action});
     if(evaluation.status!=='accepted'||!evaluation.facts||!('kind' in evaluation.facts)||evaluation.facts.kind!=='origin-transition')throw Error('Actual original origin denied');history=evaluation.facts.registrationHistory;leases=evaluation.facts.leases;
    }catch(error){recordingFailed=true;throw error;}
   };
   const remoteCloseAdmission=()=>{
    localClosed=true;if(!page||remoteAdmission)return;
    const original=page.evaluate(()=>{const host=(window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost;if(!host)throw Error('Original page host absent');host.closeAdmission();});
    remoteAdmission=original.then(()=>{mark('remoteCloseAdmission');});remoteAdmission.catch(()=>{recordingFailed=true;});
   };
   const mountedOwner={closeAdmission:remoteCloseAdmission,async dispose(){
    remoteCloseAdmission();const failures:unknown[]=[];
    // Trace cleanup is owned independently of the sequencer's bounded waiter.
    // Ordinary disposal always follows, including on rejection or pending IO.
    if(pilot)try{await pilot.dispose();}catch(e){failures.push(e);}
    try{if(!remoteAdmission)throw Error('Original remote admission absent');await remoteAdmission;}catch(e){failures.push(e);}
    if(mode.kind==='scroll-cause'&&number===2){try{exportPage=page;await attributionExport!.attempt();}catch{if(attributionExport)attributionExport.receipt.failure='export-refused';}}
    if(page){try{await page.evaluate(()=>{const w=window as unknown as {__copilotkitNativeWheel?:{remove():void}};w.__copilotkitNativeWheel?.remove();delete w.__copilotkitNativeWheel;});}catch(e){failures.push(e);}
     try{await page.evaluate(async()=>{const h=(window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost;if(!h)throw Error('Original host absent');await h.dispose();});mark('hostDispose');}catch(e){failures.push(e);}
     try{if(!await page.evaluate(()=>document.getElementById('root')?.childElementCount===0))throw Error('Root remains mounted');mark('rootUnmount');}catch(e){failures.push(e);}
     try{await page.close();mark('pageClose');}catch(e){failures.push(e);}}
    if(context)try{await context.close();mark('contextClose');}catch(e){failures.push(e);}
    if(failures.length)throw Error('Original mounted disposal incomplete');
   }};
   const server=await createCaseServer({fixture,ids,repetition,mountedOwner,assets,hooks:{observe}});
   const rawRecord=():CaseRecord=>({caseNumber:number,journey,threadId:ids.threadId,seedRunId:ids.seedRunId,continuationRunId:ids.continuationRunId,repetition,completed,publicIdle,storeEmpty:witnesses.find(w=>w.label==='publicStoreEmpty')!.status==='fulfilled',domainReleased:witnesses.find(w=>w.label==='caseDomainRelease')!.status==='fulfilled',originals:witnesses.map(w=>({...w}))});
   const read=createMountedSnapshotReader(journey,async(purpose):Promise<GeometrySnapshot>=>{checkDeadline();if(localClosed||recordingFailed||!page)throw Error('Case admission closed');return page.evaluate(readTrackerAGeometrySnapshot,purpose);},()=>awaitRestoredHistorySnapshot({caseNumber:number,journey,threadId:ids.threadId,history:fixture.history},{
    check:()=>performance.now()>=overallDeadline?'deadline':localClosed?'admission-closed':recordingFailed?'source-error':null,
    observe:()=>page!.evaluate(()=>{
     const h=(window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost;if(!h)throw Error('Original host absent');
     const content=h.readRestoredHistoryContentReadiness();
     const snapshot=content.status==='ready'?h.readGeometrySnapshot():null;
     return {content,snapshot};
    }),
    pause:()=>page!.waitForTimeout(50),
    publish:async record=>{try{await diagnostics.emitReadinessSummary(record);}catch(error){publicationFailed=true;throw error;}}
   }));
   // Scalar progress polling never invokes the full H100 geometry collector. Only one
   // response box and the scroller box are read; these scalars confer no geometry eligibility.
   async function progress(){
    checkDeadline();if(localClosed||recordingFailed||!page)throw Error('Case admission closed');
    return page.evaluate(responseId=>{
     const h=(window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost;if(!h)throw Error('Original host absent');
     const p=h.readProgress(),scroller=document.querySelector<HTMLElement>(h.locators.scroller);
     if(!scroller)throw Error('Original scroller absent');
     const response=document.querySelector<HTMLElement>(h.locators.messageContent(responseId)),box=response?.getBoundingClientRect(),clip=scroller.getBoundingClientRect();
     return {active:p.loading&&p.delivery==='streaming'&&p.activeMessage!==null,prefixLength:p.activeMessage?.text.length??0,
      loading:p.loading,outcome:p.outcome,error:p.error!==null,now:performance.now(),scrollTop:scroller.scrollTop,
      responseOnscreen:Boolean(box&&box.width>0&&box.height>0&&box.bottom>Math.max(0,clip.top)&&box.top<Math.min(innerHeight,clip.bottom)&&box.right>Math.max(0,clip.left)&&box.left<Math.min(innerWidth,clip.right))};
    },ids.responseId);
   }
   type Progress=Awaited<ReturnType<typeof progress>>;
   async function until(test:(s:Progress)=>boolean):Promise<Progress>{for(let i=0;i<120;i++){const s=await progress();if(s.error)throw Error('Original public progress failed');if(test(s))return s;await page!.waitForTimeout(50);}throw Error('Native scalar readiness not established within bounded observations');}
   const responseVisible=(s:Progress)=>s.responseOnscreen&&s.active;
   const owner:MountedCaseOwner&{pilot?:TrackerAHistoryOwner}={
    async seed(){await server.seed();},
    async restore(){
     context=await browser!.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
     await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
      if(url.origin===server.url&&request.method()==='GET'&&files.has(name)){await route.continue();return;}
      const policy=evaluateMountedOriginPolicy({schemaVersion:1,kind:'origin-transition',caseId:journey,threadId:ids.threadId,registrationHistory:history,leases,action:{kind:'request',role:'native-case',origin:url.origin,channel:'page-http',method:request.method(),path:url.pathname}});
      if(policy.status!=='accepted'){recordingFailed=true;await route.abort();return;}await route.continue();
     });
     await context.routeWebSocket('**/*',socket=>{recordingFailed=true;socket.close();});
     page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
     await page.goto(server.url,{waitUntil:'load'});await page.waitForFunction(()=>Boolean((window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost));
     const committed=server.context();if(!committed)throw Error('Seed context missing');
     await page.evaluate(async history=>{await (window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.loadHistory(history.map(m=>({id:m.id,role:m.role,text:m.content,status:'complete' as const})));},committed.history);
     mark('mountedACK');
     const restored=await read();
     if(pilot)await pilot.captureBaseline();
     return restored;
    },
    async startContinuation(){await page!.evaluate(()=>{const original=(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.connectReplay('/__bench/continuation');Promise.resolve(original).catch(()=>{});});},
    async exercise(selected):Promise<JourneyObservations>{
     if(selected==='follow'){
      await until(responseVisible);const first=await read();if(first.status!=='available')throw Error('Original response geometry unavailable');
      await until(s=>responseVisible(s)&&s.now>=first.frame.observedAtPageMs+800&&s.prefixLength>first.frame.responseProgress.prefix.length);
      const second=await read();return {samples:[first,second],anchorId:null,returned:null,wheel:null};
     }
     await until(responseVisible);const selector=await page!.evaluate(()=>(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.locators.scroller);
     const box=await page!.locator(selector).boundingBox();if(!box)throw Error('Native scroller absent');await page!.mouse.move(box.x+box.width/2,box.y+box.height/2);
     // Registration is acknowledged before the native wheel is requested.
     // The owned listener is once-only and is removed during disposal on failure.
     await page!.evaluate(selector=>{
      const w=window as unknown as {__copilotkitNativeWheel?:{value:{isTrusted:boolean;deltaY:number;beforeScrollTop:number}|null;remove():void}};
      if(w.__copilotkitNativeWheel)throw Error('Original native input already registered');
      const scroller=document.querySelector<HTMLElement>(selector);if(!scroller)throw Error('Original scroller absent');
      const handler=(event:WheelEvent)=>{w.__copilotkitNativeWheel!.value={isTrusted:event.isTrusted,deltaY:event.deltaY,beforeScrollTop:scroller.scrollTop};};
      w.__copilotkitNativeWheel={value:null,remove:()=>scroller.removeEventListener('wheel',handler)};
      scroller.addEventListener('wheel',handler,{once:true,passive:true});
     },selector);
     await page!.mouse.wheel(0,-600);
     await page!.waitForFunction(()=>Boolean((window as unknown as {__copilotkitNativeWheel?:{value:unknown}}).__copilotkitNativeWheel?.value),undefined,{timeout:5000});
     const wheelEvent=await page!.evaluate(()=>{
      const w=window as unknown as {__copilotkitNativeWheel?:{value:{isTrusted:boolean;deltaY:number;beforeScrollTop:number}|null;remove():void}};
      const original=w.__copilotkitNativeWheel;if(!original?.value)throw Error('Original native wheel absent');original.remove();delete w.__copilotkitNativeWheel;return original.value;
     });
     await until(s=>s.active&&s.scrollTop<wheelEvent.beforeScrollTop);const first=await read();
     if(first.status!=='available')throw Error('Original anchor unavailable');const anchor=first.evaluation.rows.find(r=>r.id!==ids.responseId&&r.geometryEligibility==='eligible');if(!anchor)throw Error('Original anchor unavailable');const anchorId=anchor.id;
     await until(s=>s.active&&s.now>=first.frame.observedAtPageMs+800&&s.prefixLength>first.frame.responseProgress.prefix.length);const second=await read();
     const control=await page!.evaluate(()=>(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.locators.returnToResponse);
     if(!control)throw Error('Native return control absent');await page!.locator(control).click({scroll:'none'});await until(s=>s.responseOnscreen);const returned=await read();return {samples:[first,second],anchorId,returned,wheel:{...wheelEvent,afterScrollTop:first.scroll.scrollTop}};
    },
    async complete(){await page!.evaluate(async()=>{const h=(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost;await h.waitForReplay();await h.validateCompletion();});completed=server.completed();publicIdle=await page!.evaluate(()=>{const p=(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.readProgress();return !p.loading&&p.outcome==='success'&&p.error===null;});mark('completionACK');if(!completed||!publicIdle||recordingFailed)throw Error('Original completion failed');await until(s=>s.responseOnscreen&&!s.loading&&s.outcome==='success');return read();},
    close(){if(originalClose)return originalClose;originalClose=(async()=>{try{return await closeAfterHistoryReadinessPublication(async()=>{await server.close();if(recordingFailed)throw Error('Native observation failed');return rawRecord();},()=>publicationFailed);}finally{caseEvidence.push(rawRecord());}})();return originalClose;}
   };
   if(mode.kind!=='ordinary'&&number===2){
    pilot=bindNativeTrackerA({...(mode.kind==='scroll-cause'?{scrollCauseAttribution:true as const,observeScrollCauseTransport:(value:NonNullable<TrackerASequencerResult['transport']>)=>{diagnosticTransport=value;}}:{}),page:()=>page,context:()=>context,deadline:overallDeadline,publication:mode.publication,check:checkDeadline,owner,geometry:read,active:async()=>{const s=await until(s=>s.active&&s.prefixLength>0);return {active:s.active,prefixLength:s.prefixLength};},returned:async()=>{
     const control=await page!.evaluate(()=>(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.locators.returnToResponse);
     if(!control)throw Error('Native return control absent');await page!.locator(control).click({scroll:'none'});await until(s=>s.responseOnscreen);
    }});owner.pilot=pilot.history;
   }
   return owner;
  },
  async closeClient(){if(browser){const original=browser.close();await boundedWait(original,10000,'Original browser client close');markGlobal('clientClose');if(!disconnect)throw Error('Original disconnect listener absent');await boundedWait(disconnect,10000,'Original browser disconnect');}}
 };
 if(mode.kind!=='ordinary'){
  const pilot=await runMountedTrackerA({profileRef:mode.publication.profileRef,anchorDiagnostic:true,clock:nativeClock(overallDeadline),connect:nativePorts.connect,openFollow:()=>nativePorts.openCase('follow',1),openHistory:async()=>{const owner=await nativePorts.openCase('history-reading',2);if(!owner.pilot)throw Error('Original pilot owner absent');return owner.pilot;},closeClient:nativePorts.closeClient});
  if(mode.kind==='scroll-cause'){
   if(!attributionExport)throw Error('Original diagnostic export owner absent');
   if(attributionExport.receipt.status==='pending')attributionExport.receipt.failure='closure-unavailable';
   const observed=attributionExport.value();let copied:ScrollCausePageExport|null=null;try{if(observed!==undefined)copied=copyScrollCauseData(observed,1048576) as ScrollCausePageExport;}catch{attributionExport.receipt.failure='copy-invalid';}
   // Refresh only this diagnostic data lane from the last actual cleanup view.
   // Earlier strict decisions and original error/receipt identities stay intact.
   const strict=diagnosticTransport===undefined?pilot:{...pilot,transport:diagnosticTransport};
   const snapshot=copied?.snapshot??null,coverage=scrollCauseCoverage(strict,attributionExport.receipt,copied);
   return {kind:'scroll-cause-diagnostic-result',schemaVersion:1,strict,originals,browserVersion,caseEvidence,attribution:{protocol:'scroll-cause-attribution-v1',exportOriginal:attributionExport.receipt,coverage,snapshot},qualification:false,nativeGO:false,performance:false,fps:'unavailable'};
  }
  return {pilot,originals,browserVersion,caseEvidence};
 }
 const result=await runMountedConformance(p!,nativePorts);
 return {...result,originals,browserVersion,caseEvidence};
}

function nativeClock(deadlineHostMs:number){
 return {now:()=>performance.now(),deadlineHostMs,alarm(at:number,fire:()=>void){const timer=setTimeout(fire,Math.max(0,at-performance.now()));return ()=>clearTimeout(timer);},waitUntil(at:number){return new Promise<void>(resolve=>{const wake=()=>{const remaining=at-performance.now();if(remaining>0)setTimeout(wake,remaining);else resolve();};wake();});}};
}
type NativeLoss={firstHostMs:number;firstOverflowHostMs:number|null};
type PilotDOMName='wheel'|'scroll'|'animationstart'|'transitionrun';
type PilotPageState=import('./mounted-tracker-a.ts').TrackerAPageState;
type PilotWindow=Window&{__copilotkitBenchHost?:OwnedFrontendHost;__copilotkitTrackerA?:PilotPageState};

type PrivateOriginal={status:'not-started'|'pending'|'fulfilled'|'rejected';requestedHostMs:number|null;settledHostMs:number|null;promise:Promise<unknown>|null;value:unknown};
/** Fixed SDK JSON protocol responses only: no arbitrary JS object/parser claim.
 * Bounds cover retained data and explicit copies, not SDK/engine heap internals.
 * The two topology responses are diagnostic originals, never artifact data. */
function boundedPrivateTopology(value:unknown):void{
 let tokens=0,bytes=0;const ancestors=new Set<object>();
 const charge=(n:number)=>{bytes+=n;if(bytes>4194304)throw Error('Private topology byte capacity');};
 const stringBytes=(text:string)=>{
  if(text.length>4194304)throw Error('Private topology byte capacity');charge(2);
  for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c===34||c===92)charge(2);else if(c<32)charge(c===8||c===9||c===10||c===12||c===13?2:6);else if(c<128)charge(1);else if(c<2048)charge(2);else if(c>=0xd800&&c<=0xdbff){const next=text.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('Private topology Unicode');charge(4);}else if(c>=0xdc00&&c<=0xdfff)throw Error('Private topology Unicode');else charge(3);}
 };
 const walk=(v:unknown,depth:number):void=>{
  if(depth>32||++tokens>65536)throw Error('Private topology record capacity');
  if(v===null){charge(4);return;}if(typeof v==='string'){stringBytes(v);return;}if(typeof v==='boolean'){charge(v?4:5);return;}
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Private topology finite value');charge(JSON.stringify(v).length);return;}
  if(typeof v!=='object'||ancestors.has(v))throw Error('Private topology data required');
  const array=Array.isArray(v);if(!array&&Object.getPrototypeOf(v)!==Object.prototype)throw Error('Private topology plain record');
  charge(2);ancestors.add(v);
  if(array){
   // Guard own length BEFORE indexed traversal or enumeration. No key array is
   // materialized; the protocol contract supplies dense enumerable JSON data.
   const length=Object.getOwnPropertyDescriptor(v,'length');
   if(!length||!('value'in length)||!Number.isSafeInteger(length.value)||length.value<0||length.value>65536-tokens)throw Error('Private topology array capacity');
   for(let i=0;i<length.value;i++){if(i)charge(1);const entry=Object.getOwnPropertyDescriptor(v,String(i));if(!entry||!entry.enumerable||!('value'in entry))throw Error('Private topology dense array');walk(entry.value,depth+1);}
   let entries=0;for(const key in v){if(!Object.hasOwn(v,key)||key!==String(entries)||entries>=length.value)throw Error('Private topology dense enumerable keys');entries++;}
   if(entries!==length.value)throw Error('Private topology dense enumerable keys');
  }else{
   let entries=0;for(const key in v){
    if(!Object.hasOwn(v,key))throw Error('Private topology own enumerable key');
    if(entries++)charge(1);walk(key,depth+1);charge(1);
    const entry=Object.getOwnPropertyDescriptor(v,key);if(!entry||!entry.enumerable||!('value'in entry))throw Error('Private topology own enumerable value');walk(entry.value,depth+1);
   }
  }
  ancestors.delete(v);
 };walk(value,0);
 // The complete serialization is allocated only after exact bounded traversal.
 if(new TextEncoder().encode(JSON.stringify(value)).length!==bytes)throw Error('Private topology serialized extent');
}
function topologyText(value:unknown,cap:number,allowEmpty=false):string{if(typeof value!=='string'||(!allowEmpty&&value.length===0)||value.length>cap||new TextEncoder().encode(value).length>cap)throw Error('Private topology selected field capacity');return value;}
function bindNativeTrackerA(ports:{scrollCauseAttribution?:true;observeScrollCauseTransport?:(value:NonNullable<TrackerASequencerResult['transport']>)=>void;page():Page|undefined;context():BrowserContext|undefined;deadline:number;publication:NativeMountedTrackerAPublication;check():void;owner:MountedCaseOwner;geometry(purpose?:AnchorPurpose):Promise<GeometrySnapshot>;active():Promise<unknown>;returned():Promise<void>}){
 const clock=nativeClock(ports.deadline),fresh=():PrivateOriginal=>({status:'not-started',requestedHostMs:null,settledHostMs:null,promise:null,value:undefined});
 const baselineOriginal=fresh(),reservationOriginal=fresh(),sessionOriginal=fresh(),sessionCloseRegistration=fresh(),sessionCloseRemoval=fresh(),targetOriginal=fresh(),frameOriginal=fresh(),drainOriginal=fresh();
 let targetDiagnostic:unknown,frameDiagnostic:unknown,session:CDPSession|undefined,sink:TrackerATracePorts['sink']|undefined,trace:ReturnType<typeof createMountedTrackerATrace>|undefined;
 let acquisition:Promise<ReturnType<typeof createMountedTrackerATrace>>|undefined,cleanup:Promise<void>|undefined,cleanupRequested=false,drained=false,pointerMoved=false,scalarCalls=0,entryCalls=0,wheelCalls=0;
 let publicCloseInstalled=false,publicCloseRemoved=false,sessionDidClose=false,completionRemovalAttempted=false,detachAttempted=false,detachOriginal:Promise<void>|undefined;
 let firstSessionCloseMatch:boolean|null=null,consumerAttempted=false,consumerEverBound=false,detachStatus:'not-started'|'pending'|'fulfilled'|'rejected'='not-started',physicalOffOriginal:Promise<void>|undefined;
 let completeCallback:Parameters<TrackerATracePorts['installTracingComplete']>[0]|undefined,closeCallback:Parameters<TrackerATracePorts['installSessionClose']>[0]|undefined;
 let attemptedCloseCallback:Parameters<TrackerATracePorts['installSessionClose']>[0]|undefined;
 let closeResolve!:()=>void;const publicClosed=new Promise<void>(resolve=>{closeResolve=resolve;});
 let detachInvokedResolve!:()=>void;const detachInvoked=new Promise<void>(resolve=>{detachInvokedResolve=resolve;});
 const losses:Record<'navigation'|'context'|'page'|'session',NativeLoss|null>={navigation:null,context:null,page:null,session:null};
 const loss=(name:keyof typeof losses)=>{const first=losses[name];if(first!==null&&first.firstOverflowHostMs!==null)return;const at=performance.now();if(first===null)losses[name]={firstHostMs:at,firstOverflowHostMs:null};else first.firstOverflowHostMs=at;};
 const page=()=>{const p=ports.page();if(!p)throw Error('Original pilot page absent');return p;};
 const context=()=>{const c=ports.context();if(!c)throw Error('Original pilot context absent');return c;};
 const admitted=()=>{ports.check();if(cleanupRequested)throw Error('Original pilot admission closed');};
 function retain(call:()=>Promise<unknown>,fact:PrivateOriginal):Promise<unknown>{
  fact.requestedHostMs=performance.now();fact.status='pending';
  let original:Promise<unknown>;try{original=call();}catch(error){original=Promise.reject(error);}fact.promise=original;
  const observed=original.then(value=>{fact.status='fulfilled';fact.settledHostMs=performance.now();return value;},error=>{fact.status='rejected';fact.settledHostMs=performance.now();throw error;});void observed.catch(()=>{});return observed;
 }
 const completion=(event:Parameters<NonNullable<typeof completeCallback>>[0])=>{completeCallback?.(event);};
 const publicClose=(actual:CDPSession)=>{
  if(!sessionDidClose)firstSessionCloseMatch=actual===session;
  sessionDidClose=true;closeResolve();
  closeCallback?.(actual===session);
  if(!closeCallback||trace?.snapshot().sessionClose.timing!=='expected-detach')loss('session');
 };
 const registrations:{[K in PilotDOMName|'navigation'|'contextClose'|'pageClose']:{installAttempted:boolean;removeAttempted:boolean;installOriginal:Promise<boolean>|undefined;removeOriginal:Promise<boolean>|undefined}}={wheel:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},scroll:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},animationstart:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},transitionrun:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},navigation:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},contextClose:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},pageClose:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined}};
 // Every frame navigation is conservatively invalidating, including child frames.
 let firstNavigation:{frame:Frame;ownedPage:boolean;mainFrame:boolean;parent:Frame|null}|undefined,overflowNavigation:typeof firstNavigation;
 const navigation=(frame:Frame)=>{if(!firstNavigation||!overflowNavigation){const diagnostic={frame,ownedPage:frame.page()===ports.page(),mainFrame:frame===ports.page()?.mainFrame(),parent:frame.parentFrame()};if(!firstNavigation)firstNavigation=diagnostic;else overflowNavigation=diagnostic;}loss('navigation');},contextClose=()=>loss('context'),pageClose=()=>loss('page');
 const detach=():Promise<void>=>{if(detachAttempted)return detachOriginal!;detachAttempted=true;detachStatus='pending';try{if(!session)throw Error('Original session absent');detachOriginal=session.detach();}catch(error){detachOriginal=Promise.reject(error);}void detachOriginal.then(()=>{detachStatus='fulfilled';},()=>{detachStatus='rejected';});detachInvokedResolve();return detachOriginal;};
 const physicalOff=():Promise<void>=>{
  if(publicCloseRemoved)return physicalOffOriginal!;publicCloseRemoved=true;
  physicalOffOriginal=retain(()=>{if(!session)throw Error('Original session absent');session.off('close',publicClose);return Promise.resolve();},sessionCloseRemoval).then(()=>{});
  void physicalOffOriginal.catch(()=>{});return physicalOffOriginal;
 };
 function listener(name:keyof typeof registrations){
  const row=registrations[name];
  return {install():Promise<boolean>{
   if(row.installAttempted)return row.installOriginal??Promise.reject(Error('Original listener install threw'));row.installAttempted=true;
   try{admitted();
    if(name==='navigation'){page().on('framenavigated',navigation);row.installOriginal=Promise.resolve(true);}
    else if(name==='contextClose'){context().on('close',contextClose);row.installOriginal=Promise.resolve(true);}
    else if(name==='pageClose'){page().on('close',pageClose);row.installOriginal=Promise.resolve(true);}
    else row.installOriginal=page().evaluate(name=>{const s=(window as PilotWindow).__copilotkitTrackerA;if(!s)throw Error('Original pilot state absent');return s.install(name);},name);
   }catch(error){row.installOriginal=Promise.reject(error);}void row.installOriginal.catch(()=>{});return row.installOriginal;
  },remove():Promise<boolean>{
   if(row.removeAttempted)return row.removeOriginal??Promise.reject(Error('Original listener removal threw'));row.removeAttempted=true;
   try{
    if(name==='navigation'){page().off('framenavigated',navigation);row.removeOriginal=Promise.resolve(true);}
    else if(name==='contextClose'){context().off('close',contextClose);row.removeOriginal=Promise.resolve(true);}
    else if(name==='pageClose'){page().off('close',pageClose);row.removeOriginal=Promise.resolve(true);}
    else row.removeOriginal=page().evaluate(name=>{const s=(window as PilotWindow).__copilotkitTrackerA;if(!s)throw Error('Original pilot state absent');return s.remove(name);},name);
   }catch(error){row.removeOriginal=Promise.reject(error);}void row.removeOriginal.catch(()=>{});return row.removeOriginal;
  }};
 }
 const listeners={wheel:listener('wheel'),scroll:listener('scroll'),animationstart:listener('animationstart'),transitionrun:listener('transitionrun'),navigation:listener('navigation'),contextClose:listener('contextClose'),pageClose:listener('pageClose')};
 const history:TrackerAHistoryOwner={baseline:undefined,seed:()=>ports.owner.seed(),restore:()=>ports.owner.restore(),listeners,startContinuation:()=>ports.owner.startContinuation(),waitActivePrefix:()=>ports.active(),geometry:purpose=>ports.geometry(purpose),complete:()=>ports.owner.complete(),close:()=>ports.owner.close(),returnToResponse:()=>ports.returned(),
  movePointer(x,y){admitted();if(pointerMoved)throw Error('Original pointer already charged');pointerMoved=true;return page().mouse.move(x,y);},
  entrySample(){
   admitted();if(entryCalls>=3)throw Error('Original entry sample capacity');entryCalls++;
   return page().evaluate(()=>{
    const w=window as PilotWindow,s=w.__copilotkitTrackerA,h=w.__copilotkitBenchHost;if(!s||!h)throw Error('Original entry state absent');
    const scalar=s.scalar(),p=h.readProgress(),selector=h.locators.returnToResponse,controls=selector?document.querySelectorAll<HTMLElement>(selector):[],control=controls[0],box=control?.getBoundingClientRect(),style=control?getComputedStyle(control):null;
    const returnControlVisible=Boolean(controls.length===1&&control?.isConnected&&box&&box.width>0&&box.height>0&&box.bottom>0&&box.top<innerHeight&&box.right>0&&box.left<innerWidth&&style&&style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse'&&Number(style.opacity)>0);
    return {scalar,active:p.loading&&p.delivery==='streaming'&&p.activeMessage!==null&&p.error===null,prefixLength:p.activeMessage?.text.length??0,returnControlVisible};
   });
  },
  scalar(selection,purpose){admitted();if(scalarCalls>=82)throw Error('Original scalar capacity');scalarCalls++;return page().evaluate(readTrackerAAnchorScalarEnvelope,{selection,purpose});},
  wheel(x,y){admitted();if(!pointerMoved||x!==0||wheelCalls>=41||y!==(wheelCalls===0?-600:-12))throw Error('Original pilot wheel denied');wheelCalls++;return page().mouse.wheel(0,y);},
  acquireTrace(){
   if(acquisition)return acquisition;
   acquisition=(async()=>{
    admitted();sink=await retain(()=>ports.publication.reserveTraceSink(),reservationOriginal) as TrackerATracePorts['sink'];admitted();
    const original=retain(()=>context().newCDPSession(page()),sessionOriginal);
    const adopted=original.then(async value=>{const actual=value as CDPSession;session=actual;await retain(()=>{publicCloseInstalled=true;actual.on('close',publicClose);return Promise.resolve();},sessionCloseRegistration);return actual;});
    session=await adopted;
    const actual=session;
    trace=createMountedTrackerATrace({profileRef:ports.publication.profileRef,clock,sink,
     start:async config=>{admitted();if(config!==TRACKER_A_TRACE_CONFIG)throw Error('Original fixed trace config required');await actual.send('Tracing.start',{transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:32768,includedCategories:['cc','benchmark','blink.user_timing','devtools.timeline','disabled-by-default-devtools.timeline']}});},
     end:async()=>{await actual.send('Tracing.end');},read:(handle,size)=>actual.send('IO.read',{handle,size}),closeIO:async handle=>{await actual.send('IO.close',{handle});},detach,
     installTracingComplete(callback){if(completeCallback)throw Error('Original completion listener already installed');completeCallback=callback;actual.on('Tracing.tracingComplete',completion);},
     removeTracingComplete(callback){if(completionRemovalAttempted)throw Error('Original completion removal already attempted');completionRemovalAttempted=true;if(completeCallback!==callback)throw Error('Original completion identity');actual.off('Tracing.tracingComplete',completion);completeCallback=undefined;},
     // This port binds the transport consumer to the one already-owned physical
     // callback. Its ListenerFact times this binding, not the earlier SDK on().
     // Early close is retained privately and refuses binding; it is never replayed.
     installSessionClose(callback){
      if(consumerAttempted)throw Error('Original session consumer already attempted');consumerAttempted=true;attemptedCloseCallback=callback;
      // Preserve the attempted identity BEFORE any admission guard can throw.
      // A rejected registration still belongs to Task1's own removal path.
      admitted();if(sessionDidClose||sessionCloseRegistration.status!=='fulfilled')throw Error('Original session already closed or registered');closeCallback=callback;consumerEverBound=true;
     },
     async removeSessionClose(callback){if(!consumerAttempted||attemptedCloseCallback!==callback)throw Error('Original session callback identity');await physicalOff();closeCallback=undefined;}
    });
    admitted();const target=await retain(()=>actual.send('Target.getTargetInfo'),targetOriginal) as {targetInfo:{targetId:string;type:string;url:string}};boundedPrivateTopology(target);targetOriginal.value=target;
    targetDiagnostic={targetId:topologyText(target.targetInfo.targetId,4096),type:topologyText(target.targetInfo.type,64),url:topologyText(target.targetInfo.url,4096)};
    admitted();const frame=await retain(()=>actual.send('Page.getFrameTree'),frameOriginal) as {frameTree:{frame:{id:string;parentId?:string;loaderId:string;url:string;urlFragment?:string};childFrames?:unknown[]}};boundedPrivateTopology(frame);frameOriginal.value=frame;
    if(frame.frameTree.childFrames!==undefined&&!Array.isArray(frame.frameTree.childFrames))throw Error('Private topology child population');
    const root=frame.frameTree.frame;frameDiagnostic={id:topologyText(root.id,4096),parentId:root.parentId===undefined?null:topologyText(root.parentId,4096),loaderId:topologyText(root.loaderId,4096),url:topologyText(root.url,4096),urlFragment:root.urlFragment===undefined?null:topologyText(root.urlFragment,4096,true),directChildCount:frame.frameTree.childFrames?.length??0};
    admitted();return trace;
   })();void acquisition.catch(()=>{});return acquisition;
  },
  async observations(){
   if(drained)throw Error('Original pilot drain already charged');drained=true;
   const result=await retain(()=>page().evaluate(()=>{const s=(window as PilotWindow).__copilotkitTrackerA;if(!s)throw Error('Original pilot state absent');return s.drain();}),drainOriginal) as ReturnType<PilotPageState['drain']>,receivedHostMs=drainOriginal.settledHostMs!;
   // Refuse oversized/absent transferred populations before native mapping;
   // Task2 independently performs its closed own-data copier and validation.
   if(!result||!Array.isArray(result.wheelEvents)||result.wheelEvents.length>41||!Array.isArray(result.scrollEvents)||result.scrollEvents.length>256||!Array.isArray(result.motionEvents)||result.motionEvents.length>32||!result.overflows)throw Error('Original drain population capacity');
   if((result.overflows.wheel!==null&&result.overflows.wheel.ordinal!==42)||(result.overflows.scroll!==null&&result.overflows.scroll.ordinal!==257)||(result.overflows.motion!==null&&result.overflows.motion.ordinal!==33))throw Error('Original drain overflow capacity');
   return {handlerGates:result.handlerGates,wheelEvents:result.wheelEvents.map(row=>({...row,receivedHostMs})),scrollEvents:result.scrollEvents.map(row=>({...row,receivedHostMs})),motionEvents:result.motionEvents.map(row=>({...row,receivedHostMs})),losses:{navigation:losses.navigation,context:losses.context,page:losses.page,session:losses.session},overflows:{wheel:result.overflows.wheel===null?null:{firstHostMs:receivedHostMs,ordinal:result.overflows.wheel.ordinal},scroll:result.overflows.scroll===null?null:{firstHostMs:receivedHostMs,ordinal:result.overflows.scroll.ordinal},motion:result.overflows.motion===null?null:{firstHostMs:receivedHostMs,ordinal:result.overflows.motion.ordinal}}};
  }
 };
 return {history,async captureBaseline(){
  if(baselineOriginal.status!=='not-started')throw Error('Original baseline already charged');admitted();
  const original=retain(()=>ports.scrollCauseAttribution?page().evaluate(initializeTrackerAPage,{scrollCauseAttribution:true}):page().evaluate(initializeTrackerAPage),baselineOriginal);
  history.baseline=await original;
 },async dispose(){
  cleanupRequested=true;
  if(!cleanup){
   cleanup=(async()=>{
    const failures:unknown[]=[];
    if(baselineOriginal.promise)try{await baselineOriginal.promise;}catch(error){failures.push(error);}
    if(acquisition)try{await acquisition;}catch(error){failures.push(error);}
    if(trace){try{await trace.finish();}catch(error){failures.push(error);}const result=trace.snapshot();if(result.outcome.containment!=='verified'||result.outcome.capture.status!=='complete')failures.push(Error('Original trace containment incomplete'));}
    else if(sink){
     try{await sink.finish();}catch(error){failures.push(error);}
     const fsync=sink.fsync;if(fsync)try{await fsync;}catch(error){failures.push(error);}else failures.push(Error('Original sink fsync absent'));
     const fileClose=sink.fileClose;if(fileClose)try{await fileClose;}catch(error){failures.push(error);}else failures.push(Error('Original sink file close absent'));
    }
    if(session&&!trace){
     // Only sessions never handed to Task1 have native fallback cleanup.
     if(!detachAttempted)detach();
     if(detachOriginal)try{await detachOriginal;}catch(error){failures.push(error);}
     await publicClosed;
     if(publicCloseInstalled)try{await physicalOff();}catch(error){failures.push(error);}
    }else if(session&&trace){
     // A rejected bounded finish waiter does not release Task1 ownership.
     // Observe only already-retained originals; never dispatch an unledgered
     // detach or remove the callback ahead of Task1's pending IO/sink cleanup.
     // The private signal is coordination only, never original outcome evidence.
     // A missing quota-admitted detach leaves this chain pending, not successful.
     if(!consumerAttempted&&!consumerEverBound&&trace.snapshot().listeners.sessionClose.registration.status==='not-started')await detachInvoked;
     if(detachOriginal)try{await detachOriginal;}catch(error){failures.push(error);}
     if(detachAttempted)await publicClosed;
     // Cleanup permanently closed binding/start admission before any await.
     // Only this never-attempted/not-started callback remains native-owned.
     // Detach is already Task1's fulfilled original; this exception is OFF only.
     const registration=trace.snapshot().listeners.sessionClose.registration;
     if(cleanupRequested&&!consumerAttempted&&!consumerEverBound&&registration.status==='not-started'&&detachStatus==='fulfilled'&&firstSessionCloseMatch===true&&publicCloseInstalled){try{await physicalOff();}catch(error){failures.push(error);}}
    }
    for(const name of ['wheel','scroll','animationstart','transitionrun','navigation','contextClose','pageClose'] as const){const row=registrations[name];if(row.installAttempted){try{await listeners[name].remove();}catch(error){failures.push(error);}if(row.installOriginal)try{await row.installOriginal;}catch(error){failures.push(error);}}}
    if(drained&&drainOriginal.promise)try{await drainOriginal.promise;}catch(error){failures.push(error);}
    if(!drained||drainOriginal.status!=='fulfilled')failures.push(Error('Original input drain incomplete'));
    // Keep private originals/diagnostic views alive through final cleanup.
    void targetDiagnostic;void frameDiagnostic;void sessionOriginal;void targetOriginal;void frameOriginal;
    if(ports.scrollCauseAttribution&&trace&&ports.observeScrollCauseTransport)try{ports.observeScrollCauseTransport(trace.snapshot());}catch{/* Diagnostic observation never replaces original cleanup failures. */}
    if(failures.length)throw Error('Original pilot cleanup incomplete',{cause:failures});
   })();void cleanup.catch(()=>{});
  }
  await boundedWait(cleanup,Math.max(0,Math.min(1000,ports.deadline-performance.now())),'Original pilot trace cleanup');
 }};
}
