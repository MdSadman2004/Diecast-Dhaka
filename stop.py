"""Stop only the loopback listener recorded by this project's launcher."""
from pathlib import Path
import json
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parent

def main():
    record = ROOT / 'server/data/launcher.json'
    if not record.exists():
        print('No launcher record exists. If you ran npm start, stop it with Ctrl+C in that terminal.')
        return 1
    data = json.loads(record.read_text(encoding='utf-8'))
    pid = int(data['pid'])
    if Path(data['root']).resolve() != ROOT:
        print('Launcher identity mismatch. No process was stopped.')
        return 1
    try:
        with urllib.request.urlopen('http://127.0.0.1:5188/api/health', timeout=3) as response:
            status = json.load(response)
    except Exception:
        print('The store is not answering; no process was stopped. Check server/data/server.log.')
        return 1
    if status.get('service') != 'diecast-dhaka':
        print('Port 5188 belongs to another service. No process was stopped.')
        return 1
    probe = f"$p=Get-CimInstance Win32_Process -Filter 'ProcessId={pid}'; $n=Get-NetTCPConnection -LocalPort 5188 -State Listen -ErrorAction SilentlyContinue; @{{command=$p.CommandLine;name=$p.Name;owners=@($n.OwningProcess)}} | ConvertTo-Json -Compress"
    result = subprocess.run(['powershell.exe','-NoProfile','-Command',probe],capture_output=True,text=True,timeout=15,creationflags=subprocess.CREATE_NO_WINDOW)
    observation = json.loads(result.stdout)
    command = (observation.get('command') or '').replace('\\','/').lower()
    absolute = str(ROOT / 'server/index.mjs').replace('\\','/').lower()
    expected = absolute in command or (data.get('legacyRelative') is True and 'server/index.mjs' in command and '--env-file-if-exists=.env' in command)
    if pid not in observation.get('owners',[]) or str(observation.get('name','')).lower() != 'node.exe' or not expected:
        print('The recorded process no longer owns this store. It has been left untouched.')
        return 1
    subprocess.run(['powershell.exe','-NoProfile','-Command',f'Stop-Process -Id {pid} -ErrorAction Stop'],check=True,creationflags=subprocess.CREATE_NO_WINDOW)
    print('Diecast Dhaka stopped. Orders and inventory remain in server/data/store.sqlite.')
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print('Could not verify/stop the store: ' + str(error))
        raise SystemExit(1)
