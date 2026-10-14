import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  resolve: {alias: [{find: /^vitest$/, replacement: fileURLToPath(new URL('./node_modules/vitest/dist/index.js', import.meta.url))}]},
  test: {
    include: ['packages/runner/src/comparison-browser.test.ts'],
    exclude: ['tests/hosted/**'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 180000,
    bail: 1,
    retry: 0,
  },
});
