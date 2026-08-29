#!/usr/bin/env bash
#
# Webmail for Pynx, on the mail droplet. Run as root on the box that already
# answers for the name and already has its certificate:
#
#   sudo PIPER_IMPORT_TOKEN=xxxx bash install-webmail.sh mail.djpynxpro.com
#
# Installs Roundcube behind nginx, and — only if the box has no mail server of
# its own yet — a Postfix and Dovecot to read from. Adds one button to the
# message view that files a crew report straight into Piper.
#
# Idempotent: safe to re-run. It never overwrites a mail configuration it did
# not write, so a box that is already delivering mail keeps delivering it.

set -euo pipefail

DOMAIN="${1:-}"

# Pinned, and checked. The checksum is of the tarball published for this
# version — a download that does not match it is not unpacked, because the one
# thing worse than no webmail is somebody else's webmail.
RC_VERSION="${RC_VERSION:-1.7.3}"
RC_SHA256="${RC_SHA256:-443cde2ea03b840ce4701fe23c273f01e68702f176d282e60248236bbb5f5f85}"
RC_URL="https://github.com/roundcube/roundcubemail/releases/download/${RC_VERSION}/roundcubemail-${RC_VERSION}-complete.tar.gz"

RC_DIR=/var/www/roundcube
RC_DATA=/var/lib/roundcube

# Where the "File in Piper" button sends what you are reading.
PIPER_ENDPOINT="${PIPER_ENDPOINT:-https://crm.djpynxpro.com/api/reports/email}"
PIPER_IMPORT_TOKEN="${PIPER_IMPORT_TOKEN:-}"

# Set to yes to configure Postfix and Dovecot even though the box already has
# one. Off by default: a box that is delivering mail today should keep
# delivering it, and finding that out afterwards is not the way.
PIPER_FORCE_MAIL_STACK="${PIPER_FORCE_MAIL_STACK:-no}"

# The directory this script was run from, so the plugin next to it is found
# whether the repo was cloned to /srv/piper or to somebody's home directory.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo PIPER_IMPORT_TOKEN=xxxx bash install-webmail.sh mail.yourdomain.com" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi

say() { printf '\n==> %s\n' "$1"; }
note() { printf '    %s\n' "$1"; }

###############################################################################
# 1. What is already here
###############################################################################

say "Looking at what this box already has"

HAS_POSTFIX=no; HAS_DOVECOT=no; MAIL_STACK_IS_OURS=no
command -v postfix >/dev/null 2>&1 && HAS_POSTFIX=yes
command -v dovecot >/dev/null 2>&1 && HAS_DOVECOT=yes
[[ -f /etc/dovecot/conf.d/99-piper.conf ]] && MAIL_STACK_IS_OURS=yes

HAS_APT_ROUNDCUBE=no
dpkg-query -W -f='${Status}' roundcube-core 2>/dev/null | grep -q "^install ok installed" && HAS_APT_ROUNDCUBE=yes

note "nginx      : $(command -v nginx >/dev/null && nginx -v 2>&1 | cut -d/ -f2 || echo 'not installed')"
note "postfix    : $HAS_POSTFIX"
note "dovecot    : $HAS_DOVECOT"
note "roundcube  : $([[ "$HAS_APT_ROUNDCUBE" == yes ]] && echo 'an apt package is installed' || echo 'none from apt')"
note "certificate: $([[ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]] && echo present || echo MISSING)"

if [[ "$HAS_APT_ROUNDCUBE" == yes ]]; then
  note ""
  note "There is already a Roundcube from apt on this box. It is left installed"
  note "and its data untouched, but after this run nginx serves the copy under"
  note "/var/www/roundcube instead — one webmail, over HTTPS, with the Piper"
  note "button. Remove the other later if you want the disk back:"
  note "  sudo apt-get remove --purge roundcube roundcube-core"
fi

if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  cat >&2 <<EOF

There is no Let's Encrypt certificate for $DOMAIN, and this script does not
issue one — it only serves. Get the certificate first:

  sudo apt-get install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d $DOMAIN

then run this again.
EOF
  exit 1
fi

###############################################################################
# 2. Packages
###############################################################################

say "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

# php-imap is the one people forget; without it Roundcube starts, accepts a
# password, and then says "connection to storage server failed" forever.
apt-get install -y -qq \
  nginx php-fpm php-cli php-imap php-mbstring php-xml php-intl \
  php-zip php-sqlite3 php-curl php-gd php-bcmath \
  curl ca-certificates rsync >/dev/null

PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
note "php $PHP_VER"

###############################################################################
# 3. Roundcube itself
###############################################################################

say "Fetching Roundcube $RC_VERSION"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$RC_URL" -o "$TMP/rc.tar.gz"

GOT="$(sha256sum "$TMP/rc.tar.gz" | cut -d' ' -f1)"
if [[ "$GOT" != "$RC_SHA256" ]]; then
  echo "    checksum mismatch — refusing to unpack" >&2
  echo "      expected $RC_SHA256" >&2
  echo "      got      $GOT" >&2
  exit 1
fi
note "checksum ok"

# The tree is replaced but the data is not: config and logs are kept across a
# re-run so this doubles as the upgrade path.
mkdir -p "$RC_DIR" "$RC_DATA"
tar xzf "$TMP/rc.tar.gz" -C "$TMP"
SRC="$TMP/roundcubemail-$RC_VERSION"

KEEP_CONFIG=no
[[ -f "$RC_DIR/config/config.inc.php" ]] && { cp "$RC_DIR/config/config.inc.php" "$TMP/config.keep"; KEEP_CONFIG=yes; }

# --delete so an upgrade removes files a previous version shipped, rather than
# leaving a mix of two releases. The excludes are what survives it.
rsync -a --delete \
  --exclude 'config/config.inc.php' --exclude 'logs/' --exclude 'temp/' \
  "$SRC/" "${RC_DIR:?}/"
[[ "$KEEP_CONFIG" == yes ]] && cp "$TMP/config.keep" "$RC_DIR/config/config.inc.php"

# The installer writes configuration from a web form. It is meant to be removed
# after setup and this setup is not done through it.
rm -rf "$RC_DIR/installer" "$RC_DIR/public_html/installer.php"

mkdir -p "$RC_DIR/logs" "$RC_DIR/temp"
chown -R root:www-data "$RC_DIR"
chmod -R o-rwx "$RC_DIR"
chown -R www-data:www-data "$RC_DIR/logs" "$RC_DIR/temp"

###############################################################################
# 4. Configuration
###############################################################################

say "Configuring Roundcube"

if [[ ! -f "$RC_DIR/config/config.inc.php" ]]; then
  DES_KEY="$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 24)"

  cat > "$RC_DIR/config/config.inc.php" <<EOF
<?php

/*
 * Written by install-webmail.sh. Edit freely — a re-run keeps this file.
 */

// SQLite, for the same reason Piper uses it: one file, no server, and the
// backup is a copy. Roundcube stores preferences and contacts here, not mail.
\$config['db_dsnw'] = 'sqlite:///$RC_DATA/roundcube.db?mode=0640';

// Dovecot and Postfix are on this same box, so both are reached over the
// loopback and neither needs TLS to talk to something inside the machine.
\$config['imap_host'] = 'localhost:143';
\$config['smtp_host'] = 'localhost:587';
\$config['smtp_user'] = '%u';
\$config['smtp_pass'] = '%p';

\$config['support_url'] = '';
\$config['product_name'] = 'Pynx Mail';
\$config['des_key'] = '$DES_KEY';
\$config['username_domain'] = '$DOMAIN';
\$config['mail_domain'] = '$DOMAIN';

// Sensible for a small team that lives in this all day.
\$config['plugins'] = ['archive', 'zipdownload', 'newmail_notifier', 'piper_report'];
\$config['skin'] = 'elastic';
\$config['message_show_email'] = true;
\$config['prefer_html'] = true;
\$config['session_lifetime'] = 480;

// Sent mail should be on the server, not only in the browser that sent it.
\$config['default_folders'] = ['INBOX', 'Drafts', 'Sent', 'Junk', 'Trash'];
\$config['drafts_mbox'] = 'Drafts';
\$config['junk_mbox'] = 'Junk';
\$config['sent_mbox'] = 'Sent';
\$config['trash_mbox'] = 'Trash';
EOF
  note "wrote config/config.inc.php"
else
  note "kept the existing config/config.inc.php"
fi

chown root:www-data "$RC_DIR/config/config.inc.php"
chmod 640 "$RC_DIR/config/config.inc.php"

# The preferences database — Roundcube's own store for signatures, contacts and
# folder settings. Not mail; mail is Dovecot's, on disk.
#
# initdb.sh exits 1 on a healthy first run: the SQLite driver builds the schema
# the moment it connects, so initdb then finds the tables already there and
# says so. Under `set -e` that aborts the install with Roundcube unpacked and
# nginx not yet configured. So the exit code is ignored and the database is
# checked instead, which is the thing actually worth knowing.
if [[ ! -f "$RC_DATA/roundcube.db" ]]; then
  ( cd "$RC_DIR" && ./bin/initdb.sh --dir=SQL >/dev/null 2>&1 ) || true

  if ! php -r '
      try {
        $db = new PDO("sqlite:" . $argv[1]);
        $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        exit(0);
      } catch (Exception $e) { exit(1); }
    ' -- "$RC_DATA/roundcube.db"; then
    echo "    the preferences database was not created — check $RC_DIR/logs/errors.log" >&2
    exit 1
  fi
  note "created the preferences database"
fi
chown -R www-data:www-data "$RC_DATA"
chmod 750 "$RC_DATA"

###############################################################################
# 5. The Piper button
###############################################################################

say "Installing the Piper plugin"

if [[ -d "$HERE/piper_report" ]]; then
  rm -rf "$RC_DIR/plugins/piper_report"
  cp -a "$HERE/piper_report" "$RC_DIR/plugins/piper_report"

  PLUGIN_CONF="$RC_DIR/plugins/piper_report/config.inc.php"
  if [[ ! -f "$PLUGIN_CONF" ]]; then
    sed -e "s|'https://crm.djpynxpro.com/api/reports/email'|'$PIPER_ENDPOINT'|" \
        -e "s|\$config\['piper_report_token'\] = '';|\$config['piper_report_token'] = '$PIPER_IMPORT_TOKEN';|" \
        "$RC_DIR/plugins/piper_report/config.inc.php.dist" > "$PLUGIN_CONF"
  fi

  # The token lives in this file. nginx refuses to serve it, but a file mode is
  # the lock that does not depend on a web server config staying right.
  chown root:www-data "$PLUGIN_CONF"
  chmod 640 "$PLUGIN_CONF"

  if [[ -z "$PIPER_IMPORT_TOKEN" ]]; then
    note "no PIPER_IMPORT_TOKEN given — the button stays hidden until one is set in:"
    note "  $PLUGIN_CONF"
  else
    note "pointed at $PIPER_ENDPOINT"
  fi
else
  note "plugin source not found next to this script — skipping the button"
fi

###############################################################################
# 6. PHP-FPM pool
###############################################################################

say "Setting up the PHP pool"
POOL_DIR="/etc/php/$PHP_VER/fpm/pool.d"
cat > "$POOL_DIR/roundcube.conf" <<EOF
; Roundcube's own pool, so webmail cannot be starved by anything else on the
; box and its limits can be set without touching the default pool.
[roundcube]
user = www-data
group = www-data
listen = /run/php/php-fpm-roundcube.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = ondemand
pm.max_children = 12
pm.process_idle_timeout = 30s
pm.max_requests = 500

; Has to agree with client_max_body_size in the nginx site, or an attachment
; dies against whichever of the two is smaller and the error is a blank page.
php_admin_value[upload_max_filesize] = 25M
php_admin_value[post_max_size] = 25M
php_admin_value[memory_limit] = 256M
php_admin_value[max_execution_time] = 300

; Roundcube keeps its own session and temp files inside its tree, where they
; are outside the document root.
php_admin_value[session.save_path] = $RC_DIR/temp
php_admin_value[upload_tmp_dir] = $RC_DIR/temp
php_admin_flag[display_errors] = off
php_admin_value[error_log] = $RC_DIR/logs/php.log
php_admin_flag[log_errors] = on
EOF

# The default pool answers on its own socket and nothing points at it here.
systemctl enable --now "php$PHP_VER-fpm" >/dev/null 2>&1 || true
systemctl restart "php$PHP_VER-fpm"
note "php$PHP_VER-fpm running"

###############################################################################
# 7. nginx
###############################################################################

say "Setting up nginx"

SITE=/etc/nginx/sites-available/roundcube
sed "s/__DOMAIN__/$DOMAIN/g" "$HERE/nginx-roundcube.conf" > "$SITE"

# A box with IPv6 turned off cannot bind [::] and nginx refuses to start at
# all — not just for this site. Checked rather than assumed.
if [[ ! -f /proc/net/if_inet6 ]]; then
  sed -i '/listen \[::\]/d' "$SITE"
  note "no IPv6 on this box — removed the [::] listeners"
fi

# Anything else claiming this name would race with us for it, and nginx would
# silently serve whichever it read first. Certbot's own file is the usual one.
for other in /etc/nginx/sites-enabled/*; do
  [[ -e "$other" ]] || continue
  [[ "$(basename "$other")" == "roundcube" ]] && continue
  if grep -qE "server_name[^;]*(\s|^)$DOMAIN(\s|;)" "$other" 2>/dev/null; then
    mv "$other" "/etc/nginx/sites-available/$(basename "$other").disabled-by-piper" 2>/dev/null \
      || rm -f "$other"
    note "disabled $(basename "$other"), which also claimed $DOMAIN"
  fi
done

ln -sf "$SITE" /etc/nginx/sites-enabled/roundcube

if ! nginx -t 2>/dev/null; then
  echo "" >&2
  echo "nginx rejected the configuration. Nothing has been reloaded — the site" >&2
  echo "you had is still the site that is running. The error was:" >&2
  nginx -t 2>&1 | sed 's/^/    /' >&2
  exit 1
fi
systemctl reload nginx
note "nginx reloaded"

###############################################################################
# 8. A mail server to read from, if there is not one already
###############################################################################

if [[ "$HAS_DOVECOT" == yes && "$MAIL_STACK_IS_OURS" == no && "$PIPER_FORCE_MAIL_STACK" != yes ]]; then
  say "Leaving the existing mail server alone"
  note "Dovecot is already configured here and this script did not configure it,"
  note "so it is not touched. Roundcube expects IMAP on localhost:143 and"
  note "submission on localhost:587 — adjust config/config.inc.php if yours differ."
  note ""
  note "This also means piper-mailbox is NOT installed: it only understands the"
  note "Dovecot configuration this script writes, and pointing it at somebody"
  note "else's would write users into a file their server never reads."
  note "Add mailboxes the way this box already does."
  note ""
  note "To hand mail over to Piper's configuration instead, re-run with:"
  note "  sudo PIPER_FORCE_MAIL_STACK=yes bash install-webmail.sh $DOMAIN"
else
  bash "$HERE/install-mail-stack.sh" "$DOMAIN"
fi

###############################################################################
# 9. What is left to do
###############################################################################

###############################################################################
# 9a. Check its own work
###############################################################################

say "Checking it actually answers"

# Asked over the network, against the real name and the real certificate,
# because "nginx reloaded without complaining" and "webmail loads" are not the
# same claim. A run that ends by announcing an address nobody has fetched is
# how a box ends up serving a login form over plain HTTP for a week.
SELF_HTTPS="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "https://$DOMAIN/" 2>/dev/null)" || true
SELF_HTTP="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "http://$DOMAIN/" 2>/dev/null)" || true

note "https://$DOMAIN/  -> $SELF_HTTPS"
note "http://$DOMAIN/   -> $SELF_HTTP (301 expected: it redirects to https)"

if [[ "$SELF_HTTPS" != "200" ]]; then
  cat >&2 <<EOF

    HTTPS did not answer with 200, so do not sign in yet — a login form on
    plain HTTP sends the mailbox password across the network in the clear.

    Worth looking at, in this order:
      sudo nginx -t
      sudo ss -lntp | grep -E ':(80|443)'
      sudo tail -30 /var/log/nginx/error.log
      sudo tail -30 $RC_DIR/logs/errors.log

    An "Internal Error" page from Roundcube with a 500 is almost always its
    database: check that $RC_DATA/roundcube.db exists and is owned by
    www-data.
EOF
fi

echo ""
echo "------------------------------------------------------------------------"
echo "Webmail is at https://$DOMAIN"
echo ""

# Checked, not assumed. Telling somebody to run a command that is not there is
# how a working install reads as a broken one.
if command -v piper-mailbox >/dev/null 2>&1; then
  cat <<EOF
Add a mailbox before you can sign in:

  sudo piper-mailbox add reports@$DOMAIN

Use sudo, or the full path. /usr/local/sbin is not on an ordinary user's PATH
on Ubuntu, so typing piper-mailbox on its own answers "command not found" even
though it is installed:

  /usr/local/sbin/piper-mailbox list

EOF
else
  cat <<EOF
Mailboxes are managed by the mail server that was already on this box, so
piper-mailbox was not installed. Add one the way you normally do here, then
sign in to webmail with it.

EOF
fi

cat <<EOF
Still worth doing, and none of it is optional if this box is going to send
mail anywhere that Gmail or Outlook will accept:

  1. Reverse DNS. 161.35.111.234 currently has none. In the DigitalOcean
     panel, rename the droplet to $DOMAIN — that is what sets the PTR.
  2. DKIM. install-mail-stack.sh prints the DNS record to add.
  3. DMARC. Add a TXT record at _dmarc.$DOMAIN:
       v=DMARC1; p=none; rua=mailto:postmaster@$DOMAIN
     Start at p=none, read the reports for a fortnight, then tighten it.

Check what the outside world thinks:  https://www.mail-tester.com
------------------------------------------------------------------------
EOF
