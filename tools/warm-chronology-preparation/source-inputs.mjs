import{resolve}from'node:path';
import{registry,sourceRoot,boundedRead,sha}from'../copilot-history-functional/instrument.mjs';
export const sourceRegistry=Object.freeze({core:Object.freeze({...registry[0]}),copilot:Object.freeze({...registry[3]})});
export function readFixedSource(kind){
 if(typeof kind!=='string'||!Object.hasOwn(sourceRegistry,kind))throw Error('source-alias');
 const pin=sourceRegistry[kind],raw=boundedRead(resolve(sourceRoot,pin.path),pin.bytes);
 if(raw.length!==pin.bytes||sha(raw)!==pin.sha256)throw Error('source-pin');
 return raw.toString('utf8');
}
export function extractKernelSource(){
 const source=readFixedSource('core');
 const unique=text=>{const at=source.indexOf(text);if(at<0||source.indexOf(text,at+1)>=0)throw Error('kernel-source');return at;};
 const a=unique('const defaultRangeExtractor ='),b=unique('\nconst observeElementRect'),c=unique('const findNearestBinarySearch ='),d=unique('\nexport {');
 if(!(a<b&&b<c&&c<d))throw Error('kernel-source');
 const result='// Exact pinned original declarations; flat lanes1 only used by preparation.\n'+source.slice(a,b)+'\n'+source.slice(c,d)+'\nexport{calculateRangeImpl,defaultRangeExtractor};\n';
 if(Buffer.byteLength(result)!==2956||sha(result)!=='5a1fa22deb4e13919dee14e0652a1f556b0697b4683134f18c2d776af3289672')throw Error('kernel-source');
 return result;
}
