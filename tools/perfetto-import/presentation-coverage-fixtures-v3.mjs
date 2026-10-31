// Maintained authored uint64 protobuf only; no external input or file reads.
import {authoredCoverageProtobufV1} from './presentation-coverage-fixtures-v1.mjs';
import {authoredDenseCoverageProtobufV2} from './presentation-coverage-fixtures-v2.mjs';
export const AUTHORED_UINT64_BOUNDARIES=Object.freeze(['0','1','9007199254740991','9007199254740992','9223372036854775807','9223372036854775808','9223372036854775809','18446744073709551614','18446744073709551615']);
export async function authoredUint64CoverageProtobufV3(dense=false){
 if(typeof dense!=='boolean')throw Error('authored-fixture-mode');
 const {join:concat,uint,body,text,tag}=await import('../../packages/analyzer/src/browser-frame-packet-fragments.test-helper.ts');
 const packet=(...fields)=>body(1,concat(uint(10,1n),...fields));
 const annotation=(name,field,value)=>concat(text(10,name),uint(field,value));
 const U=1n<<64n,real=Buffer.alloc(8);real.writeDoubleLE(1.25);
 const extras=[annotation('boundary-int-minus-one',4,U-1n),annotation('boundary-int-min',4,1n<<63n),annotation('boundary-int-max',4,(1n<<63n)-1n),annotation('boundary-bool',2,1n),annotation('boundary-pointer',7,U-1n),concat(text(10,'boundary-real'),tag(5,1),real),concat(text(10,'boundary-string'),text(6,'literal,[NULL]'))];
 const packets=[dense?await authoredDenseCoverageProtobufV2(12000):await authoredCoverageProtobufV1()];
 for(let i=0;i<AUTHORED_UINT64_BOUNDARIES.length;i++){
  const value=BigInt(AUTHORED_UINT64_BOUNDARIES[i]),uuid=value===0n?2n:value;
  packets.push(packet(body(60,concat(uint(1,uuid),uint(5,90n),text(2,'uint-probe-'+String(i).padStart(2,'0'))))));
  packets.push(packet(uint(8,BigInt(30000+i)),uint(58,64n),body(11,concat(uint(9,3n),uint(11,uuid),text(22,'cc'),text(23,'BeginFrame'),body(4,annotation('boundary-uint-'+String(i).padStart(2,'0'),3,value)),...(i===0?extras.map(a=>body(4,a)):[])))));
 }
 return Buffer.from(concat(...packets));
}
