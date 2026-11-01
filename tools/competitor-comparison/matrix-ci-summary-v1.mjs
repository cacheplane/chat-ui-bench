import {types} from 'node:util';
import {matrixVerificationRoster} from './matrix-policy-v4.mjs';

const ids=new Set(matrixVerificationRoster().map(slot=>slot.id));
const generic='::error::matrix-case-failure details-not-published';
const unpublished='failure-code-not-published';
function ownData(value,key){
 if(value===null||typeof value!=='object'||types.isProxy(value))return undefined;
 const descriptor=Object.getOwnPropertyDescriptor(value,key);
 return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;
}

/** Supplemental CI observation only; never changes a case or its admission.
 * Success is silent. Malformed identity/status closes to a constant annotation.
 * Only roster IDs, failure statuses and exact bounded harness codes may escape;
 * getters, proxies, coercion and all other result/error fields are untouched.
 */
export function matrixCIFailureAnnotation(result){
 try{
  const status=ownData(result,'status');
  if(status==='matrix-pass'||status==='negative-pass')return null;
  if(status!=='invalid'&&status!=='unattempted')return generic;
  const id=ownData(result,'id');
  if(typeof id!=='string'||!ids.has(id))return generic;
  const raw=status==='invalid'?ownData(ownData(result,'failure'),'message'):ownData(result,'reason');
  // Compare the complete match: JavaScript's $ also accepts a final newline.
  const match=typeof raw==='string'&&raw.length<=107?/^matrix-[a-z0-9-]{1,100}$/.exec(raw):null;
  const code=match&&match[0]===raw?raw:unpublished;
  return `::error::matrix-case-failure id=${id} status=${status} code=${code}`;
 }catch{return generic;}
}
