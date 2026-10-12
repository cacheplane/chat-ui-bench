import {test,expect,vi} from 'vitest';
import {canonicalSerialize,createComparisonBuffer,comparisonSchemasForVersionPair} from '@chat-ui-bench/contract';
import {assembleComparisonInstaller} from './comparison-installer.js';
import {mainOptions,preOptions,page} from './comparison-page.test-helper.mts';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import * as ts from 'typescript/unstable/ast';
import {API} from 'typescript/unstable/sync';
import {createVirtualFileSystem} from 'typescript/unstable/fs';
import {preNavigationOptionsSchema,mainOptionsSchema} from '@chat-ui-bench/contract';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Test-only independent verifier: parses retained bytes as data, never executes them.
function verify(bytes:Uint8Array,kind:'pre-navigation'|'main',expectedFactory:string,version:'2.0.0'|'2.1.0'='2.0.0') {
  if(bytes.byteLength>1048576)throw Error('payload cap');
  const source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  if(!Buffer.from(source).equals(Buffer.from(bytes)))throw Error('UTF8 mismatch');
  // TS7's installed native parser supplies SourceFile/getStart/end and syntax diagnostics.
  const owned=createVirtualFileSystem({'/private/tmp/comparison-verifier/tsconfig.json':'{"compilerOptions":{"allowJs":true,"checkJs":false,"noEmit":true,"noLib":true,"noResolve":true,"types":[],"target":"esnext"},"files":["payload.js"]}','/private/tmp/comparison-verifier/payload.js':source});
  const api=new API({cwd:'/private/tmp',fs:{readFile:path=>owned.readFile?.(path)??null,fileExists:path=>owned.fileExists?.(path)??false,directoryExists:path=>owned.directoryExists?.(path)??false,getAccessibleEntries:path=>owned.getAccessibleEntries?.(path)??{files:[],directories:[]},realpath:path=>path}});
  let snapshot:ReturnType<API['updateSnapshot']>|undefined;
  let file:ts.SourceFile;
  try{snapshot=api.updateSnapshot({openProjects:['/private/tmp/comparison-verifier/tsconfig.json']});const projects=snapshot.getProjects();if(projects.length!==1)throw Error('project inventory');const program=projects[0]!.program,files=program.getSourceFileNames();if(files.length!==1||files[0]!=='/private/tmp/comparison-verifier/payload.js')throw Error('source inventory');if(program.getSyntacticDiagnostics('/private/tmp/comparison-verifier/payload.js').length)throw Error('parse diagnostics');file=program.getSourceFile('/private/tmp/comparison-verifier/payload.js')!;if(!file||file.text!==source)throw Error('source text mismatch');}finally{try{snapshot?.dispose();}finally{api.close();}}
  if(file.statements.length!==1)throw Error('root statement count');const root=file.statements[0]!;
  if(!ts.isExpressionStatement(root)||!ts.isCallExpression(root.expression)||root.expression.arguments.length!==0||!ts.isParenthesizedExpression(root.expression.expression)||!ts.isArrowFunction(root.expression.expression.expression))throw Error('IIFE');
  const arrow=root.expression.expression.expression;if(arrow.parameters.length!==0||arrow.modifiers?.length||!ts.isBlock(arrow.body)||arrow.body.statements.length!==7)throw Error('arrow');const statements=arrow.body.statements;
  const directive=statements[0]!;if(!ts.isExpressionStatement(directive)||!ts.isStringLiteral(directive.expression)||directive.expression.text!=='use strict')throw Error('directive');
  function initializer(index:number,name:string):ts.Expression{const statement=statements[index]!;if(!ts.isVariableStatement(statement)||statement.modifiers?.length||(statement.declarationList.flags&ts.NodeFlags.BlockScoped)!==ts.NodeFlags.Const||statement.declarationList.declarations.length!==1)throw Error('const');const declaration=statement.declarationList.declarations[0]!;if(!ts.isIdentifier(declaration.name)||declaration.name.text!==name||!declaration.initializer)throw Error('declaration');return declaration.initializer;}
  const format=initializer(1,'format'),slot=initializer(2,'kind');if(!ts.isStringLiteral(format)||format.text!=='chat-ui-bench:comparison-installer:v1'||!ts.isStringLiteral(slot)||slot.text!==kind)throw Error('format/slot');
  function functionSource(index:number,slotName:string,name:string,params:string[]):string {const node=initializer(index,slotName);if(!ts.isFunctionExpression(node)||node.modifiers?.length||node.asteriskToken||node.name?.text!==name||node.parameters.length!==params.length||node.parameters.some((p,i)=>!ts.isIdentifier(p.name)||p.name.text!==params[i]||p.dotDotDotToken||p.questionToken||p.initializer||p.type))throw Error('function');return source.slice(node.getStart(file),node.end);}
  const factory=functionSource(3,'createComparisonBuffer','createComparisonBuffer',['name']),installer=functionSource(4,'installer',kind==='pre-navigation'?'installComparisonPreNavigation':'installComparisonObservations',['createComparisonBuffer','options']);if(factory!==expectedFactory)throw Error('factory differs');
  const optionNode=initializer(5,'options'),options=source.slice(optionNode.getStart(file),optionNode.end);if(options.length>65536||Buffer.byteLength(options)>65536)throw Error('option cap');
  let work=0;
  function json(node:ts.Node,depth=0):void {
    if(++work>65536||depth>32)throw Error('JSON work cap');
    if(ts.isObjectLiteralExpression(node)){const keys=new Set<string>();for(const p of node.properties){if(!ts.isPropertyAssignment(p)||!ts.isStringLiteral(p.name)||source[p.name.getStart(file)]!=='"'||keys.has(p.name.text))throw Error('JSON property');keys.add(p.name.text);json(p.initializer,depth+1);}return;}
    if(ts.isArrayLiteralExpression(node)){for(const e of node.elements)json(e,depth+1);return;}
    if(ts.isStringLiteral(node)){if(source[node.getStart(file)]!=='"')throw Error('JSON quote');return;}
    if(ts.isNumericLiteral(node)){const value=Number(node.text);if(!Number.isSafeInteger(value)||value<0)throw Error('JSON number');return;}
    if(node.kind===ts.SyntaxKind.TrueKeyword||node.kind===ts.SyntaxKind.FalseKeyword||node.kind===ts.SyntaxKind.NullKeyword)return;
    throw Error('code as JSON');
  }
  const family=version==='2.0.0'?comparisonSchemasForVersionPair({collectorVersion:version,analyzerVersion:version}):comparisonSchemasForVersionPair({collectorVersion:version,analyzerVersion:version});
  json(optionNode);const parsed=JSON.parse(options),strict=(kind==='main'?family.mainOptionsSchema:family.preNavigationOptionsSchema).parse(parsed);if(canonicalSerialize(strict)!==options)throw Error('canonical options');
  const invocation=statements[6]!;if(!ts.isExpressionStatement(invocation)||!ts.isCallExpression(invocation.expression)||!ts.isIdentifier(invocation.expression.expression)||invocation.expression.expression.text!=='installer'||invocation.expression.arguments.length!==2||invocation.expression.arguments.some((a,i)=>!ts.isIdentifier(a)||a.text!==['createComparisonBuffer','options'][i]))throw Error('invocation');
  const a=`(() => {\n"use strict";\nconst format = "chat-ui-bench:comparison-installer:v1";\nconst kind = "${kind}";\nconst createComparisonBuffer = `,b=';\nconst installer = ',c=';\nconst options = ',d=';\ninstaller(createComparisonBuffer, options);\n})();\n';
  if(a+factory+b+installer+c+options+d!==source)throw Error('whole envelope');return {factory,installer,options:strict,envelope:a+b+c+d};
}
function framed(domain:string,pieces:Uint8Array[]):string {const hash=createHash('sha256').update(domain).update(Buffer.from([10]));for(const bytes of pieces){const length=Buffer.alloc(8);length.writeBigUInt64BE(BigInt(bytes.byteLength));hash.update(length).update(bytes);}return hash.digest('hex');}
function matching(pair:{preNavigation:string;main:string},descriptor:typeof preOptions.identity,factory:string):string {
  const p=verify(Buffer.from(pair.preNavigation),'pre-navigation',factory),m=verify(Buffer.from(pair.main),'main',factory);
  if(canonicalSerialize(p.options.identity)!==canonicalSerialize(descriptor)||canonicalSerialize(m.options.identity)!==canonicalSerialize(descriptor))throw Error('descriptor binding');
  const pieces:string[]=[];for(const v of [p,m]){const options={...v.options,identity:{...v.options.identity,repetition:'<descriptor-repetition>',round:0,artifactDirectory:'<descriptor-directory>'}};pieces.push(v.envelope,v.factory,v.installer,canonicalSerialize(options));}return framed('chat-ui-bench:comparison-installer-matching:v1',pieces.map(v=>Buffer.from(v)));
}
test('strict primitive canonical input and independently framed digest',()=>{
  const p=canonicalSerialize(preOptions),m=canonicalSerialize(mainOptions),pair=assembleComparisonInstaller(p,m),hash=createHash('sha256').update('chat-ui-bench:comparison-installer-pair:v1\n');
  for(const source of [pair.preNavigation,pair.main]){const bytes=Buffer.from(source),length=Buffer.alloc(8);length.writeBigUInt64BE(BigInt(bytes.length));hash.update(length).update(bytes);}
  expect(pair.installerSha256).toBe(hash.digest('hex'));expect(pair.preNavigationByteLength).toBe(Buffer.byteLength(pair.preNavigation));expect(pair.mainByteLength).toBe(Buffer.byteLength(pair.main));expect(pair.preNavigation).toContain(Function.prototype.toString.call(createComparisonBuffer));
  expect(()=>assembleComparisonInstaller(p+' ',m)).toThrow();expect(()=>assembleComparisonInstaller(p.replace('"optionsVersion":1','"optionsVersion":1,"optionsVersion":1'),m)).toThrow();
  const touched=vi.fn(()=>{throw Error('get');}),proxy=new Proxy({},{get:touched,ownKeys:touched});expect(()=>assembleComparisonInstaller(proxy as never,m)).toThrow();expect(touched).not.toHaveBeenCalled();
  const parse=vi.spyOn(JSON,'parse');expect(()=>assembleComparisonInstaller(' '.repeat(65537),m)).toThrow();expect(parse).not.toHaveBeenCalled();parse.mockRestore();
});
test('actual emitted pair executes without Node globals and keeps pre source retained',()=>{
  const p=page(),pair=assembleComparisonInstaller(canonicalSerialize(preOptions),canonicalSerialize(mainOptions));runInNewContext(pair.preNavigation,p.context);p.context.console.error('original 🌍');runInNewContext(pair.main,p.context);p.tick(51);expect(p.context.comparisonCapture.readPreNavigationTransfer().accepted).toBe(1);expect(p.context.comparisonPreNavigation.state().pendingEntries).toBe(0);expect(p.context.process).toBeUndefined();
});
test('independent parser reconstructs entire payload and rejects hostile boundaries/JSON without execution',()=>{
  const pair=assembleComparisonInstaller(canonicalSerialize(preOptions),canonicalSerialize(mainOptions)),factory=createComparisonBuffer.toString();verify(Buffer.from(pair.preNavigation),'pre-navigation',factory);verify(Buffer.from(pair.main),'main',factory);
  const source=pair.main,options=canonicalSerialize(mainOptions);
  const bad=[source+' ', '\ufeff'+source,source.replace('"use strict"','/*extra*/ "use strict"'),source.replace('installer(createComparisonBuffer, options)','installer(createComparisonBuffer, options, 1)'),source.replace('const options = '+options,'const options = '+options.replace('"round":1','"round":1,"round":1')),source.replace('const options = '+options,'const options = '+options.replace('"round":1','"round":1.0')),source.replace('const options = '+options,'const options = (() => '+options+')()'),source.replace('const options = '+options,'const options = '+options.replace('"seed":1','"seed":foo()')),source.replace('const kind = "main"','const kind = "pre-navigation"'),source.replace('const options = ','const hacked = 1;\nconst options = '),source.replace('const options = '+options,'const options = '+options.replace('"seed":1','"seed":1,/*comment*/'))];
  for(const value of bad)expect(()=>verify(Buffer.from(value),'main',factory)).toThrow();expect(()=>verify(new Uint8Array([0xff]),'main',factory)).toThrow();expect(()=>verify(Buffer.from(pair.preNavigation),'main',factory)).toThrow();
});
test('raw ordered framing and exactly eight matching pieces preserve all meaningful identity',()=>{
  const p=canonicalSerialize(preOptions),m=canonicalSerialize(mainOptions),one=assembleComparisonInstaller(p,m),factory=createComparisonBuffer.toString();
  const changed={...preOptions.identity,repetition:'other-\ud800',round:2,artifactDirectory:'runs/two'},two=assembleComparisonInstaller(canonicalSerialize({...preOptions,identity:changed}),canonicalSerialize({...mainOptions,identity:changed}));expect(one.installerSha256).not.toBe(two.installerSha256);expect(matching(one,preOptions.identity,factory)).toBe(matching(two,changed,factory));
  const scenario={...preOptions.identity,scenarioId:'different'},three=assembleComparisonInstaller(canonicalSerialize({...preOptions,identity:scenario}),canonicalSerialize({...mainOptions,identity:scenario}));expect(matching(one,preOptions.identity,factory)).not.toBe(matching(three,scenario,factory));expect(()=>matching(two,preOptions.identity,factory)).toThrow();
  expect(framed('d',[Buffer.from('a'),Buffer.from('bc')])).not.toBe(framed('d',[Buffer.from('ab'),Buffer.from('c')]));expect(framed('d',[Buffer.from('🌍'),Buffer.from('\ud800')])).not.toBe(framed('d\\n',[Buffer.from('🌍'),Buffer.from('\ud800')]));
});
test('fresh actual tsc emitted module pair runs isolated, using identical compiled factory',async()=>{
  const module=await import(pathToFileURL(process.cwd()+'/packages/runner/dist/comparison-installer.js').href),contract=await import(pathToFileURL(process.cwd()+'/packages/contract/dist/comparison-buffer.js').href),pair=module.assembleComparisonInstaller(canonicalSerialize(preOptions),canonicalSerialize(mainOptions)),p=page();
  verify(Buffer.from(pair.preNavigation),'pre-navigation',contract.createComparisonBuffer.toString());verify(Buffer.from(pair.main),'main',contract.createComparisonBuffer.toString());runInNewContext(pair.preNavigation,p.context);p.context.console.warn('actual compiled');runInNewContext(pair.main,p.context);p.tick(51);expect(p.context.comparisonCapture.drain(64).some((e:any)=>e.cohort==='exception')).toBe(true);
  expect(await readFile('packages/runner/dist/comparison-observations.js','utf8')).toContain('function installComparisonObservations');
});
test('actual compiled bytes keep geometry independent of count and reject nested clipped prose',async()=>{
  const module=await import(pathToFileURL(process.cwd()+'/packages/runner/dist/comparison-installer.js').href),pair=module.assembleComparisonInstaller(canonicalSerialize(preOptions),canonicalSerialize(mainOptions));
  for(const nested of [false,true]){const p=page();p.setText('A');delete p.bridge.readCaptureMountedMessageCount;
    if(nested){const inner={tagName:'SPAN',isConnected:true,parentElement:p.content,getAttribute:()=>null,clientWidth:0,clientHeight:0};p.node.parentElement=inner as any;const style=p.context.getComputedStyle;p.context.getComputedStyle=(element:any)=>({...style(element),overflowX:element===inner?'hidden':'visible'});}
    runInNewContext(pair.preNavigation,p.context);runInNewContext(pair.main,p.context);p.tick(51);expect(p.context.comparisonCapture.readScroll().status).toBe(nested?'unavailable':'available');const records=p.context.comparisonCapture.drain(64).filter((v:any)=>v.cohort==='observation').map((v:any)=>JSON.parse(v.serialized));expect(records.some((r:any)=>r.kind==='dom-checkpoint')).toBe(false);expect(records.some((r:any)=>r.kind==='scroll-checkpoint')).toBe(!nested);
  }
});
test('data parser external references and dynamic imports stay data and cannot alter envelope proof',()=>{
  const pair=assembleComparisonInstaller(canonicalSerialize(preOptions),canonicalSerialize(mainOptions)),factory=createComparisonBuffer.toString();
  for(const prefix of ['import("node:fs");\n','import("/private/tmp/comparison-parser-secret-sentinel");\n','/// <reference path="/private/tmp/comparison-parser-secret-sentinel"/>\n'])expect(()=>verify(Buffer.from(prefix+pair.main),'main',factory)).toThrow();
  const marker=pair.main.replace('const page =','const ignoredMarker = "const options = fake; import(\\\"node:fs\\\")";\nconst page =');
  // The marker is part of the actual full helper span. It cannot move the options boundary.
  expect(marker).not.toBe(pair.main);const parsed=verify(Buffer.from(marker),'main',factory);expect(parsed.installer).toContain('const options = fake');expect(parsed.options).toEqual(mainOptions);
  expect(()=>verify(Buffer.from(' '.repeat(1048577)),'main',factory)).toThrow('payload cap');
});
test('whole helper/installer bytes, Unicode options and eight framed matching pieces all affect their own identities',()=>{
  const identity={...preOptions.identity,repetition:'unicode-🌍-\ud800'},pair=assembleComparisonInstaller(canonicalSerialize({...preOptions,identity}),canonicalSerialize({...mainOptions,identity})),factory=createComparisonBuffer.toString();
  const p=verify(Buffer.from(pair.preNavigation),'pre-navigation',factory),m=verify(Buffer.from(pair.main),'main',factory);expect(p.options.identity.repetition).toBe(identity.repetition);expect(m.options.identity.repetition).toBe(identity.repetition);
  const normalized=(v:typeof p)=>canonicalSerialize({...v.options,identity:{...v.options.identity,repetition:'<descriptor-repetition>',round:0,artifactDirectory:'<descriptor-directory>'}});
  const envelope=(kind:string)=>`(() => {\n"use strict";\nconst format = "chat-ui-bench:comparison-installer:v1";\nconst kind = "${kind}";\nconst createComparisonBuffer = `+';\nconst installer = '+';\nconst options = '+';\ninstaller(createComparisonBuffer, options);\n})();\n';
  const pieces=[envelope('pre-navigation'),p.factory,p.installer,normalized(p),envelope('main'),m.factory,m.installer,normalized(m)];expect(pieces).toHaveLength(8);expect(matching(pair,identity,factory)).toBe(framed('chat-ui-bench:comparison-installer-matching:v1',pieces.map(v=>Buffer.from(v))));
  const changed={...pair,main:pair.main.replace('function installComparisonObservations','function installComparisonObservations /*actual helper edit*/')};expect(matching(changed,identity,factory)).not.toBe(matching(pair,identity,factory));expect(framed('chat-ui-bench:comparison-installer-pair:v1',[Buffer.from(changed.preNavigation),Buffer.from(changed.main)])).not.toBe(pair.installerSha256);
  expect(framed('chat-ui-bench:comparison-installer-pair:v1',[Buffer.from(pair.main),Buffer.from(pair.preNavigation)])).not.toBe(pair.installerSha256);expect(()=>matching({...pair,preNavigation:pair.main,main:pair.preNavigation},identity,factory)).toThrow();
  const helperChanged={...pair,main:pair.main.replace('maxPendingEntries: 4096','maxPendingEntries: 4095')};expect(helperChanged.main).not.toBe(pair.main);expect(()=>verify(Buffer.from(helperChanged.main),'main',factory)).toThrow('factory differs');
});
test('assembler rejects UTF8 oversize before JSON parse, strict effective-setting edits and cross-pair identity',()=>{
  const p=canonicalSerialize(preOptions),m=canonicalSerialize(mainOptions),parse=vi.spyOn(JSON,'parse');expect(()=>assembleComparisonInstaller('漢'.repeat(30000),m)).toThrow('UTF8');expect(parse).not.toHaveBeenCalled();parse.mockRestore();
  for(const value of [{...mainOptions,probeIntervalMs:49},{...mainOptions,limits:{...mainOptions.limits,maxRecordDepth:33}},{...mainOptions,nativeRecipeIds:{...mainOptions.nativeRecipeIds,composer:'changed'}},{...mainOptions,identity:{...mainOptions.identity,repetition:'wrong'}}])expect(()=>assembleComparisonInstaller(p,canonicalSerialize(value))).toThrow();
  for(const spelling of [m.replace('"seed":1','"seed":1e0'),m.replace('"seed":1','"seed":0x1'),m.replace('"seed":1','"seed":01'),m.replace('"round":1','"round":1,"\\u0072ound":1'),m.replace('"seed":1','"seed":foo'),m.replace('"seed":1','seed:1')])expect(()=>assembleComparisonInstaller(p,spelling)).toThrow();
});
test('compiled trusted bytes are required, a missing outer helper actually fails isolated execution',async()=>{
  const module=await import(pathToFileURL(process.cwd()+'/packages/runner/dist/comparison-installer.js').href),pair=module.assembleComparisonInstaller(canonicalSerialize(preOptions),canonicalSerialize(mainOptions)),p=page();
  const broken=pair.main.replace('const page =','const missingClosure = notADeclaredPageHelper();\nconst page =');expect(broken).not.toBe(pair.main);expect(()=>runInNewContext(broken,p.context)).toThrow('notADeclaredPageHelper');
  let injectedFactory:any;runInNewContext(pair.preNavigation.replace('installer(createComparisonBuffer, options);','window.injectedFactory = createComparisonBuffer; installer(createComparisonBuffer, options);'),p.context);injectedFactory=p.context.injectedFactory;
  const app=createComparisonBuffer('page-observations'),injected=injectedFactory('page-observations'),tokens=['object',2,'unicode','string','🌍漢\ud800\\\n','numbers','array',2,'number',1,'boolean',false] as any;
  expect(injected.enqueue(...tokens)).toBe(app.enqueue(...tokens));expect(injected.state()).toEqual(app.state());expect(injected.drain(1)).toEqual(app.drain(1));for(let i=0;i<4097;i++){app.enqueue('null');injected.enqueue('null');}expect(injected.state()).toEqual(app.state());expect(injected.drain(64)).toEqual(app.drain(64));expect(injected.state()).toEqual(app.state());
});

function selectedInstaller(pre:string,main:string,version:unknown):ReturnType<typeof assembleComparisonInstaller>{return Reflect.apply(assembleComparisonInstaller,undefined,[pre,main,version]);}
const freshInstallerOptions=()=>({...mainOptions,scoredScrollSampling:{mode:'fresh-page-acquisition',minimumPostToLaterPageMs:800,maxWaitCallbacks:64}});
test('explicit legacy installer selection preserves exact default bytes and excludes the fresh policy',()=>{
  const pre=canonicalSerialize(preOptions),main=canonicalSerialize(mainOptions),original=assembleComparisonInstaller(pre,main);
  expect(selectedInstaller(pre,main,'2.0.0')).toEqual(original);
  const fresh=canonicalSerialize(freshInstallerOptions());
  expect(()=>assembleComparisonInstaller(pre,fresh)).toThrow();expect(()=>selectedInstaller(pre,fresh,'2.0.0')).toThrow();
});
test('explicit fresh installer selection preserves canonical identities, original code and independently framed bytes without installation',()=>{
  const pre=canonicalSerialize(preOptions),options=freshInstallerOptions(),main=canonicalSerialize(options),pair=selectedInstaller(pre,main,'2.1.0'),factory=createComparisonBuffer.toString();
  const p=verify(Buffer.from(pair.preNavigation),'pre-navigation',factory,'2.1.0'),m=verify(Buffer.from(pair.main),'main',factory,'2.1.0');
  expect(p.options).toEqual(preOptions);expect(m.options).toEqual(options);expect(p.options.identity).toEqual(m.options.identity);
  expect(pair.installerSha256).toBe(framed('chat-ui-bench:comparison-installer-pair:v1',[Buffer.from(pair.preNavigation),Buffer.from(pair.main)]));
  expect(pair.preNavigationByteLength).toBe(Buffer.byteLength(pair.preNavigation));expect(pair.mainByteLength).toBe(Buffer.byteLength(pair.main));
});
test('fresh installer requires exact policy and retains strict primitive canonical option admission',()=>{
  const pre=canonicalSerialize(preOptions);expect(()=>selectedInstaller(pre,canonicalSerialize(mainOptions),'2.1.0')).toThrow();
  const value=freshInstallerOptions();
  for(const patch of [{mode:'cached'},{minimumPostToLaterPageMs:799},{maxWaitCallbacks:65},{intervalMs:50},{extra:true}])expect(()=>selectedInstaller(pre,canonicalSerialize({...value,scoredScrollSampling:{...value.scoredScrollSampling,...patch}}),'2.1.0')).toThrow();
  expect(()=>selectedInstaller(pre,canonicalSerialize({...value,identity:{...value.identity,repetition:'other'}}),'2.1.0')).toThrow('Installer pair identities differ');
  expect(()=>selectedInstaller(pre,canonicalSerialize(value)+' ','2.1.0')).toThrow('canonical');
  const touched=vi.fn(()=>{throw Error('object input traversed');}),proxy=new Proxy({},{get:touched,ownKeys:touched});expect(()=>selectedInstaller(proxy as never,canonicalSerialize(value),'2.1.0')).toThrow();expect(touched).not.toHaveBeenCalled();
});
test('installer family selection rejects mixed or unknown primitive atoms and object traversal before JSON parsing',()=>{
  const pre=canonicalSerialize(preOptions),main=canonicalSerialize(mainOptions),parse=vi.spyOn(JSON,'parse'),touched=vi.fn(()=>{throw Error('version traversed');}),proxy=new Proxy({},{get:touched,ownKeys:touched});
  try{for(const version of ['2.0.0/2.1.0','2.2.0',null,1,Symbol('version'),proxy])expect(()=>selectedInstaller(pre,main,version)).toThrow('Unsupported comparison installer schema version');expect(touched).not.toHaveBeenCalled();expect(parse).not.toHaveBeenCalled();}finally{parse.mockRestore();}
});
