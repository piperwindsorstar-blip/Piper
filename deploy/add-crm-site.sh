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

# Resolving here is not the same as resolving where it matters.
#
# A brand new record shows up on this droplet immediately — DigitalOcean's own
# resolver is authoritative for the zone — while the public internet is still
# serving the cached NXDOMAIN from before it existed. Let's Encrypt asks the
# public internet, so certbot would fail, and it allows only five failed
# validations per hostname per hour: a couple of impatient runs and the name is
# locked out for the rest of the hour.
PUBLIC_DNS=""
for resolver in "https://dns.google/resolve" "https://cloudflare-dns.com/dns-query"; do
  answer="$(curl -fsS -m 10 -H 'accept: application/dns-json' \
    "$resolver?name=$DOMAIN&type=A" 2>/dev/null || true)"
  # Both an answer and a refusal contain "data" — an NXDOMAIN reply carries the
  # zone's SOA in its Authority section, so matching on "data" alone calls a
  # "does not exist" a success. Status 0 plus an Answer section is the pair
  # that actually means the name resolved.
  case "$answer" in
    *'"Status":0'*'"Answer"'*) PUBLIC_DNS=yes; break ;;
  esac
done

if [[ "$ON_THIS_BOX" == yes && "$PUBLIC_DNS" != yes ]]; then
  cat >&2 <<EOF

    $DOMAIN resolves on this box but not yet on the public internet.

    That is normal a few minutes after adding a record: this droplet asks
    DigitalOcean, which knows immediately, while everyone else is still
    holding the cached "does not exist" from before you added it.

    Let's Encrypt asks the public internet, so it would fail right now — and
    it permits only five failed validations per hostname per hour. Running
    this repeatedly to see if it has caught up is the one thing that will
    genuinely lock you out.

    Wait five or ten minutes, check with

        curl -s 'https://dns.google/resolve?name=$DOMAIN&type=A'

    and run this again once that shows an answer. Nothing has been changed.
EOF
  exit 1
fi

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

# The server block, written from here rather than read from a file.
#
# It used to live in nginx-crm.conf beside this script, which is correct right
# up until somebody runs the script the documented way — curl one file into
# /tmp — and it stops, having already disabled Caddy, because its sibling is
# not there. Fetching the file instead only moved the problem: the raw CDN
# serves a cached copy for some minutes after a push, so the fix for that bug
# was itself unavailable at the moment it was needed.
#
# One file has no such failure. Anything that can run this script has
# everything the script needs.

SITE=/etc/nginx/sites-available/piper-crm
cat > "$SITE" <<'NGINXCONF'
# Piper, behind the same nginx that serves webmail.
#
# The CRM and the mail server ended up on one droplet, and Caddy and nginx
# cannot both hold ports 80 and 443 — so rather than have them fight, nginx
# holds the ports and proxies the CRM through to Piper on 3000. Caddy is
# stopped and disabled; this file replaces its Caddyfile.
#
# Written by add-crm-site.sh with __DOMAIN__ replaced.

server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type "text/plain";
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    # "listen ... ssl http2" rather than "http2 on;" — that directive arrived
    # in nginx 1.25.1 and this box runs 1.24, where it stops nginx starting at
    # all, taking webmail down with it.
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name __DOMAIN__;

    ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;

    # Spreadsheet imports and report photographs go through here.
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # X-Forwarded-Proto is load-bearing, not decoration. Piper marks its
        # session cookie Secure in production; without this header Next.js
        # believes the request arrived over plain HTTP, and the browser throws
        # the cookie away — you log in and land straight back on the login
        # page, with nothing in any log to explain it.
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;

        # Server actions and the spreadsheet export can both outlast the
        # default 60 seconds.
        proxy_read_timeout 300;
        proxy_connect_timeout 10;

        # Deliberately no Upgrade/Connection headers. The usual recipe uses
        # $connection_upgrade, which only exists if a map block is declared at
        # http level — without it nginx refuses to start, and since this is the
        # same nginx that serves webmail, a missing map takes mail down with
        # the CRM. Next.js in production opens no websockets (HMR is a dev-only
        # thing), so there is nothing here to upgrade.
    }
}
NGINXCONF
sed -i "s/__DOMAIN__/$DOMAIN/g" "$SITE"

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
