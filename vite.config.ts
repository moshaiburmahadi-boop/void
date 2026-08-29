import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiRoutesPlugin(): Plugin {
  return {
    name: 'api-routes-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        try {
          const parsedUrl = new URL(req.url, 'http://localhost');
          const pathname = parsedUrl.pathname;
          const relativePath = pathname.replace(/^\/api\//, '');

          let handlerModule: any = null;
          try {
            handlerModule = await server.ssrLoadModule(`/api/${relativePath}.ts`);
          } catch {
            try {
              handlerModule = await server.ssrLoadModule(`/api/${relativePath}/index.ts`);
            } catch (e) {
              console.warn(`[API Router] Not found: ${pathname}`);
            }
          }

          if (handlerModule && typeof handlerModule.default === 'function') {
            await handlerModule.default(req, res);
            return;
          }

          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `API route ${pathname} not found` }));
        } catch (err: any) {
          console.error('[API Router Error]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal API Error' }));
          }
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiRoutesPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
