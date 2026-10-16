import {defineConfig} from 'vite';
import {RUNTIME_MODULE_ID,VERSION} from 'rolldown';
import {fileURLToPath} from 'node:url';
import {lstatSync,readdirSync} from 'node:fs';
import {readIntegratedAdmission} from '../../tests/support/hosted-copilot-context.ts';
import {createProductionBuildPlugin,productionEsmOutputOptions} from '../../tests/support/hosted-copilot-build-plugin.ts';
// Source-only until the reviewed hosted wrapper invokes real production Vite.
const admission=readIntegratedAdmission();
const output=lstatSync(admission.outputDirectory);
if(!output.isDirectory()||output.isSymbolicLink()||readdirSync(admission.outputDirectory).length!==0) throw new Error('Production output requires fresh original directory');
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),mode:'production',plugins:[createProductionBuildPlugin({compilerProfile:{provider:'rolldown',version:VERSION,runtimeModuleId:RUNTIME_MODULE_ID}})],build:{outDir:admission.outputDirectory,emptyOutDir:false,minify:true,sourcemap:false,manifest:true,rolldownOptions:{output:productionEsmOutputOptions()}}});
