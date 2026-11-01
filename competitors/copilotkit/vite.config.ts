import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertIsolatedModule} from './build-isolation.mjs';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  build: {outDir: 'dist', emptyOutDir: true, sourcemap: false},
  define: {'process.env.COPILOTKIT_TELEMETRY_DISABLED': '"true"', 'process.env.DO_NOT_TRACK': '"1"'},
  plugins: [{
    name: 'copilot-physical-dependency-isolation',
    generateBundle() {
      const files = new Set<string>();
      for (const id of this.getModuleIds()) {
        const file = assertIsolatedModule(id, root) as string | null;
        if (file) files.add(file);
      }
      const sha = (name: string) => createHash('sha256').update(readFileSync(new URL(name, import.meta.url))).digest('hex');
      this.emitFile({type: 'asset', fileName: 'profile-isolation.json', source: JSON.stringify({
        profile: 'copilotkit-react-1.83-default-functional-v1',
        scope: 'registered physical frontend modules only; not execution or performance qualification',
        physicalModuleCount: files.size, foreignPhysicalModules: 0,
        packageSha256: sha('package.json'), lockSha256: sha('package-lock.json'),
        sharedSource: '../shared/context.mjs',
      }, null, 2) + '\n'});
    },
  }],
});
