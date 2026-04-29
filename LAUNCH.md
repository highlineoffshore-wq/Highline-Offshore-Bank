# Go-live checklist

## 1. Build the browser bundle

```bash
npm ci
npm run build
```

Output: `dist/` (uploaded or co-located with the API — see below).

## 2. Configure `server/.env` (never commit)

Copy from `server/.env.example` and set at minimum:

| Variable | Purpose |
|----------|---------|
| `NOTIFY_PORT` | HTTP port the Node process listens on (often `80` / `443` behind a reverse proxy, or an internal port). |
| `NOTIFY_ALLOWED_ORIGINS` | Comma-separated **exact** browser origins that may call the API (`https://app.yourbank.com`). Required for real users: dev-only “localhost” bypass is **off** in production. |
| `ADMIN_API_SECRET` | Long random string (32+ characters). Powers `/admin` operator API (`Authorization: Bearer …`). |
| `TRUST_PROXY_HOPS` | Set to `2` or higher if TLS terminates in front of Node and you rely on `X-Forwarded-*`. |

Optional: `DATABASE_URL`, SMTP fields, `BANKING_LISTEN_HOST` (defaults to `0.0.0.0` in production).

## 3. Same host vs split UI/API

- **Same host (recommended for small deploys):** Leave `VITE_API_BASE` unset when you build. Run `npm start` with `NODE_ENV=production` — Express serves `dist/` and `/api` on one origin.
- **Split (CDN + API):** At build time set `VITE_API_BASE=https://api.yourbank.com` so the static app calls the API cross-origin; keep `NOTIFY_ALLOWED_ORIGINS` aligned with the **site** origin.
- **Netlify (frontend) + Render (API):** Deploy the API on Render (`npm run build` + `npm start` on the web service). Create a Netlify site from the same repo: the repo root `netlify.toml` builds only the Vite app into `dist/` and applies SPA fallback. In Netlify **Environment variables**, set `VITE_API_BASE` to your Render service URL (HTTPS, no trailing slash). On Render, set `NOTIFY_ALLOWED_ORIGINS` to your Netlify site origin (`https://….netlify.app` and any custom domain). Rebuild Netlify when the API URL changes, because `VITE_API_BASE` is baked in at build time.

## 4. Start production

```bash
npm start
```

This runs `NODE_ENV=production node server/index.js`. If `dist/index.html` exists, the API process also serves the SPA; set `BANKING_SERVE_STATIC=0` if you only want JSON routes from this process.

If you inherited an older `server/.env` that used legacy `*_SERVE_STATIC` / `*_LISTEN_HOST` variable names from a prior template, rename them to `BANKING_SERVE_STATIC` and `BANKING_LISTEN_HOST` (see `server/.env.example`).

## 5. Data on the server

`server/data/*.json` (and `users-store.json`) are gitignored by default. On a new machine, create or restore them before first traffic (seed users, bank config, approvals as needed).

## 6. TLS and hardening

Terminate HTTPS at your load balancer or reverse proxy (nginx, Caddy, Cloudflare, etc.), forward to Node, and keep secrets only in env or a secret manager — not in the repo.

## 7. Smoke tests

- `GET /api/health` → JSON with `ok`, `service`, `mode`.
- Open `/` and `/admin/login` in the browser; sign in as a customer and as operator (admin secret).
- Confirm `NOTIFY_ALLOWED_ORIGINS` matches the URL bar origin or CORS will block API calls.
