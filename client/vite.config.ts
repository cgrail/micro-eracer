import { execSync } from 'node:child_process';
import { brotliCompressSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';
import { sharePreview } from './share/plugin.ts';

// which build this is, for the About dialog (client/src/about.ts): the commit, which update.sh and install.sh pass as COMMIT
// (the deployed copy has no .git), and when it was built
const git = () => { try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const commit = /^[0-9a-f]{40}$/.exec(process.env.COMMIT || git())?.[0] ?? '';

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
  define: { __COMMIT__: JSON.stringify(commit), __BUILT__: JSON.stringify(new Date().toISOString()) },
  build: {
    // the libraries (Three.js most of it) change only with a dependency update, so returning players keep them across deploys
    chunkSizeWarningLimit: 1200,
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'vendor', test: /node_modules[\\/]/ }] } } },
  },
});
