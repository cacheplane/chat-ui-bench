import { BodyReader, WireError,isWholeWireBudget, type WireField } from './browser-frame-protobuf-wire.js';
import { decodeBrowserFramePayload, decodeBrowserFramePayloadWithMembers,decodeWholePayload, PAYLOAD_POLICY, type DecodedFragment, type DecodedFragmentWithMembers, type PayloadMember } from './browser-frame-protobuf-fragments.js';
import { canonicalInt32, requireBody, scalar, unique, type ProjectionContext, type PacketOccurrence } from './browser-frame-packet-fragments.js';
import {decodeAnnotation,type AnnotationBody,type AnnotationWork} from './browser-frame-trace-framer.js';

export interface EventFields { categoryIids?: string[]; categories?: string[]; nameIid?: string; name?: string; type?: string; trackUuid?: string }
type ShiftedPayload = Omit<DecodedFragment, 'occurrences' | 'skippedFields'> & { occurrences: PacketOccurrence[]; skippedFields: PacketOccurrence[] };
export interface EventFragment { fields: EventFields; presentFieldNumbers: number[]; reporter2?: ShiftedPayload; graphics?: ShiftedPayload }
export interface AnnotationEventFragment extends EventFragment {annotations:AnnotationBody[]}
export interface LegacyFramePresentedRFragment extends AnnotationEventFragment {
 legacy:{kind:'frame-presented-r';phase:'82';bodyStart:number;bodyEnd:number;phaseStart:number;phaseValueStart:number;phaseEnd:number};
}
export type WholeFramePresentedEventFragment=AnnotationEventFragment|LegacyFramePresentedRFragment;
const FRAME_PRESENTED_SOURCE=Symbol('pinned-frame-presented-r');
export interface EventFragmentWithMembers extends EventFragment {reporter2?:ShiftedPayload&{members:PayloadMember[]};graphics?:ShiftedPayload&{members:PayloadMember[]}}
const SELECTED = new Set([3,22,10,23,9,11,1052,1075]);
const LEGACY = new Set([1,2,6,8,16,17,20]);
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export function decodeModernTrackEvent(context: ProjectionContext, start: number, end: number): EventFragment {
  return decodeTrackEvent(context,start,end,false);
}
export function decodeModernTrackEventWithMembers(context:ProjectionContext,start:number,end:number):EventFragmentWithMembers {
  return decodeTrackEvent(context,start,end,true) as EventFragmentWithMembers;
}
export function decodeAnnotationTrackEvent(context:ProjectionContext,start:number,end:number,work:AnnotationWork):AnnotationEventFragment {return decodeTrackEvent(context,start,end,false,work) as AnnotationEventFragment;}
/** Internal fixed whole-study source form; ordinary decoders never select it. */
export function decodeWholeFramePresentedTrackEvent(context:ProjectionContext,start:number,end:number,work:AnnotationWork):WholeFramePresentedEventFragment{return decodeTrackEvent(context,start,end,false,work,FRAME_PRESENTED_SOURCE) as WholeFramePresentedEventFragment;}
function decodeTrackEvent(context:ProjectionContext,start:number,end:number,retainMembers:boolean,annotationWork?:AnnotationWork,source?:typeof FRAME_PRESENTED_SOURCE):EventFragment {
  const reader = new BodyReader(context.bytes, start, end, context.budget);
  const fields: EventFields = {}; const present = new Set<number>();
  let reporter2: ShiftedPayload | undefined; let graphics: ShiftedPayload | undefined;
  let nameSeen = false; let stringBytes = 0;const annotations:AnnotationBody[]=[];
  let legacy:LegacyFramePresentedRFragment['legacy']|undefined;
  const outer:PacketOccurrence[]|undefined=source===FRAME_PRESENTED_SOURCE?[]:undefined;
  function literal(field: WireField): string {
    requireBody(field);
    const o = field.occurrence; const length = o.end - o.valueStart;
    if (length > 4096) throw new WireError('string-capacity');
    if ((stringBytes += length) > 32768) throw new WireError('string-total-capacity');
    try { return utf8.decode(context.bytes.subarray(o.valueStart, o.end)); }
    catch { throw new WireError('invalid-utf8'); }
  }
  function payload(field: WireField, kind: 'reporter2' | 'graphics'): ShiftedPayload {
    requireBody(field);
    const o = field.occurrence;
    // Delegate is independently bounded; shared charging limits final admission, not transient allocation.
    const fragment = isWholeWireBudget(context.budget)?decodeWholePayload(context.bytes.slice(o.valueStart,o.end),kind):retainMembers?decodeBrowserFramePayloadWithMembers(context.bytes.slice(o.valueStart,o.end),kind):decodeBrowserFramePayload(context.bytes.slice(o.valueStart, o.end), kind, PAYLOAD_POLICY);
    if (fragment.status === 'unavailable') throw new WireError(fragment.diagnostics[0]?.code ?? 'unavailable-typed-payload');
    for (const _occurrence of fragment.occurrences) context.budget.chargeOccurrence();
    for (const _member of fragment.fields.surfaceTraceIds ?? []) context.budget.chargeMember();
    const shift = (at: DecodedFragment['occurrences'][number]): PacketOccurrence => ({ ...at,
      scope: at.scope === 'frame_sink' ? 'frame_sink' : kind,
      start: at.start + o.valueStart, valueStart: at.valueStart + o.valueStart, end: at.end + o.valueStart });
    const occurrences = fragment.occurrences.map(shift); const skippedFields = fragment.skippedFields.map(shift);
    context.occurrences.push(...occurrences); context.skippedFields.push(...skippedFields);
    return { ...fragment, occurrences, skippedFields,...(retainMembers?{members:(fragment as DecodedFragmentWithMembers).members.map(m=>({...m,start:m.start+o.valueStart,valueStart:m.valueStart+o.valueStart,end:m.end+o.valueStart}))}:{}) };
  }
  while (!reader.complete) {
    const field = reader.next('root'); const o: PacketOccurrence = { ...field.occurrence, scope: 'track_event' };
    context.occurrences.push(o);
    outer?.push(o);
    if(source===FRAME_PRESENTED_SOURCE&&o.fieldNumber===6){
      if(legacy)throw new WireError('unsupported-legacy-event');requireBody(field);
      const nested=new BodyReader(context.bytes,o.valueStart,o.end,context.budget);
      if(nested.complete)throw new WireError('unsupported-legacy-event');
      const phase=nested.next('root'),at=phase.occurrence;
      context.occurrences.push({...at,scope:'legacy_event'});annotationWork!(1);
      if(at.fieldNumber!==2||at.wireType!==0||phase.scalar!==82n||!nested.complete||o.end-o.valueStart!==2||context.bytes[o.valueStart]!==16||context.bytes[o.valueStart+1]!==82)throw new WireError('unsupported-legacy-event');
      legacy={kind:'frame-presented-r',phase:'82',bodyStart:o.valueStart,bodyEnd:o.end,phaseStart:at.start,phaseValueStart:at.valueStart,phaseEnd:at.end};present.add(6);continue;
    }
    if(annotationWork&&o.fieldNumber===4){requireBody(field);annotations.push(decodeAnnotation(context,o.valueStart,o.end,literal,annotationWork));present.add(4);continue;}
    if (LEGACY.has(o.fieldNumber)) throw new WireError('unsupported-legacy-event');
    if (!SELECTED.has(o.fieldNumber)) { context.skippedFields.push({ ...o }); continue; }
    if (o.fieldNumber === 10 || o.fieldNumber === 23) {
      if (nameSeen) {
        if (present.has(o.fieldNumber)) throw new WireError('duplicate-selected-field');
        throw new WireError('duplicate-name-oneof');
      }
      nameSeen = true;
    }
    if (o.fieldNumber === 3 || o.fieldNumber === 22) present.add(o.fieldNumber);
    else unique(present, o.fieldNumber);
    switch (o.fieldNumber) {
      case 3: {
        fields.categoryIids ??= [];
        if (o.wireType === 0) { context.budget.chargeMember(); fields.categoryIids.push(scalar(field).toString()); }
        else {
          requireBody(field);
          const packed = new BodyReader(context.bytes, o.valueStart, o.end, context.budget);
          while (!packed.complete) { context.budget.chargeMember(); fields.categoryIids.push(packed.varint().toString()); }
        }
        break;
      }
      case 22: context.budget.chargeMember(); (fields.categories ??= []).push(literal(field)); break;
      case 10: fields.nameIid = scalar(field).toString(); break;
      case 23: fields.name = literal(field); break;
      case 9: fields.type = canonicalInt32(field); break;
      case 11: fields.trackUuid = scalar(field).toString(); break;
      case 1052: graphics = payload(field, 'graphics'); break;
      case 1075: reporter2 = payload(field, 'reporter2'); break;
    }
  }
  if(legacy){
    const counts=new Map<number,number>();for(const at of outer!)counts.set(at.fieldNumber,(counts.get(at.fieldNumber)??0)+1);
    if(outer!.length!==6||counts.size!==5||counts.get(3)!==2||counts.get(10)!==1||counts.get(11)!==1||counts.get(4)!==1||counts.get(6)!==1||fields.type!==undefined||fields.trackUuid!=='0'||outer!.some(at=>at.fieldNumber===3&&at.wireType!==0))throw new WireError('unsupported-legacy-event');
    const annotation=annotations[0]!;
    const children=context.occurrences.filter(at=>at.start>=annotation.location.start&&at.end<=annotation.location.end);
    if(children.length!==2||children.filter(at=>at.fieldNumber===1&&at.wireType===0).length!==1||children.filter(at=>at.fieldNumber===6&&at.wireType===2).length!==1||annotation.nameIid===undefined||annotation.stringValue===undefined||annotation.unsupported)throw new WireError('unsupported-legacy-event');
  }
  return { fields, presentFieldNumbers: [...present].sort((a,b) => a-b),...(annotationWork?{annotations}:{}),...(legacy?{legacy}:{}),
    ...(reporter2 === undefined ? {} : { reporter2 }), ...(graphics === undefined ? {} : { graphics }) };
}
