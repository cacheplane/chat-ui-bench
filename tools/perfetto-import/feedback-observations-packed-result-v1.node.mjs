// Authored codec cases only. No trace records, execution receipts, or source authority.
import test from "node:test";
import assert from "node:assert/strict";
import { makePackedFeedbackAuthoredFixtureV1 } from "./feedback-packed-authored-fixture-v1.mjs";
import { authoredGraph, argument, selector } from "./feedback-observations-fixtures.mjs";
import { exportCompactGraphV2 } from "./feedback-observations-compact-fixtures-v2.mjs";
import { evaluateBrowserFeedbackObservationsCapacityV3 } from "./feedback-observations-capacity-core-v3.mjs";
const codec = await import("./feedback-observations-packed-result-v1.mjs").catch(() => ({}));
const account = () => codec.createPackedResultAccountV1();
function materialize(e) {
  let p = 0;
  function uint() {
    const q = e.body.indexOf(":", p), n = Number(e.body.slice(p, q));
    p = q + 1;
    return n;
  }
  function value() {
    const t = e.body[p++];
    if (t === "z") return null;
    if (t === "t") return true;
    if (t === "f") return false;
    const n = uint();
    if (t === "s") return e.strings[n];
    if (t === "n") {
      const v2 = Number(e.body.slice(p, p + n));
      p += n;
      return v2;
    }
    if (t === "a") return Array.from({ length: n }, value);
    const o = {};
    for (const k of e.shapes[n]) Object.defineProperty(o, e.strings[k], { value: value(), enumerable: true, configurable: true, writable: true });
    return o;
  }
  const v = value();
  assert.equal(p, e.body.length);
  return v;
}
function compare(a, b) {
  assert.equal(typeof a, typeof b);
  if (a === null || typeof a !== "object") {
    assert.ok(Object.is(a, b));
    return;
  }
  assert.equal(Array.isArray(a), Array.isArray(b));
  assert.deepEqual(Object.keys(a), Object.keys(b));
  for (const k of Object.keys(a)) compare(a[k], b[k]);
}
const cases = [];
const add = (name, value) => cases.push([name, value]);
for (const [name, v] of [["null", null], ["true", true], ["false", false], ["zero", 0], ["one", 1], ["minus-one", -1], ["max-safe", 9007199254740991], ["min-safe", -9007199254740991], ["ten", 10], ["minus-ten", -10], ["int32", 2147483647], ["uint32", 4294967295], ["int32-negative", -2147483648], ["safe-near-max", 9007199254740990], ["safe-near-min", -9007199254740990]]) add(`primitive/${name}`, v);
const unicode = [["empty", ""], ["ascii", "authored"], ["quote", '"'], ["backslash", "\\"], ["backspace", "\b"], ["tab", "	"], ["newline", "\n"], ["formfeed", "\f"], ["return", "\r"], ["nul", "\0"], ["control", ""], ["two-byte", "\xE9"], ["three-byte", "\u96EA"], ["pair", "\u{1F600}"], ["lone-high", "\uD800"], ["lone-low", "\uDFFF"], ["adjacent-high", "\uD800\uD801"], ["mixed-surrogates", "\uD800\u{1F600}\uDFFF"], ["separators", "\u2028\u2029"], ["slash", "/"]];
for (const [n, v] of unicode) add(`unicode/${n}`, v);
const nullProto = /* @__PURE__ */ Object.create(null);
nullProto.a = "x";
const protoKey = {};
Object.defineProperty(protoKey, "__proto__", { value: "own", enumerable: true });
const alias = { v: "same" };
let depth = 0;
for (let i = 0; i < 64; i++) depth = [depth];
for (const [n, v] of [["empty-array", []], ["empty-object", {}], ["null-prototype", nullProto], ["proto-key", protoKey], ["alias", [alias, alias]], ["depth64", depth], ["ordered", { z: 1, a: 2 }], ["index-order", { "10": 1, "2": 2, a: 3 }], ["index-boundaries", { "4294967295": 1, "4294967294": 2, "01": 3, "-0": 4 }], ["nested-shapes", { a: { b: 1 }, b: 2 }], ["repeat-shapes", [{ a: 1 }, { a: 2 }]], ["different-shapes", [{ a: 1, b: 2 }, { b: 2, a: 1 }]], ["shape-key-first", { a: "b", b: "a" }], ["array-bools", [true, false, null]], ["object-array", { a: [1, 2] }], ["array-object", [{ a: 1 }]], ["nested-empty", [{}, []]], ["toJSON-data", { toJSON: "data" }], ["unicode-key", { "\uD800": "\u{1F600}" }], ["duplicates", [alias, alias, alias]]]) add(`structure/${n}`, v);
const graphChecks = [];
const reporter = (graph) => graph.nodes.find((node) => node.name === "PipelineReporter");
const reporterArgument = (graph, key) => reporter(graph).args.find((arg) => arg.key === key);
function addGraphCase(name, mutate, check) {
  const graph = authoredGraph();
  mutate(graph);
  const exported = exportCompactGraphV2(graph);
  const value = evaluateBrowserFeedbackObservationsCapacityV3(exported.target.bytes, exported.scope.bytes, selector);
  assert.equal(value.status, "observed", `${name}: ${value.stage}/${value.reason}`);
  add(`complete-graph/${name}`, value);
  graphChecks.push([name, value, check]);
}
function addScaledGraphCase(population) {
  const f = makePackedFeedbackAuthoredFixtureV1({ presentations: population, aggregateMembers: 2 });
  assert.equal(f.legacyResult.status, "observed");
  assert.equal(JSON.stringify(f.legacyResult), JSON.stringify(f.canonicalCandidate));
  add(`complete-graph/population-${population}`, f.legacyResult);
  graphChecks.push([`population-${population}`, f.legacyResult, (value) => {
    assert.equal(value.count, String(population));
    assert.equal(value.events.length, population);
  }]);
}
const assertCount = (value, count) => assert.equal(value.count, String(count));
const aggregate = (graph) => graph.nodes.find((node) => node.args.some((arg) => arg.s === "STEP_SURFACE_AGGREGATION"));
const members = (value) => value.events[0].aggregationReferences[0].members;
addGraphCase("baseline", () => {
}, (value) => {
  assertCount(value, 1);
  assert.equal(value.events[0].reporters.length, 1);
  assert.equal(members(value).length, 2);
});
addScaledGraphCase(2);
addScaledGraphCase(3);
for (const fanout of [3, 5]) addGraphCase(`aggregation-fanout-${fanout}`, (graph) => {
  for (let index = 2; index < fanout; index++) aggregate(graph).args.push(argument(`chrome_graphics_pipeline.aggregated_surface_frame_trace_ids[${index}]`, "int", 51 + index));
}, (value) => {
  assertCount(value, 1);
  assert.equal(members(value).length, fanout);
});
for (const count of [2, 3]) addGraphCase(`reporters-${count}-including-partial`, (graph) => {
  for (let index = 1; index < count; index++) {
    const n = structuredClone(reporter(graph));
    n.id = String(20 + index);
    n.argSet = n.id;
    n.args.find((arg) => arg.key === "frame_reporter.state").s = "STATE_PRESENTED_PARTIAL";
    graph.nodes.push(n);
  }
}, (value) => {
  assertCount(value, 1);
  assert.equal(value.events[0].reporters.length, count);
  assert.equal(value.coverage.reporterStates.STATE_PRESENTED_PARTIAL, count - 1);
});
addGraphCase("classification-normal", (graph) => reporterArgument(graph, "frame_reporter.frame_type").s = "NORMAL", (value) => assert.equal(value.coverage.frameTypes.NORMAL, 1));
addGraphCase("classification-extra-string", (graph) => reporter(graph).args.push(argument("frame_reporter.authored_note", "string", "AUTHORED_CLASSIFICATION")), (value) => assert.equal(value.coverage.reporterReferences[0].classifications.find((arg) => arg.key === "frame_reporter.authored_note").stringValue, "AUTHORED_CLASSIFICATION"));
addGraphCase("classification-extra-integer", (graph) => reporter(graph).args.push(argument("frame_reporter.authored_flags", "uint", 7)), (value) => assert.equal(value.coverage.reporterReferences[0].classifications.find((arg) => arg.key === "frame_reporter.authored_flags").intValue, "7"));
addGraphCase("nonpositive-dropped", (graph) => reporterArgument(graph, "frame_reporter.state").s = "STATE_DROPPED", (value) => {
  assertCount(value, 0);
  assert.equal(value.coverage.successfulDisplays.nonpositive, 1);
});
addGraphCase("nonpositive-unclosed", (graph) => {
  reporterArgument(graph, "frame_reporter.state").s = "STATE_DROPPED";
  reporter(graph).dur = "-1";
}, (value) => {
  assertCount(value, 0);
  assert.equal(value.coverage.successfulDisplays.unclosedNonpositive, 1);
});
for (const [name, terminal, category, count] of [["outside-before-start", 99, "before", 0], ["endpoint-exact-end", 400, "after", 0], ["outside-after-end", 450, "after", 0], ["endpoint-exact-start", 100, "inside", 1]]) addGraphCase(name, (graph) => reporter(graph).dur = String(terminal - 90), (value) => {
  assertCount(value, count);
  assert.equal(value.coverage.successfulDisplays[category], 1);
  if (count) assert.equal(value.events[0].terminalTs, String(terminal));
  else assert.equal(value.coverage.outsideIntervalReporters[0].terminalTs, String(terminal));
});
addGraphCase("foreign-process-reporter", (graph) => {
  const n = structuredClone(reporter(graph));
  n.id = "30";
  n.argSet = "30";
  n.upid = "999";
  n.pid = "999";
  graph.nodes.push(n);
}, (value) => {
  assertCount(value, 1);
  assert.equal(value.coverage.successfulDisplays.foreign, 1);
  assert.equal(value.coverage.reporterReferences.length, 2);
});
addGraphCase("foreign-tree-reporter", (graph) => reporterArgument(graph, "frame_reporter.layer_tree_host_id").i = "8", (value) => {
  assertCount(value, 0);
  assert.equal(value.coverage.successfulDisplays.foreign, 1);
});
addGraphCase("source-stat-warning", (graph) => {
  graph.stats = [["unknown_future_error", "0", "error", "trace", "1"]];
  graph.scopeStats = structuredClone(graph.stats);
}, (value) => {
  assertCount(value, 1);
  assert.equal(value.diagnostics.stats.target[0].name, "unknown_future_error");
});
addGraphCase("reporter-multiline-literal-null", (graph) => reporter(graph).args.push(argument("authored.note", "string", "[NULL]"), argument("authored.multiline", "string", 'a,"b"\nc')), (value) => {
  const args = value.events[0].reporters[0].arguments;
  assert.equal(args.find((arg) => arg.key === "authored.note").stringValue, "[NULL]");
  assert.equal(args.find((arg) => arg.key === "authored.multiline").stringValue, 'a,"b"\nc');
});
let seed = 38177486;
function random() {
  seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
  return seed;
}
function tree(d) {
  if (!d) return [null, true, false, random() % 1e4, unicode[random() % unicode.length][1]][random() % 5];
  if (random() % 2) return Array.from({ length: random() % 4 }, () => tree(d - 1));
  const o = {};
  for (let i = 0, n = random() % 4; i < n; i++) o[`k${i}`] = tree(d - 1);
  return o;
}
for (let i = 0; i < 20; i++) add(`seeded/2468ace-${String(i).padStart(2, "0")}`, tree(4));
assert.equal(cases.length, 95);
test("codec exports the bounded account and private view API", () => {
  for (const name of ["createPackedResultAccountV1", "chargePackedResultWorkV1", "packFeedbackResultV1", "validatePackedResultV1", "readPackedFeedbackSummaryV1", "readPackedFeedbackEventV1", "meterPackedCompositionV1", "parsePackedResultBytesV1"]) assert.equal(typeof codec[name], "function", name);
});
for (const [name, v] of cases) test(`parity: ${name}`, () => {
  const a = account(), e = codec.packFeedbackResultV1(v, a), view = codec.validatePackedResultV1(e, a);
  assert.ok(Object.isFrozen(view));
  assert.deepEqual(Object.keys(view), []);
  compare(v, materialize(e));
  assert.equal(JSON.stringify(v), JSON.stringify(materialize(e)));
  assert.deepEqual(codec.packFeedbackResultV1(materialize(e), account()), e);
  codec.parsePackedResultBytesV1(Buffer.from(JSON.stringify(e)), account());
});
const raw = (body, strings = [], shapes = []) => ({ schema: "browser-feedback-packed-result-v1", strings, shapes, body });
for (const [n, v] of [["negative-zero", -0], ["fraction", 1.5], ["unsafe", 9007199254740992], ["infinity", Infinity], ["nan", NaN], ["undefined", void 0], ["bigint", 1n], ["function", () => {
}], ["hole", Array(1)], ["extra-array", Object.assign([], { extra: 1 })], ["custom-prototype", /* @__PURE__ */ new Date()], ["symbol", Object.assign({}, { [/* @__PURE__ */ Symbol()]: 1 })], ["nonenumerable", Object.defineProperty({}, "hidden", { value: 1 })], ["accessor", Object.defineProperty({}, "x", { get() {
  throw Error("invoked");
}, enumerable: true })], ["proxy", new Proxy({}, { ownKeys() {
  throw Error("trap invoked");
} })], ["cycle", (() => {
  const a = {};
  a.a = a;
  return a;
})()]]) test(`reject input/${n}`, () => assert.throws(() => codec.packFeedbackResultV1(v, account()), /packed-invalid-proof/));
for (const [n, e] of [["unknown-tag", raw("q")], ["eof", raw("zz")], ["non-ascii", raw("\xE9")], ["leading-zero", raw("a00:")], ["uint-sign", raw("a+1:z")], ["uint-huge", raw("a999999999999999999999999999999999:")], ["uint-space", raw("a 0:")], ["missing-colon", raw("a0")], ["missing-element", raw("a1:")], ["string-ref", raw("s0:")], ["shape-ref", raw("o0:")], ["unused-string", raw("z", ["unused"])], ["duplicate-string", raw("s0:", ["x", "x"])], ["first-string", raw("a2:s1:s0:", ["x", "y"])], ["unused-shape", raw("z", [], [[]])], ["duplicate-shape", raw("a2:o0:o1:", [], [[], []])], ["first-shape", raw("a2:o1:o0:", [], [[], []])], ["duplicate-key", raw("o0:zz", ["a"], [[0, 0]])], ["index-order", raw("o0:zz", ["2", "1"], [[0, 1]])], ["shape-key-after-value", raw("o0:s0:", ["v", "k"], [[1]])], ["number-negative-zero", raw("n2:-0")], ["number-exponent", raw("n3:1e2")], ["number-fraction", raw("n3:1.5")], ["number-unsafe", raw("n16:9007199254740992")], ["number-leading-zero", raw("n2:01")]]) test(`reject wire/${n}`, () => assert.throws(() => codec.validatePackedResultV1(e, account())));
test("private views and accounts reject structural forgeries", () => {
  assert.throws(() => codec.chargePackedResultWorkV1({}, 1));
  assert.throws(() => codec.readPackedFeedbackSummaryV1({}));
  assert.throws(() => codec.meterPackedCompositionV1({}, {}));
});
test("the shared work cap is fixed, sticky, and debited before operations", () => {
  const a = account();
  codec.chargePackedResultWorkV1(a, 67108864);
  assert.throws(() => codec.packFeedbackResultV1(null, a), /logical-work-limit/);
  assert.throws(() => codec.chargePackedResultWorkV1(a, 0), /logical-work-limit/);
  const b = account();
  assert.throws(() => codec.chargePackedResultWorkV1(b, 67108865), /logical-work-limit/);
  assert.throws(() => codec.chargePackedResultWorkV1(b, 0), /logical-work-limit/);
});
test("summary and event projection retain only fixed data and share account", () => {
  const v = cases.find(([n]) => n === "complete-graph/baseline")[1], a = account(), view = codec.validatePackedResultV1(codec.packFeedbackResultV1(v, a), a), s = codec.readPackedFeedbackSummaryV1(view);
  assert.deepEqual(s, { status: v.status, count: v.count, interval: v.interval, eventCount: v.events.length });
  assert.deepEqual(codec.readPackedFeedbackEventV1(view, 0), { index: 0, displayTraceId: v.events[0].displayTraceId, terminalTs: v.events[0].terminalTs });
  assert.throws(() => codec.readPackedFeedbackEventV1(view, 1));
  assert.ok(Object.isFrozen(s.interval));
});
test("error identity and fixed stage/reason contract", () => {
  assert.equal(typeof codec.PackedResultError, "function");
  for (const operation of [() => codec.validatePackedResultV1(raw("q"), account()), () => codec.readPackedFeedbackSummaryV1({})]) assert.throws(operation, (e) => e instanceof codec.PackedResultError && e.reason === "packed-invalid-proof" && e.stage === "output");
  assert.throws(() => codec.chargePackedResultWorkV1(account(), -1), (e) => e.reason === "logical-work-limit" && e.stage === "limits");
});
test("canonical byte admission rejects BOM, whitespace, invalid UTF8 and duplicate outer fields", () => {
  const text = JSON.stringify(raw("z"));
  for (const bytes of [Buffer.from("\uFEFF" + text), Buffer.from(text + "\n"), Buffer.from(" " + text), Buffer.from([255]), Buffer.from(text.replace('"body":"z"', '"body":"z","body":"z"'))]) assert.throws(() => codec.parsePackedResultBytesV1(bytes, account()));
});
test("depth64 permits an empty container and refuses child65", () => {
  let empty = [], leaf = 0;
  for (let i = 0; i < 64; i++) {
    empty = [empty];
    leaf = [leaf];
  }
  codec.validatePackedResultV1(codec.packFeedbackResultV1(empty, account()), account());
  codec.packFeedbackResultV1(leaf, account());
  assert.throws(() => codec.packFeedbackResultV1([leaf], account()), /packed-logical-depth/);
  assert.throws(() => codec.validatePackedResultV1(raw("a1:".repeat(65) + "z"), account()), /packed-logical-depth/);
});
test("wire body string cap refuses before any oversized joined body", () => {
  assert.throws(() => codec.packFeedbackResultV1(Array.from({ length: 262143 }, () => 1234), account()), /packed-wire-(strings|nodes)/);
});
test("validated view snapshots caller metadata and body", () => {
  const e = structuredClone(codec.packFeedbackResultV1(cases.find(([n]) => n === "complete-graph/baseline")[1], account())), view = codec.validatePackedResultV1(e, account());
  e.strings.fill("tampered");
  e.shapes.length = 0;
  e.body = "z";
  assert.equal(codec.readPackedFeedbackSummaryV1(view).count, "1");
  assert.equal(codec.readPackedFeedbackEventV1(view, 0).terminalTs, "300");
});
test("wire and logical public policy constants remain frozen", () => assert.deepEqual(codec.PACKED_RESULT_LIMITS_V1, { wireBytes: 1048576, wireNodes: 65536, wireStringBytes: 524288, logicalBytes: 4194304, logicalNodes: 262144, logicalEdges: 262143, logicalStringBytes: 4194304, maxDepth: 64, work: 67108864, eventOffsets: 8192, fixedOffsets: 64, offsetEntries: 8256, offsetBytes: 132096 }));
test("logical nodes at262144 pass and262145 refuse independently of small wire", () => {
  codec.validatePackedResultV1(raw("a262143:" + "z".repeat(262143)), account());
  assert.throws(() => codec.validatePackedResultV1(raw("a262144:" + "z".repeat(262144)), account()), /packed-logical-nodes/);
});
test("logical JSON bytes at4194304 pass and4194305 refuse with wire headroom", () => {
  const values = Array(1024).fill("x".repeat(4093));
  values[1023] = "x".repeat(4092);
  assert.equal(Buffer.byteLength(JSON.stringify(values)), 4194304);
  codec.validatePackedResultV1(codec.packFeedbackResultV1(values, account()), account());
  values[1023] += "x";
  assert.throws(() => codec.packFeedbackResultV1(values, account()), /packed-logical-bytes/);
});
test("logical string cap is dominated: every nonempty JSON string adds two quote bytes", () => {
  assert.equal(codec.PACKED_RESULT_LIMITS_V1.logicalBytes, codec.PACKED_RESULT_LIMITS_V1.logicalStringBytes);
  const s = "x".repeat(4194304);
  assert.throws(() => codec.packFeedbackResultV1(s, account()), /packed-logical-bytes/);
});
test("wire nodes are odd:65535 pass and cap+1=65537 refuse", () => {
  const view = codec.validatePackedResultV1(raw("z"), account()), v = [Array(32765).fill(null), null];
  assert.equal(codec.meterPackedCompositionV1(view, v).nodes, 65535);
  v.push(null);
  assert.throws(() => codec.meterPackedCompositionV1(view, v), /packed-wire-nodes/);
});
test("wire composition string bytes at524288 pass and524289 refuse", () => {
  const view = codec.validatePackedResultV1(raw("z"), account());
  assert.equal(codec.meterPackedCompositionV1(view, "x".repeat(524288)).stringBytes, 524288);
  assert.throws(() => codec.meterPackedCompositionV1(view, "x".repeat(524289)), /packed-wire-strings/);
});
test("wire conservative bytes at1048576 pass and1048577 refuse", () => {
  const view = codec.validatePackedResultV1(raw("z"), account());
  const v = "\0".repeat(174762) + "xx";
  assert.equal(codec.meterPackedCompositionV1(view, v).bytes, 1048576);
  assert.throws(() => codec.meterPackedCompositionV1(view, v + "x"), /packed-wire-bytes/);
});
test("offsets at8192 pass and8193 refuse before declared-count allocation", () => {
  const e = codec.packFeedbackResultV1({ events: Array.from({ length: 8192 }, () => ({ displayTraceId: "0", terminalTs: "0" })) }, account());
  const view = codec.validatePackedResultV1(e, account());
  assert.deepEqual(codec.readPackedFeedbackEventV1(view, 8191), { index: 8191, displayTraceId: "0", terminalTs: "0" });
  const bad = structuredClone(e);
  bad.body = bad.body.replace("a8192:", "a8193:");
  assert.throws(() => codec.validatePackedResultV1(bad, account()), /packed-offsets/);
});
test("malformed values in unselected root fields still refuse", () => {
  const e = codec.packFeedbackResultV1({ events: [], count: "0", status: "observed", interval: { startTs: "0", endTs: "1", durationNs: "1", membership: "terminal-in-[start,end)" }, unselected: null }, account());
  const bad = structuredClone(e);
  bad.body = bad.body.slice(0, -1) + "q";
  assert.throws(() => codec.validatePackedResultV1(bad, account()));
});
test("cross-Python portable vectors preserve all95 canonical JSON byte sequences", async () => {
  const { spawnSync } = await import("node:child_process");
  const program = String.raw`
import sys,json
items=json.load(sys.stdin)
def quote(s):
 out=['"']; i=0
 short={8:'\\b',9:'\\t',10:'\\n',12:'\\f',13:'\\r'}
 while i<len(s):
  n=ord(s[i]); i+=1
  if n==34: out.append('\\"')
  elif n==92: out.append('\\\\')
  elif n in short: out.append(short[n])
  elif n<32: out.append('\\u%04x'%n)
  elif 0xd800<=n<=0xdbff and i<len(s) and 0xdc00<=ord(s[i])<=0xdfff:
   low=ord(s[i]); i+=1; out.append(chr(0x10000+(n-0xd800)*1024+low-0xdc00))
  elif 0xd800<=n<=0xdfff: out.append('\\u%04x'%n)
  else: out.append(chr(n))
 out.append('"'); return ''.join(out)
def canonical(v):
 if v is None: return 'null'
 if v is True: return 'true'
 if v is False: return 'false'
 if isinstance(v,int):
  assert abs(v)<=9007199254740991
  return str(v)
 if isinstance(v,str): return quote(v)
 if isinstance(v,list): return '['+','.join(canonical(x) for x in v)+']'
 return '{'+','.join(quote(k)+':'+canonical(x) for k,x in v.items())+'}'
def decode(e):
 b=e['body']; p=0
 def uint():
  nonlocal p
  q=b.index(':',p); text=b[p:q]; assert text=='0' or (text[0] in '123456789' and text.isascii() and text.isdigit())
  p=q+1; return int(text)
 def value():
  nonlocal p
  t=b[p]; p+=1
  if t=='z': return None
  if t=='t': return True
  if t=='f': return False
  n=uint()
  if t=='s': return e['strings'][n]
  if t=='n':
   text=b[p:p+n]; p+=n; result=int(text); assert str(result)==text and abs(result)<=9007199254740991; return result
  if t=='a': return [value() for _ in range(n)]
  assert t=='o'; return {e['strings'][k]:value() for k in e['shapes'][n]}
 result=value(); assert p==len(b); return result
json.dump([canonical(decode(e)).encode('utf-8').hex() for e in items],sys.stdout)
`;
  const envelopes = cases.map(([, value]) => codec.packFeedbackResultV1(value, account()));
  const r = spawnSync("/usr/bin/python3", ["-I", "-S", "-B", "-c", program], { input: JSON.stringify(envelopes), encoding: "utf8", maxBuffer: 10485760 });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), cases.map(([, v]) => Buffer.from(JSON.stringify(v)).toString("hex")));
});
for (const [name, units, operation] of [
  ["pack-null", 331, (a) => codec.packFeedbackResultV1(null, a)],
  ["pack-string", 364, (a) => codec.packFeedbackResultV1("x", a)],
  ["pack-shape", 472, (a) => codec.packFeedbackResultV1({ a: "x" }, a)],
  ["validate-null", 259, (a) => codec.validatePackedResultV1(raw("z"), a)],
  ["validate-shape", 420, (a) => codec.validatePackedResultV1(raw("o0:s1:", ["a", "x"], [[0]]), a)],
  ["validate-and-compose-null", 262, (a) => codec.meterPackedCompositionV1(codec.validatePackedResultV1(raw("z"), a), null)]
]) test(`exact shared work schedule/${name}/${units}`, () => {
  const a = account();
  codec.chargePackedResultWorkV1(a, 67108864 - units);
  operation(a);
  codec.chargePackedResultWorkV1(a, 0);
  assert.throws(() => codec.chargePackedResultWorkV1(a, 1), /logical-work-limit/);
  const b = account();
  codec.chargePackedResultWorkV1(b, 67108864 - units + 1);
  assert.throws(() => operation(b), /logical-work-limit/);
  assert.throws(() => codec.chargePackedResultWorkV1(b, 0), /logical-work-limit/);
});
test("byte admission rejects proxy before prototype traps and avoids byteLength getters", () => {
  let traps = 0;
  const proxy = new Proxy(new Uint8Array(), { getPrototypeOf() {
    traps++;
    throw Error("prototype trap");
  } });
  assert.throws(() => codec.parsePackedResultBytesV1(proxy, account()), /packed-invalid-proof/);
  assert.equal(traps, 0);
  const bytes = Buffer.from(JSON.stringify(raw("z")));
  Object.defineProperty(bytes, "byteLength", { get() {
    traps++;
    throw Error("length getter");
  } });
  codec.parsePackedResultBytesV1(bytes, account());
  assert.equal(traps, 0);
});
test("later account exhaustion refuses queries and preserves earlier frozen summary", () => {
  const v = cases.find(([n]) => n === "complete-graph/baseline")[1], a = account(), view = codec.validatePackedResultV1(codec.packFeedbackResultV1(v, a), a), summary = codec.readPackedFeedbackSummaryV1(view);
  assert.throws(() => codec.chargePackedResultWorkV1(a, 67108864), /logical-work-limit/);
  assert.throws(() => codec.readPackedFeedbackSummaryV1(view), /logical-work-limit/);
  assert.throws(() => codec.readPackedFeedbackEventV1(view, 0), /logical-work-limit/);
  assert.throws(() => codec.meterPackedCompositionV1(view, null), /logical-work-limit/);
  assert.equal(summary.count, "1");
  assert.ok(Object.isFrozen(summary));
});
test("persisted byte cap+1 refuses before malformedUTF8 decoding", () => assert.throws(() => codec.parsePackedResultBytesV1(Buffer.alloc(1048577, 255), account()), /packed-wire-bytes/));
for (const presentations of [120, 240, 480]) test(`authored scaled complete proof/${presentations}x24`, async () => {
  const { makePackedFeedbackAuthoredFixtureV1: makePackedFeedbackAuthoredFixtureV12 } = await import("./feedback-packed-authored-fixture-v1.mjs"), f = makePackedFeedbackAuthoredFixtureV12({ presentations, aggregateMembers: 24 });
  assert.equal(f.canonicalCandidate.status, "observed");
  const a = account();
  if (presentations === 480) {
    assert.throws(() => codec.packFeedbackResultV1(f.canonicalCandidate, a), /packed-wire-strings/);
    return;
  }
  const e = codec.packFeedbackResultV1(f.canonicalCandidate, a), view = codec.validatePackedResultV1(e, a);
  compare(f.canonicalCandidate, materialize(e));
  assert.equal(codec.readPackedFeedbackSummaryV1(view).eventCount, presentations);
  for (let i = 0; i < presentations; i++) {
    const r = codec.readPackedFeedbackEventV1(view, i);
    assert.equal(r.displayTraceId, f.canonicalCandidate.events[i].displayTraceId);
    assert.equal(r.terminalTs, f.canonicalCandidate.events[i].terminalTs);
  }
  codec.meterPackedCompositionV1(view, { authoredStructuralProof: e });
  codec.meterPackedCompositionV1(view, { authoredStructuralProof: e, publication: { path: "/private/tmp/authored-result.json", bytes: 123456, sha256: "0".repeat(64) } });
});
test("raw shape metadata refuses negativezero dictionary indices", () => assert.throws(() => codec.validatePackedResultV1(raw("o0:z", ["x"], [[-0]]), account()), /packed-invalid-proof/));
test("event query refuses negativezero index without normalizing to first event", () => {
  const v = cases.find(([n]) => n === "complete-graph/baseline")[1], a = account(), view = codec.validatePackedResultV1(codec.packFeedbackResultV1(v, a), a);
  assert.throws(() => codec.readPackedFeedbackEventV1(view, -0), /packed-invalid-proof/);
});
for (const [name, events] of [
  ["leading-null", [null, { displayTraceId: "AUTHORED_SECOND", terminalTs: "0" }]],
  ["middle-null", [{ displayTraceId: "AUTHORED_FIRST", terminalTs: "0" }, null, { displayTraceId: "AUTHORED_THIRD", terminalTs: "1" }]],
  ["trailing-null", [{ displayTraceId: "AUTHORED_FIRST", terminalTs: "0" }, null]],
  ["leading-string", ["authored-scalar", { displayTraceId: "AUTHORED_SECOND", terminalTs: "0" }]],
  ["leading-number", [7, { displayTraceId: "AUTHORED_SECOND", terminalTs: "0" }]],
  ["leading-boolean", [false, { displayTraceId: "AUTHORED_SECOND", terminalTs: "0" }]],
  ["middle-array", [{ displayTraceId: "AUTHORED_FIRST", terminalTs: "0" }, [], { displayTraceId: "AUTHORED_THIRD", terminalTs: "1" }]]
]) test(`event ordinal preservation/${name}`, () => {
  const proof = { status: "observed", count: String(events.length), interval: { startTs: "0", endTs: "2", durationNs: "2", membership: "terminal-in-[start,end)" }, events }, a = account(), view = codec.validatePackedResultV1(codec.packFeedbackResultV1(proof, a), a);
  assert.equal(codec.readPackedFeedbackSummaryV1(view).eventCount, events.length);
  for (let index = 0; index < events.length; index++) {
    const expected = events[index];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) assert.deepEqual(codec.readPackedFeedbackEventV1(view, index), { index, ...expected });
    else assert.throws(() => codec.readPackedFeedbackEventV1(view, index), /packed-invalid-proof/);
  }
  assert.throws(() => codec.readPackedFeedbackEventV1(view, events.length), /packed-invalid-proof/);
});
test("complete authored graph matrix contains20 genuinely distinct canonical results", () => {
  const graphs = cases.filter(([name]) => name.startsWith("complete-graph/"));
  assert.equal(graphs.length, 20);
  assert.equal(new Set(graphs.map(([, value]) => JSON.stringify(value))).size, 20);
});
for (const [name, value, check] of graphChecks) test(`complete graph semantics/${name}`, () => check(value));
test("event offsets preserve first-failed-check precedence at the actual8192 cap", () => {
  for (const invalid of ["q", "s9:"]) assert.throws(() => codec.validatePackedResultV1(raw("o0:a8192:" + "z".repeat(8191) + invalid, ["events"], [[0]]), account()), (e) => e.reason === "packed-invalid-proof");
  assert.throws(() => codec.validatePackedResultV1(raw("o0:a8193:q", ["events"], [[0]]), account()), (e) => e.reason === "packed-offsets");
});
const nodeCompetitionPrefix = "a262142:a2:zz" + "z".repeat(262140);
for (const [name, terminal, reason] of [["valid-scalar", "z", "packed-logical-nodes"], ["unknown-tag", "x", "packed-invalid-proof"], ["out-of-range-string", "s0:", "packed-invalid-proof"], ["out-of-range-shape", "o0:", "packed-invalid-proof"], ["malformed-number", "n2:-0", "packed-invalid-proof"], ["unsafe-number", "n16:9007199254740992", "packed-invalid-proof"]]) test(`same-token precedence at logical node cap/${name}`, () => assert.throws(() => codec.validatePackedResultV1(raw(nodeCompetitionPrefix + terminal), account()), (e) => e.reason === reason));
for (const [name, value] of [["undefined", void 0], ["function", () => {
}], ["negativezero", -0], ["fraction", 1.5], ["proxy", new Proxy({}, { ownKeys() {
  throw Error("trap must not execute");
} })], ["accessor", Object.defineProperty({}, "x", { get() {
  throw Error("getter must not execute");
}, enumerable: true })]]) test(`encoder same-value domain before node cap/${name}`, () => {
  const valueAtCap = Array(262141).fill(null);
  valueAtCap[0] = [null, null];
  valueAtCap.push(value);
  assert.throws(() => codec.packFeedbackResultV1(valueAtCap, account()), (e) => e.reason === "packed-invalid-proof");
});
test("pack and validate choose logical strings before canonical bytes on the same token", () => {
  const s = "x".repeat(4e5), values = Array(11).fill(s);
  assert.throws(() => codec.packFeedbackResultV1(values, account()), (e) => e.reason === "packed-logical-strings");
  assert.throws(() => codec.validatePackedResultV1(raw("a11:" + "s0:".repeat(11), [s]), account()), (e) => e.reason === "packed-logical-strings");
});
for (const [name, envelope] of [["first-string", raw(nodeCompetitionPrefix + "s1:", ["first", "second"])], ["first-shape", raw(nodeCompetitionPrefix + "o1:", ["first", "second"], [[0], [1]])], ["first-shape-key", raw(nodeCompetitionPrefix + "o0:", ["first", "second"], [[1]])]]) test(`same-token canonical first-use before logical node cap/${name}`, () => assert.throws(() => codec.validatePackedResultV1(envelope, account()), (e) => e.reason === "packed-invalid-proof"));
test("fixed envelope header refuses65537 extra properties before secondary key-vector traversal", () => {
  const e = raw("z");
  for (let index = 0; index < 65537; index++) e[`authored_extra_${index}`] = null;
  const a = account();
  codec.chargePackedResultWorkV1(a, 67108864 - 1e5);
  assert.throws(() => codec.validatePackedResultV1(e, a), (error) => error.reason === "packed-invalid-proof");
  codec.chargePackedResultWorkV1(a, 1);
});
for (const role of ["strings", "shapes", "shape"]) test(`revoked proxy metadata refuses before array reflection/${role}`, () => {
  const { proxy, revoke } = Proxy.revocable([], {});
  revoke();
  const envelope = raw("z");
  if (role === "shape") envelope.shapes = [proxy];
  else envelope[role] = proxy;
  assert.throws(() => codec.validatePackedResultV1(envelope, account()), (error) => error instanceof codec.PackedResultError && error.stage === "output" && error.reason === "packed-invalid-proof");
});
test("variable native array freeze refuses before the native pass when its own precharge is short", async () => {
  const { readFileSync } = await import("node:fs"), source = readFileSync(new URL("./feedback-observations-packed-result-v1.mjs", import.meta.url), "utf8");
  assert.ok(source.includes("function freezeArray("), "trusted private variable-array freeze helper exists");
  const nativeCall = "return Object.freeze(array);";
  assert.equal(source.split(nativeCall).length, 2, "instrument exactly the private array native pass");
  const authoredSource = source.replace(nativeCall, "return authoredObserveFreeze(array);") + `
let authoredAttempts=0;
function authoredObserveFreeze(value){authoredAttempts++;return Object.freeze(value);}
export {freezeArray as authoredFreezeArray};
export function authoredFreezeAttempts(){return authoredAttempts;}
`;
  const authored = await import("data:text/javascript;base64," + Buffer.from(authoredSource).toString("base64"));
  assert.equal("authoredFreezeArray" in codec, false);
  const a = authored.createPackedResultAccountV1(), values = Array(8192).fill(null);
  authored.chargePackedResultWorkV1(a, 67108864 - values.length);
  assert.throws(() => authored.authoredFreezeArray(values, a), (error) => error.reason === "logical-work-limit");
  assert.equal(authored.authoredFreezeAttempts(), 0);
  assert.equal(Object.isFrozen(values), false);
  assert.throws(() => authored.chargePackedResultWorkV1(a, 0), (error) => error.reason === "logical-work-limit");
  const b = authored.createPackedResultAccountV1();
  authored.chargePackedResultWorkV1(b, 67108864 - values.length - 1);
  assert.equal(authored.authoredFreezeArray(values, b), values);
  assert.equal(authored.authoredFreezeAttempts(), 1);
  assert.equal(Object.isFrozen(values), true);
  authored.chargePackedResultWorkV1(b, 0);
  assert.throws(() => authored.chargePackedResultWorkV1(b, 1), (error) => error.reason === "logical-work-limit");
});
