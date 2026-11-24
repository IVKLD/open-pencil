#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

DEPLOY_HOST="${DEPLOY_HOST:-deploy@188.245.235.82}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/maker.ginko.services}"

if [[ "${1:-}" == "--full" ]]; then
  echo "==> Building all workspace packages..."
  bun run build:packages
else
  echo "==> Building @open-pencil/core and @open-pencil/vue..."
  bun run --filter @open-pencil/core build
  bun run --filter @open-pencil/vue build
fi

echo "==> Building production bundle (vite build)..."
bunx vite build

echo "==> Deploying dist/ to ${DEPLOY_HOST}:${DEPLOY_PATH}..."
tar -C dist -czf - . | ssh -o BatchMode=yes "$DEPLOY_HOST" \
  "mkdir -p '$DEPLOY_PATH' && rm -rf '$DEPLOY_PATH/assets' && tar -C '$DEPLOY_PATH' -xzf -"

echo "==> Deployed successfully to ${DEPLOY_HOST}:${DEPLOY_PATH}!"
