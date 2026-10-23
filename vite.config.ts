import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // The browser sees a single origin (http://localhost:5173); Vite forwards /api to the backend.
      // The proxy must stay transparent: no `rewrite`, no `headers`, no `cookieDomainRewrite`/
      // `cookiePathRewrite`, and `changeOrigin: false`. The backend requires `Origin` to be exactly
      // http://localhost:5173 on POST /auth/refresh and /auth/logout (403 otherwise), and the HttpOnly
      // `rt` cookie (Secure, SameSite=Strict, Path=/api/v1/auth) must reach the browser untouched.
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: false,
      },
    },
  },
});
