import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Serve files from the `docs` folder as static public assets
  publicDir: 'docs'
})
