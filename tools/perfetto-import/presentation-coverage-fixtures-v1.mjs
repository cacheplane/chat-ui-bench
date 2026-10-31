// Maintained authored CSV only. No capture files or native execution.
export const HEADERS = [
 ['text_id','text_hex','valid_text'],['name_text_id','event_count','arg_set_count'],
 ['id','ts','dur','depth','parent_id','is_seed','name_text_id','category_text_id','track_id','arg_set_id','utid','tid','upid','pid','track_name_text_id','process_name_text_id','thread_name_text_id'],
 ['arg_set_id','arg_count','slice_count'],['arg_set_id','flat_key_text_id','key_text_id','value_type_text_id','int_value','string_value_text_id','real_value'],
 ['id','name_text_id','type_text_id','parent_id','machine_id','source_arg_set_id','dimension_arg_set_id','track_group_id','event_type_text_id','counter_unit_text_id','utid','upid'],
 ['track_id','namespace_text_id','arg_set_id'],['arg_set_id','arg_count','reference_count'],['arg_set_id','flat_key_text_id','key_text_id','value_type_text_id','int_value','string_value_text_id','real_value'],
 ['upid','pid','name_text_id'],['utid','tid','upid','name_text_id'],['name_text_id','idx','severity_text_id','source_text_id','value'],['start_ts','end_ts']
];
export const FAMILIES=['FrameSequenceTrackerV3','FrameSequenceTracker','PipelineReporter','Graphics.Pipeline','Graphics.Pipeline.DrawAndSwap','Display::FrameDisplayed','BeginFrame','SetLayerTreeId','TracingStartedInBrowser','FrameCommittedInBrowser','FrameDeletedInBrowser','ProcessReadyInBrowser','MainFrame.Draw','Scheduler::BeginFrame','Scheduler::BeginImplFrame','DrawFrame'];
export const SELECTOR=JSON.stringify({target:{frameId:'frame',loaderId:'loader'},phaseNames:{start:'start',end:'end'}});
export function authoredCoverageGraph(){return {slices:[],tracks:[],args:[],trackArgs:[],processes:[],threads:[],stats:[],bounds:['0','10000000000']};}
export function slice(id,name,args=[],extra={}){return {id:String(id),ts:'1',dur:'0',depth:'0',parent_id:null,is_seed:FAMILIES.includes(name)||name==='start'||name==='end'?'1':'0',name,category:'cc',track_id:'1',arg_set_id:args.length?String(id):null,utid:null,tid:null,upid:'1',pid:'42',track_name:'authored',process_name:'Renderer',thread_name:null,args,...extra};}
export function arg(key,value,type=typeof value==='string'?'string':'int'){return {flat_key:key,key,value_type:type,int_value:type==='int'||type==='uint'?String(value):null,string_value:type==='string'?value:null,real_value:type==='real'?String(value):null};}
export function track(id='1',name='authored',extra={}){return {id,name,type:'process_track',parent_id:null,machine_id:null,source_arg_set_id:null,dimension_arg_set_id:null,track_group_id:null,event_type:null,counter_unit:null,utid:null,upid:'1',...extra};}
export function basicCoverageGraph(){const g=authoredCoverageGraph();g.tracks.push(track());g.processes.push({upid:'1',pid:'42',name:'Renderer'});g.slices.push(slice(1,'SetLayerTreeId',[arg('debug.data.frame','frame'),arg('debug.data.layerTreeId',7)]),slice(2,'start',[arg('debug.data.navigationId','loader')],{category:'blink.user_timing',ts:'100'}),slice(3,'end',[arg('debug.data.navigationId','loader')],{category:'blink.user_timing',ts:'9000000100'}));return g;}
export function encodeCoverageGraph(g){
 const tables=HEADERS.map(()=>[]),text=new Set([...FAMILIES,'start','end','source','dimension']);
 const remember=row=>{for(const[k,v]of Object.entries(row))if(v!==null&&typeof v==='string'&&['name','category','track_name','process_name','thread_name','type','event_type','counter_unit','flat_key','key','value_type','string_value','namespace','severity','source'].includes(k))text.add(v);};
 for(const r of [...g.slices,...g.tracks,...g.processes,...g.threads,...g.stats,...g.trackArgs])remember(r);for(const s of g.slices)for(const a of s.args)remember(a);
 const dict=[...text].map(s=>[Buffer.from(s).toString('hex').toUpperCase(),s]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0),ids=new Map(dict.map(([h,s],i)=>[s,String(i+1)]));tables[0]=dict.map(([h],i)=>[String(i+1),h,'1']);
 const row=(i,r)=>HEADERS[i].map(k=>k.endsWith('_text_id')?r[k.slice(0,-8)]===null||r[k.slice(0,-8)]===undefined?'0':ids.get(r[k.slice(0,-8)]):r[k]??null);
 for(const name of [...FAMILIES,'start','end']){const ss=g.slices.filter(s=>s.name===name);tables[1].push([ids.get(name),String(ss.length),String(new Set(ss.map(s=>s.arg_set_id).filter(x=>x!==null)).size)]);}
 const sets=new Map();for(const s of g.slices){const tr=g.tracks.find(t=>t.id===s.track_id),is_seed=FAMILIES.includes(s.name)||s.name==='start'||s.name==='end'||['FrameSequenceTrackerV3','FrameSequenceTracker'].includes(tr?.name)?'1':'0';tables[2].push(row(2,{...s,is_seed}));if(s.arg_set_id!==null){const old=sets.get(s.arg_set_id);if(old)old.refs++;else sets.set(s.arg_set_id,{args:s.args,refs:1});}}
 for(const[id,v]of sets){tables[3].push([id,String(v.args.length),String(v.refs)]);for(const a of v.args)tables[4].push(row(4,{arg_set_id:id,...a}));}
 for(const t of g.tracks){tables[5].push(row(5,t));for(const namespace of ['source','dimension'])tables[6].push([t.id,ids.get(namespace),t[namespace+'_arg_set_id']]);}
 const refs=new Map();for(const t of g.tracks)for(const key of ['source_arg_set_id','dimension_arg_set_id'])if(t[key]!==null)refs.set(t[key],(refs.get(t[key])??0)+1);
 for(const[id,n]of refs){const args=g.trackArgs.filter(a=>a.arg_set_id===id);tables[7].push([id,String(args.length),String(n)]);for(const a of args)tables[8].push(row(8,a));}
 for(const r of g.processes)tables[9].push(row(9,r));for(const r of g.threads)tables[10].push(row(10,r));for(const r of g.stats)tables[11].push(row(11,r));tables[12].push(g.bounds);
 const orders=[['text_id'],['name_text_id'],['ts','id'],['arg_set_id'],['arg_set_id','flat_key_text_id','key_text_id','value_type_text_id','int_value','string_value_text_id','real_value'],['id'],['track_id','namespace_text_id'],['arg_set_id'],['arg_set_id','flat_key_text_id','key_text_id','value_type_text_id','int_value','string_value_text_id','real_value'],['upid'],['utid'],['name_text_id','idx'],['start_ts','end_ts']];
 const number=v=>v==='inf'?Infinity:v==='-inf'?-Infinity:Number(v);
 for(let ti=0;ti<tables.length;ti++)tables[ti].sort((a,b)=>{for(const k of orders[ti]){const j=HEADERS[ti].indexOf(k),av=a[j],bv=b[j];if(av===bv)continue;if(av===null)return-1;if(bv===null)return 1;if(k==='real_value')return number(av)<number(bv)?-1:1;return BigInt(av)<BigInt(bv)?-1:1;}return 0;});
 const cell=v=>v===null?'[NULL]':/[",\r\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':v;
 return Buffer.from(tables.map((rows,i)=>[HEADERS[i],...rows].map(r=>r.map(cell).join(',')).join('\n')).join('\n')+'\n');
}

// Authored protobuf using the same pinned TrackEvent/DebugAnnotation field
// numbers as maintained smoke.mjs. This constructs bytes; it reads no files.
export async function authoredCoverageProtobufV1() {
  const {authoredClockFixture} = await import('./smoke.mjs');
  // Reuse the maintained inert packet encoder, including its uint64 bounds.
  const {join:concat,uint,body,text} = await import('../../packages/analyzer/src/browser-frame-packet-fragments.test-helper.ts');
  const packet = (...fields) => body(1, concat(uint(10, 1n), ...fields));
  const annotation = (name, value) => concat(text(10, name), value);
  const string = (name, value) => annotation(name, text(6, value));
  const integer = (name, value) => annotation(name, uint(4, value));
  const dict = (name, entries) => annotation(name, concat(...entries.map(entry => body(11, entry))));
  const array = (name, entries) => annotation(name, concat(...entries.map(entry => body(12, entry))));
  const event = (type, name, ts, track, annotations = [], extra = Buffer.alloc(0), category = 'cc') => packet(
    uint(8, ts), uint(58, 64n), body(11, concat(uint(9, type), uint(11, track),
      text(22, category), ...(name === null ? [] : [text(23, name)]),
      ...annotations.map(entry => body(4, entry)), extra)));
  return Buffer.from(concat(
    authoredClockFixture(),
    packet(body(60, concat(uint(1, 90n), body(3, concat(uint(1, 42n), text(6, 'Renderer')))))),
    packet(body(60, concat(uint(1, 91n), body(4, concat(uint(1, 42n), uint(2, 43n), text(5, 'CrRendererMain')))))),
    packet(body(60, concat(uint(1, 92n), uint(5, 91n), text(2, 'authored-renderer')))),
    // An intermediate named parent avoids importer flattening directly under
    // the process root, and has no events of its own: SQL must retain it by
    // parent-track closure. Existing pinned TrackDescriptor parent_uuid=5.
    packet(body(60, concat(uint(1, 94n), uint(5, 90n), text(2, 'authored-tracker-parent')))),
    packet(body(60, concat(uint(1, 93n), uint(5, 94n), text(2, 'FrameSequenceTrackerV3')))),
    event(3n, 'SetLayerTreeId', 1100n, 92n, [dict('data', [string('frame', 'frame'), integer('layerTreeId', 7n)])]),
    event(3n, 'start', 1101n, 92n, [dict('data', [string('navigationId', 'loader')]), string('empty', ''), string('literalNull', '[NULL]')], Buffer.alloc(0), 'blink.user_timing'),
    event(1n, 'FrameSequenceTrackerV3', 1102n, 93n, [string('name', 'WheelScroll')]),
    event(1n, 'Frame ', 1103n, 93n, [array('repeated', [string('', 'a'), string('', 'a')])]),
    event(2n, null, 1104n, 93n, [dict('data', [dict('values', [integer('sequence_number', 1n), integer('last_sequence', 0n), integer('expected', 1n), integer('dropped_v3', 0n), integer('dropped_v4', 0n)])])]),
    event(2n, null, 1105n, 93n, [dict('args', [dict('data', [integer('expected', 1n), integer('dropped_v3', 0n)])])]),
    event(3n, 'Graphics.Pipeline', 1106n, 92n, [], body(1052, concat(uint(1, 10n), uint(3, 123n), uint(8, 43n)))),
    event(3n, 'Graphics.Pipeline', 1107n, 92n), // Deliberate missing step/ID.
    event(3n, 'Display::FrameDisplayed', 1108n, 92n),
    event(3n, 'end', 1109n, 92n, [dict('data', [string('navigationId', 'loader')])], Buffer.alloc(0), 'blink.user_timing'),
  ));
}
