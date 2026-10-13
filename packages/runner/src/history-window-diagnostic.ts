import {z} from 'zod';
import {createComparisonBuffer,COMPARISON_CAPTURE_LIMITS,comparisonSchemasForVersionPair,comparisonDeadlineSchema,runtimeProgressSchema,type ComparisonPrimitiveToken,type ComparisonDeadline} from '@chat-ui-bench/contract';

export const HISTORY_WINDOW_EXPERIMENT='history-window-diagnostic-v1' as const;
export type HistoryOwner={id:string;role:'user'|'assistant';hostElement:object;contentElement:object|null};
const limits=COMPARISON_CAPTURE_LIMITS;
const id=z.string().min(1).max(limits.maxDiagnosticFieldCodeUnits);
const reason=z.string().min(1).max(limits.maxDiagnosticMessageCodeUnits);
const timestamp=z.number().finite().nonnegative();
const absent=z.strictObject({status:z.literal('unavailable'),reason});
const role=z.enum(['before','post','later']);
const candidate=z.strictObject({id,role:z.enum(['user','assistant'])});
const candidatesSchema=z.union([absent,z.strictObject({status:z.literal('available'),complete:z.boolean(),count:z.number().int().min(0).max(64),ordered:z.array(candidate).max(64)}).refine(v=>v.count===v.ordered.length,'Original candidate count differs')]);
const activeProgress=z.union([absent,z.strictObject({status:z.literal('available'),id,role:z.literal('assistant'),delivery:z.enum(['streaming','complete']),textCodeUnits:z.number().int().nonnegative().max(limits.maxRuntimeCodeUnits),textUtf8Bytes:z.number().int().nonnegative().max(limits.maxRuntimeUtf8Bytes)})]);
const progressSchema=z.union([absent.extend({observedAtPageMs:timestamp}),z.strictObject({status:z.literal('available'),observedAtPageMs:timestamp,active:activeProgress,delivery:z.enum(['idle','streaming','complete','aborted','error']),outcome:z.enum(['success','error','aborted']).nullable(),loading:z.boolean(),error:z.string().max(limits.maxDiagnosticFieldCodeUnits).nullable(),sequence:absent})]);
const family=comparisonSchemasForVersionPair({collectorVersion:'2.1.0',analyzerVersion:'2.1.0'});
const scrollSchema=z.union([absent,z.strictObject({status:z.literal('available'),value:family.comparisonCheckpointsSchema.shape.scroll.element})]);
/** Private record only: never a canonical checkpoint or complete companion. */
export const historyWindowRecordSchema=z.strictObject({format:z.literal(HISTORY_WINDOW_EXPERIMENT),unscored:z.literal(true),scoringEligibility:z.literal(false),notCanonicalComparisonResult:z.literal(true),collectorVersion:z.literal('2.1.0'),analyzerVersion:z.literal('2.1.0'),role,requestOrdinal:z.number().int().min(0).max(2),pageTimestampMs:timestamp.nullable(),phaseInstanceId:id.nullable(),request:z.strictObject({status:z.enum(['available','unavailable']),reason:reason.nullable()}),scroll:scrollSchema,candidates:candidatesSchema,progress:progressSchema}).superRefine((v,ctx)=>{
  if(v.requestOrdinal!==(['before','post','later'] as const).indexOf(v.role))ctx.addIssue({code:'custom',message:'Original request role and ordinal differ'});
  if(v.request.status==='available'&&(v.request.reason!==null||v.pageTimestampMs===null)||v.request.status==='unavailable'&&v.request.reason===null)ctx.addIssue({code:'custom',message:'Original request availability differs'});
  if(v.scroll.status==='available'){
    if(v.scroll.value.timestampMs!==v.pageTimestampMs)ctx.addIssue({code:'custom',message:'Original scroll timestamp differs'});
    const s=v.scroll.value;
    if(s.anchorGeometry.status==='available'&&s.anchorTopCssPx!==s.anchorGeometry.value.hostRect.top-s.anchorGeometry.value.scrollerRect.top)ctx.addIssue({code:'custom',message:'Original anchor offset differs from admitted rectangles'});
    if(s.anchorId!==null&&s.anchorId.length>limits.maxDiagnosticFieldCodeUnits)ctx.addIssue({code:'custom',message:'Original anchor ID exceeds limit'});
    for(const g of [s.geometry,s.anchorGeometry])if(g.status==='available'&&g.value.messageId.length>limits.maxDiagnosticFieldCodeUnits)ctx.addIssue({code:'custom',message:'Original geometry ID exceeds limit'});
  }
});
export type HistoryWindowRecord=z.output<typeof historyWindowRecordSchema>;

/** Input is the already admitted original candidate array; no DOM operation. */
export function projectHistoryCandidates(values:readonly HistoryOwner[],complete:boolean){
  if(values.length>limits.maxHistoricalCandidates)throw Error('Original candidate limit exceeded before projection');
  return candidatesSchema.parse({status:'available',complete,count:values.length,ordered:values.map(v=>({id:v.id,role:v.role}))});
}
function utf8Length(value:string,max:number):number {
  let bytes=0;
  for(let i=0;i<value.length;i++){
    const c=value.charCodeAt(i);if(c<128)bytes++;else if(c<2048)bytes+=2;else if(c>=0xd800&&c<=0xdbff&&value.charCodeAt(i+1)>=0xdc00&&value.charCodeAt(i+1)<=0xdfff){bytes+=4;i++;}else bytes+=3;
    if(bytes>max)throw Error('Original runtime UTF8 limit exceeded');
  }return bytes;
}
/** One previously acquired public result; never calls the bridge or retains text. */
export function projectHistoryProgress(input:unknown,observedAtPageMs:number):z.output<typeof progressSchema>{
  timestamp.parse(observedAtPageMs);
  const value=z.union([absent,z.strictObject({status:z.literal('available'),value:runtimeProgressSchema})]).parse(input);
  if(value.status==='unavailable')return {status:'unavailable',reason:value.reason,observedAtPageMs};
  const p=value.value,m=p.activeMessage;
  if(m&&(m.text.length>limits.maxRuntimeCodeUnits||m.id.length>limits.maxDiagnosticFieldCodeUnits))throw Error('Original runtime code-unit limit exceeded');
  const active=m?{status:'available' as const,id:m.id,role:m.role,delivery:m.status,textCodeUnits:m.text.length,textUtf8Bytes:utf8Length(m.text,limits.maxRuntimeUtf8Bytes)}:{status:'unavailable' as const,reason:'No active streaming message'};
  return progressSchema.parse({status:'available',observedAtPageMs,active,delivery:p.delivery,outcome:p.outcome,loading:p.loading,error:p.error,sequence:{status:'unavailable',reason:'Public capture API does not supply sequence'}});
}
export type HistoryOffset={status:'same-owner-offset-observed'|'unavailable';ownerRelation:'same-original-owner'|'changed-owner'|'not-in-admitted-candidates'|'anchor-not-acquired'|'unavailable';signedOffsetCssPx:number|null;absoluteOffsetCssPx:number|null};
/** Original refs stay private. No connectedness, containment or layout acquisition. */
export function classifyHistoryOffset(post:HistoryWindowRecord,later:HistoryWindowRecord,owner:HistoryOwner|null,actualLaterCandidates:readonly HistoryOwner[]):HistoryOffset{
  const unavailable=(ownerRelation:HistoryOffset['ownerRelation']='unavailable'):HistoryOffset=>({status:'unavailable',ownerRelation,signedOffsetCssPx:null,absoluteOffsetCssPx:null});
  if(post.role!=='post'||later.role!=='later'||post.request.status!=='available'||later.request.status!=='available')return unavailable();
  if(post.scroll.status!=='available')return unavailable();
  if(post.scroll.value.anchorId===null)return unavailable('anchor-not-acquired');
  if(owner===null)return unavailable();
  if(post.candidates.status!=='available'||!post.candidates.complete||later.candidates.status!=='available'||!later.candidates.complete||actualLaterCandidates.length>64)return unavailable();
  const p=post.scroll.value;if(owner.id!==p.anchorId||owner.contentElement===null)return unavailable();
  if(!post.candidates.ordered.some(v=>v.id===owner.id&&v.role===owner.role)||later.candidates.count!==actualLaterCandidates.length||later.candidates.ordered.some((v,i)=>v.id!==actualLaterCandidates[i]?.id||v.role!==actualLaterCandidates[i]?.role))return unavailable();
  const match=actualLaterCandidates.find(v=>v.id===owner.id&&v.role===owner.role);
  if(!match)return unavailable('not-in-admitted-candidates');
  if(match.hostElement!==owner.hostElement||match.contentElement!==owner.contentElement)return unavailable('changed-owner');
  if(later.scroll.status!=='available')return unavailable();const l=later.scroll.value;
  if(p.anchorGeometry.status!=='available'||l.anchorGeometry.status!=='available'||l.anchorId!==p.anchorId||p.anchorGeometry.value.messageId!==owner.id||l.anchorGeometry.value.messageId!==owner.id||p.anchorGeometry.value.role!==owner.role||l.anchorGeometry.value.role!==owner.role)return unavailable();
  if(post.phaseInstanceId===null||post.phaseInstanceId!==later.phaseInstanceId||post.pageTimestampMs===null||later.pageTimestampMs===null||!Number.isFinite(later.pageTimestampMs-post.pageTimestampMs)||later.pageTimestampMs-post.pageTimestampMs<800||p.anchorTopCssPx===null||l.anchorTopCssPx===null)return unavailable();
  const signedOffsetCssPx=l.anchorTopCssPx-p.anchorTopCssPx;if(!Number.isFinite(signedOffsetCssPx))return unavailable();
  return {status:'same-owner-offset-observed',ownerRelation:'same-original-owner',signedOffsetCssPx,absoluteOffsetCssPx:Math.abs(signedOffsetCssPx)};
}
/** The genuine original primitive grammar preflights before graph materialization. */
export function admitHistoryTokens(tokens:readonly ComparisonPrimitiveToken[]):string{
  if(tokens.length>limits.maxRecordTokens)throw Error('Record token limit exceeded');
  const queue=createComparisonBuffer('page-observations');
  if(!Reflect.apply(queue.enqueue,queue,tokens))throw Error(queue.state().reason??'Diagnostic primitive admission unavailable');
  const value=(queue.drain as (size:number)=>string[])(1)[0];if(value===undefined)throw Error('Diagnostic primitive admission produced no record');return value;
}
/** Bounded records only; admitting snapshots never establishes final ownership. */
export function createHistoryDiagnosticRecords(mode:unknown,collector:unknown,analyzer:unknown){
  if(typeof mode!=='string'||mode!=='none'&&mode!==HISTORY_WINDOW_EXPERIMENT)throw Error('Unsupported diagnostic mode');
  if(mode==='none')return null;
  if(collector!=='2.1.0'||analyzer!=='2.1.0')throw Error('Diagnostic requires explicit matched2.1 family');
  const records:string[]=[],errors:unknown[]=[];let rejected=false,transferred=false,bytes=0,omittedFailures=0;
  const revoke=(error:unknown)=>{rejected=true;if(errors.length<32)errors.push(error);else omittedFailures++;};
  return {
    record(tokens:readonly ComparisonPrimitiveToken[]):boolean{
      if(transferred||rejected||records.length===3){revoke(Error('Diagnostic record capacity or lifetime unavailable'));return false;}
      try{
        const serialized=admitHistoryTokens(tokens),value=historyWindowRecordSchema.parse(JSON.parse(serialized));
        if(value.requestOrdinal!==records.length)throw Error('Diagnostic original role order differs');
        const size=Buffer.byteLength(serialized,'utf8');if(size>3*limits.maxRecordSerializedBytes-bytes)throw Error('Diagnostic snapshot byte capacity exceeded');
        records.push(serialized);bytes+=size;return true;
      }catch(error){revoke(error);return false;}
    },
    take(){if(transferred)throw Error('Diagnostic transfer can occur once');transferred=true;return {status:!rejected&&records.length===3?'snapshots-admitted' as const:'unavailable' as const,records:Object.freeze(records.slice()),finalOwnershipVerified:false as const,scoringEligibility:false as const};},
    state(){return {records:records.length,serializedBytes:bytes,rejected,transferred,omittedFailures};},
    revoke,originalFailures:()=>Object.freeze(errors.slice()),
  };
}
/** Same supplied host clock, actual recorded absolute deadline; no timer or lease. */
export function createOriginalDisposalGuard(input:ComparisonDeadline,now:()=>number){
  const deadline=comparisonDeadlineSchema.parse(input);
  if(deadline.stage!=='disposal'||deadline.budgetMs!==10000)throw Error('Original disposal deadline required');
  let last=deadline.finishedAtHostMs??deadline.startedAtHostMs;
  const read=()=>{const value=now();if(!Number.isFinite(value)||value<last)throw Error('Original disposal host clock unavailable');last=value;return value;};
  return {remainingMs:()=>Math.max(0,deadline.deadlineAtHostMs-read()),assertRemaining(){if(read()>=deadline.deadlineAtHostMs)throw Error('Original disposal deadline exhausted');}};
}
