# Remote Access Hardening (No IP Allow Lists)

This guide hardens public remote access to all current subdomains while removing
LAN-only Access Lists from Nginx Proxy Manager (NPM).

## 1) Update NPM Proxy Hosts

Apply to each host:

- `homeassistant.alrusco.com`
- `plantmonitor.alrusco.com`
- `sonarr.alrusco.com`
- `radarr.alrusco.com`
- `qbittorrent.alrusco.com`
- `deluge.alrusco.com`

For each proxy host in NPM:

1. **Details**
   - Domain name is exact and correct.
   - Forward host/port points to the correct upstream app.
2. **SSL**
   - Valid cert selected for that hostname (or wildcard cert).
   - Enable **Force SSL**.
   - Enable HTTP/2 and HSTS (if available and desired).
3. **Access List**
   - Remove the LAN-only allow list.
   - Attach an auth-protected access list (HTTP Basic Auth users/groups).
4. **Advanced**
   - Keep/enable websocket support if app requires it.

## 2) Keep App-Level Authentication On

- Home Assistant: local auth enabled.
- Sonarr/Radarr/qBittorrent/Deluge: app authentication enabled.
- Plant Monitor: add app auth if available; otherwise keep NPM auth strict.

## 3) 2FA Checklist

- Alrusco admin: already TOTP-based.
- Home Assistant: enable MFA for admin users.
- Any app that supports TOTP/WebAuthn: enable it for admin accounts.

## 4) Reverse Proxy Trust

Home Assistant `configuration.yaml`:

```yaml
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 172.17.0.0/16
```

Use a narrower trusted proxy range if you know the exact NPM container IP/network.

## 5) External Validation

From a non-LAN network (mobile data):

1. Open each subdomain and confirm auth challenge appears.
2. Authenticate and confirm upstream app loads.
3. Confirm no `403` from allow-list policies.
4. Confirm no TLS hostname errors:
   - Browser should not show certificate/SNI mismatch.
5. Check logs:
   - NPM access logs for status codes and upstream route.
   - Home Assistant logs for proxy forwarding errors.

## 6) Lockout Safety

Before bulk changes:

- Export NPM config backup.
- Keep one emergency admin path active:
  - LAN-only host, VPN path, or local URL.
- Test one app first, then roll out to remaining apps.
