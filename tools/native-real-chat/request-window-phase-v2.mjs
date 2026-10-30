// Explicit post-capture phase projection. V6 remains a separate, unchanged policy.
import fs from 'node:fs';
import path from 'node:path';
import {types} from 'node:util';
import {readOwnedPaintTraceV12} from '../../packages/analyzer/dist/browser-frame-owned-paint-v12-reader.js';
import {OWNED_PAINT_V12_POLICY} from '../../packages/analyzer/dist/browser-frame-owned-paint-v12.js';

export const REQUEST_WINDOW_PHASE_V2_POLICY='source-owned-request-window-phase-inventory-diagnostic-v2';
const AUTHORITY=Object.freeze({captureQualified:false,qualification:false,nativeSupported:false,clockAdmission:'not_evaluated',targetLifetime:'unestablished',population:'not_evaluated',FPS:null,duration:null,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false});
const REASONS=['invalid-input','input-reference-unavailable','reader-unavailable','whole-input-unavailable','file-identity-unavailable','root-inventory-withheld','state-loss-observed','candidate-capacity','duplicate-start','duplicate-end','foreign-selected-prefix','missing-start','missing-end','wire-order-unavailable','result-capacity','internal-unavailable'];
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
const failure=(reason,wholeInputFailure=null)=>freeze({policy:REQUEST_WINDOW_PHASE_V2_POLICY,readerPolicy:OWNED_PAINT_V12_POLICY,status:'unavailable',reason,rows:[],wholeInputFailure,authority:AUTHORITY});
const FAILURES=new Map(REASONS.map(reason=>[reason,failure(reason)]));
class Refusal extends Error{constructor(reason){super(reason);this.reason=reason;}}
const requireGate=(condition,reason)=>{if(!condition)throw new Refusal(reason);};
function own(value,key){requireGate(value&&typeof value==='object'&&!types.isProxy(value),'invalid-input');const d=Object.getOwnPropertyDescriptor(value,key);requireGate(d&&Object.hasOwn(d,'value'),'invalid-input');return d.value;}
function closed(value,keys){requireGate(value&&typeof value==='object'&&!types.isProxy(value)&&Object.getPrototypeOf(value)===Object.prototype,'invalid-input');requireGate(Reflect.ownKeys(value).length===keys.length,'invalid-input');const copy={};for(const key of keys)copy[key]=own(value,key);return copy;}
const integer=(value,max,min=0)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uint=value=>typeof value==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(value)&&(value.length<20||value<='18446744073709551615');
function admit(fact,names){
 const input=closed(fact,['path','bytes','sha256','identity']);input.identity=closed(input.identity,['dev','ino','size','mtimeMs','ctimeMs']);
 requireGate(typeof input.path==='string'&&input.path.length<=4096&&Buffer.byteLength(input.path)<=4096&&!input.path.includes('\0')&&path.isAbsolute(input.path)&&path.resolve(input.path)===input.path&&integer(input.bytes,33554432)&&hash(input.sha256),'invalid-input');
 for(const key of ['dev','ino','size'])requireGate(integer(input.identity[key],Number.MAX_SAFE_INTEGER),'invalid-input');
 for(const key of ['mtimeMs','ctimeMs'])requireGate(Number.isFinite(input.identity[key])&&input.identity[key]>=0,'invalid-input');
 requireGate(input.identity.size===input.bytes,'invalid-input');
 const selected=closed(names,['runId','phaseId','targetId','start','end']);
 for(const key of ['runId','phaseId'])requireGate(typeof selected[key]==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(selected[key]),'invalid-input');
 requireGate(typeof selected.targetId==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(selected.targetId),'invalid-input');
 const prefix='native:'+selected.runId+':'+selected.phaseId+':';
 for(const phase of ['start','end']){const name=selected[phase],head=prefix+phase+':';requireGate(typeof name==='string'&&name.length<=128&&name.startsWith(head)&&/^[a-f0-9]{16}$/.test(name.slice(head.length)),'invalid-input');}
 return{input,selected,prefix};
}
function numericIdentity(stat,expected){return stat.isFile()&&stat.nlink===1&&['dev','ino','size','mtimeMs','ctimeMs'].every(key=>stat[key]===expected[key]);}
const fullIdentity=stat=>[stat.dev,stat.ino,stat.mode,stat.nlink,stat.size,stat.mtimeNs,stat.ctimeNs].map(String);
const sameIdentity=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===7&&b.length===7&&a.every((value,i)=>value===b[i]);
function bounded(value){let nodes=0,objects=0,strings=0;function visit(v,depth){requireGate(++nodes<=256&&depth<=6,'result-capacity');if(typeof v==='string')strings+=Buffer.byteLength(v);else if(v&&typeof v==='object'){requireGate(++objects<=16,'result-capacity');for(const[key,x]of Object.entries(v)){if(!Array.isArray(v))strings+=Buffer.byteLength(key);visit(x,depth+1);}}requireGate(strings<=4096,'result-capacity');}visit(value,0);requireGate(Buffer.byteLength(JSON.stringify(value))<=8192,'result-capacity');return freeze(value);}
function wholeFailure(whole){
 const code=value=>typeof value==='string'&&value.length<=128&&/^[A-Za-z0-9._:-]+$/.test(value)?value:'unavailable-code';
 const reader=whole.reader,s=whole.study,d=s?.diagnostics?.[0];
 return bounded(failure('whole-input-unavailable',{reason:code(whole.reason),reader:{EOF:reader.EOF===true,closed:reader.closed===true,identityMatch:reader.identityMatch===true,hashMatch:reader.hashMatch===true,fullInputVerified:whole.fullInputVerified===true,structuralContainerEOF:whole.structuralContainerEOF===true,bytes:integer(reader.bytes,33554433)?reader.bytes:0,reads:integer(reader.reads,4096)?reader.reads:0},study:s?{status:s.status==='complete-owned-selected-schema'?'complete-owned-selected-schema':'unavailable',packets:s.counters.packets,decodedPackets:s.counters.decodedPackets,processedPackets:s.counters.processedPackets}:null,firstSemanticDiagnostic:d?{code:code(d.code),phase:code(d.phase),packetIndex:integer(d.packetIndex,131071)?d.packetIndex:null,component:d.component===null?null:code(d.component),cause:d.cause===null?null:code(d.cause)}:null}));
}
function wholeAdmission(whole,input){
 const r=whole.reader,s=whole.study;
 requireGate(whole.policy===OWNED_PAINT_V12_POLICY&&whole.status==='complete-owned-whole-diagnostic'&&whole.reason===null&&whole.fullInputVerified&&whole.structuralContainerEOF&&r.EOF&&r.closed&&r.identityMatch&&r.hashMatch&&r.bytes===input.bytes&&r.sha256===input.sha256&&s&&s.policy===OWNED_PAINT_V12_POLICY&&s.status==='complete-owned-selected-schema'&&s.reason===null&&s.framingBoundaryComplete&&s.semanticProcessing==='complete-supported-schema'&&s.inputRef.bytes===input.bytes&&s.inputRef.sha256===input.sha256&&s.usage.coverage==='complete'&&whole.usage.coverage==='complete'&&s.diagnostics.length===0,'whole-input-unavailable');
 requireGate(integer(s.counters.packets,131072)&&s.counters.packets===s.counters.decodedPackets&&s.counters.packets===s.counters.processedPackets,'whole-input-unavailable');
 requireGate(s.evidence.status==='complete-supported-compact-observations'&&s.evidence.codec===2&&s.evidence.domain==='owned-paint-clock-layout-v12'&&s.evidence.facts.length===s.counters.metadataFacts&&s.evidence.occurrences.length===s.counters.metadataOccurrences,'whole-input-unavailable');
 requireGate(s.markInventoryAdmission==='resolved-supported-source-roots'&&s.counters.ordinaryWithheldRootInventories===0&&s.counters.markWithheld===0,'root-inventory-withheld');
 requireGate(s.sequenceStart.unexplained===0&&s.sequenceStart.contradictions===0&&s.sequenceStart.raw===s.sequenceStart.explained+s.sequenceStart.unexplained&&s.counters.firstContradictions===0&&s.rawDrop.status==='complete-supported-header-declarations'&&s.rawDrop.facts.length===s.counters.rawDropDeclarations&&s.counters.unexplainedRawDropDeclarations===0&&s.counters.explainedRawDropDeclarations===s.rawDrop.facts.length,'state-loss-observed');
 for(const drop of s.rawDrop.facts)requireGate(drop.classification==='explained'&&drop.priorSeen===false&&drop.headers.previousPacketDropped==='1'&&drop.headers.firstPacketOnSequence===true,'state-loss-observed');
 for(const key of ['packetSHA256','transitionSHA256','definitionSHA256','metadataSHA256','paintSHA256'])requireGate(hash(s.manifests[key]),'whole-input-unavailable');
 requireGate(Object.keys(s.manifests).length===5,'whole-input-unavailable');return s;
}
function row(candidate,phase,name,study,input){
 const c=candidate,source=c.source,at=c.eventLocation,sequence=study.state.sequences[c.sequenceIndex];
 requireGate(integer(source.packetIndex,study.counters.packets-1)&&integer(source.rootBodyStart,input.bytes)&&integer(source.packetBytes,262144)&&source.rootBodyStart+source.packetBytes<=input.bytes&&hash(source.packetSHA256)&&at.packetIndex===source.packetIndex&&integer(at.start,source.packetBytes)&&integer(at.valueStart,source.packetBytes)&&integer(at.end,source.packetBytes)&&at.start<at.valueStart&&at.valueStart<=at.end&&at.fieldNumber===11&&at.wireType===2,'whole-input-unavailable');
 requireGate(sequence&&sequence.sequenceId===c.sequenceId&&sequence.machine.status===c.machine.status&&sequence.machine.id===c.machine.id&&integer(c.epoch,sequence.epoch)&&uint(c.sequenceId)&&c.sequenceId!=='0'&&(c.representation==='annotation'||c.representation==='event_name')&&(c.nameSource==='literal'||c.nameSource==='intern'),'whole-input-unavailable');
 requireGate(c.machine.status==='absent'?c.machine.id===null:c.machine.status==='present'&&uint(c.machine.id),'whole-input-unavailable');
 requireGate(c.timestampStatus==='absent'?c.rawTimestamp===null:c.timestampStatus==='raw-unqualified'&&uint(c.rawTimestamp),'whole-input-unavailable');
 if(c.representation==='event_name')requireGate(c.annotationIndex===null,'whole-input-unavailable');else requireGate(integer(c.annotationIndex,4096),'whole-input-unavailable');
 if(c.definitionIndex===null)requireGate(c.nameSource==='literal','whole-input-unavailable');else{const d=study.state.definitions[c.definitionIndex];requireGate(integer(c.definitionIndex,8191)&&c.nameSource==='intern'&&d&&d.sequenceIndex===c.sequenceIndex&&d.epoch===c.epoch&&d.sequenceId===c.sequenceId&&d.machine.status===c.machine.status&&d.machine.id===c.machine.id&&d.table===(c.representation==='event_name'?'event_names':'debug_annotation_names')&&d.source.packetIndex<=source.packetIndex,'whole-input-unavailable');}
 for(const [kind,allowed]of [['clock',['packet','defaults']],['track',['event','defaults']]]){const chosen=c[kind];if(chosen.status==='selected'){requireGate(allowed.includes(chosen.source)&&uint(chosen.value),'whole-input-unavailable');if(chosen.source==='defaults'){const d=study.state.defaults[chosen.defaultsVersionIndex];requireGate(d&&d.sequenceIndex===c.sequenceIndex&&d.epoch===c.epoch&&chosen.defaultsVersionIndex===c.defaultsVersionIndex&&d.source.packetIndex<=source.packetIndex&&(kind==='clock'?d.timestampClockId:d.trackUuid)===chosen.value,'whole-input-unavailable');}}else requireGate(chosen.status==='unavailable'&&chosen.source===null&&chosen.value===null,'whole-input-unavailable');}
 return{phase,name,packetIndex:source.packetIndex,sequenceIndex:c.sequenceIndex,intervalVersion:c.epoch,eventStart:at.start,eventValueStart:at.valueStart,eventEnd:at.end,bodySHA256:source.packetSHA256,annotationIndex:c.annotationIndex,definitionIndex:c.definitionIndex,nameSource:c.nameSource,clockId:c.clock.status==='selected'?c.clock.value:null,clockSource:c.clock.status==='selected'?c.clock.source:'unavailable',trackUuid:c.track.status==='selected'?c.track.value:null,trackSource:c.track.status==='selected'?c.track.source:'unavailable',machineStatus:c.machine.status,machineId:c.machine.id,sequenceId:c.sequenceId,rawTimestamp:c.rawTimestamp,timestampStatus:c.timestampStatus,representation:c.representation};
}
/** Caller DTOs establish no capture origin. The supervisor binds this result to
 * its actual original capture and separately owned reader process completion. */
export function readRequestWindowPhaseV2(traceFact,names){
 let fd,whole,result=FAILURES.get('internal-unavailable');
 try{
  const{input,selected,prefix}=admit(traceFact,names);
  fd=fs.openSync(input.path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  requireGate(numericIdentity(fs.fstatSync(fd),input.identity),'file-identity-unavailable');const before=fullIdentity(fs.fstatSync(fd,{bigint:true}));
  try{whole=readOwnedPaintTraceV12(JSON.stringify({path:input.path,bytes:input.bytes,sha256:input.sha256}),OWNED_PAINT_V12_POLICY);}catch{throw new Refusal('reader-unavailable');}
  requireGate(numericIdentity(fs.fstatSync(fd),input.identity)&&numericIdentity(fs.lstatSync(input.path),input.identity)&&sameIdentity(before,fullIdentity(fs.fstatSync(fd,{bigint:true})))&&sameIdentity(before,whole.reader.before)&&sameIdentity(before,whole.reader.after),'file-identity-unavailable');
  const s=wholeAdmission(whole,input);requireGate(s.candidates.length<=128,'candidate-capacity');let start,end,outsidePrefix=0;
  for(const c of s.candidates){requireGate(c.kind==='literal_string'&&typeof c.value==='string','root-inventory-withheld');if(c.value===selected.start){requireGate(!start,'duplicate-start');start=c;}else if(c.value===selected.end){requireGate(!end,'duplicate-end');end=c;}else if(c.value.startsWith(prefix))throw new Refusal('foreign-selected-prefix');else outsidePrefix++;}
  requireGate(start,'missing-start');requireGate(end,'missing-end');requireGate(start.source.packetIndex<end.source.packetIndex,'wire-order-unavailable');
  result=bounded({policy:REQUEST_WINDOW_PHASE_V2_POLICY,readerPolicy:OWNED_PAINT_V12_POLICY,status:'phase-registry-inventory-diagnostic',reason:null,runId:selected.runId,phaseId:selected.phaseId,targetId:selected.targetId,input:{bytes:input.bytes,sha256:input.sha256,packetManifestSHA256:s.manifests.packetSHA256,transitionManifestSHA256:s.manifests.transitionSHA256},manifests:{domain:'owned-paint-clock-layout-v12',...s.manifests},counters:{candidates:s.candidates.length,outsidePrefix,readAttempts:whole.reader.reads,packets:s.counters.packets,decodedPackets:s.counters.decodedPackets,processedPackets:s.counters.processedPackets,disclosures:s.counters.disclosures,metadataFacts:s.counters.metadataFacts,metadataOccurrences:s.counters.metadataOccurrences},rows:[row(start,'start',selected.start,s,input),row(end,'end',selected.end,s,input)],wholeInputFailure:null,authority:AUTHORITY});
 }catch(error){const reason=error instanceof Refusal&&FAILURES.has(error.reason)?error.reason:'internal-unavailable';try{result=reason==='whole-input-unavailable'&&whole?wholeFailure(whole):FAILURES.get(reason);}catch{result=FAILURES.get('result-capacity');}}
 finally{whole=null;if(fd!==undefined)try{fs.closeSync(fd);}catch{result=FAILURES.get('file-identity-unavailable');}}
 return result;
}
