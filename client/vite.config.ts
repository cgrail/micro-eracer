import { defineConfig } from 'vite';
import { sharePreview } from './share/plugin.ts';

export default defineConfig({
  plugins: [sharePreview()],
  build: {
    // the libraries (Three.js most of it) change only with a dependency update, so returning players keep them across deploys
    chunkSizeWarningLimit: 1200,
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'vendor', test: /node_modules[\\/]/ }] } } },
  },
});
