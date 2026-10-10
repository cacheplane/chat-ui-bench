import { describe, expect, it } from 'vitest';
import { createLongThreadFixture, createLongThreadMatrix } from './long-thread.js';
import { comparisonManifestSchema, comparisonInvocationSchema, comparisonObservationSchema, validateRuntimeTranscript } from './comparison.js';
const hash = 'a'.repeat(64);
const workload = createLongThreadFixture({historyCount: 100, responseBytes: 6400, journey: 'follow'}).workload;
const caseOrder = createLongThreadMatrix().map(f => f.scenarioId);
const adapter = {
  id: 'threadplane', profile: 'threadplane-langgraph-custom-transport',
  capabilities: {rendering: 'all-mounted', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control'},
  configuration: {markdown: 'default', pinThresholdCssPx: 150, telemetry: 'disabled'},
  build: {packages: [{name: '@threadplane/chat', version: '0.3.2', integrity: 'sha512-example'}], framework: {name: 'angular', version: '21.0.0'},
    production: true, sourceHashes: {'adapter.ts': hash}, copiedSourceHashes: {}, assetHashes: {'main.js': hash}, settings: {optimization: true, sourceMaps: false}},
};
const manifest = {
  schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1.0.0', analyzerVersion: '2.0.0', collectorVersion: '2.0.0',
  repetition: 'round-1-case-1', scenarioId: caseOrder[0], round: 1, caseIndex: 0, caseOrder, workload,
  git: {revision: 'revision', dirty: false}, fixture: {sha256: hash, file: 'fixture.json'},
  browser: {executable: '/browser', version: '1', revision: '1', flags: []},
  environment: {os: 'macOS', architecture: 'arm64', cpu: {status: 'unavailable', reason: 'not recorded'}, gpu: {status: 'unavailable', reason: 'not recorded'}},
  adapter, mode: 'headless', viewport: {width: 1280, height: 800, deviceScaleFactor: 1},
  cachePolicy: 'fresh-profile-empty-cache-assets-preloaded', fonts: 'local-system',
};
describe('strict comparison v2 contract', () => {
  it('requires paired attribution for all ordinary page records', () => {
    const record = {schemaVersion: 2, repetition: 'r', sequence: null, timestampMs: 25, kind: 'composer-input', clockDomain: 'page-performance-ms', phase: 'composer-input', phaseInstanceId: '1', attributionReason: null, data: {value: 'calibrate'}};
    expect(comparisonObservationSchema.safeParse(record).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...record, phase: null, phaseInstanceId: null, attributionReason: 'gap'}).success).toBe(true);
    for (const patch of [{phaseInstanceId: undefined}, {phase: null}, {phaseInstanceId: null}, {attributionReason: 'unneeded'}, {phase: null, phaseInstanceId: null, attributionReason: null}]) expect(comparisonObservationSchema.safeParse({...record, ...patch}).success).toBe(false);
  });
  it('retains actual performance start times and quantized Event Timing durations', () => {
    const record = {schemaVersion: 2, repetition: 'r', sequence: null, timestampMs: 25, clockDomain: 'page-performance-ms', phase: null, phaseInstanceId: null, attributionReason: 'gap', kind: 'event-timing', data: {entryType: 'event', name: 'keydown', startTime: 25, duration: 8, processingStart: 27, processingEnd: 35, cancelable: true, interactionId: 1, observedAtMs: 100, targetRole: 'composer'}};
    expect(comparisonObservationSchema.safeParse(record).success).toBe(true);
    for (const patch of [{timestampMs: 100}, {data: {...record.data, duration: -1}}, {data: {...record.data, processingEnd: 26}}, {data: {...record.data, name: 'wheel'}}, {data: {...record.data, details: {}}}, {phase: 'composer-input', phaseInstanceId: null}]) expect(comparisonObservationSchema.safeParse({...record, ...patch}).success).toBe(false);
    const loaf = {...record, kind: 'long-animation-frame', data: {entryType: 'long-animation-frame', name: 'long-animation-frame', startTime: 25, duration: 75, renderStart: 0, styleAndLayoutStart: 0, blockingDuration: 20, firstUIEventTimestamp: 0, observedAtMs: 100}};
    expect(comparisonObservationSchema.safeParse(loaf).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...loaf, data: {...loaf.data, scripts: []}}).success).toBe(false);
    const host = {...record, kind: 'assistant-host', data: {messageId: 'response', hostMounted: true, contentMounted: false}};
    expect(comparisonObservationSchema.safeParse(host).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...host, data: {...host.data, messageId: null}}).success).toBe(false);
  });
  it('applies the paired-null rule across every ordinary page cohort', () => {
    const common = {schemaVersion: 2, repetition: 'r', sequence: null, timestampMs: 25, clockDomain: 'page-performance-ms', phase: 'streaming-follow', phaseInstanceId: '0', attributionReason: null};
    const unavailable = {status: 'unavailable', reason: 'unsupported'};
    const variants = [
      {kind: 'runtime-checkpoint', data: {matchedSequences: [], activeMessage: null, delivery: 'idle', outcome: null, loading: false, error: null}},
      {kind: 'dom-checkpoint', data: {matchedSequences: [], activeMessageId: null, mounted: false, text: null, visibleMessages: [], mountedMessageCount: 0}},
      {kind: 'renderer-counters', data: {heap: unavailable, dom: unavailable}},
      {kind: 'scroll-checkpoint', data: {scrollTop: 0, scrollHeight: 0, clientHeight: 0, anchorId: null, anchorTopCssPx: null, activeVisible: false, followArmed: null}},
      {kind: 'composer-input', data: {value: ''}},
      {kind: 'failure', data: {stage: 'replay', reason: 'disconnected'}},
      {kind: 'observer-state', data: {entryType: 'event', supported: false, registration: 'unsupported', reason: 'not exposed', buffered: false, requestedDurationThresholdMs: 16, droppedEntriesCount: unavailable, observedAtMs: 25}},
      {kind: 'buffer-state', data: {name: 'page-observations', maxEntries: 4096, maxSerializedBytes: 16777216, highWaterEntries: 0, highWaterSerializedBytes: 0, overflowCount: 0, rejectedRecordCount: 0, status: 'complete'}},
      {kind: 'assistant-host', data: {messageId: null, hostMounted: false, contentMounted: false}},
      {kind: 'animation-frame-checkpoint', data: {messageId: 'response', ordinal: 1}},
    ];
    for (const variant of variants) {
      const record = {...common, ...variant};
      expect(comparisonObservationSchema.safeParse(record).success, variant.kind).toBe(true);
      expect(comparisonObservationSchema.safeParse({...record, phase: null, phaseInstanceId: null, attributionReason: 'outside phase'}).success, variant.kind).toBe(true);
      for (const patch of [{phaseInstanceId: undefined}, {phase: null}, {phaseInstanceId: null}, {phase: null, phaseInstanceId: null, attributionReason: null}]) expect(comparisonObservationSchema.safeParse({...record, ...patch}).success, variant.kind).toBe(false);
    }
  });
  it('keeps wheel DOM event coalescing separate from canonical host dispatch counts', () => {
    const record = {schemaVersion: 2, repetition: 'r', sequence: null, timestampMs: 30, clockDomain: 'page-performance-ms', phase: 'history-reading', phaseInstanceId: '1', attributionReason: null, kind: 'native-input', data: {recipeId: 'wheel', type: 'wheel', eventTimestampMs: 30, observedAtMs: 35, isTrusted: true, targetRole: 'scroller', deltaX: 0, deltaY: -200, deltaMode: 0, key: null, code: null, inputType: null, value: null}};
    expect(comparisonObservationSchema.safeParse(record).success).toBe(true);
    for (const patch of [{timestampMs: 35}, {data: {...record.data, deltaY: null}}, {data: {...record.data, deltaMode: 3}}, {data: {...record.data, observedAtMs: 29}}, {data: {...record.data, type: 'input'}}]) expect(comparisonObservationSchema.safeParse({...record, ...patch}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...record, data: {...record.data, type: 'input', deltaX: null, deltaY: null, deltaMode: null, inputType: 'insertText', value: 'c'}}).success).toBe(true);
  });
  it('keeps observer registration support internally consistent', () => {
    const record = {schemaVersion: 2, repetition: 'r', sequence: null, timestampMs: 30, clockDomain: 'page-performance-ms', phase: null, phaseInstanceId: null, attributionReason: 'before replay', kind: 'observer-state', data: {entryType: 'event', supported: false, registration: 'unsupported', reason: 'API absent', buffered: false, requestedDurationThresholdMs: 16, droppedEntriesCount: {status: 'unavailable', reason: 'callback option absent'}, observedAtMs: 30}};
    expect(comparisonObservationSchema.safeParse(record).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...record, data: {...record.data, supported: true}}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...record, data: {...record.data, supported: true, registration: 'registered', reason: null}}).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...record, data: {...record.data, registration: 'registered', reason: null}}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...record, data: {...record.data, supported: true, registration: 'failed', reason: 'registration threw'}}).success).toBe(true);
  });
  it('requires exact package/build and capability provenance', () => {
    expect(comparisonManifestSchema.safeParse(manifest).success).toBe(true);
    expect(comparisonManifestSchema.safeParse({...manifest, suiteVersion: '1', collectorVersion: '2', analyzerVersion: '2'}).success).toBe(false);
    expect(comparisonManifestSchema.safeParse({...manifest, fixture: {...manifest.fixture, file: '../fixture.json'}}).success).toBe(false);
    expect(comparisonManifestSchema.safeParse({...manifest, adapter: {...adapter, profileSettings: {}}}).success).toBe(false);
    expect(comparisonManifestSchema.safeParse({...manifest, adapter: {...adapter, build: {...adapter.build, packages: [{name: 'a', version: '^1.0.0', integrity: 'sha512-a'}]}}}).success).toBe(false);
    expect(comparisonManifestSchema.safeParse({...manifest, adapter: {...adapter, build: {...adapter.build, assetHashes: {}}}}).success).toBe(false);
    expect(comparisonManifestSchema.safeParse({...manifest, schemaVersion: 3}).success).toBe(false);
    expect(comparisonManifestSchema.safeParse({...manifest, caseOrder: [caseOrder[0]]}).success).toBe(false);
    expect(comparisonManifestSchema.safeParse({...manifest, workload: {...workload, journey: 'history-reading'}}).success).toBe(false);
  });
  it('records full round ordering, positive repetitions, and explicit deadlines', () => {
    const invocation = {schemaVersion: 2, suite: 'long-thread-prose-v1', seed: 1, rounds: 3, adapterProfiles: [adapter.profile], caseOrder,
      mode: 'headless', deadlinesMs: {historySetup: 60000, replay: 30000, disposal: 10000}};
    expect(comparisonInvocationSchema.safeParse(invocation).success).toBe(true);
    expect(comparisonInvocationSchema.safeParse({...invocation, rounds: 0}).success).toBe(false);
    expect(comparisonInvocationSchema.safeParse({...invocation, unknown: 1}).success).toBe(false);
    expect(comparisonInvocationSchema.safeParse({...invocation, caseOrder: [...caseOrder].reverse()}).success).toBe(false);
    expect(comparisonInvocationSchema.safeParse({...invocation, seed: -1}).success).toBe(false);
  });
  it('separates independent producer, receipt, translation, runtime and DOM evidence', () => {
    const common = {schemaVersion: 2, repetition: 'round-1-case-1', phase: 'streaming-follow', timestampMs: 50, sequence: 1};
    const event = {sequence: 1, scheduledMs: 50, messageId: 'response', type: 'text-delta', text: '漢字🙂'};
    const emission = {...common, timestampMs: 52, kind: 'producer-emission', clockDomain: 'producer-monotonic-ms', data: {scheduledMs: 50, emittedMs: 52, latenessMs: 2, event, payloadBytes: 10, eventBytes: new TextEncoder().encode(JSON.stringify(event)).length, backpressure: false}};
    expect(comparisonObservationSchema.safeParse(emission).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...emission, data: {...emission.data, payloadBytes: 4}}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...emission, data: {scheduledMs: 50, emittedMs: 52, latenessMs: 2}}).success).toBe(false);
    const receipt = {...common, kind: 'receipt', clockDomain: 'page-performance-ms', phaseInstanceId: '0', attributionReason: null, data: {event: {sequence: 1, scheduledMs: 50, messageId: 'response', type: 'text-delta', text: '漢字🙂'}}};
    expect(comparisonObservationSchema.safeParse(receipt).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...receipt, clockDomain: 'producer-monotonic-ms'}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...common, kind: 'runtime-checkpoint', clockDomain: 'page-performance-ms', phaseInstanceId: '0', attributionReason: null, data: {
      matchedSequences: [1, 2, 3], activeMessage: {id: 'response', role: 'assistant', text: 'prefix', status: 'streaming'}, delivery: 'streaming', loading: true, error: null, outcome: null,
    }}).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...common, kind: 'dom-checkpoint', clockDomain: 'page-performance-ms', phaseInstanceId: '0', attributionReason: null, data: {
      matchedSequences: [1, 2, 3], activeMessageId: 'response', mounted: true, text: 'prefix', visibleMessages: [], mountedMessageCount: 100,
    }}).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...common, kind: 'translation', clockDomain: 'page-performance-ms', phaseInstanceId: '0', attributionReason: null, data: {protocolEvent: 'messages/partial', messageId: 'response', text: '🙂', applied: true}}).success).toBe(false);
  });
  it('retains producer failures in the producer clock separately from page failures', () => {
    const failure = {schemaVersion: 2, repetition: 'r', phase: 'disposal', sequence: null, timestampMs: 10, kind: 'producer-failure', clockDomain: 'producer-monotonic-ms', data: {stage: 'disposal', reason: 'runner-disposal'}};
    expect(comparisonObservationSchema.safeParse(failure).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...failure, clockDomain: 'page-performance-ms'}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...failure, data: {reason: 'disconnect'}}).success).toBe(false);
  });
  it('requires receipt sequence identity with the actual received event', () => {
    const receipt = {schemaVersion: 2, repetition: 'r', phase: 'streaming-follow', timestampMs: 52, sequence: 1, kind: 'receipt', clockDomain: 'page-performance-ms', phaseInstanceId: '0', attributionReason: null, data: {event: {sequence: 1, scheduledMs: 50, messageId: 'response', type: 'text-delta', text: 'text'}}};
    expect(comparisonObservationSchema.safeParse(receipt).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...receipt, sequence: null}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...receipt, sequence: 2}).success).toBe(false);
  });
  it('requires producer timing consistency and retains honest early-emission evidence', () => {
    const event = {sequence: 1, scheduledMs: 50, messageId: 'response', type: 'text-delta', text: 'text'};
    const emission = {schemaVersion: 2, repetition: 'r', phase: 'streaming-follow', timestampMs: 52, sequence: 1, kind: 'producer-emission', clockDomain: 'producer-monotonic-ms', data: {event, payloadBytes: 4, eventBytes: JSON.stringify(event).length, backpressure: false, scheduledMs: 50, emittedMs: 52, latenessMs: 2}};
    expect(comparisonObservationSchema.safeParse(emission).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...emission, timestampMs: 50, data: {...emission.data, emittedMs: 5000, latenessMs: 0}}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...emission, timestampMs: 50}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...emission, data: {...emission.data, latenessMs: 0}}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...emission, timestampMs: 49, data: {...emission.data, emittedMs: 49, latenessMs: -1}}).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...emission, timestampMs: 49, data: {...emission.data, emittedMs: 49, latenessMs: 1}}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...emission, timestampMs: 52 + 5e-7, data: {...emission.data, latenessMs: 2 - 5e-7}}).success).toBe(true);
  });
  it('never claims DOM prefix satisfaction for an unmounted active message', () => {
    const unmounted = {schemaVersion: 2, repetition: 'round-1-case-1', phase: 'history-reading', timestampMs: 50, sequence: 1, kind: 'dom-checkpoint', clockDomain: 'page-performance-ms', phaseInstanceId: '0', attributionReason: null, data: {
      matchedSequences: [], activeMessageId: 'response', mounted: false, text: null, visibleMessages: [], mountedMessageCount: 100,
    }};
    expect(comparisonObservationSchema.safeParse(unmounted).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...unmounted, data: {...unmounted.data, matchedSequences: [1, 2, 3]}}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...unmounted, data: {...unmounted.data, text: 'prefix'}}).success).toBe(false);
  });
  it('records availability and reason separately for heap and DOM counters', () => {
    const common = {schemaVersion: 2, kind: 'renderer-counters', repetition: 'round-1-case-1', phase: 'history-ready', timestampMs: 0, sequence: null, clockDomain: 'page-performance-ms', phaseInstanceId: '0', attributionReason: null};
    const unavailable = {status: 'unavailable', reason: 'API unsupported'};
    const heap = {status: 'available', value: {jsHeapUsedBytes: 0}};
    const dom = {status: 'available', value: {nodes: 0, documents: 0, eventListeners: 0}};
    expect(comparisonObservationSchema.safeParse({...common, data: {heap, dom}}).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...common, data: {heap: unavailable, dom}}).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...common, data: {heap, dom: unavailable}}).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...common, data: {heap: null, dom}}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...common, data: {heap: {status: 'unavailable'}, dom}}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...common, data: {heap, dom: {status: 'unavailable', reason: ''}}}).success).toBe(false);
  });
  it('validates raw runtime independently and does not repair omitted text or Unicode', () => {
    const fixture = createLongThreadFixture({historyCount: 100, responseBytes: 6400, journey: 'follow'});
    const response = {id: fixture.events[0]!.messageId, role: 'assistant' as const, status: 'complete' as const, text: fixture.events.map(e => e.text).join('')};
    const state = {transcript: [...fixture.history, response], activeMessageId: null, delivery: 'complete' as const, outcome: 'success' as const, loading: false, error: null};
    expect(validateRuntimeTranscript(fixture, state)).toEqual([]);
    expect(validateRuntimeTranscript(fixture, {...state, transcript: [...fixture.history, {...response, text: response.text.slice(32)}]})).toContain('Response raw text mismatch');
    const unicodeFixture = {...fixture, events: [fixture.events[0]!, {...fixture.events[1]!, text: ' A\u00a0🙂漢字 '}, fixture.events.at(-1)!]};
    const unicodeState = {...state, transcript: [...fixture.history, {...response, text: ' A\u00a0🙂漢字 '}]};
    expect(validateRuntimeTranscript(unicodeFixture, unicodeState)).toEqual([]);
    expect(validateRuntimeTranscript(unicodeFixture, {...unicodeState, transcript: [...fixture.history, {...response, text: ' A 🙂漢字 '}]})).toContain('Response raw text mismatch');
    expect(validateRuntimeTranscript(fixture, {...state, loading: true})).toContain('Runtime has not settled successfully');
    expect(validateRuntimeTranscript(fixture, {...state, transcript: state.transcript.slice(1)})).toContain('Transcript count mismatch');
  });
});
