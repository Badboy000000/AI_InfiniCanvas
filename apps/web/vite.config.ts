import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ai-canvas/workflow-core': resolve(__dirname, '../../packages/workflow-core/src/index.ts'),
      '@ai-canvas/canvas-engine': resolve(__dirname, '../../packages/canvas-engine/src/index.ts'),
      '@ai-canvas/node-protocol': resolve(__dirname, '../../packages/node-protocol/src/index.ts'),
      '@ai-canvas/node-definitions': resolve(__dirname, '../../packages/node-definitions/src/index.ts'),
      '@ai-canvas/event-core': resolve(__dirname, '../../packages/event-core/src/index.ts'),
      '@ai-canvas/capability-core': resolve(__dirname, '../../packages/capability-core/src/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
