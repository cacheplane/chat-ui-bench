import {readNativeClock3PhaseTrace} from './browser-frame-whole-trace-reader.js';
import {finishWholeAnnotationOutput} from './browser-frame-ordered-state.js';
import {SAME_TRACE_CLOCK3_INTERVAL_COMPATIBILITY} from './browser-frame-same-trace-interval.js';
export {NATIVE_CLOCK3_PHASE_POLICY} from './browser-frame-ordered-state.js';
export function readNativeClock3PhaseAlignment(value:unknown,names:unknown,policy:unknown){
 const result=readNativeClock3PhaseTrace(value,names,policy),c=SAME_TRACE_CLOCK3_INTERVAL_COMPATIBILITY;
 const compatibility={id:c.id,parserPin:c.parserPin,interpretationPin:c.interpretationPin,implementation:'reviewedClock3Phase'};
 try{return finishWholeAnnotationOutput({...result,compatibility});}
 catch{return finishWholeAnnotationOutput({...result,status:'unavailable',reason:'result-capacity',study:null,projection:null,compatibility});}
}
