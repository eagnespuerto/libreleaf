import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` lets the same build run from GitHub Pages, a subfolder and Tauri.
export default defineConfig({
  base: './',
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 1200 },
});
