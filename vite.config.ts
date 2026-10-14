import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Ensure globalThis.__dirname does not leak as relative '.' into ESM plugins
if (typeof (globalThis as any).__dirname === 'string' && !path.isAbsolute((globalThis as any).__dirname)) {
  delete (globalThis as any).__dirname;
}
if (typeof (globalThis as any).__filename === 'string' && !path.isAbsolute((globalThis as any).__filename)) {
  delete (globalThis as any).__filename;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [],
        manifest: {
          name: 'IMChat - Professional Network',
          short_name: 'IMChat',
          description: 'Connect, Share, and Chat with the World',
          theme_color: '#38bdf8',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiQBJVFxs5w38N3KpXM8ed1fHT_uBoz97uc8gU7VUGnpEDrhFiIq_f0zob3dweIVTEaF_8Opge3uX_Ed1QVh2ADZCcnyZ2xXwPIX9Nl089uWBxZAjqr0jgSfr6DBReyZKmeyI_6MFuS0RajgWyg0_K2ijPWrtk6VsSo5waSR9HOtf-4hs4BMwtwPh6g6vk/s1600/9519a766-e328-404a-b18e-7b7b6d029a15-removebg-preview~2.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiQBJVFxs5w38N3KpXM8ed1fHT_uBoz97uc8gU7VUGnpEDrhFiIq_f0zob3dweIVTEaF_8Opge3uX_Ed1QVh2ADZCcnyZ2xXwPIX9Nl089uWBxZAjqr0jgSfr6DBReyZKmeyI_6MFuS0RajgWyg0_K2ijPWrtk6VsSo5waSR9HOtf-4hs4BMwtwPh6g6vk/s1600/9519a766-e328-404a-b18e-7b7b6d029a15-removebg-preview~2.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'unsplash-images',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/api\/(user-posts|profile|activity|recent-activity).*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'api-user-data-stale-revalidate',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 1 day
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.GOOGLE_API_KEY': JSON.stringify(env.GOOGLE_API_KEY || env.API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'react': path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
