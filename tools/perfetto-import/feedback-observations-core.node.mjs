import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBrowserFeedbackObservationsV1 as evaluate } from "./feedback-observations-core.mjs";
import {
  authoredGraph,
  authoredZeroFeedbackProtoFixture,
  exportGraph,
  selector,
  argument,
  csv,
  targetHeaders,
  scopeHeaders,
} from "./feedback-observations-fixtures.mjs";
const run = (g) => {
  const f = exportGraph(g);
  return evaluate(f.targetBytes, f.scopeBytes, selector);
};
function boundary(r) {
  assert.equal(r.fps, null);
  for (const k of [
    "nativeSupported",
    "captureQualified",
    "exhaustivePopulation",
    "evaluationEligibility",
    "scoringEligibility",
    "rankingEligibility",
  ])
    assert.equal(r[k], false, k);
  assert.equal(r.executionEvidence, "untrusted-supplied-csv");
  assert.ok(Object.isFrozen(r));
}
function refusal(r) {
  boundary(r);
  assert.equal(r.status, "unavailable");
  assert.equal(r.count, null);
  assert.equal(r.interval, null);
  assert.equal(r.observedHz, null);
  assert.deepEqual(r.events, []);
}
test("authored full graph certifies terminal carry-in, sibling submission, origin mismatch and extra surfaces", () => {
  const r = run(authoredGraph());
  boundary(r);
  assert.equal(r.status, "observed", JSON.stringify(r));
  assert.equal(r.count, "1");
  assert.deepEqual(r.observedHz, {
    numerator: "10000000",
    denominator: "3",
    unit: "s^-1",
    exact: true,
  });
  assert.equal(r.events[0].terminalTs, "300");
});
test("deduplicates display and retains partial/forked reporters", () => {
  const g = authoredGraph(),
    n = structuredClone(g.nodes.at(-1));
  n.id = "20";
  n.argSet = "20";
  n.args.find((a) => a.key === "frame_reporter.state").s =
    "STATE_PRESENTED_PARTIAL";
  g.nodes.push(n);
  const r = run(g);
  assert.equal(r.count, "1");
  assert.equal(r.events[0].reporters.length, 2);
});
test("different valid analysis timing inventories are independent", () =>
  assert.equal(run(authoredGraph()).status, "observed"));
for (const [name, mutate] of [
  [
    "missing tree",
    (g) =>
      (g.nodes.at(-1).args = g.nodes
        .at(-1)
        .args.filter((a) => !a.key.endsWith("layer_tree_host_id"))),
  ],
  [
    "wrong typed tree",
    (g) =>
      (g.nodes
        .at(-1)
        .args.find((a) => a.key.endsWith("layer_tree_host_id")).type = "int"),
  ],
  ["unclosed positive", (g) => (g.nodes.at(-1).dur = "-1")],
  [
    "wrong loader",
    (g) =>
      (g.nodes.find((n) => n.name === "authored:start").args[0].s = "other"),
  ],
  [
    "wrong imported process lifetime",
    (g) => (g.nodes.find((n) => n.name === "DrawFrame").upid = "9"),
  ],
  [
    "missing submit",
    (g) =>
      (g.nodes = g.nodes.filter(
        (n) => !n.args.some((a) => a.s === "STEP_SUBMIT_COMPOSITOR_FRAME"),
      )),
  ],
  [
    "duplicate aggregate member",
    (g) =>
      (g.nodes
        .find((n) => n.args.some((a) => a.s === "STEP_SURFACE_AGGREGATION"))
        .args.at(-1).i = "51"),
  ],
  [
    "gapped aggregate array",
    (g) =>
      (g.nodes
        .find((n) => n.args.some((a) => a.s === "STEP_SURFACE_AGGREGATION"))
        .args.at(-1).key =
        "chrome_graphics_pipeline.aggregated_surface_frame_trace_ids[3]"),
  ],
  [
    "conflicting terminal",
    (g) => {
      const n = structuredClone(g.nodes.at(-1));
      n.id = "20";
      n.argSet = "20";
      n.dur = "211";
      g.nodes.push(n);
    },
  ],
  [
    "ambiguous required sentinel",
    (g) =>
      (g.nodes.at(-1).args.find((a) => a.key.endsWith("display_trace_id")).i =
        "-1"),
  ],
  [
    "timestamp corruption",
    (g) => {
      g.stats = [
        ["clock_sync_mixed_clock_sources", "0", "error", "trace", "1"],
      ];
      g.scopeStats = structuredClone(g.stats);
    },
  ],
  ["endpoint overflow", (g) => (g.nodes.at(-1).dur = "9223372036854775807")],
])
  test(name + " refuses atomically", () => {
    const g = authoredGraph();
    mutate(g);
    refusal(run(g));
  });
for (const id of ["0", "-2", "-9223372036854775808"])
  test("signed trace identity " + id + " is preserved", () => {
    const g = authoredGraph();
    for (const n of g.nodes)
      for (const a of n.args) if (a.key.endsWith("display_trace_id")) a.i = id;
    g.derived = [["51", id]];
    assert.equal(run(g).count, "1");
  });
for (const terminal of [100, 400, 450])
  test("half-open terminal " + terminal, () => {
    const g = authoredGraph();
    g.nodes.at(-1).dur = String(terminal - 90);
    assert.equal(run(g).count, terminal === 100 ? "1" : "0");
  });
test("outside interval valid positive needs no submission proof", () => {
  const g = authoredGraph();
  g.nodes.at(-1).dur = "400";
  g.nodes = g.nodes.filter(
    (n) => !n.args.some((a) => a.s === "STEP_SUBMIT_COMPOSITOR_FRAME"),
  );
  assert.equal(run(g).count, "0");
});
test("different well-typed tree is coverage only", () => {
  const g = authoredGraph();
  g.nodes.at(-1).args.find((a) => a.key.endsWith("layer_tree_host_id")).i = "8";
  assert.equal(run(g).count, "0");
});
for (const name of [
  "clock_sync_cache_miss",
  "track_event_parser_errors",
  "unknown_future_error",
])
  test(name + " retained as warning", () => {
    const g = authoredGraph();
    g.stats = [[name, "0", "error", "trace", "1"]];
    g.scopeStats = structuredClone(g.stats);
    assert.equal(run(g).count, "1");
  });
test("primitive canonical selector boundary excludes getters and unknown authority", () => {
  const f = exportGraph();
  let reads = 0;
  refusal(
    evaluate(f.targetBytes, f.scopeBytes, {
      get target() {
        reads++;
        throw Error();
      },
    }),
  );
  assert.equal(reads, 0);
  for (const s of [
    " " + selector,
    selector.replace('"target":', '"trusted":true,"target":'),
    JSON.stringify({
      phaseNames: JSON.parse(selector).phaseNames,
      target: JSON.parse(selector).target,
    }),
  ])
    refusal(evaluate(f.targetBytes, f.scopeBytes, s));
});
for (const [name, mutate] of [
  ["census", (f) => (f.targetTables[0][0][1] = "99")],
  ["dimension census", (f) => (f.targetTables[3][0][4] = "99")],
  ["dictionary id", (f) => (f.scopeTables[3][0][0] = "9")],
  ["nullable flag", (f) => (f.targetTables[1][0][13] = "1")],
  [
    "cross-export",
    (f) =>
      (f.scopeTables[1].find((r) => r[6] === "Graphics.Pipeline")[2] = "61"),
  ],
  [
    "duplicate selected argument",
    (f) => f.targetTables[2].push(f.targetTables[2].at(-1)),
  ],
  ["table ordering", (f) => f.scopeTables[1].reverse()],
])
  test("full artifact " + name, () => {
    const f = exportGraph();
    mutate(f);
    refusal(
      evaluate(
        csv(f.targetTables, targetHeaders),
        csv(f.scopeTables, scopeHeaders),
        selector,
      ),
    );
  });
test("CSV rejects truncated, trailing garbage and invalid UTF8", () => {
  const f = exportGraph();
  for (const b of [
    f.targetBytes.subarray(0, -2),
    Buffer.concat([f.targetBytes, Buffer.from("garbage\n")]),
    Buffer.concat([f.targetBytes, Buffer.from([0xff])]),
  ])
    refusal(evaluate(b, f.scopeBytes, selector));
});
test("quoted multiline strings and literal NULL survive all tables", () => {
  const g = authoredGraph();
  g.nodes
    .at(-1)
    .args.push(
      argument("authored.note", "string", "[NULL]"),
      argument("authored.multiline", "string", 'a,"b"\nc'),
    );
  assert.equal(run(g).count, "1");
});
test("matched NULL value type and unmatched slices reconcile independently", () => {
  const g = authoredGraph();
  g.nodes.at(-1).args.push({
    flat: null,
    key: null,
    type: "null",
    i: null,
    s: null,
    r: null,
  });
  assert.equal(run(g).count, "1");
});
test("required phase contexts use UTF8 names including astral Unicode", () => {
  const g = authoredGraph();
  const f = exportGraph(g);
  const s = JSON.parse(selector);
  s.target.frameId = "AUTHORED_😀";
  s.target.loaderId = "LOADER_😀";
  for (const n of g.nodes)
    for (const a of n.args) {
      if (a.s === "AUTHORED_FRAME") a.s = s.target.frameId;
      if (a.s === "AUTHORED_LOADER") a.s = s.target.loaderId;
    }
  const b = exportGraph(g);
  assert.equal(
    evaluate(b.targetBytes, b.scopeBytes, JSON.stringify(s)).count,
    "1",
  );
});
test("late invalid selected positive withdraws every earlier event", () => {
  const g = authoredGraph();
  const bad = structuredClone(g.nodes.at(-1));
  bad.id = "30";
  bad.argSet = "30";
  bad.args.find((a) => a.key.endsWith("display_trace_id")).i = "62";
  g.nodes.push(bad);
  refusal(run(g));
});
test("known fatal stats remain as bounded diagnostics on refusal", () => {
  const g = authoredGraph();
  g.stats = [["track_event_thread_invalid_end", "0", "error", "trace", "1"]];
  g.scopeStats = structuredClone(g.stats);
  const r = run(g);
  refusal(r);
  assert.equal(
    r.diagnostics.stats.target[0].name,
    "track_event_thread_invalid_end",
  );
});
test("duplicate optional classification is ambiguous", () => {
  const g = authoredGraph();
  g.nodes
    .at(-1)
    .args.push(argument("frame_reporter.frame_type", "string", "NORMAL"));
  refusal(run(g));
});
test("typed foreign positive does not require a target membership lifecycle", () => {
  const g = authoredGraph();
  const n = structuredClone(g.nodes.at(-1));
  n.id = "30";
  n.argSet = "30";
  n.pid = "999";
  n.upid = "999";
  n.dur = "-1";
  g.nodes.push(n);
  assert.equal(run(g).count, "1");
});
test("unrelated target draw lifecycle is not a universal graph gate", () => {
  const g = authoredGraph();
  const gen = structuredClone(
    g.nodes.find((n) =>
      n.args.some((a) => a.s === "STEP_GENERATE_COMPOSITOR_FRAME"),
    ),
  );
  gen.id = "31";
  gen.argSet = "31";
  gen.args.find((a) => a.key.endsWith("surface_frame_trace_id")).i = "888";
  g.nodes.push(gen);
  const draw = structuredClone(g.nodes.find((n) => n.name === "DrawFrame"));
  draw.id = "32";
  draw.argSet = "32";
  draw.parent = "31";
  draw.dur = "1";
  g.nodes.push(draw);
  assert.equal(run(g).count, "1");
});
for (const identity of ["0", "-2", "-9223372036854775808"])
  test("signed surface identity " + identity, () => {
    const g = authoredGraph();
    for (const n of g.nodes)
      for (const a of n.args)
        if (
          (a.key.endsWith("surface_frame_trace_id") ||
            a.key.endsWith("aggregated_surface_frame_trace_ids[0]")) &&
          a.i === "51"
        )
          a.i = identity;
    g.derived = [[identity, "61"]];
    assert.equal(run(g).count, "1");
  });
for (const [name, mutate] of [
  [
    "surface minus one",
    (g) => {
      for (const n of g.nodes)
        for (const a of n.args) if (a.i === "51") a.i = "-1";
      g.derived = [["-1", "61"]];
    },
  ],
  [
    "missing optional display on positive",
    (g) =>
      (g.nodes.at(-1).args = g.nodes
        .at(-1)
        .args.filter((a) => !a.key.endsWith("display_trace_id"))),
  ],
  [
    "duplicate same tree field",
    (g) =>
      g.nodes
        .find((n) => n.name === "SetLayerTreeId")
        .args.push(argument("debug.data.layerTreeId", "int", 7)),
  ],
  [
    "conflicting indexed process disclosure",
    (g) => {
      g.nodes[0].args.push(
        argument("debug.data.frames[1].frame", "string", "AUTHORED_FRAME"),
        argument("debug.data.frames[1].processId", "int", 999),
      );
    },
  ],
  [
    "cross-index mixing",
    (g) => (g.nodes[0].args[1].key = "debug.data.frames[1].processId"),
  ],
  [
    "trace stats differ",
    (g) => {
      g.stats = [["authored_stat", "0", "error", "trace", "1"]];
      g.scopeStats = [["authored_stat", "0", "error", "trace", "2"]];
    },
  ],
  [
    "fatal analysis stat scope only",
    (g) =>
      g.scopeStats.push([
        "track_event_thread_invalid_end",
        "0",
        "error",
        "analysis",
        "1",
      ]),
  ],
  [
    "uint32 tree overflow",
    (g) =>
      (g.nodes.find((n) => n.name === "SetLayerTreeId").args[1].i =
        "2147483648"),
  ],
  [
    "wrong receive sink channel",
    (g) =>
      (g.nodes
        .find((n) =>
          n.args.some((a) => a.s === "STEP_RECEIVE_COMPOSITOR_FRAME"),
        )
        .args.at(-1).type = "int"),
  ],
])
  test(name + " refuses", () => {
    const g = authoredGraph();
    mutate(g);
    refusal(run(g));
  });
test("same-index primary and outermost flags are retained without rejecting a selected subframe", () => {
  const g = authoredGraph();
  g.nodes[0].args.push(
    argument("debug.data.frames[0].isOutermostMainFrame", "bool", 0),
    argument("debug.data.frames[0].isPrimaryMainFrame", "bool", 0),
  );
  const r = run(g);
  assert.equal(r.count, "1");
  assert.ok(
    r.coverage.frameReferences[0].fields.some(
      (a) => a.key.endsWith("isPrimaryMainFrame") && a.value === "0",
    ),
  );
});
test("nonpositive incomplete reporter remains coverage, without inventing displays", () => {
  const g = authoredGraph();
  g.nodes.at(-1).args.find((a) => a.key === "frame_reporter.state").s =
    "STATE_DROPPED";
  g.nodes.at(-1).dur = "-1";
  const r = run(g);
  assert.equal(r.count, "0");
  assert.equal(r.coverage.successfulDisplays.unclosedNonpositive, 1);
});
test("all empty-population and large-input refusals retain closure", () => {
  const g = authoredGraph();
  g.nodes = g.nodes.filter((n) => n.name !== "PipelineReporter");
  assert.equal(run(g).count, "0");
  const f = exportGraph();
  refusal(evaluate(Buffer.alloc(262145), f.scopeBytes, selector));
  refusal(evaluate(new SharedArrayBuffer(10), f.scopeBytes, selector));
});
test("common context-only slice columns agree across exports without requiring ancestor arguments", () => {
  const g = authoredGraph();
  g.nodes = g.nodes.filter((n) => n.name !== "PipelineReporter");
  const main = g.nodes.find((n) => n.name === "MainFrame.Draw");
  main.parent = g.nodes.find((n) => n.name === "SetLayerTreeId").id;
  const f = exportGraph(g);
  const row = f.scopeTables[1].find((r) => r[6] === "SetLayerTreeId");
  row[15] = "disagrees";
  refusal(evaluate(f.targetBytes, csv(f.scopeTables, scopeHeaders), selector));
});
test("both exports must contain each selected literal phase exactly once", () => {
  const g = authoredGraph();
  const f = exportGraph(g);
  const node = g.nodes.find((n) => n.name === "authored:start");
  f.targetTables[1] = f.targetTables[1].filter((r) => r[0] !== node.id);
  f.targetTables[2] = f.targetTables[2].filter((r) => r[0] !== node.id);
  f.targetTables[3] = f.targetTables[3].filter(
    (r) => r[0] !== "authored:start",
  );
  refusal(evaluate(csv(f.targetTables, targetHeaders), f.scopeBytes, selector));
});
test("byte boundary never invokes forged or overridden view getters", () => {
  const f = exportGraph();
  let reads = 0;
  const forged = Object.create(Uint8Array.prototype);
  Object.defineProperty(forged, "buffer", {
    get() {
      reads++;
      throw Error();
    },
  });
  refusal(evaluate(forged, f.scopeBytes, selector));
  assert.equal(reads, 0);
  const view = new Uint8Array(f.targetBytes);
  for (const key of ["buffer", "byteLength", "byteOffset", "length"])
    Object.defineProperty(view, key, {
      get() {
        reads++;
        throw Error();
      },
    });
  assert.equal(evaluate(view, f.scopeBytes, selector).count, "1");
  assert.equal(reads, 0);
});

test("official blank result separators work with LF and CRLF", () => {
  const f = exportGraph();
  for (const newline of ["\n", "\r\n"]) {
    const separated = (tables, headers) =>
      Buffer.concat(
        tables.flatMap((table, index) => [
          csv([table], [headers[index]]),
          Buffer.from("\n"),
        ]),
      )
        .toString()
        .replaceAll("\n", newline);
    assert.equal(
      evaluate(
        Buffer.from(separated(f.targetTables, targetHeaders)),
        Buffer.from(separated(f.scopeTables, scopeHeaders)),
        selector,
      ).count,
      "1",
    );
  }
});
test("complete final records are accepted at EOF with or without a newline", () => {
  const f = exportGraph();
  for (const newline of ["\n", "\r\n"]) {
    const target = Buffer.from(
      f.targetBytes.toString().replaceAll("\n", newline),
    );
    const scope = Buffer.from(
      f.scopeBytes.toString().replaceAll("\n", newline),
    );
    assert.equal(
      evaluate(
        target.subarray(0, -newline.length),
        scope.subarray(0, -newline.length),
        selector,
      ).count,
      "1",
    );
  }
});
test("raw UTF8 BOM is refused before decoder stripping", () => {
  const f = exportGraph(),
    bom = Buffer.from([0xef, 0xbb, 0xbf]);
  refusal(
    evaluate(Buffer.concat([bom, f.targetBytes]), f.scopeBytes, selector),
  );
  refusal(
    evaluate(f.targetBytes, Buffer.concat([bom, f.scopeBytes]), selector),
  );
});
test("empty physical separators never hide quoted empty cells or partial records", () => {
  const f = exportGraph();
  assert.equal(
    evaluate(
      Buffer.concat([f.targetBytes, Buffer.from("\n\n")]),
      f.scopeBytes,
      selector,
    ).count,
    "1",
  );
  for (const tail of ['""\n', ",\n", " \n", '"', '"unterminated\n'])
    refusal(
      evaluate(
        Buffer.concat([f.targetBytes, Buffer.from(tail)]),
        f.scopeBytes,
        selector,
      ),
    );
});
test("official separators preserve embedded quoted LF and CRLF field content", () => {
  const g = authoredGraph();
  g.nodes
    .at(-1)
    .args.push(
      argument(
        "authored.multiline",
        "string",
        'before\n\n"middle"\r\n\r\nafter',
      ),
      argument("authored.empty", "string", ""),
    );
  assert.equal(run(g).count, "1");
});
test("compact tables and complete unquoted EOF records remain valid", () => {
  const f = exportGraph();
  const compact = (tables, headers) =>
    Buffer.concat(tables.map((table, i) => csv([table], [headers[i]])));
  assert.equal(
    evaluate(
      compact(f.targetTables, targetHeaders),
      compact(f.scopeTables, scopeHeaders),
      selector,
    ).count,
    "1",
  );
  const unquotedEOF = (bytes, row) =>
    Buffer.from(
      bytes
        .toString()
        .trimEnd()
        .replace(/[^\n]*$/, row),
    );
  assert.equal(
    evaluate(
      unquotedEOF(f.targetBytes, "51,61"),
      unquotedEOF(f.scopeBytes, "0,1000"),
      selector,
    ).count,
    "1",
  );
});
test("ignored physical separators still consume the fixed raw-record allowance", () => {
  const f = exportGraph();
  const r = evaluate(
    Buffer.concat([f.targetBytes, Buffer.alloc(24577, 10)]),
    f.scopeBytes,
    selector,
  );
  refusal(r);
  assert.equal(r.reason, "csv-rows");
});

test("mandatory phase populations agree across exports even with disjoint IDs", () => {
  const f = exportGraph();
  const ids = new Set();
  for (const r of f.scopeTables[1])
    if (["authored:start", "authored:end"].includes(r[6])) {
      ids.add(r[0]);
      r[0] = String(BigInt(r[0]) + 1000n);
      r[1] = String(BigInt(r[1]) + 10n);
      r[10] = String(BigInt(r[10]) + 1000n);
    }
  for (const r of f.scopeTables[2])
    if (ids.has(r[0])) {
      r[0] = String(BigInt(r[0]) + 1000n);
      r[2] = String(BigInt(r[2]) + 1000n);
    }
  const order = (a, b) =>
    BigInt(a[1]) < BigInt(b[1])
      ? -1
      : BigInt(a[1]) > BigInt(b[1])
        ? 1
        : Number(BigInt(a[0]) - BigInt(b[0]));
  f.scopeTables[1].sort(order);
  const nodeById = new Map(f.scopeTables[1].map((row) => [row[0], row]));
  f.scopeTables[2].sort((a, b) =>
    order(nodeById.get(a[0]), nodeById.get(b[0])),
  );
  const result = evaluate(
    f.targetBytes,
    csv(f.scopeTables, scopeHeaders),
    selector,
  );
  refusal(result);
  assert.equal(result.reason, "cross-export-slice");
});
for (const kind of ["receive", "aggregate"])
  for (const variant of [
    "duplicate",
    "uint",
    "string",
    "wrong-flat-key",
    "duplicate-step",
  ])
    test(
      "matching " + kind + " " + variant + " cannot disappear from proof",
      () => {
        const g = authoredGraph(),
          step =
            kind === "receive"
              ? "STEP_RECEIVE_COMPOSITOR_FRAME"
              : "STEP_SURFACE_AGGREGATION";
        const node = structuredClone(
          g.nodes.find((n) => n.args.some((a) => a.s === step)),
        );
        node.id = "999";
        node.argSet = "999";
        const key =
          "chrome_graphics_pipeline." +
          (kind === "receive" ? "surface_frame_trace_id" : "display_trace_id");
        const a = node.args.find((a) => a.key === key);
        if (variant === "duplicate") node.args.push(structuredClone(a));
        if (variant === "uint") a.type = "uint";
        if (variant === "string") {
          a.type = "string";
          a.s = a.i;
          a.i = null;
        }
        if (variant === "wrong-flat-key") a.flat += "wrong";
        if (variant === "duplicate-step")
          node.args.push(
            argument("chrome_graphics_pipeline.step", "string", step),
          );
        if (kind === "receive")
          node.args.find((a) =>
            a.key.endsWith("frame_sink_id.frame_sink_id"),
          ).i = "999";
        g.nodes.push(node);
        refusal(run(g));
      },
    );
for (const kind of ["receive", "aggregate"])
  test(
    "unrelated malformed " + kind + " identity remains coverage only",
    () => {
      const g = authoredGraph(),
        step =
          kind === "receive"
            ? "STEP_RECEIVE_COMPOSITOR_FRAME"
            : "STEP_SURFACE_AGGREGATION";
      const node = structuredClone(
        g.nodes.find((n) => n.args.some((a) => a.s === step)),
      );
      node.id = "999";
      node.argSet = "999";
      const a = node.args.find(
        (a) =>
          a.key ===
          "chrome_graphics_pipeline." +
            (kind === "receive"
              ? "surface_frame_trace_id"
              : "display_trace_id"),
      );
      a.i = "999";
      node.args.push(structuredClone(a));
      g.nodes.push(node);
      assert.equal(run(g).count, "1");
    },
  );

for (const variant of [
  "duplicate-step",
  "context",
  "process",
  "json-step",
  "wrong-flat-step",
])
  test(
    "raw submission under selected generate cannot be hidden by " + variant,
    () => {
      const g = authoredGraph();
      const n = structuredClone(
        g.nodes.find((n) =>
          n.args.some((a) => a.s === "STEP_SUBMIT_COMPOSITOR_FRAME"),
        ),
      );
      n.id = "999";
      n.argSet = "999";
      n.args.find((a) => a.key.endsWith("surface_frame_trace_id")).i = "999";
      if (variant === "duplicate-step")
        n.args.push(
          argument(
            "chrome_graphics_pipeline.step",
            "string",
            "STEP_SUBMIT_COMPOSITOR_FRAME",
          ),
        );
      if (variant === "context") {
        n.utid = "999";
        n.tid = "999";
      }
      if (variant === "process") {
        n.upid = "999";
        n.pid = "999";
      }
      if (variant === "json-step")
        n.args.find((a) => a.key.endsWith(".step")).type = "json";
      if (variant === "wrong-flat-step")
        n.args.find((a) => a.key.endsWith(".step")).flat += "wrong";
      g.nodes.push(n);
      refusal(run(g));
    },
  );
for (const variant of [
  "string-tree",
  "uint-tree",
  "wrong-process",
  "wrong-thread",
  "different-tree",
  "missing-tree",
  "duplicate-tree",
  "wrong-flat-tree",
])
  test(
    "raw draw under selected generate cannot be hidden by " + variant,
    () => {
      const g = authoredGraph();
      const n = structuredClone(g.nodes.find((n) => n.name === "DrawFrame"));
      n.id = "999";
      n.argSet = "999";
      const a = n.args.find((a) => a.key === "debug.layerTreeId");
      if (variant === "string-tree") {
        a.type = "string";
        a.s = a.i;
        a.i = null;
      }
      if (variant === "uint-tree") a.type = "uint";
      if (variant === "wrong-process") {
        n.upid = "999";
        n.pid = "999";
      }
      if (variant === "wrong-thread") {
        n.utid = "999";
        n.tid = "999";
      }
      if (variant === "different-tree") a.i = "8";
      if (variant === "missing-tree")
        n.args = n.args.filter((a) => a.key !== "debug.layerTreeId");
      if (variant === "duplicate-tree") n.args.push(structuredClone(a));
      if (variant === "wrong-flat-tree") a.flat += "wrong";
      g.nodes.push(n);
      refusal(run(g));
    },
  );
for (const variant of ["duplicate-step", "json-step"])
  test("raw selected generate cannot be hidden by " + variant, () => {
    const g = authoredGraph();
    const gen = structuredClone(
      g.nodes.find((n) =>
        n.args.some((a) => a.s === "STEP_GENERATE_COMPOSITOR_FRAME"),
      ),
    );
    gen.id = "999";
    gen.argSet = "999";
    if (variant === "duplicate-step")
      gen.args.push(
        argument(
          "chrome_graphics_pipeline.step",
          "string",
          "STEP_GENERATE_COMPOSITOR_FRAME",
        ),
      );
    else gen.args.find((a) => a.key.endsWith(".step")).type = "json";
    g.nodes.push(gen);
    const draw = structuredClone(g.nodes.find((n) => n.name === "DrawFrame"));
    draw.id = "1000";
    draw.argSet = "1000";
    draw.parent = "999";
    g.nodes.push(draw);
    refusal(run(g));
  });
test("contradictory generate step cannot hide a raw submission from its parent generate", () => {
  const g = authoredGraph();
  const n = structuredClone(
    g.nodes.find((n) =>
      n.args.some((a) => a.s === "STEP_SUBMIT_COMPOSITOR_FRAME"),
    ),
  );
  n.id = "999";
  n.argSet = "999";
  n.args.find((a) => a.key.endsWith("surface_frame_trace_id")).i = "999";
  n.args.push(
    argument(
      "chrome_graphics_pipeline.step",
      "string",
      "STEP_GENERATE_COMPOSITOR_FRAME",
    ),
  );
  g.nodes.push(n);
  refusal(run(g));
});
test("malformed foreign generate and draw lifecycles remain coverage only", () => {
  const g = authoredGraph();
  const gen = structuredClone(
    g.nodes.find((n) =>
      n.args.some((a) => a.s === "STEP_GENERATE_COMPOSITOR_FRAME"),
    ),
  );
  gen.id = "999";
  gen.argSet = "999";
  gen.parent = null;
  gen.depth = "0";
  gen.upid = "999";
  gen.pid = "999";
  gen.args.push(
    argument(
      "chrome_graphics_pipeline.step",
      "string",
      "STEP_GENERATE_COMPOSITOR_FRAME",
    ),
  );
  g.nodes.push(gen);
  const draw = structuredClone(g.nodes.find((n) => n.name === "DrawFrame"));
  draw.id = "1000";
  draw.argSet = "1000";
  draw.parent = "999";
  draw.depth = "1";
  draw.upid = "999";
  draw.pid = "999";
  draw.args.find((a) => a.key === "debug.layerTreeId").type = "uint";
  g.nodes.push(draw);
  assert.equal(run(g).count, "1");
});
test("malformed nearer generate cannot hide a conflicting submission from a selected ancestor", () => {
  const g = authoredGraph();
  const intermediate = structuredClone(
    g.nodes.find((n) =>
      n.args.some((a) => a.s === "STEP_GENERATE_COMPOSITOR_FRAME"),
    ),
  );
  intermediate.id = "998";
  intermediate.argSet = "998";
  intermediate.parent = g.nodes.find((n) =>
    n.args.some((a) => a.s === "STEP_GENERATE_COMPOSITOR_FRAME"),
  ).id;
  intermediate.depth = "2";
  intermediate.ts = "118";
  intermediate.dur = "20";
  intermediate.args.find((a) => a.key.endsWith("surface_frame_trace_id")).i =
    "999";
  intermediate.args.push(
    argument(
      "chrome_graphics_pipeline.step",
      "string",
      "STEP_GENERATE_COMPOSITOR_FRAME",
    ),
  );
  g.nodes.push(intermediate);
  const sub = structuredClone(
    g.nodes.find((n) =>
      n.args.some((a) => a.s === "STEP_SUBMIT_COMPOSITOR_FRAME"),
    ),
  );
  sub.id = "999";
  sub.argSet = "999";
  sub.parent = "998";
  sub.depth = "3";
  sub.args.find((a) => a.key.endsWith("surface_frame_trace_id")).i = "999";
  g.nodes.push(sub);
  refusal(run(g));
});

for (const source of ["analysis", "trace"])
  test("non-indexed " + source + " statistic preserves SQL NULL index", () => {
    const g = authoredGraph();
    g.stats = [["authored_nonindexed", null, "info", source, "5"]];
    g.scopeStats = [
      [
        "authored_nonindexed",
        null,
        "info",
        source,
        source === "trace" ? "5" : "8",
      ],
    ];
    const r = run(g);
    assert.equal(r.count, "1");
    assert.equal(r.diagnostics.stats.target[0].idx, null);
    assert.equal(r.diagnostics.stats.scope[0].idx, null);
  });
test("stat NULL index is ordered before zero and remains distinct across exports", () => {
  const g = authoredGraph();
  g.stats = [
    ["authored_index", null, "info", "trace", "1"],
    ["authored_index", "0", "info", "trace", "2"],
  ];
  g.scopeStats = structuredClone(g.stats);
  assert.equal(run(g).count, "1");
  g.scopeStats[0][1] = "0";
  refusal(run(g));
});
for (const idx of ["", "00", "1.0", "NaN", "9223372036854775808"])
  test("malformed statistic index " + JSON.stringify(idx) + " refuses", () => {
    const g = authoredGraph();
    g.stats = [["authored_index", idx, "info", "analysis", "1"]];
    g.scopeStats = structuredClone(g.stats);
    refusal(run(g));
  });

test("authored zero-feedback protobuf declares a nanosecond primary clock and typed target marks", () => {
  const bytes = authoredZeroFeedbackProtoFixture();
  assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length < 8192);
  function fields(bytes) {
    let offset = 0;
    const out = new Map();
    function vi() {
      let value = 0n,
        shift = 0n;
      while (offset < bytes.length) {
        const byte = bytes[offset++];
        value |= BigInt(byte & 127) << shift;
        if (!(byte & 128)) return value;
        shift += 7n;
        assert.ok(shift < 70n);
      }
      assert.fail("truncated varint");
    }
    while (offset < bytes.length) {
      const tag = vi(),
        field = Number(tag >> 3n),
        wire = Number(tag & 7n);
      let value;
      if (wire === 0) value = vi();
      else {
        assert.equal(wire, 2);
        const length = Number(vi());
        value = bytes.subarray(offset, offset + length);
        offset += length;
        assert.ok(offset <= bytes.length);
      }
      const all = out.get(field) ?? [];
      all.push(value);
      out.set(field, all);
    }
    return out;
  }
  const first = (map, field) => {
    assert.equal(map.get(field)?.length, 1);
    return map.get(field)[0];
  };
  const str = (map, field) => first(map, field).toString();
  const packets = fields(bytes).get(1).map(fields);
  assert.equal(packets.length, 8);
  for (const p of packets) assert.equal(first(p, 10), 1n);
  const snapshot = fields(
    first(
      packets.find((p) => p.has(6)),
      6,
    ),
  );
  assert.equal(first(snapshot, 2), 6n);
  const clock = fields(first(snapshot, 1));
  assert.equal(first(clock, 1), 6n);
  assert.equal(first(clock, 4), 1n);
  const descriptors = packets
    .filter((p) => p.has(60))
    .map((p) => fields(first(p, 60)));
  assert.equal(descriptors.length, 2);
  const proc = fields(
    first(
      descriptors.find((d) => d.has(3)),
      3,
    ),
  );
  assert.equal(first(proc, 1), 100n);
  const threadDescriptor = descriptors.find((d) => d.has(4));
  assert.equal(first(threadDescriptor, 1), 310n);
  const thread = fields(first(threadDescriptor, 4));
  assert.equal(first(thread, 1), 100n);
  assert.equal(first(thread, 2), 101n);
  assert.equal(str(thread, 5), "CrRendererMain");
  const events = packets.filter((p) => p.has(11));
  assert.deepEqual(
    events.map((p) => first(p, 8)),
    [1001n, 1002n, 1100n, 1400n, 1500n],
  );
  for (const p of events) {
    assert.equal(first(p, 58), 6n);
    const e = fields(first(p, 11));
    assert.equal(first(e, 9), 3n);
    assert.equal(first(e, 11), 310n);
  }
  function annotations(parts) {
    const map = new Map();
    for (const part of parts ?? []) {
      const a = fields(part),
        name = str(a, 10);
      if (a.has(11)) map.set(name, annotations(a.get(11)));
      else if (a.has(12))
        map.set(
          name,
          a.get(12).map((item) => annotations([item]).get("")),
        );
      else if (a.has(6)) map.set(name, { type: "string", value: str(a, 6) });
      else map.set(name, { type: "int", value: first(a, 4) });
    }
    return map;
  }
  const byName = new Map(
    events.map((p) => {
      const e = fields(first(p, 11));
      return [str(e, 23), e];
    }),
  );
  assert.deepEqual(
    [...byName.keys()],
    [
      "TracingStartedInBrowser",
      "SetLayerTreeId",
      "authored:start",
      "authored:end",
      "authored:noop-tail",
    ],
  );
  const frame = annotations(byName.get("TracingStartedInBrowser").get(4))
    .get("data")
    .get("frames")[0];
  assert.deepEqual(frame.get("frame"), {
    type: "string",
    value: "AUTHORED_FRAME",
  });
  assert.deepEqual(frame.get("processId"), { type: "int", value: 100n });
  const tree = annotations(byName.get("SetLayerTreeId").get(4)).get("data");
  assert.deepEqual(tree.get("frame"), {
    type: "string",
    value: "AUTHORED_FRAME",
  });
  assert.deepEqual(tree.get("layerTreeId"), { type: "int", value: 7n });
  for (const name of ["authored:start", "authored:end"]) {
    const e = byName.get(name);
    assert.equal(str(e, 22), "blink.user_timing");
    assert.deepEqual(annotations(e.get(4)).get("data").get("navigationId"), {
      type: "string",
      value: "AUTHORED_LOADER",
    });
  }
});

test("successful process-track reporter permits NULL thread context and retains it", () => {
  const g = authoredGraph();
  Object.assign(g.nodes.at(-1), {
    track: "9",
    trackName: "PipelineReporter",
    utid: null,
    tid: null,
    thread: null,
  });
  const r = run(g);
  assert.equal(r.count, "1");
  assert.equal(r.events[0].reporters[0].utid, null);
  assert.equal(r.events[0].reporters[0].tid, null);
  assert.equal(r.events[0].reporters[0].threadName, null);
  assert.equal(r.events[0].reporters[0].trackId, "9");
});
for (const [upid, pid] of [
  ["1", null],
  ["1", "999"],
  [null, "100"],
  [null, null],
  ["999", null],
])
  test(
    "successful ambiguous reporter process " +
      JSON.stringify([upid, pid]) +
      " refuses zero manufacture",
    () => {
      const g = authoredGraph();
      Object.assign(g.nodes.at(-1), {
        upid,
        pid,
        utid: null,
        tid: null,
        thread: null,
      });
      refusal(run(g));
    },
  );
for (const pid of ["100", "999"])
  test(
    "complete foreign reporter lifetime PID " + pid + " remains coverage",
    () => {
      const g = authoredGraph();
      Object.assign(g.nodes.at(-1), {
        upid: "999",
        pid,
        utid: null,
        tid: null,
        thread: null,
        dur: "-1",
      });
      const r = run(g);
      assert.equal(r.count, "0");
      assert.equal(r.coverage.successfulDisplays.foreign, 1);
    },
  );
test("threaded successful reporter remains supported", () => {
  const g = authoredGraph();
  Object.assign(g.nodes.at(-1), {
    track: "1",
    trackName: "CrRendererMain",
    utid: "1",
    tid: "10",
    thread: "CrRendererMain",
  });
  assert.equal(run(g).count, "1");
});
