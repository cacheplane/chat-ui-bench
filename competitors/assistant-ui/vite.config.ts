import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
const ownModules = realpathSync(fileURLToPath(new URL('./node_modules', import.meta.url))) + '/';
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'verify-profile-module-isolation',
    generateBundle() {
      for (const id of this.getModuleIds()) {
        const file = id.split('?')[0];
        if (file.includes('/node_modules/') && !file.startsWith('\0') && !realpathSync(file).startsWith(ownModules)) {
          this.error(`Browser module escaped isolated package: ${file}`);
        }
      }
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: 'dist', sourcemap: false },
});
