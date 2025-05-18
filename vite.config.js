import { defineConfig } from 'vite'

import solidPlugin from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    solidPlugin(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'tools': ['@tanstack/solid-query', 'solid-transition-group', '@tanstack/solid-router-devtools', '@kobalte/core'],
        },
      },
    },
  },
})
