# alrusco

Personal portfolio and small **hub** site: editable homepage, project showcase (including optional **GitHub repo sync**), photo albums, and authenticated admin for content. The Express API serves a React SPA and static uploads.

## Stack

| Layer    | Tech                                              |
| -------- | ------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, React Router          |
| Backend  | Node.js 20, Express, TypeScript                    |
| Data     | SQLite (`data/auth.db`) — users, projects, photos |
| Media    | Local disk under `data/uploads` (ignored by git)   |

## Features (high level)

- **Home** — Public content from API; optional banner image; signed-in users can edit copy/highlights.
- **Projects** — Categories, tags, long-form body; admin CRUD; optional import from GitHub (Settings + sync).
- **Photos** — Albums & project-linked galleries, covers, drag-and-drop / bulk upload when signed in.
- **Auth** — Session cookie + JWT; password change; TOTP-ready backend (`otplib`).
- **Portfolio** — Additional curated view (see app routes).

## Prerequisites

- **Node.js 20+** and npm  
- **Native build tools** for `sqlite3` / `sharp` on your OS (Windows: build tools; Linux: `build-essential`).

## Quick start (development)

Run **backend** and **frontend** in two terminals from the repo root.

```bash
# 1) Install dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 2) Environment — copy example and edit secrets
cp .env.example .env
# Set at least JWT_SECRET; see Environment section below.

# 3) Terminal A — API (default http://localhost:3077)
npm run dev:backend

# 4) Terminal B — Vite dev server (http://localhost:5173, proxies /api and /apps)
cd frontend && npm run dev
```

Open **http://localhost:5173**.

**First admin (empty database only):** `POST /api/auth/bootstrap` with JSON `{ "username": "...", "password": "..." }` (e.g. via curl or your API client). This works only while there are **zero** users in the DB. The response includes a TOTP setup URI for your authenticator app; complete TOTP before relying on login in production.

**Production:** Bootstrap is **disabled** unless you set `ALLOW_BOOTSTRAP=true` for that one request, then remove it—so a stranger can’t create the first admin on a fresh public deploy.

## Production build

From the **repository root**:

```bash
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
npm run build
npm start
```

This compiles the backend to `backend/dist/`, builds the frontend to **`frontend-dist/`** (sibling of `frontend/`), and starts `node backend/dist/server.js`. The server serves the SPA from `frontend-dist` when that folder exists.

Default listen port: **3077** (override with `PORT`).

## Docker

A **Dockerfile** is included: it installs dependencies, runs `npm run build`, and starts the compiled server with `pm2-runtime` on port **3077**.

```bash
docker build -t alrusco .
docker run -p 3077:3077 --env-file .env -v alrusco-data:/workspace/data alrusco
```

Mount or persist **`/workspace/data`** so SQLite and uploads survive container restarts.

## Environment variables

Copy [`.env.example`](./.env.example) to `.env` and adjust.

| Variable | Purpose |
| -------- | ------- |
| `NODE_ENV` | Set to `production` for live sites (enables production checks) |
| `JWT_SECRET` | Sign session cookies — **production: required, ≥32 chars, not a placeholder** |
| `ALLOW_BOOTSTRAP` | `true` only once for first admin in production; then unset |
| `ENABLE_HSTS` | `true` if the app is always reached via HTTPS (sends Strict-Transport-Security) |
| `JSON_BODY_LIMIT` | Max JSON body size (default `512kb`) |
| `GLOBAL_RATE_LIMIT_MAX` | Requests per IP per 15 min for most routes (default `300`; health check excluded) |
| `EXTEND_SESSION_RATE_LIMIT_MAX` | Session-extension calls per IP per hour (default `40`) |
| `WEATHER_FIXED_LOCATION` | `true` to ignore client `?lat`/`?lon` and use only env coordinates |
| `CSP_DISABLE` | `true` disables Content-Security-Policy (debug only; avoid in production) |
| `DEBUG_PHOTOS_API` | `true` logs public photos API query details (default off) |
| `CREDENTIALS_ENCRYPTION_KEY` | 32-byte key (hex or base64) to encrypt GitHub PAT stored from Settings UI |
| `PORT` | HTTP port (default `3077`) |
| `TRUST_PROXY_HOPS` | Set when behind a reverse proxy (default `1`) |
| `GITHUB_TOKEN`, `GITHUB_USERNAME`, `GITHUB_ORG` | Optional overrides for GitHub sync (else use Settings UI) |
| `GITHUB_SYNC_EXCLUDE_FORKS`, `GITHUB_SYNC_EXCLUDE_ARCHIVED` | Optional (`false` to include) |

Never commit `.env` — it is listed in `.gitignore`.

## Repository layout

```
alrusco/
├── backend/src/       # Express app, routes, auth, SQLite migrations in init
├── frontend/src/      # React app
├── frontend-dist/     # Production build output (gitignored)
├── data/              # Runtime DB + uploads (gitignored)
├── .env.example
├── Dockerfile
└── package.json       # Root scripts: build, start, dev:backend
```

## Scripts (root `package.json`)

| Script | Description |
| ------ | ----------- |
| `npm run dev:backend` | Run API with ts-node-dev (hot reload) |
| `npm run build:backend` | `tsc` in `backend/` |
| `npm run build:frontend` | Production build in `frontend/` → `frontend-dist/` |
| `npm run build` | Backend + frontend build |
| `npm start` | Run compiled backend (`backend/dist/server.js`) |

Frontend-only: `cd frontend && npm run dev` / `npm run build`.

## Reverse proxy

If you terminate TLS in Nginx, Caddy, or Nginx Proxy Manager, point traffic to the Node port and set **`TRUST_PROXY_HOPS`** appropriately so rate limiting and `req.ip` stay correct. Use **HTTPS** in the browser; session cookies are **Secure** in production.

## Security (production)

- **Secrets:** Strong `JWT_SECRET`; `CREDENTIALS_ENCRYPTION_KEY` if you store a GitHub PAT in Settings; never commit `.env`.
- **Bootstrap:** Keep `ALLOW_BOOTSTRAP` unset except for the very first admin user on a new deploy.
- **Headers:** Helmet is enabled with a **Content-Security-Policy** tuned for this SPA (same-origin scripts/assets, WebGL Earth + OSM tiles, dashboard Simple Icons CDN, `blob:`/`data:` where needed). Set **`CSP_DISABLE=true`** only if you must debug a blocked resource. Optionally set **`ENABLE_HSTS=true`** once HTTPS is correct end-to-end.
- **Rich text:** User-editable HTML (projects body, descriptions, home copy) is sanitized with **sanitize-html** (allow-list tags/attributes; safe link schemes).
- **Uploads:** JPEG/PNG/WebP/GIF/HEIC only; content is checked with **sharp** (blocks mismatched / hostile types such as SVG-as-image).
- **Weather:** Use **`WEATHER_FIXED_LOCATION=true`** so anonymous clients can’t pick arbitrary coordinates for your API key.
- **Rate limits:** Global limit + stricter auth login limits; session **extend** is capped per hour per IP.
- **Exposure:** Prefer not publishing services you don’t need; keep the NAS admin UI off the public internet.

### Production checklist (operations)

Revisit periodically (e.g. quarterly):

1. **HTTPS** — Browsers hit the site over TLS; reverse proxy certificates valid.
2. **`TRUST_PROXY_HOPS`** — Matches how many proxies sit in front of Node (often `1` for a single NPM/Caddy hop).
3. **`ENABLE_HSTS`** — Enable after confirming HTTPS is always used for this hostname.
4. **`WEATHER_FIXED_LOCATION`** — `true` in production if weather is enabled.
5. **`npm audit`** — Run in `backend/` and `frontend/`; apply patches or review advisories; rebuild images after base image updates.
6. **Backups** — SQLite + `data/uploads` encrypted at rest where stored; avoid public buckets with secrets.

## License

ISC (per `package.json` files). Add or change a `LICENSE` file if you want something more specific.

---

**alrusco** — a small self-hosted site for projects, photos, and home-lab style content.
