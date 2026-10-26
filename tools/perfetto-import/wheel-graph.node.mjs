import {test} from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./wheel-graph.mjs').catch(()=>({}));
const headers=[
 'name,event_count,arg_set_count',
 'id,ts,dur,depth,parent_id,is_selected,name,category,track_id,track_name,arg_set_id,utid,tid,upid,pid,process_name,thread_name,parent_status,duration_status,parent_id_is_null,name_is_null,category_is_null,track_name_is_null,process_name_is_null,thread_name_is_null',
 'slice_id,arg_key_id,arg_set_id,arg_present,int_value,string_value,real_value,int_value_is_null,string_value_is_null,real_value_is_null',
 'arg_key_id,name,flat_key,key,value_type,arg_occurrence_count,slice_count,flat_key_is_null,key_is_null,value_type_is_null',
 'name,idx,severity,source,value,name_is_null,severity_is_null,source_is_null','start_ts,end_ts',
].map(s=>s.split(','));
const families=['LatencyInfo.Flow','WidgetBaseInputHandler::OnHandleInputEvent','EventDispatch','InputLatency::MouseWheel','EventLatency'];
const phases=['native:native-wheel-carrier-v1:history100-up:start:0123456789abcdef','native:native-wheel-carrier-v1:history100-up:end:fedcba9876543210'];
const marker='native-wheel-witness-v1:00000000000000000000000000000000:0:1';
const binary=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
const nc=(a,b)=>a===null?(b===null?0:-1):b===null?1:binary(a,b);
const selected=n=>families.includes(n.name)||phases.includes(n.name)||n.name?.startsWith('native-wheel-witness-v1:');
function fixture(){
 const node=(id,ts,dur,depth,parent_id,name,arg_set_id=null)=>({id:String(id),ts:String(ts),dur:String(dur),depth:String(depth),parent_id:parent_id===null?null:String(parent_id),name,arg_set_id,category:'blink.user_timing',track_id:'1',track_name:'main',utid:'2',tid:'3',upid:'4',pid:'5',process_name:'renderer',thread_name:'CrRendererMain'});
 return {nodes:[node(1,10,80,0,null,'outer'),node(2,20,0,0,null,phases[0]),node(3,30,40,1,1,families[1],'100'),node(4,35,20,2,3,families[0],'101'),node(5,36,10,3,4,families[2]),node(6,40,0,4,5,marker),node(7,80,0,0,null,phases[1])],args:[
  {slice_id:'3',flat_key:'debug.event',key:'debug.event',value_type:'string',int_value:null,string_value:'MouseWheel',real_value:null},
  {slice_id:'4',flat_key:'chrome_latency_info.step',key:'chrome_latency_info.step',value_type:'string',int_value:null,string_value:'STEP_HANDLE_INPUT_EVENT_MAIN',real_value:null},
  {slice_id:'4',flat_key:'chrome_latency_info.trace_id',key:'chrome_latency_info.trace_id',value_type:'int',int_value:'-9223372036854775808',string_value:null,real_value:null},
 ],stats:[],bounds:[['0','100']]};
}
function tables(f){
 const nodes=f.nodes.toSorted((a,b)=>BigInt(a.ts)<BigInt(b.ts)?-1:BigInt(a.ts)>BigInt(b.ts)?1:BigInt(a.id)<BigInt(b.id)?-1:1);
 const names=[...new Set([...families,...phases,...nodes.filter(selected).map(n=>n.name)])].sort(binary);
 const counts=names.map(name=>[name,String(nodes.filter(n=>selected(n)&&n.name===name).length),String(new Set(nodes.filter(n=>selected(n)&&n.name===name&&n.arg_set_id!==null).map(n=>n.arg_set_id)).size)]);
 const rows=nodes.map(n=>[n.id,n.ts,n.dur,n.depth,n.parent_id,selected(n)?'1':'0',n.name,n.category,n.track_id,n.track_name,n.arg_set_id,n.utid,n.tid,n.upid,n.pid,n.process_name,n.thread_name,n.parent_id===null?'no_parent':nodes.some(p=>p.id===n.parent_id)?'parent_present':'missing_parent',n.dur==='-1'?'unclosed':BigInt(n.dur)<0n?'other_negative':'nonnegative',...['parent_id','name','category','track_name','process_name','thread_name'].map(k=>n[k]===null?'1':'0')]);
 const args=[];
 for(const n of nodes.filter(selected)){
  const own=f.args.filter(a=>a.slice_id===n.id);
  args.push(...(own.length?own.map(a=>({...a,arg_set_id:n.arg_set_id,arg_present:'1',name:n.name})): [{slice_id:n.id,name:n.name,arg_set_id:n.arg_set_id,arg_present:'0',flat_key:null,key:null,value_type:null,int_value:null,string_value:null,real_value:null}]));
 }
 const group=a=>JSON.stringify([a.name,a.flat_key,a.key,a.value_type]);
 const dictionary=[...new Map(args.map(a=>[group(a),a])).values()].sort((a,b)=>binary(a.name,b.name)||nc(a.flat_key,b.flat_key)||nc(a.key,b.key)||nc(a.value_type,b.value_type));
 const ids=new Map(dictionary.map((a,i)=>[group(a),String(i+1)]));
 const dictionaryRows=dictionary.map((a,i)=>{const own=args.filter(v=>group(v)===group(a));return [String(i+1),a.name,a.flat_key,a.key,a.value_type,String(own.filter(v=>v.arg_present==='1').length),String(new Set(own.map(v=>v.slice_id)).size),...['flat_key','key','value_type'].map(k=>a[k]===null?'1':'0')];});
 const ns=new Map(nodes.map(n=>[n.id,n]));
 const argsRows=args.sort((a,b)=>{const x=ns.get(a.slice_id),y=ns.get(b.slice_id);return BigInt(x.ts)<BigInt(y.ts)?-1:BigInt(x.ts)>BigInt(y.ts)?1:BigInt(x.id)<BigInt(y.id)?-1:BigInt(x.id)>BigInt(y.id)?1:nc(a.flat_key,b.flat_key)||nc(a.key,b.key)||nc(a.value_type,b.value_type)||(a.int_value===null?(b.int_value===null?0:-1):b.int_value===null?1:BigInt(a.int_value)<BigInt(b.int_value)?-1:BigInt(a.int_value)>BigInt(b.int_value)?1:0)||nc(a.string_value,b.string_value)||nc(a.real_value,b.real_value);}).map(a=>[a.slice_id,ids.get(group(a)),a.arg_set_id,a.arg_present,a.int_value,a.string_value,a.real_value,...['int_value','string_value','real_value'].map(k=>a[k]===null?'1':'0')]);
 return [counts,rows,argsRows,dictionaryRows,f.stats,f.bounds];
}
const cell=x=>x===null?'"[NULL]"':'"'+String(x).replaceAll('"','""')+'"';
const serialize=(t,ending='\n')=>Buffer.from(t.map((rows,i)=>[headers[i],...rows].map(r=>r.map(cell).join(',')).join(ending)).join(ending+ending)+ending);
const parse=(f=fixture())=>api.parseWheelCarrierCsvV1(serialize(tables(f)),{phases});
const evaluate=p=>api.evaluateWheelCarrierGraphV1(p,{phaseNames:phases,markerName:marker});
function authority(r){for(const k of ['nativeSupported','qualification','captureQualified','fpsEligibility','evaluationEligibility','scoringEligibility','rankingEligibility'])assert.equal(r[k],false,k);for(const k of ['fps','rate','latency','duration'])assert.equal(r[k],null,k);assert.equal(r.inputOrigin,'caller-supplied-csv');}
test('graph exposes pure parser and evaluator, valid negative-ID parent graph stays diagnostic',()=>{
 assert.equal(typeof api.parseWheelCarrierCsvV1,'function');assert.equal(typeof api.evaluateWheelCarrierGraphV1,'function');
 const parsed=parse();assert.equal(parsed.status,'wheel-csv-parsed',parsed.reason);assert.ok(Object.isFrozen(parsed));
 const r=evaluate(parsed);assert.equal(r.status,'imported-wheel-parent-graph-consistent',r.reason);authority(r);assert.equal(r.witness.traceId,'-9223372036854775808');assert.deepEqual(r.witness.ancestorIds,['5','4','3','1']);
 assert.deepEqual(r.witness.ancestorEdges,[{childId:'6',parentId:'5'},{childId:'5',parentId:'4'},{childId:'4',parentId:'3'},{childId:'3',parentId:'1'},{childId:'1',parentId:null}]);assert.ok(Object.isFrozen(r.witness.ancestorEdges));assert.ok(r.witness.ancestorEdges.every(Object.isFrozen));
 assert.equal(evaluate({...parsed}).status,'unavailable');assert.equal(evaluate({}).status,'unavailable');
});
test('graph rejects malformed complete CSV and invalid byte/options admission without invoking getters',()=>{
 assert.equal(typeof api.parseWheelCarrierCsvV1,'function');const good=serialize(tables(fixture()));
 const bad=[Buffer.from([0xff]),Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),good]),Buffer.concat([good,Buffer.from('trailing')]),Buffer.from('"unclosed'),Buffer.from('bad"quote\n'),Buffer.from('"closed"suffix\n'),Buffer.from('x\ry'),Buffer.alloc(262145),new DataView(new ArrayBuffer(1)),new Proxy(good,{})];
 for(const b of bad)assert.equal(api.parseWheelCarrierCsvV1(b,{phases}).status,'unavailable');
 let called=0;const getter={get phases(){called++;return phases;}};
 for(const options of [getter,{phases,extra:1},new Proxy({phases},{}),{phases:new Proxy(phases,{})},{phases:['same','same']}])assert.equal(api.parseWheelCarrierCsvV1(good,options).status,'unavailable');
 assert.equal(called,0);assert.equal(api.parseWheelCarrierCsvV1(new Uint8Array(good),{phases}).status,'wheel-csv-parsed');
 const altered=Buffer.from(good);Object.defineProperty(altered,'byteLength',{get(){called++;return 1;}});assert.equal(api.parseWheelCarrierCsvV1(altered,{phases}).status,'unavailable');assert.equal(called,0);
 assert.equal(api.parseWheelCarrierCsvV1(serialize(tables(fixture()),'\r\n'),{phases}).status,'wheel-csv-parsed');
});
test('graph whole-file relational admission refuses contradictions before marker selection',()=>{
 assert.equal(typeof api.parseWheelCarrierCsvV1,'function');
 const mutations=[t=>t[0][0][1]='999',t=>t[0].reverse(),t=>t[1][0][0]='01',t=>t[1][0][0]='9223372036854775808',t=>t[1][0][19]='0',t=>t[1][0][5]='1',t=>t[2][0][1]='999',t=>t[2][0][3]='1',t=>t[3][0][0]='2',t=>t[3][0][5]='999',t=>t[3].push(t[3][0]),t=>t[5].push(['0','1']),t=>t[5][0]=['100','0']];
 for(const [i,mutate]of mutations.entries()){const t=tables(fixture());mutate(t);assert.equal(api.parseWheelCarrierCsvV1(serialize(t),{phases}).status,'unavailable',String(i));}
});
test('graph preserves text quoting, NULL distinctions and full typed channel algebra',()=>{
 assert.equal(typeof api.parseWheelCarrierCsvV1,'function');
 const f=fixture();let n=1;
 for(const [type,int,string,real] of [['int','9007199254740993',null,null],['uint','-1',null,null],['pointer','-1',null,null],['bool','1',null,null],['string',null,'',null],['string',null,'[NULL]',null],['string',null,'quote"é🧪,\nline\r\nend',null],['json',null,'{"x":1}',null],['real',null,null,'1.25'],['null',null,null,null],[null,null,null,null]])f.args.push({slice_id:'5',flat_key:'key'+n,key:'key'+n++,value_type:type,int_value:int,string_value:string,real_value:real});
 f.nodes.find(n=>n.id==='5').arg_set_id='102';assert.equal(parse(f).status,'wheel-csv-parsed');
 for(const [type,int,string,real]of [['bool','2',null,null],['int',null,'42',null],['uint',null,null,'42'],['string',null,null,null],['alien',null,'x',null],['null','1',null,null],['real',null,null,'Infinity']]){const g=fixture();Object.assign(g.args[2],{value_type:type,int_value:int,string_value:string,real_value:real});assert.equal(parse(g).status,'unavailable');}
});
test('graph typed required arguments reject duplicates, aliases and sentinel IDs',()=>{
 assert.equal(typeof api.parseWheelCarrierCsvV1,'function');
 const mutations=[f=>f.args.push({...f.args[2]}),f=>f.args.push({...f.args[1]}),f=>f.args.push({...f.args[0]}),f=>f.args[2].value_type='uint',f=>f.args[2].value_type='pointer',f=>Object.assign(f.args[2],{value_type:'string',int_value:null,string_value:'-9223372036854775808'}),f=>Object.assign(f.args[2],{value_type:'real',int_value:null,real_value:'1.5'}),f=>Object.assign(f.args[2],{value_type:'bool',int_value:'1'}),f=>f.args[2].int_value='-1',f=>f.args[2].key='alias',f=>f.args[1].string_value='HANDLE_INPUT_EVENT_MAIN',f=>f.args[0].string_value='MouseMove'];
 for(const mutate of mutations){const f=fixture();mutate(f);const p=parse(f);assert.equal(p.status,'wheel-csv-parsed',p.reason);assert.equal(evaluate(p).status,'unavailable');}
});
test('graph never repairs unsafe ancestry or extra witnesses using nearby events',()=>{
 assert.equal(typeof api.parseWheelCarrierCsvV1,'function');
 const mutations=[f=>f.nodes[5].parent_id=null,f=>f.nodes[5].parent_id='999',f=>f.nodes[0].parent_id='6',f=>f.nodes[3].track_id='9',f=>f.nodes[3].depth='7',f=>f.nodes[3].dur='-1',f=>f.nodes[3].dur='1',f=>f.nodes[5].category='other',f=>f.nodes[5].thread_name='Other',f=>f.nodes[1].ts='50',f=>f.nodes.push({...f.nodes[5],id:'8',ts:'95',parent_id:null,depth:'0'}),f=>f.nodes[3].name='other',f=>f.nodes[4].name='LatencyInfo.Flow',f=>f.nodes[4].name='WidgetBaseInputHandler::OnHandleInputEvent'];
 for(const mutate of mutations){const f=fixture();mutate(f);const p=parse(f);assert.equal(p.status,'wheel-csv-parsed',p.reason);assert.equal(evaluate(p).status,'unavailable');}
});
test('graph expectation keys, phase ownership and carrier are exact',()=>{
 assert.equal(typeof api.parseWheelCarrierCsvV1,'function');const p=parse();let called=0;
 for(const options of [{phaseNames:phases,markerName:marker,relaxed:true},{get phaseNames(){called++;return phases;},markerName:marker},{phaseNames:[phases[0],phases[0]],markerName:marker},{phaseNames:phases,markerName:marker.replace(':0:1',':0:2')},new Proxy({phaseNames:phases,markerName:marker},{})])assert.equal(api.evaluateWheelCarrierGraphV1(p,options).status,'unavailable');
 assert.equal(called,0);
});
test('graph retains every supported nonzero stat label without granting completeness',()=>{
 assert.equal(typeof api.parseWheelCarrierCsvV1,'function');const f=fixture();
 f.stats=['info','notice','data_loss','error'].map((s,i)=>['stat'+i,null,s,i%2?'trace':'analysis',String(i+1),'0','0','0']);
 const p=parse(f);assert.equal(p.status,'wheel-csv-parsed',p.reason);assert.equal(p.statsAdmission,'not_evaluated');assert.equal(evaluate(p).status,'imported-wheel-parent-graph-consistent');
 f.stats[0][1]='-1';assert.equal(parse(f).status,'wheel-csv-parsed');
 for(const key of [2,3]){const t=tables(f);t[4][0][key]='unknown';assert.equal(api.parseWheelCarrierCsvV1(serialize(t),{phases}).status,'unavailable');}
});
test('graph handles UTF8 binary dictionary order, shared argument sets and matched NULL accounting',()=>{
 const f=fixture();f.nodes.push({...f.nodes[3],id:'8',ts:'90',depth:'0',parent_id:null,dur:'0'});
 f.args.push(...f.args.filter(a=>a.slice_id==='4').map(a=>({...a,slice_id:'8'})));
 const p=parse(f);assert.equal(p.status,'wheel-csv-parsed',p.reason);assert.equal(evaluate(p).status,'imported-wheel-parent-graph-consistent');
 f.args.find(a=>a.slice_id==='8'&&a.value_type==='int').int_value='4';assert.equal(parse(f).status,'unavailable');
 const g=fixture();g.nodes[4].arg_set_id='102';g.args.push({slice_id:'5',flat_key:null,key:null,value_type:null,int_value:null,string_value:null,real_value:null});
 g.nodes.push({...g.nodes[4],id:'8',ts:'90',depth:'0',parent_id:null,dur:'0',arg_set_id:null});
 assert.equal(parse(g).status,'wheel-csv-parsed');
 const h=fixture();h.nodes[4].arg_set_id='103';for(const key of ['\uE000','🧪','A','a'])h.args.push({slice_id:'5',flat_key:key,key,value_type:'string',int_value:null,string_value:key,real_value:null});
 const t=tables(h);assert.equal(api.parseWheelCarrierCsvV1(serialize(t),{phases}).status,'wheel-csv-parsed');
 const dictionary=t[3].filter(r=>r[1]==='EventDispatch');assert.deepEqual(dictionary.map(r=>r[3]),['A','a','\uE000','🧪']);
 [dictionary[2][0],dictionary[3][0]]=[dictionary[3][0],dictionary[2][0]];assert.equal(api.parseWheelCarrierCsvV1(serialize(t),{phases}).status,'unavailable');
});
test('graph enforces exact cell/byte/stat caps and withdraws after a valid prefix',()=>{
 const f=fixture();f.nodes[4].arg_set_id='102';const arg={slice_id:'5',flat_key:'text',key:'text',value_type:'string',int_value:null,string_value:'x'.repeat(16384),real_value:null};f.args.push(arg);
 assert.equal(parse(f).status,'wheel-csv-parsed');arg.string_value+='x';assert.equal(parse(f).status,'unavailable');
 arg.string_value='🧪'.repeat(4096);assert.equal(parse(f).status,'wheel-csv-parsed');arg.string_value+='🧪';assert.equal(parse(f).status,'unavailable');
 const stat=fixture();stat.stats=Array.from({length:1024},(_,i)=>['s'+String(i).padStart(4,'0'),null,'info','analysis','1','0','0','0']);assert.equal(parse(stat).status,'wheel-csv-parsed');stat.stats.push(['s1024',null,'info','analysis','1','0','0','0']);assert.equal(parse(stat).status,'unavailable');
 const good=serialize(tables(fixture()));assert.equal(api.parseWheelCarrierCsvV1(Buffer.concat([good,Buffer.alloc(262144-good.length,10)]),{phases}).status,'wheel-csv-parsed');assert.equal(api.parseWheelCarrierCsvV1(Buffer.concat([good,Buffer.alloc(262145-good.length,10)]),{phases}).status,'unavailable');
 const t=tables(fixture());t[4]=[['later_error',null,'error','analysis','1','0','0','0']];t[5].push(['0','1']);const refused=api.parseWheelCarrierCsvV1(serialize(t),{phases});assert.equal(refused.status,'unavailable');assert.equal(evaluate(refused).witness,null);
});
test('graph preserves IDs beyond Number precision and does not accept canonical numeric aliases',()=>{
 const f=fixture();f.nodes[3].id='9007199254740993';f.nodes[4].parent_id='9007199254740993';for(const a of f.args)if(a.slice_id==='4')a.slice_id='9007199254740993';
 const r=evaluate(parse(f));assert.equal(r.status,'imported-wheel-parent-graph-consistent');assert.equal(r.witness.flowId,'9007199254740993');
 for(const value of ['+1','01','-0','1e3',' 1','9223372036854775808','-9223372036854775809']){const g=fixture();g.args[2].int_value=value;assert.equal(parse(g).status,'unavailable',value);}
});
test('graph refuses ancestor timestamps outside reported trace bounds',()=>{
 for(const mutate of [f=>{f.nodes[0].ts='-1';f.nodes[0].dur='101';},f=>{f.nodes[0].dur='91';},f=>{const offset=(1n<<63n)-101n;for(const n of f.nodes)n.ts=String(BigInt(n.ts)+offset);f.bounds=[[String(offset),String(offset+100n)]];f.nodes[0].dur='91';}]){
  const f=fixture();mutate(f);const p=parse(f);assert.equal(p.status,'wheel-csv-parsed',p.reason);assert.equal(evaluate(p).status,'unavailable');
 }
});
test('graph structural row ceilings refuse before semantic table admission',()=>{
 for(const [index,count,width]of [[0,4097,3],[2,8193,10],[3,4097,10]]){
  const t=tables(fixture());t[index]=Array.from({length:count},()=>Array(width).fill(''));
  const bytes=serialize(t);assert.ok(bytes.length<=262144);const result=api.parseWheelCarrierCsvV1(bytes,{phases});assert.equal(result.status,'unavailable');assert.equal(result.reason,'table-row-limit');
 }
});
test('graph exposes frozen exact stats and bounds snapshots without accepting them as ownership',()=>{
 const f=fixture();f.stats=[['error',null,'error','analysis','9007199254740993','0','0','0'],['literal','-1','notice','trace','-9223372036854775808','0','0','0'],[null,null,null,null,'1','1','1','1']];
 f.stats.sort((a,b)=>nc(a[0],b[0]));const p=parse(f);assert.equal(p.status,'wheel-csv-parsed',p.reason);
 assert.ok(Object.isFrozen(p.stats));assert.ok(p.stats.every(Object.isFrozen));assert.ok(Object.isFrozen(p.traceBounds));
 assert.deepEqual(p.stats,[{name:null,idx:null,severity:null,source:null,value:'1'},{name:'error',idx:null,severity:'error',source:'analysis',value:'9007199254740993'},{name:'literal',idx:'-1',severity:'notice',source:'trace',value:'-9223372036854775808'}]);
 assert.deepEqual(p.traceBounds,{start_ts:'0',end_ts:'100'});assert.equal(p.statsAdmission,'not_evaluated');
 assert.throws(()=>p.stats.push({}));assert.throws(()=>p.stats[0].value='0');assert.throws(()=>p.traceBounds.end_ts='0');assert.equal(evaluate({...p,stats:[]}).status,'unavailable');
});
