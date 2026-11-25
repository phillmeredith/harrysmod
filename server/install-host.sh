#!/bin/bash
# Set up (or update) Harry's Minecraft server on any Debian/Ubuntu host, x86 or ARM.
# Safe to run again: it refreshes the kit files and keeps .env, the world and the backups.
#
#   sudo ALLOW_LIST_USERS="Gamertag1,Gamertag2" ADMIN_TOKEN="<random>" bash install-host.sh
#
# KIT_DIR=<folder holding compose.yml>  use local kit files (deploy-ssh.sh does this)
# KIT_REF=<branch>                     otherwise fetch the kit from GitHub at this branch (default main)
set -euo pipefail
INSTALL_DIR=${INSTALL_DIR:-/opt/harry-server}
KIT_REF=${KIT_REF:-main}
RAW="https://raw.githubusercontent.com/phillmeredith/harrysmod/${KIT_REF}/server"
[ "$(id -u)" = 0 ] || { echo "run as root (sudo)"; exit 1; }
say() { echo "== $*"; }

say "packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates iptables >/dev/null
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  say "installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

say "time zone ${TZ:-Europe/London}"
timedatectl set-timezone "${TZ:-Europe/London}" 2>/dev/null || ln -sf "/usr/share/zoneinfo/${TZ:-Europe/London}" /etc/localtime

say "kit files into $INSTALL_DIR"
mkdir -p "$INSTALL_DIR/helper" "$INSTALL_DIR/data" "$INSTALL_DIR/backups"
for f in compose.yml .env.example helper/helper.py install-host.sh deploy-ssh.sh README.md; do
  if [ -n "${KIT_DIR:-}" ]; then
    [ -f "$KIT_DIR/$f" ] && cp "$KIT_DIR/$f" "$INSTALL_DIR/$f"
  else
    curl -fsSL "$RAW/$f?$(date +%s)" -o "$INSTALL_DIR/$f.new" && mv "$INSTALL_DIR/$f.new" "$INSTALL_DIR/$f"
  fi
done

ENVF="$INSTALL_DIR/.env"
if [ ! -f "$ENVF" ]; then
  say "writing .env"
  cp "$INSTALL_DIR/.env.example" "$ENVF"
  TOKEN=${ADMIN_TOKEN:-$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)}
  sed -i "s|^ADMIN_TOKEN=.*|ADMIN_TOKEN=$TOKEN|" "$ENVF"
  [ -n "${ALLOW_LIST_USERS:-}" ] && sed -i "s|^ALLOW_LIST_USERS=.*|ALLOW_LIST_USERS=$ALLOW_LIST_USERS|" "$ENVF"
  [ -n "${SERVER_NAME:-}" ] && sed -i "s|^SERVER_NAME=.*|SERVER_NAME=$SERVER_NAME|" "$ENVF"
fi
chmod 600 "$ENVF"
envget() { grep -E "^$1=" "$ENVF" | tail -1 | cut -d= -f2-; }
SERVER_PORT=$(envget SERVER_PORT); SERVER_PORT_V6=$(envget SERVER_PORT_V6)
ADMIN_PORT=$(envget ADMIN_PORT); ADMIN_TOKEN=$(envget ADMIN_TOKEN)

say "firewall: game TCP+UDP ${SERVER_PORT:-19132} (NetherNet), UDP ${SERVER_PORT_V6:-19133}, admin TCP ${ADMIN_PORT:-8080}"
open_port() { # proto port
  iptables -C INPUT -p "$1" --dport "$2" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p "$1" --dport "$2" -j ACCEPT \
    || echo "(could not open $1 $2 in iptables; open it by hand if the host has a firewall)"
}
open_port udp "${SERVER_PORT:-19132}"; open_port tcp "${SERVER_PORT:-19132}"; open_port udp "${SERVER_PORT_V6:-19133}"; open_port tcp "${ADMIN_PORT:-8080}"
if command -v ip6tables >/dev/null; then
  ip6tables -C INPUT -p udp --dport "${SERVER_PORT_V6:-19133}" -j ACCEPT 2>/dev/null || ip6tables -I INPUT 1 -p udp --dport "${SERVER_PORT_V6:-19133}" -j ACCEPT || true
fi
if command -v netfilter-persistent >/dev/null; then netfilter-persistent save >/dev/null 2>&1 || true
elif [ -d /etc/iptables ]; then iptables-save > /etc/iptables/rules.v4 || true; fi
if command -v ufw >/dev/null && ufw status | grep -q active; then
  ufw allow "${SERVER_PORT:-19132}"; ufw allow "${SERVER_PORT_V6:-19133}/udp"; ufw allow "${ADMIN_PORT:-8080}/tcp"
fi

say "starting"
cd "$INSTALL_DIR"
docker compose pull -q || echo "(could not pull new images, using the ones already here)"
docker compose up -d
IP=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
say "done. Admin page: http://$IP:${ADMIN_PORT:-8080}/?k=$ADMIN_TOKEN"
say "Game address: $IP port ${SERVER_PORT:-19132}"
