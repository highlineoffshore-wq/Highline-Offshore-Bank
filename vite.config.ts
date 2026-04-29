import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Same file + precedence as `server/index.js` (dotenv does not override existing env vars). */
if (!Object.prototype.hasOwnProperty.call(process.env, 'DOTENV_CONFIG_QUIET')) {
  process.env.DOTENV_CONFIG_QUIET = 'true'
}
dotenv.config({
  path: path.join(__dirname, 'server', '.env'),
  quiet: true,
})

const rawNotify = Number(
  String(process.env.NOTIFY_PORT ?? '8790').trim(),
)
const apiPort =
  Number.isFinite(rawNotify) && rawNotify > 0 && rawNotify < 65536
    ? rawNotify
    : 8790
const apiTarget = `http://127.0.0.1:${apiPort}`

/**
 * Forward `/api/*` to the Node banking API. Registered at the front of the
 * Connect stack so no other dev middleware (SPA fallback, etc.) can answer
 * /api with HTML before this runs.
 */
function attachBankingApiProxy(middlewares: Connect.Server, targetStr: string) {
  const u = new URL(targetStr)
  const isHttps = u.protocol === 'https:'
  const port = u.port ? Number(u.port) : isHttps ? 443 : 80
  const { hostname } = u
  const hostHeader = u.port ? `${hostname}:${u.port}` : hostname
  const requester = isHttps ? https.request : http.request

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const path =
      (req as Connect.IncomingMessage).originalUrl ?? req.url ?? ''
    if (!path.startsWith('/api')) {
      next()
      return
    }

    const headers = { ...(req.headers as http.IncomingHttpHeaders) } as Record<
      string,
      string | string[] | undefined
    >
    headers.host = hostHeader
    delete headers.connection

    const opt: http.RequestOptions = {
      hostname,
      port,
      path,
      method: req.method,
      headers,
    }

    const pReq = requester(opt, (pRes) => {
      try {
        res.writeHead(pRes.statusCode ?? 502, pRes.headers)
        pRes.pipe(res)
      } catch (e) {
        if (!res.headersSent) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              ok: false,
              error: `Dev proxy response error: ${e instanceof Error ? e.message : String(e)}`,
            }),
          )
        }
      }
    })

    pReq.on('error', (err) => {
      if (res.headersSent || res.writableEnded) return
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({
          ok: false,
          error: `Dev proxy could not reach ${targetStr}: ${err.message}`,
        }),
      )
    })

    req.on('aborted', () => {
      pReq.destroy()
    })

    req.pipe(pReq)
  }

  const stack = middlewares.stack
  if (Array.isArray(stack)) {
    stack.unshift({ route: '', handle: handler })
  } else {
    middlewares.use(handler)
  }
}

function bankingApiProxyPlugin(target: string): Plugin {
  const runHealthProbe = () => {
    setTimeout(() => {
      void fetch(`${target}/api/health`)
        .then(async (r) => {
          const text = await r.text()
          let body: { ok?: unknown; service?: unknown }
          try {
            body = JSON.parse(text) as typeof body
          } catch {
            body = {}
          }
          if (
            !r.ok ||
            body.ok !== true ||
            body.service !== 'banking-api'
          ) {
            console.warn(
              `[vite] API at ${target} did not return expected health JSON (service: banking-api). Is the API running on NOTIFY_PORT?`,
            )
          }
        })
        .catch(() => {
          console.warn(
            `[vite] Could not reach ${target}. Run npm run dev or npm run dev:api (or npm run dev:web).`,
          )
        })
    }, 2000)
  }

  return {
    name: 'banking-api-proxy',
    enforce: 'pre',
    configureServer: {
      order: 'pre',
      handler(server) {
        console.log(
          `[vite] Dev /api -> ${target} (NOTIFY_PORT=${String(apiPort)}, manual forward, stack prepend)`,
        )
        attachBankingApiProxy(server.middlewares, target)
        runHealthProbe()
      },
    },
    configurePreviewServer: {
      order: 'pre',
      handler(server) {
        console.log(`[vite] Preview /api -> ${target} (manual forward, stack prepend)`)
        attachBankingApiProxy(server.middlewares, target)
      },
    },
  }
}

export default defineConfig({
  plugins: [
    bankingApiProxyPlugin(apiTarget),
    react(),
    tailwindcss(),
  ],
})
