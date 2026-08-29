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
kv "password helper" "$(command -v piper-passwd >/dev/null && echo yes || echo NO)"
kv "password sudoers" "$(yn /etc/sudoers.d/piper-passwd)"
kv "password driver" "$(yn /var/www/roundcube/plugins/password/drivers/piper_dovecot.php)"
kv "www-data may call it" "$(sudo -n -u www-data sudo -n -l /usr/local/sbin/piper-passwd >/dev/null 2>&1 && echo yes || echo 'no / cannot tell')"
kv "99-piper.conf" "$(yn /etc/dovecot/conf.d/99-piper.conf)"

hr "packages"
for p in nginx dovecot-core postfix roundcube-core opendkim; do
  # Captured, not piped: a SIGPIPE'd dpkg-query under pipefail would report an
  # installed package as absent, which is the one thing a diagnostic must not do.
  st="$(dpkg-query -W -f='${Status}' "$p" 2>/dev/null || true)"
  case "$st" in *"ok installed") kv "$p" "installed" ;; *) kv "$p" "-" ;; esac
done
FPM_UNITS="$(systemctl list-units --type=service --state=running 2>/dev/null || true)"
kv "php-fpm service" "$(grep -oE 'php[0-9.]*-fpm' <<<"$FPM_UNITS" | sort -u | tr '\n' ' ' || echo '-')"
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

hr "verdict"

# The three questions that actually decide whether you can sign in, answered
# together. Each of the sections above tells you one fact; it is the
# combination that says what to do next, and working that out by eye across
# forty lines is how an install that succeeded gets read as one that failed.
WEBMAIL_UP=no
[[ "$(curl -sS -o /dev/null -m 15 -w '%{http_code}' "https://$DOMAIN/" 2>/dev/null)" == "200" ]] && WEBMAIL_UP=yes

STACK_IS_PIPERS=no
[[ -f /etc/dovecot/conf.d/99-piper.conf && -f /etc/dovecot/users ]] && STACK_IS_PIPERS=yes

MAILBOXES=0
[[ -f /etc/dovecot/users ]] && MAILBOXES="$(grep -c ':' /etc/dovecot/users 2>/dev/null || echo 0)"

kv "webmail over https" "$WEBMAIL_UP"
kv "mail stack is Piper's" "$STACK_IS_PIPERS"
kv "mailboxes that exist" "$MAILBOXES"

echo ""
if [[ "$WEBMAIL_UP" == yes && "$STACK_IS_PIPERS" == yes && "$MAILBOXES" -gt 0 ]]; then
  echo "  Everything is in place. Sign in at https://$DOMAIN/ using the FULL"
  echo "  address as the username — one of the mailboxes listed above."
elif [[ "$WEBMAIL_UP" == yes && "$STACK_IS_PIPERS" == no ]]; then
  cat <<EOF
  Webmail is up, but the mail server underneath it is not the one these
  scripts configure — so there are no virtual mailboxes to sign in as, and
  piper-mailbox was deliberately not installed. That is why a login fails.

  Note the username has to be a mailbox ON THIS SERVER. A Google Workspace
  address will never work here, whatever the password.

  To hand mail over to Piper's configuration:

    PIPER_FORCE_MAIL_STACK=yes bash /opt/piper-mail/install-webmail.sh $DOMAIN
    piper-mailbox add you@$DOMAIN --generate

  That switches Dovecot to virtual users and Maildir. Mail already sitting in
  the old mbox files under /var/mail/ stops being visible to IMAP — on a
  droplet that is usually just root's cron mail, but look before you run it.
EOF
elif [[ "$WEBMAIL_UP" == yes && "$MAILBOXES" -eq 0 ]]; then
  echo "  Webmail is up and the mail stack is Piper's, but no mailbox exists yet:"
  echo "    piper-mailbox add you@$DOMAIN --generate"
else
  echo "  Webmail is not answering on https. Do not sign in over http — the"
  echo "  password would cross the network in the clear. Start with:"
  echo "    nginx -t   and   tail -30 /var/log/nginx/error.log"
fi

echo ""
echo "──────── end. paste all of the above."
