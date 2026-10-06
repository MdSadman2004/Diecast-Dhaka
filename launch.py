"""Launch a detached local store, safely reusing only its own listener."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:5188'

def health():
    try:
        with urllib.request.urlopen(URL + '/api/health', timeout=2) as response:
            return json.load(response)
    except Exception:
        return None

def main():
    if not (ROOT / 'dist/index.html').is_file():
        print('Frontend build is missing. Run npm install, then npm run build in this folder.')
        return 1
    existing = health()
    if existing and existing.get('service') == 'diecast-dhaka':
        print('Diecast Dhaka is already running: ' + URL)
        if '--no-open' not in sys.argv:
            webbrowser.open(URL)
        return 0
    import socket
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1', 5188)) == 0:
            print('Port 5188 belongs to another or unresponsive service. It has been left untouched.')
            return 1
    node = shutil.which('node')
    if not node:
        candidate = Path('D:/.hermes/tools/node-26.7.0-win32-x64/node.exe')
        node = str(candidate) if candidate.exists() else None
    if not node:
        print('Node.js 22.13+ is required. Install it and try again.')
        return 1
    data = ROOT / 'server/data'
    data.mkdir(parents=True, exist_ok=True)
    log = open(data / 'server.log', 'ab', buffering=0)
    flags = (subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP) if os.name == 'nt' else 0
    process = subprocess.Popen([node, '--env-file-if-exists=' + str(ROOT / '.env'), str(ROOT / 'server/index.mjs')], cwd=ROOT,
                               stdin=subprocess.DEVNULL, stdout=log, stderr=log, creationflags=flags,
                               close_fds=True, start_new_session=os.name != 'nt')
    log.close()
    (data / 'launcher.json').write_text(json.dumps({'pid': process.pid, 'root': str(ROOT), 'legacyRelative': False}), encoding='utf-8')
    for _ in range(35):
        status = health()
        if status and status.get('service') == 'diecast-dhaka':
            print('Diecast Dhaka is running: ' + URL)
            print('Owner workbench: ' + URL + '/admin')
            if '--no-open' not in sys.argv:
                webbrowser.open(URL)
            return 0
        if process.poll() is not None:
            print('Server could not start. Read server/data/server.log for the error.')
            return 1
        time.sleep(.2)
    print('Server startup timed out. It has been left untouched; read server/data/server.log.')
    return 1

if __name__ == '__main__':
    raise SystemExit(main())
