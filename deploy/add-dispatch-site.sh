#!/usr/bin/env bash
#
# dispatch.djpynxpro.com — the public crew board, on its own address.
#
#   curl -fsSL https://raw.githubusercontent.com/piperwindsorstar-blip/Piper/claude/wedding-dj-crm-sltogo/deploy/add-dispatch-site.sh -o /tmp/add-dispatch-site.sh
#   bash /tmp/add-dispatch-site.sh dispatch.djpynxpro.com crm.djpynxpro.com
#
# Read-only and open to anyone with the link: /board is the one page in Piper
# that renders without an account. Because no session is involved, this can
# serve it directly and keep its own name in the address bar rather than
# bouncing to the CRM.
#
# Only the board and the files it needs are proxied. Everything else on this
# hostname is a 404 — so even somebody who knows the CRM's URLs cannot reach
# /dashboard or /settings through this name.
#
# The board is off until an admin turns it on in Settings, and answers 404
# until they do. That is deliberate and this script does not change it.
#
# Everything it needs is in this file. Idempotent; safe to re-run.

set -euo pipefail

DOMAIN="${1:-dispatch.djpynxpro.com}"
TARGET="${2:-crm.djpynxpro.com}"

say()  { printf '\n==> %s\n' "$1"; }
note() { printf '    %s\n' "$1"; }

[[ $EUID -eq 0 ]] || { echo "Run this as root." >&2; exit 1; }

say "Checking DNS"
LOCAL_IPS="$(hostname -I 2>/dev/null | tr -s ' ')"
PUBLIC_IP="$(curl -fsS -m 10 https://api.ipify.org 2>/dev/null || echo '')"
DOMAIN_IPS="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || true)"
note "$DOMAIN resolves to: ${DOMAIN_IPS:-nothing}"

ON_THIS_BOX=no
for ip in $DOMAIN_IPS; do
  case " $LOCAL_IPS $PUBLIC_IP " in *" $ip "*) ON_THIS_BOX=yes ;; esac
done

PUBLIC_DNS=""
for r in "https://dns.google/resolve" "https://cloudflare-dns.com/dns-query"; do
  a="$(curl -fsS -m 10 -H 'accept: application/dns-json' "$r?name=$DOMAIN&type=A" 2>/dev/null || true)"
  case "$a" in *'"Status":0'*'"Answer"'*) PUBLIC_DNS=yes; break ;; esac
done

if [[ "$ON_THIS_BOX" != yes || "$PUBLIC_DNS" != yes ]]; then
  cat >&2 <<EOF

    Stopping, and nothing has been changed.

    $DOMAIN needs to point at this machine and be visible to the
    public internet before Let's Encrypt will issue a certificate for it.

        Type  A
        Name  ${DOMAIN%%.*}
        Value ${PUBLIC_IP:-$LOCAL_IPS}
        TTL   3600

    resolves here      : $ON_THIS_BOX
    resolves publicly  : ${PUBLIC_DNS:-no}

    A new record shows up on this droplet at once and takes a few minutes
    everywhere else. Let's Encrypt asks everywhere else, and allows five
    failed tries an hour — so wait rather than re-running on a loop.
EOF
  exit 1
fi
note "resolves here and publicly — carrying on"

say "Adding the redirect"
command -v certbot >/dev/null || {
  note "installing certbot"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq && apt-get install -y -qq certbot >/dev/null
}

SITE=/etc/nginx/sites-available/piper-dispatch
cat > "$SITE" <<NGINXCONF
# Written by add-dispatch-site.sh. A short address, not a second app.
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type "text/plain";
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    # "listen ... ssl http2", not "http2 on;" — the latter needs nginx 1.25.1
    # and this box runs 1.24, where it stops nginx starting at all and takes
    # the CRM and webmail down with it.
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Only the board, and only what it needs to draw itself.
    location = / {
        proxy_pass http://127.0.0.1:3000/board;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        # Without this Next.js reads the request as plain HTTP and builds its
        # absolute URLs accordingly.
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60;
    }

    # The stylesheet, the scripts and the icons. Named rather than passed
    # through wholesale: this is the list of what a stranger may fetch.
    location /_next/ { proxy_pass http://127.0.0.1:3000; }
    location = /manifest.webmanifest { proxy_pass http://127.0.0.1:3000; }
    location = /favicon.ico { proxy_pass http://127.0.0.1:3000; }
    location ~ ^/(apple-touch-icon|icon-192|icon-512|icon-maskable-512)\\.png$ {
        proxy_pass http://127.0.0.1:3000;
    }

    # Anything else. /dashboard, /settings, /events — none of them exist here.
    location / {
        return 404;
    }
}
NGINXCONF

if [[ ! -f /proc/net/if_inet6 ]]; then
  sed -i '/listen \[::\]/d' "$SITE"
  note "no IPv6 on this box — removed the [::] listeners"
fi

# The TLS half cannot be enabled before the certificate exists: nginx refuses
# to start with an ssl_certificate that is not there, which would take the CRM
# and webmail down too. So the plain-HTTP half goes up first, for the
# challenge, and the whole site follows.
if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  note "no certificate yet — putting the http half up for the challenge"
  awk '/^server \{/{n++} n==1' "$SITE" > /etc/nginx/sites-available/piper-dispatch-bootstrap
  ln -sf /etc/nginx/sites-available/piper-dispatch-bootstrap /etc/nginx/sites-enabled/piper-dispatch
  nginx -t >/dev/null 2>&1 || { echo "    nginx rejected the bootstrap site" >&2; nginx -t; exit 1; }
  systemctl reload nginx

  say "Getting a certificate"
  mkdir -p /var/www/html
  certbot certonly --webroot -w /var/www/html -d "$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring
  rm -f /etc/nginx/sites-available/piper-dispatch-bootstrap
fi

ln -sf "$SITE" /etc/nginx/sites-enabled/piper-dispatch
if ! nginx -t 2>/dev/null; then
  echo "    nginx rejected it; nothing reloaded, the CRM and webmail untouched:" >&2
  nginx -t 2>&1 | sed 's/^/      /' >&2
  exit 1
fi
systemctl reload nginx
note "nginx reloaded"

say "Checking"
for _ in 1 2 3; do
  OUT="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://$DOMAIN/" 2>&1)" && break
  sleep 2
done
BLOCKED="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://$DOMAIN/dashboard" 2>/dev/null || true)"
CRM="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://$TARGET/login" 2>/dev/null || true)"
MAIL="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://mail.djpynxpro.com/" 2>/dev/null || true)"
note "https://$DOMAIN/          -> $OUT"
note "https://$DOMAIN/dashboard -> $BLOCKED (404 expected: nothing else is served here)"
note "the CRM still up            -> $CRM"
note "webmail still up            -> $MAIL"

echo ""
case "$OUT" in
  200) echo "  The crew board is live at https://$DOMAIN/ — no sign-in, nothing editable." ;;
  404) cat <<EOF
  The board is switched off, which is its default and why this is a 404.
  Turn it on in the CRM: Settings -> the crew board. Then reload this
  address; nothing else needs running.
EOF
  ;;
  *) echo "  Unexpected: $OUT. Check: systemctl status piper; tail -30 /var/log/nginx/error.log" >&2 ;;
esac
