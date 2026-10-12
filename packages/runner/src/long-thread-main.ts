import type {createLongThreadCaptureDriver} from './long-thread-capture.js';
import type {ComparisonSlotDriver,ComparisonInvocationExecution} from './long-thread-run.js';
import {parseLongThreadArgs,type LongThreadConfiguration} from './long-thread-cli.js';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export interface LongThreadMainRuntime {createLongThreadCaptureDriver:typeof createLongThreadCaptureDriver;runLongThreadInvocation<State>(configuration:LongThreadConfiguration,driver:ComparisonSlotDriver<State>,options:{version:'2.1.0'}):Promise<ComparisonInvocationExecution>}
export interface LongThreadMainDependencies {loadRuntime?:()=>Promise<LongThreadMainRuntime>;stdout?:(message:string)=>void;stderr?:(message:string)=>void}
export async function runLongThreadCaptureMain(args:readonly string[],dependencies:LongThreadMainDependencies={}):Promise<number>{
 const stdout=dependencies.stdout??console.log,stderr=dependencies.stderr??console.error;
 try{
   const configuration=parseLongThreadArgs(args);if(configuration.help){stdout('Usage: bench:long-thread --out directory [--mode headed|headless] [--rounds 1|2|3] [--seed integer] [--adapter threadplane-langgraph-custom-transport]\nHeaded publication requires three rounds; headless runs collect conformance evidence.');return 0;}
   const runtime=await (dependencies.loadRuntime??(async()=>{const [capture,run]=await Promise.all([import('./long-thread-capture.js'),import('./long-thread-run.js')]);return {createLongThreadCaptureDriver:capture.createLongThreadCaptureDriver,runLongThreadInvocation:run.runLongThreadInvocation};}))();
   const originalRoot=fileURLToPath(new URL('../../../',import.meta.url));
   const driver=runtime.createLongThreadCaptureDriver({originalRoot,configuration}),execution=await runtime.runLongThreadInvocation(configuration,driver,{version:'2.1.0'});
   await execution.ownershipSettled;await execution.finalize();
   const success=execution.finalized&&!execution.unsafeOutstanding&&execution.invocation.status==='complete'&&execution.invocation.runs.every(row=>row.status==='valid');
   stdout(`Long-thread ${configuration.purpose} collection ${success?'completed':'failed'}: ${configuration.out}`);return success?0:1;
 }catch(error){stderr((error instanceof Error?error.message:String(error)||'Empty operational rejection').slice(0,4096));return 1;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await runLongThreadCaptureMain(process.argv.slice(2));
