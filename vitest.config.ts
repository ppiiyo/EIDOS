import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: path.resolve(__dirname),
  resolve: {
    alias: {
      '@eidos/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@eidos/sdk': path.resolve(__dirname, './packages/sdk/src/index.ts'),
    },
  },
  test: {
    root: path.resolve(__dirname),
    globals: true,
    environment: 'node',
    include: [
      'packages/**/tests/**/*.test.ts',
      'apps/api/tests/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'packages/core/src/**/*.ts',
        'packages/sdk/src/**/*.ts',
      ],
      exclude: [
        '**/tests/**',
        '**/*.test.ts',
        '**/types.ts',
        '**/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
