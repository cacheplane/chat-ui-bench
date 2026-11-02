import {gunzipSync} from 'node:zlib';
import {validateAimockTraceV1} from './aimock-trace-capture-v1.mjs';

const flags={performance:false,scoringEligibility:false,FPS:null,cpuTime:null,presentationCoverage:'unverified'};
const unavailable=reason=>({schema:'aimock-owned-renderer-costs-v1',status:'unavailable',reason,...flags});
const time=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const categories={RunTask:'disabled-by-default-devtools.timeline',Layout:'devtools.timeline',MinorGC:'devtools.timeline,v8'};
/** Diagnostic population: observed complete X events in the whole capture.
 * No task population completeness, CPU, streaming-only window or display claim.
 * Each class stands alone; overlapping/nested durations are never added.
 */
export function projectOwnedRendererCostsV1(trace,binding){
 if(!binding||typeof binding.frameId!=='string'||!binding.frameId||!Number.isSafeInteger(binding.pid)||binding.pid<=0||!Number.isSafeInteger(binding.tid)||binding.tid<=0||!Array.isArray(trace?.traceEvents))return unavailable('aimock-trace-owned-renderer-unavailable');
 const populations={RunTask:{observedCompleteEvents:0,longTaskEvents:0,longest:[]},Layout:{observedCompleteEvents:0,longest:[]},MinorGC:{observedCompleteEvents:0,longest:[]}};
 for(let eventIndex=0;eventIndex<trace.traceEvents.length;eventIndex++){
  const e=trace.traceEvents[eventIndex];if(!e||e.pid!==binding.pid||e.tid!==binding.tid||e.ph!=='X'||!Object.hasOwn(populations,e.name))continue;
  if(e.cat!==categories[e.name])return unavailable('aimock-trace-owned-event-category-unrecognized');
  if(!time(e.ts)||!time(e.dur)||!time(e.ts+e.dur))return unavailable('aimock-trace-owned-event-time-invalid');
  const p=populations[e.name];p.observedCompleteEvents++;if(e.name==='RunTask'&&e.dur>=50000)p.longTaskEvents++;
  p.longest.push({eventIndex,timestampUs:e.ts,durationUs:e.dur});p.longest.sort((a,b)=>b.durationUs-a.durationUs||a.eventIndex-b.eventIndex);if(p.longest.length>8)p.longest.pop();
 }
 if(!populations.RunTask.observedCompleteEvents)return unavailable('aimock-trace-no-owned-complete-tasks');
 return {schema:'aimock-owned-renderer-costs-v1',status:'available',reason:null,scope:'whole-capture-observed-complete-X-events',clock:'trace-timeTicks-microseconds',binding,tasks:populations.RunTask,layouts:populations.Layout,minorGC:populations.MinorGC,limitations:['not-a-complete-task-population','not-a-streaming-only-window','wall-duration-is-not-CPU-time','nested-and-overlapping-classes-not-additive','headless-conformance-is-not-display-presentation'],...flags};
}
/** Called only after capture has sealed; validation owns compressed/hash/EOF,
 * finite decoding and metadata mapping. This projection never grants input.
 */
export function analyzeAimockTraceCostsV1(snapshot){
 const validation=validateAimockTraceV1(snapshot);
 if(validation.status!=='valid'||validation.rendererMapping.status!=='available')return unavailable('aimock-trace-capture-or-binding-unavailable');
 try{
  const decoded=gunzipSync(Buffer.from(snapshot.payloadBase64,'base64'),{maxOutputLength:16777216});
  const trace=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decoded));
  return {...projectOwnedRendererCostsV1(trace,validation.rendererMapping.binding),decodedSha256:validation.decodedSha256};
 }catch{return unavailable('aimock-trace-cost-decode-unavailable');}
}
