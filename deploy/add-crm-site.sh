#!/usr/bin/env bash
#
# Puts the CRM back behind HTTPS on a box where nginx has taken the ports.
#
#   curl -fsSL https://raw.githubusercontent.com/piperwindsorstar-blip/Piper/claude/wedding-dj-crm-sltogo/deploy/add-crm-site.sh -o /tmp/add-crm-site.sh
#   bash /tmp/add-crm-site.sh crm.djpynxpro.com
#
# The CRM and the mail server ended up on one droplet. Caddy and nginx cannot
# both hold 80 and 443, so Caddy lost and the CRM has had no front end since —
# while Piper itself carried on serving perfectly well on port 3000.
#
# This hands the job to nginx: a server block for the CRM that proxies to 3000,
# a certificate for it, and Caddy stopped so it cannot fight for the ports
# again on the next reboot. Piper is not touched, restarted or redeployed.
#
# Idempotent. Safe to re-run.

set -euo pipefail

DOMAIN="${1:-crm.djpynxpro.com}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say()  { printf '\n==> %s\n' "$1"; }
note() { printf '    %s\n' "$1"; }

[[ $EUID -eq 0 ]] || { echo "Run this as root." >&2; exit 1; }

###############################################################################
# 1. The one thing this script cannot do for you
###############################################################################

say "Checking DNS"

LOCAL_IPS="$(hostname -I 2>/dev/null | tr -s ' ')"
# "|| true" is the whole point of this line: getent exits 2 when a name does
# not resolve, and under set -e that killed the script here — before printing
# the explanation of the very situation it had just detected. The guard was
# silent in exactly the case it exists for.
DOMAIN_IPS="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || true)"
PUBLIC_IP="$(curl -fsS -m 10 https://api.ipify.org 2>/dev/null || echo '')"

note "$DOMAIN resolves to: ${DOMAIN_IPS:-nothing}"
note "this box is        : ${PUBLIC_IP:-$LOCAL_IPS}"

ON_THIS_BOX=no
for ip in $DOMAIN_IPS; do
  case " $LOCAL_IPS $PUBLIC_IP " in *" $ip "*) ON_THIS_BOX=yes ;; esac
done

if [[ "$ON_THIS_BOX" != yes ]]; then
  cat >&2 <<EOF

    Stopping here, because everything below depends on this.

    $DOMAIN does not resolve to this machine, so Let's Encrypt cannot
    prove the name belongs here and will refuse to issue a certificate. No
    amount of nginx configuration gets round that.

    Add this record wherever the djpynxpro.com zone is hosted — the
    DigitalOcean networking panel, if that is where it lives:

        Type  A
        Name  ${DOMAIN%%.*}
        Value ${PUBLIC_IP:-161.35.111.234}
        TTL   3600

    Give it a couple of minutes, check with

        getent ahostsv4 $DOMAIN

    and run this again. Nothing has been changed.
EOF
  exit 1
fi
note "resolves here — carrying on"

###############################################################################
# 2. Stop Caddy fighting for the ports
###############################################################################

say "Standing Caddy down"

# Not removed — disabled. The Caddyfile stays on disk as the record of what it
# used to serve, and putting it back is one systemctl command if this turns out
# to be the wrong call.
if systemctl list-unit-files caddy.service >/dev/null 2>&1; then
  systemctl stop caddy 2>/dev/null || true
  systemctl disable caddy >/dev/null 2>&1 || true
  note "caddy stopped and disabled; /etc/caddy/Caddyfile left alone"
else
  note "no caddy on this box"
fi

###############################################################################
# 3. The site
###############################################################################

say "Adding the nginx site"

command -v certbot >/dev/null || {
  note "installing certbot"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
}

SITE=/etc/nginx/sites-available/piper-crm
sed "s/__DOMAIN__/$DOMAIN/g" "$HERE/nginx-crm.conf" > "$SITE"

if [[ ! -f /proc/net/if_inet6 ]]; then
  sed -i '/listen \[::\]/d' "$SITE"
  note "no IPv6 on this box — removed the [::] listeners"
fi

# Certbot has to answer a challenge over port 80 before the certificate exists,
# so the TLS half of the site cannot be enabled yet: nginx will not start with
# an ssl_certificate that is not there, and that would take webmail down too.
if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  note "no certificate yet — enabling the plain-HTTP half first"
  awk '/^server \{/{n++} n==1' "$SITE" > /etc/nginx/sites-available/piper-crm-bootstrap
  ln -sf /etc/nginx/sites-available/piper-crm-bootstrap /etc/nginx/sites-enabled/piper-crm
  nginx -t >/dev/null 2>&1 || { echo "    nginx rejected the bootstrap site" >&2; nginx -t; exit 1; }
  systemctl reload nginx

  say "Getting a certificate"
  mkdir -p /var/www/html
  certbot certonly --webroot -w /var/www/html -d "$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring
  rm -f /etc/nginx/sites-available/piper-crm-bootstrap
fi

ln -sf "$SITE" /etc/nginx/sites-enabled/piper-crm

if ! nginx -t 2>/dev/null; then
  echo "" >&2
  echo "    nginx rejected the configuration; nothing reloaded, webmail untouched:" >&2
  nginx -t 2>&1 | sed 's/^/      /' >&2
  exit 1
fi
systemctl reload nginx
note "nginx reloaded"

###############################################################################
# 4. Prove it
###############################################################################

say "Checking it answers"

APP="$(curl -sS -o /dev/null -m 10 --noproxy '*' -w '%{http_code}' http://127.0.0.1:3000/login 2>/dev/null)" || true
OUT="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://$DOMAIN/login" 2>/dev/null)" || true
MAIL="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://mail.djpynxpro.com/" 2>/dev/null)" || true

note "piper on 127.0.0.1:3000  -> $APP"
note "https://$DOMAIN/login -> $OUT"
note "webmail still up          -> $MAIL"

echo ""
if [[ "$OUT" == "200" ]]; then
  echo "  The CRM is back at https://$DOMAIN/"
else
  echo "  The CRM is still not answering on https. Look at:" >&2
  echo "    systemctl status piper --no-pager" >&2
  echo "    tail -30 /var/log/nginx/error.log" >&2
fi
