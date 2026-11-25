# Harry's server

Harry's world, always on, with Harry's Equestrian kept up to date without anyone doing anything.

- **compose.yml**: the Bedrock Dedicated Server ([itzg/minecraft-bedrock-server](https://github.com/itzg/docker-minecraft-bedrock-server)) and a small helper.
  It runs on x86 or ARM; on ARM (Oracle's free Ampere machines, a Raspberry Pi) the image runs the server through box64.
- **helper/helper.py** (Python standard library only):
  - follows `RELEASES_URL` (mod.phillm.dev/releases.json). The daily release run only publishes builds that pass every check,
    so a new `latest` there is a passing build. The helper installs it into the world **only when nobody is playing**,
    takes a backup first, restarts the server, checks that the add-on's scripts answer, and rolls back if they don't
    (the release is then "held" on the admin page until a newer one appears). Pack UUIDs are fixed, so the world upgrades in place.
  - optional `SKINS_URL` feed for Harry's horse skins pack (`{"version": "...", "file": "<.mcpack url>"}`), installed above the add-on.
  - daily backup at `BACKUP_HOUR` when nobody is on (keeps `BACKUP_KEEP`), plus a backup before every update and every import.
  - admin page on `ADMIN_PORT` (`http://<server>:8080/?k=<ADMIN_TOKEN>`): status, who can join (Xbox gamertags),
    update now, back up now, download any backup as an `.mcworld`, and **put a world on the server** (upload an exported `.mcworld`;
    the file is kept untouched in `backups/originals/`, and the world's game mode, difficulty and cheats are carried over).
  - first start: puts the latest add-on into a fresh world and runs a self-test (packs load and the add-on's scripts answer a command).
- Players download the add-on from the server when they join (`texturepack-required`), so iPads never need a manual install.

## Install on any Linux host (Debian/Ubuntu, x86 or ARM)

```bash
curl -fsSL https://raw.githubusercontent.com/phillmeredith/harrysmod/main/server/install-host.sh -o install-host.sh
sudo ALLOW_LIST_USERS="Gamertag1,Gamertag2" bash install-host.sh
```

It installs Docker, opens the firewall (TCP+UDP 19132, UDP 19133, UDP 19140-19155, TCP 8080), writes `/opt/harry-server/.env`
with a random admin key, starts everything and prints the admin page link. Running it again updates the kit files and
keeps `.env`, the world and the backups. On a cloud host, also allow those ports in the provider's firewall
(Oracle: the subnet's security list).

From a computer with SSH access to the host: `./deploy-ssh.sh user@host` does the same with the files in this folder.

## Moving to another host

1. On the old host's admin page, tap **Back up now**, then download the newest backup.
2. Install on the new host (above).
3. On the new host's admin page, put that `.mcworld` on the server, and enter the gamertags under **Who can join**.
4. Point the DNS name (or the iPad's server entry) at the new IP. Then switch the old host off.

## Ports

Bedrock 1.26 uses NetherNet by default: clients first talk to **TCP 19132** (signaling), then play over **UDP 19140-19155**
(`GAME_UDP_PORTS`, one port per player). The server tells clients its public IP for those UDP ports, so behind a
cloud NAT (Oracle, AWS) this must be the public address, which `<public_ipv4>` fills in. Open TCP 19132,
UDP 19132-19133 and UDP 19140-19155 in the provider firewall. Without the UDP range clients get the "Door" error.
