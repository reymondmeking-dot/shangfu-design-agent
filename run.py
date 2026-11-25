"""Start the SQLite-backed FastAPI service and the local Node workbench."""
import argparse
from contextlib import ExitStack
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import ProxyHandler, Request, build_opener


ROOT = Path(__file__).resolve().parent


def launch(stack, args, env):
    process = subprocess.Popen(args, cwd=ROOT, env=env)

    def stop():
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
    stack.callback(stop)
    return process


def session_key(directory):
    path = directory / 'session.key'
    try:
        with open(path, 'x', encoding='ascii', opener=lambda p, flags: os.open(p, flags, 0o600)) as stream:
            value = secrets.token_urlsafe(48)
            stream.write(value)
            return value
    except FileExistsError:
        return path.read_text(encoding='ascii').strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4713)
    parser.add_argument('--data-dir', type=Path, default=ROOT / '.state')
    args = parser.parse_args()
    node = shutil.which('node')
    if node is None or not (ROOT / 'node_modules' / 'fflate').exists():
        parser.exit(1, 'Install Node.js and run npm ci first.\n')
    directory = args.data_dir.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    key = os.environ.get('SESSION_SECRET') or session_key(directory)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        api_port = sock.getsockname()[1]
    origin = 'http://127.0.0.1:' + str(api_port)
    token = secrets.token_urlsafe(48)
    env = {**os.environ, 'SHANGFU_SERVICE_TOKEN': token, 'SHANGFU_ORIGIN': origin,
           'SHANGFU_DB': str(directory / 'projects.sqlite3'), 'SESSION_SECRET': key,
           'NODE_BINARY': node, 'PORT': str(args.port), 'HOST': '127.0.0.1'}
    client = build_opener(ProxyHandler({}))
    with ExitStack() as stack:
        api = launch(stack, [sys.executable, '-m', 'uvicorn', 'python_service.app:app',
                             '--host', '127.0.0.1', '--port', str(api_port)], env)
        # Catalog readiness verifies the DB and the shared Node domain bridge.
        probe = Request(origin + '/v1/catalog', headers={'Authorization': 'Bearer ' + token})
        for _ in range(100):
            if api.poll() is not None:
                raise SystemExit('FastAPI exited during startup. Check the dependencies.')
            try:
                with client.open(probe, timeout=2):
                    break
            except URLError:
                time.sleep(0.12)
        else:
            raise SystemExit('FastAPI did not become ready.')
        ui = launch(stack, [node, 'src/local.mjs'], env)
        while api.poll() is None and ui.poll() is None:
            time.sleep(0.25)
        raise SystemExit(api.poll() or ui.poll() or 0)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        pass
