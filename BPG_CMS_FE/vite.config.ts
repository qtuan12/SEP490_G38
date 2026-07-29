import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let pwaPlugin: any = null
try {
  const { VitePWA } = require('vite-plugin-pwa')
  if (VitePWA) {
    pwaPlugin = VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      devOptions: {
        enabled: true,
        type: 'module'
      },
      manifest: {
        name: 'BPG CMS',
        short_name: 'BPG CMS',
        description: 'BPG Construction Management System - Field Mode',
        theme_color: '#863bff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/field?standalone=true',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    })
  }
} catch {
  // Fallback cleanly if vite-plugin-pwa is not in node_modules
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    ...(pwaPlugin ? [pwaPlugin] : []),
  ],
})
