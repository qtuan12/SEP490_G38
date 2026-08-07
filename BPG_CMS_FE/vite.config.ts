import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Chỉ có hiệu lực khi biến môi trường VITE_DEV_TUNNEL_HOST được set (dùng bởi
    // test-mobile-pwa.ps1 khi test qua tunnel HTTPS) — mặc định không ảnh hưởng gì.
    allowedHosts: process.env.VITE_DEV_TUNNEL_HOST ? ['.trycloudflare.com'] : undefined,
    hmr: {
      protocol: 'wss',
      host: 'localhost',
    },
  },
  plugins: [
    // Mặc định dev chạy HTTP: localhost vốn đã là secure context nên service worker/PWA vẫn
    // hoạt động, còn test-mobile-pwa.ps1 thì lấy HTTPS từ cloudflared (tunnel trỏ vào
    // http://localhost:5173). Bật chứng chỉ tự ký chỉ khi thật sự cần: VITE_FORCE_HTTPS=1.
    ...(process.env.VITE_FORCE_HTTPS ? [basicSsl()] : []),
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'logo.png'],
      devOptions: {
        enabled: true,
        type: 'module'
      },
      manifest: {
        name: 'BPG CMS - Quản Lý Thi Công Xây Dựng',
        short_name: 'BPG CMS',
        description: 'BPG Construction Management System - Quản Lý Thi Công & Vật Tư Công Trình',
        theme_color: '#2563eb',
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
});
