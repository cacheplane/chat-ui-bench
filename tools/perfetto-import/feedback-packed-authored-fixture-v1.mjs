// TEST-ONLY authored CSV scaling oracle. Never a trace, origin claim, performance
// observation, production consumer, or capability to process caller-supplied data.
// The candidate is observed immediately before the historical final outputCheck;
// that check still runs, and legacyResult retains the original real refusal.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { authoredGraph, selector } from './feedback-observations-fixtures.mjs';
import { exportCompactGraphV2 } from './feedback-observations-compact-fixtures-v2.mjs';
import { evaluateBrowserFeedbackObservationsCapacityV3 as evaluate } from './feedback-observations-capacity-core-v3.mjs';

const coreURL = new URL('./feedback-observations-capacity-core-v3.mjs', import.meta.url);
const modelURL = new URL('./feedback-observations-capacity-source-model-v3.json', import.meta.url);
const pins = [
  [coreURL, 'eca4313c09dc65b8fe9e40fb822cbad3834666327888292458b97c3d6d344697'],
  [modelURL, '02807672dea27faa9f09bb1bc820c629d25ff97713b972d8f45b16f919c887ca'],
];
function assertSourcePins() {
  for (const [url, pin] of pins)
    assert.equal(createHash('sha256').update(readFileSync(url)).digest('hex'), pin, 'historical source pin');
}
assertSourcePins();
let source = readFileSync(coreURL, 'utf8');
const importSite = '"./feedback-observations-capacity-source-model-v3.json"';
const finalSite = '    outputCheck(result, work);\n    return freeze(result);';
assert.equal(source.split(importSite).length - 1, 1, 'unique policy import');
assert.equal(source.split(finalSite).length - 1, 1, 'unique complete final output check');
assert.equal(source.split('    outputCheck({ diagnostics: result.diagnostics }, work);').length - 1, 1, 'early diagnostics check retained');
// Only trusted, hash-pinned repository source is imported. No input text is code.
// The observer's closure is private to this module, and resets between calls.
source = source.replace(importSite, JSON.stringify(modelURL.href))
  .replace(finalSite, '    authoredCandidate = result;\n' + finalSite)
  + '\nlet authoredCandidate;\nexport function takeAuthoredCandidate() { const candidate = authoredCandidate; authoredCandidate = undefined; return candidate; }\n';
const inspected = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function makePackedFeedbackAuthoredFixtureV1(options = {}) {
  assert.ok(options && Object.getPrototypeOf(options) === Object.prototype, 'plain authored options');
  const allowed = new Set(['presentations', 'aggregateMembers', 'extraReporterArguments']);
  for (const key of Reflect.ownKeys(options)) {
    assert.ok(allowed.has(key), 'only authored scaling options');
    assert.ok(Object.hasOwn(Object.getOwnPropertyDescriptor(options, key), 'value'), 'data options only');
  }
  const { presentations = 120, aggregateMembers = 24, extraReporterArguments = 0 } = options;
  for (const [value, min, max] of [[presentations, 1, 480], [aggregateMembers, 2, 24], [extraReporterArguments, 0, 24]])
    assert.ok(Number.isSafeInteger(value) && value >= min && value <= max, 'bounded authored scaling');
  assertSourcePins();
  const graph = authoredGraph(), templates = graph.nodes.slice(4), start = 1000000000n;
  graph.nodes = graph.nodes.slice(0, 4);
  graph.nodes[2].ts = String(start);
  graph.nodes[3].ts = String(start + 2000000000n);
  graph.bounds = ['0', '4000000000'];
  graph.derived = [];
  for (let i = 0; i < presentations; i++) {
    const ids = new Map(templates.map(node => [node.id, String(1000 + i * 10 + Number(node.id))]));
    const offset = start + BigInt(i) * (2000000000n / BigInt(presentations));
    for (const template of templates) {
      const node = structuredClone(template);
      node.id = ids.get(node.id);
      node.argSet = node.id;
      node.ts = String(offset + BigInt(node.ts) * 1000n);
      node.dur = String(BigInt(node.dur) * 1000n);
      if (node.parent) node.parent = ids.get(node.parent);
      for (const arg of node.args) {
        if (arg.key.includes('surface_frame_trace_id') && arg.i === '51') arg.i = String(1000000 + i * 2);
        if (arg.key.includes('surface_frame_trace_id') && arg.i === '52') arg.i = String(1000001 + i * 2);
        if (arg.key.includes('display_trace_id')) arg.i = String(2000000 + i);
      }
      if (node.name === 'Graphics.Pipeline' && node.args.some(arg => arg.s === 'STEP_SURFACE_AGGREGATION')) {
        const member = node.args.at(-1);
        for (let j = 2; j < aggregateMembers; j++)
          node.args.push({ ...member, key: member.key.replace('[1]', `[${j}]`), i: String(3000000 + i * aggregateMembers + j) });
      }
      if (node.name === 'PipelineReporter') for (let j = 0; j < extraReporterArguments; j++)
        node.args.push({ flat: `frame_reporter.authored_extra_${j}`, key: `frame_reporter.authored_extra_${j}`, type: 'string', i: null, s: 'AUTHORED_EXTRA_é_😀', r: null });
      graph.nodes.push(node);
    }
    graph.derived.push([String(1000000 + i * 2), String(2000000 + i)]);
  }
  const encoded = exportCompactGraphV2(graph);
  const targetCSV = encoded.target.bytes, scopeCSV = encoded.scope.bytes;
  const legacyResult = evaluate(targetCSV, scopeCSV, selector);
  assert.equal(inspected.takeAuthoredCandidate(), undefined, 'no previous candidate');
  const inspectedResult = inspected.evaluateBrowserFeedbackObservationsCapacityV3(targetCSV, scopeCSV, selector);
  const canonicalCandidate = inspected.takeAuthoredCandidate();
  assert.deepEqual(inspectedResult, legacyResult, 'source observation preserves actual final result');
  assert.ok(canonicalCandidate && canonicalCandidate.status === 'observed' && Array.isArray(canonicalCandidate.events), 'complete final candidate only');
  assert.equal(canonicalCandidate.events.length, presentations);
  if (legacyResult.status === 'observed') assert.deepEqual(canonicalCandidate, legacyResult);
  else {
    assert.equal(legacyResult.stage, 'limits');
    assert.ok(['result-width', 'result-nodes'].includes(legacyResult.reason));
  }
  assertSourcePins();
  // Freeze logical arrays/objects; retain real Buffer bytes without converting or
  // freezing their typed-array elements. Each call allocates fresh byte buffers.
  freeze(canonicalCandidate);
  return Object.freeze({ authoredFixture: true, targetCSV, scopeCSV, selector, legacyResult, canonicalCandidate });
}
