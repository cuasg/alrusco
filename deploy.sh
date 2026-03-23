#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="alrusco-site"
CONTAINER_NAME="alrusco-site"
PORT="3077"
ENV_FILE=".env"
DATA_VOLUME_HOST="/mnt/user/appdata/alrusco-data"
DATA_VOLUME_CONTAINER="/workspace/data"

echo ">>> Stopping and removing existing container (if any)..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo ">>> Building image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo ">>> Running container: $CONTAINER_NAME"
docker run -d \
  --name "$CONTAINER_NAME" \
  --env-file "$ENV_FILE" \
  -p "${PORT}:${PORT}" \
  -v "${DATA_VOLUME_HOST}:${DATA_VOLUME_CONTAINER}" \
  "$IMAGE_NAME"

echo ">>> Done. Container '$CONTAINER_NAME' is running on port ${PORT}."
docker ps --filter "name=${CONTAINER_NAME}"
