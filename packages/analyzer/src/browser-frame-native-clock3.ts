import {readNativeClock3PhaseTrace,readNativeClock3PhaseTraceV2} from './browser-frame-whole-trace-reader.js';
import {finishWholeAnnotationOutput} from './browser-frame-ordered-state.js';
import {SAME_TRACE_CLOCK3_INTERVAL_COMPATIBILITY} from './browser-frame-same-trace-interval.js';
export {NATIVE_CLOCK3_PHASE_POLICY,NATIVE_CLOCK3_PHASE_V2_POLICY} from './browser-frame-ordered-state.js';
type Compatibility={compatibility:{id:string;parserPin:string;interpretationPin:string;implementation:string}};
export function readNativeClock3PhaseAlignment(value:unknown,names:unknown,policy:unknown):ReturnType<typeof readNativeClock3PhaseTrace>&Compatibility{
 const result=readNativeClock3PhaseTrace(value,names,policy),c=SAME_TRACE_CLOCK3_INTERVAL_COMPATIBILITY;
 const compatibility={id:c.id,parserPin:c.parserPin,interpretationPin:c.interpretationPin,implementation:'reviewedClock3Phase'};
 try{return finishWholeAnnotationOutput({...result,compatibility});}
 catch{return finishWholeAnnotationOutput({...result,status:'unavailable',reason:'result-capacity',study:null,projection:null,compatibility});}
}

/** Explicit compact-evidence policy; never an automatic retry of the v1 reader. */
export function readNativeClock3PhaseAlignmentV2(value:unknown,names:unknown,policy:unknown):ReturnType<typeof readNativeClock3PhaseTraceV2>&Compatibility{
 const result=readNativeClock3PhaseTraceV2(value,names,policy),c=SAME_TRACE_CLOCK3_INTERVAL_COMPATIBILITY;
 const compatibility={id:c.id,parserPin:c.parserPin,interpretationPin:c.interpretationPin,implementation:'reviewedCompactEvidence'};
 try{return finishWholeAnnotationOutput({...result,compatibility});}
 catch{return finishWholeAnnotationOutput({...result,status:'unavailable',reason:'result-capacity',study:null,projection:null,compatibility});}
}
