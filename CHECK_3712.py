#!/usr/bin/env python3
"""Read-only source compatibility check. Never writes files or accesses the network."""
import sys, json, hashlib, zipfile
from pathlib import Path

def digest(data):
    return hashlib.sha256(data).hexdigest()

def inventory(target):
    p=Path(target)
    if p.is_dir():
        roots=[p]+[c for c in p.iterdir() if c.is_dir()]
        roots=[r for r in roots if (r/"site/assets/data/catalog.json").is_file() and (r/"package.json").is_file()]
        if len(roots)!=1:
            raise ValueError("소스 루트를 하나로 식별할 수 없습니다. package.json과 site 폴더가 있는 경로를 지정하세요.")
        root=roots[0]
        return {f.relative_to(root).as_posix():digest(f.read_bytes()) for f in root.rglob("*") if f.is_file() and ".git" not in f.parts}
    if not p.is_file() or not zipfile.is_zipfile(p):
        raise ValueError("현재 GitHub 저장소 전체 ZIP 또는 소스 폴더를 지정하세요.")
    with zipfile.ZipFile(p) as z:
        names=[n for n in z.namelist() if not n.endswith("/") and not n.startswith("__MACOSX/")]
        roots=[n[:-len("site/assets/data/catalog.json")] for n in names if n.endswith("site/assets/data/catalog.json")]
        roots=[r for r in roots if r+"package.json" in names]
        if len(roots)!=1:
            raise ValueError("ZIP 내부 프로젝트 루트를 하나로 식별할 수 없습니다.")
        root=roots[0]
        entries={}
        for n in names:
            if not n.startswith(root):continue
            rel=n[len(root):]
            if not rel or ".." in Path(rel).parts or rel.startswith("/"):raise ValueError("안전하지 않은 ZIP 경로")
            if rel in entries:raise ValueError("중복 ZIP 경로: "+rel)
            entries[rel]=digest(z.read(n))
        return entries

def main():
    if len(sys.argv)!=2:
        print("사용법: python CHECK_3712.py 현재_GitHub_전체소스.zip")
        return 2
    manifest=Path(__file__).with_name("PATCH_MANIFEST_3712.json")
    m=json.loads(manifest.read_text(encoding="utf-8"))
    got=inventory(sys.argv[1])
    if all(got.get(f)==h for f,h in m["targetChecks"].items()):
        print("ALREADY_COMPLETE: 이 v3.7.12 누적 패치가 이미 반영되어 있습니다. 재적용은 필요하지 않습니다.")
        return 0
    errors=[f for f,h in m["baseChecks"].items() if got.get(f)!=h]
    collisions=[f for f,h in m["newFiles"].items() if f in got and got[f]!=h]
    old_reconstruction=[f for f in got if "r05-web-reconstructed" in f]
    if errors or collisions or old_reconstruction:
        print("STOP: 확인된 v3.7.10 기준과 일치하지 않습니다. 덮어쓰지 마세요.")
        for f in errors[:30]:print("  기준 차이/누락:",f)
        for f in collisions[:20]:print("  신규 경로 충돌:",f)
        for f in old_reconstruction[:10]:print("  이전 재구성본 흔적:",f)
        if "site/assets/core.js" in errors:
            print("v3.7.5 누락 가능성: 이전 R16 안전복구 패치 사전검사를 먼저 진행하세요. 원인 확인 없이 구버전 패치를 덮어쓰지 마세요.")
        return 2
    print("PASS_BASE: 확인된 v3.7.10 기준입니다. Sheets 백업 및 현재 운영 커밋 확인 후 이번 패치 하나만 적용하세요.")
    print("검사는 읽기 전용입니다. 파일 수정, 서버 접속, 배포, 시험 설정 동기화를 실행하지 않았습니다.")
    for f,h in m["preserveOnly"].items():
        if f in got and got[f]!=h:print("PRESERVE_CONFIG:",f,"운영값이 다릅니다. 패치에 포함하지 않았으므로 그대로 보존하세요.")
    return 0

if __name__=="__main__":
    try:sys.exit(main())
    except (OSError,ValueError,zipfile.BadZipFile,json.JSONDecodeError) as e:
        print("STOP:",str(e));sys.exit(2)
