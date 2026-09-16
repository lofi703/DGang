#!/usr/bin/env bash
# DGang deploy finalizer: run AFTER dgang.bad.mn DNS -> 140.245.252.78 is live
set -euo pipefail
DOMAIN="dgang.bad.mn"
NGX_AVAIL="/etc/nginx/sites-available/dgang.bad.mn"

echo "[1/3] Verifying DNS..."
IP=$(python3 -c "import socket;print(socket.gethostbyname('$DOMAIN'))" 2>/dev/null || echo "")
echo "  $DOMAIN -> $IP"
if [ "$IP" != "140.245.252.78" ]; then
  echo "  !! DNS not yet pointing here (public IP 140.245.252.78). Abort."
  echo "  Add A record at afraid.org: $DOMAIN -> 140.245.252.78, wait ~5 min, rerun."
  exit 1
fi

echo "[2/3] Issuing Let's Encrypt cert..."
sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect --non-interactive --agree-tos \
  --email nayan@bad.mn --expand 2>&1 | tail -8

echo "[3/3] Reloading nginx..."
sudo systemctl reload nginx
echo "=== DONE: https://$DOMAIN ==="
curl -s --max-time 8 "https://$DOMAIN/api/health" && echo