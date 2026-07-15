import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ai-canvas/workflow-core': resolve(__dirname, '../../packages/workflow-core/src/index.ts'),
      '@ai-canvas/canvas-engine': resolve(__dirname, '../../packages/canvas-engine/src/index.ts'),
    },
  },
});
