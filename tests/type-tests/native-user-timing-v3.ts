import {createWholeAnnotationStudy,createWholeUserTimingStudy,createWholeUserTimingStudyV3,type ClosedStudyFailureCode} from '../../packages/analyzer/dist/browser-frame-ordered-state.js';
import {readWholeAnnotationTrace,readWholeUserTimingTrace,readWholeUserTimingTraceV3} from '../../packages/analyzer/dist/browser-frame-whole-trace-reader.js';

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
type DiagnosticKeys='code'|'packetIndex'|'component';
type AnnotationStudy=ReturnType<ReturnType<typeof createWholeAnnotationStudy>['finish']>;
type TimingStudy=ReturnType<ReturnType<typeof createWholeUserTimingStudy>['finish']>;
type TimingStudyV3=ReturnType<ReturnType<typeof createWholeUserTimingStudyV3>['finish']>;
type AnnotationTraceStudy=NonNullable<ReturnType<typeof readWholeAnnotationTrace>['study']>;
type TimingTraceStudy=NonNullable<ReturnType<typeof readWholeUserTimingTrace>['study']>;
type TimingTraceStudyV3=NonNullable<ReturnType<typeof readWholeUserTimingTraceV3>['study']>;
type LegacyAnnotationKeys=Assert<Equal<keyof AnnotationStudy['diagnostics'][number],DiagnosticKeys>>;
type LegacyTimingKeys=Assert<Equal<keyof TimingStudy['diagnostics'][number],DiagnosticKeys>>;
type LegacyAnnotationTraceKeys=Assert<Equal<keyof AnnotationTraceStudy['diagnostics'][number],DiagnosticKeys>>;
type LegacyTimingTraceKeys=Assert<Equal<keyof TimingTraceStudy['diagnostics'][number],DiagnosticKeys>>;
type V3Keys=Assert<Equal<keyof TimingStudyV3['diagnostics'][number],DiagnosticKeys|'cause'>>;
type V3TraceKeys=Assert<Equal<keyof TimingTraceStudyV3['diagnostics'][number],DiagnosticKeys|'cause'>>;
type V3Cause=Assert<Equal<TimingStudyV3['diagnostics'][number]['cause'],ClosedStudyFailureCode|'unavailable-code'|null>>;
type V3Representation=Assert<Equal<TimingStudyV3['candidates'][number]['representation'],'annotation'|'event_name'|'withheld'>>;
type V3TraceRepresentation=Assert<Equal<TimingTraceStudyV3['candidates'][number]['representation'],'annotation'|'event_name'|'withheld'>>;
// @ts-expect-error Legacy annotation diagnostics do not expose a cause.
type LegacyAnnotationCause=AnnotationStudy['diagnostics'][number]['cause'];
// @ts-expect-error Legacy UserTiming trace diagnostics do not expose a cause.
type LegacyTimingCause=TimingTraceStudy['diagnostics'][number]['cause'];
// @ts-expect-error V3 cause is closed and cannot include arbitrary strings.
const invalidCause:TimingStudyV3['diagnostics'][number]['cause']='private/error/path';
// @ts-expect-error V3 event-name candidates cannot use an arbitrary representation.
const invalidRepresentation:TimingTraceStudyV3['candidates'][number]['representation']='raw-native-event';
