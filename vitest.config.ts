import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@eidos/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@eidos/sdk': path.resolve(__dirname, './packages/sdk/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/tests/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
  },
});
