import { defineConfig } from 'vite';
import { resolve } from 'path';
import { globSync } from 'glob';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: [
        resolve(__dirname, 'index.html'),
        resolve(__dirname, 'login.html'),
        ...globSync('mini-fb/*.html').map(file => resolve(__dirname, file)),
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
