import policy from "./feedback-observations-compact-source-model-v2.json" with { type: "json" };

// Pure supplied-byte evaluator. Neither these inputs nor these results confer execution authority.
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value;
};
freeze(policy);
const L = policy.limits,
  MIN = -(1n << 63n),
  MAX = (1n << 63n) - 1n,
  NIL = "[NULL]";
class Refusal extends Error {
  constructor(stage, reason) {
    super(reason);
    this.stage = stage;
    this.reason = reason;
  }
}
function need(ok, stage, reason) {
  if (!ok) throw new Refusal(stage, reason);
}
function budget() {
  let remaining = L.workUnits;
  return (n) => {
    need(
      Number.isSafeInteger(n) && n >= 0 && remaining >= n,
      "limits",
      "logical-work-limit",
    );
    remaining -= n;
  };
}
function integer(text, nonnegative = false) {
  need(
    typeof text === "string" &&
      /^(?:0|-[1-9][0-9]*|[1-9][0-9]*)$/.test(text) &&
      text.length <= 20,
    "types",
    "integer",
  );
  const n = BigInt(text);
  need(
    n >= MIN && n <= MAX && (!nonnegative || n >= 0n),
    "types",
    "integer-range",
  );
  return n;
}
function flag(v) {
  need(v === "0" || v === "1", "types", "null-flag");
  return v === "1";
}
function nullable(r, key) {
  const isNull = flag(r[key + "_is_null"]);
  if (isNull) need(r[key] === NIL, "types", "null-sentinel");
  return isNull ? null : r[key];
}
function id(v) {
  return v === NIL ? null : integer(v, true).toString();
}
function utf8bytes(s) {
  return Buffer.byteLength(s, "utf8");
}
function binary(a, b) {
  return Buffer.compare(Buffer.from(a), Buffer.from(b));
}
function compare(a, b, work) {
  work(1);
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  if (typeof a === "bigint" || typeof a === "number") return a < b ? -1 : 1;
  work(a.length + b.length);
  return binary(a, b);
}
function tuple(a, b, work) {
  for (let i = 0; i < a.length; i++) {
    const c = compare(a[i], b[i], work);
    if (c) return c;
  }
  return 0;
}
function ordered(rows, key, work, strict = false) {
  let prev;
  for (const r of rows) {
    const k = key(r);
    if (prev) {
      const c = tuple(prev, k, work);
      need(strict ? c < 0 : c <= 0, "relations", "sql-order");
    }
    prev = k;
  }
}
// Intrinsic accessors avoid invoking own getters on an otherwise ordinary byte view.
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const viewBuffer = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "buffer",
).get;
const viewOffset = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset",
).get;
const viewBytes = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
).get;
function inputCopy(value) {
  need(ArrayBuffer.isView(value), "input", "byte-view");
  const prototype = Object.getPrototypeOf(value);
  need(
    prototype === Uint8Array.prototype || prototype === Buffer.prototype,
    "input",
    "ordinary-byte-view",
  );
  const buffer = viewBuffer.call(value),
    bytes = viewBytes.call(value),
    offset = viewOffset.call(value);
  need(buffer instanceof ArrayBuffer, "input", "nonshared-byte-view");
  need(bytes <= L.csvBytes, "limits", "csv-bytes");
  return Buffer.from(new Uint8Array(buffer, offset, bytes));
}
function csvRecords(bytes, work) {
  work(bytes.length * 2);
  need(
    !(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf),
    "csv",
    "utf8-bom",
  );
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Refusal("csv", "utf8");
  }
  need(
    utf8bytes(text) <= L.decodedCSVBytes && !text.startsWith("\uFEFF"),
    "limits",
    "decoded-csv-bytes",
  );
  const rows = [];
  let rawRows = 0;
  let row = [],
    cell = "",
    quoted = false,
    closed = false,
    start = true;
  function pushCell() {
    need(utf8bytes(cell) <= L.cellBytes, "limits", "cell-bytes");
    row.push(cell);
    need(row.length <= L.columns, "limits", "columns");
    cell = "";
    closed = false;
    start = true;
  }
  function pushRow() {
    need(++rawRows <= L.rowsPerCSV, "limits", "csv-rows");
    // The official formatter emits empty physical lines between result tables.
    // A quoted empty field, delimiter or whitespace is still a real CSV record.
    if (start && !closed && row.length === 0 && cell === "") return;
    pushCell();
    rows.push(row);
    row = [];
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      need(start && !closed, "csv", "quote");
      quoted = true;
      start = false;
    } else if (c === ",") {
      pushCell();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      need(text[i + 1] === "\n", "csv", "newline");
      i++;
      pushRow();
    } else {
      need(!closed, "csv", "after-quote");
      cell += c;
      start = false;
    }
  }
  need(!quoted, "csv", "incomplete-record");
  if (row.length !== 0 || cell !== "" || closed || !start) pushRow();
  return { rows, rawRows };
}
// Compact physical tables are decoded into bounded logical records, never CSV.
function parseTables(bytes,kind,work){
 const {rows,rawRows}=csvRecords(bytes,work),headers=policy.sql[kind].headers,physical=headers.map(()=>[]);let table=-1;
 for(const row of rows){work(row.length);const next=headers[table+1];if(next&&row.length===next.length&&row.every((v,i)=>v===next[i])){table++;continue;}need(table>=0&&row.length===headers[table].length,'csv','table-header-or-width');need(!headers.some(h=>h.length===row.length&&h.every((v,i)=>v===row[i])),'csv','table-order');need(physical[table].length<L.compactTableRows[table],'limits','table-rows');physical[table].push(Object.fromEntries(headers[table].map((k,i)=>[k,row[i]])));}
 need(table===8,'csv','table-count');
 const dictionary=new Map(),used=new Set();let dictionaryBytes=0,logicalText=0,previous=null;
 for(const [i,row]of physical[0].entries()){work(row.text_hex.length*3+1);need(row.text_id===String(i+1),'dictionary','dictionary-id');need(row.valid_text==='1','dictionary','non-text-value');need(/^(?:[0-9A-F]{2})*$/.test(row.text_hex),'dictionary','dictionary-hex');need(previous===null||previous<row.text_hex,'dictionary','dictionary-order');previous=row.text_hex;dictionaryBytes+=row.text_hex.length/2;need(dictionaryBytes<=L.dictionaryBytes,'limits','dictionary-bytes');let value;try{value=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from(row.text_hex,'hex'));}catch{throw new Refusal('dictionary','dictionary-utf8');}need(Buffer.byteLength(value)<=L.cellBytes,'limits','cell-bytes');dictionary.set(row.text_id,value);}
 const textCharge=value=>{if(value!==null){const n=utf8bytes(value);need(logicalText+n<=L.logicalTextBytes,'limits','logical-text-bytes');work(n+1);logicalText+=n;}return value;};
 const ref=(key,charge=true)=>{need(typeof key==='string'&&/^(?:0|[1-9][0-9]*)$/.test(key)&&key.length<=5,'dictionary','dictionary-reference');if(key==='0')return null;need(dictionary.has(key),'dictionary','dictionary-reference');used.add(key);const value=dictionary.get(key);return charge?textCharge(value):value;};
 const mapped=(r,h,charge=true)=>{const value={};work(h.length*2);for(const key of h){if(key.endsWith('_text_id')){const k=key.slice(0,-8),v=ref(r[key],charge);value[k]=v??NIL;value[k+'_is_null']=v===null?'1':'0';}else value[key]=r[key];}return value;};
 const out=Array.from({length:7},()=>[]),scope=kind==='scope';
 out[0]=physical[1].map(r=>mapped(r,headers[1]));
 out[1]=physical[2].map(r=>{const n=mapped(r,headers[2]);if(scope){need(['0','1','2'].includes(n.parent_status)&&['0','1','2'].includes(n.duration_status),'types','scope-status');n.parent_status=['no_parent','parent_present','missing_parent'][Number(n.parent_status)];n.duration_status=['nonnegative','unclosed','other_negative'][Number(n.duration_status)];n.parent_id_is_null=n.parent_id===NIL?'1':'0';}return n;});
 const registries=new Map();let prevSet=-1n;for(const r of physical[3]){const id=integer(r.arg_set_id,true),count=integer(r.arg_count,true),refs=integer(r.slice_count,true);need(id>prevSet,'relations','registry-order');prevSet=id;need(count<=BigInt(L.logicalArguments)&&refs>0n&&refs<=4096n,'limits','registry-count');registries.set(r.arg_set_id,{count,refs,actualRefs:0n,args:[]});}
 const rawArgs=[];for(const r of physical[4]){const registry=registries.get(r.arg_set_id);need(registry,'relations','argument-registry');const a=mapped(r,headers[4],false);for(const k of ['int_value','real_value'])a[k+'_is_null']=a[k]===NIL?'1':'0';registry.args.push(a);rawArgs.push(a);}
 const asArgument=r=>({flat:r.flat_key_is_null==='1'?null:r.flat_key,key:r.key_is_null==='1'?null:r.key,type:r.value_type_is_null==='1'?null:r.value_type,i:r.int_value_is_null==='1'?null:r.int_value,s:r.string_value_is_null==='1'?null:r.string_value,r:r.real_value_is_null==='1'?null:r.real_value});
 ordered(rawArgs,r=>[integer(r.arg_set_id,true),...argTuple(asArgument(r))],work);
 for(const r of registries.values())need(BigInt(r.args.length)===r.count,'relations','registry-argument-count');
 out[3]=physical[5].map((r,i)=>({...mapped(r,headers[5]),...(scope?{arg_key_id:String(i+1)}:{})}));
 const dimensionIds=new Map(out[3].map((r,i)=>[JSON.stringify(argDims(r)),String(i+1)]));
 let argumentCount=0;for(const n of out[1]){if(scope&&n.is_selected!=='1')continue;const registry=n.arg_set_id===NIL?null:registries.get(n.arg_set_id);need(n.arg_set_id===NIL||registry,'relations','slice-registry');if(registry)registry.actualRefs++;const count=Math.max(1,registry?.args.length??0);need(count<=L.logicalArguments-argumentCount,'limits','logical-arguments');argumentCount+=count;work(count*(scope?20:32));for(const a of registry?.args.length?registry.args:[{flat_key:NIL,key:NIL,value_type:NIL,int_value:NIL,string_value:NIL,real_value:NIL,flat_key_is_null:'1',key_is_null:'1',value_type_is_null:'1',int_value_is_null:'1',string_value_is_null:'1',real_value_is_null:'1'}]){const row={...a,slice_id:n.id,name:textCharge(n.name),arg_set_id:n.arg_set_id,arg_present:registry?.args.length?'1':'0'};for(const k of ['flat_key','key','value_type','string_value'])if(a[k+'_is_null']==='0')textCharge(a[k]);if(scope){const dims=[n.name,...['flat_key','key','value_type'].map(k=>a[k+'_is_null']==='1'?null:a[k])];row.arg_key_id=dimensionIds.get(JSON.stringify(dims));need(row.arg_key_id,'relations','dictionary-reference');}out[2].push(row);}}
 for(const r of registries.values())need(r.actualRefs===r.refs,'relations','registry-reference-count');
 out[4]=physical[6].map(r=>mapped(r,headers[6]));out[5]=physical[7].map(r=>mapped(r,headers[7]));out[6]=physical[8].map(r=>mapped(r,headers[8]));
 need(used.size===dictionary.size,'dictionary','unused-dictionary-entry');let logicalRows=0;for(let i=0;i<out.length;i++){const cap=i===6?4096:L[kind+'TableRows'][i];need(out[i].length<=cap,'limits','logical-table-rows');logicalRows+=out[i].length;}need(logicalRows<=L.rowsPerCSV,'limits','logical-rows');return{tables:out,rows:logicalRows};
}

function parseSlice(r, scope) {
  const n = {
    id: integer(r.id, true).toString(),
    ts: integer(r.ts),
    dur: integer(r.dur),
    name: scope ? nullable(r, "name") : r.name,
    track: integer(r.track_id, true).toString(),
    argSet: id(r.arg_set_id),
    utid: id(r.utid),
    tid: id(r.tid),
    upid: id(r.upid),
    pid: id(r.pid),
    trackName: nullable(r, "track_name"),
    process: nullable(r, "process_name"),
    thread: nullable(r, "thread_name"),
    args: [],
    argIndex: new Map(),
  };
  if (scope)
    Object.assign(n, {
      depth: integer(r.depth, true),
      parent: nullable(r, "parent_id"),
      selected: flag(r.is_selected),
      category: nullable(r, "category"),
      parentStatus: r.parent_status,
      durationStatus: r.duration_status,
    });
  if (scope) {
    if (n.parent !== null) n.parent = integer(n.parent, true).toString();
    need(
      n.durationStatus ===
        (n.dur === -1n
          ? "unclosed"
          : n.dur < 0n
            ? "other_negative"
            : "nonnegative"),
      "relations",
      "duration-status",
    );
  }
  return n;
}
function argDims(r) {
  return [
    r.name,
    nullable(r, "flat_key"),
    nullable(r, "key"),
    nullable(r, "value_type"),
  ];
}
function argTuple(a) {
  return [
    a.flat,
    a.key,
    a.type,
    a.i === null ? null : BigInt(a.i),
    a.s,
    a.r === null ? null : Number(a.r),
  ];
}
function argShape(a) {
  return [a.present, a.flat, a.key, a.type, a.i, a.s, a.r];
}
function channels(a) {
  if (!a.present) {
    need(
      [a.flat, a.key, a.type, a.i, a.s, a.r].every((x) => x === null),
      "types",
      "placeholder",
    );
    return;
  }
  const type = a.type;
  if (["int", "uint", "pointer", "bool"].includes(type)) {
    need(
      a.i !== null && a.s === null && a.r === null,
      "types",
      "argument-channel",
    );
    const i = integer(a.i);
    if (type === "bool") need(i === 0n || i === 1n, "types", "bool");
  } else if (type === "string" || type === "json")
    need(
      a.i === null && a.s !== null && a.r === null,
      "types",
      "argument-channel",
    );
  else if (type === "real") {
    need(
      a.i === null &&
        a.s === null &&
        a.r !== null &&
        /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(a.r) &&
        Number.isFinite(Number(a.r)),
      "types",
      "real-channel",
    );
  } else if (type === null || type === "null")
    need(a.i === null && a.s === null && a.r === null, "types", "null-channel");
  else need(false, "types", "value-type");
  if (a.key !== null && a.flat !== null) {
    need(
      a.key.replace(/\[(?:0|[1-9]\d*)\]/g, "") === a.flat,
      "types",
      "flat-key",
    );
    const indices = [...a.key.matchAll(/\[(\d+)\]/g)];
    need(
      indices.length <= L.maxArrayPathDepth &&
        indices.every(
          (m) => /^(0|[1-9]\d*)$/.test(m[1]) && Number(m[1]) <= L.maxArrayIndex,
        ),
      "limits",
      "array-index",
    );
  }
}
function validateExport(parsed, kind, phaseNames, work) {
  const scope = kind === "scope",
    [
      census,
      sliceRows,
      argRows,
      dimensionRows,
      statRows,
      boundsRows,
      derivedRows,
    ] = parsed.tables;
  const nodes = sliceRows.map((r) => parseSlice(r, scope));
  ordered(nodes, (n) => [n.ts, BigInt(n.id)], work, true);
  const byId = new Map();
  for (const n of nodes) {
    work(1);
    need(!byId.has(n.id), "relations", "duplicate-slice");
    byId.set(n.id, n);
  }
  const families = policy.sql[kind].families;
  const selected = scope ? nodes.filter((n) => n.selected) : nodes;
  for (const phase of phaseNames) {
    const marks = selected.filter((n) => {
      work(1);
      return n.name === phase;
    });
    need(marks.length === 1, "phase", "phase-multiplicity");
  }
  const selectedIds = new Set(selected.map((n) => n.id));
  for (const n of nodes) n.work = work;
  for (const n of nodes) {
    work(1);
    const should = families.includes(n.name) || phaseNames.includes(n.name);
    need(
      scope ? n.selected === should : should,
      "relations",
      "selected-family",
    );
  }
  const expectedCensus = families
    .map((name) => {
      const ns = selected.filter((n) => {
        work(1);
        return n.name === name;
      });
      return [
        name,
        BigInt(ns.length),
        BigInt(new Set(ns.map((n) => n.argSet).filter((x) => x !== null)).size),
      ];
    })
    .sort((a, b) => tuple(a, b, work));
  const actualCensus = census.map((r) => [
    r.name,
    integer(r.event_count, true),
    integer(r.arg_set_count, true),
  ]);
  need(
    JSON.stringify(actualCensus, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ) ===
      JSON.stringify(expectedCensus, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    "relations",
    "family-census",
  );
  const dictionary = new Map();
  const dimensions = dimensionRows.map((r, i) => {
    const dims = argDims(r);
    const d = {
      dims,
      occ: integer(r.arg_occurrence_count, true),
      count: integer(r.slice_count, true),
    };
    if (scope) {
      need(
        integer(r.arg_key_id, true) === BigInt(i + 1),
        "relations",
        "dictionary-id",
      );
      dictionary.set(r.arg_key_id, d);
    }
    return d;
  });
  ordered(dimensions, (d) => d.dims, work, true);
  const args = [];
  for (const r of argRows) {
    work(1);
    const n = byId.get(r.slice_id);
    need(
      n && selectedIds.has(n.id) && r.arg_set_id === (n.argSet ?? NIL),
      "relations",
      "argument-slice",
    );
    const d = scope ? dictionary.get(r.arg_key_id) : { dims: argDims(r) };
    need(d && d.dims[0] === n.name, "relations", "dictionary-reference");
    const a = {
      present: flag(r.arg_present),
      flat: d.dims[1],
      key: d.dims[2],
      type: d.dims[3],
      i: nullable(r, "int_value"),
      s: nullable(r, "string_value"),
      r: nullable(r, "real_value"),
    };
    channels(a);
    if (a.present) need(n.argSet !== null, "relations", "matched-argset");
    n.args.push(a);
    let occurrences = n.argIndex.get(a.key);
    if (!occurrences) n.argIndex.set(a.key, (occurrences = []));
    occurrences.push(a);
    args.push({ n, a });
  }
  ordered(args, ({ n, a }) => [n.ts, BigInt(n.id), ...argTuple(a)], work);
  const groups = new Map(),
    argSets = new Map();
  for (const n of selected) {
    work(n.args.length + 1);
    need(n.args.length > 0, "relations", "missing-arguments");
    need(
      n.args.every((a) => a.present) || n.args.length === 1,
      "relations",
      "placeholder-multiplicity",
    );
    const shape = JSON.stringify(n.args.map(argShape));
    work(shape.length);
    if (n.argSet !== null) {
      if (argSets.has(n.argSet))
        need(argSets.get(n.argSet) === shape, "relations", "shared-argset");
      else argSets.set(n.argSet, shape);
    }
    for (const a of n.args) {
      const dims = [n.name, a.flat, a.key, a.type],
        key = JSON.stringify(dims);
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { occ: 0n, ids: new Set() }));
      if (a.present) g.occ++;
      g.ids.add(n.id);
    }
  }
  need(groups.size === dimensions.length, "relations", "dimension-count");
  for (const d of dimensions) {
    const g = groups.get(JSON.stringify(d.dims));
    need(
      g && g.occ === d.occ && BigInt(g.ids.size) === d.count,
      "relations",
      "dimension-census",
    );
  }
  if (scope) {
    const reached = new Set();
    for (const n of selected) {
      let cur = n,
        seen = new Set();
      while (cur && !reached.has(cur.id)) {
        work(1);
        need(
          !seen.has(cur.id) && seen.size < L.maxAncestryNodes,
          "relations",
          "ancestry-cycle",
        );
        seen.add(cur.id);
        const p = cur.parent === null ? null : byId.get(cur.parent);
        need(
          cur.parentStatus ===
            (cur.parent === null
              ? "no_parent"
              : p
                ? "parent_present"
                : "missing_parent"),
          "relations",
          "parent-status",
        );
        cur = p;
      }
      for (const id of seen) reached.add(id);
    }
    need(reached.size === nodes.length, "relations", "context-reachability");
  }
  const stats = statRows.map((r) => {
    const s = {
      name: nullable(r, "name"),
      idx: r.idx === NIL ? null : integer(r.idx),
      severity: nullable(r, "severity"),
      source: nullable(r, "source"),
      value: integer(r.value),
    };
    need(s.value !== 0n, "relations", "zero-stat");
    return s;
  });
  ordered(stats, (s) => [s.name, s.idx], work);
  need(boundsRows.length === 1, "relations", "trace-bounds");
  const bounds = [
    integer(boundsRows[0].start_ts),
    integer(boundsRows[0].end_ts),
  ];
  need(bounds[0] <= bounds[1], "relations", "trace-bounds");
  const derived = (derivedRows ?? []).map((r) => [
    r.surface_frame_trace_id === NIL ? null : integer(r.surface_frame_trace_id),
    r.display_trace_id === NIL ? null : integer(r.display_trace_id),
  ]);
  ordered(derived, (r) => r, work);
  return {
    nodes,
    selected,
    byId,
    argSets,
    stats,
    bounds,
    derived,
    rows: parsed.rows,
  };
}
function serialized(v, work) {
  const s = JSON.stringify(v, (_, x) =>
    typeof x === "bigint" ? x.toString() : x,
  );
  work(s.length);
  return s;
}
function crossExports(target, scope, work, phaseNames) {
  const mandatoryCommon = (n) =>
    n.name === "Graphics.Pipeline" || phaseNames.includes(n.name);
  for (const [id, shape] of target.argSets) {
    work(shape.length + 1);
    if (scope.argSets.has(id))
      need(scope.argSets.get(id) === shape, "relations", "cross-export-argset");
  }
  need(
    serialized(target.bounds, work) === serialized(scope.bounds, work),
    "relations",
    "cross-export-bounds",
  );
  const targetCommon = target.nodes.filter(mandatoryCommon);
  const scopeCommon = scope.selected.filter(mandatoryCommon);
  need(
    targetCommon.length === scopeCommon.length,
    "relations",
    "cross-export-population",
  );
  for (const n of target.nodes) {
    work(1);
    const s = scope.byId.get(n.id);
    if (!s) {
      need(!mandatoryCommon(n), "relations", "cross-export-slice");
      continue;
    }
    for (const k of [
      "id",
      "ts",
      "dur",
      "name",
      "track",
      "argSet",
      "utid",
      "tid",
      "upid",
      "pid",
      "trackName",
      "process",
      "thread",
    ])
      need(n[k] === s[k], "relations", "cross-export-slice");
    if (s.selected)
      need(
        serialized(n.args.map(argShape), work) ===
          serialized(s.args.map(argShape), work),
        "relations",
        "cross-export-arguments",
      );
  }
  need(
    serialized(
      target.stats.filter((s) => s.source === "trace"),
      work,
    ) ===
      serialized(
        scope.stats.filter((s) => s.source === "trace"),
        work,
      ),
    "relations",
    "cross-export-trace-stats",
  );
}
function one(n, key, type, optional = false) {
  n.work(key.length + 1);
  const matches = n.argIndex.get(key) ?? [];
  n.work(matches.length);
  need(
    (optional && matches.length === 0) || matches.length === 1,
    "graph",
    "required-argument-multiplicity",
  );
  if (!matches.length) return null;
  const a = matches[0];
  need(
    a.present && a.flat === key && a.type === type,
    "graph",
    "required-argument-type",
  );
  return type === "string" ? a.s : a.i;
}
function traceId(v) {
  need(v !== null, "graph", "missing-trace-identity");
  integer(v);
  need(v !== "-1", "graph", "unsupported-sentinel-ambiguous");
  return v;
}
function context(n) {
  return [n.track, n.utid, n.tid, n.upid, n.pid];
}
function coherent(n) {
  need(
    context(n).every((x) => x !== null),
    "graph",
    "missing-process-context",
  );
}
function sameProcess(a, b) {
  return a.upid === b.upid && a.pid === b.pid;
}
function treeId(v) {
  need(
    v !== null && integer(v) > 0n && integer(v) <= 2147483647n,
    "graph",
    "tree-int32",
  );
  return v;
}
function endpoint(n) {
  need(n.dur >= 0n, "interval", "unclassifiable-successful-endpoint");
  const t = n.ts + n.dur;
  need(t >= MIN && t <= MAX, "interval", "endpoint-overflow");
  return t;
}
function indexed(n, prefix, type) {
  n.work(n.args.length + 1);
  const values = [];
  for (const a of n.args) {
    if (a.flat !== prefix && !a.key?.startsWith(prefix + "[")) continue;
    need(
      a.present && a.flat === prefix && a.type === type,
      "graph",
      "indexed-type",
    );
    const m = a.key?.match(
      new RegExp(
        "^" +
          prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
          "\\[(0|[1-9][0-9]*)\\]$",
      ),
    );
    need(m && Number(m[1]) <= L.maxArrayIndex, "graph", "indexed-path");
    values.push({
      index: Number(m[1]),
      value: type === "string" ? a.s : a.i,
      key: a.key,
    });
  }
  values.sort((a, b) => a.index - b.index);
  for (let i = 0; i < values.length; i++)
    need(values[i].index === i, "graph", "indexed-contiguity");
  return values;
}
function targetProof(target, scope, selector, work) {
  const frame = selector.target.frameId;
  const framePids = new Set(),
    frameReferences = [];
  for (const n of target.nodes) {
    if (n.name !== "TracingStartedInBrowser") continue;
    const groups = new Map();
    for (const a of n.args) {
      work(1);
      const m = a.key?.match(
        /^debug\.data\.frames\[(0|[1-9][0-9]*)\]\.([A-Za-z0-9_]+)$/,
      );
      if (!m) continue;
      need(
        Number(m[1]) <= L.maxArrayIndex &&
          a.flat === `debug.data.frames.${m[2]}`,
        "target",
        "frame-index",
      );
      let g = groups.get(m[1]);
      if (!g) groups.set(m[1], (g = new Map()));
      need(!g.has(m[2]), "target", "duplicate-frame-field");
      g.set(m[2], a);
    }
    for (const [index, g] of groups) {
      const f = g.get("frame");
      if (!f || f.s !== frame) continue;
      need(f.type === "string", "target", "frame-type");
      const pid = g.get("processId");
      need(
        pid?.type === "int" && pid.i !== null && integer(pid.i, true) >= 0n,
        "target",
        "frame-process",
      );
      framePids.add(pid.i);
      frameReferences.push({
        sliceId: n.id,
        index,
        fields: [...g.values()].map((a) => ({
          key: a.key,
          type: a.type,
          value: a.s ?? a.i ?? a.r,
        })),
      });
    }
  }
  need(framePids.size === 1, "target", "frame-process-ambiguity");
  const pid = [...framePids][0];
  const phases = Object.values(selector.phaseNames).map((name) => {
    const ns = scope.selected.filter((n) => {
      work(1);
      return n.name === name;
    });
    need(ns.length === 1, "phase", "phase-multiplicity");
    return ns[0];
  });
  const [start, end] = phases;
  for (const n of phases) {
    coherent(n);
    need(
      n.pid === pid &&
        n.category === "blink.user_timing" &&
        n.thread === "CrRendererMain" &&
        n.dur === 0n,
      "phase",
      "phase-context",
    );
    need(
      one(n, "debug.data.navigationId", "string") === selector.target.loaderId,
      "phase",
      "phase-loader",
    );
  }
  need(
    context(start).every((v, i) => v === context(end)[i]) && start.ts < end.ts,
    "phase",
    "phase-context-or-order",
  );
  need(
    start.ts >= target.bounds[0] && end.ts <= target.bounds[1],
    "interval",
    "phase-outside-bounds",
  );
  const mappings = [];
  for (const n of target.nodes) {
    if (n.name !== "SetLayerTreeId") continue;
    work(n.args.length * 4 + 1);
    const fa = n.args.filter((a) => a.key === "debug.data.frame");
    const ta = n.args.filter((a) => a.key === "debug.data.layerTreeId");
    if (!fa.some((a) => a.s === frame)) continue;
    need(
      one(n, "debug.data.frame", "string") === frame,
      "target",
      "mapping-frame",
    );
    const tree = treeId(one(n, "debug.data.layerTreeId", "int"));
    coherent(n);
    need(sameProcess(n, start), "target", "mapping-process");
    mappings.push({ n, tree });
  }
  need(
    mappings.length > 0 && new Set(mappings.map((m) => m.tree)).size === 1,
    "target",
    "mapping-tree-ambiguity",
  );
  const tree = mappings[0].tree;
  for (const n of target.nodes) {
    if (n.name !== "SetLayerTreeId" || !sameProcess(n, start)) continue;
    work(n.args.length * 3 + 1);
    const ts = n.args.filter((a) => a.key === "debug.data.layerTreeId");
    if (!ts.some((a) => a.i === tree)) continue;
    need(
      one(n, "debug.data.frame", "string") === frame &&
        treeId(one(n, "debug.data.layerTreeId", "int")) === tree,
      "target",
      "conflicting-tree-owner",
    );
  }
  const firstMappingTs = mappings.reduce((earliest, m) => {
    work(1);
    return m.n.ts < earliest ? m.n.ts : earliest;
  }, mappings[0].n.ts);
  const mappingBefore = (n) => {
    work(1);
    need(firstMappingTs <= n.ts, "target", "mapping-after-contribution");
  };
  return {
    start,
    end,
    tree,
    mappings: mappings.map((m) => ({
      sliceId: m.n.id,
      treeId: m.tree,
      ts: m.n.ts.toString(),
    })),
    frameReferences,
    mappingBefore,
  };
}
function ancestryIndex(scope, work) {
  const cache = new Map();
  return (n) => {
    if (cache.has(n.id)) return cache.get(n.id);
    const path = [],
      seen = new Set();
    let cur = n;
    while (cur) {
      work(1);
      need(
        !seen.has(cur.id) && seen.size < L.maxAncestryNodes,
        "graph",
        "ancestry-cycle",
      );
      seen.add(cur.id);
      coherent(cur);
      path.push(cur);
      if (cur.parent === null) {
        need(cur.depth === 0n, "graph", "root-depth");
        break;
      }
      const p = scope.byId.get(cur.parent);
      need(p, "graph", "missing-ancestor");
      need(
        cur.depth === p.depth + 1n &&
          context(cur).every((v, i) => v === context(p)[i]),
        "graph",
        "ancestry-context",
      );
      need(
        cur.dur >= 0n &&
          p.dur >= 0n &&
          cur.ts >= p.ts &&
          endpoint(cur) <= endpoint(p),
        "graph",
        "ancestry-containment",
      );
      cur = p;
    }
    cache.set(n.id, path);
    return path;
  };
}
const G = "chrome_graphics_pipeline.";
function graphIndex(scope, proof, work, wantedDisplays) {
  const ancestors = ancestryIndex(scope, work),
    generates = new Map(),
    submitsByGenerate = new Map(),
    receives = new Map(),
    aggregates = new Map();
  const graphics = scope.selected.filter((n) => n.name === "Graphics.Pipeline");
  // Relevance precedes certification: malformed matching occurrences cannot be
  // silently excluded by a cardinality/type filter intended for valid records.
  function rawMatches(n, key, identities) {
    work(n.args.length + 1);
    return n.args.some(
      (a) =>
        (a.key === key || a.flat === key) &&
        [a.i, a.s, a.r].some(
          (value) => value !== null && identities.has(value),
        ),
    );
  }
  function rawStep(n, step) {
    return rawMatches(n, G + "step", new Set([step]));
  }
  const wantedSurfaces = new Set();
  for (const n of graphics) {
    if (
      !rawStep(n, "STEP_SURFACE_AGGREGATION") ||
      !rawMatches(n, G + "display_trace_id", wantedDisplays)
    )
      continue;
    need(
      one(n, G + "step", "string") === "STEP_SURFACE_AGGREGATION",
      "graph",
      "aggregate-step",
    );
    const display = traceId(one(n, G + "display_trace_id", "int"));
    const members = indexed(n, G + "aggregated_surface_frame_trace_ids", "int");
    for (const m of members) wantedSurfaces.add(m.value);
    let list = aggregates.get(display);
    if (!list) aggregates.set(display, (list = []));
    list.push(n);
  }
  const rawGenerateCache = new Map();
  function rawGenerate(n) {
    if (rawGenerateCache.has(n.id)) return rawGenerateCache.get(n.id);
    let cur = n,
      found = null;
    const seen = new Set();
    while (cur) {
      work(1);
      if (rawGenerateCache.has(cur.id)) {
        found = rawGenerateCache.get(cur.id);
        break;
      }
      if (seen.has(cur.id) || seen.size >= L.maxAncestryNodes) break;
      seen.add(cur.id);
      if (rawStep(cur, "STEP_GENERATE_COMPOSITOR_FRAME")) {
        found = cur;
        break;
      }
      cur = scope.byId.get(cur.parent);
    }
    for (const id of seen) rawGenerateCache.set(id, found);
    return found;
  }
  function renderer(n) {
    coherent(n);
    need(sameProcess(n, proof.start), "graph", "renderer-process");
  }
  function generateOf(n) {
    const path = ancestors(n);
    const gen = path.find((a) => rawStep(a, "STEP_GENERATE_COMPOSITOR_FRAME"));
    need(gen, "graph", "missing-generate");
    const gp = ancestors(gen),
      main = gp.find((a) => a.name === "MainFrame.Draw");
    need(main, "graph", "missing-main-draw");
    renderer(n);
    renderer(gen);
    renderer(main);
    need(
      n.thread === "Compositor" &&
        gen.thread === "Compositor" &&
        main.thread === "Compositor",
      "graph",
      "compositor-context",
    );
    one(gen, G + "step", "string");
    return { gen, main, path };
  }
  // Discover raw generate/tree/surface associations independently of valid
  // process/type filters; certification happens after the required path is known.
  const drawsByGenerate = new Map();
  for (const n of scope.selected) {
    if (n.name !== "DrawFrame") continue;
    const parent = scope.byId.get(n.parent);
    const gen = parent ? rawGenerate(parent) : null;
    if (!gen) continue;
    let group = drawsByGenerate.get(gen.id);
    if (!group) drawsByGenerate.set(gen.id, (group = { gen, draws: [] }));
    group.draws.push(n);
  }
  function rawRendererAnchor(n) {
    const seen = new Set();
    let cur = n;
    while (cur && !seen.has(cur.id) && seen.size < L.maxAncestryNodes) {
      work(1);
      if (sameProcess(cur, proof.start)) return true;
      seen.add(cur.id);
      cur = scope.byId.get(cur.parent);
    }
    return false;
  }
  const selectedGenerates = new Set();
  for (const { gen, draws } of drawsByGenerate.values()) {
    if (!rawMatches(gen, G + "surface_frame_trace_id", wantedSurfaces))
      continue;
    if (
      !draws.some((n) =>
        rawMatches(n, "debug.layerTreeId", new Set([proof.tree])),
      )
    )
      continue;
    if (
      !rawRendererAnchor(gen) &&
      !draws.some((n) => sameProcess(n, proof.start))
    )
      continue;
    selectedGenerates.add(gen.id);
  }
  // Find selected raw ancestors directly. A malformed nearer generate must not
  // hide a contradiction from the required source path containing it.
  function selectedAncestor(n) {
    const seen = new Set();
    let cur = scope.byId.get(n.parent);
    while (cur && !seen.has(cur.id) && seen.size < L.maxAncestryNodes) {
      work(1);
      if (selectedGenerates.has(cur.id)) return cur.id;
      seen.add(cur.id);
      cur = scope.byId.get(cur.parent);
    }
    return null;
  }
  for (const n of graphics) {
    if (!rawStep(n, "STEP_SUBMIT_COMPOSITOR_FRAME")) continue;
    const genId = selectedAncestor(n);
    if (genId === null) continue;
    let list = submitsByGenerate.get(genId);
    if (!list) submitsByGenerate.set(genId, (list = []));
    list.push(n);
  }
  for (const n of scope.selected) {
    if (n.name !== "DrawFrame") continue;
    const expectedGenerate = selectedAncestor(n);
    if (expectedGenerate === null) continue;
    work(1);
    need(
      treeId(one(n, "debug.layerTreeId", "int")) === proof.tree && n.dur === 0n,
      "graph",
      "draw-shape",
    );
    proof.mappingBefore(n);
    const { gen, main, path } = generateOf(n),
      surface = traceId(one(gen, G + "surface_frame_trace_id", "int"));
    need(gen.id === expectedGenerate, "graph", "draw-generate");
    const subs = submitsByGenerate.get(gen.id) ?? [];
    need(subs.length > 0, "graph", "missing-submit");
    const accepted = [];
    for (const s of subs) {
      work(1);
      const shape = generateOf(s);
      need(shape.gen.id === gen.id, "graph", "submit-generate");
      one(s, G + "step", "string");
      need(
        traceId(one(s, G + "surface_frame_trace_id", "int")) === surface,
        "graph",
        "submit-surface",
      );
      proof.mappingBefore(s);
      accepted.push({
        sliceId: s.id,
        ancestorIds: shape.path.map((a) => a.id),
      });
    }
    let contributions = generates.get(surface);
    if (!contributions) generates.set(surface, (contributions = []));
    contributions.push({
      surfaceFrameTraceId: surface,
      drawSliceId: n.id,
      generateSliceId: gen.id,
      mainDrawSliceId: main.id,
      ancestorIds: path.map((a) => a.id),
      submissions: accepted,
    });
  }
  for (const n of graphics) {
    if (
      rawStep(n, "STEP_RECEIVE_COMPOSITOR_FRAME") &&
      rawMatches(n, G + "surface_frame_trace_id", generates)
    ) {
      need(
        one(n, G + "step", "string") === "STEP_RECEIVE_COMPOSITOR_FRAME",
        "graph",
        "receive-step",
      );
      coherent(n);
      const surface = traceId(one(n, G + "surface_frame_trace_id", "int")),
        client = one(n, G + "frame_sink_id.frame_sink_client_id", "uint"),
        sink = one(n, G + "frame_sink_id.frame_sink_id", "uint");
      need(
        integer(client) >= 0n && integer(sink) >= 0n,
        "graph",
        "frame-sink-range",
      );
      let list = receives.get(surface);
      if (!list) receives.set(surface, (list = []));
      list.push({
        sliceId: n.id,
        frameSinkClientId: client,
        frameSinkId: sink,
        upid: n.upid,
        pid: n.pid,
        utid: n.utid,
        tid: n.tid,
        trackId: n.track,
      });
    }
  }
  return { generates, receives, aggregates };
}
function contributionProof(display, index, work) {
  const aggregates = index.aggregates.get(display) ?? [];
  need(aggregates.length > 0, "graph", "missing-raw-aggregation");
  const references = [];
  for (const n of aggregates) {
    work(n.args.length + 1);
    coherent(n);
    one(n, G + "step", "string");
    need(
      traceId(one(n, G + "display_trace_id", "int")) === display,
      "graph",
      "aggregate-display",
    );
    const members = indexed(n, G + "aggregated_surface_frame_trace_ids", "int");
    need(members.length > 0, "graph", "empty-aggregate");
    const seen = new Set();
    for (const m of members) {
      need(!seen.has(m.value), "graph", "duplicate-aggregate-member");
      seen.add(m.value);
      integer(m.value);
    }
    const contributions = [];
    for (const m of members) {
      work(1);
      const gs = index.generates.get(m.value);
      if (!gs) continue;
      traceId(m.value);
      const rs = index.receives.get(m.value) ?? [];
      need(rs.length > 0, "graph", "missing-receive");
      const identity = new Set(
        rs.map(
          (r) => `${r.upid}/${r.pid}/${r.frameSinkClientId}/${r.frameSinkId}`,
        ),
      );
      need(identity.size === 1, "graph", "ambiguous-receive");
      need(
        rs.every((r) => r.upid === n.upid && r.pid === n.pid),
        "graph",
        "viz-process-association",
      );
      contributions.push({
        surfaceFrameTraceId: m.value,
        membershipKey: m.key,
        receives: rs,
        targetContributions: gs,
      });
    }
    need(contributions.length > 0, "graph", "missing-target-membership");
    references.push({
      aggregationSliceId: n.id,
      displayTraceId: display,
      upid: n.upid,
      pid: n.pid,
      members: members.map((m) => ({
        index: String(m.index),
        key: m.key,
        surfaceFrameTraceId: m.value,
      })),
      contributions,
    });
  }
  const contexts = new Set(references.map((r) => `${r.upid}/${r.pid}`));
  need(contexts.size === 1, "graph", "ambiguous-display-process");
  return references;
}
function gcd(a, b) {
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}
function base() {
  return {
    schema: policy.schema,
    status: "unavailable",
    stage: null,
    reason: null,
    metric: policy.metric,
    executionEvidence: "untrusted-supplied-compact-csv",
    inputOrigin: "caller-supplied-compact-csv",
    traceOrigin: "unestablished",
    clockContract: "supplied-imported-nanoseconds",
    count: null,
    interval: null,
    observedHz: null,
    fps: null,
    exhaustivePopulation: false,
    nativeSupported: false,
    captureQualified: false,
    evaluationEligibility: false,
    scoringEligibility: false,
    rankingEligibility: false,
    coverage: {
      reporterEmission: "destructor-delayed-and-potentially-censored",
      physicalScanout: "not-established",
      inputCausality: "not-established",
      targetBinding: "explicit-imported-associations",
      sourceBrowserCorrespondence: policy.producer.correspondence,
    },
    events: [],
    diagnostics: {},
  };
}
function selectorValue(text) {
  need(
    typeof text === "string" && utf8bytes(text) <= L.configBytes,
    "input",
    "selector-string",
  );
  let s;
  try {
    s = JSON.parse(text);
  } catch {
    throw new Refusal("input", "selector-json");
  }
  need(
    s && typeof s === "object" && s.target && s.phaseNames,
    "input",
    "selector-shape",
  );
  const canonical = {
    target: { frameId: s.target.frameId, loaderId: s.target.loaderId },
    phaseNames: { start: s.phaseNames.start, end: s.phaseNames.end },
  };
  need(JSON.stringify(canonical) === text, "input", "selector-canonical");
  for (const v of [
    ...Object.values(canonical.target),
    ...Object.values(canonical.phaseNames),
  ])
    need(
      typeof v === "string" &&
        v.length > 0 &&
        utf8bytes(v) <= L.maxNameBytes &&
        !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(v),
      "input",
      "selector-name",
    );
  need(
    s.phaseNames.start !== s.phaseNames.end &&
      Object.values(s.phaseNames).every(
        (n) =>
          !policy.sql.target.families.includes(n) &&
          !policy.sql.scope.families.includes(n),
      ),
    "input",
    "phase-family-collision",
  );
  return canonical;
}
function outputCheck(result, work) {
  let nodes = 0,
    strings = 0,
    width = 0;
  const stack = [result];
  while (stack.length) {
    const v = stack.pop();
    work(1);
    need(++nodes <= L.resultNodes, "limits", "result-nodes");
    if (typeof v === "string") {
      strings += utf8bytes(v);
      width += 2;
      for (let i = 0; i < v.length; i++) {
        work(1);
        const c = v.charCodeAt(i);
        width +=
          c < 32
            ? 6
            : c === 34 || c === 92
              ? 2
              : c < 128
                ? 1
                : c < 2048
                  ? 2
                  : 3;
      }
    } else if (v === null) width += 4;
    else if (typeof v === "boolean") width += v ? 4 : 5;
    else if (typeof v === "number") width += String(v).length;
    else {
      const values = Array.isArray(v)
        ? v
        : Object.entries(v).flatMap(([k, x]) => [k, x]);
      width += 2 + values.length * 2;
      for (const x of values) stack.push(x);
    }
    need(
      strings <= L.resultStringBytes && width <= L.resultBytes,
      "limits",
      "result-width",
    );
  }
}
export function evaluateBrowserFeedbackObservationsCompactV2(
  targetBytes,
  scopeBytes,
  selectorJSON,
) {
  const work = budget(),
    result = base();
  let failureDiagnostics = {};
  try {
    if (typeof selectorJSON === "string") work(selectorJSON.length * 4);
    const selector = selectorValue(selectorJSON);
    const tb = inputCopy(targetBytes),
      sb = inputCopy(scopeBytes);
    need(tb.length + sb.length <= L.totalCSVBytes, "limits", "total-csv-bytes");
    const tp = parseTables(tb, "target", work),
      sp = parseTables(sb, "scope", work);
    need(tp.rows + sp.rows <= L.totalRows, "limits", "total-rows");
    const target = validateExport(
        tp,
        "target",
        Object.values(selector.phaseNames),
        work,
      ),
      scope = validateExport(
        sp,
        "scope",
        Object.values(selector.phaseNames),
        work,
      );
    need(serialized(target.derived,work)===serialized(scope.derived,work),"relations","cross-export-derived");
    crossExports(target, scope, work, Object.values(selector.phaseNames));
    const stats = {
      target: target.stats.map((s) => ({
        ...s,
        idx: s.idx?.toString() ?? null,
        value: s.value.toString(),
      })),
      scope: scope.stats.map((s) => ({
        ...s,
        idx: s.idx?.toString() ?? null,
        value: s.value.toString(),
      })),
    };
    result.diagnostics = {
      stats,
      derivedFirstDisplay: target.derived.map((r) =>
        r.map((v) => v?.toString() ?? null),
      ),
      sourceModel: {
        producerRevision: policy.producer.revision,
        browserSourceCorrespondence: policy.producer.correspondence,
        branch: policy.producer.branch,
      },
    };
    outputCheck({ diagnostics: result.diagnostics }, work);
    failureDiagnostics = result.diagnostics;
    for (const s of [...target.stats, ...scope.stats])
      need(
        !policy.stats.timestampRefusalNames.includes(s.name),
        "timestamps",
        "known-timestamp-corruption",
      );
    const proof = targetProof(target, scope, selector, work),
      displays = new Map(),
      states = new Map(),
      frameTypes = new Map();
    const reporterReferences = [];
    const coverage = {
      before: 0,
      inside: 0,
      after: 0,
      nonpositive: 0,
      unclosedNonpositive: 0,
      foreign: 0,
    };
    for (const n of target.nodes) {
      if (n.name !== "PipelineReporter") continue;
      work(n.args.length + 1);
      const stateArgs = n.args.filter((a) => a.key === "frame_reporter.state");
      reporterReferences.push({
        sliceId: n.id,
        startTs: n.ts.toString(),
        durationNs: n.dur.toString(),
        upid: n.upid,
        pid: n.pid,
        trackId: n.track,
        trackName: n.trackName,
        utid: n.utid,
        tid: n.tid,
        threadName: n.thread,
        classifications: n.args
          .filter((a) => a.key?.startsWith("frame_reporter."))
          .map((a) => ({
            key: a.key,
            type: a.type,
            intValue: a.i,
            stringValue: a.s,
            realValue: a.r,
          })),
      });
      const successful = stateArgs.some(
        (a) =>
          a.s === "STATE_PRESENTED_ALL" || a.s === "STATE_PRESENTED_PARTIAL",
      );
      for (const a of stateArgs) states.set(a.s, (states.get(a.s) ?? 0) + 1);
      for (const a of n.args.filter(
        (a) => a.key === "frame_reporter.frame_type",
      ))
        frameTypes.set(a.s, (frameTypes.get(a.s) ?? 0) + 1);
      if (!successful) {
        coverage.nonpositive++;
        if (n.dur < 0n) coverage.unclosedNonpositive++;
        continue;
      }
      // Reporter producer tracks are process-scoped. A missing thread context is
      // legitimate, but incomplete/conflicting process identity cannot justify
      // excluding a successful reporter from the selected imported lifetime.
      need(
        n.track !== null && n.upid !== null && n.pid !== null,
        "graph",
        "reporter-process-context",
      );
      if (n.upid === proof.start.upid) {
        need(n.pid === proof.start.pid, "graph", "reporter-process-conflict");
      } else {
        coverage.foreign++;
        continue;
      }
      const fields = new Set();
      for (const a of n.args) {
        work(1);
        if (a.key?.startsWith("frame_reporter.")) {
          need(!fields.has(a.key), "graph", "reporter-field-multiplicity");
          fields.add(a.key);
        }
      }
      const state = one(n, "frame_reporter.state", "string");
      const tree = treeId(one(n, "frame_reporter.layer_tree_host_id", "uint"));
      if (tree !== proof.tree) {
        coverage.foreign++;
        continue;
      }
      const terminal = endpoint(n);
      need(
        terminal >= target.bounds[0] && terminal <= target.bounds[1],
        "interval",
        "terminal-outside-bounds",
      );
      const display = traceId(one(n, "frame_reporter.display_trace_id", "int"));
      let event = displays.get(display);
      if (!event)
        displays.set(
          display,
          (event = {
            displayTraceId: display,
            terminalTs: terminal.toString(),
            reporters: [],
            aggregationReferences: [],
          }),
        );
      need(
        event.terminalTs === terminal.toString(),
        "interval",
        "conflicting-display-terminal",
      );
      event.reporters.push({
        sliceId: n.id,
        state,
        startTs: n.ts.toString(),
        durationNs: n.dur.toString(),
        terminalTs: terminal.toString(),
        treeId: tree,
        upid: n.upid,
        pid: n.pid,
        trackId: n.track,
        trackName: n.trackName,
        utid: n.utid,
        tid: n.tid,
        threadName: n.thread,
        arguments: n.args
          .filter((a) => a.present)
          .map((a) => ({
            flatKey: a.flat,
            key: a.key,
            type: a.type,
            intValue: a.i,
            stringValue: a.s,
            realValue: a.r,
          })),
      });
    }
    const inside = [];
    for (const e of displays.values()) {
      const ts = BigInt(e.terminalTs);
      if (ts < proof.start.ts) coverage.before++;
      else if (ts >= proof.end.ts) coverage.after++;
      else {
        coverage.inside++;
        inside.push(e);
      }
    }
    if (inside.length) {
      const graph = graphIndex(
        scope,
        proof,
        work,
        new Set(inside.map((e) => e.displayTraceId)),
      );
      for (const e of inside)
        e.aggregationReferences = contributionProof(
          e.displayTraceId,
          graph,
          work,
        );
    }
    inside.sort((a, b) =>
      tuple(
        [BigInt(a.terminalTs), BigInt(a.displayTraceId)],
        [BigInt(b.terminalTs), BigInt(b.displayTraceId)],
        work,
      ),
    );
    const duration = proof.end.ts - proof.start.ts,
      count = BigInt(inside.length),
      num = count * 1000000000n,
      divisor = gcd(num, duration);
    result.status = "observed";
    result.count = count.toString();
    result.interval = {
      startTs: proof.start.ts.toString(),
      endTs: proof.end.ts.toString(),
      durationNs: duration.toString(),
      membership: "terminal-in-[start,end)",
    };
    result.observedHz = {
      numerator: (num / divisor).toString(),
      denominator: (duration / divisor).toString(),
      unit: "s^-1",
      exact: true,
    };
    result.events = inside;
    Object.assign(result.coverage, {
      successfulDisplays: coverage,
      reporterReferences,
      reporterStates: Object.fromEntries(states),
      frameTypes: Object.fromEntries(frameTypes),
      outsideIntervalReporters: [...displays.values()]
        .filter(
          (e) =>
            BigInt(e.terminalTs) < proof.start.ts ||
            BigInt(e.terminalTs) >= proof.end.ts,
        )
        .map((e) => ({
          displayTraceId: e.displayTraceId,
          terminalTs: e.terminalTs,
          reporterIds: e.reporters.map((r) => r.sliceId),
        })),
      treeMappings: proof.mappings,
      frameReferences: proof.frameReferences,
    });
    outputCheck(result, work);
    return freeze(result);
  } catch (error) {
    const refusal = base();
    refusal.diagnostics = failureDiagnostics;
    refusal.stage = error instanceof Refusal ? error.stage : "input";
    refusal.reason =
      error instanceof Refusal ? error.reason : "unsupported-input"; // Fixed failure closure remains available even after the logical budget is exhausted.
    return freeze(refusal);
  }
}
