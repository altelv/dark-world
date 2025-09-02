import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("./src/engine", import.meta.url)),
      "@types": fileURLToPath(new URL("./src/types", import.meta.url)),
      "@store": fileURLToPath(new URL("./src/store", import.meta.url)),
      "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
      "@orchestrator": fileURLToPath(new URL("./src/orchestrator", import.meta.url)),
      "@data": fileURLToPath(new URL("./src/game/data", import.meta.url)),
      "@utils": fileURLToPath(new URL("./src/utils", import.meta.url))
    }
  },
  server: { port: 5173 },
  preview: { port: 5173 },
  build: { sourcemap: true }
})
