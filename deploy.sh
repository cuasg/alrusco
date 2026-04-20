#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="alrusco-site"
CONTAINER_NAME="alrusco-site"
PORT="3077"
ENV_FILE=".env"
DATA_VOLUME_HOST="/mnt/user/appdata/alrusco-data"
DATA_VOLUME_CONTAINER="/workspace/data"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
BUILD_NO_CACHE="${BUILD_NO_CACHE:-0}"
# On unRAID, bind mounts are typically owned by nobody:users (99:100).
# Run the container as that user so SQLite can write to /workspace/data.
RUN_UID="${RUN_UID:-99}"
RUN_GID="${RUN_GID:-100}"
PM2_HOME_CONTAINER="${PM2_HOME_CONTAINER:-/tmp/.pm2}"
HOME_CONTAINER="${HOME_CONTAINER:-/tmp}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: missing required command: $1" >&2
    exit 1
  }
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "ERROR: required file not found: $1" >&2
    exit 1
  fi
}

echo ">>> Preflight checks..."
require_cmd docker
require_cmd curl
require_file "$ENV_FILE"

mkdir -p "$DATA_VOLUME_HOST"

echo ">>> Ensuring data volume is writable by ${RUN_UID}:${RUN_GID}..."
chown -R "${RUN_UID}:${RUN_GID}" "$DATA_VOLUME_HOST" 2>/dev/null || true

echo ">>> Stopping and removing existing container (if any)..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo ">>> Building image: $IMAGE_NAME"
BUILD_ARGS=()
if [[ "$BUILD_NO_CACHE" == "1" ]]; then
  BUILD_ARGS+=(--no-cache)
fi
docker build "${BUILD_ARGS[@]}" -t "$IMAGE_NAME" .

echo ">>> Running container: $CONTAINER_NAME"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --user "${RUN_UID}:${RUN_GID}" \
  -e "PM2_HOME=${PM2_HOME_CONTAINER}" \
  -e "HOME=${HOME_CONTAINER}" \
  --env-file "$ENV_FILE" \
  -p "${PORT}:${PORT}" \
  -v "${DATA_VOLUME_HOST}:${DATA_VOLUME_CONTAINER}" \
  "$IMAGE_NAME"

echo ">>> Done. Container '$CONTAINER_NAME' is running on port ${PORT}."
docker ps --filter "name=${CONTAINER_NAME}"

echo ">>> Waiting for health check..."
set +e
for i in {1..30}; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo ">>> Healthy: $HEALTH_URL"
    set -e
    exit 0
  fi
  sleep 1
done
set -e

echo "ERROR: health check failed: $HEALTH_URL" >&2
echo ">>> Recent logs:" >&2
docker logs --tail 200 "$CONTAINER_NAME" >&2 || true
exit 1
