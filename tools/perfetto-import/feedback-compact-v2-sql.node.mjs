import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';

const headers = {
  common: [
    ['text_id','text_hex','valid_text'],
    ['name_text_id','event_count','arg_set_count'],
    null,
    ['arg_set_id','arg_count','slice_count'],
    ['arg_set_id','flat_key_text_id','key_text_id','value_type_text_id','int_value','string_value_text_id','real_value'],
    ['name_text_id','flat_key_text_id','key_text_id','value_type_text_id','arg_occurrence_count','slice_count'],
    ['name_text_id','idx','severity_text_id','source_text_id','value'],
    ['start_ts','end_ts'],
    ['surface_frame_trace_id','display_trace_id'],
  ],
  target:['id','ts','dur','name_text_id','track_id','track_name_text_id','arg_set_id','utid','tid','upid','pid','process_name_text_id','thread_name_text_id'],
  scope:['id','ts','dur','depth','parent_id','is_selected','name_text_id','category_text_id','track_id','track_name_text_id','arg_set_id','utid','tid','upid','pid','process_name_text_id','thread_name_text_id','parent_status','duration_status'],
};

function fixture(reverse=false) {
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE slice(id INTEGER,ts INTEGER,dur INTEGER,depth INTEGER,parent_id INTEGER,name TEXT,category TEXT,track_id INTEGER,arg_set_id INTEGER);
    CREATE TABLE track(id INTEGER,name TEXT);
    CREATE TABLE thread_or_process_slice(id INTEGER,utid INTEGER,tid INTEGER,upid INTEGER,pid INTEGER,process_name TEXT,thread_name TEXT);
    CREATE TABLE args(arg_set_id INTEGER,flat_key TEXT,key TEXT,value_type TEXT,int_value INTEGER,string_value TEXT,real_value REAL);
    CREATE TABLE stats(name TEXT,idx INTEGER,severity TEXT,source TEXT,value INTEGER);
    CREATE TABLE trace_bounds(start_ts INTEGER,end_ts INTEGER);
    CREATE TABLE chrome_surface_frame_id_to_first_display_id(surface_frame_trace_id INTEGER,display_trace_id INTEGER);`);
  const slices=[
    [1,100,20,0,null,'PipelineReporter','',1,100],
    [2,100,-1,1,5,'Graphics.Pipeline','[NULL]',1,100],
    [3,110,0,2,5,'MainFrame.Draw',null,2,200],
    [4,120,-2,2,5,'phase\'quoted','a"b',2,100],
    [5,90,80,1,10,'context-only','ancestor\nUTF8🙂',3,900],
    [6,121,0,0,null,'BeginFrame','',4,300],
    [7,122,0,0,null,'phase\'quoted',null,999,null],
    [8,123,0,1,999,'DrawFrame','',1,201],
    [10,80,90,0,5,'context-cycle','',3,900],
    [9007199254740995n,124,0,0,null,'phase\'quoted','',1,100],
    [11,125,0,0,null,'SetLayerTreeId','',1,400],
    [12,126,0,0,null,'unselected','',1,999],
    [13,127,0,0,null,'phase\'quoted','',1,202],
  ];
  const args=[
    [100,'x','quote"key','int',9007199254740995n,null,null],
    [100,'x','quote"key','int',9007199254740995n,null,null],
    [100,null,null,null,null,null,null],
    [100,'empty','','string',null,'',null],
    [100,'literal','literal','string',null,'[NULL]',null],
    [100,'unicode','unicode','string',null,'a"\n🙂\u0000tail',null],
    [100,'real','real','real',null,null,1.2345678901234567],
    [100,'negative','negative','real',null,null,-1.2345678901234567e100],
    [300,null,null,null,null,null,null],
    [400,'id','id','int',-9223372036854775808n,null,null],
    [900,'never-expand','never-expand','string',null,'context-only-secret',null],
    [999,'never-export','never-export','string',null,'unselected-secret',null],
  ];
  for(const row of reverse?slices.toReversed():slices)db.prepare('INSERT INTO slice VALUES(?,?,?,?,?,?,?,?,?)').run(...row);
  for(const row of reverse?args.toReversed():args)db.prepare('INSERT INTO args VALUES(?,?,?,?,?,?,?)').run(...row);
  db.exec(`INSERT INTO track VALUES(1,'track"quoted'),(2,''),(3,'[NULL]'),(4,NULL);
    INSERT INTO thread_or_process_slice VALUES(1,7,70,8,80,'','[NULL]'),(2,7,70,8,80,'proc','thread');
    INSERT INTO stats VALUES('nonzero',0,'error','trace',3),('zero',1,'info','trace',0),(NULL,2,NULL,'',-2);
    INSERT INTO trace_bounds VALUES(0,200);
    INSERT INTO chrome_surface_frame_id_to_first_display_id VALUES(100,200),(100,200),(101,201);`);
  return db;
}

async function execute(db,name) {
  const source=await readFile(new URL(name,import.meta.url),'utf8');
  const sql=source.replace(/^INCLUDE PERFETTO MODULE[^;]+;/mg,'').replace(/^--.*$/mg,'').replaceAll('CREATE PERFETTO ','CREATE ').replaceAll('__PHASE_LITERALS__',"'phase''quoted'");
  const tables=[];
  for(const part of sql.split(';')) {
    const statement=part.trim();if(!statement)continue;
    const q=db.prepare(statement),columns=q.columns().map(x=>x.name);q.setReadBigInts(true);
    if(columns.length)tables.push({headers:columns,rows:q.all().map(x=>({...x}))});else q.run();
  }
  return {source,tables};
}
function dictionary(tables) {
  return new Map([[0n,null],...tables[0].rows.map(r=>[r.text_id,Buffer.from(r.text_hex,'hex').toString('utf8')])]);
}
function raw(tables) {
  const dict=dictionary(tables);
  const decode=row=>Object.fromEntries(Object.entries(row).map(([k,v])=>k.endsWith('_text_id')?[k.slice(0,-8),dict.get(v)]:[k,v]));
  const slices=tables[2].rows.map(decode).map(r=>({...r,...(Object.hasOwn(r,'parent_status')?{parent_status:['no_parent','parent_present','missing_parent'][Number(r.parent_status)],duration_status:['nonnegative','unclosed','other_negative'][Number(r.duration_status)]}:{})}));
  const args=tables[4].rows.map(decode).map(r=>({...r,real_value:r.real_value===null?null:Number(r.real_value)}));
  const expanded=[];
  for(const s of slices.filter(s=>s.is_selected===undefined||s.is_selected===1n)) {
    const found=args.filter(a=>s.arg_set_id!==null&&a.arg_set_id===s.arg_set_id);
    for(const a of found.length?found:[{flat_key:null,key:null,value_type:null,int_value:null,string_value:null,real_value:null}])expanded.push({slice_id:s.id,name:s.name,arg_set_id:s.arg_set_id,arg_present:found.length?1n:0n,flat_key:a.flat_key,key:a.key,value_type:a.value_type,int_value:a.int_value,string_value:a.string_value,real_value:a.real_value});
  }
  return {slices,expanded,dims:tables[5].rows.map(decode),census:tables[1].rows.map(decode),stats:tables[6].rows.map(decode),bounds:tables[7].rows,derived:tables[8].rows};
}
function oldRaw(tables,kind) {
  const unquote=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!k.endsWith('_is_null')&&k!=='arg_key_id').map(([k,v])=>[k,typeof v==='string'?v.replaceAll('""','"'):v]));
  const dims=tables[3].rows.map(unquote);
  const expanded=tables[2].rows.map(r=>{
    if(kind==='target')return unquote(r);
    const d=tables[3].rows.find(d=>d.arg_key_id===r.arg_key_id);
    return unquote({...d,...r,arg_occurrence_count:undefined,slice_count:undefined});
  }).map(r=>Object.fromEntries(Object.entries(r).filter(([,v])=>v!==undefined)));
  return {census:tables[0].rows.map(unquote),slices:tables[1].rows.map(unquote),expanded,dims,stats:tables[4].rows.map(unquote),bounds:tables[5].rows,...(kind==='target'?{derived:tables[6].rows}:{})};
}
const canonical=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?{bigint:v.toString()}:v);
const multiset=rows=>rows.map(r=>canonical(Object.fromEntries(Object.entries(r).sort()))).sort();

for(const kind of ['target','scope']) {
  test(`${kind} exact nine-table compact SQL inverse preserves every old logical population`,async()=>{
    const db=fixture(),old=fixture();try {
      const compact=await execute(db,`feedback-${kind}-compact-v2.sql`),legacy=await execute(old,kind==='target'?'target-inventory.sql':'scope-inventory.sql');
      assert.deepEqual(compact.tables.map(t=>t.headers),headers.common.map((h,i)=>i===2?headers[kind]:h));
      const actual=raw(compact.tables),expected=oldRaw(legacy.tables,kind);
      for(const key of Object.keys(expected))assert.deepEqual(multiset(actual[key]),multiset(expected[key]),key);
      for(const key of ['census','slices','expanded','stats','bounds'])assert.deepEqual(actual[key],expected[key],`${key} order`);
      assert.deepEqual(actual.derived,[{surface_frame_trace_id:100n,display_trace_id:200n},{surface_frame_trace_id:100n,display_trace_id:200n},{surface_frame_trace_id:101n,display_trace_id:201n}]);
      assert.equal(actual.expanded.filter(a=>a.arg_set_id===100n&&a.flat_key==='x').length,kind==='target'?8:6);
      assert.ok(compact.tables[3].rows.some(r=>r.arg_count===0n&&r.slice_count===1n));
      assert.ok(actual.expanded.some(a=>a.arg_present===0n));
      assert.ok(actual.expanded.some(a=>a.arg_present===1n&&a.flat_key===null));
      assert.ok(![...dictionary(compact.tables).values()].includes('unselected-secret'));
      assert.ok(![...dictionary(compact.tables).values()].includes('context-only-secret'));
      assert.doesNotMatch(compact.source,/\bLIMIT\b|\bOFFSET\b|\bLIKE\b|\bGLOB\b/i);
    } finally {db.close();old.close();}
  });
  test(`${kind} dictionary is complete deterministic byte-sorted and flags non-text collisions`,async()=>{
    const db=fixture(),reversed=fixture(true);try{
      const a=await execute(db,`feedback-${kind}-compact-v2.sql`),b=await execute(reversed,`feedback-${kind}-compact-v2.sql`);
      assert.deepEqual(a.tables,b.tables);
      const dict=a.tables[0].rows;
      assert.deepEqual(dict.map(r=>r.text_id),dict.map((_,i)=>BigInt(i+1)));
      assert.deepEqual(dict.map(r=>r.text_hex),dict.map(r=>r.text_hex).toSorted());
      const refs=new Set();for(const t of a.tables.slice(1))for(const r of t.rows)for(const [k,v] of Object.entries(r))if(k.endsWith('_text_id')&&v!==0n)refs.add(v);
      assert.deepEqual([...refs].sort((a,b)=>Number(a-b)),dict.map(r=>r.text_id));
      assert.ok(dict.some(r=>r.text_hex===''));assert.ok(dict.some(r=>r.text_hex===Buffer.from('[NULL]').toString('hex').toUpperCase()));
      const bad=fixture();try{bad.exec("INSERT INTO args VALUES(100,'bad','bad','string',NULL,x'5B4E554C4C5D',NULL),(100,'invalid','invalid','string',NULL,CAST(x'80' AS TEXT),NULL)");
        const c=await execute(bad,`feedback-${kind}-compact-v2.sql`);
        assert.equal(c.tables[0].rows.find(r=>r.text_hex==='5B4E554C4C5D').valid_text,0n);
        assert.equal(c.tables[0].rows.find(r=>r.text_hex==='80').valid_text,1n);
      }finally{bad.close();}
    }finally{db.close();reversed.close();}
  });
}

test('authored repeated-set export exceeds old physical cap while complete compact export fits unchanged cap',async()=>{
  const db=fixture(),old=fixture();try{
    for(const d of [db,old]){
      const q=d.prepare('INSERT INTO slice VALUES(?,?,0,0,NULL,\'PipelineReporter\',\'\',1,100)');
      for(let i=0;i<500;i++)q.run(1000+i,1000+i);
    }
    const a=await execute(db,'feedback-target-compact-v2.sql'),b=await execute(old,'target-inventory.sql');
    const csv=tables=>tables.map(t=>[t.headers,...t.rows.map(r=>t.headers.map(h=>r[h]))].map(row=>row.map(x=>x===null?'[NULL]':typeof x==='string'?`"${x}"`:String(x)).join(',')).join('\n')+'\n').join('');
    assert.ok(Buffer.byteLength(csv(b.tables))>262144);
    assert.ok(Buffer.byteLength(csv(a.tables))<=262144);
    assert.deepEqual(raw(a.tables).expanded,oldRaw(b.tables,'target').expanded);
    assert.equal(a.tables[3].rows.find(r=>r.arg_set_id===100n).slice_count,504n);
  }finally{db.close();old.close();}
});
