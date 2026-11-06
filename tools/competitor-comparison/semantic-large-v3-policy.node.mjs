import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  SEMANTIC_LARGE_V3_POLICY as policy,
  SEMANTIC_LARGE_V3_POLICY_JSON as serialized,
  SEMANTIC_LARGE_V3_POLICY_SHA256 as digest,
  readSemanticLargePolicyV3,
  validateSemanticLargePolicyIdentityV3,
} from './semantic-large-v3-policy.mjs';

const MiB = 1024 ** 2;
const identity = () => ({schema: 'aimock-semantic-large-policy-v3', captureProfile: 'semantic-task-layout-large-v3', policySha256: digest});
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

test('closed common trace configuration preserves semantic scope and stopping rules', () => {
  assert.equal(policy.captureProfile, 'semantic-task-layout-large-v3');
  assert.deepEqual(policy.config, {
    transferMode: 'ReturnAsStream', streamFormat: 'json', streamCompression: 'gzip', tracingBackend: 'chrome',
    bufferUsageReportingInterval: 1000,
    traceConfig: {recordMode: 'recordUntilFull', traceBufferSizeInKb: 16384, enableSampling: false, enableSystrace: false,
      includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline']},
  });
  assert.equal(policy.capture.bufferStopFraction, 0.9);
  assert.equal(policy.capture.bufferNotificationEntries, 16);
  assert.deepEqual(policy.flags, {performance: false, scoringEligibility: false, FPS: null, cpuTime: null});
  assert.deepEqual(Object.keys(policy).sort(), ['schema', 'captureProfile', 'config', 'capture', 'timing', 'storage', 'decoder', 'schemas', 'flags'].sort());
});

test('bounded capture capacities and wrapper headroom are internally consistent', () => {
  const c = policy.capture;
  assert.deepEqual(c, {compressedBytes: 4194304, decodedBytes: 67108864, base64Characters: 5592408,
    wrapperBytes: 6291456, receiptBytes: 16384, wrapperOverheadBytes: 65536, chunkBytes: 65536,
    maxReads: 4096, bufferStopFraction: 0.9, bufferNotificationEntries: 16});
  assert.equal(c.base64Characters, 4 * Math.ceil(c.compressedBytes / 3));
  assert.equal(c.wrapperBytes - c.base64Characters - c.wrapperOverheadBytes, 633512);
  assert.ok(c.chunkBytes * c.maxReads > c.compressedBytes);
  assert.ok(c.receiptBytes <= c.wrapperOverheadBytes);
  assert.deepEqual(policy.timing, {setupMs: 10000, finishMs: 10000, caseMs: 240000, invocationMs: 1200000, cleanupMs: 30000});
});

test('fixed reservations include independent failure and manifest allowances without double charging', () => {
  const s = policy.storage;
  assert.deepEqual(s.kinds, {'private-case': 32 * MiB, transcript: 16 * MiB, evidence: 2 * MiB,
    result: 2 * MiB, failure: 65536, 'trace-v3': 6 * MiB});
  assert.equal(s.rawFilename, 'aimock-trace-v3-private.json');
  assert.equal(s.invocationFailureFilename, 'invocation-failure-v3.json');
  assert.equal(s.caseBytes, 96 * MiB);
  assert.equal(s.invocationBytes, 6 * 1024 * MiB);
  assert.equal(s.caseFailureReserveBytes, s.kinds.failure);
  assert.equal(s.initialManifestReserveBytes, MiB);
  assert.equal(s.finalManifestReserveBytes, MiB);
  assert.equal(s.invocationFailureReserveBytes, MiB);
  assert.equal(s.filesystemMarginBytes, 1024 * MiB);
  assert.deepEqual(s.declaredCounts, {pilot: 16, full: 48});
  for (const [name, expectedMiB] of [['pilot', 1539], ['full', 4611]]) {
    const reserved = s.declaredCounts[name] * s.caseBytes + s.initialManifestReserveBytes
      + s.finalManifestReserveBytes + s.invocationFailureReserveBytes;
    assert.equal(s.reservedBytes[name], reserved);
    assert.equal(reserved, expectedMiB * MiB);
    assert.ok(reserved < s.invocationBytes);
  }
  assert.equal(s.kinds['trace-v3'], policy.capture.wrapperBytes);
});

test('owned decoder traffic reservation accounts for every bounded stream and overflow probe', () => {
  const d = policy.decoder;
  assert.deepEqual(d, {oldSpaceMiB: 512, observedRssBytes: 1073741824, originalMs: 10000,
    rssIntervalMs: 100, rssReadMs: 250, maxRssQueries: 128, stdoutBytes: 262144, stderrBytes: 65536,
    requestAckBytes: 16384, rssStdoutBytes: 4096, rssStderrBytes: 8192, pipeChunkBytes: 65536,
    ownerReceiptBytes: 16384, originalsBytes: 1048576, stdoutPrefixBytes: 256, stderrPrefixBytes: 1024,
    termToKillMs: 2000, transportReserveBytes: 1917186});
  assert.equal(d.transportReserveBytes, d.requestAckBytes + d.stdoutBytes + d.stderrBytes + 2
    + d.maxRssQueries * (d.rssStdoutBytes + d.rssStderrBytes + 2));
  assert.ok(d.originalsBytes <= policy.storage.kinds.evidence);
});

test('hash binds canonical entire policy, including schema identities', () => {
  assert.equal(serialized, JSON.stringify(canonical(policy)));
  assert.equal(digest, createHash('sha256').update(serialized).digest('hex'));
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.deepEqual(policy.schemas, {receipt: 'aimock-trace-capture-v3', raw: 'aimock-semantic-large-raw-snapshot-v3',
    message: 'aimock-decoder-message-v3', decoded: 'aimock-semantic-large-decoded-v3',
    validation: 'aimock-semantic-large-validation-evidence-v3', owner: 'aimock-decoder-owner-v3', originals: 'aimock-decoder-originals-v3'});
  const changed = JSON.parse(serialized);
  changed.capture.compressedBytes++;
  const changedHash = createHash('sha256').update(JSON.stringify(canonical(changed))).digest('hex');
  assert.notEqual(changedHash, digest);
  assert.throws(() => validateSemanticLargePolicyIdentityV3({...identity(), policySha256: changedHash}), /semantic-large-v3-policy-identity/);
});

test('policy and detached readers are recursively immutable with no shared object identity', () => {
  const first = readSemanticLargePolicyV3(), second = readSemanticLargePolicyV3();
  assert.deepEqual(first, policy);
  function visit(value, other) {
    if (!value || typeof value !== 'object') return;
    assert.ok(Object.isFrozen(value));
    assert.notEqual(value, other);
    for (const key of Object.keys(value)) visit(value[key], other[key]);
  }
  visit(first, policy);
  visit(second, first);
  assert.throws(() => { policy.config.traceConfig.includedCategories.push('v8'); }, TypeError);
  assert.throws(() => { first.capture.compressedBytes = 1; }, TypeError);
  assert.throws(() => readSemanticLargePolicyV3({compressedBytes: 1}), /semantic-large-v3-policy-arguments/);
});

test('identity validation refuses altered profile, schema, digest and all configuration ports', () => {
  const input = identity(), accepted = validateSemanticLargePolicyIdentityV3(input);
  assert.deepEqual(accepted, input);
  assert.notEqual(accepted, input);
  assert.ok(Object.isFrozen(accepted));
  for (const candidate of [null, [], Object.create(null), {...input, schema: 'aimock-trace-capture-v2'},
    {...input, captureProfile: 'semantic-task-layout-v2'}, {...input, policySha256: digest.toUpperCase()},
    {...input, policySha256: '0'.repeat(64)}, {schema: input.schema, captureProfile: input.captureProfile},
    ...['profileConfig', 'budget', 'roster', 'binary', 'root', 'platform', 'stockVersion', 'buildSha256'].map(key => ({...input, [key]: null})),
    {...input, [Symbol('hidden')]: true}, Object.assign(Object.create(input), input)]) {
    assert.throws(() => validateSemanticLargePolicyIdentityV3(candidate), /semantic-large-v3-policy-identity/);
  }
  let read = false;
  const getter = {...input};
  Object.defineProperty(getter, 'policySha256', {get() { read = true; return digest; }, enumerable: true});
  assert.throws(() => validateSemanticLargePolicyIdentityV3(getter), /semantic-large-v3-policy-identity/);
  assert.equal(read, false);
  assert.throws(() => validateSemanticLargePolicyIdentityV3(input, {}), /semantic-large-v3-policy-arguments/);
});

import * as policyApi from './semantic-large-v3-policy.mjs';
test('stock037 format finite relation has exact primitive pairs and arity without touching objects',()=>{
 const relation=policyApi.isSemanticLargeProfileStockVersionV3;assert.equal(typeof relation,'function');assert.equal(relation.length,2);
 for(const [p,v]of [['threadplane','0.3.6'],['threadplane','0.3.7'],['copilotkit',null],['assistant-ui',null],['vercel-ai-sdk',null]])assert.equal(relation(p,v),true);
 const poisonous=new Proxy({},{get(){throw Error('coercion');},getPrototypeOf(){throw Error('reflection');}}),revoked=Proxy.revocable({},{});revoked.revoke();
 for(const p of ['threadplane','copilotkit','assistant-ui','vercel-ai-sdk','vercel-ai','unknown','',null,undefined,0,{},[],new String('threadplane'),poisonous,revoked.proxy])for(const v of ['0.3.6','0.3.7','0.3.8','^0.3.7','0.3.7-beta.1','latest',null,undefined,0,{},[],new String('0.3.7'),poisonous,revoked.proxy])assert.equal(relation(p,v),typeof p==='string'&&(p==='threadplane'?(v==='0.3.6'||v==='0.3.7'):['copilotkit','assistant-ui','vercel-ai-sdk'].includes(p)&&v===null));
 for(const args of [[],['threadplane'],['threadplane','0.3.7',null],['copilotkit',null,undefined]])assert.equal(relation(...args),false);
 assert.equal(digest,'bce01bad127db70b2469209a669b7258f9fa6615e3ef92d5d6c08a763d9b95c5');
});
