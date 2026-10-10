import { defineConfig } from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({resolve:{alias:[{find:/^vitest$/,replacement:fileURLToPath(new URL('./node_modules/vitest/dist/index.js',import.meta.url))}]}, test: { include: ['apps/threadplane/src/browser.test.ts'], fileParallelism: false, testTimeout: 90000, hookTimeout: 60000 } });
