// Authored common-domain semantic matrix, ported from V1; no native inputs.
import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateBrowserFeedbackObservationsV1}from './feedback-observations-core.mjs';
import {evaluateBrowserFeedbackObservationsCompactV2}from './feedback-observations-compact-core-v2.mjs';
import {authoredGraph,argument,selector}from './feedback-observations-fixtures.mjs';
import {exportCompactGraphV2}from './feedback-observations-compact-fixtures-v2.mjs';
function run(g){const f=exportCompactGraphV2(g),old=evaluateBrowserFeedbackObservationsV1(f.legacy.targetBytes,f.legacy.scopeBytes,selector),result=evaluateBrowserFeedbackObservationsCompactV2(f.target.bytes,f.scope.bytes,selector);const normalize=r=>{const {schema,executionEvidence,inputOrigin,...v}=r;return v;};assert.deepEqual(normalize(result),normalize(old));return result;}
function boundary(r){assert.equal(r.fps,null);for(const k of ['nativeSupported','captureQualified','exhaustivePopulation','evaluationEligibility','scoringEligibility','rankingEligibility'])assert.equal(r[k],false);assert.equal(r.executionEvidence,'untrusted-supplied-compact-csv');assert.ok(Object.isFrozen(r));}
function refusal(r){boundary(r);assert.equal(r.status,'unavailable');assert.equal(r.count,null);assert.equal(r.interval,null);assert.equal(r.observedHz,null);assert.deepEqual(r.events,[]);}
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
