#!/usr/bin/env bash
#
# Why is the CRM not answering? Reports the whole chain in one go, on the box
# Piper is meant to be running on:
#
#   curl -fsSL https://raw.githubusercontent.com/piperwindsorstar-blip/Piper/claude/wedding-dj-crm-sltogo/deploy/crm-doctor.sh -o /tmp/crm-doctor.sh
#   bash /tmp/crm-doctor.sh crm.djpynxpro.com
#
# Reads. Changes nothing, starts nothing, stops nothing. Safe on a live box.

set -uo pipefail   # not -e: a failing probe is a finding, not a stop

DOMAIN="${1:-crm.djpynxpro.com}"
APP_DIR=/srv/piper
DATA_DIR=/var/lib/piper

hr() { printf '\n──────── %s\n' "$1"; }
kv() { printf '  %-24s %s\n' "$1" "$2"; }
yn() { [[ -e "$1" ]] && echo "yes" || echo "NO"; }

echo "piper CRM doctor — $DOMAIN — $(date -u '+%Y-%m-%d %H:%M UTC')"

hr "this machine"
kv "hostname" "$(hostname)"
LOCAL_IPS="$(hostname -I 2>/dev/null | tr -s ' ')"
kv "addresses" "$LOCAL_IPS"
DOMAIN_IPS="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')"
kv "$DOMAIN points at" "${DOMAIN_IPS:-NOTHING — the DNS record does not exist}"

hr "the app"
kv "$APP_DIR" "$(yn $APP_DIR)"
kv "database" "$(yn $DATA_DIR/piper.db)"
[[ -f $DATA_DIR/piper.db ]] && kv "database size" "$(du -h $DATA_DIR/piper.db 2>/dev/null | cut -f1)"
kv "built (.next)" "$(yn $APP_DIR/.next)"
if [[ -d $APP_DIR/.git ]]; then
  kv "checked-out commit" "$(git -C $APP_DIR log --oneline -1 2>/dev/null | cut -c1-60)"
fi

hr "the service"
kv "unit file" "$(yn /etc/systemd/system/piper.service)"
kv "enabled" "$(systemctl is-enabled piper 2>/dev/null || echo '-')"
kv "active" "$(systemctl is-active piper 2>/dev/null || echo '-')"
kv "listening on 3000" "$(ss -lnt 2>/dev/null | grep -q ':3000' && echo yes || echo NO)"
# --noproxy: a box with http_proxy set in the environment would otherwise send
# a request for its own loopback address out to the proxy, and report the CRM
# as down when it is running perfectly well.
LOCAL_CODE="$(curl -sS -o /dev/null -m 10 --noproxy '*' -w '%{http_code}' http://127.0.0.1:3000/login 2>/dev/null)" || true
kv "127.0.0.1:3000/login" "${LOCAL_CODE:-000}"

hr "what is in front of it"
kv "caddy installed" "$(command -v caddy >/dev/null && echo yes || echo NO)"
kv "caddy active" "$(systemctl is-active caddy 2>/dev/null || echo '-')"
kv "nginx installed" "$(command -v nginx >/dev/null && echo yes || echo NO)"
kv "nginx active" "$(systemctl is-active nginx 2>/dev/null || echo '-')"
echo "  who holds 80 and 443:"
ss -lntp 2>/dev/null | awk '/:(80|443)[[:space:]]/ {print "    " $0}' | cut -c1-105 || echo "    (nothing)"

if [[ -f /etc/caddy/Caddyfile ]]; then
  echo "  Caddyfile names:"
  grep -oE '^[a-z0-9.*-]+\.[a-z]{2,}' /etc/caddy/Caddyfile 2>/dev/null | sed 's/^/    /' | head -5
fi

hr "answering from outside"
for u in "http://$DOMAIN/" "https://$DOMAIN/"; do
  code="$(curl -sS -o /dev/null -m 15 -w '%{http_code}' "$u" 2>/dev/null)" || true
  kv "$u" "${code:-000}"
done

hr "recent errors"
journalctl -u piper -n 12 --no-pager 2>/dev/null | cut -c1-140 | sed 's/^/  /' || echo "  (no journal for piper)"
echo "  --- caddy:"
journalctl -u caddy -n 6 --no-pager 2>/dev/null | cut -c1-140 | sed 's/^/  /' || echo "  (no journal for caddy)"

hr "verdict"
APP_OK=no;  [[ "$LOCAL_CODE" == "200" ]] && APP_OK=yes
DNS_OK=no;  [[ -n "$DOMAIN_IPS" ]] && DNS_OK=yes
HERE_OK=no
for ip in $DOMAIN_IPS; do case " $LOCAL_IPS " in *" $ip "*) HERE_OK=yes ;; esac; done

kv "app answers locally" "$APP_OK"
kv "domain resolves" "$DNS_OK"
kv "resolves to this box" "$HERE_OK"
echo ""

if [[ "$DNS_OK" == no ]]; then
  cat <<EOF
  $DOMAIN has no DNS record at all, so nothing can reach the CRM by name
  no matter what this box is doing. Nothing on the box will fix it.

  Add an A record for $DOMAIN pointing at this machine
  (${LOCAL_IPS:-the public IP of this box}) wherever the djpynxpro.com zone is
  hosted — the DigitalOcean networking panel, if that is where it lives.

EOF
  if [[ "$APP_OK" == yes ]]; then
    echo "  The app itself is fine — it answered on 127.0.0.1:3000. Only DNS is missing."
  else
    echo "  The app is ALSO not answering locally; see below."
  fi
fi

if [[ "$APP_OK" == no ]]; then
  cat <<EOF

  Piper is not answering on 127.0.0.1:3000. In order:
    systemctl status piper --no-pager
    journalctl -u piper -n 50 --no-pager
    ls -la $APP_DIR/.next $DATA_DIR/piper.db
  If .next is missing the app was never built:  cd $APP_DIR && bash deploy/deploy.sh
EOF
fi

if command -v nginx >/dev/null && command -v caddy >/dev/null; then
  cat <<EOF

  BOTH nginx and Caddy are installed on this box. They cannot both hold
  ports 80 and 443 — whichever starts second fails with "Address already in
  use", and if that is Caddy then the CRM has no TLS front end even while
  Piper is running perfectly well on 3000.

  If the mail server was installed here, that is what happened. The two are
  meant to be separate droplets. Look at which one holds the ports above.
EOF
fi

echo ""
echo "──────── end. paste all of the above."
