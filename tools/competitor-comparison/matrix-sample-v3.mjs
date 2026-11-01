import {observeMatrixDOM} from './matrix-observer-v3.mjs';

/** Bind maintained observer source in Node, without browser eval or a closure.
 * SDK state and selected DOM are read in one synchronous browser task, so an
 * arriving source task cannot advance the response between these observations.
 */
export function createMatrixSampleEvaluator(){
 return new Function('options', `
  "use strict";
  const observe = (${observeMatrixDOM.toString()});
  const api = window.competitorBench;
  if (!api || typeof api.readResponse !== 'function' || typeof api.readProgress !== 'function') throw Error('matrix-public-observer-absent');
  const response = api.readResponse();
  const progress = api.readProgress();
  const dom = observe({...options,responseId:progress.responseId});
  return {schema:'matrix-current-sample-v3',response,progress,dom};
 `);
}
