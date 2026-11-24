#!/usr/bin/env python3
"""Read-only SHA-256 preflight for Young's Physics v3.7.18 packages."""
from pathlib import Path
import sys,json,hashlib

def digest(path):
    if not path.is_file():return None
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    if len(sys.argv)!=2:
        print('Usage: python3 CHECK_3718.py PROJECT_DIRECTORY')
        return 2
    root=Path(sys.argv[1]).resolve()
    if not root.is_dir():
        print('NOT_A_DIRECTORY:',root)
        return 2
    manifest=json.loads(Path(__file__).with_name('PATCH_MANIFEST_3718.json').read_text(encoding='utf-8'))
    cached={}
    def sha(rel):
        if rel not in cached:cached[rel]=digest(root/rel)
        return cached[rel]
    if all(sha(p)==h for p,h in manifest['targetChecks'].items()):
        print('ALREADY_COMPLETE: v3.7.18')
        return 0
    matches=[];near=[]
    for label,entry in manifest['baseVariants'].items():
        bad=[p for p,h in entry['checks'].items() if sha(p)!=h]
        collisions=[p for p in entry['newPaths'] if sha(p) not in [None,manifest['targetChecks'].get(p)]]
        if not bad and not collisions:matches.append((label,entry['patchName']))
        near.append((len(bad)+len(collisions),label,(bad+collisions)[:12]))
    if matches:
        for label,name in matches:print('PASS_BASE:',label,'->',name)
        return 0
    _,label,paths=min(near)
    print('BASE_MISMATCH: closest known baseline',label)
    for p in paths:print('  ',p)
    print('No files were changed. Compare local edits before applying a patch.')
    return 1

if __name__=='__main__':raise SystemExit(main())
