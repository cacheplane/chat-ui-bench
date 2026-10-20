import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/hosted/scroll-cause-build.test.ts'],fileParallelism:false,maxWorkers:1,testTimeout:180000,hookTimeout:180000}});
