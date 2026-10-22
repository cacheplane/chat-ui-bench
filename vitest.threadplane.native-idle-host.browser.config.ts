import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
// Explicit opt-in functional harness; not an Angular/compiler/runtime copied input.
export default defineConfig({
 resolve:{alias:[{find:/^vitest$/,replacement:fileURLToPath(new URL('./node_modules/vitest/dist/index.js',import.meta.url))}]},
 test:{include:['apps/threadplane/src/browser.test.ts'],exclude:['tests/hosted/**'],fileParallelism:false,testTimeout:90000,hookTimeout:60000,
  provide:{threadplaneFunctionalBuild:'threadplane-0.3.2-idle-host-css-v1'},
  testNamePattern:/^native idle-host CSS functional /}
});
