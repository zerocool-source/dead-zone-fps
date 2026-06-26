import { defineConfig } from 'vite';

export default defineConfig({
  // host:true binds 0.0.0.0; allowedHosts:true lets the platform's proxy/preview
  // domain through (Vite otherwise blocks unknown Host headers with "Blocked request").
  server: { host: true, port: 3000, strictPort: true, allowedHosts: true },
  preview: { host: true, port: 3000, strictPort: true, allowedHosts: true },
  build: { outDir: 'dist' },
});
