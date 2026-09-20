import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '127.0.0.1', strictPort: true,
    proxy: { '/api': { target: process.env.ARTIFACT_API_ORIGIN ?? 'http://127.0.0.1:4317', changeOrigin: true } },
  },
});
