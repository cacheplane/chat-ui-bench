import {describe,it,expect} from 'vitest';
import {collectJsReferences,collectHtmlReferences,collectCssReferences,assertParserTreeBounds} from './hosted-copilot-static-assets.ts';
const literal=(value:unknown)=>({type:'Literal',value});
const program=(body:unknown[])=>({type:'Program',body});
describe('inert complete supported asset projections',()=>{
 it('collects duplicate static and dynamic module occurrences',()=>expect(collectJsReferences(program([{type:'ImportDeclaration',source:literal('./a.js')},{type:'ExportNamedDeclaration',source:literal('./a.js')},{type:'ImportExpression',source:literal('./b.js')}]))).toEqual(['./a.js','./a.js','./b.js']));
 it('rejects computed dynamic import',()=>expect(()=>collectJsReferences(program([{type:'ImportExpression',source:{type:'Identifier',name:'x'}}]))).toThrow());
 it('ignores ordinary endpoint strings',()=>expect(collectJsReferences(program([{type:'Literal',value:'https://endpoint.invalid'}]))).toEqual([]));
 it('retains explicit import-meta new URL assets',()=>expect(collectJsReferences(program([{type:'NewExpression',callee:{type:'Identifier',name:'URL'},arguments:[literal('./icon.png'),{type:'MemberExpression',computed:false,object:{type:'MetaProperty',meta:{name:'import'},property:{name:'meta'}},property:{type:'Identifier',name:'url'}}]}]))).toEqual(['./icon.png']));
 it('denies computed import-meta URL specifiers',()=>expect(()=>collectJsReferences(program([{type:'NewExpression',callee:{type:'Identifier',name:'URL'},arguments:[{type:'Identifier',name:'x'},{type:'MemberExpression',computed:false,object:{type:'MetaProperty',meta:{name:'import'},property:{name:'meta'}},property:{type:'Identifier',name:'url'}}]}]))).toThrow());
 it('walks template content and inline scripts/styles',()=>expect(collectHtmlReferences({nodeName:'#document',childNodes:[{tagName:'template',attrs:[],content:{childNodes:[{tagName:'img',attrs:[{name:'src',value:'./x.png'}]}]}},{tagName:'script',attrs:[{name:'type',value:'module'}],childNodes:[{nodeName:'#text',value:'import "./x.js"'}]},{tagName:'style',attrs:[],childNodes:[{nodeName:'#text',value:'.x{}'}]}]})).toEqual({references:['./x.png'],scripts:['import "./x.js"'],styles:['.x{}']}));
 for(const attr of ['srcset','srcdoc','onload']) it(`denies HTML ${attr}`,()=>expect(()=>collectHtmlReferences({tagName:'img',attrs:[{name:attr,value:'x'}]})).toThrow());
 it('denies base elements',()=>expect(()=>collectHtmlReferences({tagName:'base',attrs:[]})).toThrow());
 it('retains CSS import and URL occurrences',()=>expect(collectCssReferences([{type:'import',url:'./a.css'},{type:'url',url:'#mask'}])).toEqual(['./a.css','#mask']));
 it('denies unsupported CSS dependencies',()=>expect(()=>collectCssReferences([{type:'glob',glob:'**'}])).toThrow());
 it('denies reference occurrence overflow',()=>expect(()=>collectJsReferences(program(Array.from({length:4097},()=>({type:'ImportDeclaration',source:literal('./a.js')}))))).toThrow());
 it('denies excessive depth',()=>{let ast:unknown=program([]);for(let i=0;i<258;i++)ast={type:'BlockStatement',body:[ast]};expect(()=>collectJsReferences(ast)).toThrow();});
});

it('bounds every CSS projected object and nested array',()=>{let value:unknown={};for(let i=0;i<258;i++)value={value};expect(()=>assertParserTreeBounds(value)).toThrow();});

it('denies HTML refresh and scripting-disabled resource ambiguity',()=>{expect(()=>collectHtmlReferences({tagName:'meta',attrs:[{name:'http-equiv',value:'refresh'},{name:'content',value:'0;url=https://x.invalid'}]})).toThrow();expect(()=>collectHtmlReferences({tagName:'noscript',attrs:[],childNodes:[]})).toThrow();});

describe('recognized static URL candidates exclude ordinary endpoint construction',()=>{
 it('leaves an ordinary endpoint URL constructor outside static asset references',()=>expect(collectJsReferences({type:'Program',body:[{type:'NewExpression',callee:{type:'Identifier',name:'URL'},arguments:[{type:'Identifier',name:'runtimePath'},{type:'Identifier',name:'runtimeBase'}]}]})).toEqual([]));
 it('denies computed import.meta member bases rather than dropping asset intent',()=>expect(()=>collectJsReferences({type:'Program',body:[{type:'NewExpression',callee:{type:'Identifier',name:'URL'},arguments:[{type:'Literal',value:'./x.png'},{type:'MemberExpression',computed:true,object:{type:'MetaProperty',meta:{type:'Identifier',name:'import'},property:{type:'Identifier',name:'meta'}},property:{type:'Identifier',name:'which'}}]}]})).toThrow());
 it('denies dynamic import options',()=>expect(()=>collectJsReferences({type:'Program',body:[{type:'ImportExpression',source:{type:'Literal',value:'./x.js'},options:{type:'ObjectExpression',properties:[]}}]})).toThrow());
});
