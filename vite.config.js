import { defineConfig } from 'vite';
import { resolve } from 'path';
import { globSync } from 'glob';
import { cpSync, copyFileSync } from 'fs';

export default defineConfig({
  root: '.',
  base: '/',
  plugins: [
    {
      name: 'copy-app-assets',
      apply: 'build',
      enforce: 'post',
      closeBundle() {
        cpSync(resolve(__dirname, 'snapverse/src'), resolve(__dirname, 'dist/snapverse/src'), { recursive: true });
        copyFileSync(resolve(__dirname, 'sw.js'), resolve(__dirname, 'dist/sw.js'));
        copyFileSync(resolve(__dirname, 'sw.js'), resolve(__dirname, 'dist/snapverse/sw.js'));
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: [
        resolve(__dirname, 'index.html'),
        resolve(__dirname, 'login.html'),
        ...globSync('snapverse/*.html').map(file => resolve(__dirname, file)),
      ],
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});

