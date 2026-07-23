#!/bin/bash
# ============================================================
# Sunrise Housing — SSL/HTTPS Production Setup
# ============================================================
# Usage:
#   1. Set your domain names in .env:
#        DOMAIN_PORTAL="portal.sunrise-housing.com"
#        DOMAIN_ADMIN="admin.sunrise-housing.com"
#        SSL_EMAIL="admin@sunrise-housing.com"
#
#   2. Make sure DNS A records point to this server's IP
#
#   3. Run this script:
#        chmod +x scripts/setup-ssl.sh
#        ./scripts/setup-ssl.sh
# ============================================================

set -e

# Load env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DOMAIN_PORTAL="${DOMAIN_PORTAL:-portal.sunrise-housing.com}"
DOMAIN_ADMIN="${DOMAIN_ADMIN:-admin.sunrise-housing.com}"
SSL_EMAIL="${SSL_EMAIL:-admin@sunrise-housing.com}"

echo "=== Sunrise Housing SSL Setup ==="
echo "Portal domain: $DOMAIN_PORTAL"
echo "Admin domain:  $DOMAIN_ADMIN"
echo "Email:         $SSL_EMAIL"
echo ""

# 1. Build frontends
echo "1. Building frontend apps..."
cd artifacts/housing && npx vite build --config vite.config.ts && cd ../..
cd artifacts/employee-portal && npx vite build --config vite.config.ts && cd ../..

# 2. Start nginx without SSL first (for certbot HTTP challenge)
echo "2. Starting nginx for SSL certificate acquisition..."
docker compose -f docker-compose.ssl.yml up -d nginx
sleep 3

# 3. Get SSL certs for portal domain
echo "3. Getting SSL certificate for $DOMAIN_PORTAL..."
docker exec sunrise-nginx mkdir -p /var/www/certbot
docker run --rm \
  -v sunrise_certbot-www:/var/www/certbot \
  -v sunrise_certbot-certs:/etc/letsencrypt \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email $SSL_EMAIL \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN_PORTAL

# 4. Get SSL certs for admin domain
echo "4. Getting SSL certificate for $DOMAIN_ADMIN..."
docker run --rm \
  -v sunrise_certbot-www:/var/www/certbot \
  -v sunrise_certbot-certs:/etc/letsencrypt \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email $SSL_EMAIL \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN_ADMIN

# 5. Restart everything with SSL
echo "5. Starting all services with SSL..."
docker compose -f docker-compose.ssl.yml up -d

echo ""
echo "=== ✅ SSL Setup Complete ==="
echo "Portal:  https://$DOMAIN_PORTAL"
echo "Admin:   https://$DOMAIN_ADMIN"
echo ""
echo "Certificates auto-renew every 12 hours."
