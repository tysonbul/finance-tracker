import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000, // PDF parsing can be slow
    pool: 'forks',       // Better CJS/ESM interop for legacy pdfjs
  },
})
