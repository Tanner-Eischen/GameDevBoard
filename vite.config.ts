import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(async ({ command }) => {
  const isDev = command === 'serve';
  const isBuild = command === 'build';

  const plugins = [
    react(),
    ...(isDev ? [runtimeErrorOverlay()] : []),
    ...(isBuild ? [visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
    })] : []),
    ...(isDev && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ];

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom'],
            'konva-vendor': ['react-konva', 'konva'],
            'query-vendor': ['@tanstack/react-query'],
            'ui-vendor': ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
            
            // Feature chunks
            'physics': [
              './client/src/utils/physics/PhysicsEngine.ts',
              './client/src/utils/physics/Vector2.ts',
              './client/src/utils/physics/AABB.ts',
            ],
            'collaboration': [
              './client/src/services/collaboration.ts',
            ],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-konva', 'konva'],
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
      hmr: false, // Disable Hot Module Replacement
      watch: {
        ignored: ['**/*'] // Disable file watching completely
      },
      // Proxy API, objects, and websocket traffic to backend dev server
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          ws: false,
        },
        '/objects': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:5000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
    esbuild: {
      // Disable HMR at the esbuild level as well
      define: {
        'import.meta.hot': 'undefined'
      }
    },
  };
});
