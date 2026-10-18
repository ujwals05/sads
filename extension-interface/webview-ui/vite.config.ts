import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: fileURLToPath(
      new URL('../media/webview-ui', import.meta.url)
    ),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
});

