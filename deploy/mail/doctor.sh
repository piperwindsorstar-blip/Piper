#!/usr/bin/env bash
#
# Reports what is actually on this box, so a webmail that will not come up can
# be diagnosed in one round trip instead of six.
#
#   curl -fsSL https://raw.githubusercontent.com/piperwindsorstar-blip/Piper/claude/wedding-dj-crm-sltogo/deploy/mail/doctor.sh -o /tmp/doctor.sh
#   bash /tmp/doctor.sh mail.djpynxpro.com
#
# Reads. Changes nothing, starts nothing, stops nothing. Safe on a live box.

set -uo pipefail   # deliberately not -e: a failing probe is a finding, not a stop

DOMAIN="${1:-mail.djpynxpro.com}"

hr() { printf '\n──────── %s\n' "$1"; }
kv() { printf '  %-22s %s\n' "$1" "$2"; }
yn() { [[ -e "$1" ]] && echo "yes" || echo "NO"; }

echo "piper mail doctor — $DOMAIN — $(date -u '+%Y-%m-%d %H:%M UTC')"

hr "this machine"
kv "hostname" "$(hostname)"
kv "addresses" "$(hostname -I 2>/dev/null | tr -s ' ')"
kv "$DOMAIN points at" "$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')"
kv "ubuntu" "$(. /etc/os-release 2>/dev/null && echo "$VERSION" || echo '?')"

hr "did the installer run"
kv "/opt/piper-mail" "$(yn /opt/piper-mail)"
kv "/var/www/roundcube" "$(yn /var/www/roundcube)"
kv "roundcube config" "$(yn /var/www/roundcube/config/config.inc.php)"
kv "roundcube db" "$(yn /var/lib/roundcube/roundcube.db)"
kv "piper plugin" "$(yn /var/www/roundcube/plugins/piper_report/piper_report.php)"
kv "plugin token set" "$(grep -q "piper_report_token'\] = '[^']" /var/www/roundcube/plugins/piper_report/config.inc.php 2>/dev/null && echo yes || echo 'no (button hidden)')"
kv "piper-mailbox" "$(command -v piper-mailbox >/dev/null && echo yes || echo NO)"
kv "99-piper.conf" "$(yn /etc/dovecot/conf.d/99-piper.conf)"

hr "packages"
for p in nginx dovecot-core postfix roundcube-core opendkim; do
  kv "$p" "$(dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q 'ok installed' && echo installed || echo '-')"
done
kv "php-fpm service" "$(systemctl list-units --type=service --state=running 2>/dev/null | grep -o 'php[0-9.]*-fpm' | head -1 || echo '-')"
kv "php-fpm sockets" "$(ls /run/php/*.sock 2>/dev/null | tr '\n' ' ' || echo 'none')"

hr "what is listening"
ss -lntp 2>/dev/null | awk 'NR==1 || /:(25|80|110|143|443|465|587|993|995)[[:space:]]/ {print "  " $0}' \
  | cut -c1-110 || echo "  (ss unavailable)"

hr "nginx"
if command -v nginx >/dev/null; then
  kv "version" "$(nginx -v 2>&1 | cut -d/ -f2)"
  kv "config test" "$(nginx -t 2>&1 | tail -1 | sed 's/nginx: //')"
  echo "  sites-enabled:"
  for f in /etc/nginx/sites-enabled/*; do
    [[ -e "$f" ]] || continue
    printf '    %-22s server_name: %s\n' "$(basename "$f")" \
      "$(grep -hoP 'server_name\s+\K[^;]+' "$f" 2>/dev/null | tr ' ' '\n' | sort -u | tr '\n' ' ' | cut -c1-60)"
  done
  echo "  which site owns $DOMAIN:"
  grep -RlE "server_name[^;]*\b${DOMAIN//./\\.}\b" /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/    /' \
    || echo "    none by name — nginx will fall back to its default_server"
else
  echo "  not installed"
fi

hr "certificate"
CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
kv "on disk" "$(yn "$CERT")"
[[ -f "$CERT" ]] && kv "expires" "$(openssl x509 -enddate -noout -in "$CERT" 2>/dev/null | cut -d= -f2)"

hr "answering, from this box"
for u in "http://$DOMAIN/" "https://$DOMAIN/"; do
  code="$(curl -sS -o /dev/null -m 15 -w '%{http_code}' "$u" 2>/dev/null)"
  err=""
  [[ "$code" == "000" ]] && err="  <- $(curl -sS -o /dev/null -m 15 "$u" 2>&1 | tail -1 | cut -c1-60)"
  kv "$u" "$code$err"
done

hr "dovecot"
if command -v doveconf >/dev/null; then
  kv "config parses" "$(doveconf -n >/dev/null 2>&1 && echo yes || echo "NO: $(doveconf -n 2>&1 | head -1)")"
  kv "mail_location" "$(doveconf -h mail_location 2>/dev/null)"
  kv "passdb drivers" "$(doveconf 2>/dev/null | awk '/^passdb/,/^}/' | grep -oP 'driver = \K.*' | tr '\n' ' ')"
  kv "mailboxes" "$(cut -d: -f1 /etc/dovecot/users 2>/dev/null | tr '\n' ' ' || echo '(no /etc/dovecot/users)')"
else
  echo "  not installed"
fi

hr "recent errors"
for f in /var/log/nginx/error.log /var/www/roundcube/logs/errors.log /var/log/roundcube/errors.log; do
  if [[ -s "$f" ]]; then
    echo "  $f:"
    tail -6 "$f" 2>/dev/null | cut -c1-140 | sed 's/^/    /'
  fi
done

echo ""
echo "──────── end. paste all of the above."
