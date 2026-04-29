/**
 * Start Vite for local development. If the banking API is not already up on
 * NOTIFY_PORT (from server/.env), starts server/index.js first so /api proxy
 * always has a backend (avoids HTML 404 responses from an empty port).
 */
import http from 'node:http'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

/** Dotenv 17+ re-reads quiet from process.env after merge; pin so .env cannot turn logs back on. */
process.env.DOTENV_CONFIG_QUIET = 'true'
dotenv.config({
  path: path.join(root, 'server', '.env'),
  quiet: true,
})

const raw = Number(String(process.env.NOTIFY_PORT ?? '8790').trim())
const apiPort =
  Number.isFinite(raw) && raw > 0 && raw < 65536 ? raw : 8790
const healthUrl = `http://127.0.0.1:${apiPort}/api/health`

function getHealth() {
  return new Promise((resolve) => {
    const req = http.get(healthUrl, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve({
            ok:
              res.statusCode === 200 &&
              json?.ok === true &&
              json?.service === 'banking-api',
          })
        } catch {
          resolve({ ok: false })
        }
      })
    })
    req.on('error', () => resolve({ ok: false }))
    req.setTimeout(1500, () => {
      req.destroy()
      resolve({ ok: false })
    })
  })
}

async function pollHealthy(timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if ((await getHealth()).ok) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

let apiChild = null
let apiStartedByUs = false
let webExited = false

function shutdownFromSignal() {
  if (apiStartedByUs && apiChild && !apiChild.killed) {
    apiChild.kill('SIGTERM')
  }
  process.exit(0)
}

process.on('SIGINT', shutdownFromSignal)
process.on('SIGTERM', shutdownFromSignal)

const alreadyUp = await pollHealthy(2000)

if (alreadyUp) {
  console.log(
    `[dev-web] API already healthy on port ${apiPort}. Starting Vite (proxy /api → ${healthUrl.replace('/api/health', '')}).`,
  )
} else {
  console.log(
    `[dev-web] Starting API on port ${apiPort} (server/index.js), then Vite. To use a different port, set NOTIFY_PORT in server/.env.`,
  )
  apiChild = spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
  })
  apiStartedByUs = true
  apiChild.on('exit', (code, signal) => {
    if (webExited) return
    const why =
      signal != null ? `signal ${signal}` : `code ${code ?? 'unknown'}`
    console.error(`[dev-web] API process exited (${why}).`)
    process.exit(code === 0 || code == null ? 1 : code)
  })
  if (!(await pollHealthy(45_000))) {
    console.error(
      `[dev-web] API did not become healthy at ${healthUrl}. Check NOTIFY_PORT in server/.env or port conflicts.`,
    )
    if (apiChild && !apiChild.killed) apiChild.kill('SIGTERM')
    process.exit(1)
  }
}

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const viteArgs = process.argv.slice(2)
const webChild = spawn(process.execPath, [viteBin, ...viteArgs], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
})

webChild.on('exit', (code, signal) => {
  webExited = true
  if (apiStartedByUs && apiChild && !apiChild.killed) {
    apiChild.kill('SIGTERM')
  }
  if (signal) {
    process.exit(1)
  }
  process.exit(code ?? 0)
})
