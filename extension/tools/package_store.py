#!/usr/bin/env python3
"""Create a Chrome Web Store ZIP (manifest.json at root), Python 3.9+, stdlib only.
Usage: python tools/package_store.py --output /path/store-upload.zip
Tests, demo pages, screenshots, build scripts, secrets and local keys are not shipped.
"""
from __future__ import annotations
import argparse, hashlib, json, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FIXED=['manifest.json','LICENSE','THIRD_PARTY_NOTICES.md','PRIVACY.md','privacy.html','privacy.css','vendor/reborn14/LICENSE']
TREES={'src':{'.js','.css'},'popup':{'.html','.js','.css'},'icons':{'.png','.svg'}}
def build(root:Path,target:Path)->dict:
    root=root.resolve(); target=target.resolve()
    m=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
    if m.get('manifest_version')!=3: raise ValueError('Manifest V3 required')
    if 'key' in m: raise ValueError('Remove the development manifest key from the store source first')
    if m.get('permissions')!=['storage']: raise ValueError('Permissions changed; re-audit policy and update this allowlist deliberately')
    if not 0<len(m.get('description',''))<=132: raise ValueError('Description must contain 1–132 characters')
    assets=list(m.get('icons',{}).values())+list(m.get('action',{}).get('default_icon',{}).values())
    assets += [m['action']['default_popup'],m['options_ui']['page']]
    for c in m['content_scripts']:assets+=c.get('js',[])+c.get('css',[])
    names=set(FIXED)
    for directory,extensions in TREES.items():
        names.update(p.relative_to(root).as_posix() for p in (root/directory).rglob('*') if p.is_file() and p.suffix in extensions)
    for n in names:
        p=root/n
        if p.is_symlink() or not p.is_file() or p.stat().st_size==0:raise ValueError('Missing, empty or symlinked asset: '+n)
        if root not in p.resolve().parents:raise ValueError('Asset escapes source root: '+n)
    for n in assets:
        if n not in names:raise ValueError('Referenced asset not in upload allowlist: '+n)
    target.parent.mkdir(parents=True,exist_ok=True)
    temp=target.with_suffix('.zip.tmp')
    try:
        with zipfile.ZipFile(temp,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
            for n in sorted(names):
                info=zipfile.ZipInfo(n,date_time=(2026,10,17,0,0,0))
                info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
                z.writestr(info,(root/n).read_bytes())
        with zipfile.ZipFile(temp) as z:
            if z.testzip():raise ValueError('ZIP CRC validation failed')
            if 'manifest.json' not in z.namelist():raise ValueError('Manifest is not at ZIP root')
        temp.replace(target)
    finally:
        if temp.exists():temp.unlink()
    digest=hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_suffix('.zip.sha256').write_text(digest+'  '+target.name+'\n',encoding='utf-8')
    return {'name':m['name'],'version':m['version'],'files':len(names),'bytes':target.stat().st_size,'sha256':digest,'zip':str(target)}
def main()->int:
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path);a=p.parse_args()
    try:
        version=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))['version']
        target=a.output or ROOT.parent/f'Conversation-Timeline-Helper-v{version}-store-upload.zip'
        print(json.dumps(build(ROOT,target),ensure_ascii=False,indent=2));return 0
    except (ValueError,OSError,KeyError,zipfile.BadZipFile) as e:print('Packaging failed: '+str(e),file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
