// Authored resource-boundary graphs only. No trace records or execution authority.
import {authoredGraph,argument} from './feedback-observations-fixtures.mjs';
import {exportCompactGraphV2} from './feedback-observations-compact-fixtures-v2.mjs';

export function authoredCapacityArguments(count,{value='0',type='int',nodeName='SetLayerTreeId'}={}) {
 const graph=authoredGraph(),node=graph.nodes.find(n=>n.name===nodeName);
 for(let i=0;i<count;i++)node.args.push(argument('authored_unknown',type,value));
 return graph;
}

// Independent occurrence meter mirrors only the published wire's text-reference definition.
export function authoredLogicalTextBytes(role) {
 const {tables:t,headers:h}=role,dict=new Map(t[0].map(r=>[r[0],Buffer.from(r[1],'hex').length]));
 const ref=id=>id==='0'?0:dict.get(id);
 let bytes=0;
 for(const i of [1,2,5,6])for(const row of t[i])for(let j=0;j<h[i].length;j++)if(h[i][j].endsWith('_text_id'))bytes+=ref(row[j]);
 const args=new Map();for(const r of t[4]){if(!args.has(r[0]))args.set(r[0],[]);args.get(r[0]).push(r);}
 const scope=h[2].includes('is_selected'),set=h[2].indexOf('arg_set_id'),name=h[2].indexOf('name_text_id');
 for(const r of t[2]){if(scope&&r[h[2].indexOf('is_selected')]!=='1')continue;const rows=args.get(r[set])??[];bytes+=ref(r[name])*Math.max(1,rows.length);for(const a of rows)for(const j of [1,2,3,5])bytes+=ref(a[j]);}
 return bytes;
}

export function authoredExactLogicalTextGraph(limit) {
 const count=8192,graph=authoredCapacityArguments(count,{type:'string',value:''}),node=graph.nodes.find(n=>n.name==='SetLayerTreeId');
 node.args.push(argument('authored_adjustment','string',''));
 const baseline=authoredLogicalTextBytes(exportCompactGraphV2(graph).target),per=Math.floor((limit-baseline)/count),remainder=limit-baseline-per*count;
 for(const a of node.args)if(a.key==='authored_unknown')a.s='x'.repeat(per);
 node.args.at(-1).s='y'.repeat(remainder);
 return graph;
}
