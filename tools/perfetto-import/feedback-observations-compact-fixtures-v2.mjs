// Authored encoder only. This module supplies no execution or capture origin.
import { exportGraph, targetHeaders, scopeHeaders, csv } from './feedback-observations-fixtures.mjs';
export const compactHeadersV2 = kind => [
 ['text_id','text_hex','valid_text'], ['name_text_id','event_count','arg_set_count'],
 (kind==='scope'?'id,ts,dur,depth,parent_id,is_selected,name_text_id,category_text_id,track_id,track_name_text_id,arg_set_id,utid,tid,upid,pid,process_name_text_id,thread_name_text_id,parent_status,duration_status':'id,ts,dur,name_text_id,track_id,track_name_text_id,arg_set_id,utid,tid,upid,pid,process_name_text_id,thread_name_text_id').split(','),
 ['arg_set_id','arg_count','slice_count'],['arg_set_id','flat_key_text_id','key_text_id','value_type_text_id','int_value','string_value_text_id','real_value'],
 ['name_text_id','flat_key_text_id','key_text_id','value_type_text_id','arg_occurrence_count','slice_count'],['name_text_id','idx','severity_text_id','source_text_id','value'],['start_ts','end_ts'],['surface_frame_trace_id','display_trace_id']
];
export function encodeCompactLogicalV2(logical,kind,derived=[]){
 const old=kind==='scope'?scopeHeaders:targetHeaders, objects=logical.map((table,i)=>table.map(row=>Object.fromEntries(old[i].map((k,j)=>[k,row[j]]))));
 const [census,slices,args,dims,stats,bounds]=objects,sets=new Map(),dimById=new Map(dims.map(r=>[r.arg_key_id,r]));
 for(const r of slices)if(kind!=='scope'||r.is_selected==='1'){if(r.arg_set_id!==null&&!sets.has(r.arg_set_id))sets.set(r.arg_set_id,{count:0,args:[]});if(r.arg_set_id!==null)sets.get(r.arg_set_id).count++;}
 const seen=new Set();for(const slice of slices){if(kind==='scope'&&slice.is_selected!=='1'||slice.arg_set_id===null||seen.has(slice.arg_set_id))continue;seen.add(slice.arg_set_id);sets.get(slice.arg_set_id).args=args.filter(a=>a.slice_id===slice.id&&a.arg_present==='1').map(a=>({...a,...(kind==='scope'?{flat_key:dimById.get(a.arg_key_id)?.flat_key,key:dimById.get(a.arg_key_id)?.key,value_type:dimById.get(a.arg_key_id)?.value_type}:{})}));}
 const headers=compactHeadersV2(kind), tables=Array.from({length:9},()=>[]),text=new Set(),add=v=>{if(v!==null&&v!==undefined)text.add(Buffer.from(v).toString('hex').toUpperCase());};
 for(const r of census)add(r.name);for(const r of slices)for(const k of ['name','category','track_name','process_name','thread_name'])if(Object.hasOwn(r,k))add(r[k]);for(const set of sets.values())for(const a of set.args)for(const k of ['flat_key','key','value_type','string_value'])add(a[k]);for(const r of dims)for(const k of ['name','flat_key','key','value_type'])add(r[k]);for(const r of stats)for(const k of ['name','severity','source'])add(r[k]);
 const dictionary=[...text].sort(),ids=new Map(dictionary.map((s,i)=>[s,String(i+1)])),ref=v=>v===null||v===undefined?'0':ids.get(Buffer.from(v).toString('hex').toUpperCase());tables[0]=dictionary.map((s,i)=>[String(i+1),s,'1']);
 const field=(r,k)=>k.endsWith('_text_id')?ref(r[k.slice(0,-8)]):k==='parent_status'?String(['no_parent','parent_present','missing_parent'].indexOf(r[k])):k==='duration_status'?String(['nonnegative','unclosed','other_negative'].indexOf(r[k])):r[k];
 tables[1]=census.map(r=>headers[1].map(k=>field(r,k)));tables[2]=slices.map(r=>headers[2].map(k=>field(r,k)));
 for(const [id,set]of [...sets].sort((a,b)=>BigInt(a[0])<BigInt(b[0])?-1:1)){tables[3].push([id,String(set.args.length),String(set.count)]);for(const a of set.args)tables[4].push(headers[4].map(k=>k==='arg_set_id'?id:field(a,k)));}
 tables[5]=dims.map(r=>headers[5].map(k=>field(r,k)));tables[6]=stats.map(r=>headers[6].map(k=>field(r,k)));tables[7]=bounds.map(r=>headers[7].map(k=>r[k]));tables[8]=kind==='target'?logical[6]:derived;
 return {tables,headers,bytes:csv(tables,headers)};
}
export function exportCompactGraphV2(graph){const legacy=exportGraph(graph);return {target:encodeCompactLogicalV2(legacy.targetTables,'target'),scope:encodeCompactLogicalV2(legacy.scopeTables,'scope',legacy.targetTables[6]),legacy};}
