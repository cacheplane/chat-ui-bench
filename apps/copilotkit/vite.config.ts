import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {lstatSync,readdirSync} from 'node:fs';
import {readIntegratedAdmission} from '../../tests/support/hosted-copilot-context.ts';
import {createProductionBuildPlugin} from '../../tests/support/hosted-copilot-build-plugin.ts';
// Source-only until the reviewed hosted wrapper invokes real production Vite.
const admission=readIntegratedAdmission();
const output=lstatSync(admission.outputDirectory);
if(!output.isDirectory()||output.isSymbolicLink()||readdirSync(admission.outputDirectory).length!==0) throw new Error('Production output requires fresh original directory');
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),mode:'production',plugins:[createProductionBuildPlugin()],build:{outDir:admission.outputDirectory,emptyOutDir:false,minify:true,sourcemap:false,manifest:true}});
