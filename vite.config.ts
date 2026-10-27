import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import * as esbuild from 'esbuild';

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    {
      name: 'build-extension-scripts',
      async closeBundle() {
        // Build isolated scripts (hook, content, background)
        await esbuild.build({
          entryPoints: [resolve(__dirname, 'src/injected/hook.ts')],
          outfile: resolve(__dirname, 'dist/hook.js'),
          bundle: true,
          format: 'iife',
          target: 'es2022'
        });

        await esbuild.build({
          entryPoints: [resolve(__dirname, 'src/content/content.ts')],
          outfile: resolve(__dirname, 'dist/content.js'),
          bundle: true,
          format: 'iife',
          target: 'es2022'
        });

        await esbuild.build({
          entryPoints: [resolve(__dirname, 'src/background/background.ts')],
          outfile: resolve(__dirname, 'dist/background.js'),
          bundle: true,
          format: 'esm',
          target: 'es2022'
        });

        console.log('✓ Extension scripts (hook, content, background) built successfully');
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, 'devtools.html'),
        panel: resolve(__dirname, 'panel.html'),
        popup: resolve(__dirname, 'popup.html')
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});
