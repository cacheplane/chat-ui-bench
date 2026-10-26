import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const moduleURL = new URL("./raw-metadata-ledger-v1.mjs", import.meta.url);
const engine = await import(moduleURL).catch(() => ({}));
const varint = (n) => {
  n = BigInt(n);
  const b = [];
  do {
    b.push(Number(n & 127n) | (n > 127n ? 128 : 0));
    n >>= 7n;
  } while (n);
  return Buffer.from(b);
};
const scalar = (n, v) => Buffer.concat([varint(BigInt(n) * 8n), varint(v)]);
const body = (n, b) => Buffer.concat([varint(BigInt(n) * 8n + 2n), varint(b.length), b]);
const packet = (b) => body(1, b);
function fixture(t, bytes) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "raw-ledger-test-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, "trace.pftrace");
  fs.writeFileSync(input, bytes, { mode: 384 });
  return { trace: { path: input, bytes: bytes.length, sha256: hash(bytes) }, out: path.join(dir, "result") };
}
function records(file) {
  const raw = fs.readFileSync(file);
  let ordinal = 0;
  return raw.toString("utf8").trimEnd().split("\n").map((line) => {
    const match = /^(0|[1-9][0-9]*):(0|[1-9][0-9]*):([a-f0-9]{64})\t(.*)$/.exec(line);
    assert.ok(match);
    assert.equal(+match[1], ordinal++);
    assert.equal(Buffer.byteLength(match[4]), +match[2]);
    assert.equal(hash(match[4]), match[3]);
    return JSON.parse(match[4]);
  });
}
// Independent flat protobuf oracle: no analyzer or candidate parser imports.
function fields(bytes, start = 0, end = bytes.length) {
  let at = start;
  const rows = [];
  const read = () => {
    let n = 0n, shift = 0n;
    for (; ; ) {
      const b = bytes[at++];
      n |= BigInt(b & 127) << shift;
      if (!(b & 128)) return n;
      shift += 7n;
    }
  };
  while (at < end) {
    const begin = at, tag = read(), n = Number(tag >> 3n), w = Number(tag & 7n);
    let value = at, s = null;
    if (w === 0) s = read().toString();
    else if (w === 2) {
      const size = Number(read());
      value = at;
      at += size;
    } else at += w === 1 ? 8 : 4;
    rows.push([n, w, begin, value, at, s, w === 0 ? null : hash(bytes.subarray(value, at))]);
  }
  assert.equal(at, end);
  return rows;
}
function childOracle(bytes, family) {
  const rows = [];
  const visit = (start, end, scope) => {
    for (const [n, w, at, value, next] of fields(bytes, start, end)) {
      const supported = scope === 2 ? [1, 3, 4, 5].includes(n) : scope === 3 ? [1, 7].includes(n) : scope === 4 ? [1, 2].includes(n) : scope === 0 ? [1, 2].includes(n) : [1, 2, 3, 4].includes(n);
      rows.push([scope, n, w, at, value, next, supported ? null : hash(bytes.subarray(value, next))]);
      if (scope === 2 && (n === 3 || n === 4)) visit(value, next, n);
      if (scope === 0 && n === 1) visit(value, next, 1);
    }
  };
  visit(0, bytes.length, family === 60 ? 2 : 0);
  return rows;
}
test("exports exactly one production entry", () => {
  assert.equal(typeof engine.writeRawMetadataLedgerV1, "function");
  assert.deepEqual(Object.keys(engine), ["writeRawMetadataLedgerV1"]);
});
test("empty trace is an admitted empty projection with independently checked envelope", async (t) => {
  const f = fixture(t, Buffer.alloc(0)), r = await engine.writeRawMetadataLedgerV1(f);
  assert.equal(r.status, "complete-raw-metadata-ledger-diagnostic");
  assert.equal(r.FPS, null);
  assert.equal(r.selectedMetadataProjection, "complete");
  const rows = records(path.join(f.out, "ledger.jsonl"));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].slice(0, 4), [0, 1, 0, hash(Buffer.alloc(0))]);
  assert.deepEqual(rows[1].slice(0, 7), [3, 0, 0, 0, 0, 0, hash(Buffer.alloc(0))]);
  assert.equal(fs.statSync(f.out).mode & 511, 448);
  assert.equal(fs.statSync(path.join(f.out, "seal.json")).mode & 511, 384);
});
test("mixed duplicate metadata and raw contradictory headers preserve every window and scalar", async (t) => {
  const descriptor = Buffer.concat([scalar(1, 18446744073709551615n), body(3, Buffer.concat([scalar(1, 0), scalar(7, 9223372036854775808n)])), body(10, Buffer.from([255]))]);
  const clock = Buffer.concat([body(1, Buffer.concat([scalar(1, 3), scalar(2, 0), scalar(3, 0), scalar(4, 1)])), body(1, Buffer.alloc(0)), scalar(2, 0)]);
  const p = Buffer.concat([scalar(10, 1), scalar(10, 2), body(60, descriptor), body(6, clock), body(60, descriptor), body(11, Buffer.from([255])), scalar(87, 0)]);
  const raw = Buffer.concat([packet(p), packet(Buffer.alloc(0))]);
  const f = fixture(t, raw), r = await engine.writeRawMetadataLedgerV1(f);
  assert.equal(r.status, "complete-raw-metadata-ledger-diagnostic", JSON.stringify(r));
  const rows = records(path.join(f.out, "ledger.jsonl")), pr = rows[1];
  assert.deepEqual(pr.slice(0, 2), [1, 0]);
  assert.deepEqual(pr[4], fields(p));
  assert.equal(pr[3], hash(p));
  assert.deepEqual(pr[2], [0, 1, 1, packet(p).length - p.length, packet(p).length - p.length, packet(p).length]);
  assert.deepEqual(rows.slice(2, 5).map((x) => [x[0], x[1], x[2], x[3]]), [[2, 0, 2, 60], [2, 0, 3, 6], [2, 0, 4, 60]]);
  assert.deepEqual(rows[2][4], { uuid: "18446744073709551615", process: { pid: "0", startTimestampNs: "-9223372036854775808" } });
  assert.deepEqual(rows[3][4], { clocks: [{ clockId: "3", timestamp: "0", isIncremental: false, unitMultiplierNs: "1" }, {}], primaryTraceClock: "0" });
  assert.deepEqual(rows[2][5], childOracle(descriptor, 60));
  assert.deepEqual(rows[3][5], childOracle(clock, 6));
  assert.deepEqual(rows[2][5].filter((x) => x[6] !== null), [[2, 10, 2, descriptor.length - 3, descriptor.length - 1, descriptor.length, hash(Buffer.from([255]))]]);
  assert.equal(r.dataOneofChecked, false);
  assert.equal(r.otherPayloadSemantics, "opaque");
});
test("closed own-data admission rejects proxies getters symbols and caller ceilings without IO", async (t) => {
  let touched = false;
  const cases = [new Proxy({}, { get() {
    touched = true;
    throw Error("trap");
  } }), { get trace() {
    touched = true;
    return {};
  }, out: "/x" }, { trace: {}, out: "/x", limits: {} }, { trace: {}, out: "/x", [/* @__PURE__ */ Symbol()]: 1 }];
  for (const c of cases) {
    const r = await engine.writeRawMetadataLedgerV1(c);
    assert.equal(r.status, "unavailable");
    assert.equal(r.seal, null);
  }
  assert.equal(touched, false);
});
for (const [name, p] of [["wrong selected wire", scalar(60, 1)], ["duplicate selected scalar", body(60, Buffer.concat([scalar(1, 1), scalar(1, 2)]))], ["malformed late metadata", Buffer.concat([body(60, scalar(1, 1)), body(6, Buffer.from([128]))])], ["invalid top wire", Buffer.from([7])]]) test(name + " refuses whole ledger", async (t) => {
  const f = fixture(t, packet(p)), r = await engine.writeRawMetadataLedgerV1(f);
  assert.equal(r.status, "unavailable");
  assert.equal(r.seal, null);
  assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
});
test("hash mismatch and existing destination refuse without admission", async (t) => {
  const f = fixture(t, packet(Buffer.alloc(0)));
  f.trace.sha256 = "0".repeat(64);
  assert.equal((await engine.writeRawMetadataLedgerV1(f)).status, "unavailable");
  const g = fixture(t, Buffer.alloc(0));
  fs.mkdirSync(g.out);
  assert.equal((await engine.writeRawMetadataLedgerV1(g)).status, "unavailable");
});
test("symlink ancestor and hardlinked input refuse", async (t) => {
  const f = fixture(t, Buffer.alloc(0));
  fs.linkSync(f.trace.path, f.trace.path + ".link");
  assert.equal((await engine.writeRawMetadataLedgerV1(f)).status, "unavailable");
  const g = fixture(t, Buffer.alloc(0));
  fs.symlinkSync(path.dirname(g.trace.path), path.join(path.dirname(g.trace.path), "alias"));
  g.trace.path = path.join(path.dirname(g.trace.path), "alias", "trace.pftrace");
  assert.equal((await engine.writeRawMetadataLedgerV1(g)).status, "unavailable");
});
import { spawnSync } from "node:child_process";
function privateWorker(f, fault) {
  const setup = `import fs from 'node:fs';const original={write:fs.writeSync,read:fs.readSync,sync:fs.fsyncSync,close:fs.closeSync};${fault};process.argv=[process.execPath,${JSON.stringify(fileURLToPath(moduleURL))},'--private-raw-metadata-worker-v1'];await import(${JSON.stringify(moduleURL.href)});`;
  const p = spawnSync(process.execPath, ["--input-type=module", "-e", setup], { input: JSON.stringify(f), encoding: "utf8", maxBuffer: 524288, timeout: 1e4 });
  assert.equal(p.status, 0, p.stderr);
  assert.equal(p.signal, null);
  return JSON.parse(p.stdout);
}
import { fileURLToPath } from "node:url";
test("original short writes retry synchronously and retain exact independently checked records", (t) => {
  const f = fixture(t, packet(body(60, scalar(1, 9))));
  const r = privateWorker(f, "fs.writeSync=(fd,b,o,n,p)=>original.write(fd,b,o,Math.min(n,7),p)");
  assert.equal(r.status, "worker-complete", JSON.stringify(r));
  assert.ok(r.counters.writes > r.counters.records);
  assert.equal(records(path.join(f.out, "ledger.pending"))[2][4].uuid, "9");
  assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
});
for (const [name, fault] of [["zero write", "fs.writeSync=()=>0"], ["ENOSPC", "fs.writeSync=()=>{throw Object.assign(Error('disk'),{code:'ENOSPC'})}"], ["sync failure", "fs.fsyncSync=()=>{throw Error('sync')}"], ["close failure", "fs.closeSync=fd=>{if(fs.fstatSync(fd).size===7)throw Error('close');return original.close(fd)}"], ["ledger reread corruption", "fs.readSync=(fd,b,o,n,p)=>{const got=original.read(fd,b,o,n,p);if(got&&fs.fstatSync(fd).size>300&&b[o]===48&&b[o+1]===58)b[o]=49;return got}"]]) test(name + " cannot publish seal", (t) => {
  const f = fixture(t, packet(body(60, scalar(1, 1)))), r = privateWorker(f, fault);
  assert.equal(r.status, "unavailable", JSON.stringify(r));
  assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
});
test("exact packet field limit accepted and one over refuses", async (t) => {
  for (const count of [8192, 8193]) {
    const f = fixture(t, packet(Buffer.concat(Array.from({ length: count }, () => scalar(500, 0))))), r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, count === 8192 ? "complete-raw-metadata-ledger-diagnostic" : "unavailable", JSON.stringify(r));
  }
});
test("exact packet body limit accepted and one byte over refuses", async (t) => {
  for (const size of [262144, 262145]) {
    const payload = body(500, Buffer.alloc(size - 5));
    assert.equal(payload.length, size);
    const f = fixture(t, packet(payload)), r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, size === 262144 ? "complete-raw-metadata-ledger-diagnostic" : "unavailable", JSON.stringify(r));
  }
});
test("strict clock child cap exact and one over remain local decoder ceilings", async (t) => {
  for (const count of [1024, 1025]) {
    const f = fixture(t, packet(body(6, Buffer.concat(Array.from({ length: count }, () => body(1, Buffer.alloc(0))))))), r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, count === 1024 ? "complete-raw-metadata-ledger-diagnostic" : "unavailable", JSON.stringify(r));
  }
});
test("empty repeated metadata has no global fact dictionary and all occurrences survive", async (t) => {
  const f = fixture(t, Buffer.concat(Array.from({ length: 1600 }, (_, i) => packet(body(60, scalar(1, i)))))), r = await engine.writeRawMetadataLedgerV1(f);
  assert.equal(r.status, "complete-raw-metadata-ledger-diagnostic", JSON.stringify(r));
  const rows = records(path.join(f.out, "ledger.jsonl"));
  assert.equal(rows.filter((row) => row[0] === 2).length, 1600);
  assert.equal(r.counters.maxFragmentBytes <= 3, true);
  assert.equal(Object.hasOwn(r, "metadata"), false);
});
test("late supervisor seal verification failure withdraws its admitted filename", async (t) => {
  const f = fixture(t, packet(Buffer.alloc(0)));
  const original = fs.promises.open;
  fs.promises.open = async function(p, ...args) {
    const f2 = await original.call(this, p, ...args);
    if (p === path.join(fixtureOut, "seal.json")) {
      const read = f2.read.bind(f2);
      f2.read = async (...args2) => {
        const result = await read(...args2);
        if (result.bytesRead > 0) args2[0][args2[1]] = 0;
        return result;
      };
    }
    return f2;
  };
  const fixtureOut = f.out;
  try {
    const r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, "unavailable");
    assert.equal(r.seal, null);
    assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
  } finally {
    fs.promises.open = original;
  }
});
test("publication records acknowledged rename and full pre/post identities", async (t) => {
  const f = fixture(t, packet(Buffer.alloc(0))), r = await engine.writeRawMetadataLedgerV1(f);
  assert.equal(r.status, "complete-raw-metadata-ledger-diagnostic");
  assert.equal(r.publicationFacts.ledger.renameAcknowledged, true);
  assert.equal(r.publicationFacts.seal.renameAcknowledged, true);
  assert.deepEqual(r.publicationFacts.ledger.before.slice(0, 6), r.publicationFacts.ledger.after.slice(0, 6));
  assert.equal(r.publicationFacts.ledger.after.length, 7);
  assert.deepEqual(r.publicationFacts.ledger.after, [...["dev", "ino", "mode", "nlink", "size", "mtimeNs", "ctimeNs"].map((k) => String(fs.statSync(path.join(f.out, "ledger.jsonl"), { bigint: true })[k]))]);
  const seal = JSON.parse(fs.readFileSync(path.join(f.out, "seal.json")));
  assert.equal(seal.ledger.identityStage, "original-pending-before-rename");
  assert.equal(seal.ledger.path, "ledger.jsonl");
});
test("first selected failure and location survive later original input hash refusal", async (t) => {
  const f = fixture(t, Buffer.concat([packet(Buffer.alloc(0)), packet(scalar(60, 1))]));
  f.trace.sha256 = "0".repeat(64);
  const r = await engine.writeRawMetadataLedgerV1(f);
  assert.equal(r.reason, "selected-field-wrong-wire-type");
  assert.equal(r.failurePacketIndex, 1);
  assert.equal(r.io.inputHashMatch, false);
  assert.equal(r.io.inputEOF, true);
  assert.equal(r.io.inputClosed, true);
});
test("owned original deadline kills its original child and never seals a partial operation", async (t) => {
  const f = fixture(t, Buffer.alloc(0));
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = engine.writeRawMetadataLedgerV1(f);
  t.mock.timers.tick(6e4);
  const r = await pending;
  assert.equal(r.status, "unavailable");
  assert.equal(r.reason, "deadline");
  assert.equal(r.seal, null);
  assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
});
test("every read split through root varints and selected bodies preserves the same oracle rows", (t) => {
  const p = Buffer.concat([scalar(10, 123456), body(60, Buffer.concat([scalar(1, 999), body(10, Buffer.alloc(127, 255))])), body(6, body(1, scalar(2, 18446744073709551615n)))]);
  const raw = packet(p);
  for (const split of [1, 2, 3, 4, 7, 64, 127, 128]) {
    const f = fixture(t, raw);
    const fault = `const open=fs.openSync;let input=-1;fs.openSync=(p,...args)=>{const fd=open(p,...args);if(p===${JSON.stringify(f.trace.path)})input=fd;return fd;};fs.readSync=(fd,b,o,n,p)=>original.read(fd,b,o,fd===input?Math.min(n,${split}):n,p)`;
    const r = privateWorker(f, fault);
    assert.equal(r.status, "worker-complete", JSON.stringify(r));
    assert.deepEqual(records(path.join(f.out, "ledger.pending"))[1][4], fields(p));
  }
});
function repeatPackets(count, payload) {
  const one = packet(payload);
  return Buffer.concat(Array.from({ length: count }, () => one));
}
test("whole-input field visits never renew at packet boundaries", async (t) => {
  const one = scalar(500, 0), full = Buffer.concat(Array.from({ length: 8192 }, () => one));
  for (const over of [false, true]) {
    const raw = Buffer.concat([repeatPackets(128, full), ...over ? [packet(one)] : []]), f = fixture(t, raw), r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, over ? "unavailable" : "complete-raw-metadata-ledger-diagnostic", JSON.stringify(r));
    assert.equal(r.counters.topFields, 1048576);
    if (over) assert.equal(r.reason, "field-capacity");
  }
});
test("metadata record count is a whole-input independent ceiling", async (t) => {
  const item = body(60, Buffer.alloc(0)), full = Buffer.concat(Array.from({ length: 8192 }, () => item));
  for (const over of [false, true]) {
    const raw = Buffer.concat([repeatPackets(16, full), ...over ? [packet(item)] : []]), f = fixture(t, raw), r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, over ? "unavailable" : "complete-raw-metadata-ledger-diagnostic", JSON.stringify(r));
    assert.equal(r.counters.metadata, 131072);
    if (over) assert.equal(r.reason, "metadata-capacity");
  }
});
test("aggregate decoded member work exact boundary and one over", async (t) => {
  const clock = body(6, body(1, Buffer.alloc(0))), full = Buffer.concat(Array.from({ length: 8192 }, () => clock));
  for (const over of [false, true]) {
    const tail = Buffer.concat([...Array.from({ length: 5461 }, () => clock), body(60, Buffer.alloc(0)), body(60, Buffer.alloc(0)), ...over ? [body(60, Buffer.alloc(0))] : []]);
    const raw = Buffer.concat([repeatPackets(10, full), packet(tail)]), f = fixture(t, raw), r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, over ? "unavailable" : "complete-raw-metadata-ledger-diagnostic", JSON.stringify(r));
    assert.equal(r.counters.members, 524288);
    if (over) assert.equal(r.reason, "members-capacity");
  }
});
test("header and footer consume total record slots", async (t) => {
  for (const over of [false, true]) {
    const f = fixture(t, repeatPackets(over ? 131072 : 131071, body(60, Buffer.alloc(0)))), r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, over ? "unavailable" : "complete-raw-metadata-ledger-diagnostic", JSON.stringify(r));
    if (!over) assert.equal(r.counters.records, 262144);
    else assert.equal(r.reason, "record-capacity");
  }
});
test("root packet count exact boundary and one over", async (t) => {
  for (const count of [131072, 131073]) {
    const f = fixture(t, repeatPackets(count, Buffer.alloc(0))), r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, count === 131072 ? "complete-raw-metadata-ledger-diagnostic" : "unavailable", JSON.stringify(r));
    assert.equal(r.counters.packets, 131072);
    if (count > 131072) assert.equal(r.reason, "frame-capacity");
  }
});
test("one original deadline also refuses expiration after worker closure during finalization", async (t) => {
  const f = fixture(t, packet(Buffer.alloc(0)));
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const original = fs.promises.open;
  let expired = false;
  fs.promises.open = async function(...args) {
    if (!expired) {
      expired = true;
      t.mock.timers.tick(6e4);
    }
    return original.apply(this, args);
  };
  try {
    const r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(expired, true);
    assert.equal(r.status, "unavailable");
    assert.equal(r.reason, "deadline");
    assert.equal(r.seal, null);
    assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
  } finally {
    fs.promises.open = original;
  }
});
test("seal snapshots prepaid bounded final closure work without self-mutating JSON counters", async (t) => {
  const f = fixture(t, Buffer.alloc(0)), r = await engine.writeRawMetadataLedgerV1(f);
  assert.equal(r.status, "complete-raw-metadata-ledger-diagnostic");
  const seal = JSON.parse(fs.readFileSync(path.join(f.out, "seal.json"), "utf8"));
  assert.equal(seal.counters.closureReservedWork, 16 * 262144);
  assert.equal(r.finalClosure.reservedWork, seal.counters.closureReservedWork);
  assert.ok(r.finalClosure.closureConsumedBeforeResultEncoding > 0 && r.finalClosure.closureConsumedBeforeResultEncoding <= r.finalClosure.reservedWork);
  assert.equal(seal.counters.work, r.counters.work);
});
for (const [name, p] of [["selected uint32 overflow", body(6, body(1, scalar(1, 4294967296n)))], ["selected bool outside profile", body(6, body(1, scalar(3, 2)))], ["selected scalar duplicate", body(6, body(1, Buffer.concat([scalar(2, 1), scalar(2, 1)])))], ["selected uint64 wire overflow", body(60, Buffer.from([8, 255, 255, 255, 255, 255, 255, 255, 255, 255, 2]))]]) test(name + " rejects complete projection", async (t) => {
  const f = fixture(t, packet(p)), r = await engine.writeRawMetadataLedgerV1(f);
  assert.equal(r.status, "unavailable");
  assert.equal(r.seal, null);
  assert.equal(r.failurePacketIndex, 0);
});
test("pinned dependency observed byte drift refuses before projection", (t) => {
  const f = fixture(t, Buffer.alloc(0));
  const pin = fileURLToPath(new URL("../../packages/analyzer/dist/browser-frame-protobuf-wire.js", moduleURL));
  const fault = `const open=fs.openSync;let target=-1;fs.openSync=(p,...a)=>{const fd=open(p,...a);if(p===${JSON.stringify(pin)})target=fd;return fd;};fs.readSync=(fd,b,o,n,p)=>{const got=original.read(fd,b,o,n,p);if(fd===target&&got)b[o]^=1;return got;}`;
  const r = privateWorker(f, fault);
  assert.equal(r.status, "unavailable");
  assert.equal(r.reason, "dependency-pin");
  assert.equal(fs.existsSync(f.out), false);
});
test("own source observed drift on final bookend withdraws pending output", (t) => {
  const f = fixture(t, packet(body(60, scalar(1, 1))));
  const fault = `const open=fs.openSync;let target=-1,opens=0;fs.openSync=(p,...a)=>{const fd=open(p,...a);if(p===${JSON.stringify(fileURLToPath(moduleURL))}){target=fd;opens++;}return fd;};fs.readSync=(fd,b,o,n,p)=>{const got=original.read(fd,b,o,n,p);if(fd===target&&opens>1&&got&&fs.fstatSync(fd).ino===fs.statSync(process.argv[1]).ino)b[o]^=1;return got;}`;
  const r = privateWorker(f, fault);
  assert.equal(r.status, "unavailable");
  assert.equal(r.reason, "source-drift");
  assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
});
test("postrename original ledger mutation is refused before final seal", async (t) => {
  const f = fixture(t, packet(Buffer.alloc(0))), original = fs.promises.rename;
  fs.promises.rename = async function(from, to) {
    const result = await original.call(this, from, to);
    if (to === path.join(f.out, "ledger.jsonl")) fs.appendFileSync(to, "x");
    return result;
  };
  try {
    const r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, "unavailable");
    assert.equal(r.seal, null);
    assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
  } finally {
    fs.promises.rename = original;
  }
});
test("original input early EOF is explicit and never a successful empty trace", (t) => {
  const f = fixture(t, packet(Buffer.alloc(0)));
  const fault = `const open=fs.openSync;let target=-1;fs.openSync=(p,...a)=>{const fd=open(p,...a);if(p===${JSON.stringify(f.trace.path)})target=fd;return fd;};fs.readSync=(fd,...a)=>fd===target?0:original.read(fd,...a)`;
  const r = privateWorker(f, fault);
  assert.equal(r.status, "unavailable");
  assert.equal(r.reason, "input-hash");
  assert.equal(r.io.inputEOF, true);
  assert.equal(r.io.inputHashMatch, false);
});
test("original input read call ceiling includes the independent physical EOF call", (t) => {
  for (const over of [false, true]) {
    const raw = packet(body(500, Buffer.alloc(over ? 4089 : 4088)));
    assert.equal(raw.length, over ? 4096 : 4095);
    const f = fixture(t, raw);
    const fault = `const open=fs.openSync;let input=-1;fs.openSync=(p,...a)=>{const fd=open(p,...a);if(p===${JSON.stringify(f.trace.path)})input=fd;return fd;};fs.readSync=(fd,b,o,n,p)=>original.read(fd,b,o,fd===input?Math.min(1,n):n,p)`;
    const r = privateWorker(f, fault);
    assert.equal(r.status, over ? "unavailable" : "worker-complete", JSON.stringify(r));
    assert.equal(r.counters.inputReads, 4096);
    assert.equal(r.io.inputEOF, !over);
  }
});
test("one-pass verification read ceiling includes physical EOF and never renews", (t) => {
  const raw = repeatPackets(60, Buffer.alloc(0)), dry = fixture(t, raw), first = privateWorker(dry, "");
  assert.equal(first.status, "worker-complete");
  const size = first.ledger.bytes;
  assert.ok(size > 8192);
  for (const over of [false, true]) {
    const f = fixture(t, raw);
    const fault = `const open=fs.openSync;let ledger=-1,reads=0,ledgerIno=-1;fs.openSync=(p,...a)=>{const fd=open(p,...a);if(p===${JSON.stringify(path.join(f.out, "ledger.pending"))}&&(a[0]&3)===fs.constants.O_RDONLY){ledger=fd;ledgerIno=fs.fstatSync(fd).ino;}return fd;};fs.readSync=(fd,b,o,n,p)=>original.read(fd,b,o,fd===ledger&&fs.fstatSync(fd).ino===ledgerIno?Math.min(n,reads++===0?${size - (over ? 8191 : 8190)}:1):n,p)`;
    const r = privateWorker(f, fault);
    assert.equal(r.status, over ? "unavailable" : "worker-complete", JSON.stringify(r));
    assert.equal(r.counters.verificationReads, 8192);
    assert.equal(r.io.verificationEOF, !over);
  }
});
test("short-write retry work reservation cannot renew or exceed four Gi units", (t) => {
  const full = Buffer.concat(Array.from({ length: 8192 }, () => scalar(536870911, 18446744073709551615n))), f = fixture(t, packet(full));
  const r = privateWorker(f, "fs.writeSync=(fd,b,o,n,p)=>original.write(fd,b,o,b.length>1000?Math.min(n,1):n,p)");
  assert.equal(r.status, "unavailable");
  assert.equal(r.reason, "work-capacity");
  assert.ok(r.counters.work <= 4294967296);
  assert.ok(r.counters.writes > 1e3);
  assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
});
test("32 MiB original input boundary is independent of packet and ledger size", async (t) => {
  const raw = repeatPackets(128, body(500, Buffer.alloc(262135)));
  assert.equal(raw.length, 33554432);
  const f = fixture(t, raw), r = await engine.writeRawMetadataLedgerV1(f);
  assert.equal(r.status, "complete-raw-metadata-ledger-diagnostic", JSON.stringify(r));
  assert.ok(r.ledger.bytes < 1e5);
  const over = fixture(t, Buffer.alloc(0));
  over.trace.bytes = 33554433;
  assert.equal((await engine.writeRawMetadataLedgerV1(over)).status, "unavailable");
  assert.equal(fs.existsSync(over.out), false);
});
test("supervisor seal uses checked original partial-write acknowledgments", async (t) => {
  const f = fixture(t, packet(Buffer.alloc(0))), open = fs.promises.open, seen = [];
  fs.promises.open = async function(p, ...a) {
    const handle = await open.call(this, p, ...a);
    if (p === path.join(f.out, "seal.pending")) {
      const write = handle.write.bind(handle);
      handle.write = async (buffer, offset, length, position) => {
        const result = await write(buffer, offset, Math.min(length, 128), position);
        seen.push([offset, length, result.bytesWritten]);
        return result;
      };
    }
    return handle;
  };
  try {
    const r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, "complete-raw-metadata-ledger-diagnostic", JSON.stringify(r));
    assert.ok(seen.length > 1);
    for (let i = 1; i < seen.length; i++) assert.equal(seen[i][0], seen[i - 1][0] + seen[i - 1][2]);
  } finally {
    fs.promises.open = open;
  }
});
for (const [name, bytes] of [["zero", 0], ["one-byte retry capacity", 1]]) test("supervisor seal " + name + " original write refuses without admission", async (t) => {
  const f = fixture(t, packet(Buffer.alloc(0))), open = fs.promises.open;
  fs.promises.open = async function(p, ...a) {
    const handle = await open.call(this, p, ...a);
    if (p === path.join(f.out, "seal.pending")) {
      const write = handle.write.bind(handle);
      handle.write = async (buffer, offset, length, position) => bytes ? write(buffer, offset, 1, position) : { bytesWritten: 0, buffer };
    }
    return handle;
  };
  try {
    const r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, "unavailable");
    assert.equal(r.seal, null);
    assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
  } finally {
    fs.promises.open = open;
  }
});
test("late original output directory substitution by symlink withdraws admission", async (t) => {
  const f = fixture(t, packet(Buffer.alloc(0))), rename = fs.promises.rename;
  let swapped = false;
  fs.promises.rename = async function(from, to) {
    const result = await rename.call(this, from, to);
    if (to === path.join(f.out, "ledger.jsonl")) {
      await rename.call(this, f.out, f.out + "-moved");
      fs.symlinkSync(f.out + "-moved", f.out);
      swapped = true;
    }
    return result;
  };
  try {
    const r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(swapped, true);
    assert.equal(r.status, "unavailable");
    assert.equal(r.seal, null);
    assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
  } finally {
    fs.promises.rename = rename;
  }
});
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { EventEmitter } from "node:events";
test("first owned-channel overflow survives a later deadline and unclosed cleanup grace", async (t) => {
  const f = fixture(t, Buffer.alloc(0)), spawn = childProcess.spawn;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  childProcess.spawn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.destroy = () => {
    };
    child.kill = () => true;
    child.stdin.end = () => queueMicrotask(() => {
      child.stdout.emit("data", Buffer.alloc(262145));
      t.mock.timers.tick(6e4);
    });
    return child;
  };
  syncBuiltinESMExports();
  try {
    const r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, "unavailable");
    assert.equal(r.reason, "stdout-capacity");
    assert.equal(r.io.unclosedOriginalOperation, true);
    assert.equal(r.io.supervisorDeadlineExpired, true);
    assert.equal(r.seal, null);
    assert.equal(fs.existsSync(f.out), false);
  } finally {
    childProcess.spawn = spawn;
    syncBuiltinESMExports();
  }
});
test("exclusive files retain fixed 0600 mode under a restrictive inherited umask", async (t) => {
  const f = fixture(t, packet(Buffer.alloc(0))), original = process.umask(511);
  try {
    const r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, "complete-raw-metadata-ledger-diagnostic", JSON.stringify(r));
    for (const name of ["ledger.jsonl", "seal.json"]) assert.equal(fs.statSync(path.join(f.out, name)).mode & 511, 384);
  } finally {
    process.umask(original);
  }
});
test("a second link to the original pending seal refuses admission", async (t) => {
  const f = fixture(t, packet(Buffer.alloc(0))), open = fs.promises.open;
  fs.promises.open = async function(p, ...a) {
    const handle = await open.call(this, p, ...a);
    if (p === path.join(f.out, "seal.pending")) {
      const sync = handle.sync.bind(handle);
      handle.sync = async () => {
        await sync();
        fs.linkSync(p, path.join(f.out, "foreign-link"));
      };
    }
    return handle;
  };
  try {
    const r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, "unavailable");
    assert.equal(r.seal, null);
    assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
  } finally {
    fs.promises.open = open;
  }
});
test("ledger reread independently reconstructs member count even with internally rehashed forged footer", (t) => {
  const descriptor = Buffer.concat([scalar(1, 1), body(3, Buffer.concat([scalar(1, 2), scalar(7, 3)])), body(4, Buffer.concat([scalar(1, 4), scalar(2, 5)]))]), clock = body(1, Buffer.alloc(0)), f = fixture(t, packet(Buffer.concat([body(60, descriptor), body(6, clock)])));
  const fault = `const stringify=JSON.stringify;JSON.stringify=(v,...a)=>{if(Array.isArray(v)&&v.length===9&&v[0]===3&&v[5]===25){const copy=[...v];copy[5]=26;return stringify(copy,...a);}return stringify(v,...a);}`;
  const r = privateWorker(f, fault);
  assert.equal(r.status, "unavailable");
  assert.equal(r.reason, "ledger-member-count");
  assert.equal(r.counters.members, 25);
  assert.equal(records(path.join(f.out, "ledger.pending")).at(-1)[5], 26);
  assert.equal(fs.existsSync(path.join(f.out, "seal.json")), false);
});
async function withClosedChannelResponse(payload, run) {
  const spawn = childProcess.spawn;
  childProcess.spawn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.destroy = () => {
    };
    child.kill = () => true;
    child.stdin.end = () => queueMicrotask(() => {
      child.stdout.emit("data", payload);
      child.stdout.emit("end");
      child.stdout.emit("close");
      child.stderr.emit("end");
      child.stderr.emit("close");
      child.stdin.emit("close");
      child.emit("exit", 0, null);
      child.emit("close", 0, null);
    });
    return child;
  };
  syncBuiltinESMExports();
  try {
    return await run();
  } finally {
    childProcess.spawn = spawn;
    syncBuiltinESMExports();
  }
}
for (const [name, payload, reason] of [["oversized result", Buffer.alloc(262145, 32), "stdout-capacity"], ["deep result", Buffer.from('{"status":"unavailable","reason":"x","packetIndex":null,"io":' + "[".repeat(12) + "0" + "]".repeat(12) + ',"counters":null}'), "protocol-depth-capacity"], ["excessive result nodes", Buffer.from('{"status":"unavailable","reason":"x","packetIndex":null,"io":[' + Array(4500).fill("0").join(",") + '],"counters":null}'), "protocol-node-capacity"], ["invalid result UTF8", Buffer.concat([Buffer.from('{"status":"unavailable","reason":"'), Buffer.from([255]), Buffer.from('","packetIndex":null,"io":null,"counters":null}')]), "child-stdout-utf8"], ["extra result message", Buffer.from("{}{}"), "supervisor-unavailable"], ["oversized failure diagnostic", Buffer.from(JSON.stringify({ status: "unavailable", reason: "x".repeat(5e3), packetIndex: null, io: null, counters: null })), "worker-failure-shape"]]) test("closed transport rejects " + name + " before file admission", async (t) => {
  const f = fixture(t, Buffer.alloc(0));
  const r = await withClosedChannelResponse(payload, () => engine.writeRawMetadataLedgerV1(f));
  assert.equal(r.status, "unavailable");
  assert.equal(r.reason, reason);
  assert.equal(r.seal, null);
  assert.equal(fs.existsSync(f.out), false);
});
test("private original request parse rejects deep, invalid UTF8, and oversized single requests", (t) => {
  const f = fixture(t, Buffer.alloc(0));
  for (const input of [Buffer.from('{"trace":' + "[".repeat(12) + "0" + "]".repeat(12) + ',"out":"x"}'), Buffer.concat([Buffer.from('{"trace":"'), Buffer.from([255]), Buffer.from('","out":"x"}')]), Buffer.alloc(16385, 32)]) {
    const r = spawnSync(process.execPath, [fileURLToPath(moduleURL), "--private-raw-metadata-worker-v1"], { input, encoding: "utf8", maxBuffer: 524288, timeout: 1e4 });
    if (r.status === 0) assert.equal(JSON.parse(r.stdout).status, "unavailable");
    else assert.equal(r.status, 1);
    assert.equal(fs.existsSync(f.out), false);
  }
});
test("owned child grace cutoff snapshots stay unclosed despite late original events", async (t) => {
  const f = fixture(t, Buffer.alloc(0)), spawn = childProcess.spawn;
  let originalChild;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const lateClose = () => {
    originalChild.stdout.emit("end");
    originalChild.stdout.emit("close");
    originalChild.stderr.emit("end");
    originalChild.stderr.emit("close");
    originalChild.stdin.emit("close");
    originalChild.emit("exit", 0, null);
    originalChild.emit("close", 0, null);
  };
  childProcess.spawn = () => {
    const child = new EventEmitter();
    originalChild = child;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.destroy = () => {
    };
    child.kill = () => true;
    child.stdin.end = () => queueMicrotask(() => {
      child.stdout.emit("data", Buffer.alloc(262145));
      t.mock.timers.tick(5e3);
      lateClose();
    });
    return child;
  };
  syncBuiltinESMExports();
  try {
    const r = await engine.writeRawMetadataLedgerV1(f);
    assert.equal(r.status, "unavailable");
    assert.equal(r.reason, "stdout-capacity");
    assert.equal(r.io.unclosedOriginalOperation, true);
    assert.equal(r.io.exit, null);
    assert.equal(r.io.close, null);
    assert.equal(r.io.stdoutClosed, false);
    assert.equal(r.io.stderrClosed, false);
    const cutoff = JSON.stringify(r.io);
    lateClose();
    assert.equal(JSON.stringify(r.io), cutoff);
    assert.equal(r.seal, null);
  } finally {
    childProcess.spawn = spawn;
    syncBuiltinESMExports();
  }
});
