FROM node:20-bookworm

WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    git \
    curl \
    nano \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g \
    vite \
    nodemon \
    pm2

COPY package.json package-lock.json* ./
COPY backend ./backend
COPY frontend ./frontend

RUN npm install && \
    cd backend && npm install && \
    cd /workspace/frontend && npm install && \
    cd /workspace && npm run build

EXPOSE 3077

CMD ["pm2-runtime", "start", "backend/dist/server.js", "--name", "alrusco-backend"]
