import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Unit tests cover pure scheduling logic only (no DB, no React).
// Scoped to tests/** so the full Next app is never pulled into the test graph.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
