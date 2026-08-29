#!/usr/bin/env bash
#
# Gets the webmail installer onto the mail droplet and runs it.
#
#   curl -fsSL https://raw.githubusercontent.com/piperwindsorstar-blip/Piper/claude/wedding-dj-crm-sltogo/deploy/mail/bootstrap.sh \
#     -o /tmp/bootstrap.sh
#   bash /tmp/bootstrap.sh mail.djpynxpro.com
#
# The token is optional — without it everything installs and the Piper button
# stays hidden. With one, put the real value on the line; a placeholder in
# angle brackets is a shell redirect, not a placeholder:
#
#   PIPER_IMPORT_TOKEN=realtoken bash /tmp/bootstrap.sh mail.djpynxpro.com
#
# The mail server is not the machine Piper runs on, so there is no checkout of
# this repository there and nothing to run install-webmail.sh from. That script
# also needs its siblings — the nginx template, the mail-stack script, the
# plugin — so a single curl of one file cannot work. This fetches the lot.
#
# Idempotent, because everything it calls is.

set -euo pipefail

DOMAIN="${1:-}"
REPO="${PIPER_REPO:-piperwindsorstar-blip/Piper}"
BRANCH="${PIPER_BRANCH:-claude/wedding-dj-crm-sltogo}"
DEST="${PIPER_MAIL_DIR:-/opt/piper-mail}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: ... | sudo bash -s -- mail.yourdomain.com" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi

echo "==> Fetching the installer"
command -v curl >/dev/null || { apt-get update -qq && apt-get install -y -qq curl; }
command -v tar  >/dev/null || { apt-get update -qq && apt-get install -y -qq tar; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# The branch name has slashes in it, so the tarball is asked for by full ref
# rather than by short name — codeload cannot tell where the branch ends and a
# path begins otherwise.
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" -o "$TMP/piper.tar.gz"
tar xzf "$TMP/piper.tar.gz" -C "$TMP"

# Depth 3, not 2: the tarball wraps everything in a directory of its own, so
# the path is <TMP>/Piper-<branch>/deploy/mail.
SRC="$(find "$TMP" -maxdepth 3 -type d -path '*/deploy/mail' -print -quit)"
if [[ -z "$SRC" ]]; then
  echo "    deploy/mail was not in that download — wrong branch?" >&2
  exit 1
fi

# Replaced wholesale rather than merged, so a re-run cannot leave half of one
# version next to half of another.
rm -rf "${DEST:?}"
mkdir -p "$DEST"
cp -a "$SRC"/. "$DEST/"
chmod +x "$DEST"/*.sh
echo "    installer is at $DEST"

echo "==> Running it"
exec bash "$DEST/install-webmail.sh" "$DOMAIN"
