#!/usr/bin/env bash
#
# Postfix and Dovecot for one domain, so webmail has something to read and
# something to send through. Called by install-webmail.sh, or on its own:
#
#   sudo bash install-mail-stack.sh mail.djpynxpro.com
#
# Deliberately small. Virtual mailboxes in a passwd file rather than system
# accounts, Maildir on disk, no database, no admin panel — the same shape as
# the rest of Piper, where the backup is a copy of a directory.
#
# Idempotent, and additive: every file it writes is one of its own. It appends
# nothing to a shipped config and rewrites nothing it did not write.

set -euo pipefail

DOMAIN="${1:-}"
VMAIL_DIR=/var/mail/vhosts
DKIM_SELECTOR="${DKIM_SELECTOR:-mail}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash install-mail-stack.sh mail.yourdomain.com" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi

CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
if [[ ! -f "$CERT" ]]; then
  echo "No certificate at $CERT — get one before running this." >&2
  exit 1
fi

say() { printf '\n==> %s\n' "$1"; }
note() { printf '    %s\n' "$1"; }

say "Installing Postfix, Dovecot and OpenDKIM"
export DEBIAN_FRONTEND=noninteractive

# Postfix asks two questions at install time. Answering them here is what keeps
# this runnable from a script instead of stalling on a purple dialog.
debconf-set-selections <<EOF
postfix postfix/main_mailer_type select Internet Site
postfix postfix/mailname string $DOMAIN
EOF

apt-get install -y -qq \
  postfix postfix-pcre \
  dovecot-core dovecot-imapd dovecot-lmtpd \
  opendkim opendkim-tools >/dev/null

###############################################################################
# Where the mail lives
###############################################################################

say "Creating the mail store"
getent group vmail >/dev/null || groupadd -g 5000 vmail
id -u vmail >/dev/null 2>&1 || useradd -g vmail -u 5000 vmail -d "$VMAIL_DIR" -m -s /usr/sbin/nologin
mkdir -p "$VMAIL_DIR/$DOMAIN"
chown -R vmail:vmail "$VMAIL_DIR"
chmod -R 770 "$VMAIL_DIR"
note "$VMAIL_DIR/$DOMAIN"

touch /etc/dovecot/users
chown root:dovecot /etc/dovecot/users
chmod 640 /etc/dovecot/users

###############################################################################
# Dovecot
###############################################################################

say "Configuring Dovecot"

# Dovecot listens on "*, ::" by default and treats a failure to bind either as
# fatal — so on a droplet with IPv6 turned off it does not start at all, and
# the symptom is webmail that cannot reach storage rather than anything that
# mentions IPv6. Checked, not assumed. Same trap as nginx, same fix.
if [[ -f /proc/net/if_inet6 ]]; then
  DOVECOT_LISTEN='*, ::'
else
  DOVECOT_LISTEN='*'
  note "no IPv6 on this box — Dovecot will listen on IPv4 only"
fi

# One file of our own in conf.d. Dovecot reads it last, so these values win,
# and nothing shipped by the package is edited — which is what makes an
# apt upgrade a non-event and this script safe to re-run.
cat > /etc/dovecot/conf.d/99-piper.conf <<EOF
# Written by install-mail-stack.sh. Everything Piper needs, in one file.

protocols = imap lmtp
listen = $DOVECOT_LISTEN
mail_location = maildir:$VMAIL_DIR/%d/%n
mail_privileged_group = mail

# Virtual users: no shell account per mailbox. Adding somebody is a line in a
# file, and removing them is deleting that line.
passdb {
  driver = passwd-file
  args = scheme=ARGON2ID username_format=%u /etc/dovecot/users
}
userdb {
  driver = static
  args = uid=vmail gid=vmail home=$VMAIL_DIR/%d/%n allow_all_users=yes
}

# Plaintext auth is allowed only inside TLS. On the loopback it is allowed
# outright, because that is Roundcube on this same machine and there is no
# network for anybody to listen on.
disable_plaintext_auth = yes
auth_mechanisms = plain login

ssl = required
ssl_cert = <$CERT
ssl_key = <$KEY
ssl_min_protocol = TLSv1.2

namespace inbox {
  inbox = yes
  # One setting per line: Dovecot has no statement separator, so the tidier
  # "mailbox Drafts { special_use = \\Drafts; auto = subscribe }" is a parse
  # error — "Garbage after '{'" — and dovecot refuses to start at all.
  mailbox Drafts {
    special_use = \\Drafts
    auto = subscribe
  }
  mailbox Junk {
    special_use = \\Junk
    auto = subscribe
  }
  mailbox Sent {
    special_use = \\Sent
    auto = subscribe
  }
  mailbox Trash {
    special_use = \\Trash
    auto = subscribe
  }
}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

# Postfix asks Dovecot whether a password is right, so there is one list of
# users and one place a password lives.
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
  unix_listener auth-userdb {
    mode = 0600
    user = vmail
    group = vmail
  }
}

service imap-login {
  inet_listener imap {
    # Loopback only: Roundcube is on this box. A mail client on a phone comes
    # in on 993 below, where TLS is not optional.
    address = 127.0.0.1
    port = 143
  }
  inet_listener imaps {
    port = 993
    ssl = yes
  }
}
EOF

# The one shipped file this touches, and it has to.
#
# Ubuntu's 10-auth.conf includes auth-system.conf.ext, which adds a PAM passdb
# — and conf.d is read in order, so PAM is tried *before* the virtual users
# above. On a box with 993 open to the internet that means every system account
# on the droplet is also a mailbox login. Commented out rather than deleted,
# and only once.
if grep -q '^!include auth-system.conf.ext' /etc/dovecot/conf.d/10-auth.conf; then
  cp -n /etc/dovecot/conf.d/10-auth.conf /etc/dovecot/conf.d/10-auth.conf.before-piper
  sed -i 's|^!include auth-system.conf.ext|#!include auth-system.conf.ext  # disabled by Piper: virtual users only|' \
    /etc/dovecot/conf.d/10-auth.conf
  note "turned off system-account login (PAM) — virtual mailboxes only"
fi

systemctl enable dovecot >/dev/null 2>&1 || true
systemctl restart dovecot
note "dovecot restarted"

###############################################################################
# Postfix
###############################################################################

say "Configuring Postfix"

# postconf -e rather than a rewritten main.cf: it edits the settings named and
# leaves everything else, so an existing configuration survives and a re-run
# changes nothing that is already right.
postconf -e "myhostname = $DOMAIN"
postconf -e "myorigin = \$myhostname"
postconf -e "mydestination = localhost"
postconf -e "inet_interfaces = all"

postconf -e "virtual_mailbox_domains = $DOMAIN"
postconf -e "virtual_transport = lmtp:unix:private/dovecot-lmtp"

# Dovecot holds the user list, so Postfix asks it rather than keeping a second.
postconf -e "smtpd_sasl_type = dovecot"
postconf -e "smtpd_sasl_path = private/auth"
postconf -e "smtpd_sasl_auth_enable = yes"

postconf -e "smtpd_tls_cert_file = $CERT"
postconf -e "smtpd_tls_key_file = $KEY"
postconf -e "smtpd_tls_security_level = may"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtpd_tls_protocols = >=TLSv1.2"

# The rule that stops this being an open relay: on port 25 a stranger may only
# post to a mailbox that lives here.
postconf -e "smtpd_relay_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination"
postconf -e "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination"
postconf -e "message_size_limit = 26214400"

# Submission on 587: authenticated, encrypted, and the only way a person sends.
# postconf -M adds the service if it is missing and leaves it alone if not, so
# this does not grow a second copy on every run.
postconf -M "submission/inet=submission inet n - y - - smtpd"
postconf -P "submission/inet/syslog_name=postfix/submission"
postconf -P "submission/inet/smtpd_tls_security_level=encrypt"
postconf -P "submission/inet/smtpd_sasl_auth_enable=yes"
postconf -P "submission/inet/smtpd_client_restrictions=permit_sasl_authenticated,reject"
postconf -P "submission/inet/milter_macro_daemon_name=ORIGINATING"

###############################################################################
# DKIM
###############################################################################

say "Setting up DKIM signing"

KEYDIR="/etc/opendkim/keys/$DOMAIN"
mkdir -p "$KEYDIR"

if [[ ! -f "$KEYDIR/$DKIM_SELECTOR.private" ]]; then
  opendkim-genkey -b 2048 -d "$DOMAIN" -D "$KEYDIR" -s "$DKIM_SELECTOR" -v >/dev/null 2>&1
  chown -R opendkim:opendkim /etc/opendkim
  chmod 600 "$KEYDIR/$DKIM_SELECTOR.private"
  note "generated a new 2048-bit key"
else
  note "keeping the existing key"
fi

cat > /etc/opendkim/key.table <<EOF
$DKIM_SELECTOR._domainkey.$DOMAIN $DOMAIN:$DKIM_SELECTOR:$KEYDIR/$DKIM_SELECTOR.private
EOF
cat > /etc/opendkim/signing.table <<EOF
*@$DOMAIN $DKIM_SELECTOR._domainkey.$DOMAIN
EOF
cat > /etc/opendkim/trusted.hosts <<EOF
127.0.0.1
localhost
$DOMAIN
EOF

cat > /etc/opendkim.conf <<EOF
# Written by install-mail-stack.sh.
Syslog                  yes
UMask                   007
Mode                    sv
Canonicalization        relaxed/simple
SubDomains              no
OversignHeaders         From

KeyTable                /etc/opendkim/key.table
SigningTable            refile:/etc/opendkim/signing.table
ExternalIgnoreList      /etc/opendkim/trusted.hosts
InternalHosts           /etc/opendkim/trusted.hosts

# A local socket rather than a port. Postfix is chrooted into /var/spool/postfix
# and cannot see a socket outside it, which is why this lives where it does.
Socket                  local:/var/spool/postfix/opendkim/opendkim.sock
PidFile                 /run/opendkim/opendkim.pid
UserID                  opendkim
EOF

mkdir -p /var/spool/postfix/opendkim
chown opendkim:postfix /var/spool/postfix/opendkim
chmod 750 /var/spool/postfix/opendkim
chown -R opendkim:opendkim /etc/opendkim
chmod 640 /etc/opendkim/key.table /etc/opendkim/signing.table /etc/opendkim/trusted.hosts

postconf -e "milter_protocol = 6"
postconf -e "milter_default_action = accept"
postconf -e "smtpd_milters = local:opendkim/opendkim.sock"
postconf -e "non_smtpd_milters = local:opendkim/opendkim.sock"

systemctl enable opendkim >/dev/null 2>&1 || true
systemctl restart opendkim
systemctl restart postfix
note "postfix and opendkim restarted"

###############################################################################
# Adding a mailbox
###############################################################################

cat > /usr/local/sbin/piper-mailbox <<'HELPER'
#!/usr/bin/env bash
#
# Mailboxes, one line at a time.
#
#   piper-mailbox add reports@mail.djpynxpro.com
#   piper-mailbox passwd reports@mail.djpynxpro.com
#   piper-mailbox list
#   piper-mailbox remove reports@mail.djpynxpro.com

set -euo pipefail
USERS=/etc/dovecot/users

if [[ $EUID -ne 0 ]]; then echo "Run this with sudo." >&2; exit 1; fi

cmd="${1:-}"
addr="${2:-}"

# ARGON2ID, matching the scheme the passdb declares. A hash written under one
# scheme and read under another is a password that is simply always wrong.
hash_for() {
  local pw pw2
  read -rsp "Password for $1: " pw; echo
  read -rsp "Again: " pw2; echo
  [[ "$pw" == "$pw2" ]] || { echo "They do not match." >&2; exit 1; }
  [[ ${#pw} -ge 10 ]] || { echo "Use at least 10 characters — this mailbox faces the internet." >&2; exit 1; }
  doveadm pw -s ARGON2ID -p "$pw"
}

case "$cmd" in
  add)
    [[ -n "$addr" ]] || { echo "Which address?" >&2; exit 1; }
    grep -q "^$addr:" "$USERS" 2>/dev/null && { echo "$addr already exists. Use: piper-mailbox passwd $addr" >&2; exit 1; }
    h="$(hash_for "$addr")"
    echo "$addr:$h" >> "$USERS"
    # Dovecot creates the Maildir on first delivery, but making it now means a
    # brand new mailbox can be signed into before anybody has written to it.
    d="/var/mail/vhosts/${addr#*@}/${addr%@*}"
    mkdir -p "$d"; chown -R vmail:vmail "$d"; chmod -R 700 "$d"
    echo "Added $addr"
    ;;
  passwd)
    [[ -n "$addr" ]] || { echo "Which address?" >&2; exit 1; }
    grep -q "^$addr:" "$USERS" || { echo "No such mailbox: $addr" >&2; exit 1; }
    h="$(hash_for "$addr")"
    tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
    grep -v "^$addr:" "$USERS" > "$tmp"
    echo "$addr:$h" >> "$tmp"
    cat "$tmp" > "$USERS"
    echo "Changed the password for $addr"
    ;;
  list)
    cut -d: -f1 "$USERS" 2>/dev/null || true
    ;;
  remove)
    [[ -n "$addr" ]] || { echo "Which address?" >&2; exit 1; }
    tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
    grep -v "^$addr:" "$USERS" > "$tmp" || true
    cat "$tmp" > "$USERS"
    echo "Removed $addr from the user list."
    echo "Its mail is still on disk at /var/mail/vhosts/${addr#*@}/${addr%@*}"
    echo "— delete that yourself once you are sure."
    ;;
  *)
    echo "Usage: piper-mailbox {add|passwd|list|remove} address@domain" >&2
    exit 1
    ;;
esac
HELPER
chmod 755 /usr/local/sbin/piper-mailbox

###############################################################################
# The firewall, and the DNS that is left
###############################################################################

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  say "Opening the mail ports on the firewall"
  for p in 25 587 993; do ufw allow "$p"/tcp >/dev/null 2>&1 || true; done
  note "25, 587, 993"
fi

# opendkim writes the record across several quoted lines inside one set of
# parentheses. It has to be reassembled, not grepped: taking one line gives a
# p= missing half the key, and a DKIM record that does not match the key signs
# every message with a signature nobody can verify — strictly worse than not
# signing at all. Joined, unquoted, and stripped of the whitespace the file
# uses for wrapping.
DKIM_RECORD="$(tr -d '\n' < "$KEYDIR/$DKIM_SELECTOR.txt" 2>/dev/null \
  | sed -e 's/^[^(]*(//' -e 's/).*$//' -e 's/"//g' -e 's/[[:space:]]\+//g')"

cat <<EOF

------------------------------------------------------------------------
Mail server is up. Add this DNS record before sending anything:

  Name : $DKIM_SELECTOR._domainkey.$DOMAIN
  Type : TXT
  Value: $DKIM_RECORD

If that came out empty, read it off the file directly:
  cat $KEYDIR/$DKIM_SELECTOR.txt

Then make a mailbox:
  sudo piper-mailbox add reports@$DOMAIN

And check it is listening:
  ss -lntp | grep -E ':(25|143|587|993)\b'
------------------------------------------------------------------------
EOF
