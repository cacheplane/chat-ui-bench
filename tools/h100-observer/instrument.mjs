import fs from 'node:fs';
import {resolve,isAbsolute,normalize} from 'node:path';
import {createHash} from 'node:crypto';
export const sha = value=>createHash('sha256').update(value).digest('hex');
export function verifyRegistry(b){need(Buffer.isBuffer(b)&&b.length===1935&&sha(b)==='9ece11579487183a61986604ebe4d6dc960d6499a29f3fb65dacc7cd7add1126');return JSON.parse(b.toString('utf8'));}
const CORE='06f0d457a913752786a32f3f16dff0c5a9c5a8c4877665c31a2e74598db13c09';
function need(value){if(!value)throw new Error('source-contract');}
const id=s=>[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
export function readBounded(path,cap){
 const before=fs.lstatSync(path,{bigint:true});need(before.isFile()&&before.nlink===1n&&before.size<=BigInt(cap));
 need(fs.constants.O_NOFOLLOW>0&&fs.constants.O_NONBLOCK>0);
 const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
 try{need(id(fs.fstatSync(fd,{bigint:true}))===id(before));const pieces=[];let count=0;
  for(;;){const b=Buffer.alloc(Math.min(65536,cap+1-count));const n=fs.readSync(fd,b,0,b.length,null);if(!n)break;count+=n;need(count<=cap);pieces.push(b.subarray(0,n));}
  need(BigInt(count)===before.size&&id(fs.fstatSync(fd,{bigint:true}))===id(before)&&id(fs.lstatSync(path,{bigint:true}))===id(before));return Buffer.concat(pieces);
 }finally{fs.closeSync(fd);}
}
const registry=verifyRegistry(readBounded(new URL('./source-pins.json',import.meta.url),65536));
export function preflight(root,reader=readBounded){
 need(typeof root==='string'&&isAbsolute(root)&&normalize(root)===root);let total=0;
 const files=registry.files.map(row=>{const b=reader(resolve(root,row.path),row.bytes);need(Buffer.isBuffer(b)&&b.length===row.bytes&&sha(b)===row.sha256);total+=b.length;need(total<=1048576);return {...row};});
 return {files,vendorExecuted:false};
}
export function instrument(source,observerURL){
 need(typeof source==='string'&&Buffer.byteLength(source)===54156&&sha(source)===CORE);
 need(typeof observerURL==='string'&&observerURL.startsWith('file:///')&&!/[\0\r\n]/.test(observerURL)&&!/%2e|%00|\/\.\./i.test(observerURL)&&new URL(observerURL).href===observerURL);
 const edits=[];
 function unique(s){const p=source.indexOf(s);need(p>=0&&source.indexOf(s,p+1)<0);return p;}
 function put(offset,text){edits.push({offset,text});}
 function after(s,text){put(unique(s)+s.length,text);}
 function wrap(start,end,prefix,exit,register=false){
  const a=unique(start),b=unique(end),brace=b+end.indexOf('}');
  put(a+start.length,`\n      ${prefix}\n      let __hcNormal = true; try {`);
  put(brace,` } catch (__hcError) { __hcNormal = false; throw __hcError; } finally { ${exit} }\n`);
  if(register){put(a+start.indexOf('(index, size)'), '__hc.resizeFn(this, ');put(brace+1,')');}
  return {a,b};
 }
 put(0,`import { observer as __hc } from ${JSON.stringify(observerURL)};\n`);
 const map='this.itemSizeCache = /* @__PURE__ */ new Map();',m=unique(map);
 put(m+'this.itemSizeCache = '.length,'__hc.cache(this, ');put(m+map.length-1,')');
 const batch=wrap('const run = () => {\n            const batch', '          };\n          this.options.useAnimationFrameWithResizeObserver', 'const __hcM = __hc.begin(this, 3);', '__hc.end(this, __hcM, __hcNormal);');
 // The batch start anchor includes the first variable name; insert before it,
 // rather than splitting that original declaration.
 const batchEdit=edits.find(e=>e.offset===batch.a+'const run = () => {\n            const batch'.length);
 batchEdit.offset=batch.a+'const run = () => {'.length;
 const entry=wrap('const measureEntry = (entry) => {','      };\n      return {','const __hcM = __hc.begin(this, 2);','__hc.end(this, __hcM, __hcNormal);');
 const ref=wrap('this.measureElement = (node) => {','    };\n    this.resizeItem =','const __hcM = __hc.begin(this, 1);','__hc.end(this, __hcM, __hcNormal);');
 wrap('this.resizeItem = (index, size) => {','    };\n    this.getVirtualItems =','const __hcR = __hc.resizeEnter(this, index, size);','__hc.resizeExit(this, __hcR, __hcNormal);',true);
 for(const range of [entry,ref]){
  const needle='const index = this.indexFromElement(node);',p=source.indexOf(needle,range.a);need(p>=range.a&&p<range.b);put(p+needle.length,'\n      __hc.bind(this, __hcM, node, index);');
  const call=range===entry?'this.resizeItem(index, this.options.measureElement(node, entry, this));':'this.resizeItem(index, this.options.measureElement(node, void 0, this));';
  const c=unique(call);put(c,'const __hcE = __hc.edge(this, __hcM, node, index);\n        ');
  put(c+'this.resizeItem(index, '.length,'__hc.measuredResult(__hcE, ');
  put(c+call.length-2,')');put(c+call.length,'\n        __hc.edgeReturn(__hcE);');
 }
 after('this.options = merged;', '\n      __hc.options(this, merged, defaultKeyExtractor);');
 after('this.itemSizeCache.set(key, size);','\n        __hc.write(this, key, size);');
 const clear='this.itemSizeCache.clear();';let p=0;const clears=[];while((p=source.indexOf(clear,p))>=0){clears.push(p);p+=clear.length;}need(clears.length===3);
 clears.forEach((offset,i)=>{put(offset,`__hc.reset(this, ${i+1}); `);put(offset+clear.length,` __hc.resetDone(this, ${i+1});`);});
 const seed='this.measurementsCache.forEach((item) => {\n            this.itemSizeCache.set(item.key, item.size);\n          });';
 const sp=unique(seed);put(sp,'__hc.reset(this, 4); ');put(sp+seed.length,' __hc.resetDone(this, 4);');
 edits.sort((a,b)=>a.offset-b.offset);
 // Stable order for insertions at the same original offset is explicit.
 let code=source;for(const edit of [...edits].reverse())code=code.slice(0,edit.offset)+edit.text+code.slice(edit.offset);
 return {schemaVersion:1,sourceSha256:CORE,observerURL,insertions:edits,code,transformedSha256:sha(code)};
}
export function reverse(receipt){
 need(receipt&&receipt.schemaVersion===1&&receipt.sourceSha256===CORE&&Array.isArray(receipt.insertions)&&receipt.insertions.length<=64&&sha(receipt.code)===receipt.transformedSha256);
 let text=receipt.code,added=0;const placements=[];
 for(const e of receipt.insertions){need(Number.isSafeInteger(e.offset)&&e.offset>=0&&typeof e.text==='string'&&e.text.length<2048);placements.push({offset:e.offset+added,text:e.text});added+=e.text.length;}
 for(const e of placements.reverse()){need(text.slice(e.offset,e.offset+e.text.length)===e.text);text=text.slice(0,e.offset)+text.slice(e.offset+e.text.length);}
 need(sha(text)===CORE);const canonical=instrument(text,receipt.observerURL);need(JSON.stringify(canonical)===JSON.stringify(receipt));return text;
}
