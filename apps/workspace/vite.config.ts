import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@eidos/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@eidos/sdk': path.resolve(__dirname, '../../packages/sdk/src/index.ts'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
});
