import { defineConfig } from 'vitest/config';
import {fileURLToPath} from 'node:url';
// Framework builders may require a different optional Vitest peer; test APIs belong to the root runner.
export default defineConfig({ resolve:{alias:[{find:/^vitest$/,replacement:fileURLToPath(new URL('./node_modules/vitest/dist/index.js',import.meta.url))}]},test: { exclude: ['**/node_modules/**', '**/dist/**', '**/browser.test.ts'] } });
