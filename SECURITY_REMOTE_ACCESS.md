# Remote Access Hardening (Alrusco Session Gate)

This guide locks public app subdomains behind the existing `alrusco` login session.
Users must have a valid `alrusco_session` cookie to reach app UIs.

## 1) Prerequisites in Alrusco

1. Set cookie domain so sibling subdomains receive the session cookie:

```env
COOKIE_DOMAIN=.alrusco.com
```

2. Deploy backend changes that expose:

- `GET /api/auth/proxy-check` (returns `200` when authenticated, `401` otherwise)

3. Confirm app root is publicly reachable as `https://alrusco.com` (or your chosen primary host).

## 2) Target Subdomains

Apply to each public app host:

- `homeassistant.alrusco.com`
- `plantmonitor.alrusco.com`
- `sonarr.alrusco.com`
- `radarr.alrusco.com`
- `qbittorrent.alrusco.com`
- `deluge.alrusco.com`
- `unraid.alrusco.com` (if intentionally public)

## 3) Nginx Proxy Manager Forward-Auth Setup

For each app proxy host in NPM:

1. **Details**
   - Domain is exact.
   - Forward host/port points to the app upstream.
2. **SSL**
   - Valid cert for hostname or wildcard.
   - Enable **Force SSL**.
3. **Access List**
   - Do not rely on LAN allow-list as primary auth.
4. **Advanced**  
   Use **Home Assistant** vs **other apps** snippets below (replace `YOUR_ALRUSCO_BACKEND_IP`).

### 3a) Home Assistant — use this minimal snippet (recommended)

Home Assistant runs a PWA **service worker** and an OAuth flow (`/auth/authorize`, `/auth/providers`, etc.).  
`error_page 401` + redirect logic has repeatedly caused **`Failed to fetch`**, **`ERR_FAILED`** on `/auth/providers`, and **`FetchEvent` errors** even when logged in.

Use **`auth_request` only** (no `error_page 401` redirect). When not logged into alrusco, the browser shows a **401** — open `https://alrusco.com/login` first, then reload HA.

Verified-working example (replace IP if needed):

```nginx
# Optional: debug auth subrequest status on responses (remove when stable).
auth_request_set $auth_status $upstream_status;
add_header X-Auth-Status $auth_status always;

auth_request /_alrusco_auth_check;

location = /_alrusco_auth_check {
  internal;
  auth_request off;
  proxy_method GET;
  proxy_pass http://YOUR_ALRUSCO_BACKEND_IP:3077/api/auth/proxy-check;
  proxy_pass_request_body off;
  proxy_set_header Content-Length "";
  proxy_set_header Cookie $http_cookie;
  proxy_set_header X-Original-URI $request_uri;
  proxy_set_header X-Original-Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_connect_timeout 5s;
  proxy_read_timeout 5s;
  proxy_send_timeout 5s;
}
```

After pasting: **Application → Service Workers → Unregister** and **Clear site data** for `homeassistant.alrusco.com` once, then hard-reload.

Keep **Websockets Support** enabled for this proxy host.

### 3b) Other apps (Sonarr, Radarr, etc.) — snippet with login redirect

This variant sends humans to the alrusco login page when the gate denies access, while keeping **401** for common static/API paths so browsers do not mis-handle JS/MIME.

```nginx
auth_request /_alrusco_auth_check;
error_page 401 = @alrusco_login;

location = /_alrusco_auth_check {
  internal;
  auth_request off;
  proxy_method GET;
  proxy_pass http://YOUR_ALRUSCO_BACKEND_IP:3077/api/auth/proxy-check;
  proxy_pass_request_body off;
  proxy_set_header Content-Length "";
  proxy_set_header Cookie $http_cookie;
  proxy_set_header X-Original-URI $request_uri;
  proxy_set_header X-Original-Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_connect_timeout 5s;
  proxy_read_timeout 5s;
  proxy_send_timeout 5s;
}

location @alrusco_login {
  if ($request_uri ~* \.(?:js|mjs|css|map|json|wasm|woff2?|ttf|otf|png|jpe?g|gif|ico|svg|webp|avif|heic)(?:$|\?)) {
    return 401;
  }
  if ($request_uri ~* /manifest\.json(?:$|\?)) {
    return 401;
  }
  if ($request_uri ~* ^/(?:api)(?:/|$)) {
    return 401;
  }
  if ($request_uri ~* ^/auth/(?!authorize(?:$|[?/]))) {
    return 401;
  }
  return 302 https://alrusco.com/login?next=$scheme://$host$request_uri;
}
```

Notes:
- If your main site host is `www.alrusco.com`, change the `302` URL to match.
- **Backend:** the global Express rate limiter skips `proxy-check`, favicon, and `GET /assets/*`; default budget is **1200 / 15 min** (override with `GLOBAL_RATE_LIMIT_MAX`). Redeploy after changing `server.ts` or env.

### If you still see `429` on `favicon.ico` or an app UI

- **Requests to `alrusco.com` / your Node site:** raise `GLOBAL_RATE_LIMIT_MAX` in `.env` and restart the container.
- **Requests only on `qbittorrent.*` (or another app host)** that never hit Express: the `429` is from **that app** or **NPM** (custom limit), not alrusco — check qBittorrent / NPM access logs.

### Using the same snippet on other subdomains

- **Home Assistant:** use **3a only** on `homeassistant.alrusco.com`.
- **Everything else:** use **3b** (or **3a** if you prefer a plain 401 when logged out).

**Do not** point `proxy_pass` for `/_alrusco_auth_check` at public `https://alrusco.com` from inside NPM unless hairpin DNS works; prefer internal `http://IP:3077`.

## 4) Keep App-Level Auth Enabled

This gate should be layer 1, not replacement for app auth:

- Home Assistant: keep local auth/MFA on.
- Sonarr/Radarr/qBittorrent/Deluge: keep app auth on.
- Any app with 2FA/WebAuthn support: enable it.

## 5) Validation Checklist

From external network (not LAN):

1. **Logged out** of alrusco:
   - **Apps using 3b:** open subdomain → expect redirect to `https://alrusco.com/login?...`.
   - **Home Assistant (3a):** open subdomain → expect **401**; log in at alrusco, then reload HA.
2. **Logged in** to alrusco:
   - Open same subdomain.
   - Confirm app loads (HA: `/auth/providers` should be **200** JSON, not `ERR_FAILED`).
3. **Logout** from alrusco:
   - Retry subdomain.
   - Confirm blocked (401 or redirect per snippet).
4. Confirm no TLS warnings and no auth loop.

## 6) Lockout Safety

Before bulk rollout:

- Export NPM backup.
- Test one subdomain first.
- Keep an emergency admin path (VPN/LAN-local URL) until all hosts validate.
