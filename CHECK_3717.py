#!/usr/bin/env python3
"""Read-only compatibility and reapplication check for Young's Physics 3.7.17."""
from pathlib import Path, PurePosixPath
import hashlib, json, sys, zipfile

def digest(data):
    return hashlib.sha256(data).hexdigest()

def inventory(location):
    p=Path(location)
    if p.is_dir():
        roots=[q for q in [p]+[x for x in p.iterdir() if x.is_dir()]
               if (q/'site/assets/data/catalog.json').is_file() and (q/'package.json').is_file()]
        if len(roots)!=1:
            raise ValueError('프로젝트 루트가 하나여야 합니다.')
        root=roots[0]
        return {f.relative_to(root).as_posix():digest(f.read_bytes())
                for f in root.rglob('*') if f.is_file()
                and not any(s in {'.git','node_modules'} for s in f.relative_to(root).parts)}
    if not p.is_file() or not zipfile.is_zipfile(p):
        raise ValueError('현재 운영 전체 소스 ZIP 또는 소스 폴더가 필요합니다.')
    with zipfile.ZipFile(p) as z:
        entries=[i.filename for i in z.infolist() if not i.is_dir() and not i.filename.startswith('__MACOSX/')]
        roots=[n[:-len('site/assets/data/catalog.json')] for n in entries
               if n.endswith('site/assets/data/catalog.json')
               and n[:-len('site/assets/data/catalog.json')]+'package.json' in entries]
        if len(roots)!=1:
            raise ValueError('ZIP의 프로젝트 루트를 하나로 찾지 못했습니다.')
        result={}
        for name in entries:
            if not name.startswith(roots[0]):
                continue
            rel=name[len(roots[0]):]
            if rel.startswith('/') or '..' in PurePosixPath(rel).parts or '\\' in rel or rel in result:
                raise ValueError('중복 또는 부적합 ZIP 경로: '+rel)
            result[rel]=digest(z.read(name))
        return result

def main():
    if len(sys.argv)!=2:
        print('사용법: python CHECK_3717.py <현재 전체 소스 ZIP 또는 폴더>')
        return 2
    manifest=json.loads(Path(__file__).with_name('PATCH_MANIFEST_3717.json').read_text(encoding='utf-8'))
    current=inventory(sys.argv[1])
    if all(current.get(p)==h for p,h in manifest['targetChecks'].items()):
        print('ALREADY_COMPLETE: v3.7.17 핵심 변경 파일이 이미 적용되어 있습니다.')
        return 0
    candidates=[]
    for version,base in manifest['baseVariants'].items():
        mismatch=[p for p,h in base['checks'].items() if current.get(p)!=h]
        collision=[p for p in base['newPaths'] if p in current]
        protected=[p for p,h in base['protectedChecks'].items() if current.get(p)!=h]
        if not (mismatch or collision or protected):
            print('PASS_BASE: '+version+' 기준입니다. 사용할 패치: '+base['patchName'])
            print('백업 후 Apps Script 웹 앱 새 버전 배포 → GitHub 파일 반영 순서를 따르세요. 이 검사는 서버 접속이나 파일 수정을 하지 않았습니다.')
            return 0
        candidates.append((len(mismatch)+len(collision)+len(protected),version,mismatch,collision,protected))
    _,version,mismatch,collision,protected=min(candidates)
    print('STOP: 제공된 패치의 기준 소스와 다릅니다. 덮어쓰지 마세요. 가까운 비교 기준: '+version)
    for label,paths in [('기준 파일 불일치',mismatch),('신규 경로 충돌',collision),('핵심 코드 변경',protected)]:
        for p in paths[:12]:
            print(label+': '+p)
    return 2

if __name__=='__main__':
    try:
        sys.exit(main())
    except (OSError,ValueError,zipfile.BadZipFile,json.JSONDecodeError) as e:
        print('STOP:',e)
        sys.exit(2)
