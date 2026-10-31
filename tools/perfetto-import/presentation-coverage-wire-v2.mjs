// Pure fixed-schema reader. Tokens carry bounded work, never execution authority.
import {
  types
}
from 'node:util';
import model from './presentation-coverage-source-model-v2.json' with {
  type:'json'
};
// Fixed source-pinned policy bootstrap precedes any caller graph/work account.
function freezePolicy(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezePolicy(child);
    Object.freeze(value);
  }
  return value;
}
freezePolicy(model);
export const PRESENTATION_COVERAGE_HEADERS_V2=Object.freeze(model.sql.headers.map(h=>Object.freeze([...h])));
const L=model.limits,accounts=new WeakMap(),parsed=new WeakMap();
const intrinsicByteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'byteLength').get;
const intrinsicSet = Uint8Array.prototype.set;
const intrinsicBuffer = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'buffer').get;
const intrinsicResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable').get;
const intrinsicDetached = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached').get;
const need=(ok,reason)=>{
  if(!ok)throw Error(reason);
};
export function createPresentationCoverageAccountV2(){
  const token=Object.freeze({
  });
  accounts.set(token,{
    left:L.work,failed:false
  });
  return token;
}
export function chargePresentationCoverageWorkV2(token,n){
  const a=accounts.get(token);
  need(a,'invalid-work-account');
  if(!Number.isSafeInteger(n)||n<0||a.failed||n>a.left){
    a.failed=true;
    throw Error('logical-work-limit');
  }
  a.left-=n;
}
export function inspectPresentationCoverageWireV2(original){
  const p=parsed.get(original);
  need(p,'original-wire-required');
  chargePresentationCoverageWorkV2(p.account,1);
  return p.view;
}
export function parsePresentationCoverageCSVV2(bytes,account){
  const pay=n=>chargePresentationCoverageWorkV2(account,n);
  pay(1);
  need(!types.isProxy(bytes)&&bytes instanceof Uint8Array,'csv-bytes');
  const buffer = intrinsicBuffer.call(bytes);
  need(!types.isSharedArrayBuffer(buffer) && !intrinsicResizable.call(buffer) && !intrinsicDetached.call(buffer), 'unsupported-byte-buffer');
  const byteLength = intrinsicByteLength.call(bytes);
  need(byteLength<=L.csvBytes,'csv-byte-limit');
  pay(byteLength*3);
  const retained = new Uint8Array(byteLength);
  intrinsicSet.call(retained, bytes);
  const source=new TextDecoder('utf-8',{
    fatal:true,ignoreBOM:true
  }).decode(retained);
  need(!source.startsWith('\uFEFF'),'csv-bom');
  const records=[];
  let row=[],cell='',mode='start',started=false;
  const field=()=>{
    pay(cell.length*3+1);
    need(Buffer.byteLength(cell)<=L.cellBytes,'csv-cell-limit');
    pay(cell.length+1);
    row.push(cell==='[NULL]'?null:cell);
    need(row.length<=L.columns,'csv-column-limit');
    cell='';
    mode='start';
  };
  const record=()=>{
    if(started){
      field();
      records.push(row);
      need(records.length<=L.rows+13,'csv-row-limit');
    }
    row=[];
    started=false;
  };
  for(let i=0;
  i<source.length;
  i++){
    const c=source[i];
    if(mode==='quoted'){
      if(c==='"'){
        if(source[i+1]==='"'){
          cell+='"';
          i++;
        }
        else mode='closed';
      }
      else cell+=c;
    }
    else if(c===','){
      started=true;
      field();
    }
    else if(c==='\n'||c==='\r'){
      if(c==='\r')need(source[++i]==='\n','csv-cr');
      record();
    }
    else if(c==='"'){
      need(mode==='start','csv-quote');
      mode='quoted';
      started=true;
    }
    else{
      need(mode!=='closed','csv-after-quote');
      cell+=c;
      mode='unquoted';
      started=true;
    }
    need(cell.length<=L.cellBytes,'csv-cell-limit');
  }
  need(mode!=='quoted','csv-incomplete-quote');
  record();
  let pos=0;
  const equal=(a,b)=>{
    pay((a?.length??0)+b.length+1);
    return a?.length===b.length&&a.every((v,i)=>v===b[i]);
  };
  const tables=[];
  for(let t=0;
  t<13;
  t++){
    const h=PRESENTATION_COVERAGE_HEADERS_V2[t];
    need(equal(records[pos++],h),'csv-header');
    const rows=[];
    while(pos<records.length&&(t===12||!equal(records[pos],PRESENTATION_COVERAGE_HEADERS_V2[t+1]))){
      const cells=records[pos++];
      need(cells.length===h.length,'csv-row-width');
      pay(cells.length*3+1);
      const r=Object.create(null);
      for(let j=0;
      j<h.length;
      j++)r[h[j]]=cells[j];
      rows.push(r);
    }
    tables.push(rows);
  }
  need(pos===records.length,'csv-trailing');
  need(tables[0].length<=L.dictionaryEntries&&tables[2].length<=L.slices&&tables[5].length<=L.tracks&&tables[9].length+tables[10].length<=L.identities&&tables[4].length+tables[8].length<=L.arguments&&tables[3].length+tables[6].length+tables[7].length<=L.references&&tables[11].length<=L.stats,'graph-row-limit');
  const dict=new Map(),decoder=new TextDecoder('utf-8',{
    fatal:true,ignoreBOM:true
  });
  let previous=null,totalText=0,referencedText=0,nodes=records.length,edges=0;
  for(let i=0;
  i<tables[0].length;
  i++){
    const r=tables[0][i],h=r.text_hex;
    pay((h?.length??0)*3+1);
    need(r.text_id===String(i+1)&&r.valid_text==='1'&&typeof h==='string'&&/^(?:[0-9A-F]{2})*$/.test(h)&&(previous===null||h>previous),'dictionary-canonical');
    totalText+=h.length/2;
    need(totalText<=L.dictionaryBytes,'dictionary-byte-limit');
    dict.set(r.text_id,{
      text:decoder.decode(Buffer.from(h,'hex')),bytes:h.length/2,used:false
    });
    previous=h;
  }
  const textKeys=new Set(PRESENTATION_COVERAGE_HEADERS_V2.flat().filter(k=>k.endsWith('_text_id')));
  for(let t=1;
  t<13;
  t++)for(const r of tables[t]){
    nodes++;
    for(const[k,v]of Object.entries(r)){
      edges++;
      pay(3+(v?.length??0)*4);
      if(textKeys.has(k)){
        need(v!==null,'text-null-id');
        if(v!==null&&v!=='0'){
          const d=dict.get(v);
          need(d,'dictionary-reference');
          d.used=true;
          referencedText+=d.bytes;
          need(referencedText<=L.referencedTextBytes,'referenced-text-limit');
          r[k.slice(0,-8)]=d.text;
          nodes++;
          edges++;
        }
        else {
          r[k]=null;
          r[k.slice(0,-8)]=null;
        }
      }
      else if(k==='real_value'){
        if(v!==null)need(v==='inf'||v==='-inf'||(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(v)&&Number.isFinite(Number(v))),'real-value');
      }
      else if(v!==null){
        need(v.length<=21&&/^(?:0|-?[1-9][0-9]*)$/.test(v),'integer-canonical');
        const n=BigInt(v);
        need(n>=-9223372036854775808n&&n<=(k==='int_value'?18446744073709551615n:9223372036854775807n),'integer-range');
        if(!['ts','dur','start_ts','end_ts','int_value','value','idx'].includes(k))need(n>=0n,'unsigned-field');
      }
    }
    need(nodes<=L.nodes&&edges<=L.edges,'logical-graph-limit');
    for (const key of model.fieldPolicies.requiredColumns[t]) {
      pay(1);
      need(r[key] !== null, t === 9 ? 'process-required-field' : 'required-wire-field');
    }
  }
  function compareCell(a, b, key) {
    pay(2 + (a?.length ?? 0) + (b?.length ?? 0));
    if (a === b) return 0;
    if (a === null) return -1;
    if (b === null) return 1;
    if (key === 'real_value') {
      const numeric = value => value === 'inf' ? Infinity : value === '-inf' ? -Infinity : Number(value);
      return numeric(a) < numeric(b) ? -1 : 1;
    }
    return BigInt(a) < BigInt(b) ? -1 : 1;
  }
  for (let ti = 1; ti < tables.length; ti++) {
    const keys = model.fieldPolicies.rowOrder[ti];
    for (let i = 1; i < tables[ti].length; i++) {
      let comparison = 0;
      for (const key of keys) {
        comparison = compareCell(tables[ti][i - 1][key], tables[ti][i][key], key);
        if (comparison) break;
      }
      need(comparison <= 0, 'row-order');
    }
  }
  for(const d of dict.values()){
    pay(1);
    need(d.used,'unused-dictionary-entry');
  }
  need(tables[12].length===1&&tables[12][0].start_ts!==null&&tables[12][0].end_ts!==null&&BigInt(tables[12][0].start_ts)<=BigInt(tables[12][0].end_ts),'trace-bounds');
  const freeze=v=>{
    if(v&&typeof v==='object'){
      // Arrays are privately constructed dense arrays. Decoded own-data rows
      // have at most 32 fields, including added decoded text fields.
      const width=Array.isArray(v)?v.length:L.columns;
      pay(width+1);
      const values=Object.values(v);
      need(values.length<=width,'wire-freeze-width');
      pay(values.length+1);
      for(const x of values)freeze(x);
      // This native freeze scans again after recursion; its fresh reservation
      // also includes an array's non-enumerable builtin length property.
      pay(values.length+2);
      Object.freeze(v);
    }
    return v;
  };
  freeze(tables);
  pay(4);
  const facade=Object.freeze({
    schema:'presentation-coverage-compact-v1',rows:records.length-13
  });
  pay(4);
  const view=Object.freeze({tables,account});
  parsed.set(facade,{bytes:retained, account, view});
  return facade;
}
