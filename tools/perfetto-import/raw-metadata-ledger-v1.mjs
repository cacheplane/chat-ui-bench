import fs from "node:fs";
import { createHash } from "node:crypto";
import { types } from "node:util";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join, sep } from "node:path";
// This is a diagnostic projection, never a replacement for V11 or a metric.
const SELF = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SELF), "../..");
const POLICY = "raw-metadata-ledger-v1", SHA = /^[a-f0-9]{64}$/;
const LIMITS = Object.freeze({ inputBytes: 33554432, chunkBytes: 65536, inputReads: 4096, packetBytes: 262144, packets: 131072, fields: 1048576, members: 524288, metadata: 131072, records: 262144, recordBytes: 1049088, ledgerBytes: 268435456, writes: 1048576, verificationReads: 8192, sourceBytes: 4194304, summaryBytes: 262144, work: 4294967296, deadlineMs: 6e4, cleanupMs: 5e3 });
const PINS = {
  "browser-frame-trace-framer": ["a10bf3bc680c10a7ecc336196d61578617d8ee0ccbe569025e2b114564372aa4", "5033304bfa4ae8e139ffada2fc402c80164c376ee14ea0c7400be04428b8e57e"],
  "browser-frame-protobuf-wire": ["db48e75d1ddf63370b0302ec17447476d175440f86b08872ceee98e37dda8f3e", "eb8cf8cb054fbed35681f1d54621f81481fba898e6a6e6edd9d160f621dcd96d"],
  "browser-frame-track-descriptor-fragments": ["96ba204dce2c2172540dc143c417ba0609477015c65101c7999d5ea48de31ada", "ef113bb9e10ceec675e466d5b5c94d66b026c4ee8329f2acc986b2b9cafc8fc7"],
  "browser-frame-state-fragments": ["b1dce024aa8609430be3901e9f3e3503d53883d367e7ecf881ca4eca3816137d", "e7700861763677324d59680abf9a62b42565c848c40fb08a1a520bbd40b4b1e2"]
};
const AUTH = { diagnosticOnly: true, fullPacketSchemaChecked: false, dataOneofChecked: false, otherPayloadSemantics: "opaque", orderedState: "not_evaluated", annotations: "not_evaluated", marks: "not_evaluated", clock: "not_evaluated", importCorrespondence: "not_evaluated", association: "not_evaluated", originalExecution: "not_evaluated", fullTargetAuthentication: "unavailable", nativeSupported: false, qualification: false, evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false, fpsEligibility: false, FPS: null, rate: null, latency: null, duration: null };
class Refusal extends Error {
  constructor(code, packetIndex = null) {
    super(code);
    this.code = code;
    this.packetIndex = packetIndex;
  }
}
const need = (ok, code) => {
  if (!ok) throw new Refusal(code);
};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const digest = (b) => createHash("sha256").update(b).digest("hex");
const id = (s) => [s.dev, s.ino, s.mode, s.nlink, s.size, s.mtimeNs, s.ctimeNs].map(String);
const owns = (p, child) => child === p || child.startsWith(p + sep);
function closed(v, keys) {
  need(v !== null && typeof v === "object" && !types.isProxy(v) && Object.getPrototypeOf(v) === Object.prototype, "invalid-request");
  const ds = Object.getOwnPropertyDescriptors(v), ks = Reflect.ownKeys(ds);
  need(ks.length === keys.length && ks.every((k) => typeof k === "string" && keys.includes(k) && Object.hasOwn(ds[k], "value")), "invalid-request");
  return Object.fromEntries(keys.map((k) => [k, ds[k].value]));
}
function canonical(p) {
  need(typeof p === "string" && p.startsWith("/") && p === resolve(p) && !p.includes("\0") && Buffer.byteLength(p) <= 4096, "invalid-path");
  return p;
}
function request(v) {
  const o = closed(v, ["trace", "out"]), t = closed(o.trace, ["path", "bytes", "sha256"]);
  canonical(t.path);
  canonical(o.out);
  need(Number.isSafeInteger(t.bytes) && t.bytes >= 0 && t.bytes <= LIMITS.inputBytes && typeof t.sha256 === "string" && SHA.test(t.sha256), "invalid-reference");
  need(!owns(o.out, t.path) && !owns(o.out, ROOT) && !owns(ROOT, o.out), "invalid-output");
  return { trace: t, out: o.out };
}
function physical(p) {
  need(fs.realpathSync(p) === p, "nonphysical-path");
  let cur = p;
  for (; ; ) {
    need(!fs.lstatSync(cur).isSymbolicLink(), "symlink-path");
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
}
function budget() {
  const used = { work: 0, closureReservedWork: 0, topFields: 0, selectedFields: 0, members: 0, packets: 0, metadata: 0, records: 0, ledgerBytes: 0, writes: 0, inputReads: 0, verificationReads: 0, maxPacketBytes: 0, maxFragmentBytes: 0, maxRecordBytes: 0 };
  return { used, add(k, n = 1, cap = LIMITS[k]) {
    need(Number.isSafeInteger(n) && n >= 0 && Number.isSafeInteger(used[k]) && n <= cap - used[k], k + "-capacity");
    used[k] += n;
  }, work(n) {
    this.add("work", n);
  }, field(k) {
    need(used.topFields + used.selectedFields < LIMITS.fields, "field-capacity");
    this.work(1);
    used[k]++;
  }, member(n = 1) {
    this.work(n);
    this.add("members", n);
  } };
}
function roles() {
  const list = [{ role: "engine", path: SELF }];
  for (const [stem, pins] of Object.entries(PINS)) for (const [i, kind] of ["src", "dist"].entries()) list.push({ role: `packages/analyzer/${kind}/${stem}.${i ? "js" : "ts"}`, path: join(ROOT, `packages/analyzer/${kind}/${stem}.${i ? "js" : "ts"}`), pin: pins[i] });
  for (const role of ["package.json", "package-lock.json", "tsconfig.base.json", "packages/analyzer/package.json", "packages/analyzer/tsconfig.json"]) list.push({ role, path: join(ROOT, role) });
  return list;
}
function snapshot(b) {
  let total = 0;
  return roles().map((role) => {
    physical(role.path);
    const before = fs.lstatSync(role.path, { bigint: true });
    need(before.isFile() && before.nlink === 1n && before.size <= BigInt(LIMITS.sourceBytes - total), "source-unavailable");
    let fd;
    const h = createHash("sha256");
    let bytes = 0;
    try {
      fd = fs.openSync(role.path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      need(equal(id(before), id(fs.fstatSync(fd, { bigint: true }))), "source-drift");
      b.work(65536);
      const buf = Buffer.alloc(65536);
      for (let reads = 0; ; ) {
        need(reads++ < 66, "source-read-capacity");
        b.work(65536);
        const n = fs.readSync(fd, buf, 0, Math.min(65536, LIMITS.sourceBytes - total - bytes + 1), null);
        if (n === 0) break;
        need(n > 0 && n <= 65536, "source-read");
        bytes += n;
        b.work(n);
        h.update(buf.subarray(0, n));
      }
      need(bytes === Number(before.size) && equal(id(before), id(fs.fstatSync(fd, { bigint: true }))) && equal(id(before), id(fs.lstatSync(role.path, { bigint: true }))), "source-drift");
    } finally {
      if (fd !== void 0) fs.closeSync(fd);
    }
    total += bytes;
    need(total <= LIMITS.sourceBytes, "source-capacity");
    const sha256 = h.digest("hex");
    need(!role.pin || sha256 === role.pin, "dependency-pin");
    return { role: role.role, path: role.path, bytes, sha256, identity: id(before) };
  });
}
function sourceManifest(facts, b) {
  const rows = facts.map(({ role, bytes, sha256 }) => {
    b.work(1);
    return { role, bytes, sha256 };
  });
  const size = jsonBytes(rows, b);
  b.work(size * 2 + "raw-metadata-sources-v1\n".length);
  const json = JSON.stringify(rows);
  return digest("raw-metadata-sources-v1\n" + json);
}
// Exact native JSON byte preflight on owned values. Escaping is charged before stringify.
function jsonBytes(v, b, members = false, memberRoot = void 0) {
  if (v === memberRoot) members = true;
  b.work(1);
  if (v === null) return 4;
  if (typeof v === "boolean") return v ? 4 : 5;
  if (typeof v === "number") {
    need(Number.isSafeInteger(v), "invalid-owned-number");
    return String(v).length;
  }
  if (typeof v === "string") {
    let bytes2 = 2;
    for (let i = 0; i < v.length; i++) {
      b.work(1);
      const c = v.charCodeAt(i);
      if (c === 34 || c === 92 || c === 8 || c === 9 || c === 10 || c === 12 || c === 13) bytes2 += 2;
      else if (c < 32) bytes2 += 6;
      else if (c < 128) bytes2++;
      else if (c < 2048) bytes2 += 2;
      else if (c >= 55296 && c <= 56319 && i + 1 < v.length && v.charCodeAt(i + 1) >= 56320 && v.charCodeAt(i + 1) <= 57343) {
        bytes2 += 4;
        i++;
        b.work(1);
      } else if (c >= 55296 && c <= 57343) bytes2 += 6;
      else bytes2 += 3;
    }
    return bytes2;
  }
  need(typeof v === "object", "invalid-owned-json");
  let bytes = 2, count = 0;
  if (Array.isArray(v)) {
    for (const child of v) {
      if (members) b.member(2);
      bytes += (count++ ? 1 : 0) + jsonBytes(child, b, members, memberRoot);
    }
  } else for (const key of Object.keys(v)) {
    if (members) b.member(2);
    bytes += (count++ ? 1 : 0) + jsonBytes(key, b) + 1 + jsonBytes(v[key], b, members, memberRoot);
  }
  return bytes;
}
function encode(row, ordinal, occ, b) {
  const n = jsonBytes(row, b, false, row[0] === 2 ? row[4] : void 0), prefix = String(ordinal).length + 1 + String(n).length + 1 + 64 + 1;
  const size = prefix + n + 1;
  need(size <= LIMITS.recordBytes && size <= 512 + 128 * occ, "record-serialization-capacity");
  b.work(n * 2 + size);
  const text = JSON.stringify(row);
  need(Buffer.byteLength(text) === n, "serialization-mismatch");
  const out = Buffer.from(`${ordinal}:${n}:${digest(text)}	${text}
`);
  need(out.length === size, "serialization-mismatch");
  b.used.maxRecordBytes = Math.max(b.used.maxRecordBytes, size);
  return out;
}
// Closed one-message transport is separately bounded, outside the ledger/source/
// closure logical-work meter. No metadata inventory travels through this channel.
function protocolEncode(value, cap) {
  let nodes = 0, steps = 0;
  const meter = { work(n) {
    need(n <= cap * 16 - steps, "protocol-work-capacity");
    steps += n;
  } };
  const inspect = (v, depth) => {
    need(++nodes <= 4096 && depth <= 8, "protocol-shape-capacity");
    meter.work(1);
    if (v === null || typeof v === "boolean" || typeof v === "number") return;
    if (typeof v === "string") {
      need(Buffer.byteLength(v) <= 4096, "protocol-string-capacity");
      return;
    }
    need(v !== null && typeof v === "object" && !types.isProxy(v) && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype), "protocol-shape");
    for (const key of Object.keys(v)) {
      need(key.length <= 128, "protocol-key-capacity");
      inspect(v[key], depth + 1);
    }
  };
  inspect(value, 0);
  const size = jsonBytes(value, meter);
  need(size <= cap, "protocol-byte-capacity");
  const text = JSON.stringify(value);
  need(Buffer.byteLength(text) === size, "protocol-serialization");
  return Buffer.from(text);
}
function protocolParse(text, cap) {
  need(typeof text === "string" && Buffer.byteLength(text) <= cap && text[0] === "{" && text.at(-1) === "}", "protocol-byte-capacity");
  let depth = 0, nodes = 0, string = false, escape = false, token = false;
  for (const ch of text) {
    if (string) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') string = false;
      continue;
    }
    if (ch === '"') {
      string = true;
      token = false;
      nodes++;
    } else if (ch === "{" || ch === "[") {
      need(++depth <= 8, "protocol-depth-capacity");
      nodes++;
      token = false;
    } else if (ch === "}" || ch === "]") {
      need(--depth >= 0, "protocol-shape");
      token = false;
    } else if (ch === "," || ch === ":") {
      nodes++;
      token = false;
    } else if (!/\s/.test(ch) && !token) {
      nodes++;
      token = true;
    }
    need(nodes <= 4096, "protocol-node-capacity");
  }
  need(!string && depth === 0, "protocol-shape");
  return JSON.parse(text);
}
const SCOPES = { clock_snapshot: 0, clock: 1, track_descriptor: 2, process_descriptor: 3, thread_descriptor: 4 };
function workerRun(req) {
  const b = budget(), io = { inputEOF: false, inputClosed: false, inputHashMatch: false, inputIdentityMatch: false, ledgerClosed: false, verificationEOF: false, verificationClosed: false };
  let inputFd, ledgerFd, first = null;
  const facts = snapshot(b), manifest = sourceManifest(facts, b);
  let traceBefore, ledgerIdentity, outIdentity;
  let packetCount = 0, metadataCount = 0;
  b.work("raw-metadata-records-v1\n".length + "raw-metadata-packets-v1\n".length);
  const allHash = createHash("sha256"), recordHash = createHash("sha256").update("raw-metadata-records-v1\n"), packetHash = createHash("sha256").update("raw-metadata-packets-v1\n");
  const write = (row, occ = 0) => {
    need(b.used.records < LIMITS.records - (row[0] === 3 ? 0 : 1), "record-capacity");
    const bytes = encode(row, b.used.records, occ, b);
    const reserved = row[0] === 3 ? 0 : 512;
    need(bytes.length <= LIMITS.ledgerBytes - b.used.ledgerBytes - reserved, "ledger-byte-capacity");
    let at = 0;
    while (at < bytes.length) {
      need(b.used.writes < LIMITS.writes, "writes-capacity");
      b.work(bytes.length - at);
      b.add("writes");
      const n = fs.writeSync(ledgerFd, bytes, at, bytes.length - at, null);
      need(Number.isInteger(n) && n > 0 && n <= bytes.length - at, "ledger-write");
      at += n;
    }
    b.work(bytes.length * (row[0] === 1 ? 3 : row[0] === 3 ? 1 : 2));
    allHash.update(bytes);
    if (row[0] !== 3) recordHash.update(bytes);
    if (row[0] === 1) packetHash.update(bytes);
    b.used.ledgerBytes += bytes.length;
    b.used.records++;
  };
  return (async () => {
    try {
      physical(req.trace.path);
      physical(dirname(req.out));
      need(fs.lstatSync(dirname(req.out)).isDirectory(), "invalid-output-parent");
      need(!fs.existsSync(req.out), "output-exists");
      fs.mkdirSync(req.out, { mode: 448 });
      physical(req.out);
      fs.chmodSync(req.out, 448);
      outIdentity = id(fs.lstatSync(req.out, { bigint: true })).slice(0, 3);
      const [wire, framing, descriptor, state] = await Promise.all(["browser-frame-protobuf-wire", "browser-frame-trace-framer", "browser-frame-track-descriptor-fragments", "browser-frame-state-fragments"].map((stem) => import(pathToFileURL(join(ROOT, "packages/analyzer/dist", stem + ".js")).href)));
      ledgerFd = fs.openSync(join(req.out, "ledger.pending"), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 384);
      fs.fchmodSync(ledgerFd, 384);
      write([0, 1, req.trace.bytes, req.trace.sha256, manifest]);
      let active = null, at = 0;
      const framer = new framing.TraceRootFramer(req.trace.bytes, LIMITS.packets, LIMITS.packetBytes, { start(frame) {
        const n = frame.bodyEnd - frame.bodyStart;
        b.work(n);
        active = new Uint8Array(n);
        at = 0;
        b.used.maxPacketBytes = Math.max(b.used.maxPacketBytes, n);
      }, body(piece) {
        b.work(piece.length);
        active.set(piece, at);
        at += piece.length;
      }, end(frame) {
        const p = active, top = [], reader = new wire.BodyReader(p, 0, p.length, wire.newWholeWireBudget());
        b.work(p.length);
        while (!reader.complete) {
          b.field("topFields");
          const f = reader.next("root"), o = f.occurrence;
          b.work(o.end - o.start);
          let sha = null;
          if (o.wireType !== 0) {
            b.work(o.end - o.valueStart);
            sha = digest(p.subarray(o.valueStart, o.end));
          }
          top.push([o.fieldNumber, o.wireType, o.start, o.valueStart, o.end, f.scalar === void 0 ? null : f.scalar.toString(), sha]);
        }
        write([1, frame.frameIndex, [frame.keyStart, frame.keyEnd, frame.lengthStart, frame.lengthEnd, frame.bodyStart, frame.bodyEnd], digest(p), top], top.length);
        for (let index = 0; index < top.length; index++) {
          b.work(1);
          const o = top[index];
          if (o[0] !== 6 && o[0] !== 60) continue;
          need(o[1] === 2, "selected-field-wrong-wire-type");
          b.add("metadata");
          b.member();
          const size = o[4] - o[3];
          b.work(size * 5);
          // Pass an ordinary view; the unchanged decoder makes the sole owned
          // fragment copy. The view shares the one active packet backing store.
          const window = p.subarray(o[3], o[4]);
          b.used.maxFragmentBytes = Math.max(b.used.maxFragmentBytes, size);
          const decoded = o[0] === 60 ? descriptor.decodeWholeDescriptor(window) : state.decodeWholeStateBody(window, "clock_snapshot");
          need(decoded.status !== "unavailable", decoded.diagnostics?.[0]?.code ?? "selected-decode");
          const owned = decoded.bodyBytes;
          const children = [];
          let skip = 0;
          for (const child of decoded.occurrences) {
            b.field("selectedFields");
            b.work(1);
            const skipped = decoded.skippedFields[skip];
            let opaque = null;
            if (skipped && skipped.scope === child.scope && skipped.start === child.start && skipped.end === child.end) {
              b.work(child.end - child.valueStart);
              opaque = digest(owned.subarray(child.valueStart, child.end));
              skip++;
            }
            if (child.scope === "process_descriptor" || child.scope === "thread_descriptor" || child.scope === "clock") b.member();
            if (child.scope === "clock_snapshot" && child.fieldNumber === 1) b.member();
            children.push([SCOPES[child.scope], child.fieldNumber, child.wireType, child.start, child.valueStart, child.end, opaque]);
          }
          // The owned preflight charges both its property visit and native serialization.
          write([2, frame.frameIndex, index, o[0], decoded.fields, children], children.length);
          metadataCount++;
        }
        packetCount++;
        b.used.packets++;
        active = null;
      } });
      traceBefore = fs.lstatSync(req.trace.path, { bigint: true });
      need(traceBefore.isFile() && traceBefore.nlink === 1n && traceBefore.size === BigInt(req.trace.bytes), "input-extent");
      inputFd = fs.openSync(req.trace.path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      need(equal(id(traceBefore), id(fs.fstatSync(inputFd, { bigint: true }))), "input-identity");
      const inputHash = createHash("sha256"), buf = Buffer.alloc(65536);
      let bytes = 0;
      for (; ; ) {
        b.add("inputReads");
        const want = Math.min(buf.length, req.trace.bytes - bytes + 1);
        b.work(want);
        const n = fs.readSync(inputFd, buf, 0, want, null);
        need(Number.isInteger(n) && n >= 0 && n <= want, "input-read");
        if (!n) {
          io.inputEOF = true;
          break;
        }
        bytes += n;
        need(bytes <= req.trace.bytes, "input-extent");
        b.work(n);
        inputHash.update(buf.subarray(0, n));
        if (!first) try {
          framer.feed(buf.subarray(0, n));
        } catch (error) {
          first = error;
          if (first.packetIndex == null) first.packetIndex = framer.frameIndex ?? null;
        }
      }
      io.inputHashMatch = bytes === req.trace.bytes && inputHash.digest("hex") === req.trace.sha256;
      physical(req.trace.path);
      io.inputIdentityMatch = equal(id(traceBefore), id(fs.fstatSync(inputFd, { bigint: true }))) && equal(id(traceBefore), id(fs.lstatSync(req.trace.path, { bigint: true })));
      fs.closeSync(inputFd);
      inputFd = void 0;
      io.inputClosed = true;
      need(io.inputHashMatch, "input-hash");
      need(io.inputIdentityMatch, "input-drift");
      if (first) throw first;
      framer.finish();
      const packetManifestSHA256 = packetHash.digest("hex"), recordManifestSHA256 = recordHash.digest("hex");
      write([3, packetCount, metadataCount, b.used.topFields, b.used.selectedFields, b.used.members, req.trace.sha256, packetManifestSHA256, recordManifestSHA256]);
      fs.fsyncSync(ledgerFd);
      ledgerIdentity = id(fs.fstatSync(ledgerFd, { bigint: true }));
      fs.closeSync(ledgerFd);
      ledgerFd = void 0;
      io.ledgerClosed = true;
      const ledgerSHA256 = allHash.digest("hex");
      verifyLedger(join(req.out, "ledger.pending"), { trace: req.trace, manifest, packetCount, metadataCount, packetManifestSHA256, recordManifestSHA256, ledgerSHA256, bytes: b.used.ledgerBytes, records: b.used.records, top: b.used.topFields, selected: b.used.selectedFields, members: b.used.members }, b, io);
      need(equal(facts, snapshot(b)), "source-drift");
      physical(req.trace.path);
      need(equal(id(traceBefore), id(fs.lstatSync(req.trace.path, { bigint: true }))) && equal(ledgerIdentity, id(fs.lstatSync(join(req.out, "ledger.pending"), { bigint: true }))), "final-drift");
      need(fs.realpathSync(req.out) === req.out && equal(id(fs.lstatSync(req.out, { bigint: true })).slice(0, 3), outIdentity), "output-drift");
      return { status: "worker-complete", trace: req.trace, out: req.out, outIdentity, sources: facts, sourceManifestSHA256: manifest, ledger: { bytes: b.used.ledgerBytes, sha256: ledgerSHA256, records: b.used.records, identity: ledgerIdentity }, packetManifestSHA256, recordManifestSHA256, counters: b.used, io, traceIdentity: id(traceBefore) };
    } catch (error) {
      const failure = first ?? error;
      return { status: "unavailable", reason: failure.code ?? "io-unavailable", packetIndex: failure.packetIndex ?? null, counters: b.used, io };
    } finally {
      for (const fd of [inputFd, ledgerFd]) if (fd !== void 0) try {
        fs.closeSync(fd);
      } catch {
      }
    }
  })();
}
function verifyLedger(path, expected, b, io) {
  physical(path);
  const initial = fs.lstatSync(path, { bigint: true });
  need(initial.isFile() && initial.nlink === 1n && initial.size === BigInt(expected.bytes), "ledger-identity");
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  let pending = Buffer.alloc(0), ordinal = 0, packets = 0, metadata = 0, top = 0, selected = 0, members = 0;
  let lastTop = null, lastPacket = -1, lastMeta = -1, expectedSelected = 0, seenSelected = 0, footer = false, total = 0;
  b.work("raw-metadata-records-v1\n".length + "raw-metadata-packets-v1\n".length);
  const h = createHash("sha256"), rh = createHash("sha256").update("raw-metadata-records-v1\n"), ph = createHash("sha256").update("raw-metadata-packets-v1\n");
  const finishPacket = () => need(expectedSelected === seenSelected, "ledger-missing-metadata");
  function propertyMembers(value, depth = 0) {
    need(depth <= 4, "ledger-member-depth");
    if (value === null || typeof value !== "object") return 0;
    let count = 0;
    for (const child of Object.values(value)) {
      b.work(1);
      count += 2 + propertyMembers(child, depth + 1);
    }
    return count;
  }
  function accept(line) {
    need(!footer && line.length <= LIMITS.recordBytes, "ledger-trailing");
    // Reserve twelve full byte scans before UTF8 roundtrip, payload hashing,
    // JSON parse/stringify/canonical comparisons, schema equality and two manifests.
    b.work(line.length * 12);
    const text = line.toString("utf8");
    need(Buffer.from(text).equals(line), "ledger-utf8");
    const match = /^(0|[1-9][0-9]*):(0|[1-9][0-9]*):([a-f0-9]{64})\t([^\n]*)\n$/.exec(text);
    need(match && Number(match[1]) === ordinal && Buffer.byteLength(match[4]) === Number(match[2]) && digest(match[4]) === match[3], "ledger-framing");
    const row = JSON.parse(match[4]);
    need(JSON.stringify(row) === match[4] && Array.isArray(row), "ledger-canonical");
    if (ordinal === 0) need(equal(row, [0, 1, expected.trace.bytes, expected.trace.sha256, expected.manifest]), "ledger-header");
    else if (row[0] === 1) {
      finishPacket();
      need(row.length === 5 && row[1] === packets && Array.isArray(row[2]) && row[2].length === 6 && SHA.test(row[3]) && Array.isArray(row[4]), "ledger-packet");
      const windows = row[2];
      need(windows.every(Number.isSafeInteger) && windows[0] >= 0 && windows[1] > windows[0] && windows[2] === windows[1] && windows[3] > windows[2] && windows[4] === windows[3] && windows[5] >= windows[4] && windows[5] <= expected.trace.bytes, "ledger-frame-window");
      packets++;
      lastPacket = row[1];
      lastTop = row[4];
      lastMeta = -1;
      top += lastTop.length;
      expectedSelected = 0;
      seenSelected = 0;
      let end = 0;
      for (const o of lastTop) {
        b.work(1);
        need(Array.isArray(o) && o.length === 7 && Number.isInteger(o[0]) && o[0] >= 1 && o[0] <= 536870911 && [0, 1, 2, 5].includes(o[1]) && o.slice(2, 5).every(Number.isSafeInteger) && o[2] === end && o[3] > o[2] && o[4] >= o[3] && o[4] <= windows[5] - windows[4], "ledger-top-window");
        need(o[1] === 0 ? typeof o[5] === "string" && /^(0|[1-9][0-9]{0,19})$/.test(o[5]) && BigInt(o[5]) <= 18446744073709551615n && o[6] === null : o[5] === null && typeof o[6] === "string" && SHA.test(o[6]), "ledger-top-value");
        end = o[4];
        if (o[0] === 6 || o[0] === 60) {
          need(o[1] === 2, "ledger-selected-wire");
          expectedSelected++;
        }
      }
      need(end === windows[5] - windows[4], "ledger-packet-coverage");
      ph.update(line);
    } else if (row[0] === 2) {
      need(row.length === 6 && row[1] === lastPacket && Number.isInteger(row[2]) && row[2] > lastMeta && lastTop?.[row[2]]?.[0] === row[3] && (row[3] === 6 || row[3] === 60) && row[4] !== null && typeof row[4] === "object" && !Array.isArray(row[4]) && Array.isArray(row[5]), "ledger-metadata");
      lastMeta = row[2];
      metadata++;
      seenSelected++;
      selected += row[5].length;
      members += 1 + propertyMembers(row[4]);
      const bodySize = lastTop[row[2]][4] - lastTop[row[2]][3];
      for (const o of row[5]) {
        b.work(1);
        need(Array.isArray(o) && o.length === 7 && Number.isInteger(o[0]) && o[0] >= 0 && o[0] <= 4 && Number.isInteger(o[1]) && o[1] >= 1 && o[1] <= 536870911 && [0, 1, 2, 5].includes(o[2]) && o.slice(3, 6).every(Number.isSafeInteger) && o[3] >= 0 && o[4] > o[3] && o[5] >= o[4] && o[5] <= bodySize && (o[6] === null || typeof o[6] === "string" && SHA.test(o[6])), "ledger-child-window");
        if (o[0] === 1 || o[0] === 3 || o[0] === 4) members++;
        if (o[0] === 0 && o[1] === 1) members++;
      }
    } else if (row[0] === 3) {
      finishPacket();
      need(row[5] === members && members === expected.members, "ledger-member-count");
      need(equal(row, [3, packets, metadata, top, selected, expected.members, expected.trace.sha256, expected.packetManifestSHA256, expected.recordManifestSHA256]), "ledger-footer");
      footer = true;
    } else need(false, "ledger-kind");
    if (row[0] !== 3) rh.update(line);
    ordinal++;
  }
  try {
    need(equal(id(initial), id(fs.fstatSync(fd, { bigint: true }))), "ledger-drift");
    const buf = Buffer.alloc(65536);
    for (; ; ) {
      b.add("verificationReads");
      b.work(buf.length);
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      need(Number.isInteger(n) && n >= 0 && n <= buf.length, "ledger-read");
      if (!n) {
        io.verificationEOF = true;
        break;
      }
      total += n;
      need(total <= expected.bytes, "ledger-extent");
      b.work(n * 2);
      h.update(buf.subarray(0, n));
      b.work(pending.length + n);
      const chunk = Buffer.concat([pending, buf.subarray(0, n)]);
      let at = 0;
      for (; ; ) {
        const end = chunk.indexOf(10, at);
        b.work((end < 0 ? chunk.length : end + 1) - at);
        if (end < 0) break;
        accept(chunk.subarray(at, end + 1));
        at = end + 1;
      }
      need(chunk.length - at <= LIMITS.recordBytes, "record-capacity");
      b.work(chunk.length - at);
      pending = Buffer.from(chunk.subarray(at));
    }
    need(footer && pending.length === 0 && ordinal === expected.records && packets === expected.packetCount && metadata === expected.metadataCount && top === expected.top && selected === expected.selected && total === expected.bytes && h.digest("hex") === expected.ledgerSHA256 && rh.digest("hex") === expected.recordManifestSHA256 && ph.digest("hex") === expected.packetManifestSHA256, "ledger-verification");
    need(equal(id(initial), id(fs.fstatSync(fd, { bigint: true }))) && equal(id(initial), id(fs.lstatSync(path, { bigint: true }))), "ledger-drift");
  } finally {
    fs.closeSync(fd);
    io.verificationClosed = true;
  }
}
function unavailable(reason, io = null, counters = null, failurePacketIndex = null) {
  return { policy: POLICY, status: "unavailable", reason, failurePacketIndex, seal: null, topLevelWire: "unavailable", selectedMetadataProjection: "unavailable", ...AUTH, io, counters };
}
function ownedChild(req, expires) {
  return new Promise((resolveChild) => {
    const child = spawn(process.execPath, [SELF, "--private-raw-metadata-worker-v1"], { shell: false, stdio: ["pipe", "pipe", "pipe"], env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" } });
    const parts = { stdout: [], stderr: [] }, sizes = { stdout: 0, stderr: 0 }, facts = { exit: null, close: null, stdoutEOF: false, stdoutClosed: false, stderrEOF: false, stderrClosed: false, stdinClosed: false, unclosedOriginalOperation: false }, caps = { stdout: 262144, stderr: 65536 };
    let failure = null, done = false, grace;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(grace);
      let text = "";
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts.stdout));
      } catch {
        failure ??= "child-stdout-utf8";
      }
      // Freeze the observation cutoff, including nested exit/close facts. Late
      // original events may update private tracking after an unclosed grace
      // expiry, but cannot rewrite the already delivered unavailable evidence.
      const cutoff = Object.freeze({
        ...facts,
        exit: facts.exit === null ? null : Object.freeze({ code: facts.exit.code, signal: facts.exit.signal }),
        close: facts.close === null ? null : Object.freeze({ code: facts.close.code, signal: facts.close.signal })
      });
      resolveChild({ failure, facts: cutoff, text });
    };
    const maybeFinish = () => {
      if (facts.close && facts.stdoutClosed && facts.stderrClosed && facts.stdinClosed) {
        if (!facts.stdoutEOF || !facts.stderrEOF) failure ??= "child-stream-unclosed";
        finish();
      }
    };
    const abort = (reason) => {
      failure ??= reason;
      try {
        child.kill("SIGKILL");
      } catch {
      }
      grace ??= setTimeout(() => {
        failure ??= "original-child-unclosed";
        facts.unclosedOriginalOperation = true;
        finish();
      }, LIMITS.cleanupMs);
    };
    const timer = setTimeout(() => abort("deadline"), Math.max(1, expires - performance.now()));
    child.on("error", () => abort("child-error"));
    child.on("exit", (code, signal) => {
      facts.exit = { code, signal };
    });
    child.on("close", (code, signal) => {
      facts.close = { code, signal };
      if (code !== 0 || signal !== null) failure ??= "child-exit";
      maybeFinish();
    });
    child.stdin.on("error", () => abort("child-stdin"));
    child.stdin.on("close", () => {
      facts.stdinClosed = true;
      maybeFinish();
    });
    for (const name of ["stdout", "stderr"]) {
      child[name].on("data", (chunk) => {
        if (chunk.length > caps[name] - sizes[name]) {
          abort(name + "-capacity");
          return;
        }
        sizes[name] += chunk.length;
        parts[name].push(chunk);
      });
      child[name].on("end", () => {
        facts[name + "EOF"] = true;
      });
      child[name].on("close", () => {
        facts[name + "Closed"] = true;
        maybeFinish();
      });
      child[name].on("error", () => abort(name + "-error"));
    }
    let bytes;
    try {
      bytes = protocolEncode(req, 16384);
    } catch {
      abort("request-capacity");
      child.stdin.destroy();
      return;
    }
    if (bytes.length > 16384) {
      abort("request-capacity");
      child.stdin.destroy();
    } else child.stdin.end(bytes);
  });
}
// Supervisor final checks use asynchronous original descriptors; the only parsing
// pass over ledger bytes belongs to the private synchronous worker above.
async function finalFacts(worker, b, deadline) {
  need(await fs.promises.realpath(worker.out) === worker.out && equal(id(await fs.promises.lstat(worker.out, { bigint: true })).slice(0, 3), worker.outIdentity), "output-drift");
  let total = 0;
  for (const fact of worker.sources) {
    deadline();
    const p = canonical(fact.path);
    need(await fs.promises.realpath(p) === p, "source-drift");
    const s = await fs.promises.lstat(p, { bigint: true });
    need(s.isFile() && s.nlink === 1n && equal(id(s), fact.identity) && s.size === BigInt(fact.bytes), "source-drift");
    const f = await fs.promises.open(p, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      deadline();
      need(equal(id(await f.stat({ bigint: true })), fact.identity), "source-drift");
      const h = createHash("sha256");
      b.work(65536);
      const buf = Buffer.alloc(65536);
      let bytes = 0;
      for (let reads = 0; ; ) {
        deadline();
        need(reads++ < 66, "source-read-capacity");
        b.work(65536);
        const { bytesRead: n } = await f.read(buf, 0, 65536, null);
        if (!n) break;
        bytes += n;
        total += n;
        need(total <= LIMITS.sourceBytes && bytes <= fact.bytes, "source-capacity");
        b.work(n);
        h.update(buf.subarray(0, n));
      }
      need(bytes === fact.bytes && h.digest("hex") === fact.sha256 && equal(id(await f.stat({ bigint: true })), fact.identity) && equal(id(await fs.promises.lstat(p, { bigint: true })), fact.identity), "source-drift");
    } finally {
      await f.close();
    }
  }
  need(await fs.promises.realpath(worker.trace.path) === worker.trace.path && equal(id(await fs.promises.lstat(worker.trace.path, { bigint: true })), worker.traceIdentity), "input-drift");
  const ledger = join(worker.out, "ledger.pending");
  need(await fs.promises.realpath(ledger) === ledger && equal(id(await fs.promises.lstat(ledger, { bigint: true })), worker.ledger.identity), "ledger-drift");
}
function validateWorker(worker, req, b) {
  closed(worker, ["status", "trace", "out", "outIdentity", "sources", "sourceManifestSHA256", "ledger", "packetManifestSHA256", "recordManifestSHA256", "counters", "io", "traceIdentity"]);
  need(worker.status === "worker-complete" && equal(worker.trace, req.trace) && worker.out === req.out, "worker-result");
  closed(worker.trace, ["path", "bytes", "sha256"]);
  closed(worker.ledger, ["bytes", "sha256", "records", "identity"]);
  closed(worker.io, ["inputEOF", "inputClosed", "inputHashMatch", "inputIdentityMatch", "ledgerClosed", "verificationEOF", "verificationClosed"]);
  need(Object.values(worker.io).every((v) => v === true), "worker-io");
  need([worker.sourceManifestSHA256, worker.ledger.sha256, worker.packetManifestSHA256, worker.recordManifestSHA256].every((v) => typeof v === "string" && SHA.test(v)), "worker-digests");
  const identity = (value) => Array.isArray(value) && value.length === 7 && value.every((v) => typeof v === "string" && /^-?[0-9]{1,30}$/.test(v));
  need(identity(worker.traceIdentity) && identity(worker.ledger.identity) && Array.isArray(worker.outIdentity) && worker.outIdentity.length === 3 && worker.outIdentity.every((v) => typeof v === "string" && /^[0-9]{1,30}$/.test(v)), "worker-identity");
  closed(worker.counters, Object.keys(b.used));
  for (const [key, value] of Object.entries(worker.counters)) {
    need(Number.isSafeInteger(value) && value >= 0, "worker-counters");
    b.used[key] = value;
  }
  const caps = { closureReservedWork: LIMITS.summaryBytes * 16, work: LIMITS.work, members: LIMITS.members, packets: LIMITS.packets, metadata: LIMITS.metadata, records: LIMITS.records, ledgerBytes: LIMITS.ledgerBytes, writes: LIMITS.writes, inputReads: LIMITS.inputReads, verificationReads: LIMITS.verificationReads, maxPacketBytes: LIMITS.packetBytes, maxFragmentBytes: LIMITS.packetBytes, maxRecordBytes: LIMITS.recordBytes };
  for (const [key, cap] of Object.entries(caps)) need(b.used[key] <= cap, "worker-counters");
  need(b.used.topFields + b.used.selectedFields <= LIMITS.fields && b.used.ledgerBytes === worker.ledger.bytes && b.used.records === worker.ledger.records, "worker-counters");
  const roster = roles();
  need(Array.isArray(worker.sources) && worker.sources.length === roster.length, "source-roster");
  let total = 0;
  worker.sources.forEach((fact, index) => {
    closed(fact, ["role", "path", "bytes", "sha256", "identity"]);
    const expected = roster[index];
    need(fact.role === expected.role && fact.path === expected.path && Number.isSafeInteger(fact.bytes) && fact.bytes >= 0 && fact.bytes <= LIMITS.sourceBytes - total && typeof fact.sha256 === "string" && SHA.test(fact.sha256) && (!expected.pin || fact.sha256 === expected.pin) && identity(fact.identity), "source-roster");
    total += fact.bytes;
  });
  need(sourceManifest(worker.sources, b) === worker.sourceManifestSHA256, "source-manifest");
}
/** Fixed phase-1 diagnostic only. Local hashes assume trusted fresh execution. */
async function writeRawMetadataLedgerV1(value) {
  const started = performance.now(), expires = started + LIMITS.deadlineMs;
  let expired = false;
  const originalTimer = setTimeout(() => {
    expired = true;
  }, LIMITS.deadlineMs);
  let req, child = null, worker = null, sealIdentity = null, sealRenamed = false;
  const publicationFacts = { ledger: null, seal: null };
  const deadline = () => need(!expired && performance.now() < expires, "deadline");
  try {
    req = request(value);
    child = await ownedChild(req, expires);
    need(!child.failure, child.failure ?? "child-failure");
    deadline();
    need(child.facts.exit?.code === 0 && child.facts.exit.signal === null && child.facts.close?.code === 0 && child.facts.close.signal === null, "child-closure");
    worker = protocolParse(child.text, 262144);
    if (worker.status === "unavailable") {
      closed(worker, ["status", "reason", "packetIndex", "io", "counters"]);
      need(typeof worker.reason === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(worker.reason), "worker-failure-shape");
      need(worker.packetIndex === null || Number.isInteger(worker.packetIndex) && worker.packetIndex >= 0 && worker.packetIndex <= LIMITS.packets, "worker-failure-shape");
      if (worker.io !== null) {
        closed(worker.io, ["inputEOF", "inputClosed", "inputHashMatch", "inputIdentityMatch", "ledgerClosed", "verificationEOF", "verificationClosed"]);
        need(Object.values(worker.io).every((v) => typeof v === "boolean"), "worker-failure-shape");
      }
      if (worker.counters !== null) {
        closed(worker.counters, Object.keys(budget().used));
        need(Object.values(worker.counters).every((v) => Number.isSafeInteger(v) && v >= 0), "worker-failure-shape");
      }
      return unavailable(worker.reason, worker.io, worker.counters, worker.packetIndex);
    }
    const b = budget();
    validateWorker(worker, req, b);
    await finalFacts(worker, b, deadline);
    deadline();
    // Prepay closure once, without renewing the cumulative 4Gi guard. The
    // separate local account prevents a seal from predicting its own scans.
    const reservedWork = LIMITS.summaryBytes * 16;
    b.work(reservedWork);
    b.used.closureReservedWork = reservedWork;
    let closureUsed = 0;
    const closure = { work(n) {
      need(Number.isSafeInteger(n) && n >= 0 && n <= reservedWork - closureUsed, "closure-work-capacity");
      closureUsed += n;
    } };
    const finalOp = (operation) => {
      deadline();
      // A fixed fact-formatting allowance covers bounded stat identity strings.
      closure.work(512);
      return operation();
    };
    const closureEqual = (left, right) => {
      const leftBytes = jsonBytes(left, closure), rightBytes = jsonBytes(right, closure);
      closure.work(2 * (leftBytes + rightBytes));
      return equal(left, right);
    };
    const ownedOut = async () => {
      closure.work(Buffer.byteLength(req.out) * 2);
      const physicalPath = await finalOp(() => fs.promises.realpath(req.out));
      const stat = await finalOp(() => fs.promises.lstat(req.out, { bigint: true }));
      need(physicalPath === req.out && stat.isDirectory() && closureEqual(id(stat).slice(0, 3), worker.outIdentity), "output-drift");
    };
    const authority = { ...AUTH, topLevelWire: "complete", selectedMetadataProjection: "complete" };
    const seal = {
      policy: POLICY,
      codec: 1,
      status: "complete-raw-metadata-ledger-diagnostic",
      ...authority,
      trace: req.trace,
      output: { path: req.out, identity: worker.outIdentity, identityFields: "dev/ino/mode" },
      ledger: { ...worker.ledger, path: "ledger.jsonl", identityStage: "original-pending-before-rename" },
      sourceManifestSHA256: worker.sourceManifestSHA256,
      sources: worker.sources,
      packetManifestSHA256: worker.packetManifestSHA256,
      recordManifestSHA256: worker.recordManifestSHA256,
      counters: { ...b.used },
      ceilings: LIMITS,
      io: worker.io,
      child: child.facts,
      resourceDefinitions: { fields: "one per exposed top-level or selected-child occurrence", members: "decoder invocation; nested-scope occurrence; clock child; each decoded property/item preflight and serialization visit", workScope: "ledgerSourceClosureLogicalWork; not total process CPU, allocation or all JSON", work: "conservative charged byte/step reservations before original ledger/source reads/copies/hashes/JSON scans/encoding/writes/verification and field/member loops; decoder scans reserved by body bytes; closure reservation is prepaid once and never refunded", transport: "separate one-message envelope: request 16384B, worker response 262144B, stderr 65536B; depth8/nodes4096; at most8 times payload cap in simultaneous payload/text/parsed-string copies per process plus bounded nodes and at most payload-cap stream fragments; protocol preflight/encode/decode/parse scans excluded from logical-work counter", finalClosure: "16*262144 prepaid work: JSON preflight steps, generated UTF8 bytes, allocation/copy bytes, requested write/read bytes, equality/hash bytes, and a 512-unit original-operation/stat-formatting allowance (one prepaid unit per close); unused credit never renews any guard", ledgerVerificationPasses: 1, relationIndexLookups: 0 },
      executionAssumption: "trusted fresh reviewed execution; local file bookends do not attest loaded memory or historical execution"
    };
    const size = jsonBytes(seal, closure);
    need(size <= LIMITS.summaryBytes, "seal-capacity");
    closure.work(size * 2);
    const bytes = Buffer.from(JSON.stringify(seal));
    need(bytes.length <= LIMITS.summaryBytes, "seal-capacity");
    const pending = join(req.out, "seal.pending"), ledgerPending = join(req.out, "ledger.pending"), ledgerFinal = join(req.out, "ledger.jsonl"), sealFinal = join(req.out, "seal.json");
    await ownedOut();
    closure.work(1);
    const f = await finalOp(() => fs.promises.open(pending, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 384));
    try {
      await finalOp(() => f.chmod(384));
      let offset = 0, writes = 0;
      while (offset < bytes.length) {
        need(writes < LIMITS.summaryBytes, "seal-write-capacity");
        closure.work(bytes.length - offset);
        const result2 = await finalOp(() => f.write(bytes, offset, bytes.length - offset, null));
        writes++;
        need(Number.isInteger(result2.bytesWritten) && result2.bytesWritten > 0 && result2.bytesWritten <= bytes.length - offset, "seal-write");
        offset += result2.bytesWritten;
      }
      await finalOp(() => f.sync());
      const sealStat = await finalOp(() => f.stat({ bigint: true }));
      need(sealStat.isFile() && sealStat.nlink === 1n && (sealStat.mode & 0o777n) === 0o600n && sealStat.size === BigInt(bytes.length), "seal-identity");
      sealIdentity = id(sealStat);
    } finally {
      await f.close();
    }
    await ownedOut();
    deadline();
    // ctime may change on rename. Verify the full original pending identities,
    // then retain the observed full postrename identities as new bookends.
    const beforeLedger = id(await finalOp(() => fs.promises.lstat(ledgerPending, { bigint: true })));
    need(closureEqual(beforeLedger, worker.ledger.identity), "ledger-drift");
    need(closureEqual(id(await finalOp(() => fs.promises.lstat(pending, { bigint: true }))), sealIdentity), "seal-drift");
    await finalOp(() => fs.promises.rename(ledgerPending, ledgerFinal));
    await ownedOut();
    const afterLedger = id(await finalOp(() => fs.promises.lstat(ledgerFinal, { bigint: true })));
    publicationFacts.ledger = { renameAcknowledged: true, before: beforeLedger, after: afterLedger };
    need(closureEqual(beforeLedger.slice(0, 6), afterLedger.slice(0, 6)), "ledger-rename-identity");
    need(closureEqual(id(await finalOp(() => fs.promises.lstat(ledgerFinal, { bigint: true }))), afterLedger), "ledger-postrename-drift");
    need(closureEqual(id(await finalOp(() => fs.promises.lstat(pending, { bigint: true }))), sealIdentity), "seal-drift");
    deadline();
    await finalOp(() => fs.promises.rename(pending, sealFinal));
    sealRenamed = true;
    await ownedOut();
    const afterSeal = id(await finalOp(() => fs.promises.lstat(sealFinal, { bigint: true })));
    publicationFacts.seal = { renameAcknowledged: true, before: sealIdentity, after: afterSeal };
    need(closureEqual(sealIdentity.slice(0, 6), afterSeal.slice(0, 6)), "seal-rename-identity");
    closure.work(bytes.length);
    const originalSeal = Buffer.alloc(bytes.length);
    closure.work(1);
    const sealReader = await finalOp(() => fs.promises.open(sealFinal, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK));
    try {
      need(closureEqual(id(await finalOp(() => sealReader.stat({ bigint: true }))), afterSeal), "seal-drift");
      let offset = 0, reads = 0;
      while (offset < originalSeal.length) {
        need(++reads <= 8, "seal-read-capacity");
        const want = Math.min(65536, originalSeal.length - offset);
        closure.work(want);
        const { bytesRead: n } = await finalOp(() => sealReader.read(originalSeal, offset, want, null));
        need(Number.isInteger(n) && n > 0 && n <= want, "seal-read");
        offset += n;
      }
      closure.work(2);
      const end = Buffer.alloc(1);
      need((await finalOp(() => sealReader.read(end, 0, 1, null))).bytesRead === 0, "seal-EOF");
      closure.work(bytes.length);
      need(closureEqual(id(await finalOp(() => sealReader.stat({ bigint: true }))), afterSeal) && originalSeal.equals(bytes), "seal-verification");
    } finally {
      await sealReader.close();
    }
    need(closureEqual(id(await finalOp(() => fs.promises.lstat(ledgerFinal, { bigint: true }))), afterLedger) && closureEqual(id(await finalOp(() => fs.promises.lstat(sealFinal, { bigint: true }))), afterSeal), "postrename-drift");
    await ownedOut();
    deadline();
    closure.work(bytes.length);
    const result = { policy: POLICY, status: "complete-raw-metadata-ledger-diagnostic", reason: null, ...authority, seal: { path: sealFinal, bytes: bytes.length, sha256: digest(bytes) }, ledger: { path: ledgerFinal, bytes: worker.ledger.bytes, sha256: worker.ledger.sha256, records: worker.ledger.records }, publicationFacts, counters: { ...b.used }, io: worker.io, finalClosure: { reservedWork, closureConsumedBeforeResultEncoding: reservedWork } };
    // A maximal seven-digit placeholder bounds this snapshot before any caller encoding.
    need(jsonBytes(result, closure) <= LIMITS.summaryBytes, "result-capacity");
    result.finalClosure = { reservedWork, closureConsumedBeforeResultEncoding: closureUsed };
    return result;
  } catch (error) {
    // Withdraw only this transaction's own renamed seal, never a prior result.
    // An orphan ledger remains explicitly nonadmitted without the final seal.
    if (sealRenamed && req && sealIdentity) try {
      const final = join(req.out, "seal.json"), current = id(await fs.promises.lstat(final, { bigint: true }));
      if (current[0] === sealIdentity[0] && current[1] === sealIdentity[1]) await fs.promises.rename(final, join(req.out, "seal.failed"));
    } catch {
    }
    return unavailable(error.code ?? "supervisor-unavailable", { ...worker?.io ?? child?.facts ?? {}, supervisorDeadlineExpired: expired || performance.now() >= expires }, worker?.counters ?? null);
  } finally {
    clearTimeout(originalTimer);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF && process.argv.length === 3 && process.argv[2] === "--private-raw-metadata-worker-v1") {
  let chunks = [], size = 0;
  process.stdin.on("data", (chunk) => {
    size += chunk.length;
    if (size > 16384) {
      process.exitCode = 1;
      process.stdin.destroy();
      return;
    }
    chunks.push(chunk);
  });
  process.stdin.on("end", async () => {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
      const req = request(protocolParse(text, 16384));
      chunks = null;
      const result = await workerRun(req);
      process.stdout.end(protocolEncode(result, 262144));
    } catch (error) {
      process.stdout.end(protocolEncode({ status: "unavailable", reason: error.code ?? "worker-unavailable", packetIndex: null, io: null, counters: null }, 262144));
    }
  });
}
export {
  writeRawMetadataLedgerV1
};
