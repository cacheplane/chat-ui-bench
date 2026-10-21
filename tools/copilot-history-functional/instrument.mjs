import fs from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
export const here=dirname(fileURLToPath(import.meta.url)),sourceRoot=resolve(here,'../..'),adapterPath=resolve(here,'adapter.mjs');
export const sha=value=>createHash('sha256').update(value).digest('hex');
const identity=s=>[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
export function boundedRead(path,cap){const before=fs.lstatSync(path,{bigint:true});if(!before.isFile()||before.nlink!==1n||before.size>BigInt(cap))throw Error('source-contract');const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);try{if(identity(fs.fstatSync(fd,{bigint:true}))!==identity(before))throw Error('source-contract');const parts=[];let total=0;for(;;){const b=Buffer.alloc(Math.min(65536,cap+1-total)),n=fs.readSync(fd,b,0,b.length,null);if(!n)break;total+=n;if(total>cap)throw Error('source-contract');parts.push(b.subarray(0,n));}if(BigInt(total)!==before.size||identity(fs.fstatSync(fd,{bigint:true}))!==identity(before)||identity(fs.lstatSync(path,{bigint:true}))!==identity(before))throw Error('source-contract');return Buffer.concat(parts);}finally{fs.closeSync(fd);}}
const registryRaw=boundedRead(resolve(here,'source-pins.json'),16384);
if(sha(registryRaw)!=='196386a4bb6e12d419bf199e627a796666bb419f043f73bf16e3c1ab7d940012')throw Error('source-registry');
export const registry=JSON.parse(registryRaw).files;
export function preflight(root=sourceRoot){let bytes=0;return registry.map(p=>{const raw=boundedRead(resolve(root,p.path),8388608);bytes+=raw.length;if(raw.length!==p.bytes||sha(raw)!==p.sha256||bytes>16777216)throw Error('source-contract');return {...p};});}
const req=createRequire(sourceRoot+'/package.json');const {parseAst}=req('rolldown/parseAst');const files={core:0,copilot:3,wrapper:4,react:24};function need(x){if(!x)throw Error('source-contract');}
export function transform(kind,requestedAdapter=adapterPath){
 need(Object.hasOwn(files,kind)&&requestedAdapter===adapterPath);
 const pin=registry[files[kind]],path=resolve(sourceRoot,pin.path),source=boundedRead(path,pin.bytes).toString();need(sha(source)===pin.sha256);
 const edits=[];const put=(offset,text)=>edits.push({offset,text});
 function unique(s){const n=source.indexOf(s);need(n>=0&&source.indexOf(s,n+1)<0);return n;}
 const after=(s,text)=>put(unique(s)+s.length,text);
 const ast=parseAst(source,{},pin.path);
 function children(n,visit){for(const value of Object.values(n)){if(Array.isArray(value)){for(const item of value)if(item&&typeof item.type==='string')visit(item);}else if(value&&typeof value.type==='string')visit(value);}}
 function named(name){let found=null;function visit(n){if(n.type==='FunctionDeclaration'&&n.id?.name===name){need(!found);found=n;}children(n,visit);}visit(ast);need(found?.body);return found;}
 function wrapFunction(name,start,end){const n=named(name);put(n.body.start+1,start);put(n.body.end-1,end);}
 let specifier=relative(dirname(path),adapterPath);if(!specifier.startsWith('.'))specifier='./'+specifier;
 const imp=kind==='react'?`var __lh = require(${JSON.stringify(specifier)}).adapter;\n`:`import {adapter as __lh} from ${JSON.stringify(specifier)};\n`;
 const ingress=kind==='react'?unique('\"use strict\";')+'\"use strict\";'.length:0;
 put(ingress,'\n'+imp);
 put(ingress,`__lh.moduleBinding(${JSON.stringify(kind)});\n`);
 if(kind==='react'){
  for(const name of ['renderWithHooks','renderWithHooksAgain']){
   wrapFunction(name,'\n const __lhRender=__lh.renderStart(workInProgress,Component,workInProgressRoot,workInProgressRoot?.current?.alternate); let __lhNormal=false; try {\n','\n } finally { __lh.renderEnd(__lhRender,__lhNormal); }\n');
   const n=named(name);let returns=[];function visit(x){if(x!==n&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(x.type))return;if(x.type==='ReturnStatement')returns.push(x);children(x,visit);}visit(n);need(returns.length===1);put(returns[0].start,'__lhNormal=true; ');
  }
  wrapFunction('commitLayoutEffectOnFiber','\n const __lhFiber=__lh.fiberStart(finishedRoot,current,finishedWork); let __lhNormal=false; try {\n','\n __lhNormal=true; } finally { __lh.fiberEnd(__lhFiber,__lhNormal); }\n');
  // The transaction begins from original locals, before mutation traversal.
  wrapFunction('flushMutationEffects','\n let __lhToken=null,__lhNormal=false; try {\n','\n __lhNormal=true; } finally { if(__lhToken)__lh.commitMutationEnd(__lhToken,__lhNormal); }\n');
  after('rootMutationHasEffect = 0 !== (finishedWork.flags & 13878);','\n __lhToken=__lh.commitStart(root,finishedWork);');
  for(const [name,anchor,method] of [
   ['flushLayoutEffects','rootHasLayoutEffect = 0 !== (finishedWork.flags & 8772);','commitLayoutEnd'],
   ['flushSpawnedWork','passiveSubtreeMask = (lanes & 335544064) === lanes ? 10262 : 10256;','commitSpawnedEnd']
  ]){
   if(name==='flushSpawnedWork'){
   wrapFunction(name,'\n let __lhRoot=null,__lhWork=null,__lhNormal=false,__lhBoundary; try {\n','\n __lhNormal=true; } catch(__lhError){if(!__lhRoot||__lhBoundary)__lh.failure();throw __lhError;} finally {if(__lhRoot&&!__lhBoundary)__lh.commitSpawnedEnd(__lhRoot,__lhWork,__lhNormal); }\n');
   after('    finishedWork = finishedWork.stateNode;','\n __lhBoundary=true; __lh.commitSpawnedEnd(__lhRoot,__lhWork,true);');
  }else wrapFunction(name,'\n let __lhRoot=null,__lhWork=null,__lhNormal=false; try {\n',`\n __lhNormal=true; } finally { if(__lhRoot)__lh.${method}(__lhRoot,__lhWork,__lhNormal); }\n`);
   after(anchor,'\n __lhRoot=root; __lhWork=finishedWork;');
  }
  after('function captureCommitPhaseError(sourceFiber, nearestMountedAncestor, error) {','\n __lh.failure();');
 }
 if(kind==='copilot'){
  const component=named('CopilotChatMessageView');put(component.end,'\n__lh.component(CopilotChatMessageView);\n');
  after('commitRowKeyStore(rowKeyStore, renderedMessages);','\n __lh.mapping(__lhRows);');
  const rowKey='const rowKey = (row) => row.type === "group" ? `${GROUP_ROW_KEY_PREFIX}${stableGroupKey(row.key)}` : rowRenderKeys.get(row.message.id) ?? row.message.id;';
  const p=unique(rowKey);put(p+'const rowKey = (row) => '.length,'__lh.key(row, (');put(p+rowKey.length-1,'))');
  after(rowKey,'\n const __lhRows=__lh.rows(rows,renderedMessages,rowRenderKeys,rowKeyStore,virtualizer,scrollElement,transformMessages,groupMessages,children,agentId,threadId);');
 }
 if(kind==='wrapper'){
  after('const measureElement = v.measureElement;','\n // Private source seam: preserve the actual wrapper and ref finally.');
 }
 if(kind==='core'){
  function wrap(start,end,prefix,exit){const a=unique(start),b=unique(end);put(a+start.length,`\n ${prefix} let __lhNormal=true; try {\n`);put(b+end.indexOf('}'),`\n } catch(__lhError){__lhNormal=false;throw __lhError;} finally{${exit}}\n`);return {a,b};}
  const batch=wrap('const run = () => {\n            const batch','          };\n          this.options.useAnimationFrameWithResizeObserver','const __lhScope=__lh.begin(this,3);','__lh.end(this,__lhScope,__lhNormal);');
  edits.find(e=>e.offset===batch.a+'const run = () => {\n            const batch'.length).offset=batch.a+'const run = () => {'.length;
  const entry=wrap('const measureEntry = (entry) => {','      };\n      return {','const __lhScope=__lh.begin(this,2);','__lh.end(this,__lhScope,__lhNormal);');
  const ref={a:unique('this.measureElement = (node) => {'),b:unique('    };\n    this.resizeItem =')};
  const cleanup=source.indexOf('      if (!node) {',ref.a),cleanupReturn=source.indexOf('        return;\n      }',cleanup);need(cleanup>ref.a&&cleanupReturn>cleanup&&cleanupReturn<ref.b);
  put(cleanup+'      if (!node) {'.length,'\n const __lhCleanup=__lh.beginCleanup(this,node); let __lhCleanupNormal=true; try {\n');
  put(cleanupReturn+'        return;'.length,'\n } catch(__lhCleanupError){__lhCleanupNormal=false;throw __lhCleanupError;} finally{__lh.endCleanup(this,__lhCleanup,__lhCleanupNormal);}\n');
  put(cleanupReturn+'        return;\n      }'.length,'\n const __lhScope=__lh.begin(this,1,node); let __lhNormal=true; try {\n');
  put(ref.b+4,'\n } catch(__lhError){__lhNormal=false;throw __lhError;} finally{__lh.end(this,__lhScope,__lhNormal);}\n');
  wrap('this.resizeItem = (index, size) => {','    };\n    this.getVirtualItems =','const __lhResize=__lh.resizeEnter(this,index,size);','__lh.resizeExit(this,__lhResize,__lhNormal);');
  for(const [range,entryArg] of [[entry,'entry'],[ref,'void 0']]){
   const needle='const index = this.indexFromElement(node);',p=source.indexOf(needle,range.a);need(p>=range.a&&p<range.b);put(p+needle.length,'\n __lh.bind(this,__lhScope,node,index);');
   const call=`this.resizeItem(index, this.options.measureElement(node, ${entryArg}, this));`,c=unique(call);
   put(c,'const __lhEdge=__lh.edge(this,__lhScope,node,index);\n ');put(c+'this.resizeItem(index, '.length,'__lh.measuredResult(__lhEdge, ');put(c+call.length-2,')');put(c+call.length,'\n __lh.edgeReturn(__lhEdge);');
  }
  after('this.itemSizeCache.set(key, size);','\n __lh.write(this,key,size);');
  after('this.options = merged;','\n __lh.options(this,merged,defaultKeyExtractor);');
  after('this.elementsCache.delete(key2);','\n __lh.detach(this,cached);');
  after('this.elementsCache.delete(cacheKey);','\n __lh.detach(this,cachedNode);');
  const clear='this.itemSizeCache.clear();';let p=0,n=0;while((p=source.indexOf(clear,p))>=0){put(p,`__lh.reset(this,${n+1}); `);p+=clear.length;n++;}need(n===3);
  const seed='this.itemSizeCache.set(item.key, item.size);';put(unique(seed),'__lh.reset(this,4); ');
 }
 edits.sort((a,b)=>a.offset-b.offset);let code=source;for(const e of [...edits].reverse())code=code.slice(0,e.offset)+e.text+code.slice(e.offset);
 need(code.length<2*1024*1024&&edits.length<=96);
 return {kind,path:pin.path,sourceSha256:pin.sha256,sha256:sha(code),edits,code};
}
export function reverse(receipt){let code=receipt.code,added=0;need(sha(code)===receipt.sha256);const placements=receipt.edits.map(e=>{const result={offset:e.offset+added,text:e.text};added+=e.text.length;return result;});for(const e of placements.reverse()){need(code.slice(e.offset,e.offset+e.text.length)===e.text);code=code.slice(0,e.offset)+code.slice(e.offset+e.text.length);}need(sha(code)===receipt.sourceSha256);return code;}
