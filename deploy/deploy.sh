#!/usr/bin/env bash
#
# Updates a running Piper to the latest code.
#
#   sudo bash /srv/piper/deploy/deploy.sh
#
# Backs the database up before touching anything, so a bad deploy is one file
# copy away from being undone.

set -euo pipefail

APP_DIR=/srv/piper
DATA_DIR=/var/lib/piper
BACKUP_DIR=/var/backups/piper
BRANCH="${PIPER_BRANCH:-claude/wedding-dj-crm-sltogo}"

if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi

# Everything below runs as the piper user, and sudo hands that user the
# directory we are standing in. Run from /root — the obvious place to be after
# an ssh login — and piper is refused entry to it before a single command
# starts: "spawn sh EACCES". So move somewhere piper owns first.
cd "$APP_DIR"

echo "==> Backing up the database first"
sudo -u piper env PIPER_DATA_DIR="$DATA_DIR" \
  npx --prefix "$APP_DIR" tsx "$APP_DIR/scripts/backup-db.ts" "$BACKUP_DIR"

echo "==> Fetching latest code"
# Git runs as piper, not root, for two reasons. The checkout belongs to piper,
# and git refuses to touch a repository owned by someone else ("dubious
# ownership") -- but adding a safe.directory exception would only trade that
# for a worse problem: a checkout run as root writes root-owned files into a
# tree piper has to build in, and the failure would surface a deploy later,
# somewhere else.
as_piper() { sudo -u piper git -C "$APP_DIR" "$@"; }

as_piper fetch --quiet origin "$BRANCH"
BEFORE=$(as_piper rev-parse HEAD)
as_piper checkout --quiet -B "$BRANCH" "origin/$BRANCH"
AFTER=$(as_piper rev-parse HEAD)

# Heals a checkout an earlier root-run deploy left partly root-owned.
chown -R piper:piper "$APP_DIR"

if [[ "$BEFORE" == "$AFTER" ]]; then
  echo "    already up to date ($AFTER)"
else
  echo "    $BEFORE -> $AFTER"
fi

echo "==> Installing dependencies"
# Full install: build needs typescript, scripts need tsx (both devDependencies).
sudo -u piper env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm --prefix "$APP_DIR" ci --silent \
  || sudo -u piper env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm --prefix "$APP_DIR" install --silent

echo "==> Building"
sudo -u piper env NODE_ENV=production PIPER_DATA_DIR="$DATA_DIR" npm --prefix "$APP_DIR" run build

echo "==> Restarting"
# Any pending schema migrations run on the first database connection after this.
systemctl restart piper
sleep 3
systemctl is-active --quiet piper && echo "    piper is running" || {
  echo "    piper FAILED to start — check: journalctl -u piper -n 50" >&2
  exit 1
}

echo ""
echo "Deployed. Rolling back if needed:"
echo "  sudo systemctl stop piper"
echo "  sudo -u piper cp $BACKUP_DIR/<backup>.db $DATA_DIR/piper.db"
echo "  cd $APP_DIR && sudo git checkout $BEFORE && sudo bash deploy/deploy.sh"
