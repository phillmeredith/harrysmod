#!/bin/bash
# Put this kit on any Linux host you can SSH to, then install or update it there.
#   ./deploy-ssh.sh ubuntu@203.0.113.10            (uses ./.env if present, else makes one there)
# Moving host: run this against the new host, open its admin page, upload the latest backup
# (.mcworld from the old host's admin page) under "Put a world on the server", then point DNS at it.
set -euo pipefail
HOST=${1:?usage: deploy-ssh.sh user@host}
HERE=$(cd "$(dirname "$0")" && pwd)
ssh "$HOST" 'mkdir -p ~/harry-kit/helper'
scp -q "$HERE"/compose.yml "$HERE"/.env.example "$HERE"/install-host.sh "$HERE"/deploy-ssh.sh "$HERE"/README.md "$HOST":harry-kit/
scp -q "$HERE"/helper/helper.py "$HOST":harry-kit/helper/
if [ -f "$HERE/.env" ]; then
  ssh "$HOST" 'sudo mkdir -p /opt/harry-server && sudo test -f /opt/harry-server/.env' || scp -q "$HERE/.env" "$HOST":harry-kit/.env
  ssh "$HOST" 'test -f ~/harry-kit/.env && sudo mkdir -p /opt/harry-server && sudo mv ~/harry-kit/.env /opt/harry-server/.env || true'
fi
ssh -t "$HOST" "sudo KIT_DIR=\$HOME/harry-kit bash \$HOME/harry-kit/install-host.sh"
