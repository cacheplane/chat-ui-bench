import { describe, expect, it } from 'vitest';
import * as contract from './index.js';

const identity = {schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1.0.0', collectorVersion: '2.0.0', analyzerVersion: '2.0.0', repetition: 'r', scenarioId: 'case', round: 1, caseIndex: 0, adapterProfile: 'profile'};
const marks = (phase: string, id: string) => ({startMark: `bench:comparison:${phase}:${id}:start`, endMark: `bench:comparison:${phase}:${id}:end`});
const interval = (phase = 'streaming-follow', instanceId = '0', startMs = 10, endMs = 20) => ({phase, instanceId, startMs, endMs, ...marks(phase, instanceId)});
const phases = (instances = [interval(), interval('composer-input', '1', 30, 40)]) => ({...identity, status: 'complete', instances, openPhase: null});
const unavailable = {status: 'unavailable', reason: 'not acquired'};
describe('bounded capture amendments', () => {
  it('requires owning geometry and aligned clipping axes', () => {
    const rect={left:0,top:0,right:10,bottom:10};
    const value={messageId:'actual',role:'assistant',hostRect:rect,contentRects:[rect],viewportRect:rect,scrollerRect:rect,clippingAncestorRects:[rect],clippingAncestorAxes:[{clipX:true,clipY:false}],effectiveClipRect:rect};
    expect(contract.comparisonGeometrySchema.safeParse({status:'available',value}).success).toBe(true);
    for(const patch of [{messageId:undefined},{role:undefined},{clippingAncestorAxes:[]},{clippingAncestorAxes:[{clipX:true,clipY:false,z:true}]}]) expect(contract.comparisonGeometrySchema.safeParse({status:'available',value:{...value,...patch}}).success).toBe(false);
    expect(contract.comparisonGeometrySchema.safeParse({status:'available',value:{...value,clippingAncestorRects:Array(65).fill(rect),clippingAncestorAxes:Array(65).fill({clipX:true,clipY:false})}}).success).toBe(false);
  });
  it('retains lifecycle page brackets and independent CDP receipts in genuine order', () => {
    const data={heap:unavailable,dom:unavailable};
    const checkpoint={lifecycle:'baseline',pageRequestBracket:{status:'available',value:{beforeMs:10,afterMs:30,clockDomain:'page-performance-ms'}},hostReceipt:{heap:{status:'available',value:{timestampMs:200,clockDomain:'host-monotonic-ms'}},dom:unavailable},data};
    expect(contract.comparisonCounterCheckpointSchema.safeParse(checkpoint).success).toBe(true);
    expect(contract.comparisonCounterCheckpointSchema.safeParse({...checkpoint,pageRequestBracket:{status:'available',value:{beforeMs:31,afterMs:30,clockDomain:'page-performance-ms'}}}).success).toBe(false);
    expect(contract.comparisonCounterCheckpointSchema.safeParse({timestampMs:10,clockDomain:'page-performance-ms',data}).success).toBe(false);
    const base={...identity,inputRecipe:{wheel:{recipeId:'w',deltasCssPx:[-100,-100,-100,-100],cadenceMs:50},composer:{recipeId:'c',text:'calibrate',cadenceMs:35,submit:false}},hostDispatches:[],hostFrameGuards:[],scroll:[],deadlines:[]};
    expect(contract.comparisonCheckpointsSchema.safeParse({...base,counters:[checkpoint,{...checkpoint,lifecycle:'replay-end'}]}).success).toBe(true);
    for(const counters of [[checkpoint,checkpoint],[{...checkpoint,lifecycle:'replay-end'},checkpoint]]) expect(contract.comparisonCheckpointsSchema.safeParse({...base,counters}).success).toBe(false);
  });
  it('records exact acquired capture metadata rather than a configuration bag', () => {
    const metadata={...identity,browserProtocol:{protocolVersion:'1.3',product:'Chrome/1',revision:'actual',userAgent:'actual',jsVersion:'actual'},chromiumDownloadRevision:'actual',playwrightVersion:'1.64.0',instrumentation:{sourceHashes:{'actual.ts':'a'.repeat(64)},installerSha256:'b'.repeat(64),probeIntervalMs:50,limits:contract.COMPARISON_CAPTURE_LIMITS}};
    expect(contract.comparisonCaptureMetadataSchema.safeParse(metadata).success).toBe(true);
    for(const patch of [{instrumentation:{...metadata.instrumentation,probeIntervalMs:51}},{instrumentation:{...metadata.instrumentation,limits:{...metadata.instrumentation.limits,maxPendingEntries:4097}}},{configuration:{}},{browserProtocol:{...metadata.browserProtocol,revision:undefined}}]) expect(contract.comparisonCaptureMetadataSchema.safeParse({...metadata,...patch}).success).toBe(false);
    for(const [key,value] of Object.entries(contract.COMPARISON_CAPTURE_LIMITS)) expect(contract.comparisonCaptureMetadataSchema.safeParse({...metadata,instrumentation:{...metadata.instrumentation,limits:{...metadata.instrumentation.limits,[key]:value+1}}}).success).toBe(false);
  });
  it('keeps separate actual active and historical anchor geometry ownership',()=>{
    const rect={left:0,top:0,right:1,bottom:1};
    const geometry={status:'available',value:{messageId:'a',role:'assistant',hostRect:rect,contentRects:[rect],viewportRect:rect,scrollerRect:rect,clippingAncestorRects:[],clippingAncestorAxes:[],effectiveClipRect:rect}};
    const anchorGeometry={status:'available',value:{...geometry.value,messageId:'h',role:'user'}};
    const scroll={timestampMs:10,clockDomain:'page-performance-ms',scrollTop:0,scrollHeight:100,clientHeight:80,anchorId:'h',anchorTopCssPx:0,activeVisible:true,followArmed:null,pinThresholdCssPx:150,geometry,anchorGeometry};
    const base={...identity,inputRecipe:{wheel:{recipeId:'w',deltasCssPx:[-100,-100,-100,-100],cadenceMs:50},composer:{recipeId:'c',text:'calibrate',cadenceMs:35,submit:false}},hostDispatches:[],hostFrameGuards:[],counters:[],deadlines:[]};
    expect(contract.comparisonCheckpointsSchema.safeParse({...base,scroll:[scroll]}).success).toBe(true);
    for(const patch of [{anchorGeometry:undefined},{anchorId:'other'},{geometry:{...geometry,value:{...geometry.value,role:'user'}}}]) expect(contract.comparisonCheckpointsSchema.safeParse({...base,scroll:[{...scroll,...patch}]}).success).toBe(false);
  });
});
const page = (kind: 'receipt'|'translation'|'native-input', timestampMs = 15) => ({schemaVersion: 2, repetition: 'r', phase: 'streaming-follow', phaseInstanceId: '0', attributionReason: null, timestampMs, sequence: kind === 'receipt' ? 1 : null, clockDomain: 'page-performance-ms', kind, data: kind === 'receipt' ? {event: {type: 'text-delta', sequence: 1, scheduledMs: 50, messageId: 'response', text: 'x'}} : kind === 'translation' ? {protocolEvent: 'messages', messageId: 'response', text: 'x'} : {recipeId: 'wheel', type: 'wheel', eventTimestampMs: timestampMs, observedAtMs: 100, isTrusted: true, targetRole: 'scroller', deltaX: 0, deltaY: -100, deltaMode: 0, key: null, code: null, inputType: null, value: null}});

describe('schema2 comparison identity and phase contracts', () => {
  it('exports exact supported identity and normalized POSIX paths', () => {
    expect(contract.comparisonIdentitySchema).toBeDefined();
    expect(contract.comparisonIdentitySchema.safeParse(identity).success).toBe(true);
    for (const patch of [{schemaVersion: 1}, {suiteVersion: '1'}, {collectorVersion: '1.1.0'}, {analyzerVersion: '3.0.0'}, {extra: 1}]) expect(contract.comparisonIdentitySchema.safeParse({...identity, ...patch}).success).toBe(false);
    expect(contract.comparisonArtifactPathSchema.parse('round-1/run-0/trace.json')).toBe('round-1/run-0/trace.json');
    for (const path of ['', '/trace.json', '../trace.json', 'a/../b', 'a//b', 'a/./b', 'a\\b', 'C:/b', 'https://a', 'a\nb', 'a%2fb']) expect(contract.comparisonArtifactPathSchema.safeParse(path).success).toBe(false);
  });
  it('retains repeated, adjacent exclusive phases and honest open failure intervals', () => {
    expect(contract.comparisonPhasesSchema).toBeDefined();
    expect(contract.comparisonPhasesSchema.safeParse(phases()).success).toBe(true);
    expect(contract.comparisonPhasesSchema.safeParse(phases([interval(), interval('streaming-follow', '1', 20, 30)])).success).toBe(true);
    for (const instances of [[interval(), interval('composer-input', '0', 30, 40)], [interval(), interval('composer-input', '1', 19, 30)], [interval('composer-input', '1', 30, 40), interval()], [interval('streaming-follow', '0', 10, 10)], [{...interval(), startMark: 'wrong'}]]) expect(contract.comparisonPhasesSchema.safeParse(phases(instances)).success).toBe(false);
    const partial = {...phases(), status: 'partial', reason: 'page failed', openPhase: {phase: 'validation', instanceId: '2', startMs: 41, startMark: marks('validation', '2').startMark}};
    expect(contract.comparisonPhasesSchema.safeParse(partial).success).toBe(true);
    expect(contract.comparisonPhasesSchema.safeParse({...partial, status: 'complete'}).success).toBe(false);
    expect(contract.comparisonPhasesSchema.safeParse({...partial, reason: undefined}).success).toBe(false);
    expect(contract.comparisonPhasesSchema.safeParse({...partial, openPhase: {...partial.openPhase, instanceId: '0'}}).success).toBe(false);
  });
  for (const kind of ['receipt', 'translation', 'native-input'] as const) {
    it(`${kind} retains before/gap/after records without fabricated scored attribution`, () => {
      expect(contract.validateComparisonPageAttribution).toBeDefined();
      const declared = contract.comparisonPhasesSchema.parse(phases());
      for (const time of [9, 25, 41]) {
        const raw = {...page(kind, time), phase: null, phaseInstanceId: null, attributionReason: 'outside closed phase'};
        const parsed = contract.comparisonObservationSchema.parse(raw);
        expect(contract.validateComparisonPageAttribution(parsed, declared)).toEqual([]);
        expect(contract.validateComparisonPageAttribution(contract.comparisonObservationSchema.parse(page(kind, time)), declared).length).toBeGreaterThan(0);
        expect(parsed.timestampMs).toBe(time);
      }
      for (const time of [10, 19.999]) expect(contract.validateComparisonPageAttribution(contract.comparisonObservationSchema.parse(page(kind, time)), declared)).toEqual([]);
      expect(contract.validateComparisonPageAttribution(contract.comparisonObservationSchema.parse(page(kind, 20)), declared).length).toBeGreaterThan(0);
      const adjacent = contract.comparisonPhasesSchema.parse(phases([interval(), interval('composer-input', '1', 20, 30)]));
      const next = {...page(kind, 20), phase: 'composer-input', phaseInstanceId: '1'};
      expect(contract.validateComparisonPageAttribution(contract.comparisonObservationSchema.parse(next), adjacent)).toEqual([]);
      for (const patch of [{phaseInstanceId: '99'}, {phase: 'history-reading'}, {phase: 'composer-input', phaseInstanceId: '1'}]) expect(contract.validateComparisonPageAttribution(contract.comparisonObservationSchema.parse({...page(kind), ...patch}), declared).length).toBeGreaterThan(0);
      expect(page(kind).timestampMs).toBe(15); // The delivery timestamp 100 never replaces the event timestamp.
    });
  }
  it('treats exact closing boundaries as an exception to ordinary exclusive attribution', () => {
    expect(contract.comparisonPhaseBoundarySchema).toBeDefined();
    const declared = contract.comparisonPhasesSchema.parse(phases());
    const boundary = (name: 'start'|'end', timestampMs: number) => contract.comparisonObservationSchema.parse({schemaVersion: 2, repetition: 'r', kind: 'phase', phase: 'streaming-follow', phaseInstanceId: '0', sequence: null, timestampMs, clockDomain: 'page-performance-ms', data: {boundary: name, markName: `bench:comparison:streaming-follow:0:${name}`}});
    expect(contract.validateComparisonPageAttribution(boundary('start', 10), declared)).toEqual([]);
    expect(contract.validateComparisonPageAttribution(boundary('end', 20), declared)).toEqual([]);
    expect(contract.validateComparisonPageAttribution(boundary('end', 19.999), declared).length).toBeGreaterThan(0);
    const open = contract.comparisonPhasesSchema.parse({...phases(), status: 'partial', reason: 'failed', openPhase: {phase: 'streaming-follow', instanceId: '2', startMs: 45, startMark: marks('streaming-follow', '2').startMark}});
    const openStart = {...boundary('start', 10), phaseInstanceId: '2', timestampMs: 45, data: {boundary: 'start', markName: marks('streaming-follow', '2').startMark}};
    expect(contract.validateComparisonPageAttribution(contract.comparisonObservationSchema.parse(openStart), open)).toEqual([]);
    expect(contract.validateComparisonPageAttribution(contract.comparisonObservationSchema.parse({...page('receipt', 46), phaseInstanceId: '2'}), open).length).toBeGreaterThan(0);
    expect(contract.validateComparisonPageAttribution(contract.comparisonObservationSchema.parse({...openStart, data: {boundary: 'end', markName: marks('streaming-follow', '2').endMark}}), open).length).toBeGreaterThan(0);
  });
});

const probe = {intervalMs: 25, callbacks: 0, callbackDurationTotalMs: 0, maximumObservedGapMs: unavailable};
const buffer = {name: 'transport', maxEntries: 4096, maxSerializedBytes: 16777216, highWaterEntries: 4096, highWaterSerializedBytes: 16777216, overflowCount: 0, rejectedRecordCount: 0, status: 'complete'};
const instrumentation = {runtimeProbe: probe, domProbe: {...probe, selectionStrategy: 'bounded-visible-candidates'}, scrollProbe: probe, transportDrain: probe, eventTiming: unavailable, loaf: unavailable, buffers: [buffer]};
const evidence = () => ({...identity, status: 'complete', files: [{path: 'observations.jsonl', status: 'complete', byteLength: 20000000, sha256: 'a'.repeat(64)}], unavailableFiles: [], trace: unavailable, instrumentation});
describe('retained evidence and independent raw facts', () => {
  for (const path of ['summary.md', 'analysis/summary.md']) {
    it(`excludes derived ${path} from the raw payload inventory`, () => {
      expect(contract.comparisonEvidenceSchema.safeParse({...evidence(), files: [{...evidence().files[0], path}]}).success).toBe(false);
    });
  }
  it('retains exact inventory bytes without applying pending buffer limits to artifact totals', () => {
    expect(contract.comparisonEvidenceSchema).toBeDefined();
    expect(contract.comparisonEvidenceSchema.safeParse(evidence()).success).toBe(true);
    expect(contract.comparisonEvidenceSchema.safeParse({...evidence(), files: [{...evidence().files[0], byteLength: 0}]}).success).toBe(true);
    for (const files of [[...evidence().files, ...evidence().files], [{...evidence().files[0], path: 'evidence.json'}], [{...evidence().files[0], path: 'results.json'}], [{...evidence().files[0], path: '../trace'}], [{...evidence().files[0], sha256: 'bad'}], [{...evidence().files[0], byteLength: 0.5}], [{...evidence().files[0], byteLength: Number.MAX_SAFE_INTEGER + 1}], [{...evidence().files[0], status: 'partial'}]]) expect(contract.comparisonEvidenceSchema.safeParse({...evidence(), files}).success).toBe(false);
    expect(contract.comparisonEvidenceSchema.safeParse({...evidence(), unavailableFiles: [{path: 'observations.jsonl', reason: 'missing'}]}).success).toBe(false);
    expect(contract.comparisonEvidenceSchema.safeParse({...evidence(), status: 'partial'}).success).toBe(false);
    expect(contract.comparisonEvidenceSchema.safeParse({...evidence(), status: 'pending', files: [], unavailableFiles: [{path: 'trace.json', reason: 'not started'}]}).success).toBe(true);
    const lost = {...buffer, status: 'partial', reason: 'pending buffer overflow', overflowCount: 1};
    expect(contract.comparisonEvidenceSchema.safeParse({...evidence(), status: 'partial', reason: 'lost records', instrumentation: {...instrumentation, buffers: [lost]}}).success).toBe(true);
    expect(contract.comparisonEvidenceSchema.safeParse({...evidence(), instrumentation: {...instrumentation, buffers: [{...buffer, overflowCount: 1}]}}).success).toBe(false);
  });
  it('keeps CDP loss/completion and optional approximate usage fields honest', () => {
    expect(contract.comparisonTraceSchema).toBeDefined();
    const trace = {status: 'available', format: 'cdp-json', file: 'trace.json', categories: ['blink.user_timing'], complete: true, tracingComplete: {status: 'available', value: {dataLossOccurred: false}}, bufferUsage: [{observedAtHostMs: 2, eventCount: 1.5}, {observedAtHostMs: 3, percentFull: 0, value: 0.2}], presentation: unavailable};
    expect(contract.comparisonTraceSchema.safeParse(trace).success).toBe(true);
    expect(contract.comparisonTraceSchema.safeParse({...trace, tracingComplete: unavailable}).success).toBe(true);
    expect(contract.comparisonTraceSchema.safeParse({...trace, tracingComplete: {status: 'available', value: {}}}).success).toBe(false);
    expect(contract.comparisonTraceSchema.safeParse({...trace, tracingComplete: {status: 'available', value: {dataLossOccurred: false, droppedRecords: 0}}}).success).toBe(false);
    expect(contract.comparisonTraceSchema.safeParse({...trace, complete: false}).success).toBe(false);
    expect(contract.comparisonTraceSchema.safeParse({...trace, complete: false, reason: 'trace truncated'}).success).toBe(true);
    expect(contract.comparisonTraceSchema.safeParse({...trace, bufferUsage: [{observedAtHostMs: 1, value: 2}]}).success).toBe(false);
  });
  it('preserves raw Unicode and structurally incorrect runtime for independent validation', () => {
    expect(contract.comparisonFinalRuntimeSchema).toBeDefined();
    const raw = {...identity, timestampMs: 4, clockDomain: 'page-performance-ms', snapshot: {transcript: [{id: 'response', role: 'assistant', text: ' A\u00a0🙂漢字 ', status: 'streaming'}], activeMessageId: 'response', delivery: 'error', outcome: 'error', loading: true, error: 'broken'}};
    expect(contract.comparisonFinalRuntimeSchema.parse(raw).snapshot.transcript[0]?.text).toBe(' A\u00a0🙂漢字 ');
    expect(contract.comparisonFinalRuntimeSchema.safeParse({...raw, repaired: true}).success).toBe(false);
    expect(contract.comparisonFinalRuntimeSchema.safeParse({...raw, clockDomain: 'host-monotonic-ms'}).success).toBe(false);
  });
  it('keeps visible coverage cohorts strict and distinct', () => {
    expect(contract.comparisonVisibleValidationSchema).toBeDefined();
    const raw = {...identity, timestampMs: 50, clockDomain: 'page-performance-ms', coverage: {mode: 'all-mounted', messages: [{id: 'a', text: 'raw'}], activeResponse: unavailable}};
    expect(contract.comparisonVisibleValidationSchema.safeParse(raw).success).toBe(true);
    expect(contract.comparisonVisibleValidationSchema.safeParse({...raw, coverage: {...raw.coverage, historySamples: []}}).success).toBe(false);
    expect(contract.comparisonVisibleValidationSchema.safeParse({...raw, coverage: {...raw.coverage, messages: [...raw.coverage.messages, ...raw.coverage.messages]}}).success).toBe(false);
    const virtual = {...raw, coverage: {mode: 'virtualized', visibleMessages: [{id: 'a', text: 'raw'}], historySamples: [{id: 'b', text: 'sample', sampleIndex: 0, pageTimestampMs: 40}], activeResponse: unavailable, samplingRecipe: {seed: 1, count: 1}}};
    expect(contract.comparisonVisibleValidationSchema.safeParse(virtual).success).toBe(true);
    expect(contract.comparisonVisibleValidationSchema.safeParse({...virtual, coverage: {...virtual.coverage, historySamples: [{...virtual.coverage.historySamples[0], id: 'a'}]}}).success).toBe(false);
  });
  it('requires validation reasons and suppresses available scores for invalid/failed runs', () => {
    expect(contract.comparisonValidationSchema).toBeDefined();
    const validation = {...identity, status: 'valid', checks: [{name: 'raw-runtime', passed: true, reason: null, evidencePaths: ['final-runtime.json']}], reasons: []};
    expect(contract.comparisonValidationSchema.safeParse(validation).success).toBe(true);
    expect(contract.comparisonValidationSchema.safeParse({...validation, checks: [{...validation.checks[0], passed: false, reason: 'wrong raw text'}]}).success).toBe(false);
    expect(contract.comparisonValidationSchema.safeParse({...validation, status: 'failed'}).success).toBe(false);
    const result = {...identity, generatedAt: '2026-10-10T00:00:00.000Z', status: 'valid', reasons: [], metrics: [{name: 'backlog', measurement: {status: 'available', value: 0, unit: 'events', evidencePaths: ['observations.jsonl']}}], phases: [], presentation: unavailable, diagnostics: [{name: 'lateness', value: -2, unit: 'ms', scored: false, evidencePaths: ['producer.jsonl']}]};
    expect(contract.comparisonRunResultsSchema.safeParse(result).success).toBe(true);
    expect(contract.comparisonRunResultsSchema.safeParse({...result, status: 'invalid', reasons: ['raw mismatch']}).success).toBe(false);
    expect(contract.comparisonRunResultsSchema.safeParse({...result, status: 'failed', reasons: ['acquisition failed'], metrics: []}).success).toBe(true);
    expect(contract.comparisonRunResultsSchema.safeParse({...result, metrics: [...result.metrics, ...result.metrics]}).success).toBe(false);
    expect(contract.comparisonRunResultsSchema.safeParse({...result, metrics: [{name: 'backlog', measurement: {...unavailable, value: 0}}]}).success).toBe(false);
    expect(contract.comparisonRunResultsSchema.safeParse({...result, diagnostics: [{...result.diagnostics[0], scored: true}]}).success).toBe(false);
  });
  it('retains independent host dispatch timing and exact stage deadline arithmetic', () => {
    expect(contract.comparisonDeadlineSchema).toBeDefined();
    const deadline = {stage: 'setup', budgetMs: 60000, startedAtHostMs: 5, deadlineAtHostMs: 60005, finishedAtHostMs: null, outcome: 'expired', reason: 'blocked page'};
    expect(contract.comparisonDeadlineSchema.safeParse(deadline).success).toBe(true);
    for (const patch of [{budgetMs: 30000}, {deadlineAtHostMs: 60000}, {stage: 'unknown'}, {reason: undefined}]) expect(contract.comparisonDeadlineSchema.safeParse({...deadline, ...patch}).success).toBe(false);
    expect(contract.comparisonHostDispatchSchema.safeParse({recipeId: 'wheel', index: 1, kind: 'wheel', hostMonotonicMs: 155, requestedOffsetMs: 50, actualOffsetMs: 75}).success).toBe(true);
    expect(contract.comparisonHostDispatchSchema.safeParse({recipeId: 'wheel', index: 1, kind: 'wheel', hostMonotonicMs: 155, requestedOffsetMs: 75, actualOffsetMs: 75}).success).toBe(false);
    expect(contract.comparisonRectSchema.safeParse({left: -5, top: -10, right: 2, bottom: 0}).success).toBe(true);
    expect(contract.comparisonRectSchema.safeParse({left: 5, top: 0, right: 2, bottom: 10}).success).toBe(false);
    const rect = {left: 0, top: 0, right: 10, bottom: 10};
    expect(contract.comparisonGeometrySchema.safeParse({status: 'available', value: {messageId:'response',role:'assistant',hostRect: rect, contentRects: [{...rect, top: 20, bottom: 30}], viewportRect: rect, scrollerRect: rect, clippingAncestorRects: [],clippingAncestorAxes:[], effectiveClipRect: rect}}).success).toBe(true);
    expect(contract.comparisonGeometrySchema.safeParse(unavailable).success).toBe(true);
  });
  it('requires successful deadline completion at or before its absolute deadline', () => {
    const complete = {stage: 'setup', budgetMs: 60000, startedAtHostMs: 5, deadlineAtHostMs: 60005, finishedAtHostMs: 60005, outcome: 'complete'};
    expect(contract.comparisonDeadlineSchema.safeParse(complete).success).toBe(true);
    expect(contract.comparisonDeadlineSchema.safeParse({...complete, finishedAtHostMs: 60005.001}).success).toBe(false);
    for (const outcome of ['expired', 'failed']) expect(contract.comparisonDeadlineSchema.safeParse({...complete, outcome, finishedAtHostMs: 60006, reason: 'actual late completion'}).success).toBe(true);
  });
  it('uses two actual page frames independently of host dispatch clocks', () => {
    const guard = {messageId: 'response', hostObservation: {clockDomain: 'page-performance-ms', timestampMs: 25, hostMounted: true, contentMounted: false}, frames: [{ordinal: 1, clockDomain: 'page-performance-ms', timestampMs: 40}, {ordinal: 2, clockDomain: 'page-performance-ms', timestampMs: 56}]};
    expect(contract.comparisonHostFrameGuardSchema.safeParse(guard).success).toBe(true);
    for (const frames of [[guard.frames[1], guard.frames[0]], [{...guard.frames[0], timestampMs: 20}, guard.frames[1]], [guard.frames[0], {...guard.frames[1], ordinal: 1}], [guard.frames[0], {...guard.frames[1], timestampMs: 40}]]) expect(contract.comparisonHostFrameGuardSchema.safeParse({...guard, frames}).success).toBe(false);
    const inputRecipe = {wheel: {recipeId: 'wheel', deltasCssPx: [-100, -100, -100, -100], cadenceMs: 50}, composer: {recipeId: 'composer', text: 'calibrate', cadenceMs: 35, submit: false}};
    const checkpoints = {...identity, inputRecipe, hostDispatches: [0, 1, 2, 3].map(index => ({recipeId: 'wheel', index, kind: 'wheel', hostMonotonicMs: 1000 + index * 60, requestedOffsetMs: index * 50, actualOffsetMs: index * 60})), hostFrameGuards: [guard], scroll: [], counters: [], deadlines: []};
    expect(contract.comparisonCheckpointsSchema.safeParse(checkpoints).success).toBe(true);
    expect(contract.comparisonCheckpointsSchema.safeParse({...checkpoints, inputRecipe: {...inputRecipe, composer: {...inputRecipe.composer, submit: true}}}).success).toBe(false);
    expect(contract.comparisonCheckpointsSchema.safeParse({...checkpoints, hostDispatches: [{...checkpoints.hostDispatches[0], recipeId: 'other'}]}).success).toBe(false);
    const scroll = {timestampMs: 100, clockDomain: 'page-performance-ms', scrollTop: 0, scrollHeight: 100, clientHeight: 80, anchorId: null, anchorTopCssPx: null, activeVisible: false, followArmed: null, pinThresholdCssPx: null, geometry: unavailable,anchorGeometry:unavailable};
    expect(contract.comparisonCheckpointsSchema.safeParse({...checkpoints, scroll: [scroll]}).success).toBe(true);
    expect(contract.comparisonCheckpointsSchema.safeParse({...checkpoints, scroll: [{...scroll, geometry: null}]}).success).toBe(false);
  });
  it('retains explicit observer availability and measured zero separately from unavailable', () => {
    const observer = {status: 'available', value: {entryType: 'event', buffered: false, requestedDurationThresholdMs: 16, registrationTimestampMs: 0, observedEntries: 0, callbackCount: 1, droppedEntriesCount: {status: 'available', value: 0}, finalTakeRecords: true}};
    expect(contract.comparisonObserverSchema.safeParse(observer).success).toBe(true);
    expect(contract.comparisonObserverSchema.safeParse({...observer, value: {...observer.value, droppedEntriesCount: unavailable}}).success).toBe(true);
    for (const droppedEntriesCount of [null, 0, {status: 'unavailable'}, {...unavailable, value: 0}, {status: 'available', value: -1}]) expect(contract.comparisonObserverSchema.safeParse({...observer, value: {...observer.value, droppedEntriesCount}}).success).toBe(false);
    expect(contract.comparisonInstrumentationSchema.safeParse({...instrumentation, eventTiming: observer}).success).toBe(true);
    expect(contract.comparisonInstrumentationSchema.safeParse({...instrumentation, loaf: observer}).success).toBe(false);
    for (const patch of [{maxEntries: 4097}, {maxSerializedBytes: 16777217}, {highWaterEntries: 4097}, {highWaterSerializedBytes: 16777217}, {rejectedRecordCount: 1}, {status: 'partial'}]) expect(contract.comparisonBoundedBufferSchema.safeParse({...buffer, ...patch}).success).toBe(false);
  });
  it('retains actual CDP frame fields while rejecting invented benchmark evidence', () => {
    const presentation = {status: 'available', value: {capability: contract.PRESENTATION_CAPABILITY, contractVersion: contract.PRESENTATION_CONTRACT_VERSION, sessionTarget: 'page', targetId: 'target', appURL: 'https://app.example', frameTree: {frameTree: {frame: {id: 'frame', url: 'https://app.example', loaderId: 'actual-cdp-field'}}}, frameTreeCapturePoint: 'before-tracing', isolatedBrowserProcess: true, singleWorkloadPage: true}};
    const trace = {status: 'available', format: 'cdp-json', file: 'trace.json', categories: ['blink.user_timing'], complete: false, reason: 'interrupted', tracingComplete: unavailable, bufferUsage: [], presentation};
    expect(contract.comparisonTraceSchema.safeParse(trace).success).toBe(true);
    expect(contract.comparisonTraceSchema.safeParse({...trace, presentation: {...presentation, value: {...presentation.value, inventedTopology: true}}}).success).toBe(false);
    expect(contract.comparisonTraceSchema.safeParse({...trace, categories: ['blink.user_timing', 'blink.user_timing']}).success).toBe(false);
  });
  it('discriminates lifecycle exception source clocks without fabricating environment', () => {
    const exception = {source: 'producer', stage: 'replay', clockDomain: 'producer-monotonic-ms', timestampMs: 20, message: 'socket failed', stack: null, severity: 'error'};
    expect(contract.comparisonExceptionsSchema.safeParse({...identity, exceptions: [exception]}).success).toBe(true);
    expect(contract.comparisonExceptionsSchema.safeParse({...identity, exceptions: [{...exception, clockDomain: 'page-performance-ms'}]}).success).toBe(false);
    const descriptor = {...identity, seed: 1, mode: 'headed', artifactDirectory: 'round-1/run-0'};
    expect(contract.comparisonScheduledRunSchema.safeParse(descriptor).success).toBe(true);
    expect(contract.comparisonScheduledRunSchema.safeParse({...descriptor, browser: {version: 'invented'}}).success).toBe(false);
  });
  it('suppresses available scored metrics in every phase and nested presentation of failed runs', () => {
    const base = {...identity, generatedAt: '2026-10-10T00:00:00.000Z', status: 'failed', reasons: ['capture failed'], metrics: [], phases: [], presentation: unavailable, diagnostics: []};
    const metric = {name: 'drift', measurement: {status: 'available', value: -3, unit: 'css-px', evidencePaths: ['checkpoints.json']}};
    expect(contract.comparisonRunResultsSchema.safeParse({...base, phases: [{phase: 'history-reading', instanceId: '1', metrics: [metric]}]}).success).toBe(false);
    const outputPhase = {phase: 'streaming-follow', instanceId: '0', ...marks('streaming-follow', '0'), startUs: 0, endUs: 1000000, durationUs: 1000000, target: {frameId: 'f', pid: 1, tid: 2}, boundaryExcludedPairCount: 0, nonPresentedPairCount: 0, rendererVisualUpdateFps: {status: 'available', value: 1, unit: 'updates/s', evidence: ['trace.json'], numerator: 1, denominatorUs: 1000000}, presentationIntervals: unavailable};
    const presentation = {status: 'available', capability: contract.PRESENTATION_CAPABILITY, contractVersion: contract.PRESENTATION_CONTRACT_VERSION, value: {scope: 'target renderer visual updates', phases: [outputPhase]}};
    expect(contract.comparisonRunResultsSchema.safeParse({...base, presentation}).success).toBe(false);
    expect(contract.comparisonRunResultsSchema.safeParse({...base, presentation: {...presentation, value: {...presentation.value, phases: [{...outputPhase, rendererVisualUpdateFps: unavailable}]}}}).success).toBe(true);
    for (const measurement of [null, {...unavailable, evidencePaths: []}, {status: 'available', value: NaN, unit: 'ms', evidencePaths: ['trace.json']}, {status: 'available', value: 1, unit: 'ms', evidencePaths: ['../trace.json']}, {status: 'available', value: 1, unit: 'ms', evidencePaths: []}]) expect(contract.comparisonRunResultsSchema.safeParse({...base, status: 'valid', reasons: [], metrics: [{name: 'latency', measurement}]}).success).toBe(false);
  });
});

describe('retained invocation ledger', () => {
  it('requires all thirty-six canonical publication slots including failures', () => {
    expect(contract.comparisonCaptureInvocationSchema).toBeDefined();
    const caseOrder = contract.longThreadCaseOrder(1);
    const configuration = {schemaVersion: 2, suite: 'long-thread-prose-v1', seed: 1, rounds: 3, adapterProfiles: ['profile'], caseOrder, mode: 'headless', deadlinesMs: {historySetup: 60000, replay: 30000, disposal: 10000}};
    const runs = [1, 2, 3].flatMap(round => caseOrder.map((scenarioId, caseIndex) => ({round, caseIndex, scenarioId, adapterProfile: 'profile', repetition: `r-${round}-${caseIndex}`, artifactDirectory: `round-${round}/run-${caseIndex}`, status: 'failed', reasons: ['not started after unsafe halt']})));
    const ledger = {schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1.0.0', collectorVersion: '2.0.0', analyzerVersion: '2.0.0', createdAt: '2026-10-10T00:00:00.000Z', purpose: 'publication', status: 'failed', configuration, runs};
    expect(runs).toHaveLength(36);
    expect(contract.comparisonCaptureInvocationSchema.safeParse(ledger).success).toBe(true);
    expect(contract.comparisonCaptureInvocationSchema.safeParse({...ledger, status: 'complete', runs: runs.map((r, i) => i === 0 ? {...r, status: 'invalid', reasons: ['invalid']} : {...r, status: 'valid', reasons: []})}).success).toBe(true);
    for (const patch of [{runs: runs.slice(1)}, {runs: [...runs].reverse()}, {runs: [runs[0], runs[0], ...runs.slice(2)]}, {configuration: {...configuration, rounds: 2}}, {configuration: {...configuration, adapterProfiles: ['profile', 'other']}}, {runs: runs.map((r, i) => i === 0 ? {...r, status: 'scheduled'} : r)}]) expect(contract.comparisonCaptureInvocationSchema.safeParse({...ledger, ...patch}).success).toBe(false);
    expect(contract.comparisonCaptureInvocationSchema.safeParse({...ledger, status: 'pending', runs: runs.map(r => ({...r, status: 'scheduled', reasons: []}))}).success).toBe(true);
  });
});
