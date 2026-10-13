import {createHash} from 'node:crypto';
import {canonicalSerialize,comparisonSchemasForVersionPair,createComparisonBuffer,type ComparisonSchemaVersion} from '@chat-ui-bench/contract';
import {installComparisonPreNavigation,installComparisonObservations} from './comparison-observations.js';
export interface ComparisonInstallerPair {preNavigation:string;main:string;preNavigationByteLength:number;mainByteLength:number;installerSha256:string;}
/** Primitive strings are the entire public input boundary: no caller object traversal. */
export function assembleComparisonInstaller(preNavigationOptionsJSON:string,mainOptionsJSON:string,version:ComparisonSchemaVersion='2.0.0',diagnosticMode:'none'|'history-window-diagnostic-v1'='none'):ComparisonInstallerPair {
  if(typeof diagnosticMode!=='string'||diagnosticMode!=='none'&&diagnosticMode!=='history-window-diagnostic-v1')throw new Error('Unsupported comparison diagnostic mode');
  if(diagnosticMode!=='none'&&version!=='2.1.0')throw new Error('Diagnostic requires the explicit matched2.1 family');
  if(typeof version!=='string'||version!=='2.0.0'&&version!=='2.1.0')throw new Error('Unsupported comparison installer schema version');
  const family=version==='2.0.0'?comparisonSchemasForVersionPair({collectorVersion:version,analyzerVersion:version}):comparisonSchemasForVersionPair({collectorVersion:version,analyzerVersion:version});
  function parse<T>(input:string,schema:{parse(value:unknown):T}):T {
    if(typeof input!=='string'||input.length>65536)throw new Error('Options must be a bounded primitive JSON string');
    if(Buffer.byteLength(input,'utf8')>65536)throw new Error('Options UTF8 limit exceeded');
    const value=schema.parse(JSON.parse(input));if(canonicalSerialize(value)!==input)throw new Error('Options must use exact canonical JSON');return value;
  }
  const pre=parse(preNavigationOptionsJSON,family.preNavigationOptionsSchema),main=parse(mainOptionsJSON,family.mainOptionsSchema);
  if(canonicalSerialize(pre.identity)!==canonicalSerialize(main.identity))throw new Error('Installer pair identities differ');
  const factory=Function.prototype.toString.call(createComparisonBuffer);
  function source(kind:'pre-navigation'|'main',installer:Function,input:string):string {
    const extra=kind==='main'&&diagnosticMode!=='none'?', "history-window-diagnostic-v1", "2.1.0"':'';
    const output=`(() => {\n"use strict";\nconst format = "chat-ui-bench:comparison-installer:v1";\nconst kind = "${kind}";\nconst createComparisonBuffer = ${factory};\nconst installer = ${Function.prototype.toString.call(installer)};\nconst options = ${input};\ninstaller(createComparisonBuffer, options${extra});\n})();\n`;
    if(Buffer.byteLength(output,'utf8')>1048576)throw new Error('Installer payload UTF8 limit exceeded');return output;
  }
  const preNavigation=source('pre-navigation',installComparisonPreNavigation,preNavigationOptionsJSON),mainSource=source('main',installComparisonObservations,mainOptionsJSON);
  const hash=createHash('sha256').update('chat-ui-bench:comparison-installer-pair:v1\n','utf8');
  for(const payload of [preNavigation,mainSource]){const bytes=Buffer.from(payload,'utf8'),size=Buffer.alloc(8);size.writeBigUInt64BE(BigInt(bytes.length));hash.update(size).update(bytes);}
  return {preNavigation,main:mainSource,preNavigationByteLength:Buffer.byteLength(preNavigation,'utf8'),mainByteLength:Buffer.byteLength(mainSource,'utf8'),installerSha256:hash.digest('hex')};
}
