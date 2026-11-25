#!/usr/bin/env python3
"""Harry's server helper.

Runs beside the Bedrock server container and does the jobs nobody should have to do by hand:

* follows the add-on's releases.json and installs each new release into the world
  (only when nobody is playing, with a backup first and a rollback if the server will not start)
* optionally follows a second feed for Harry's horse skins (a resource pack that sits above the add-on)
* takes a daily backup of the world (when nobody is playing) and keeps the last few
* serves a small admin page (status, update now, back up now, download a backup, import a world)

Standard library only, so it runs in a plain python image on any host.
It talks to Docker through /var/run/docker.sock to stop and start the server container.
"""
import cgi  # noqa: deprecated but still in 3.12, and it streams big uploads to disk
import datetime as dt
import gzip
import hashlib
import html
import http.client
import http.server
import io
import json
import os
import re
import shutil
import socket
import socketserver
import struct
import sys
import tarfile
import tempfile
import threading
import time
import traceback
import urllib.parse
import urllib.request
import zipfile

# ---------------------------------------------------------------- settings
E = os.environ.get
DATA = E("DATA_DIR", "/data")                 # the Bedrock server's /data volume
BACKUPS = E("BACKUP_DIR", "/backups")
STATE_DIR = os.path.join(DATA, ".helper")
LEVEL = E("LEVEL_NAME", "Harrys World")
WORLD = os.path.join(DATA, "worlds", LEVEL)
BDS = E("BDS_CONTAINER", "harry-bds")
BDS_PORT = int(E("SERVER_PORT", "19132"))
RELEASES_URL = E("RELEASES_URL", "https://mod.phillm.dev/releases.json")
SKINS_URL = E("SKINS_URL", "")                # optional: {"version": "...", "file": "<url of .mcpack>"}
CHECK_MINUTES = int(E("CHECK_MINUTES", "10"))
BACKUP_HOUR = int(E("BACKUP_HOUR", "4"))      # local hour for the daily backup
BACKUP_KEEP = int(E("BACKUP_KEEP", "14"))
ADMIN_PORT = int(E("ADMIN_PORT", "8080"))
ADMIN_TOKEN = E("ADMIN_TOKEN", "")
TZ_NAME = E("TZ", "Europe/London")
ADDON_BP = E("ADDON_BP_UUID", "f4ce4d62-bc57-410a-a3e5-3d8be65eb3bb")
ADDON_RP = E("ADDON_RP_UUID", "e9b60629-72a4-4317-a710-dce65aa4e7fd")
UA = "harry-server-helper/1"

os.makedirs(STATE_DIR, exist_ok=True)
os.makedirs(BACKUPS, exist_ok=True)
LOCK = threading.RLock()
LOG = []


def log(msg):
    line = f"{dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line, flush=True)
    LOG.append(line)
    del LOG[:-300]


def state():
    try:
        with open(os.path.join(STATE_DIR, "state.json")) as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(**kw):
    s = state()
    s.update(kw)
    tmp = os.path.join(STATE_DIR, "state.json.tmp")
    with open(tmp, "w") as f:
        json.dump(s, f, indent=1)
    os.replace(tmp, os.path.join(STATE_DIR, "state.json"))


# ---------------------------------------------------------------- docker
class UnixHTTP(http.client.HTTPConnection):
    def __init__(self):
        super().__init__("localhost", timeout=300)

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(300)
        self.sock.connect("/var/run/docker.sock")


def docker(method, path, body=None):
    c = UnixHTTP()
    hdrs = {"Content-Type": "application/json"} if body is not None else {}
    c.request(method, path, body=json.dumps(body) if body is not None else None, headers=hdrs)
    r = c.getresponse()
    data = r.read()
    if r.status >= 400 and r.status != 304:
        raise RuntimeError(f"docker {method} {path}: {r.status} {data[:200]!r}")
    return data


def bds_running():
    try:
        info = json.loads(docker("GET", f"/containers/{BDS}/json"))
        return info["State"]["Running"]
    except Exception:
        return False


def bds_stop():
    log("stopping the server")
    docker("POST", f"/containers/{BDS}/stop?t=90")


def bds_start():
    log("starting the server")
    docker("POST", f"/containers/{BDS}/start")


def bds_logs(since=0, tail=400):
    return demux(docker("GET", f"/containers/{BDS}/logs?stdout=1&stderr=1&since={int(since)}&tail={tail}"))


def bds_command(cmd):
    """Send a console command using the image's send-command helper."""
    bds_exec(["send-command", cmd])


# ---------------------------------------------------------------- status ping (player count)
def demux(raw):
    out, i = [], 0
    while i + 8 <= len(raw) and raw[i] in (0, 1, 2) and raw[i + 1:i + 4] == b"\0\0\0":
        n = struct.unpack(">I", raw[i + 4:i + 8])[0]
        out.append(raw[i + 8:i + 8 + n])
        i += 8 + n
    return (b"".join(out) if out else raw).decode("utf-8", "replace")


def bds_exec(cmd):
    ex = json.loads(docker("POST", f"/containers/{BDS}/exec",
                           {"Cmd": cmd, "AttachStdout": True, "AttachStderr": True}))
    out = demux(docker("POST", f"/exec/{ex['Id']}/start", {"Detach": False}))
    code = json.loads(docker("GET", f"/exec/{ex['Id']}/json")).get("ExitCode")
    return code, out


def ping():
    """Ask the server for its status with the image's own mc-monitor (handles NetherNet and RakNet).
    Returns dict(version, players, max) or None."""
    try:
        if not bds_running():
            return None
        code, out = bds_exec(["mc-monitor", "status-bedrock", "--host", "127.0.0.1",
                              "--port", str(BDS_PORT)])
    except Exception:
        return None
    m = re.search(r"version=(\S+) online=(\d+) max=(\d+)", out)
    if code != 0 or not m:
        return None
    return {"version": m.group(1), "players": int(m.group(2)), "max": int(m.group(3))}


def players_online():
    p = ping()
    return None if p is None else p["players"]


# ---------------------------------------------------------------- packs
def read_manifest(d):
    try:
        with open(os.path.join(d, "manifest.json"), encoding="utf-8-sig") as f:
            txt = re.sub(r"^\s*//.*$", "", f.read(), flags=re.M)
        return json.loads(txt)
    except Exception:
        return None


def find_packs(root):
    """Every folder under root that holds a manifest.json -> (path, manifest)."""
    found = []
    for dirpath, dirs, files in os.walk(root):
        if "manifest.json" in files:
            m = read_manifest(dirpath)
            if m and "header" in m:
                found.append((dirpath, m))
                dirs[:] = []
    return found


def pack_kind(m):
    types = {mod.get("type") for mod in m.get("modules", [])}
    if types & {"resources"}:
        return "resource"
    if types & {"data", "script", "client_data"}:
        return "behavior"
    return None


def unpack_any(path, dest):
    """Unzip an .mcaddon/.mcpack/.zip, recursing into inner .mcpack files."""
    with zipfile.ZipFile(path) as z:
        for n in z.namelist():
            if n.startswith("/") or ".." in n.split("/"):
                raise ValueError(f"unsafe path in zip: {n}")
        z.extractall(dest)
    for dirpath, _, files in os.walk(dest):
        for fn in files:
            if fn.lower().endswith((".mcpack", ".mcaddon")):
                inner = os.path.join(dirpath, fn)
                unpack_any(inner, os.path.join(dirpath, fn + "_x"))
                os.remove(inner)


def world_pack_list(kind):
    p = os.path.join(WORLD, f"world_{kind}_packs.json")
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return []


def write_world_pack_list(kind, lst):
    with open(os.path.join(WORLD, f"world_{kind}_packs.json"), "w") as f:
        json.dump(lst, f, indent=1)


def install_pack(src_dir, m, folder_name, top=True):
    """Copy a pack into the world, replacing any copy with the same uuid, and list it."""
    kind = pack_kind(m)
    uuid = m["header"]["uuid"]
    version = m["header"]["version"]
    packs_dir = os.path.join(WORLD, f"{kind}_packs")
    os.makedirs(packs_dir, exist_ok=True)
    for path, old in find_packs(packs_dir):
        if old["header"]["uuid"] == uuid:
            shutil.rmtree(path)
    shutil.copytree(src_dir, os.path.join(packs_dir, folder_name))
    lst = [e for e in world_pack_list(kind) if e.get("pack_id") != uuid]
    entry = {"pack_id": uuid, "version": version}
    lst = [entry] + lst if top else lst + [entry]
    write_world_pack_list(kind, lst)
    return kind, uuid, version


def installed_version(uuid):
    for kind in ("behavior", "resource"):
        for e in world_pack_list(kind):
            if e.get("pack_id") == uuid:
                return ".".join(str(x) for x in e.get("version", []))
    return None


def snapshot_packs():
    """Copy the world's pack folders and lists so an update can be rolled back."""
    snap = os.path.join(STATE_DIR, "packs_before_update")
    shutil.rmtree(snap, ignore_errors=True)
    os.makedirs(snap)
    for name in ("behavior_packs", "resource_packs"):
        if os.path.isdir(os.path.join(WORLD, name)):
            shutil.copytree(os.path.join(WORLD, name), os.path.join(snap, name))
    for name in ("world_behavior_packs.json", "world_resource_packs.json"):
        if os.path.exists(os.path.join(WORLD, name)):
            shutil.copy2(os.path.join(WORLD, name), snap)
    return snap


def restore_packs(snap):
    for name in ("behavior_packs", "resource_packs"):
        shutil.rmtree(os.path.join(WORLD, name), ignore_errors=True)
        if os.path.isdir(os.path.join(snap, name)):
            shutil.copytree(os.path.join(snap, name), os.path.join(WORLD, name))
    for name in ("world_behavior_packs.json", "world_resource_packs.json"):
        if os.path.exists(os.path.join(snap, name)):
            shutil.copy2(os.path.join(snap, name), WORLD)


# ---------------------------------------------------------------- downloads
def fetch(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=120) as r:
        if dest is None:
            return r.read()
        with open(dest, "wb") as f:
            shutil.copyfileobj(r, f)
    return dest


def latest_addon():
    rel = json.loads(fetch(RELEASES_URL + ("&" if "?" in RELEASES_URL else "?") + f"t={int(time.time())}"))
    latest = rel["latest"]
    entry = next(r for r in rel["releases"] if r["version"] == latest)
    url = urllib.parse.urljoin(RELEASES_URL, entry["file"])
    return latest, url


def vtuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", str(v)))


# ---------------------------------------------------------------- backups
def backup(reason="daily", restart=True):
    """Stop the server, zip the world, start it again. Caller checks nobody is playing."""
    with LOCK:
        if not os.path.isdir(WORLD):
            log("no world yet, nothing to back up")
            return None
        was_running = bds_running()
        if was_running:
            bds_stop()
        try:
            stamp = dt.datetime.now().strftime("%Y-%m-%d_%H%M")
            name = f"{LEVEL.replace(' ', '_')}_{stamp}_{reason}.mcworld"
            out = os.path.join(BACKUPS, name)
            make_mcworld(WORLD, out + ".part")
            os.replace(out + ".part", out)
            log(f"backup saved: {name} ({os.path.getsize(out) // 1048576} MB)")
            save_state(last_backup=name, last_backup_at=time.time())
        finally:
            if was_running and restart:
                bds_start()
        prune_backups()
        return out


def make_mcworld(world_dir, out):
    """An .mcworld is a zip of the world folder's contents, so the iPad can open it too."""
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for dirpath, _, files in os.walk(world_dir):
            for fn in files:
                full = os.path.join(dirpath, fn)
                z.write(full, os.path.relpath(full, world_dir))


def prune_backups():
    files = sorted(f for f in os.listdir(BACKUPS) if f.endswith(".mcworld") and "_daily" in f)
    for f in files[:-BACKUP_KEEP]:
        os.remove(os.path.join(BACKUPS, f))
    # keep the last 5 pre-update backups too; never touch originals/ (the imported copies)
    files = sorted(f for f in os.listdir(BACKUPS) if f.endswith(".mcworld") and "_before-" in f)
    for f in files[:-5]:
        os.remove(os.path.join(BACKUPS, f))


# ---------------------------------------------------------------- update
def wait_started(since, timeout=900):
    """True once the server logs 'Server started.' and answers a ping."""
    end = time.time() + timeout
    while time.time() < end:
        time.sleep(10)
        if not bds_running():
            return False
        if "Server started." in bds_logs(since=since, tail=2000) and ping() is not None:
            return True
    return False


def addon_answers():
    """True when the add-on's script engine answers a console command (it replies 'Run this as a player.')."""
    for _ in range(3):
        mark = time.time()
        try:
            bds_command("phill:settings")
        except Exception:
            pass
        time.sleep(8)
        if "Run this as a player" in bds_logs(since=mark - 1, tail=300):
            return True
    return False


def apply_update(kind, version, url, force=False):
    """kind: 'addon' or 'skins'."""
    with LOCK:
        n = players_online()
        if n and not force:
            save_state(pending=f"{kind} {version} waits until nobody is playing ({n} online)")
            log(f"{kind} {version} is ready but {n} playing, will try again later")
            return False
        tmp = tempfile.mkdtemp(prefix="upd_", dir=STATE_DIR)
        try:
            log(f"downloading {kind} {version}")
            pkg = fetch(url, os.path.join(tmp, "pkg.zip"))
            ex = os.path.join(tmp, "x")
            unpack_any(pkg, ex)
            packs = find_packs(ex)
            if kind == "addon":
                by = {m["header"]["uuid"]: (p, m) for p, m in packs}
                if ADDON_BP not in by or ADDON_RP not in by:
                    raise RuntimeError("the download is missing Harry's Equestrian packs (uuids changed?)")
                for u in (ADDON_BP, ADDON_RP):
                    got = ".".join(map(str, by[u][1]["header"]["version"]))
                    if vtuple(got) != vtuple(version):
                        raise RuntimeError(f"pack says {got}, releases.json says {version}")
            if not packs:
                raise RuntimeError("no packs in the download")
            backup(f"before-{kind}-{version}", restart=False)
            snap = snapshot_packs()
            if bds_running():
                bds_stop()
            if kind == "addon":
                install_pack(by[ADDON_BP][0], by[ADDON_BP][1], "HarrysEquestrian_BP")
                # the add-on's resource pack goes UNDER the skins pack, if there is one
                skins = state().get("skins_uuid")
                install_pack(by[ADDON_RP][0], by[ADDON_RP][1], "HarrysEquestrian_RP", top=not skins)
            else:
                for p, m in packs:
                    k, u, _ = install_pack(p, m, "HarrysHorseSkins", top=True)
                    save_state(skins_uuid=u)
            since = time.time()
            bds_start()
            if wait_started(since) and addon_answers():
                save_state(**{f"{kind}_version": version, "pending": "",
                              "last_update": f"{kind} {version} installed {dt.datetime.now():%Y-%m-%d %H:%M}"})
                log(f"{kind} {version} installed and the server is up")
                return True
            log(f"{kind} {version}: server or add-on did not come up, rolling back")
            try:
                bds_stop()
            except Exception:
                pass
            restore_packs(snap)
            bds_start()
            save_state(held=f"{kind} {version} held: the server or add-on would not start with it, still on the old one",
                       **{f"held_{kind}": version})
            return False
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


def check_updates(force=False):
    if not os.path.isdir(WORLD):
        return
    try:
        v, url = latest_addon()
        have = installed_version(ADDON_BP)
        s = state()
        if (have is None or vtuple(v) > vtuple(have)) and (force or s.get("held_addon") != v):
            apply_update("addon", v, url, force=force)
    except Exception as e:
        log(f"add-on check failed: {e}")
    if SKINS_URL:
        try:
            feed = json.loads(fetch(SKINS_URL))
            v = str(feed["version"])
            s = state()
            if v != s.get("skins_version") and (force or s.get("held_skins") != v):
                apply_update("skins", v, urllib.parse.urljoin(SKINS_URL, feed["file"]), force=force)
        except Exception as e:
            log(f"skins check failed: {e}")


# ---------------------------------------------------------------- world import
def read_level_dat(path):
    """Tiny little-endian NBT reader, enough for the top-level settings in level.dat."""
    with open(path, "rb") as f:
        data = f.read()[8:]
    buf = io.BytesIO(data)

    def rd(fmt):
        return struct.unpack("<" + fmt, buf.read(struct.calcsize(fmt)))[0]

    def rstr():
        n = rd("H")
        return buf.read(n).decode("utf-8", "replace")

    def payload(t):
        if t == 1: return rd("b")
        if t == 2: return rd("h")
        if t == 3: return rd("i")
        if t == 4: return rd("q")
        if t == 5: return rd("f")
        if t == 6: return rd("d")
        if t == 7: n = rd("i"); return buf.read(n)
        if t == 8: return rstr()
        if t == 9:
            et, n = rd("b"), rd("i")
            return [payload(et) for _ in range(n)]
        if t == 10:
            out = {}
            while True:
                tt = rd("b")
                if tt == 0:
                    return out
                k = rstr()
                out[k] = payload(tt)
        if t == 11: n = rd("i"); return [rd("i") for _ in range(n)]
        if t == 12: n = rd("i"); return [rd("q") for _ in range(n)]
        raise ValueError(f"nbt tag {t}")

    t = rd("b")
    rstr()
    return payload(t)


def world_settings(level_dat):
    """server.properties values that keep the imported world playing like it did on the iPad."""
    try:
        d = read_level_dat(level_dat)
    except Exception as e:
        log(f"could not read level.dat ({e}), keeping defaults")
        return {}
    modes = {0: "survival", 1: "creative", 2: "adventure"}
    diffs = {0: "peaceful", 1: "easy", 2: "normal", 3: "hard"}
    out = {}
    if d.get("GameType") in modes: out["gamemode"] = modes[d["GameType"]]
    if d.get("Difficulty") in diffs: out["difficulty"] = diffs[d["Difficulty"]]
    if "commandsEnabled" in d: out["allow-cheats"] = "true" if d["commandsEnabled"] else "false"
    if d.get("LevelName"): out["_level_name_in_file"] = d["LevelName"]
    return out


def import_world(upload_path, original_name):
    """Install an uploaded .mcworld as the server's world. The upload is kept untouched in backups/originals."""
    with LOCK:
        os.makedirs(os.path.join(BACKUPS, "originals"), exist_ok=True)
        stamp = dt.datetime.now().strftime("%Y-%m-%d_%H%M")
        keep = os.path.join(BACKUPS, "originals", f"{stamp}_{re.sub(r'[^A-Za-z0-9._-]', '_', original_name)}")
        shutil.copy2(upload_path, keep)
        h = hashlib.sha256(open(keep, "rb").read()).hexdigest()[:16]
        tmp = tempfile.mkdtemp(prefix="imp_", dir=STATE_DIR)
        try:
            with zipfile.ZipFile(upload_path) as z:
                for n in z.namelist():
                    if n.startswith("/") or ".." in n.split("/"):
                        raise ValueError("unsafe path in the world file")
                z.extractall(tmp)
            root = tmp
            if not os.path.exists(os.path.join(root, "level.dat")):
                subs = [os.path.join(tmp, d) for d in os.listdir(tmp)]
                subs = [d for d in subs if os.path.exists(os.path.join(d, "level.dat"))]
                if len(subs) != 1:
                    raise ValueError("that file has no level.dat, is it an exported .mcworld?")
                root = subs[0]
            settings = world_settings(os.path.join(root, "level.dat"))
            was_running = bds_running()
            if was_running:
                bds_stop()
            if os.path.isdir(WORLD):
                old = os.path.join(BACKUPS, f"{LEVEL.replace(' ', '_')}_{stamp}_before-import.mcworld")
                make_mcworld(WORLD, old)
                shutil.rmtree(WORLD)
            shutil.copytree(root, WORLD)
            write_properties({k: v for k, v in settings.items() if not k.startswith("_")})
            save_state(imported=f"{original_name} on {stamp} (sha256 {h})", world_settings=settings,
                       held_addon="", held_skins="")
            log(f"world imported from {original_name}: {settings}")
            # bring the add-on up to date inside the imported world before anyone joins
            try:
                v, url = latest_addon()
                have = installed_version(ADDON_BP)
                if have is None or vtuple(v) > vtuple(have):
                    apply_update("addon", v, url, force=True)
                    return
            except Exception as e:
                log(f"add-on refresh after import failed: {e}")
            bds_start()
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


def write_properties(values):
    """Set values in server.properties (compose.yml leaves these keys alone, so they stick)."""
    if not values:
        return
    p = os.path.join(DATA, "server.properties")
    if os.path.exists(p):
        txt = open(p).read()
        for k, v in values.items():
            if re.search(rf"^{re.escape(k)}=", txt, flags=re.M):
                txt = re.sub(rf"^{re.escape(k)}=.*$", f"{k}={v}", txt, flags=re.M)
            else:
                txt += f"\n{k}={v}\n"
        open(p, "w").write(txt)


# ---------------------------------------------------------------- allowlist
ALLOW = os.path.join(DATA, "allowlist.json")


def allow_names():
    try:
        return [e["name"] for e in json.load(open(ALLOW)) if e.get("name")]
    except Exception:
        return []


def set_allow(names):
    """Write allowlist.json (keeping known xuids) and tell a running server to reload it."""
    try:
        old = {e.get("name", "").lower(): e for e in json.load(open(ALLOW))}
    except Exception:
        old = {}
    out = []
    for n in names:
        n = n.strip()
        if n and n.lower() not in [o["name"].lower() for o in out]:
            e = {"ignoresPlayerLimit": False, "name": n}
            if old.get(n.lower(), {}).get("xuid"):
                e["xuid"] = old[n.lower()]["xuid"]
            out.append(e)
    tmp = ALLOW + ".tmp"
    json.dump(out, open(tmp, "w"), indent=1)
    os.replace(tmp, ALLOW)
    log(f"allowlist now: {', '.join(o['name'] for o in out) or '(nobody)'}")
    if bds_running():
        try:
            bds_command("allowlist reload")
        except Exception:
            pass


# ---------------------------------------------------------------- admin page
PAGE = """<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Harry's server</title><style>
:root{{--bg:#f4f1ea;--fg:#1d1d1b;--card:#fff;--muted:#6b675f;--accent:#2f6f3e;--line:#e2ddd2}}
@media (prefers-color-scheme:dark){{:root{{--bg:#151614;--fg:#ecebe6;--card:#1f211e;--muted:#a4a196;--accent:#7cc48b;--line:#33362f}}}}
body{{font:16px/1.45 -apple-system,system-ui,sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:16px;max-width:720px;margin:auto}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:12px 0}}
h1{{font-size:22px;margin:8px 0}} h2{{font-size:16px;margin:0 0 8px}} .muted{{color:var(--muted)}}
button,.btn{{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:10px 14px;font-size:15px;text-decoration:none;display:inline-block;margin:4px 6px 4px 0}}
pre{{white-space:pre-wrap;font-size:12px;max-height:320px;overflow:auto}} td{{padding:3px 10px 3px 0;vertical-align:top}}
</style></head><body><h1>Harry's server</h1>{body}</body></html>"""


def status():
    s = state()
    p = ping()
    return {
        "server": ("up" if p else ("starting or stopped" if bds_running() else "stopped")),
        "players_online": p["players"] if p else None,
        "game_version": p["version"] if p else None,
        "world": LEVEL, "world_present": os.path.isdir(WORLD),
        "addon_installed": installed_version(ADDON_BP),
        "skins_installed": s.get("skins_version"),
        "pending": s.get("pending", ""), "held": s.get("held", ""),
        "last_update": s.get("last_update", ""),
        "last_backup": s.get("last_backup", ""),
        "imported": s.get("imported", ""),
        "backups": sorted((f for f in os.listdir(BACKUPS) if f.endswith(".mcworld")), reverse=True)[:20],
        "originals": sorted(os.listdir(os.path.join(BACKUPS, "originals"))) if os.path.isdir(os.path.join(BACKUPS, "originals")) else [],
        "selftest": s.get("selftest", ""),
        "allowed": allow_names(),
    }


class Admin(http.server.BaseHTTPRequestHandler):
    server_version = "harry-helper"

    def log_message(self, *a):
        pass

    def authed(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        return ADMIN_TOKEN and q.get("k", [""])[0] == ADMIN_TOKEN

    def send(self, code, body, ctype="text/html; charset=utf-8"):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if not self.authed():
            return self.send(404, "not found", "text/plain")
        u = urllib.parse.urlparse(self.path)
        k = urllib.parse.quote(ADMIN_TOKEN)
        if u.path == "/status.json":
            return self.send(200, json.dumps(status(), indent=1), "application/json")
        if u.path == "/log.txt":
            try:
                text = bds_logs(tail=300)
            except Exception as e:
                text = str(e)
            return self.send(200, "HELPER\n" + "\n".join(LOG[-100:]) + "\n\nSERVER\n" + text, "text/plain; charset=utf-8")
        if u.path == "/backup":
            name = os.path.basename(urllib.parse.parse_qs(u.query).get("f", [""])[0])
            full = os.path.join(BACKUPS, name)
            if not name.endswith(".mcworld") or not os.path.isfile(full):
                return self.send(404, "no such backup", "text/plain")
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", f'attachment; filename="{name}"')
            self.send_header("Content-Length", str(os.path.getsize(full)))
            self.end_headers()
            with open(full, "rb") as f:
                shutil.copyfileobj(f, self.wfile)
            return
        st = status()
        rows = "".join(f"<tr><td class=muted>{html.escape(a)}</td><td>{html.escape(str(b))}</td></tr>"
                       for a, b in [("Server", st["server"]), ("Players on now", st["players_online"]),
                                    ("Game version", st["game_version"]), ("World", st["world"]),
                                    ("Harry's Equestrian", st["addon_installed"]), ("Horse skins", st["skins_installed"]),
                                    ("Last update", st["last_update"]), ("Waiting", st["pending"]),
                                    ("Held back", st["held"]), ("Last backup", st["last_backup"]),
                                    ("World imported", st["imported"]), ("Self-test", st["selftest"])] if b not in (None, ""))
        bl = "".join(f'<li><a href="/backup?k={k}&f={urllib.parse.quote(b)}">{html.escape(b)}</a></li>' for b in st["backups"]) or "<li class=muted>none yet</li>"
        body = f"""<div class=card><table>{rows}</table></div>
<div class=card><h2>Do something</h2>
<form method=post action="/update?k={k}" style=display:inline><button>Check for an update now</button></form>
<form method=post action="/backup-now?k={k}" style=display:inline><button>Back up now</button></form>
<a class=btn href="/log.txt?k={k}">Server log</a></div>
<div class=card><h2>Who can join</h2><p class=muted>Xbox gamertags, one per line, spelt exactly as in Minecraft.</p>
<form method=post action="/allow?k={k}"><textarea name=names rows=4 style="width:100%;font-size:16px">{html.escape(chr(10).join(st["allowed"]))}</textarea><br><button>Save</button></form></div>
<div class=card><h2>Backups</h2><p class=muted>Tap one to download it. An .mcworld opens in Minecraft on the iPad.</p><ul>{bl}</ul></div>
<div class=card><h2>Put a world on the server</h2>
<p class=muted>Pick an exported .mcworld. The current world is backed up first, and the file you send is kept untouched in backups/originals.</p>
<form method=post enctype=multipart/form-data action="/import?k={k}"><input type=file name=world accept=".mcworld,.zip" required>
<p><label><input type=checkbox name=sure required> Replace the world on the server with this one</label></p><button>Send world</button></form></div>"""
        self.send(200, PAGE.format(body=body))

    def do_POST(self):
        if not self.authed():
            return self.send(404, "not found", "text/plain")
        u = urllib.parse.urlparse(self.path)
        k = urllib.parse.quote(ADMIN_TOKEN)
        back = f'<p><a class=btn href="/?k={k}">Back</a></p>'
        if u.path == "/update":
            threading.Thread(target=check_updates, kwargs={"force": False}, daemon=True).start()
            return self.send(200, PAGE.format(body=f"<div class=card>Checking now. If nobody is playing and there is a new version, the server restarts in a minute or two.</div>{back}"))
        if u.path == "/backup-now":
            def job():
                n = players_online()
                if n:
                    log(f"backup skipped, {n} playing")
                else:
                    backup("manual")
            threading.Thread(target=job, daemon=True).start()
            return self.send(200, PAGE.format(body=f"<div class=card>Backing up now. The server is off for about a minute.</div>{back}"))
        if u.path == "/allow":
            n = int(self.headers.get("Content-Length", "0"))
            form = urllib.parse.parse_qs(self.rfile.read(n).decode())
            set_allow(re.split(r"[\r\n,]+", form.get("names", [""])[0]))
            return self.send(200, PAGE.format(body=f"<div class=card>Saved. Allowed now: {html.escape(', '.join(allow_names()) or 'nobody')}</div>{back}"))
        if u.path == "/import":
            fs = cgi.FieldStorage(fp=self.rfile, headers=self.headers,
                                  environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": self.headers["Content-Type"]})
            item = fs["world"] if "world" in fs else None
            if item is None or not getattr(item, "filename", None):
                return self.send(400, PAGE.format(body=f"<div class=card>No file came through.</div>{back}"))
            fd, tmp = tempfile.mkstemp(suffix=".mcworld", dir=STATE_DIR)
            with os.fdopen(fd, "wb") as f:
                shutil.copyfileobj(item.file, f)
            name = os.path.basename(item.filename)

            def job():
                try:
                    import_world(tmp, name)
                except Exception as e:
                    log(f"import failed: {e}")
                    save_state(imported=f"FAILED: {e}")
                    if not bds_running():
                        bds_start()
                finally:
                    try:
                        os.remove(tmp)
                    except OSError:
                        pass
            threading.Thread(target=job, daemon=True).start()
            mb = os.path.getsize(tmp) // 1048576
            return self.send(200, PAGE.format(body=f"<div class=card>Got {html.escape(name)} ({mb} MB). Putting it on the server now; check the status page in a few minutes.</div>{back}"))
        self.send(404, "not found", "text/plain")


class Threaded(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


# ---------------------------------------------------------------- self-test
def selftest():
    """Before Harry's world arrives: prove the server runs the add-on on this machine."""
    if state().get("selftest", "").startswith("PASS"):
        return
    try:
        since = time.time() - 3600
        if not wait_started(since, timeout=1800):
            save_state(selftest="FAIL: the server did not start")
            return
        logs = bds_logs(since=since, tail=5000)
        pack_ok = "Harry's Equestrian" in logs and "Pack Stack" in logs
        script_ok = addon_answers()
        res = "PASS" if (pack_ok and script_ok) else "FAIL"
        save_state(selftest=f"{res}: packs loaded={pack_ok}, add-on scripts answered={script_ok} ({dt.datetime.now():%Y-%m-%d %H:%M})")
        log(f"self-test {res}")
    except Exception as e:
        save_state(selftest=f"FAIL: {e}")


def seed():
    """First start: allowlist from ALLOW_LIST_USERS, the add-on into the (new) world, then say ready."""
    ready = os.path.join(STATE_DIR, "ready")
    if not os.path.exists(ALLOW) and E("ALLOW_LIST_USERS", "").strip():
        set_allow(E("ALLOW_LIST_USERS").split(","))
    if installed_version(ADDON_BP) is None:
        for attempt in range(30):
            try:
                v, url = latest_addon()
                tmp = tempfile.mkdtemp(prefix="seed_", dir=STATE_DIR)
                ex = os.path.join(tmp, "x")
                unpack_any(fetch(url, os.path.join(tmp, "pkg.zip")), ex)
                by = {m["header"]["uuid"]: (p, m) for p, m in find_packs(ex)}
                os.makedirs(WORLD, exist_ok=True)
                install_pack(*by[ADDON_BP], "HarrysEquestrian_BP")
                install_pack(*by[ADDON_RP], "HarrysEquestrian_RP")
                shutil.rmtree(tmp, ignore_errors=True)
                save_state(addon_version=v, last_update=f"addon {v} put in the new world")
                log(f"new world seeded with Harry's Equestrian {v}")
                break
            except Exception as e:
                log(f"seeding failed ({e}), retrying in a minute")
                time.sleep(60)
    open(ready, "w").write("ok")


# ---------------------------------------------------------------- main loop
def main():
    if not ADMIN_TOKEN or len(ADMIN_TOKEN) < 16:
        print("ADMIN_TOKEN must be set (16+ characters)", file=sys.stderr)
        sys.exit(2)
    seed()
    srv = Threaded(("0.0.0.0", ADMIN_PORT), Admin)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    log(f"helper up, admin page on port {ADMIN_PORT}, world '{LEVEL}'")
    threading.Thread(target=selftest, daemon=True).start()
    next_check = time.time() + 120
    while True:
        try:
            now = dt.datetime.now()
            s = state()
            if now.hour == BACKUP_HOUR and s.get("last_backup_day") != now.strftime("%Y-%m-%d"):
                n = players_online()
                if n == 0 or (n is None and not bds_running()):
                    save_state(last_backup_day=now.strftime("%Y-%m-%d"))
                    backup("daily")
            if time.time() >= next_check:
                next_check = time.time() + CHECK_MINUTES * 60
                check_updates()
        except Exception:
            log("loop error: " + traceback.format_exc().splitlines()[-1])
        time.sleep(30)


if __name__ == "__main__":
    main()
