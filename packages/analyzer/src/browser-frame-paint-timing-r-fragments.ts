import { createHash } from "node:crypto";
import {
  BodyReader,
  copyBody,
  newWholeWireBudget,
  WireError,
  wholeByteInputDenied,
} from "./browser-frame-protobuf-wire.js";

/** Private source body policy. It establishes neither ordered state nor metric admission. */
export const PAINT_TIMING_R_BODY_POLICY =
  "pinned-paint-timing-r-source-body-fragments-v1";
const rules = [
  {
    family: "inspector-paint-timing",
    variant: "frame-dictionary",
    eventNames: [
      "firstMeaningfulPaintCandidate",
      "firstContentfulPaint",
      "firstPaint",
      "firstMeaningfulPaint",
    ],
    annotationNames: ["frame", "data"],
  },
  {
    family: "lcp-candidate",
    variant: "legacy-json-frame",
    eventNames: ["largestContentfulPaint::Candidate"],
    annotationNames: ["data", "frame"],
  },
  {
    family: "direct-first-meaningful-paint",
    variant: "frame-uint",
    eventNames: ["firstMeaningfulPaint"],
    annotationNames: ["frame", "afterUserInput"],
  },
];
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
// Raw decoded UTF-8 source-byte commitments, separate from the external local
// source/build compatibility record. Googlesource format=TEXT transport is base64;
// these hashes cover the decoded source bytes, not that transport encoding.
export const PAINT_TIMING_R_SOURCE_ABI_V1 = freezeDeep({
  policy: PAINT_TIMING_R_BODY_POLICY,
  chromiumRevision: "f842f52ef39fd97b449eb27cff414bf05a98ddce",
  perfettoRevision: "403906f4adfbf287a02e5546f8430dcc9d56b649",
  categories: ["loading", "rail", "devtools.timeline"],
  rules,
  sources: [
    {
      url: "https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/third_party/blink/renderer/core/inspector/inspector_trace_events.cc?format=TEXT",
      sha256:
        "01d1b788ad95ff4e47a05af0d336cc927e92fc95a0c6a109f193db923f1c1f1d",
    },
    {
      url: "https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/base/trace_event/trace_arguments.cc?format=TEXT",
      sha256:
        "466d4b9ffaff3c59632577c26508bc3a7097bf2d84638d241cd31e6094a0d140",
    },
    {
      url: "https://raw.githubusercontent.com/google/perfetto/403906f4adfbf287a02e5546f8430dcc9d56b649/include/perfetto/tracing/traced_value.h",
      sha256:
        "6c1e16a9580f3dc88a446832a87aeea1b73210ec9297e35120ae4648f1f89966",
    },
    {
      url: "https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/third_party/blink/renderer/core/paint/timing/first_meaningful_paint_detector.cc?format=TEXT",
      sha256:
        "13a3b1035627e471d0e3b936cb26b672d3163a9784ae92ecc9bc92b4eb017372",
    },
    {
      url: "https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/third_party/blink/renderer/core/paint/timing/paint_timing.cc?format=TEXT",
      sha256:
        "93feedef5eb7576e91273425f815eef5d9c1b92806e5b23b1381bbb7565af637",
    },
    {
      url: "https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/third_party/blink/renderer/core/paint/timing/largest_contentful_paint_calculator.cc?format=TEXT",
      sha256:
        "43eb43448e28b94b1d15229fdd909ee7179bf1f108be2c74e5fafc4713b91b9d",
    },
    {
      url: "https://raw.githubusercontent.com/google/perfetto/403906f4adfbf287a02e5546f8430dcc9d56b649/include/perfetto/tracing/track_event_legacy.h",
      sha256:
        "e2bf2cce79c1c5ea920f9d831327c015d0dc0f0254d413275f9deca0c8fb9d34",
    },
    {
      url: "https://raw.githubusercontent.com/google/perfetto/403906f4adfbf287a02e5546f8430dcc9d56b649/include/perfetto/tracing/internal/track_event_macros.h",
      sha256:
        "2ce6b72b60c0d7ce22c3c175cc00e3c192fcf2ed60c2d16ab0b2e36fa507085d",
    },
    {
      url: "https://raw.githubusercontent.com/google/perfetto/403906f4adfbf287a02e5546f8430dcc9d56b649/include/perfetto/tracing/internal/track_event_data_source.h",
      sha256:
        "e1c337174e70fc02d363ed57507624fdc453864295d17fccb2b593d224110b67",
    },
    {
      url: "https://raw.githubusercontent.com/google/perfetto/403906f4adfbf287a02e5546f8430dcc9d56b649/include/perfetto/tracing/internal/track_event_legacy.h",
      sha256:
        "8a9db288998e28e944efbf6fa2233fb685c29b65fc5a4eca62ea40cf8d8f29fe",
    },
    {
      url: "https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/third_party/blink/renderer/core/paint/timing/first_meaningful_paint_detector.h?format=TEXT",
      sha256:
        "da4b0d50dd9233a567111aa05d347a13c9554042c0e71cd76a4219f53b66c685",
    },
  ],
});
const denied = Object.freeze({
  nativeSupported: false,
  qualification: false,
  evaluation: false,
  scoring: false,
  ranking: false,
  fpsEligibility: false,
});
function unavailable(code: string) {
  return {
    status: "unavailable" as const,
    code,
    diagnostics: [{ code }],
    ...denied,
  };
}
type Span = {
  scope: "root" | "frame_sink";
  fieldNumber: number;
  wireType: 0 | 1 | 2 | 5;
  start: number;
  valueStart: number;
  end: number;
};
type Annotation = {
  nameIid: string;
  valueField: number;
  occurrences: Span[];
  uintValue?: string;
};
type Variant = "frame-dictionary" | "legacy-json-frame" | "frame-uint";
const facts = new WeakMap<object, Readonly<{ variant: Variant }>>();
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const shape = (): never => {
  throw new WireError("paint-r-source-shape");
};

/** Original TrackEvent body only. All byte windows are zero based and half open. */
export function decodePaintTimingRBody(input: unknown, policy: unknown) {
  // Native proxy detection precedes every possible byte-input reflection, including copyBody.
  if (wholeByteInputDenied(input) || policy !== PAINT_TIMING_R_BODY_POLICY)
    return unavailable("paint-r-invalid-input");
  try {
    const bodyBytes = copyBody(input),
      budget = newWholeWireBudget();
    const occurrences: Span[] = [],
      directOccurrences: Span[] = [],
      categoryIids: string[] = [],
      annotations: Annotation[] = [];
    let fields = 0,
      members = 0,
      callbackWork = 0;
    const next = (reader: BodyReader) => {
      const field = reader.next("root");
      fields++;
      occurrences.push(field.occurrence);
      return field;
    };
    const member = () => {
      budget.chargeMember();
      members++;
    };
    const root = new BodyReader(bodyBytes, 0, bodyBytes.length, budget);
    const expected = [
      [3, 0],
      [3, 0],
      [3, 0],
      [10, 0],
      [11, 0],
      [4, 2],
      [4, 2],
      [6, 2],
    ];
    const direct: ReturnType<BodyReader["next"]>[] = [];
    for (const [number, wire] of expected) {
      if (root.complete) shape();
      const field = next(root);
      direct.push(field);
      directOccurrences.push(field.occurrence);
      if (
        field.occurrence.fieldNumber !== number ||
        field.occurrence.wireType !== wire
      )
        shape();
    }
    if (!root.complete) shape();
    for (let i = 0; i < 3; i++) {
      const scalar = direct[i]!.scalar!;
      if (scalar === 0n || categoryIids.includes(scalar.toString())) shape();
      member();
      categoryIids.push(scalar.toString());
    }
    const nameIid = direct[3]!.scalar!;
    if (nameIid === 0n || direct[4]!.scalar !== 0n) shape();
    const values: ReturnType<BodyReader["next"]>[] = [];
    for (const envelope of direct.slice(5, 7)) {
      member();
      const o = envelope.occurrence,
        reader = new BodyReader(bodyBytes, o.valueStart, o.end, budget);
      if (reader.complete) shape();
      const name = next(reader);
      if (
        name.occurrence.fieldNumber !== 1 ||
        name.occurrence.wireType !== 0 ||
        name.scalar === 0n
      )
        shape();
      if (reader.complete) shape();
      const value = next(reader);
      if (!reader.complete) shape();
      annotations.push({
        nameIid: name.scalar!.toString(),
        valueField: value.occurrence.fieldNumber,
        occurrences: [name.occurrence, value.occurrence],
      });
      values.push(value);
    }
    const [a, b] = values as [
      ReturnType<BodyReader["next"]>,
      ReturnType<BodyReader["next"]>,
    ];
    const matches = (f: typeof a, n: number, w: number) =>
      f.occurrence.fieldNumber === n && f.occurrence.wireType === w;
    let structuralVariant: Variant,
      frameField: typeof a,
      opaque: typeof a | undefined;
    if (matches(a, 6, 2) && matches(b, 11, 2)) {
      structuralVariant = "frame-dictionary";
      frameField = a;
      opaque = b;
    } else if (matches(a, 8, 2) && matches(b, 6, 2)) {
      structuralVariant = "legacy-json-frame";
      frameField = b;
      opaque = a;
    } else if (matches(a, 6, 2) && matches(b, 3, 0)) {
      if (b.scalar !== 0n && b.scalar !== 1n)
        throw new WireError("paint-r-enum");
      structuralVariant = "frame-uint";
      frameField = a;
      annotations[1]!.uintValue = b.scalar.toString();
    } else return shape();
    callbackWork++;
    const f = frameField.occurrence,
      decodedFrameUTF8 = f.end - f.valueStart;
    if (decodedFrameUTF8 === 0) throw new WireError("paint-r-source-shape");
    if (decodedFrameUTF8 > 4096) throw new WireError("string-capacity");
    let frame: string;
    try {
      frame = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        bodyBytes.subarray(f.valueStart, f.end),
      );
    } catch {
      throw new WireError("invalid-utf8");
    }
    const skippedOpaqueLocations = opaque
      ? [
          {
            ...opaque.occurrence,
            bytes: opaque.occurrence.end - opaque.occurrence.valueStart,
            sha256: sha256(
              bodyBytes.subarray(
                opaque.occurrence.valueStart,
                opaque.occurrence.end,
              ),
            ),
          },
        ]
      : [];
    const l = direct[7]!.occurrence,
      legacyReader = new BodyReader(bodyBytes, l.valueStart, l.end, budget);
    if (legacyReader.complete) throw new WireError("paint-r-envelope");
    const phase = next(legacyReader);
    callbackWork++;
    if (
      !legacyReader.complete ||
      phase.occurrence.fieldNumber !== 2 ||
      phase.occurrence.wireType !== 0 ||
      phase.scalar !== 82n ||
      l.end - l.valueStart !== 2 ||
      bodyBytes[l.valueStart] !== 16 ||
      bodyBytes[l.valueStart + 1] !== 82
    )
      throw new WireError("paint-r-envelope");
    const result = {
      status: "decoded_pending_paint_timing_r_body_fragment" as const,
      policy: PAINT_TIMING_R_BODY_POLICY,
      bodyBytes,
      bodySHA256: sha256(bodyBytes),
      consumedBytes: bodyBytes.length,
      occurrences,
      directOccurrences,
      categoryIids,
      nameIid: nameIid.toString(),
      trackUuid: "0" as const,
      annotations,
      legacy: {
        ...l,
        phase: 82,
        phaseOccurrence: phase.occurrence,
        sha256: sha256(bodyBytes.subarray(l.valueStart, l.end)),
      },
      structuralVariant,
      frame,
      skippedOpaqueLocations,
      usage: {
        fields,
        members,
        callbackWork,
        decodedFrameUTF8,
        opaqueValueBytes: opaque
          ? opaque.occurrence.end - opaque.occurrence.valueStart
          : 0,
      },
      sourceFamily: "not_resolved" as const,
      normalizationCapability: "source-body-structure-only" as const,
      sequenceValidity: "not_evaluated" as const,
      internResolution: "not_evaluated" as const,
      clockAdmission: "not_evaluated" as const,
      targetBinding: "not_evaluated" as const,
      ...denied,
    };
    facts.set(result, Object.freeze({ variant: structuralVariant }));
    return result;
  } catch (error) {
    return unavailable(
      error instanceof WireError ? error.code : "paint-r-invalid-input",
    );
  }
}

/** Pure, unproven comparison. Caller supplied strings never resolve interned source IIDs. */
export function comparePaintTimingRInventory(
  fragment: unknown,
  inventoryJSON: unknown,
) {
  const owned =
    fragment !== null &&
    (typeof fragment === "object" || typeof fragment === "function")
      ? facts.get(fragment)
      : undefined;
  if (
    !owned ||
    typeof inventoryJSON !== "string" ||
    inventoryJSON.length > 4096
  )
    return unavailable("paint-r-inventory-unresolved");
  let eventName: string, categories: string[], annotationNames: string[];
  try {
    const parsed: unknown = JSON.parse(inventoryJSON);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      return unavailable("paint-r-inventory-unresolved");
    const record = parsed as Record<string, unknown>;
    if (
      Object.keys(record).join(",") !== "eventName,categories,annotationNames"
    )
      return unavailable("paint-r-inventory-unresolved");
    const text = (x: unknown, max: number): x is string =>
      typeof x === "string" && x.length > 0 && x.length <= max;
    const list = (x: unknown, n: number): x is string[] =>
      Array.isArray(x) && x.length === n && x.every((y) => text(y, 64));
    if (
      !text(record.eventName, 128) ||
      !list(record.categories, 3) ||
      !list(record.annotationNames, 2)
    )
      return unavailable("paint-r-inventory-unresolved");
    eventName = record.eventName;
    categories = record.categories;
    annotationNames = record.annotationNames;
    if (
      JSON.stringify({ eventName, categories, annotationNames }) !==
      inventoryJSON
    )
      return unavailable("paint-r-inventory-unresolved");
  } catch {
    return unavailable("paint-r-inventory-unresolved");
  }
  const rule = PAINT_TIMING_R_SOURCE_ABI_V1.rules.find(
    (r) =>
      r.variant === owned.variant &&
      r.eventNames.includes(eventName) &&
      r.annotationNames.every((x, i) => x === annotationNames[i]),
  );
  if (
    !rule ||
    !PAINT_TIMING_R_SOURCE_ABI_V1.categories.every(
      (x, i) => x === categories[i],
    )
  )
    return unavailable("paint-r-inventory-mismatch");
  return {
    status: "matched_paint_timing_r_inventory" as const,
    sourceFamily: rule.family,
    inventoryProvenance: "caller-supplied-not-source-owned" as const,
    orderedProof: "not-established-by-this-function" as const,
    inputOrigin: "not_authenticated" as const,
    ...denied,
  };
}
