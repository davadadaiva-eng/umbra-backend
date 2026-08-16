#!/usr/bin/env bash
# Deploy Umbra OS to the cloud VPS.
# Usage: HOST=user@1.2.3.4 ./scripts/deploy.sh
set -euo pipefail

HOST="${HOST:-}"
if [ -z "$HOST" ]; then
  echo "Set HOST=user@your-vps ./scripts/deploy.sh" >&2
  exit 1
fi

echo "→ Building the image locally…"
docker build -t umbra-os:latest .

echo "→ Shipping to $HOST…"
docker save umbra-os:latest | gzip | ssh "$HOST" 'gunzip | docker load'

echo "→ Starting via docker-compose on the server…"
scp docker-compose.yml "$HOST":~/umbra/docker-compose.yml
scp -r deploy "$HOST":~/umbra/   # Caddyfile + turnserver.conf for the edge profile
ssh "$HOST" 'cd ~/umbra && docker compose up -d --remove-orphans'

echo "✓ Deployed. API: http://<server-ip>:8787/api/health"
