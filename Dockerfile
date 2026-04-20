FROM node:20-bookworm AS builder

WORKDIR /workspace

# Build tools for native modules (sqlite3, sharp).
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy only manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/

RUN npm ci
RUN cd backend && npm ci
# Force native sqlite3 to compile against this image's glibc.
# Do this AFTER install so other native deps (e.g. sharp) can use prebuilt binaries.
RUN cd backend && npm rebuild sqlite3 --build-from-source
RUN cd frontend && npm ci

COPY backend ./backend
COPY frontend ./frontend

RUN npm run build

# Remove backend devDependencies for a smaller runtime copy.
RUN cd backend && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /workspace
ENV NODE_ENV=production

# PM2 is used as the container entrypoint (as before).
RUN npm install -g pm2@latest && npm cache clean --force

COPY --from=builder /workspace/backend/dist ./backend/dist
COPY --from=builder /workspace/backend/package.json ./backend/package.json
COPY --from=builder /workspace/backend/node_modules ./backend/node_modules
COPY --from=builder /workspace/frontend-dist ./frontend-dist

# Persist DB + uploads via a volume in production.
VOLUME ["/workspace/data"]

USER node
EXPOSE 3077

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3077/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["pm2-runtime", "start", "backend/dist/server.js", "--name", "alrusco-backend"]
