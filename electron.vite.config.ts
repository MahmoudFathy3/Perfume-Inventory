import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'electron/main.ts' } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: 'electron/preload.ts' } }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: { alias: { '@': resolve('src'), '@shared': resolve('shared') } },
    build: { rollupOptions: { input: 'index.html' } }
  }
})
