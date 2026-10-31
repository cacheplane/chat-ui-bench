// Finite authored stress only. No capture/cohort path or bytes are accepted.
import {basicCoverageGraph,slice,arg,track,authoredCoverageProtobufV1} from './presentation-coverage-fixtures-v1.mjs';
function countOf(count){if(!Number.isSafeInteger(count)||count<1||count>32768)throw Error('authored-count');return count;}
export function denseCoverageGraphV2(count=12000){
 countOf(count);const g=basicCoverageGraph();g.tracks.push(track('2','FrameSequenceTrackerV3'));
 g.slices.push(slice(4,'FrameSequenceTrackerV3',[arg('debug.name','WheelScroll')],{track_id:'2',track_name:'FrameSequenceTrackerV3',ts:'2000',dur:String(count*2+2)}));
 for(let i=0;i<count;i++)g.slices.push(slice(i+5,'Frame ',[arg('debug.data.values.expected',i)],{track_id:'2',track_name:'FrameSequenceTrackerV3',ts:String(2001+i*2),dur:'1',parent_id:'4',depth:'1'}));
 return g;
}
export async function authoredDenseCoverageProtobufV2(count=12000){
 countOf(count);
 const {join:concat,uint,body,text}=await import('../../packages/analyzer/src/browser-frame-packet-fragments.test-helper.ts');
 const packet=(...fields)=>body(1,concat(uint(10,1n),...fields));
 const annotation=(name,value)=>concat(text(10,name),value);
 const integer=(name,value)=>annotation(name,uint(4,value));
 const dict=(name,entries)=>annotation(name,concat(...entries.map(entry=>body(11,entry))));
 const event=(type,name,ts,entries=[])=>packet(uint(8,ts),uint(58,64n),body(11,concat(uint(9,type),uint(11,95n),text(22,'cc'),...(name===null?[]:[text(23,name)]),...entries.map(entry=>body(4,entry)))));
 const packets=[await authoredCoverageProtobufV1(),packet(body(60,concat(uint(1,95n),uint(5,94n),text(2,'FrameSequenceTrackerV3')))),event(1n,'FrameSequenceTrackerV3',2000n)];
 // Repeated identical argument sets exercise source deduplication followed by
 // all per-slice counter observations. Distinct sets remain a separate core
 // fixture; this smoke does not promise their official SQL completes in 60s.
 for(let i=0;i<count;i++)packets.push(event(1n,'Frame ',BigInt(2001+i*2)),event(2n,null,BigInt(2002+i*2),[dict('data',[dict('values',[integer('expected',1n)])])]));
 packets.push(event(2n,null,BigInt(2002+count*2)));
 return Buffer.from(concat(...packets));
}
