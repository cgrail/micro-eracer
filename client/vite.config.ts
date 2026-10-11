import { brotliCompressSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';
import { sharePreview } from './share/plugin.ts';

// a Brotli copy of each script and stylesheet, which server/src/index.ts sends instead:
// about 20% smaller than what Caddy compresses on the fly
const brotli: Plugin = {
  name: 'brotli',
  enforce: 'post',
  generateBundle(_, bundle) {
    for (const f of Object.values(bundle)) {
      if (!/\.(js|css)$/.test(f.fileName)) continue;
      this.emitFile({ type: 'asset', fileName: `${f.fileName}.br`, source: brotliCompressSync(f.type === 'chunk' ? f.code : f.source) });
    }
  },
};

export default defineConfig({
  plugins: [sharePreview(), brotli],
  build: {
    // the libraries (Three.js most of it) change only with a dependency update, so returning players keep them across deploys
    chunkSizeWarningLimit: 1200,
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'vendor', test: /node_modules[\\/]/ }] } } },
  },
});
