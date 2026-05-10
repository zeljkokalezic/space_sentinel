import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/space_sentinel/',
  plugins: [
    tailwindcss(),
    react(),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.js'],
  },
})
