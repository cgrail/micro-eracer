import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { sharePreview } from './share/plugin.ts';

const RAPIER_WASM = join(dirname(createRequire(import.meta.url).resolve('@dimforge/rapier3d-compat')), 'rapier_wasm3d_bg.wasm');
// "AGFzbQ" is the WASM magic number "\0asm" in base64
const INLINE_WASM = /[\w$]+\.toByteArray\("AGFzbQ[\w+/=]*"\)\.buffer/;

/**
 * Rapier's compat build carries its 3 MB of WASM inside the JS as base64: 4 MB more JS to parse, and 440 kB more to download
 * (gzipped) than the binary. The package ships the same bytes as a file, so the build hands `init()` that file's URL instead:
 * the browser fetches it alongside the JS (preloaded from the page), compiles it while it downloads and caches it on its own.
 * Development keeps the inline copy.
 */
function rapierWasmFile(): Plugin {
  return {
    name: 'rapier-wasm-file',
    apply: 'build',
    transform(code, id) {
      if (!/rapier3d-compat[\\/]dist[\\/]rapier\.mjs$/.test(id)) return;
      if (!INLINE_WASM.test(code)) this.error('Rapier no longer inlines its WASM as rapierWasmFile expects: see client/vite.config.ts');
      return `import rapierWasmUrl from ${JSON.stringify(`${RAPIER_WASM}?url`)};\n${code.replace(INLINE_WASM, 'rapierWasmUrl')}`;
    },
    transformIndexHtml(_, ctx) {
      const wasm = Object.values(ctx.bundle ?? {}).find((f) => f.fileName.endsWith('.wasm'));
      if (wasm) return [{ tag: 'link', attrs: { rel: 'preload', href: `/${wasm.fileName}`, as: 'fetch', type: 'application/wasm', crossorigin: true }, injectTo: 'head' }];
    },
  };
}

export default defineConfig({
  plugins: [rapierWasmFile(), sharePreview()],
  build: {
    // the libraries (Three.js most of it) change only with a dependency update, so returning players keep them across deploys
    chunkSizeWarningLimit: 1200,
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'vendor', test: /node_modules[\\/]/ }] } } },
  },
});
