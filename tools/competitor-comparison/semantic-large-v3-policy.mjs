// Closed acquisition/accounting identity only. Actual stock036 and competitor
// build guards remain the release authority. These constants grant no admission.
import {createHash} from 'node:crypto';

const MiB = 1024 ** 2;
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export const SEMANTIC_LARGE_V3_POLICY = freeze({
  schema: 'aimock-semantic-large-policy-v3',
  captureProfile: 'semantic-task-layout-large-v3',
  config: {
    transferMode: 'ReturnAsStream', streamFormat: 'json', streamCompression: 'gzip', tracingBackend: 'chrome',
    bufferUsageReportingInterval: 1000,
    traceConfig: {
      recordMode: 'recordUntilFull', traceBufferSizeInKb: 16384, enableSampling: false, enableSystrace: false,
      includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'],
    },
  },
  capture: {
    compressedBytes: 4194304, decodedBytes: 67108864, base64Characters: 5592408,
    wrapperBytes: 6291456, receiptBytes: 16384, wrapperOverheadBytes: 65536,
    chunkBytes: 65536, maxReads: 4096, bufferStopFraction: 0.9, bufferNotificationEntries: 16,
  },
  timing: {setupMs: 10000, finishMs: 10000, caseMs: 240000, invocationMs: 1200000, cleanupMs: 30000},
  storage: {
    kinds: {'private-case': 32 * MiB, transcript: 16 * MiB, evidence: 2 * MiB,
      result: 2 * MiB, failure: 65536, 'trace-v3': 6 * MiB},
    rawFilename: 'aimock-trace-v3-private.json', invocationFailureFilename: 'invocation-failure-v3.json',
    caseBytes: 96 * MiB, invocationBytes: 6144 * MiB, caseFailureReserveBytes: 65536,
    initialManifestReserveBytes: MiB, finalManifestReserveBytes: MiB, invocationFailureReserveBytes: MiB,
    filesystemMarginBytes: 1024 * MiB,
    // Counts declare accounting only; fixed roster admission belongs to later modules.
    declaredCounts: {pilot: 16, full: 48}, reservedBytes: {pilot: 1539 * MiB, full: 4611 * MiB},
  },
  decoder: {
    oldSpaceMiB: 512, observedRssBytes: 1073741824, originalMs: 10000, rssIntervalMs: 100,
    rssReadMs: 250, maxRssQueries: 128, stdoutBytes: 262144, stderrBytes: 65536,
    requestAckBytes: 16384, rssStdoutBytes: 4096, rssStderrBytes: 8192, pipeChunkBytes: 65536,
    ownerReceiptBytes: 16384, originalsBytes: 1048576, stdoutPrefixBytes: 256, stderrPrefixBytes: 1024,
    termToKillMs: 2000, transportReserveBytes: 1917186,
  },
  schemas: {
    receipt: 'aimock-trace-capture-v3', raw: 'aimock-semantic-large-raw-snapshot-v3',
    message: 'aimock-decoder-message-v3', decoded: 'aimock-semantic-large-decoded-v3',
    validation: 'aimock-semantic-large-validation-evidence-v3', owner: 'aimock-decoder-owner-v3',
    originals: 'aimock-decoder-originals-v3',
  },
  flags: {performance: false, scoringEligibility: false, FPS: null, cpuTime: null},
});

export const SEMANTIC_LARGE_V3_POLICY_JSON = JSON.stringify(canonical(SEMANTIC_LARGE_V3_POLICY));
export const SEMANTIC_LARGE_V3_POLICY_SHA256 = createHash('sha256').update(SEMANTIC_LARGE_V3_POLICY_JSON).digest('hex');

/** Detached immutable policy data, with no caller configuration port. */
export function readSemanticLargePolicyV3() {
  if (arguments.length !== 0) throw Error('semantic-large-v3-policy-arguments');
  return freeze(JSON.parse(SEMANTIC_LARGE_V3_POLICY_JSON));
}

/** Checks only this policy identity, never case, build, release or trace validity. */
export function validateSemanticLargePolicyIdentityV3(value) {
  if (arguments.length !== 1) throw Error('semantic-large-v3-policy-arguments');
  const refuse = () => { throw Error('semantic-large-v3-policy-identity'); };
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) refuse();
  const expected = {
    schema: SEMANTIC_LARGE_V3_POLICY.schema,
    captureProfile: SEMANTIC_LARGE_V3_POLICY.captureProfile,
    policySha256: SEMANTIC_LARGE_V3_POLICY_SHA256,
  };
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => !Object.hasOwn(expected, key))) refuse();
  for (const key of Object.keys(expected)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.value !== expected[key]) refuse();
  }
  return Object.freeze(expected);
}
