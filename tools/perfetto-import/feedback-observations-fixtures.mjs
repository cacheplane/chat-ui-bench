// Authored logical events only. No captured trace records or execution authority.
export const targetFamilies = [
  "SetLayerTreeId",
  "TracingStartedInBrowser",
  "FrameCommittedInBrowser",
  "FrameDeletedInBrowser",
  "ProcessReadyInBrowser",
  "BeginFrame",
  "PipelineReporter",
  "Graphics.Pipeline",
].sort();
export const scopeFamilies = [
  "MainFrame.Draw",
  "Scheduler::BeginFrame",
  "Scheduler::BeginImplFrame",
  "DrawFrame",
  "Graphics.Pipeline",
].sort();
export const targetHeaders = [
  "name,event_count,arg_set_count",
  "id,ts,dur,name,track_id,track_name,arg_set_id,utid,tid,upid,pid,process_name,thread_name,track_name_is_null,process_name_is_null,thread_name_is_null",
  "slice_id,name,arg_set_id,arg_present,flat_key,key,value_type,int_value,string_value,real_value,flat_key_is_null,key_is_null,value_type_is_null,int_value_is_null,string_value_is_null,real_value_is_null",
  "name,flat_key,key,value_type,arg_occurrence_count,slice_count,flat_key_is_null,key_is_null,value_type_is_null",
  "name,idx,severity,source,value",
  "start_ts,end_ts",
  "surface_frame_trace_id,display_trace_id",
].map((x) => x.split(","));
export const scopeHeaders = [
  targetHeaders[0],
  "id,ts,dur,depth,parent_id,is_selected,name,category,track_id,track_name,arg_set_id,utid,tid,upid,pid,process_name,thread_name,parent_status,duration_status,parent_id_is_null,name_is_null,category_is_null,track_name_is_null,process_name_is_null,thread_name_is_null".split(
    ",",
  ),
  "slice_id,arg_key_id,arg_set_id,arg_present,int_value,string_value,real_value,int_value_is_null,string_value_is_null,real_value_is_null".split(
    ",",
  ),
  "arg_key_id,name,flat_key,key,value_type,arg_occurrence_count,slice_count,flat_key_is_null,key_is_null,value_type_is_null".split(
    ",",
  ),
  "name,idx,severity,source,value,name_is_null,severity_is_null,source_is_null".split(
    ",",
  ),
  targetHeaders[5],
];
export const selector = JSON.stringify({
  target: { frameId: "AUTHORED_FRAME", loaderId: "AUTHORED_LOADER" },
  phaseNames: { start: "authored:start", end: "authored:end" },
});
export function argument(key, type, value, flat = key.replace(/\[\d+\]/g, "")) {
  return {
    flat,
    key,
    type,
    i: ["int", "uint", "bool", "pointer"].includes(type) ? String(value) : null,
    s: type === "string" ? value : null,
    r: type === "real" ? String(value) : null,
  };
}
export function authoredGraph() {
  let id = 0;
  const nodes = [];
  const add = (name, ts, dur, args = [], extra = {}) => {
    const n = {
      id: String(++id),
      ts: String(ts),
      dur: String(dur),
      name,
      track: "1",
      trackName: "CrRendererMain",
      argSet: String(id),
      utid: "1",
      tid: "10",
      upid: "1",
      pid: "100",
      process: "Renderer",
      thread: "CrRendererMain",
      category: "benchmark",
      parent: null,
      depth: "0",
      args,
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  const a = argument;
  add("TracingStartedInBrowser", 1, 0, [
    a("debug.data.frames[0].frame", "string", "AUTHORED_FRAME"),
    a("debug.data.frames[0].processId", "int", 100),
  ]);
  add("SetLayerTreeId", 2, 0, [
    a("debug.data.frame", "string", "AUTHORED_FRAME"),
    a("debug.data.layerTreeId", "int", 7),
  ]);
  add(
    "authored:start",
    100,
    0,
    [a("debug.data.navigationId", "string", "AUTHORED_LOADER")],
    { category: "blink.user_timing" },
  );
  add(
    "authored:end",
    400,
    0,
    [a("debug.data.navigationId", "string", "AUTHORED_LOADER")],
    { category: "blink.user_timing" },
  );
  const compositor = {
    track: "2",
    trackName: "Compositor",
    utid: "2",
    tid: "11",
    thread: "Compositor",
  };
  const main = add("MainFrame.Draw", 110, 80, [], compositor);
  const gen = add(
    "Graphics.Pipeline",
    115,
    60,
    [
      a(
        "chrome_graphics_pipeline.step",
        "string",
        "STEP_GENERATE_COMPOSITOR_FRAME",
      ),
      a("chrome_graphics_pipeline.surface_frame_trace_id", "int", 51),
    ],
    { ...compositor, parent: main.id, depth: "1" },
  );
  add(
    "Graphics.Pipeline",
    120,
    10,
    [
      a(
        "chrome_graphics_pipeline.step",
        "string",
        "STEP_SUBMIT_COMPOSITOR_FRAME",
      ),
      a("chrome_graphics_pipeline.surface_frame_trace_id", "int", 51),
    ],
    { ...compositor, parent: gen.id, depth: "2" },
  );
  add(
    "DrawFrame",
    140,
    0,
    [a("debug.layerTreeId", "int", 7), a("debug.frameSeqId", "uint", 99)],
    { ...compositor, parent: gen.id, depth: "2" },
  );
  const viz = {
    track: "3",
    trackName: "Viz",
    utid: "3",
    tid: "20",
    upid: "2",
    pid: "200",
    process: "Viz service",
    thread: "Viz",
  };
  add(
    "Graphics.Pipeline",
    180,
    5,
    [
      a(
        "chrome_graphics_pipeline.step",
        "string",
        "STEP_RECEIVE_COMPOSITOR_FRAME",
      ),
      a("chrome_graphics_pipeline.surface_frame_trace_id", "int", 51),
      a(
        "chrome_graphics_pipeline.frame_sink_id.frame_sink_client_id",
        "uint",
        3,
      ),
      a("chrome_graphics_pipeline.frame_sink_id.frame_sink_id", "uint", 4),
    ],
    viz,
  );
  add(
    "Graphics.Pipeline",
    190,
    20,
    [
      a("chrome_graphics_pipeline.step", "string", "STEP_SURFACE_AGGREGATION"),
      a("chrome_graphics_pipeline.display_trace_id", "int", 61),
      a(
        "chrome_graphics_pipeline.aggregated_surface_frame_trace_ids[0]",
        "int",
        51,
      ),
      a(
        "chrome_graphics_pipeline.aggregated_surface_frame_trace_ids[1]",
        "int",
        52,
      ),
    ],
    viz,
  );
  add(
    "PipelineReporter",
    90,
    210,
    [
      a("frame_reporter.state", "string", "STATE_PRESENTED_ALL"),
      a("frame_reporter.layer_tree_host_id", "uint", 7),
      a("frame_reporter.display_trace_id", "int", 61),
      a("frame_reporter.surface_frame_trace_id", "int", 999),
      a("frame_reporter.frame_source", "uint", 1),
      a("frame_reporter.frame_sequence", "uint", 2),
      a("frame_reporter.frame_type", "string", "FORKED"),
    ],
    {
      track: "9",
      trackName: "PipelineReporter",
      utid: null,
      tid: null,
      thread: null,
    },
  );
  return {
    nodes,
    stats: [["parse_trace_duration_ns", null, "info", "analysis", "5"]],
    scopeStats: [["parse_trace_duration_ns", null, "info", "analysis", "8"]],
    bounds: ["0", "1000"],
    derived: [["51", "61"]],
  };
}
const cmp = (a, b) =>
  a === b
    ? 0
    : a === null
      ? -1
      : b === null
        ? 1
        : Buffer.compare(Buffer.from(String(a)), Buffer.from(String(b)));
function tuple(a, b) {
  for (let i = 0; i < a.length; i++) {
    const c = cmp(a[i], b[i]);
    if (c) return c;
  }
  return 0;
}
const argTuple = (a) => [a.flat, a.key, a.type, a.i, a.s, a.r];
const nullable = (x) => [x ?? "[NULL]", x === null ? "1" : "0"];
export function csv(tables, headers) {
  return Buffer.from(
    tables
      .map((rows, i) =>
        [headers[i], ...rows]
          .map((row) =>
            row
              .map((v) =>
                v === null
                  ? '"[NULL]"'
                  : `"${String(v).replaceAll('"', '""')}"`,
              )
              .join(","),
          )
          .join("\n"),
      )
      .join("\n\n") + "\n",
  );
}
export function exportGraph(graph = authoredGraph()) {
  const ordered = [...graph.nodes].sort((a, b) =>
    BigInt(a.ts) < BigInt(b.ts)
      ? -1
      : BigInt(a.ts) > BigInt(b.ts)
        ? 1
        : Number(BigInt(a.id) - BigInt(b.id)),
  );
  function build(scope) {
    const families = scope ? scopeFamilies : targetFamilies;
    const selected = ordered.filter(
      (n) =>
        families.includes(n.name) ||
        ["authored:start", "authored:end"].includes(n.name),
    );
    const ids = new Set(selected.map((n) => n.id));
    if (scope)
      for (const n of selected) {
        let p = n.parent;
        while (p) {
          ids.add(p);
          p = graph.nodes.find((x) => x.id === p)?.parent;
        }
      }
    const nodes = scope ? ordered.filter((n) => ids.has(n.id)) : selected;
    const census = families.map((name) => {
      const ns = selected.filter((n) => n.name === name);
      return [
        name,
        String(ns.length),
        String(new Set(ns.map((n) => n.argSet)).size),
      ];
    });
    const slices = nodes.map((n) =>
      scope
        ? [
            n.id,
            n.ts,
            n.dur,
            n.depth,
            n.parent,
            selected.includes(n) ? "1" : "0",
            n.name,
            n.category,
            n.track,
            n.trackName,
            n.argSet,
            n.utid,
            n.tid,
            n.upid,
            n.pid,
            n.process,
            n.thread,
            n.parent === null
              ? "no_parent"
              : ids.has(n.parent)
                ? "parent_present"
                : "missing_parent",
            n.dur === "-1"
              ? "unclosed"
              : BigInt(n.dur) < 0n
                ? "other_negative"
                : "nonnegative",
            n.parent === null ? "1" : "0",
            "0",
            n.category === null ? "1" : "0",
            n.trackName === null ? "1" : "0",
            n.process === null ? "1" : "0",
            n.thread === null ? "1" : "0",
          ]
        : [
            n.id,
            n.ts,
            n.dur,
            n.name,
            n.track,
            n.trackName,
            n.argSet,
            n.utid,
            n.tid,
            n.upid,
            n.pid,
            n.process,
            n.thread,
            n.trackName === null ? "1" : "0",
            n.process === null ? "1" : "0",
            n.thread === null ? "1" : "0",
          ],
    );
    const expanded = [];
    for (const n of selected)
      for (const a of [
        ...(n.args.length
          ? n.args
          : [{ flat: null, key: null, type: null, i: null, s: null, r: null }]),
      ].sort((a, b) => tuple(argTuple(a), argTuple(b))))
        expanded.push({ n, a, p: n.args.length ? "1" : "0" });
    const groups = new Map();
    for (const { n, a, p } of expanded) {
      const dims = [n.name, a.flat, a.key, a.type],
        k = JSON.stringify(dims);
      let g = groups.get(k);
      if (!g) groups.set(k, (g = { dims, occ: 0, ids: new Set() }));
      g.occ += Number(p);
      g.ids.add(n.id);
    }
    const gs = [...groups.values()].sort((a, b) => tuple(a.dims, b.dims));
    gs.forEach((g, i) => (g.id = String(i + 1)));
    const args = expanded.map(({ n, a, p }) =>
      scope
        ? [
            n.id,
            groups.get(JSON.stringify([n.name, a.flat, a.key, a.type])).id,
            n.argSet,
            p,
            a.i,
            a.s,
            a.r,
            ...[a.i, a.s, a.r].map((x) => (x === null ? "1" : "0")),
          ]
        : [
            n.id,
            n.name,
            n.argSet,
            p,
            a.flat,
            a.key,
            a.type,
            a.i,
            a.s,
            a.r,
            ...[a.flat, a.key, a.type, a.i, a.s, a.r].map((x) =>
              x === null ? "1" : "0",
            ),
          ],
    );
    const dimensions = gs.map((g) => [
      ...(scope ? [g.id] : []),
      ...g.dims,
      String(g.occ),
      String(g.ids.size),
      ...g.dims.slice(1).map((x) => (x === null ? "1" : "0")),
    ]);
    const stats = (scope ? graph.scopeStats : graph.stats).map((s) =>
      scope
        ? [...s, ...[s[0], s[2], s[3]].map((x) => (x === null ? "1" : "0"))]
        : s,
    );
    return [
      census,
      slices,
      args,
      dimensions,
      stats,
      [graph.bounds],
      ...(scope ? [] : [graph.derived]),
    ];
  }
  const targetTables = build(false),
    scopeTables = build(true);
  return {
    targetBytes: csv(targetTables, targetHeaders),
    scopeBytes: csv(scopeTables, scopeHeaders),
    targetTables,
    scopeTables,
  };
}

// Pure authored importer smoke input; never captured data or a performance sample.
// The protobuf field numbers follow the pinned v59.1 encodings documented in
// smoke.mjs: Trace.packet=1, TracePacket.track_event=11/track_descriptor=60,
// TrackEvent debug_annotations=4/type=9/track_uuid=11/category=22/name=23;
// DebugAnnotation name=10/int=4/string=6/dict_entries=11/array_values=12.
export function authoredZeroFeedbackProtoFixture() {
  const concat = (...parts) => Buffer.concat(parts);
  const varint = (value) => {
    const bytes = [];
    do {
      const byte = Number(value & 127n);
      value >>= 7n;
      bytes.push(byte | (value ? 128 : 0));
    } while (value);
    return Buffer.from(bytes);
  };
  const uint = (field, value) =>
    concat(varint(BigInt(field) * 8n), varint(value));
  const body = (field, bytes) =>
    concat(
      varint(BigInt(field) * 8n + 2n),
      varint(BigInt(bytes.length)),
      bytes,
    );
  const text = (field, value) => body(field, Buffer.from(value));
  const packet = (...fields) => body(1, concat(uint(10, 1n), ...fields));
  const annotation = (name, value) => concat(text(10, name), value);
  const string = (name, value) => annotation(name, text(6, value));
  const integer = (name, value) => annotation(name, uint(4, value));
  const dict = (name, ...entries) =>
    annotation(name, concat(...entries.map((entry) => body(11, entry))));
  const event = (name, timestamp, category, ...annotations) =>
    packet(
      uint(8, timestamp),
      uint(58, 6n),
      body(
        11,
        concat(
          uint(9, 3n),
          uint(11, 310n),
          text(22, category),
          text(23, name),
          ...annotations.map((entry) => body(4, entry)),
        ),
      ),
    );
  const frame = dict(
    "",
    string("frame", "AUTHORED_FRAME"),
    integer("processId", 100n),
  );
  const frames = annotation("frames", body(12, frame));
  return concat(
    // ClockSnapshot primary_trace_clock=2, clocks=1; Clock timestamp=2,
    // is_incremental=3 and unit_multiplier_ns=4. Clock6 is explicit ns.
    packet(
      uint(13, 1n),
      body(
        6,
        concat(
          body(
            1,
            concat(uint(1, 6n), uint(2, 1000n), uint(3, 0n), uint(4, 1n)),
          ),
          uint(2, 6n),
        ),
      ),
    ),
    // TrackDescriptor uuid=1/process=3/thread=4/parent_uuid=5.
    // ProcessDescriptor pid=1/name=6; ThreadDescriptor pid=1/tid=2/name=5.
    packet(
      body(
        60,
        concat(
          uint(1, 300n),
          body(3, concat(uint(1, 100n), text(6, "AuthoredRenderer"))),
        ),
      ),
    ),
    packet(
      body(
        60,
        concat(
          uint(1, 310n),
          uint(5, 300n),
          body(
            4,
            concat(uint(1, 100n), uint(2, 101n), text(5, "CrRendererMain")),
          ),
        ),
      ),
    ),
    event(
      "TracingStartedInBrowser",
      1001n,
      "disabled-by-default-devtools.timeline",
      dict("data", frames),
    ),
    event(
      "SetLayerTreeId",
      1002n,
      "disabled-by-default-devtools.timeline",
      dict(
        "data",
        string("frame", "AUTHORED_FRAME"),
        integer("layerTreeId", 7n),
      ),
    ),
    event(
      "authored:start",
      1100n,
      "blink.user_timing",
      dict("data", string("navigationId", "AUTHORED_LOADER")),
    ),
    event(
      "authored:end",
      1400n,
      "blink.user_timing",
      dict("data", string("navigationId", "AUTHORED_LOADER")),
    ),
    event("authored:noop-tail", 1500n, "authored.feedback"),
  );
}
