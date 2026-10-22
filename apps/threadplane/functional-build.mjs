// Node-only functional harness. Exclude from runtime copied roster/compiler inputs.
import {isDeepStrictEqual} from 'node:util';
import {nativeIdleHostVariant,nativeIdleHostVariantLabel,nativeIdleHostBuildEvidence} from './provenance.mjs';
import {comparisonNativeIdleHostInstrumentationBuildEvidence,snapshotFiles,workspaceRoot,probeRecordKey} from './probe-provenance.mjs';
const descriptor=Object.freeze({...nativeIdleHostVariant,label:nativeIdleHostVariantLabel,assetRoot:'apps/threadplane/dist',fps:null});
export function selectFunctionalBuild(selector){
 if(selector===undefined)return undefined;
 if(selector!==nativeIdleHostVariant.id)throw Error('Unsupported functional build selector');
 return descriptor;
}
const strictReaders=Object.freeze({
 product:()=>nativeIdleHostBuildEvidence(workspaceRoot),
 probe:()=>comparisonNativeIdleHostInstrumentationBuildEvidence(workspaceRoot),
 facts:()=>snapshotFiles(workspaceRoot,['apps/threadplane/.build-evidence.json',probeRecordKey])
});
// Reader seam exists only for source-unit fault controls, never a browser-config option.
export async function authenticateFunctionalBuild(selector,readers=strictReaders){
 const selected=selectFunctionalBuild(selector);if(!selected)throw Error('Functional build selection required');
 const before=await readers.facts(),product=await readers.product(),probe=await readers.probe(),facts=await readers.facts();
 if(!isDeepStrictEqual(before,facts))throw Error('Functional build record facts changed');
 return Object.freeze(structuredClone({descriptor:selected,product,probe,facts}));
}
export async function recheckFunctionalBuild(original,readers=strictReaders){
 const current=await authenticateFunctionalBuild(original.descriptor.id,readers);
 if(!isDeepStrictEqual(current,original))throw Error('Functional build changed after owned cleanup');
 return current;
}

/** Assertions over actual DOM measurements; source-unit fault rows are not DOM proof. */
export function assertVisibleTypingDots(dots) {
 if(!Array.isArray(dots)||dots.length!==3)throw Error('Expected three actual typing dots');
 for(const [index,dot] of dots.entries()){
  if(!(dot.box.width>0&&dot.box.height>0&&dot.display!=='none'&&dot.visibility==='visible'&&Number.isFinite(dot.effectiveOpacity)&&dot.effectiveOpacity>0&&dot.visibleWidth>0&&dot.visibleHeight>0&&dot.animation!=='none'&&dot.running===true))throw Error(`Typing dot ${index} fails visibility/style/geometry checks`);
 }
}

/** Node-only functional response ordering; callbacks retain original event bytes. */
export async function writeGatedFunctionalResponse({gate,signal,writeStart,writeRemaining}) {
 await gate;signal.throwIfAborted();await writeStart();signal.throwIfAborted();await writeRemaining();
}
