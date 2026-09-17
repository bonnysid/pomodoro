import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(
      JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version,
    ),
  },
  plugins: [
    react(),
    {
      name: 'local-development-csp',
      apply: 'serve',
      transformIndexHtml: {
        order: 'pre',
        // React's development refresh preamble is inline; packaged builds keep the strict policy.
        handler: (html) => html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';"),
      },
    },
  ],
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: 'dist', sourcemap: true },
});
