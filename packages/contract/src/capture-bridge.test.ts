import { expect, test } from 'vitest';
import * as contract from './index.js';
import type { LongThreadCaptureHost } from './capture-bridge.js';

// This ordinary host still compiles with no readActiveHost implementation.
const hostWithoutProbe: LongThreadCaptureHost = {
    capabilities: {rendering: 'all-mounted', scrollPolicy: 'bottom-follow', returnToResponse: 'unsupported'},
    locators: {scroller: '#scroller', composer: '#composer', returnToResponse: null, messageContent: id => `#${id}`},
    loadHistory() {}, connectReplay() {}, resetThread() {}, dispose() {},
    readProgress: () => ({activeMessage: null, delivery: 'idle', outcome: null, loading: false, error: null}),
    readTranscript: () => ({transcript: [], activeMessageId: null, delivery: 'idle', outcome: null, loading: false, error: null}),
    readVisibleMessages: () => [], drainCaptureEvents: () => [],
    markPhase: (phase, boundary) => ({phase, boundary, instanceId: '0', timestampMs: 0}),
    readActiveDom: () => ({activeMessageId: null, mounted: false, text: null, mountedMessageCount: 0}),
    waitForReplay: async () => {},
};
test('exports an optional actual-host mount probe without conflating content mount', () => {
    expect(hostWithoutProbe).toBeDefined();
    expect(contract.activeHostSnapshotSchema).toBeDefined();
    expect(contract.activeHostSnapshotSchema.safeParse({activeMessageId: null, hostMounted: false}).success).toBe(true);
    expect(contract.activeHostSnapshotSchema.safeParse({activeMessageId: null, hostMounted: true}).success).toBe(false);
    expect(contract.activeHostSnapshotSchema.safeParse({activeMessageId: 'response', hostMounted: true}).success).toBe(true);
    expect(contract.activeHostSnapshotSchema.safeParse({activeMessageId: 'response', hostMounted: true, contentMounted: false}).success).toBe(false);
});
test('mounted count is an optional scalar availability seam and does not force legacy implementations',()=>{
    expect(hostWithoutProbe.readCaptureMountedMessageCount).toBeUndefined();
    const host:LongThreadCaptureHost={...hostWithoutProbe,readCaptureMountedMessageCount:()=>({status:'available',value:100})};
    expect(host.readCaptureMountedMessageCount?.()).toEqual({status:'available',value:100});
});
test('exports an exact page-clock receipt/translation capture schema without implied runtime application', () => {
    const schema = (contract as any).adapterCaptureEventSchema;
    expect(schema).toBeDefined();
    expect(schema.safeParse({ kind: 'translation', sequence: 1, timestampMs: 1, data: { protocolEvent: 'messages', messageId: 'a', text: 'x' } }).success).toBe(true);
    expect(schema.safeParse({ kind: 'translation', sequence: 1, timestampMs: 1, data: { protocolEvent: 'messages', messageId: 'a', text: 'x', applied: true } }).success).toBe(false);
    expect(schema.safeParse({ kind: 'receipt', sequence: 2, timestampMs: 1, data: { event: { type: 'assistant-start', messageId: 'a', sequence: 0, scheduledMs: 0, text: '' } } }).success).toBe(false);
});
test('v2 collector rejects claimed runtime matches and retains explicit unavailable probes', () => {
    const page={schemaVersion:2,repetition:'r',phase:null,phaseInstanceId:null,attributionReason:'setup',sequence:null,timestampMs:1,clockDomain:'page-performance-ms'};
    const data={activeMessage:null,delivery:'idle',outcome:null,loading:false,error:null,matchedSequences:[]};
    expect(contract.comparisonObservationSchema.safeParse({...page,kind:'runtime-checkpoint',data}).success).toBe(true);
    expect(contract.comparisonObservationSchema.safeParse({...page,kind:'runtime-checkpoint',data:{...data,matchedSequences:[1]}}).success).toBe(false);
    expect(contract.comparisonObservationSchema.safeParse({...page,kind:'probe-unavailable',data:{probe:'runtime',reason:'content too large'}}).success).toBe(true);
    const dom={activeMessageId:'actual',mounted:true,text:'real',visibleMessages:[],mountedMessageCount:1,matchedSequences:[]};
    expect(contract.comparisonObservationSchema.safeParse({...page,kind:'dom-checkpoint',data:dom}).success).toBe(true);
    expect(contract.comparisonObservationSchema.safeParse({...page,kind:'dom-checkpoint',data:{...dom,matchedSequences:[1]}}).success).toBe(false);
});
