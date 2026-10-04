import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const API = process.env.API_URL ?? 'http://127.0.0.1:8000'

// One id per build: the commit when the host gives us one, else the build time.
const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RENDER_GIT_COMMIT ?? process.env.GIT_SHA
const BUILD_ID = `${sha ? sha.slice(0, 7) : 'local'}-${Date.now().toString(36)}`

/** Writes dist/version.json so open tabs can notice a newer deploy. */
const versionFile = (): Plugin => ({
  name: 'ruckus-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID, at: Date.now() }) })
  },
})

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_AT__: JSON.stringify(Date.now()),
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': API,
      '/ws': { target: API.replace(/^http/, 'ws'), ws: true },
    },
  },
})
