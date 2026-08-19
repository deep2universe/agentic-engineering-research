import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __TEST__: 'true',
    __VERSION__: '"1.0.0"',
  },
  test: {
    include: ['tests/einheit/**/*.test.ts', 'tests/loesbarkeit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/einheit/setup.ts'],
    testTimeout: 120_000,
    reporters: process.env.CI ? ['default'] : ['default'],
  },
});
