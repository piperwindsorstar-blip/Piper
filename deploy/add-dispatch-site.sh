#!/usr/bin/env bash
#
# dispatch.djpynxpro.com — a short address that lands on the board with the
# rest of Piper out of the way.
#
#   curl -fsSL https://raw.githubusercontent.com/piperwindsorstar-blip/Piper/claude/wedding-dj-crm-sltogo/deploy/add-dispatch-site.sh -o /tmp/add-dispatch-site.sh
#   bash /tmp/add-dispatch-site.sh dispatch.djpynxpro.com crm.djpynxpro.com
#
# It redirects rather than serving anything of its own, so there is one app,
# one session and one certificate renewal to care about. The ?focus=dispatch
# it adds is what tells Piper to leave the side menu off.
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

    # Everything here means the board. focus=dispatch is what hides the side
    # menu; the tabs carry it between Board, Gantt, Fleet and Who drove.
    location / {
        return 302 https://$TARGET/dispatch?focus=dispatch;
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
  OUT="$(curl -sS -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' "https://$DOMAIN/" 2>&1)" && break
  sleep 2
done
CRM="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://$TARGET/login" 2>/dev/null || true)"
MAIL="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://mail.djpynxpro.com/" 2>/dev/null || true)"
note "https://$DOMAIN/ -> $OUT"
note "the CRM still up   -> $CRM"
note "webmail still up   -> $MAIL"

echo ""
case "$OUT" in
  302*focus=dispatch*) echo "  dispatch.djpynxpro.com now lands on the board, with no side menu." ;;
  *) echo "  Not redirecting as expected. curl said: $OUT" >&2 ;;
esac
