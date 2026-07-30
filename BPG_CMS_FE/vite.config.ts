import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Chỉ có hiệu lực khi biến môi trường VITE_DEV_TUNNEL_HOST được set (dùng bởi
    // test-mobile-pwa.ps1 khi test qua tunnel HTTPS) — mặc định không ảnh hưởng gì.
    // Cho phép cả dải ".trycloudflare.com" (không khớp đúng 1 subdomain cụ thể) vì
    // cloudflared quick tunnel sinh domain ngẫu nhiên mỗi lần chạy — khớp cứng 1 domain
    // rất dễ lệch (dùng nhầm link cũ, tunnel tự nối lại với domain khác...).
    allowedHosts: process.env.VITE_DEV_TUNNEL_HOST ? ['.trycloudflare.com'] : undefined,
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
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
    }),
  ],
})
