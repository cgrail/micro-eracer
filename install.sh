#!/usr/bin/env bash
# ============================================================
# Micro E-Racer — deploy onto the mech-vs-mech box
#
# Adds the game and its race server to an Ubuntu server that was
# already set up by mech-vs-mech's install.sh in Let's Encrypt mode
# (Caddy terminating HTTPS on the box), next to Electro Car Racer and
# calvo. That script owns the OS hardening, firewall, Node.js and
# Caddy install; this one only deploys the game:
#
#   App     code synced to /opt/micro-eracer and built there,
#           owned by root, run by the unprivileged user "mer"
#           (the service can't modify itself)
#   Run     sandboxed systemd unit, loopback-only on 127.0.0.1:8091
#           (mech-vs-mech uses 8080, Electro Car Racer 8090, calvo 3000)
#   TLS     Caddy site file /etc/caddy/apps/micro-eracer.caddy
#           serving https://$DOMAIN with an auto-issued/renewed
#           certificate
#   Update  update.sh deploys whatever lands on origin/main: at once
#           when GitHub's push webhook reaches the game server
#           (POST /deploy-hook, which a systemd path unit picks up),
#           and from a systemd timer every 5 minutes anyway
#
# Usage — run ON the server, from a checkout of this repo:
#
#   git clone https://github.com/cgrail/micro-eracer.git && cd micro-eracer
#   sudo DOMAIN=micro.example.com ./install.sh   # first run: DOMAIN is required
#   sudo ./install.sh                            # later runs reuse it
#
# DOMAIN is remembered in /etc/default/micro-eracer, so re-runs are
# plain `sudo ./install.sh`. The first run also puts the webhook's
# secret there (DEPLOY_HOOK_SECRET); the summary says how to add the
# webhook on GitHub. Settings you add to that file (see the
# README) are kept. Re-running is safe: it re-syncs and rebuilds the
# code, restarts the service and refreshes the Caddy site. The server
# keeps no state; a restart only ends the Races that are running.
#
# DNS: point a plain UN-proxied A/AAAA record for $DOMAIN at this
# box — Caddy keeps retrying issuance until it resolves here.
# ============================================================
set -Eeuo pipefail # -E: the ERR trap below also fires inside functions

APP=micro-eracer
APP_DIR=/opt/$APP
APP_USER=mer
APP_HOME=/var/lib/$APP
APP_PORT=8091
DEFAULTS_FILE=/etc/default/$APP
CADDY_SITE=/etc/caddy/apps/$APP.caddy
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# set -e aborts on any failure — make sure it never does so silently
trap 'die "install.sh failed at line $LINENO: $BASH_COMMAND"' ERR

# ---------- preflight ----------
[[ $EUID -eq 0 ]] || die "run with sudo: sudo ./install.sh"
[[ -f $SRC_DIR/package.json && -f $SRC_DIR/server/src/index.ts ]] \
  || die "run this script from a checkout of the Micro E-Racer repo"
command -v node > /dev/null \
  || die "Node.js missing — run mech-vs-mech's install.sh on this box first"
node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 12) ? 0 : 1)' \
  || die "Node.js $(node --version) is too old to build the game (22.12 or newer) — re-run mech-vs-mech's install.sh"
if ! command -v caddy > /dev/null || ! systemctl is-active --quiet caddy; then
  die "Caddy is not running — the game shares ports 80/443 through Caddy, so
       this box must be in Let's Encrypt mode: run mech-vs-mech's install.sh
       with DOMAIN=… first, then re-run this script"
fi

# ---------- domain (remembered across runs) ----------
if [[ -z ${DOMAIN+x} && -f $DEFAULTS_FILE ]]; then
  DOMAIN="$(sed -n 's/^DOMAIN=//p' "$DEFAULTS_FILE" | tail -1)"
fi
DOMAIN="${DOMAIN:-}"
[[ -n $DOMAIN ]] \
  || die "give the hostname to serve the game on: sudo DOMAIN=micro.example.com ./install.sh"
[[ $DOMAIN =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] \
  || die "DOMAIN doesn't look like a hostname: $DOMAIN"
log "Micro E-Racer will be served at https://$DOMAIN"

# ---------- app user + code ----------
if ! id -u "$APP_USER" > /dev/null 2>&1; then
  log "Creating system user '$APP_USER'"
  useradd --system --home-dir "$APP_HOME" --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

log "Syncing code to $APP_DIR and building"
install -d -m 755 "$APP_DIR"
rsync -a --delete --exclude .git --exclude node_modules --exclude dist --exclude .claude "$SRC_DIR/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
runuser -u "$APP_USER" -- bash -c "cd '$APP_DIR' && HOME='$APP_HOME' npm ci --no-audit --no-fund && HOME='$APP_HOME' npm run build"
# the service user may read the code but never write it
chown -R "root:$APP_USER" "$APP_DIR"
chmod -R g-w,o-rwx "$APP_DIR"

# ---------- systemd service (sandboxed) ----------
log "Installing systemd service"
# settings someone added by hand survive; the ones below are this script's
extra="$(grep -vE '^(#|$|PORT=|HOST=|DOMAIN=|DEPLOY_HOOK_SECRET=)' "$DEFAULTS_FILE" 2> /dev/null || true)"
# the secret GitHub signs its push webhook with: made on the first run, then kept
hook_secret="$(sed -n 's/^DEPLOY_HOOK_SECRET=//p' "$DEFAULTS_FILE" 2> /dev/null | tail -1 || true)"
[[ -n $hook_secret ]] || hook_secret="$(od -An -tx1 -N32 /dev/urandom | tr -d ' \n')"
# root-only before the secret goes in (systemd reads it as root)
touch "$DEFAULTS_FILE"
chmod 600 "$DEFAULTS_FILE"
{
  echo "# Micro E-Racer settings — install.sh rewrites the four below on every run"
  echo "# (keeping the secret); other settings (see the README) can be added and are kept"
  echo "PORT=$APP_PORT"
  echo "HOST=127.0.0.1"
  echo "DOMAIN=$DOMAIN"
  echo "DEPLOY_HOOK_SECRET=$hook_secret"
  if [[ -n $extra ]]; then printf '%s\n' "$extra"; fi
} > "$DEFAULTS_FILE"
cat > /etc/systemd/system/$APP.service <<EOF
[Unit]
Description=Micro E-Racer game and race server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=-$DEFAULTS_FILE
Environment=NODE_ENV=production
# the deploy hook asks for a deploy by writing \$RUNTIME_DIRECTORY/deploy, which
# $APP-update.path watches; kept across restarts, since removing it counts as a change
RuntimeDirectory=$APP
RuntimeDirectoryPreserve=yes
# tsx runs the TypeScript server as it is; it caches the compiled code in the private /tmp
ExecStart=$(command -v node) --import tsx $APP_DIR/server/src/index.ts
Restart=always
RestartSec=2
LimitNOFILE=65535

# resource ceilings — the server keeps no state, a kill+restart is harmless
MemoryMax=512M
TasksMax=32

# sandbox: read-only everything; no capabilities needed on an
# unprivileged loopback port.
# (No MemoryDenyWriteExecute — the V8 JIT and WebAssembly need W+X pages.)
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
ProtectProc=invisible
ProcSubset=pid
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM
SystemCallArchitectures=native
CapabilityBoundingSet=
UMask=0077

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable $APP
systemctl restart $APP

# record what's deployed so update.sh's timer doesn't redeploy it
runuser -u "$(stat -c %U "$SRC_DIR")" -- git -C "$SRC_DIR" rev-parse HEAD \
  > "$APP_HOME/deployed-rev" 2> /dev/null || true

# ---------- Caddy site ----------
log "Configuring Caddy → https://$DOMAIN"
install -d -m 755 /etc/caddy/apps
previous="$(cat "$CADDY_SITE" 2> /dev/null || true)"
cat > "$CADDY_SITE" <<EOF
# managed by Micro E-Racer's install.sh — re-runs overwrite this file
$DOMAIN {
	encode zstd gzip
	# the game's files and its Races (Colyseus over WebSocket), on the loopback interface
	reverse_proxy 127.0.0.1:$APP_PORT
}
EOF
# the main Caddyfile belongs to mech-vs-mech's install.sh; current versions
# emit this import themselves — append it only if it's missing
if ! grep -qF 'import /etc/caddy/apps/*.caddy' /etc/caddy/Caddyfile; then
  printf '\nimport /etc/caddy/apps/*.caddy\n' >> /etc/caddy/Caddyfile
fi
if ! caddy validate --config /etc/caddy/Caddyfile > /dev/null 2>&1; then
  # never leave Caddy with a config it refuses (e.g. a hostname another app already serves)
  if [[ -n $previous ]]; then printf '%s\n' "$previous" > "$CADDY_SITE"; else rm -f "$CADDY_SITE"; fi
  die "/etc/caddy/Caddyfile fails validation with $DOMAIN added (is that hostname served already?);
       the previous site file is back in place — see: caddy validate --config /etc/caddy/Caddyfile"
fi
systemctl reload-or-restart caddy

# ---------- auto-update: on GitHub's push webhook, and every 5 min ----------
log "Installing auto-update (update.sh) on the deploy hook and a timer"
cat > /etc/systemd/system/$APP-update.service <<EOF
[Unit]
Description=Micro E-Racer auto-update (fetch origin, rebuild, restart)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/bash $SRC_DIR/update.sh
EOF
cat > /etc/systemd/system/$APP-update.timer <<EOF
[Unit]
Description=Micro E-Racer update check every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
RandomizedDelaySec=30

[Install]
WantedBy=timers.target
EOF
cat > /etc/systemd/system/$APP-update.path <<EOF
[Unit]
Description=Micro E-Racer update as soon as GitHub reports a push to main

[Path]
# written by the game server's deploy hook (server/src/deployHook.ts)
PathModified=/run/$APP/deploy
Unit=$APP-update.service

[Install]
WantedBy=paths.target
EOF
systemctl daemon-reload
systemctl enable --now $APP-update.timer $APP-update.path

# ---------- summary ----------
sleep 3 # tsx compiles the server on its first start
log "Done"
if systemctl --no-pager --quiet is-active $APP; then
  echo "  game server  : running on 127.0.0.1:$APP_PORT (behind Caddy)"
  if curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/"; then
    echo "  local check  : the game page answers"
  else
    warn "the game page does not answer yet — check: journalctl -u $APP"
  fi
  hook="$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$APP_PORT/deploy-hook" || true)"
  if [[ $hook == 401 ]]; then
    echo "  deploy hook  : on (it refuses unsigned requests)"
  else
    warn "the deploy hook is off (HTTP $hook) — check: journalctl -u $APP"
  fi
else
  warn "the game server is NOT running — check: journalctl -u $APP"
fi
cat <<EOF

  dns          : point a plain UN-proxied A/AAAA record for $DOMAIN at this
                 box — Caddy keeps retrying issuance until it resolves here
  certificate  : Let's Encrypt via Caddy, auto-issued + auto-renewed;
                 watch issuance: journalctl -u caddy -f
  firewall     : untouched — 80/443 are already open from the
                 mech-vs-mech setup; the game's port is loopback-only
  settings     : $DEFAULTS_FILE   (then: systemctl restart $APP)
  logs         : journalctl -u $APP -f
  quick check  : curl -sI https://$DOMAIN/ | head -1
  updates      : auto — a push to origin/main goes live as soon as it is
                 built, once GitHub's webhook is added (repo → Settings →
                 Webhooks → Add webhook):
                   Payload URL   https://$DOMAIN/deploy-hook
                   Content type  application/json
                   Secret        sudo sed -n 's/^DEPLOY_HOOK_SECRET=//p' $DEFAULTS_FILE
                   Events        Just the push event
                 and within ~5 min anyway; both run update.sh
                 ($APP-update.path and .timer; it discards local edits
                 in this checkout); manual: sudo ./update.sh --force
EOF
