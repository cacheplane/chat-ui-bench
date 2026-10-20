// Private lexical initialization taps only; no page-global or consumer API.
const names=['copilot','core','react','wrapper'],counts=[0,0,0,0];
let reason=null;
export const adapter=Object.freeze({
 moduleBinding(name){const i=names.indexOf(name);if(i<0){reason??='source-gap';return;}counts[i]=Math.min(2,counts[i]+1);if(counts[i]!==1)reason??='source-gap';},
 bindingReceipt(){const observed=!reason&&counts.every(n=>n===1);return {kind:'copilot-module-binding-v1',status:observed?'observed':'unavailable',reason:observed?null:reason??'source-gap',bindings:names.filter((_,i)=>counts[i]>0),counts:[...counts],qualification:false,performance:false};}
});
