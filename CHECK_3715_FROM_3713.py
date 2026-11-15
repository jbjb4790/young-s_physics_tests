#!/usr/bin/env python3
"""Read-only source compatibility check for Young's Physics v3.7.13 -> 3.7.15 cumulative."""
BASE='3.7.13'
import hashlib,json,sys,zipfile
from pathlib import Path,PurePosixPath
sha=lambda b:hashlib.sha256(b).hexdigest()
def inventory(location):
 p=Path(location)
 if p.is_dir():
  roots=[r for r in [p]+[d for d in p.iterdir() if d.is_dir()] if (r/'site/assets/data/catalog.json').is_file() and (r/'package.json').is_file()]
  if len(roots)!=1:raise ValueError('프로젝트 루트가 하나여야 합니다.')
  root=roots[0];return {f.relative_to(root).as_posix():sha(f.read_bytes()) for f in root.rglob('*') if f.is_file() and not any(x in {'.git','node_modules'} for x in f.relative_to(root).parts)}
 if not p.is_file() or not zipfile.is_zipfile(p):raise ValueError('운영 소스 폴더 또는 전체 ZIP이 필요합니다.')
 with zipfile.ZipFile(p) as z:
  names=[i.filename for i in z.infolist() if not i.is_dir() and not i.filename.startswith('__MACOSX/')]
  roots=[s[:-len('site/assets/data/catalog.json')] for s in names if s.endswith('site/assets/data/catalog.json') and s[:-len('site/assets/data/catalog.json')]+'package.json' in names]
  if len(roots)!=1:raise ValueError('ZIP의 프로젝트 루트를 하나로 찾지 못했습니다.')
  ans={}
  for name in names:
   if not name.startswith(roots[0]):continue
   rel=name[len(roots[0]):]
   if '..' in PurePosixPath(rel).parts or rel.startswith('/') or '\\' in rel or rel in ans:raise ValueError('ZIP의 중복/부적합 경로 '+rel)
   ans[rel]=sha(z.read(name))
  return ans

def main():
 if len(sys.argv)!=2:print('Usage: python CHECK_3715_FROM_3713.py <current-GitHub-folder-or-full-source.zip>');return 2
 m=json.loads(Path(__file__).with_name('PATCH_MANIFEST_3715.json').read_text(encoding='utf8'))
 g=inventory(sys.argv[1]);target=m['targetChecks']
 if all(g.get(f)==h for f,h in target.items()):print('ALREADY_COMPLETE: v3.7.15 핵심 변경파일을 이미 보유하고 있습니다.');return 0
 b=m['baseVariants'][BASE];bad=[f for f,h in b['checks'].items() if g.get(f)!=h];collision=[f for f in b['newPaths'] if f in g];protected=[f for f,h in b['protectedChecks'].items() if g.get(f)!=h]
 if bad or collision or protected:
  print('STOP: 예상 기준 '+BASE+'이 아닙니다. 기존 파일을 덮어쓰지 마세요.');
  for t,li in [('기준불일치',bad),('새파일충돌',collision),('핵심파일변경',protected)]:
   for f in li[:18]:print(t, f)
  return 2
 print('PASS_BASE: 정상 v3.7.13 기준입니다. Google Sheets 백업 후 이번 누적 패치 적용 가능. (원격 쓰기 없음)');return 0
if __name__=='__main__':
 try:sys.exit(main())
 except (OSError,ValueError,zipfile.BadZipFile,json.JSONDecodeError) as e:print('STOP:',e);sys.exit(2)
