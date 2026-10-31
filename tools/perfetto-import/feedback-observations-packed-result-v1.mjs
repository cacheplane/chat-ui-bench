// Structural codec only: an account/view never confers core execution provenance.
// Authored arbitrary JS reflection may allocate one own-key list before its count
// is known. Production owns its bounded proof; persisted input starts at <=1MiB.
// The fixed feedback cache holds seven closed facts (status/count/eventCount and
// four interval fields), within the 64 fixed-path allowance. Every event ordinal
// has one private {start,end} span: <=8192 * 16 logical bytes. No path cache grows.
import { types } from "node:util";
const typedArrayByteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
const SCHEMA = "browser-feedback-packed-result-v1";
const PACKED_RESULT_LIMITS_V1 = Object.freeze({ wireBytes: 1048576, wireNodes: 65536, wireStringBytes: 524288, logicalBytes: 4194304, logicalNodes: 262144, logicalEdges: 262143, logicalStringBytes: 4194304, maxDepth: 64, work: 67108864, eventOffsets: 8192, fixedOffsets: 64, offsetEntries: 8256, offsetBytes: 132096 });
const L = PACKED_RESULT_LIMITS_V1, accounts = /* @__PURE__ */ new WeakMap(), views = /* @__PURE__ */ new WeakMap();
const reasons = /* @__PURE__ */ new Set(["packed-invalid-proof", "logical-work-limit", "packed-wire-bytes", "packed-wire-nodes", "packed-wire-strings", "packed-logical-bytes", "packed-logical-nodes", "packed-logical-strings", "packed-logical-depth", "packed-offsets"]);
class PackedResultError extends Error {
  constructor(reason = "packed-invalid-proof") {
    const r = reasons.has(reason) ? reason : "packed-invalid-proof";
    super(r);
    this.reason = r;
    this.stage = r === "packed-invalid-proof" ? "output" : "limits";
    Object.freeze(this);
  }
}
function fail(reason = "packed-invalid-proof") {
  throw new PackedResultError(reason);
}
function need(ok, reason) {
  if (!ok) fail(reason);
}
function createPackedResultAccountV1() {
  const token = Object.freeze({});
  accounts.set(token, { left: L.work, failed: false });
  return token;
}
function chargePackedResultWorkV1(token, n) {
  const a = accounts.get(token);
  need(a);
  if (!Number.isSafeInteger(n) || n < 0 || a.failed || n > a.left) {
    a.failed = true;
    fail("logical-work-limit");
  }
  a.left -= n;
}
const charge = (a, n = 1) => chargePackedResultWorkV1(a, n);
function scanString(s, a) {
  let bytes = 0, json = 2;
  for (let i = 0; i < s.length; i++) {
    charge(a);
    const c = s.charCodeAt(i);
    if (c >= 55296 && c <= 56319 && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 56320 && d <= 57343) {
        charge(a);
        i++;
        bytes += 4;
        json += 4;
        continue;
      }
    }
    const b = c < 128 ? 1 : c < 2048 ? 2 : 3;
    bytes += b;
    json += c === 34 || c === 92 ? 2 : c < 32 ? [8, 9, 10, 12, 13].includes(c) ? 2 : 6 : c >= 55296 && c <= 57343 ? 6 : b;
  }
  return { bytes, json };
}
function own(v, a, maxKeys = L.logicalNodes, nodeReason = "packed-logical-nodes") {
  need(!types.isProxy(v));
  charge(a);
  const arr = Array.isArray(v), p = Object.getPrototypeOf(v);
  need(arr ? p === Array.prototype : p === Object.prototype || p === null);
  let len;
  if (arr) {
    charge(a);
    const d = Object.getOwnPropertyDescriptor(v, "length");
    need(d && "value" in d && !d.enumerable && !d.configurable && Number.isSafeInteger(d.value) && d.value >= 0);
    len = d.value;
    need(len <= maxKeys, nodeReason);
  }
  const keys = Reflect.ownKeys(v);
  charge(a, keys.length);
  need(keys.length <= maxKeys + (arr ? 1 : 0), nodeReason);
  const names = [];
  for (const k of keys) {
    charge(a);
    need(typeof k === "string");
    charge(a, k.length);
    const d = Object.getOwnPropertyDescriptor(v, k);
    need(d && "value" in d);
    if (arr && k === "length") continue;
    need(d.enumerable);
    if (arr) need(k === String(names.length) && names.length < len);
    names.push(k);
  }
  if (arr) need(names.length === len);
  return { array: arr, keys: names };
}
function get(v, k, a) {
  charge(a, 1 + k.length);
  const d = Object.getOwnPropertyDescriptor(v, k);
  need(d && "value" in d && d.enumerable);
  return d.value;
}
function add(m, k, n, cap, reason) {
  need(Number.isSafeInteger(n) && n >= 0 && n <= cap - m[k], reason);
  m[k] += n;
}
function saturatedCost(current, increment, cap) {
  return current > cap || increment > cap - current ? cap + 1 : current + increment;
}
function numeric(v, a, finite = false) {
  need(typeof v === "number" && Number.isFinite(v) && (finite || Number.isSafeInteger(v) && !Object.is(v, -0)));
  charge(a);
  const t = String(v);
  charge(a, t.length);
  return t;
}
function shapeKey(indices, a) {
  charge(a, indices.length);
  for (const index of indices) {
    charge(a);
    let digits = 1;
    for (let n = index; n >= 10; n = Math.floor(n / 10)) {
      charge(a);
      digits++;
    }
    charge(a, digits);
  }
  return indices.join(",");
}
function freezeArray(array, a) {
  // This native pass scans every own element and the built-in length property.
  // Construction, descriptor scans, joins, and later validation are separate.
  charge(a, array.length + 1);
  return Object.freeze(array);
}
function walk(value, a, wire = false, visitor = null) {
  const m = { bytes: 0, nodes: 0, stringBytes: 0 }, stack = [], active = /* @__PURE__ */ new WeakSet();
  let v = value, depth = 0, have = true;
  const caps = wire ? { bytes: L.wireBytes, nodes: L.wireNodes, stringBytes: L.wireStringBytes } : { bytes: L.logicalBytes, nodes: L.logicalNodes, stringBytes: L.logicalStringBytes };
  const plus = (k, n) => add(m, k, n, caps[k], `packed-${wire ? "wire" : "logical"}-${k === "stringBytes" ? "strings" : k}`);
  const text = (s) => {
    const x = scanString(s, a);
    plus("stringBytes", x.bytes);
    plus("bytes", x.json);
  };
  while (have || stack.length) {
    charge(a);
    if (have) {
      charge(a);
      let desc = null, numberText;
      // Preflight this value only. Absolute profile caps bound own-key vectors;
      // remaining occurrence capacity is committed after descriptor/domain checks.
      if (typeof v === "number") numberText = numeric(v, a, wire);
      else if (v !== null && typeof v !== "string" && typeof v !== "boolean") {
        need(v && typeof v === "object" && !types.isProxy(v));
        need(!active.has(v));
        desc = own(v, a, caps.nodes, `packed-${wire ? "wire" : "logical"}-nodes`);
      }
      plus("nodes", 1);
      need(depth <= L.maxDepth, "packed-logical-depth");
      if (v === null) {
        plus("bytes", wire ? 5 : 4);
        visitor?.scalar(v);
      } else if (typeof v === "string") {
        text(v);
        visitor?.scalar(v);
      } else if (typeof v === "boolean") {
        plus("bytes", wire ? 5 : v ? 4 : 5);
        visitor?.scalar(v);
      } else if (typeof v === "number") {
        plus("bytes", numberText.length);
        visitor?.scalar(v, numberText);
      } else {
        const n = desc.keys.length;
        if (!desc.array || wire) plus("nodes", n);
        need(n <= caps.nodes - m.nodes, `packed-${wire ? "wire" : "logical"}-nodes`);
        need(n === 0 || depth < L.maxDepth, "packed-logical-depth");
        let tokenBytes = wire ? 2 + (n + (desc.array ? 1 : 0)) * 3 : 2 + Math.max(0, n - 1), tokenStrings = 0;
        if (!desc.array) {
          for (const k of desc.keys) {
            charge(a);
            const cost = scanString(k, a);
            tokenStrings = saturatedCost(tokenStrings, cost.bytes, caps.stringBytes);
            tokenBytes = saturatedCost(tokenBytes, cost.json + (wire ? 0 : 1), caps.bytes);
          }
        } else if (wire) {
          for (let i = 0; i < n; i++) {
            charge(a);
            const k = String(i);
            charge(a, k.length);
            const cost = scanString(k, a);
            tokenStrings = saturatedCost(tokenStrings, cost.bytes, caps.stringBytes);
            tokenBytes = saturatedCost(tokenBytes, cost.json, caps.bytes);
          }
        }
        plus("stringBytes", tokenStrings);
        plus("bytes", tokenBytes);
        visitor?.container(v, desc);
        if (n) {
          charge(a);
          active.add(v);
          stack.push({ v, desc, i: 0, depth });
        } else visitor?.end();
      }
      have = false;
    } else {
      const f = stack.at(-1);
      charge(a);
      if (f.i === f.desc.keys.length) {
        active.delete(f.v);
        stack.pop();
        charge(a);
        visitor?.end();
        continue;
      }
      const key = f.desc.keys[f.i++];
      v = get(f.v, key, a);
      depth = f.depth + 1;
      have = true;
    }
  }
  return Object.freeze(m);
}
function packFeedbackResultV1(value, a) {
  charge(a);
  const strings = [], shapes = [], shapeMap = /* @__PURE__ */ new Map(), parts = [];
  let bodyBytes = 0, shapeKeys = 0;
  const dictionary = /* @__PURE__ */ new Map();
  const wire = { ...walk({ schema: SCHEMA, strings: [], shapes: [], body: "" }, a, true) };
  const reserve = (bytes, nodes, stringBytes) => {
    add(wire, "bytes", bytes, L.wireBytes, "packed-wire-bytes");
    add(wire, "nodes", nodes, L.wireNodes, "packed-wire-nodes");
    add(wire, "stringBytes", stringBytes, L.wireStringBytes, "packed-wire-strings");
  };
  const intern = (s) => {
    charge(a, s.length + 1);
    let n = dictionary.get(s);
    if (n !== void 0) return n;
    const x = scanString(s, a), index = String(strings.length);
    charge(a, index.length);
    reserve(3 + x.json + index.length + 2, 2, x.bytes + index.length);
    n = strings.length;
    charge(a, s.length + 1);
    dictionary.set(s, n);
    strings.push(s);
    return n;
  };
  const emit = (s) => {
    reserve(s.length, 0, s.length);
    charge(a, s.length);
    bodyBytes += s.length;
    parts.push(s);
  };
  const uint = (n) => {
    charge(a);
    const s = String(n);
    charge(a, s.length);
    return s + ":";
  };
  walk(value, a, false, { scalar(v, t) {
    charge(a);
    if (v === null) emit("z");
    else if (typeof v === "boolean") emit(v ? "t" : "f");
    else if (typeof v === "string") emit("s" + uint(intern(v)));
    else emit("n" + uint(t.length) + t);
  }, container(v, d) {
    charge(a);
    if (d.array) {
      emit("a" + uint(d.keys.length));
      return;
    }
    need(d.keys.length <= L.wireNodes - shapeKeys, "packed-wire-nodes");
    const indices = [];
    for (const k of d.keys) {
      charge(a);
      indices.push(intern(k));
    }
    const key = shapeKey(indices, a);
    charge(a, key.length + 1);
    let id = shapeMap.get(key);
    if (id === void 0) {
      const index = String(shapes.length);
      charge(a, index.length);
      reserve(8 + index.length + 2, 2, index.length);
      for (let i = 0; i < indices.length; i++) {
        charge(a);
        const j = String(i), v2 = String(indices[i]);
        charge(a, j.length + v2.length);
        reserve(3 + j.length + 2 + v2.length, 2, j.length);
      }
      shapeKeys += indices.length;
      id = shapes.length;
      shapes.push(freezeArray(indices, a));
      charge(a, key.length + 1);
      shapeMap.set(key, id);
    }
    emit("o" + uint(id));
  }, end() {
    charge(a);
  } });
  charge(a, bodyBytes);
  const envelope = Object.freeze({ schema: SCHEMA, strings: freezeArray(strings, a), shapes: freezeArray(shapes, a), body: parts.join("") });
  walk(envelope, a, true);
  return envelope;
}
function integerKey(s, a) {
  charge(a, s.length);
  if (!/^(0|[1-9][0-9]*)$/.test(s) || s.length > 10) return null;
  const n = Number(s);
  return n <= 4294967294 ? n : null;
}
function envelopeCopy(e, a) {
  need(e && typeof e === "object" && !types.isProxy(e));
  const d = own(e, a, 4, "packed-invalid-proof");
  need(!d.array && d.keys.length === 4 && d.keys[0] === "schema" && d.keys[1] === "strings" && d.keys[2] === "shapes" && d.keys[3] === "body");
  need(get(e, "schema", a) === SCHEMA);
  const strings = get(e, "strings", a), shapes = get(e, "shapes", a), body = get(e, "body", a);
  need(typeof body === "string");
  need(body.length <= L.wireBytes, "packed-wire-bytes");
  need(!types.isProxy(strings) && Array.isArray(strings) && !types.isProxy(shapes) && Array.isArray(shapes));
  walk(e, a, true);
  const sd = own(strings, a), hd = own(shapes, a), ss = [], hs = [], seenStrings = /* @__PURE__ */ new Map(), seenShapes = /* @__PURE__ */ new Map();
  let totalKeys = 0;
  for (const k of sd.keys) {
    charge(a);
    const s = get(strings, k, a);
    need(typeof s === "string");
    charge(a, s.length + 1);
    need(!seenStrings.has(s));
    charge(a, s.length + 1);
    seenStrings.set(s, true);
    ss.push(s);
  }
  for (const k of hd.keys) {
    charge(a);
    const shape = get(shapes, k, a);
    need(!types.isProxy(shape) && Array.isArray(shape));
    const desc = own(shape, a);
    need(desc.keys.length <= L.wireNodes - totalKeys, "packed-wire-nodes");
    totalKeys += desc.keys.length;
    const keys = [], used = /* @__PURE__ */ new Set();
    let last = -1, ordinary = false;
    for (const j of desc.keys) {
      charge(a);
      const id = get(shape, j, a);
      need(Number.isSafeInteger(id) && !Object.is(id, -0) && id >= 0 && id < ss.length);
      charge(a);
      need(!used.has(id));
      used.add(id);
      const ix = integerKey(ss[id], a);
      if (ix === null) ordinary = true;
      else {
        need(!ordinary && ix > last);
        last = ix;
      }
      keys.push(id);
    }
    const key = shapeKey(keys, a);
    charge(a, key.length + 1);
    need(!seenShapes.has(key));
    charge(a, key.length + 1);
    seenShapes.set(key, true);
    hs.push(freezeArray(keys, a));
  }
  for (let i = 0; i < body.length; i++) {
    charge(a);
    need(body.charCodeAt(i) <= 127);
  }
  return Object.freeze({ schema: SCHEMA, strings: freezeArray(ss, a), shapes: freezeArray(hs, a), body });
}
function scan(e, a, { start = 0, end = e.body.length, canonical = true, role = "root", capture = false } = {}) {
  let p = start, nextString = 0, nextShape = 0, depth = 0, currentRole = role, have = true;
  const stack = [], m = { bytes: 0, nodes: 0, stringBytes: 0 }, events = [], fields = /* @__PURE__ */ Object.create(null), interval = /* @__PURE__ */ Object.create(null), event = /* @__PURE__ */ Object.create(null);
  const seenStrings = /* @__PURE__ */ new Set(), seenShapes = /* @__PURE__ */ new Set();
  const plus = (k, n) => add(m, k, n, k === "nodes" ? L.logicalNodes : k === "bytes" ? L.logicalBytes : L.logicalStringBytes, `packed-logical-${k === "stringBytes" ? "strings" : k}`);
  function string(id) {
    charge(a);
    need(id < e.strings.length);
    if (canonical && !seenStrings.has(id)) {
      need(id === nextString++);
      seenStrings.add(id);
    }
    return e.strings[id];
  }
  function uint() {
    let n = 0, digits = 0;
    while (p < end) {
      charge(a);
      const c = e.body.charCodeAt(p++);
      if (c === 58) {
        need(digits > 0);
        return n;
      }
      need(c >= 48 && c <= 57);
      need(digits === 0 || n !== 0);
      need(n <= Math.floor((Number.MAX_SAFE_INTEGER - (c - 48)) / 10));
      n = n * 10 + c - 48;
      digits++;
    }
    fail();
  }
  function scalar(v) {
    if (capture) {
      charge(a);
      charge(a, currentRole.length);
      if (currentRole.startsWith("root/")) {
        charge(a, currentRole.length);
        fields[currentRole.slice(5)] = v;
      } else {
        charge(a, currentRole.length);
        if (currentRole.startsWith("interval/")) {
          charge(a, currentRole.length);
          interval[currentRole.slice(9)] = v;
        } else {
          charge(a, currentRole.length);
          if (currentRole.startsWith("event/")) {
            charge(a, currentRole.length);
            event[currentRole.slice(6)] = v;
          }
        }
      }
    }
  }
  function done(frame, at) {
    if (capture && frame.role === "event" && frame.offset !== void 0) {
      charge(a);
      events[frame.offset].end = at;
    }
  }
  function eventOffset(role2, tokenStart) {
    if (!capture || role2 !== "event") return;
    need(events.length < L.eventOffsets, "packed-offsets");
    charge(a);
    const offset = events.length;
    events.push({ start: tokenStart, end: null });
    return offset;
  }
  while (have || stack.length) {
    charge(a);
    if (have) {
      need(p < end);
      const tokenStart = p, t = e.body[p++];
      let n = 0, keys = null, scalarValue, numberLength = 0;
      const container = t === "a" || t === "o";
      // Token preflight: no child visits, captures, spans, or resource commits.
      // Grammar, references, and all shape-key first uses must succeed first.
      if (t === "z") scalarValue = null;
      else if (t === "t" || t === "f") scalarValue = t === "t";
      else if (t === "s") scalarValue = string(uint());
      else if (t === "n") {
        const len = uint();
        need(len > 0 && len <= 17 && len <= end - p);
        let value = 0, negative = false;
        for (let i = 0; i < len; i++) {
          charge(a);
          const c = e.body.charCodeAt(p++);
          if (i === 0 && c === 45) {
            negative = true;
            need(len > 1);
            continue;
          }
          need(c >= 48 && c <= 57);
          const first = i === (negative ? 1 : 0);
          if (first && c === 48) need(!negative && len === 1);
          need(value <= Math.floor((Number.MAX_SAFE_INTEGER - (c - 48)) / 10));
          value = value * 10 + c - 48;
        }
        scalarValue = negative ? -value : value;
        numberLength = len;
      } else if (container) {
        const id = uint();
        if (t === "a") n = id;
        else {
          charge(a);
          need(id < e.shapes.length);
          if (canonical && !seenShapes.has(id)) {
            need(id === nextShape++);
            seenShapes.add(id);
          }
          keys = e.shapes[id];
          n = keys.length;
          for (const key of keys) {
            charge(a);
            string(key);
          }
        }
      } else fail();
      // Logical commit order: nodes/depth/arity, strings, canonical JSON bytes.
      // Only then may this token append an offset, capture a fact, or push a frame.
      plus("nodes", 1);
      if (keys) plus("nodes", keys.length);
      need(depth <= L.maxDepth, "packed-logical-depth");
      if (container) {
        need(n <= L.logicalNodes - m.nodes, "packed-logical-nodes");
        need(n === 0 || depth < L.maxDepth, "packed-logical-depth");
        let tokenStrings = 0, tokenBytes = 2 + Math.max(0, n - 1);
        if (keys) for (const key of keys) {
          charge(a);
          const cost = scanString(e.strings[key], a);
          tokenStrings = saturatedCost(tokenStrings, cost.bytes, L.logicalStringBytes);
          tokenBytes = saturatedCost(tokenBytes, cost.json + 1, L.logicalBytes);
        }
        plus("stringBytes", tokenStrings);
        plus("bytes", tokenBytes);
        if (capture && currentRole === "events" && t === "a") {
          need(n <= L.eventOffsets, "packed-offsets");
          charge(a);
          fields.eventCount = n;
        }
        const offset = eventOffset(currentRole, tokenStart);
        if (n) {
          charge(a);
          stack.push({ n, i: 0, keys, depth, role: currentRole, offset });
        } else done({ role: currentRole, offset }, p);
      } else {
        if (t === "s") {
          const cost = scanString(scalarValue, a);
          plus("stringBytes", cost.bytes);
          plus("bytes", cost.json);
        } else plus("bytes", t === "z" ? 4 : t === "t" ? 4 : t === "f" ? 5 : numberLength);
        scalar(scalarValue);
        const offset = eventOffset(currentRole, tokenStart);
        done({ role: currentRole, offset }, p);
      }
      have = false;
    } else {
      const f = stack.at(-1);
      charge(a);
      if (f.i === f.n) {
        stack.pop();
        charge(a);
        done(f, p);
        continue;
      }
      const key = f.keys ? e.strings[f.keys[f.i]] : f.i;
      f.i++;
      depth = f.depth + 1;
      currentRole = "other";
      if (f.role === "root" && f.keys) {
        if (key === "status" || key === "count") currentRole = "root/" + key;
        else if (key === "interval" || key === "events") currentRole = key;
      } else if (f.role === "interval" && ["startTs", "endTs", "durationNs", "membership"].includes(key)) currentRole = "interval/" + key;
      else if (f.role === "events" && !f.keys) currentRole = "event";
      else if (f.role === "event" && (key === "displayTraceId" || key === "terminalTs")) currentRole = "event/" + key;
      have = true;
    }
  }
  need(p === end);
  if (canonical) {
    need(nextString === e.strings.length);
    need(nextShape === e.shapes.length);
  }
  return { fields, interval, event, events };
}
function validatePackedResultV1(envelope, a) {
  charge(a);
  const e = envelopeCopy(envelope, a), r = scan(e, a, { capture: true });
  const view = Object.freeze({});
  views.set(view, { a, e, ...r });
  return view;
}
function state(view) {
  const s = views.get(view);
  need(s, "invalid-view");
  charge(s.a);
  return s;
}
function readPackedFeedbackSummaryV1(view) {
  const s = state(view), { fields: f, interval: i } = s;
  charge(s.a, 8);
  need(typeof f.status === "string" && typeof f.count === "string" && Number.isSafeInteger(f.eventCount), "invalid-feedback-summary");
  for (const k of ["startTs", "endTs", "durationNs", "membership"]) need(typeof i[k] === "string", "invalid-feedback-summary");
  return Object.freeze({ status: f.status, count: f.count, interval: Object.freeze({ startTs: i.startTs, endTs: i.endTs, durationNs: i.durationNs, membership: i.membership }), eventCount: f.eventCount });
}
function readPackedFeedbackEventV1(view, index) {
  const s = state(view);
  need(Number.isSafeInteger(index) && !Object.is(index, -0) && index >= 0 && index < s.events.length, "invalid-event-index");
  charge(s.a);
  const o = s.events[index];
  need(o.start >= 0 && o.end <= s.e.body.length && o.end >= o.start, "packed-offsets");
  const { event } = scan(s.e, s.a, { start: o.start, end: o.end, canonical: false, role: "event", capture: true });
  charge(s.a, 3);
  need(typeof event.displayTraceId === "string" && typeof event.terminalTs === "string", "invalid-feedback-event");
  return Object.freeze({ index, displayTraceId: event.displayTraceId, terminalTs: event.terminalTs });
}
function meterPackedCompositionV1(view, value) {
  const s = state(view);
  return walk(value, s.a, true);
}
function parsePackedResultBytesV1(bytes, a) {
  charge(a);
  need(!types.isProxy(bytes) && types.isUint8Array(bytes));
  const length = typedArrayByteLength.call(bytes);
  need(length <= L.wireBytes, "packed-wire-bytes");
  charge(a, length);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    fail();
  }
  charge(a, text.length);
  let e;
  try {
    e = JSON.parse(text);
  } catch {
    fail();
  }
  const view = validatePackedResultV1(e, a);
  charge(a, length);
  const canonical = JSON.stringify(e);
  charge(a, canonical.length + text.length);
  need(canonical === text);
  return view;
}
export {
  PACKED_RESULT_LIMITS_V1,
  PackedResultError,
  chargePackedResultWorkV1,
  createPackedResultAccountV1,
  meterPackedCompositionV1,
  packFeedbackResultV1,
  parsePackedResultBytesV1,
  readPackedFeedbackEventV1,
  readPackedFeedbackSummaryV1,
  validatePackedResultV1
};
