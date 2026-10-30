import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages 部署在 /IDC-MO-2/ 子路径下；本地开发忽略 base
  base: process.env.GITHUB_ACTIONS ? '/IDC-MO-2/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
