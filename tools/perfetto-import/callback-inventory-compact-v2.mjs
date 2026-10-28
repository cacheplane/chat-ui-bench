// Pure, bounded compact V2 interpretation. No filesystem, process or runtime imports.
const LIMITS = Object.freeze({input:262144,dictionary:16384,rows:32768,references:131072,cells:262144,slots:524288,textBytes:524288,work:4194304});
export const CALLBACK_COMPACT_V2_HEADERS = Object.freeze([["text_id","bytes_hex"],["name_text_id","event_count","arg_set_count"],["id","ts","dur","depth","parent_id","name_text_id","category_text_id","track_id","arg_set_id","track_name_text_id","utid","tid","upid","pid","process_name_text_id","thread_name_text_id","ts_is_null","dur_is_null","depth_is_null","parent_id_is_null","name_is_null","category_is_null","track_id_is_null","arg_set_id_is_null","track_name_is_null","utid_is_null","tid_is_null","upid_is_null","pid_is_null","process_name_is_null","thread_name_is_null"],["slice_id","arg_set_id","arg_set_id_is_null","arg_present","flat_key_text_id","key_text_id","value_type_text_id","int_value","string_value_text_id","real_value","flat_key_is_null","key_is_null","value_type_is_null","int_value_is_null","string_value_is_null","real_value_is_null"],["id","name_text_id","type_text_id","parent_id","machine_id","source_arg_set_id","dimension_arg_set_id","track_group_id","event_type_text_id","counter_unit_text_id","utid","upid","name_is_null","type_is_null","parent_id_is_null","machine_id_is_null","source_arg_set_id_is_null","dimension_arg_set_id_is_null","track_group_id_is_null","event_type_is_null","counter_unit_is_null","utid_is_null","upid_is_null"],["track_id","namespace_text_id","arg_set_id","arg_set_id_is_null","arg_present","flat_key_text_id","key_text_id","value_type_text_id","int_value","string_value_text_id","real_value","flat_key_is_null","key_is_null","value_type_is_null","int_value_is_null","string_value_is_null","real_value_is_null"],["name_text_id","idx","severity_text_id","source_text_id","value","name_is_null","idx_is_null","severity_is_null","source_is_null","value_is_null"],["start_ts","end_ts","start_ts_is_null","end_ts_is_null"]].map(h=>Object.freeze(h)));
const OWNED = new WeakMap();
function refuse(message) { throw new Error(`compact V2: ${message}`); }
function charge(s,n) { if(!Number.isSafeInteger(n)||n<0||s.work+n>LIMITS.work) refuse('logical work limit'); s.work+=n; }
function reserve(s,key,n,cap,label) { if(s[key]+n>cap) refuse(`${label} limit`); s[key]+=n; }
function freeze(s,value) {
  if(value===null||typeof value!=='object'||Object.isFrozen(value)) return value;
  charge(s,1);
  for(const key in value) { charge(s,1); freeze(s,value[key]); }
  return Object.freeze(value);
}
function csvRows(source,s) {
  // Input scan is reserved in full before any field copies or row allocation.
  charge(s,source.length*2);
  const rows=[];let row=[],cell='',state='start',started=false;
  const field=()=>{reserve(s,'cells',1,LIMITS.cells,'parsed cell');row.push(cell==='[NULL]'?null:cell);cell='';state='start';};
  const record=()=>{if(started){field();reserve(s,'records',1,LIMITS.rows+8,'total row');rows.push(row);}row=[];started=false;};
  for(let i=0;i<source.length;i++) {
    const c=source[i];
    if(state==='quoted') {
      if(c==='"'){if(source[i+1]==='"'){cell+='"';i++;}else state='closed';}else cell+=c;
    } else if(c===','){started=true;field();}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&source[++i]!=='\n')refuse('CSV CR requires LF');record();}
    else if(c==='"'){if(state!=='start')refuse('CSV quote position');state='quoted';started=true;}
    else {if(state==='closed')refuse('CSV text after quote');state='unquoted';started=true;cell+=c;}
  }
  if(state==='quoted')refuse('incomplete CSV quote');record();return rows;
}
function equalHeader(a,b,s) {
  charge(s,1);if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++){charge(s,1+(a[i]?.length??0)+b[i].length);if(a[i]!==b[i])return false;}
  return true;
}
const integer=/^-?(?:0|[1-9][0-9]*)$/;
const real=/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;
function numeric(s,key,value) {
  if(key.endsWith('_is_null')||key==='arg_present'){charge(s,1);if(value!=='0'&&value!=='1')refuse(`${key} flag`);return;}
  if(value===null)return;
  charge(s,value.length+1);
  if(key==='real_value'){if(value==='inf'||value==='-inf')return;if(!real.test(value)||!Number.isFinite(Number(value)))refuse('real numeric corruption');return;}
  if(value.length>21||!integer.test(value)||value==='-0')refuse(`${key} integer corruption`);
  const n=BigInt(value);if(n< -9223372036854775808n||n>18446744073709551615n)refuse(`${key} integer overflow`);
  if((key==='event_count'||key==='arg_set_count'||key==='id'||key.endsWith('_id')||['depth','utid','tid','upid','pid'].includes(key))&&n<0n)refuse(`${key} negative`);
}
export function parseCallbackInventoryCompactV2Csv(bytes) {
  if(!(bytes instanceof Uint8Array))refuse('input must be bytes');
  if(bytes.byteLength>LIMITS.input)refuse('input byte limit');
  const s={work:0,cells:0,records:0,references:0,slots:0,textBytes:0,dict:new Map(),raw:undefined,rawError:undefined,text:undefined,textError:undefined};
  charge(s,bytes.byteLength);
  const source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  const records=csvRows(source,s),tables=[];let cursor=0,totalRows=0;
  // Headers are ASCII and cannot be dictionary/data rows under the fixed schemas.
  for(let t=0;t<CALLBACK_COMPACT_V2_HEADERS.length;t++) {
    const header=CALLBACK_COMPACT_V2_HEADERS[t];charge(s,header.length);
    if(!records[cursor]||!equalHeader(records[cursor++],header,s))refuse(`table ${t} header`);
    const rows=[];
    while(cursor<records.length&&(t===7||!equalHeader(records[cursor],CALLBACK_COMPACT_V2_HEADERS[t+1],s))) {
      const cells=records[cursor++];if(cells.length!==header.length)refuse(`table ${t} row shape`);
      if(++totalRows>LIMITS.rows)refuse('total row limit');charge(s,header.length*2+1);
      const row=Object.create(null);for(let j=0;j<header.length;j++)row[header[j]]=cells[j];rows.push(row);
    }
    tables.push({header,rows});
  }
  if(cursor!==records.length)refuse('trailing CSV');
  if(tables[0].rows.length>LIMITS.dictionary)refuse('dictionary entry limit');
  let previous=null;
  for(let i=0;i<tables[0].rows.length;i++) {
    const row=tables[0].rows[i],hex=row.bytes_hex;
    charge(s,(row.text_id?.length??0)+(hex?.length??0)+1);
    if(row.text_id!==String(i+1))refuse('canonical contiguous dictionary ID');
    if(hex===null||! /^(?:[0-9A-F]{2})*$/.test(hex))refuse('canonical dictionary byte hex');
    if(previous!==null){charge(s,previous.length+hex.length+1);if(previous>=hex)refuse('dictionary byte order or duplicate');}
    previous=hex;s.dict.set(row.text_id,{hex,bytes:hex.length/2,used:false});
  }
  for(let t=1;t<tables.length;t++) for(const row of tables[t].rows) {
    for(const key of tables[t].header) {
      const value=row[key];charge(s,1);
      if(key.endsWith('_text_id')) {
        reserve(s,'references',1,LIMITS.references,'text reference');
        if(value!==null){charge(s,value.length+1);const entry=s.dict.get(value);if(!entry)refuse('unknown text reference');entry.used=true;}
      } else numeric(s,key,value);
      if(key.endsWith('_is_null')) {
        const base=key.slice(0,-8),column=Object.hasOwn(row,`${base}_text_id`)?`${base}_text_id`:base;
        if(!Object.hasOwn(row,column)||((row[column]===null)!==(value==='1')))refuse(`${key} NULL consistency`);
      }
      if(value===null&&!key.endsWith('_is_null')&&!Object.hasOwn(row,`${key.replace(/_text_id$/,'')}_is_null`))refuse(`${key} nonnullable`);
    }
    if(Object.hasOwn(row,'arg_present')&&row.arg_present==='0') for(const key of ['flat_key_text_id','key_text_id','value_type_text_id','int_value','string_value_text_id','real_value']) if(row[key]!==null)refuse('unmatched argument placeholder');
    if(t===5){charge(s,24);const namespace=s.dict.get(row.namespace_text_id).hex;if(namespace!=='736F75726365'&&namespace!=='64696D656E73696F6E')refuse('fixed track argument namespace');}
    if(row.arg_present==='1'&&row.arg_set_id===null)refuse('matched argument set must be nonNULL');
    if(t===6&&(row.value===null||row.value==='0'))refuse('nonzero stats value required (zero stats row)');
  }
  for(const entry of s.dict.values()){charge(s,1);if(!entry.used)refuse('unused dictionary value');}
  const parsed=freeze(s,{tables});OWNED.set(parsed,s);return parsed;
}
function owned(parsed) {
  const s=OWNED.get(parsed);if(!s)refuse('owned facade required');charge(s,1);return s;
}
function preflightView(s,tables,semantic) {
  let slots=tables.length,textBytes=0,refs=0;
  for(const table of tables) {
    charge(s,table.header.length+1);
    const textColumns=table.header.filter(k=>k.endsWith('_text_id'));
    const returnedWidth=table.header.length+(semantic?textColumns.length:0);
    slots+=table.rows.length*returnedWidth;
    // Header entries, row-array entries and the table's header/rows properties.
    slots+=returnedWidth+table.rows.length+2;
    for(const row of table.rows) {
      charge(s,table.header.length+textColumns.length+1);
      for(const key of textColumns){refs++;if(row[key]!==null)textBytes+=s.dict.get(row[key]).bytes*(semantic?2:1);}
    }
  }
  if(s.slots+slots>LIMITS.slots)refuse('returned field slot limit');
  if(s.textBytes+textBytes>LIMITS.textBytes)refuse('expanded text byte limit');
  // Reserve allocation, references, row/header construction and deep freezing in advance.
  charge(s,slots*3+refs+tables.reduce((n,t)=>n+t.rows.length*3+t.header.length*3+8,0));
  s.slots+=slots;s.textBytes+=textBytes;
}
export function expandCallbackInventoryCompactV2(parsed) {
  const s=owned(parsed);if(s.raw)return s.raw;if(s.rawError)throw s.rawError;
  try {
    charge(s,8);const input=parsed.tables.slice(1);preflightView(s,input,false);
    const tables=input.map(table=>({header:Object.freeze(table.header.map(k=>k.replace(/_text_id$/,'_bytes_hex'))),rows:table.rows.map(row=>{
      const result=Object.create(null);for(const key of table.header)result[key.replace(/_text_id$/,'_bytes_hex')]=key.endsWith('_text_id')?(row[key]===null?null:s.dict.get(row[key]).hex):row[key];return Object.freeze(result);
    })}));
    // The allocation prepayment above includes this traversal, so no second work charge.
    for(const table of tables){Object.freeze(table.rows);Object.freeze(table);}s.raw=Object.freeze(tables);return s.raw;
  }catch(error){s.rawError=error;throw error;}
}
export function decodeCallbackInventoryCompactV2Text(parsed) {
  const s=owned(parsed);if(s.text)return s.text;if(s.textError)throw s.textError;
  try {
    const raw=expandCallbackInventoryCompactV2(parsed);charge(s,8);const input=parsed.tables.slice(1);
    preflightView(s,input,true);
    let uniqueBytes=0;for(const entry of s.dict.values())uniqueBytes+=entry.bytes;
    charge(s,uniqueBytes*3+s.dict.size*2);
    const decoded=new Map(),decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
    for(const [id,entry]of s.dict)decoded.set(id,decoder.decode(Buffer.from(entry.hex,'hex')));
    const tables=input.map((table,t)=>({header:Object.freeze([...raw[t].header,...table.header.filter(k=>k.endsWith('_text_id')).map(k=>k.slice(0,-8))]),rows:table.rows.map((row,i)=>{
      const result=Object.assign(Object.create(null),raw[t].rows[i]);for(const key of table.header)if(key.endsWith('_text_id'))result[key.slice(0,-8)]=row[key]===null?null:decoded.get(row[key]);return Object.freeze(result);
    })}));
    for(const table of tables){Object.freeze(table.rows);Object.freeze(table);}s.text=Object.freeze(tables);return s.text;
  }catch(error){s.textError=error;throw error;}
}
