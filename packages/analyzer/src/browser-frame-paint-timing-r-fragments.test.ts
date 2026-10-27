import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  decodePaintTimingRBody as decode,
  comparePaintTimingRInventory as compare,
  PAINT_TIMING_R_BODY_POLICY as policy,
  PAINT_TIMING_R_SOURCE_ABI_V1 as abi,
} from "./browser-frame-paint-timing-r-fragments.js";
const v = (n: number): number[] => {
  const a: number[] = [];
  do {
    a.push((n & 127) | (n >= 128 ? 128 : 0));
    n = Math.floor(n / 128);
  } while (n);
  return a;
};
const s = (f: number, n: number) => [...v(f * 8), ...v(n)];
const b = (f: number, a: number[]) => [...v(f * 8 + 2), ...v(a.length), ...a];
const utf = (x: string) => Array.from(new TextEncoder().encode(x));
const ann = (value: number[], iid = 7) => b(4, [...s(1, iid), ...value]);
const parts = (kind = "A", frame = "frame", u = 0) => [
  s(3, 1),
  s(3, 2),
  s(3, 3),
  s(10, 43),
  s(11, 0),
  ann(kind === "B" ? b(8, [255, 0, 123]) : b(6, utf(frame))),
  ann(
    kind === "A" ? b(11, [255, 0]) : kind === "B" ? b(6, utf(frame)) : s(3, u),
    18,
  ),
  b(6, [16, 82]),
];
const body = (kind = "A", frame = "frame", u = 0) =>
  new Uint8Array(parts(kind, frame, u).flat());
const inventory = (
  eventName = "firstPaint",
  annotationNames = ["frame", "data"],
  categories = ["loading", "rail", "devtools.timeline"],
) => JSON.stringify({ eventName, categories, annotationNames });
const hash = (a: Uint8Array) => createHash("sha256").update(a).digest("hex");
const pending = (bytes = body()) => {
  const r = decode(bytes, policy);
  expect(r.status).toBe("decoded_pending_paint_timing_r_body_fragment");
  if (r.status !== "decoded_pending_paint_timing_r_body_fragment")
    throw Error("pending");
  return r;
};
const refuse = (bytes: unknown, code?: string) => {
  const r = decode(bytes, policy);
  expect(r.status).toBe("unavailable");
  if (code) expect(r).toHaveProperty("code", code);
  expect(r).not.toHaveProperty("bodyBytes");
  expect(r.diagnostics).toHaveLength(1);
};
describe("private pending paint R body", () => {
  it.each(["A", "B", "C"])(
    "retains exact %s shape, windows, hash and local accounting",
    (kind) => {
      const bytes = body(kind);
      const r = pending(bytes);
      expect(r.bodyBytes).toEqual(bytes);
      expect(r.bodyBytes).not.toBe(bytes);
      expect(r.bodySHA256).toBe(hash(bytes));
      expect(r.consumedBytes).toBe(bytes.length);
      expect(r.categoryIids).toEqual(["1", "2", "3"]);
      expect(r.nameIid).toBe("43");
      expect(r.trackUuid).toBe("0");
      expect(r.frame).toBe("frame");
      expect(r.occurrences).toHaveLength(13);
      expect(r.usage).toEqual({
        fields: 13,
        members: 5,
        callbackWork: 2,
        decodedFrameUTF8: 5,
        opaqueValueBytes: kind === "A" ? 2 : kind === "B" ? 3 : 0,
      });
      expect(r.legacy.phase).toBe(82);
      expect(r.legacy.sha256).toBe(hash(new Uint8Array([16, 82])));
      for (const o of r.occurrences) {
        expect(o.start).toBeLessThan(o.end);
        expect(o.valueStart).toBeLessThanOrEqual(o.end);
        expect(o.end).toBeLessThanOrEqual(bytes.length);
      }
      expect(r.sourceFamily).toBe("not_resolved");
      expect(r.normalizationCapability).toBe("source-body-structure-only");
      for (const k of [
        "sequenceValidity",
        "internResolution",
        "clockAdmission",
        "targetBinding",
      ])
        expect(r).toHaveProperty(k, "not_evaluated");
      for (const k of [
        "nativeSupported",
        "qualification",
        "evaluation",
        "scoring",
        "ranking",
        "fpsEligibility",
      ])
        expect(r).toHaveProperty(k, false);
    },
  );
  it("retains independently computed exact body-relative occurrence and opaque windows", () => {
    const r = pending();
    expect(
      r.occurrences.map((o) => [
        o.fieldNumber,
        o.wireType,
        o.start,
        o.valueStart,
        o.end,
      ]),
    ).toEqual([
      [3, 0, 0, 1, 2],
      [3, 0, 2, 3, 4],
      [3, 0, 4, 5, 6],
      [10, 0, 6, 7, 8],
      [11, 0, 8, 9, 10],
      [4, 2, 10, 12, 21],
      [4, 2, 21, 23, 29],
      [6, 2, 29, 31, 33],
      [1, 0, 12, 13, 14],
      [6, 2, 14, 16, 21],
      [1, 0, 23, 24, 25],
      [11, 2, 25, 27, 29],
      [2, 0, 31, 32, 33],
    ]);
    expect(r.skippedOpaqueLocations).toEqual([
      {
        scope: "root",
        fieldNumber: 11,
        wireType: 2,
        start: 25,
        valueStart: 27,
        end: 29,
        bytes: 2,
        sha256: hash(new Uint8Array([255, 0])),
      },
    ]);
    expect(r.annotations.map((a) => [a.nameIid, a.valueField])).toEqual([
      ["7", 6],
      ["18", 11],
    ]);
  });
  it("preserves reordered category IID instances and full uint64 scalars", () => {
    const p = parts();
    [p[0], p[1]] = [p[1]!, p[0]!];
    expect(pending(new Uint8Array(p.flat())).categoryIids).toEqual([
      "2",
      "1",
      "3",
    ]);
    p[0] = [24, 255, 255, 255, 255, 255, 255, 255, 255, 255, 1];
    expect(pending(new Uint8Array(p.flat())).categoryIids[0]).toBe(
      "18446744073709551615",
    );
  });
  it.each([0, 1])("accepts emitted uint %i", (u) =>
    expect(pending(body("C", "frame", u)).annotations[1]?.uintValue).toBe(
      String(u),
    ),
  );
  it.each([
    "firstMeaningfulPaintCandidate",
    "firstContentfulPaint",
    "firstPaint",
    "firstMeaningfulPaint",
  ])("compares A %s without proof", (name) => {
    const r = compare(pending(), inventory(name));
    expect(r.status).toBe("matched_paint_timing_r_inventory");
    expect(r.sourceFamily).toBe("inspector-paint-timing");
    expect(r.orderedProof).toBe("not-established-by-this-function");
    expect(r.inputOrigin).toBe("not_authenticated");
    expect(r.inventoryProvenance).toBe("caller-supplied-not-source-owned");
    expect(r.fpsEligibility).toBe(false);
  });
  it("distinguishes B/C including overlapping FMP", () => {
    expect(
      compare(
        pending(body("B")),
        inventory("largestContentfulPaint::Candidate", ["data", "frame"]),
      ),
    ).toHaveProperty("sourceFamily", "lcp-candidate");
    expect(
      compare(
        pending(body("C")),
        inventory("firstMeaningfulPaint", ["frame", "afterUserInput"]),
      ),
    ).toHaveProperty("sourceFamily", "direct-first-meaningful-paint");
    expect(
      compare(
        pending(),
        inventory("firstMeaningfulPaint", ["frame", "afterUserInput"]),
      ),
    ).toHaveProperty("code", "paint-r-inventory-mismatch");
  });
  it("rejects all missing, duplicated and reordered required fields", () => {
    const p = parts();
    for (let i = 0; i < p.length; i++) {
      refuse(new Uint8Array(p.filter((_, j) => j !== i).flat()));
      refuse(new Uint8Array([...p.slice(0, i), p[i]!, ...p.slice(i)].flat()));
      if (i >= 2 && i + 1 < p.length) {
        const q = [...p];
        [q[i], q[i + 1]] = [q[i + 1]!, q[i]!];
        refuse(new Uint8Array(q.flat()));
      }
    }
  });
  it.each([1, 2, 8, 9, 16, 17, 20, 22, 23, 1052, 1075, 9999, 21075])(
    "rejects forbidden direct field %i",
    (f) =>
      refuse(new Uint8Array([...body(), ...s(f, 0)]), "paint-r-source-shape"),
  );
  it("rejects wrong categories, track, name, annotation oneofs and legacy encodings", () => {
    const p = parts();
    for (const [i, a] of [
      [0, s(3, 0)],
      [1, s(3, 1)],
      [3, s(10, 0)],
      [4, s(11, 1)],
      [5, ann(b(10, utf("frame")))],
      [5, b(4, [...s(1, 7), ...b(6, utf("frame")), ...s(3, 0)])],
      [5, b(4, [...b(6, utf("frame")), ...s(1, 7)])],
      [6, ann(s(2, 1))],
      [7, b(6, [16, 81])],
      [7, b(6, [16, 210, 0])],
      [7, b(6, [144, 0, 82])],
      [7, b(6, [16, 82, 16, 82])],
      [7, b(6, [18, 0])],
    ] as [number, number[]][]) {
      const q = [...p];
      q[i] = a;
      refuse(new Uint8Array(q.flat()));
    }
    refuse(body("C", "frame", 2), "paint-r-enum");
  });
  it("preserves UTF8 text and enforces original byte bounds", () => {
    for (const f of ["\uFEFFa\0é", "x".repeat(4096), "é".repeat(2048)])
      expect(pending(body("A", f)).frame).toBe(f);
    refuse(body("A", ""));
    const p = parts();
    p[5] = ann(b(6, [255]));
    refuse(new Uint8Array(p.flat()), "invalid-utf8");
  });
  it.each(["x".repeat(4097), "é".repeat(2049)])(
    "preserves literal string-capacity for oversized UTF8 bytes (case %#)",
    (frame) => refuse(body("A", frame), "string-capacity"),
  );
  it("retains malformed opaque payload windows without decoding", () => {
    for (const k of ["A", "B"]) {
      const r = pending(body(k));
      const o = r.skippedOpaqueLocations[0]!;
      expect(o.sha256).toBe(hash(r.bodyBytes.subarray(o.valueStart, o.end)));
      expect(o.bytes).toBe(o.end - o.valueStart);
    }
  });
  it("accepts the exact body byte cap with opaque bytes and rejects selected wrong wires", () => {
    const p = parts();
    const opaque = Array(262110).fill(255);
    p[6] = ann(b(11, opaque), 18);
    let bytes = new Uint8Array(p.flat());
    opaque.length += 262144 - bytes.length;
    p[6] = ann(b(11, opaque.fill(255)), 18);
    bytes = new Uint8Array(p.flat());
    expect(bytes.length).toBe(262144);
    expect(pending(bytes).usage.opaqueValueBytes).toBe(opaque.length);
    refuse(new Uint8Array([...bytes, 0]), "byte-capacity");
    for (const i of [0, 3, 4]) {
      const q = parts();
      q[i] = b(i === 0 ? 3 : i === 3 ? 10 : 11, []);
      refuse(new Uint8Array(q.flat()));
    }
    const q = parts();
    q[0] = [24, 255, 255, 255, 255, 255, 255, 255, 255, 255, 2];
    refuse(new Uint8Array(q.flat()), "uint64-varint-overflow");
  });
  it("retains literal wire errors and byte cap", () => {
    refuse(new Uint8Array([128]), "truncated-varint");
    refuse(new Uint8Array([0]), "invalid-field-number");
    refuse(new Uint8Array([15]), "unsupported-wire-type");
    refuse(new Uint8Array([26, 255, 127]), "out-of-bounds-length");
    refuse(new Uint8Array(262145), "byte-capacity");
  });
  it("denies storage, proxy and reflective hooks", () => {
    let calls = 0;
    const trap = () => {
      calls++;
      throw Error("hook");
    };
    const p = new Proxy(body(), {
      get: trap,
      getPrototypeOf: trap,
      ownKeys: trap,
    });
    for (const x of [
      p,
      new DataView(new ArrayBuffer(8)),
      Buffer.from(body()),
      new (class extends Uint8Array {})(body()),
      new Uint8Array(new SharedArrayBuffer(8)),
      {
        get length() {
          return trap();
        },
        [Symbol.iterator]: trap,
      },
    ])
      refuse(x);
    const d = body();
    structuredClone(d.buffer, { transfer: [d.buffer] });
    refuse(d);
    const a = body();
    Object.defineProperties(a, {
      length: { get: trap },
      buffer: { get: trap },
      [Symbol.iterator]: { value: trap },
    });
    pending(a);
    expect(calls).toBe(0);
    expect(decode(p, "wrong")).toHaveProperty("code", "paint-r-invalid-input");
  });
  it("requires exact primitive policy and freezes ABI recursively", () => {
    refuse(body("C", "frame", 99), "paint-r-enum");
    expect(decode(body(), new String(policy))).toHaveProperty(
      "code",
      "paint-r-invalid-input",
    );
    const check = (o: unknown) => {
      if (o && typeof o === "object") {
        expect(Object.isFrozen(o)).toBe(true);
        for (const x of Object.values(o)) check(x);
      }
    };
    check(abi);
  });
  it("uses private minted facts despite public mutation and rejects forged or proxied fragments without hooks", () => {
    const r = pending();
    r.bodyBytes.fill(0);
    Object.assign(r, {
      structuralVariant: "frame-uint",
      categoryIids: ["99"],
      annotations: [],
    });
    expect(compare(r, inventory())).toHaveProperty(
      "status",
      "matched_paint_timing_r_inventory",
    );
    let calls = 0;
    const p = new Proxy(r, {
      get() {
        calls++;
        throw Error("hook");
      },
    });
    for (const x of [{ ...r }, p, null, 1])
      expect(compare(x, inventory())).toHaveProperty(
        "code",
        "paint-r-inventory-unresolved",
      );
    expect(calls).toBe(0);
  });
  it("rejects inventory hooks without reflection or coercion", () => {
    let calls = 0;
    const trap = () => {
      calls++;
      throw Error("hook");
    };
    for (const x of [
      new String(inventory()),
      new Proxy({}, { get: trap, getPrototypeOf: trap, ownKeys: trap }),
      { toJSON: trap, toString: trap },
      [],
      null,
      () => 0,
    ])
      expect(compare(pending(), x)).toHaveProperty(
        "code",
        "paint-r-inventory-unresolved",
      );
    expect(calls).toBe(0);
  });
  it("bounds primitive text before parsing", () => {
    const spy = vi.spyOn(JSON, "parse");
    expect(compare(pending(), " ".repeat(4097))).toHaveProperty(
      "code",
      "paint-r-inventory-unresolved",
    );
    expect(spy).not.toHaveBeenCalled();
    const exactBoundary = inventory().padEnd(4096, " ");
    expect(exactBoundary.length).toBe(4096);
    expect(compare(pending(), exactBoundary)).toHaveProperty(
      "code",
      "paint-r-inventory-unresolved",
    );
    expect(spy).toHaveBeenCalledExactlyOnceWith(exactBoundary);
    spy.mockRestore();
  });
  it.each([
    [
      "category length65",
      inventory(
        "firstPaint",
        ["frame", "data"],
        ["x".repeat(65), "rail", "devtools.timeline"],
      ),
    ],
    ["argument length65", inventory("firstPaint", ["x".repeat(65), "data"])],
    [
      "categories2",
      inventory("firstPaint", ["frame", "data"], ["loading", "rail"]),
    ],
    [
      "categories4",
      inventory(
        "firstPaint",
        ["frame", "data"],
        ["loading", "rail", "devtools.timeline", "extra"],
      ),
    ],
    ["arguments1", inventory("firstPaint", ["frame"])],
    ["arguments3", inventory("firstPaint", ["frame", "data", "extra"])],
    ["malformed JSON", "{"],
    [
      "bounded deep JSON",
      '{"eventName":"firstPaint","categories":[' +
        "[".repeat(1000) +
        "0" +
        "]".repeat(1000) +
        ',"rail","devtools.timeline"],"annotationNames":["frame","data"]}',
    ],
  ])("rejects bounded invalid inventory %s", (_label, text) => {
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(compare(pending(), text)).toHaveProperty(
      "code",
      "paint-r-inventory-unresolved",
    );
  });
  it("rejects noncanonical and invalid closed inventories", () => {
    const good = inventory();
    const bad = [
      good + " ",
      " " + good,
      good.replace("firstPaint", "first\\u0050aint"),
      good.replace("{", '{"eventName":"firstPaint",'),
      JSON.stringify({
        categories: ["loading", "rail", "devtools.timeline"],
        eventName: "firstPaint",
        annotationNames: ["frame", "data"],
      }),
      JSON.stringify({ ...JSON.parse(good), extra: 1 }),
      "{}",
      "null",
      "[]",
      JSON.stringify({ eventName: "", categories: [], annotationNames: [] }),
      JSON.stringify({
        eventName: "x".repeat(129),
        categories: ["loading", "rail", "devtools.timeline"],
        annotationNames: ["frame", "data"],
      }),
      JSON.stringify({
        eventName: "firstPaint",
        categories: [{}, "rail", "devtools.timeline"],
        annotationNames: ["frame", "data"],
      }),
      JSON.stringify({
        eventName: "firstPaint",
        categories: ["loading", "rail", "devtools.timeline"],
        annotationNames: [["frame"], "data"],
      }),
    ];
    for (const text of bad)
      expect(compare(pending(), text)).toHaveProperty(
        "code",
        "paint-r-inventory-unresolved",
      );
    for (const text of [
      inventory("largestContentfulPaint::CandidateForSoftNavigation"),
      inventory("LargestImagePaint::Candidate"),
      inventory("firstpaint"),
      inventory("firstPaint", ["data", "frame"]),
      inventory(
        "firstPaint",
        ["frame", "data"],
        ["rail", "loading", "devtools.timeline"],
      ),
    ])
      expect(compare(pending(), text)).toHaveProperty(
        "code",
        "paint-r-inventory-mismatch",
      );
  });
});
