/** Enabled only by the separate diagnostic frontend entry. No normal import. */
import {createScrollCauseAttributionDiagnostic} from './scroll-cause-diagnostic.ts';
export const scrollCauseObserver=createScrollCauseAttributionDiagnostic();
const capability=Object.freeze({protocol:'scroll-cause-attribution-v1' as const,observer:scrollCauseObserver,
 start:scrollCauseObserver.start.bind(scrollCauseObserver),marker:scrollCauseObserver.marker.bind(scrollCauseObserver),seal:scrollCauseObserver.seal.bind(scrollCauseObserver)});
if(Object.getOwnPropertyDescriptor(window,'__copilotkitScrollCauseDiagnostic'))throw Error('diagnostic-namespace-exists');
Object.defineProperty(window,'__copilotkitScrollCauseDiagnostic',{value:capability,enumerable:true,writable:false,configurable:false});
