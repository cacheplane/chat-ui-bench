import {types} from 'node:util';
/** Only these source-owned identities expose codes. Foreign exceptions are opaque. */
const codes=new Set(["diagnostic-postcapture-drain","diagnostic-postcapture-drain-unsettled","diagnostic-absence","diagnostic-absence-claim","diagnostic-action","diagnostic-anchor-case","diagnostic-anchor-owner","diagnostic-anchor-ref","diagnostic-anchor-rows","diagnostic-anchor-unavailable","diagnostic-browser-already-ended","diagnostic-browser-endpoint","diagnostic-browser-open","diagnostic-browser-stdio-count","diagnostic-browser-stream-open","diagnostic-budget","diagnostic-build-context","diagnostic-build-recipe","diagnostic-build-reference","diagnostic-build-schema","diagnostic-case-closure","diagnostic-case-open","diagnostic-checkout-path","diagnostic-child-infrastructure","diagnostic-child-publication","diagnostic-clean-checkout","diagnostic-client-closure","diagnostic-client-open","diagnostic-combined-module-bound","diagnostic-command","diagnostic-command-exit","diagnostic-command-open","diagnostic-command-owner","diagnostic-component-closure","diagnostic-context-join","diagnostic-data","diagnostic-directory","diagnostic-directory-changed","diagnostic-environment","diagnostic-export-pending","diagnostic-extra-role","diagnostic-file-changed","diagnostic-file-grew","diagnostic-file-size","diagnostic-final-namespace","diagnostic-first-failure","diagnostic-footer-cap","diagnostic-footer-context","diagnostic-footer-join","diagnostic-footer-missing-or-duplicate","diagnostic-footer-raw","diagnostic-footer-ref","diagnostic-footer-stdout-cap","diagnostic-hosted-context","diagnostic-infrastructure-exit","diagnostic-input-drain-pending","diagnostic-json-array","diagnostic-json-colon","diagnostic-json-duplicate","diagnostic-json-key","diagnostic-json-number","diagnostic-json-object","diagnostic-json-string","diagnostic-json-trailing","diagnostic-json-work","diagnostic-keys","diagnostic-launch-refused","diagnostic-launch-worker-changed","diagnostic-mandatory-role","diagnostic-manifest-join","diagnostic-manifest-state","diagnostic-module-pins","diagnostic-namespace","diagnostic-namespace-changed","diagnostic-object","diagnostic-original-pending","diagnostic-owned-and-instrumented-modules","diagnostic-pending-work","diagnostic-physical","diagnostic-physical-path","diagnostic-present-absent","diagnostic-raw-absence-join","diagnostic-raw-byte-join","diagnostic-raw-directory","diagnostic-raw-inconsistent","diagnostic-raw-open","diagnostic-raw-original-join","diagnostic-raw-reserve-once","diagnostic-raw-still-open","diagnostic-raw-witness","diagnostic-raw-write","diagnostic-raw-writer","diagnostic-readiness-case","diagnostic-readiness-once","diagnostic-recipe-reference","diagnostic-record","diagnostic-reference-join","diagnostic-reference-role","diagnostic-reference-work","diagnostic-refused","diagnostic-required-ref","diagnostic-role","diagnostic-role-cap","diagnostic-served-assets","diagnostic-source-changed","diagnostic-source-command","diagnostic-source-context","diagnostic-source-pin","diagnostic-stdio","diagnostic-stdio-missing","diagnostic-stdio-open","diagnostic-stdio-unclaimed","diagnostic-stream-open","diagnostic-strict-authority","diagnostic-strict-shape","diagnostic-temp","diagnostic-trace-writer-open","diagnostic-tracker-reference","diagnostic-transform-reversal","diagnostic-transform-source","diagnostic-transport-pending","diagnostic-tree","diagnostic-unwitnessed-absence","diagnostic-worker-copy","diagnostic-worker-copy-changed","diagnostic-worker-exports","diagnostic-worker-layout","diagnostic-worker-original-copy","diagnostic-worker-source","diagnostic-zip-cap","diagnostic-zip-count","diagnostic-zip-expanded","diagnostic-zip-path","diagnostic-zip-source","diagnostic-zip-source-changed"]);
const owned=new WeakMap<object,string>();
export function diagnosticNeed(value:unknown,code='diagnostic-refused'):asserts value{
 if(value)return;
 const known=typeof code==='string'&&codes.has(code);
 const error=new Error(known?code:'diagnostic-refused');
 if(known)owned.set(error,code);
 throw error;
}
export const DIAGNOSTIC_ACTIONS=Object.freeze(['preflight','build','run','parent','child','inventory','finalcheck','forensic','forensic-finalcheck'] as const);
export type DiagnosticAction=typeof DIAGNOSTIC_ACTIONS[number];
export function isDiagnosticAction(value:unknown):value is DiagnosticAction{return typeof value==='string'&&(DIAGNOSTIC_ACTIONS as readonly string[]).includes(value);}
export function diagnosticRefusalLine(error:unknown,action:DiagnosticAction){
 const code=error!==null&&(typeof error==='object'||typeof error==='function')?owned.get(error)??'unclassified':'unclassified';
 return JSON.stringify({kind:'unqualified-scroll-cause-refusal',action,stage:'action',code,qualification:false})+'\n';
}
type Field={status:'available';value:string}|{status:'unavailable'};
/** Inspect no Proxy, accessor, prototype field, coercion, or cause chain. */
export function diagnosticPrimaryLine(error:unknown){
 const unavailable:Field={status:'unavailable'};
 let status:'native-error'|'unavailable'='unavailable',message:Field=unavailable,stack:Field=unavailable;
 if(types.isNativeError(error)){
  status='native-error';
  const field=(key:string):Field=>{
   try{const d=Object.getOwnPropertyDescriptor(error,key);return d&&'value'in d&&typeof d.value==='string'&&Buffer.byteLength(d.value)<=16384?{status:'available',value:d.value}:unavailable;}catch{return unavailable;}
  };
  message=field('message');stack=field('stack');
 }
 const encode=(m:Field,s:Field)=>JSON.stringify({kind:'unqualified-scroll-cause-primary',status,message:m,stack:s,qualification:false,nativeGO:false,performance:false,fps:'unavailable'})+'\n';
 const line=encode(message,stack);
 return Buffer.byteLength(line)<=32768?line:encode(unavailable,unavailable);
}

