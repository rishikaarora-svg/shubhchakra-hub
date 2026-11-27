import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleAnalyzeRequest } from './server/analyze-waste.js'

// Serves /api/analyze-waste during `npm run dev` with the same handler the Vercel function uses.
function apiDevServer(env) {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use('/api/analyze-waste', async (req, res) => {
        let raw = ''
        for await (const chunk of req) raw += chunk
        let body = null
        try { body = JSON.parse(raw) } catch { /* handled by validator */ }
        const { status, body: out } = await handleAnalyzeRequest({ method: req.method, body, origin: req.headers.origin, host: req.headers.host, env })
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(out))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // '' prefix = load all vars (incl. GEMINI_API_KEY) for the dev server only; Vite still exposes only VITE_* to the browser.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  return { plugins: [react(), tailwindcss(), apiDevServer(env)] }
})
