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
  schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1', analyzerVersion: '2', collectorVersion: '2',
  repetition: 'round-1-case-1', scenarioId: caseOrder[0], round: 1, caseIndex: 0, caseOrder, workload,
  git: {revision: 'revision', dirty: false}, fixture: {sha256: hash, file: 'fixture.json'},
  browser: {executable: '/browser', version: '1', revision: '1', flags: []},
  environment: {os: 'macOS', architecture: 'arm64', cpu: {status: 'unavailable', reason: 'not recorded'}, gpu: {status: 'unavailable', reason: 'not recorded'}},
  adapter, mode: 'headless', viewport: {width: 1280, height: 800, deviceScaleFactor: 1},
  cachePolicy: 'fresh-profile-empty-cache-assets-preloaded', fonts: 'local-system',
};
describe('strict comparison v2 contract', () => {
  it('requires exact package/build and capability provenance', () => {
    expect(comparisonManifestSchema.safeParse(manifest).success).toBe(true);
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
    const receipt = {...common, kind: 'receipt', clockDomain: 'page-performance-ms', data: {event: {sequence: 1, scheduledMs: 50, messageId: 'response', type: 'text-delta', text: '漢字🙂'}}};
    expect(comparisonObservationSchema.safeParse(receipt).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...receipt, clockDomain: 'producer-monotonic-ms'}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...common, kind: 'runtime-checkpoint', clockDomain: 'page-performance-ms', data: {
      matchedSequences: [1, 2, 3], activeMessage: {id: 'response', role: 'assistant', text: 'prefix', status: 'streaming'}, delivery: 'streaming', loading: true, error: null, outcome: null,
    }}).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...common, kind: 'dom-checkpoint', clockDomain: 'page-performance-ms', data: {
      matchedSequences: [1, 2, 3], activeMessageId: 'response', mounted: true, text: 'prefix', visibleMessages: [], mountedMessageCount: 100,
    }}).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...common, kind: 'translation', clockDomain: 'page-performance-ms', data: {protocolEvent: 'messages/partial', messageId: 'response', text: '🙂', applied: true}}).success).toBe(false);
  });
  it('retains producer failures in the producer clock separately from page failures', () => {
    const failure = {schemaVersion: 2, repetition: 'r', phase: 'disposal', sequence: null, timestampMs: 10, kind: 'producer-failure', clockDomain: 'producer-monotonic-ms', data: {stage: 'disposal', reason: 'runner-disposal'}};
    expect(comparisonObservationSchema.safeParse(failure).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...failure, clockDomain: 'page-performance-ms'}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...failure, data: {reason: 'disconnect'}}).success).toBe(false);
  });
  it('requires receipt sequence identity with the actual received event', () => {
    const receipt = {schemaVersion: 2, repetition: 'r', phase: 'streaming-follow', timestampMs: 52, sequence: 1, kind: 'receipt', clockDomain: 'page-performance-ms', data: {event: {sequence: 1, scheduledMs: 50, messageId: 'response', type: 'text-delta', text: 'text'}}};
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
    const unmounted = {schemaVersion: 2, repetition: 'round-1-case-1', phase: 'history-reading', timestampMs: 50, sequence: 1, kind: 'dom-checkpoint', clockDomain: 'page-performance-ms', data: {
      matchedSequences: [], activeMessageId: 'response', mounted: false, text: null, visibleMessages: [], mountedMessageCount: 100,
    }};
    expect(comparisonObservationSchema.safeParse(unmounted).success).toBe(true);
    expect(comparisonObservationSchema.safeParse({...unmounted, data: {...unmounted.data, matchedSequences: [1, 2, 3]}}).success).toBe(false);
    expect(comparisonObservationSchema.safeParse({...unmounted, data: {...unmounted.data, text: 'prefix'}}).success).toBe(false);
  });
  it('records availability and reason separately for heap and DOM counters', () => {
    const common = {schemaVersion: 2, kind: 'renderer-counters', repetition: 'round-1-case-1', phase: 'history-ready', timestampMs: 0, sequence: null, clockDomain: 'page-performance-ms'};
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
