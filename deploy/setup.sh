#!/usr/bin/env bash
#
# One-time droplet setup for Piper. Run as root on a fresh Ubuntu droplet:
#
#   curl -fsSL https://raw.githubusercontent.com/piperwindsorstar-blip/Piper/claude/wedding-dj-crm-sltogo/deploy/setup.sh -o setup.sh
#   sudo bash setup.sh crm.yourdomain.ca
#
# Or clone the repo first and run: sudo bash deploy/setup.sh crm.yourdomain.ca
#
# Idempotent: safe to re-run.

set -euo pipefail

DOMAIN="${1:-}"
REPO="${PIPER_REPO:-https://github.com/piperwindsorstar-blip/Piper.git}"
BRANCH="${PIPER_BRANCH:-claude/wedding-dj-crm-sltogo}"
APP_DIR=/srv/piper
DATA_DIR=/var/lib/piper
BACKUP_DIR=/var/backups/piper

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash setup.sh crm.yourdomain.ca" >&2
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi

echo "==> Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git ufw >/dev/null

if ! command -v node >/dev/null || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt 20 ]]; then
  echo "==> Installing Node.js 22"
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
fi
echo "    node $(node -v)"

if ! command -v caddy >/dev/null; then
  echo "==> Installing Caddy (handles HTTPS certificates automatically)"
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi

echo "==> Creating the piper service user"
id -u piper >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin piper

echo "==> Fetching the application"
if [[ -d "$APP_DIR/.git" ]]; then
  # Re-running setup on an existing install: the checkout is piper's by now,
  # so update it as piper. See deploy.sh for why not as root.
  sudo -u piper git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  sudo -u piper git -C "$APP_DIR" checkout --quiet -B "$BRANCH" "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --quiet --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

# The database lives outside the checkout, so no deploy can ever remove it.
mkdir -p "$DATA_DIR" "$BACKUP_DIR"
chown -R piper:piper "$APP_DIR" "$DATA_DIR" "$BACKUP_DIR"

# Same reason as deploy.sh: the piper user inherits this directory from sudo,
# and cannot enter /root.
cd "$APP_DIR"

if [[ ! -f /etc/piper.env ]]; then
  echo "==> Writing /etc/piper.env"
  cat > /etc/piper.env <<ENVEOF
# Token the crew-report import endpoint requires. Rotate by changing this and
# restarting: sudo systemctl restart piper
PIPER_IMPORT_TOKEN=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 32)
ENVEOF
  chmod 600 /etc/piper.env
fi

echo "==> Installing dependencies and building (this is the slow part)"
# Full install, not --omit=dev: `next build` needs typescript, and the backup
# and admin scripts need tsx. Both live in devDependencies.
# Playwright is dev-only tooling — skip its browser download on the server.
sudo -u piper env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm --prefix "$APP_DIR" ci --silent \
  || sudo -u piper env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm --prefix "$APP_DIR" install --silent
sudo -u piper env NODE_ENV=production PIPER_DATA_DIR="$DATA_DIR" npm --prefix "$APP_DIR" run build

echo "==> Installing services"
cp "$APP_DIR/deploy/piper.service" /etc/systemd/system/
cp "$APP_DIR/deploy/piper-backup.service" /etc/systemd/system/
cp "$APP_DIR/deploy/piper-backup.timer" /etc/systemd/system/
cp "$APP_DIR/deploy/piper-verify.service" /etc/systemd/system/
cp "$APP_DIR/deploy/piper-verify.timer" /etc/systemd/system/
sed "s/crm\.example\.com/$DOMAIN/" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile

systemctl daemon-reload
systemctl enable --now piper >/dev/null
systemctl enable --now piper-backup.timer >/dev/null
systemctl enable --now piper-verify.timer >/dev/null
systemctl reload caddy || systemctl restart caddy

echo "==> Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo ""
echo "Done. Piper is running behind https://$DOMAIN"
echo ""
echo "Create your admin account:"
echo "  cd $APP_DIR && sudo -u piper env PIPER_DATA_DIR=$DATA_DIR \\"
echo "    npx tsx scripts/create-admin.ts \"you@pynxpro.ca\" \"Your Name\" \"a-real-password\""
echo ""
echo "Check a backup restores at any time:"
echo "  cd $APP_DIR && sudo -u piper env PIPER_DATA_DIR=$DATA_DIR \\"
echo "    npx tsx scripts/verify-backup.ts $BACKUP_DIR"
echo ""
echo "Your crew-report import token:"
echo "  sudo grep PIPER_IMPORT_TOKEN /etc/piper.env"
