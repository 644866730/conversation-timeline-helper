#!/usr/bin/env python3
"""Package the ready-to-load extension and its complete source tree.
Usage: python tools/package.py [--output /path/to/file.zip]
Requires only the Python standard library; no build or dependency installation.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_DIRS = {'.git', '.venv', 'venv', 'node_modules', '__pycache__',
                 '.pytest_cache', '.mypy_cache', '.ruff_cache', 'htmlcov',
                 'build', 'dist', 'output', 'outputs'}
EXCLUDED_SUFFIXES = {'.pyc', '.pyo', '.zip', '.crx', '.pem', '.key'}

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
        assets = list(manifest.get('icons', {}).values())
        assets.append(manifest['action']['default_popup'])
        if manifest.get('options_ui'):
            assets.append(manifest['options_ui']['page'])
        for entry in manifest['content_scripts']:
            assets.extend(entry.get('js', []))
            assets.extend(entry.get('css', []))
        for name in assets:
            if not (ROOT / name).is_file():
                raise FileNotFoundError(f'Missing manifest asset: {name}')
        target = (args.output or ROOT.parent / f"Conversation-Timeline-Helper-v{manifest['version']}.zip").resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        count = 0
        with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in sorted(ROOT.rglob('*')):
                rel = path.relative_to(ROOT)
                if not path.is_file() or path.resolve() == target:
                    continue
                if any(part in EXCLUDED_DIRS for part in rel.parts):
                    continue
                if path.suffix.lower() in EXCLUDED_SUFFIXES or path.name in {'.DS_Store', '.coverage'}:
                    continue
                if path.name == '.env' or (path.name.startswith('.env.') and path.name != '.env.example'):
                    continue
                if path.name.endswith(('.zip.sha256', '.zip.tmp')):
                    continue
                if path.name.startswith(('failure-', 'preview-failure-')) and path.suffix == '.png':
                    continue
                archive.write(path, (Path(ROOT.name) / rel).as_posix())
                count += 1
        with zipfile.ZipFile(target) as archive:
            bad = archive.testzip()
            if bad:
                raise ValueError(f'Archive CRC validation failed: {bad}')
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        target.with_suffix('.zip.sha256').write_text(f'{digest}  {target.name}\n', encoding='utf-8')
        print(f'Created: {target}\nFiles: {count}\nBytes: {target.stat().st_size}\nSHA-256: {digest}')
        return 0
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as exc:
        print(f'Packaging failed: {exc}', file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
