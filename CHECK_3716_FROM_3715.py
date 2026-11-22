#!/usr/bin/env python3
"""Read-only local source compatibility check. No network or mutation."""
import hashlib,json,sys,zipfile
from pathlib import Path,PurePosixPath
BASE='3.7.15'
sha=lambda b:hashlib.sha256(b).hexdigest()
def inventory(location):
 p=Path(location)
 if p.is_dir():
  roots=[r for r in [p]+[d for d in p.iterdir() if d.is_dir()] if (r/'site/assets/data/catalog.json').is_file() and (r/'package.json').is_file()]
  if len(roots)!=1:raise ValueError('프로젝트 루트를 하나로 찾지 못했습니다.')
  root=roots[0]
  return {f.relative_to(root).as_posix():sha(f.read_bytes()) for f in root.rglob('*') if f.is_file() and not any(x in {'.git','node_modules'} for x in f.relative_to(root).parts)}
 if not p.is_file() or not zipfile.is_zipfile(p):raise ValueError('현재 운영 소스 폴더 또는 전체 ZIP이 필요합니다.')
 with zipfile.ZipFile(p) as z:
  names=[i.filename for i in z.infolist() if not i.is_dir() and not i.filename.startswith('__MACOSX/')]
  roots=[s[:-len('site/assets/data/catalog.json')] for s in names if s.endswith('site/assets/data/catalog.json') and s[:-len('site/assets/data/catalog.json')]+'package.json' in names]
  if len(roots)!=1:raise ValueError('ZIP의 프로젝트 루트를 하나로 찾지 못했습니다.')
  result={}
  for name in names:
   if not name.startswith(roots[0]):continue
   rel=name[len(roots[0]):]
   if '..' in PurePosixPath(rel).parts or rel.startswith('/') or chr(92) in rel or rel in result:raise ValueError('중복되거나 부적합한 ZIP 경로: '+rel)
   if any(x in {'.git','node_modules'} for x in PurePosixPath(rel).parts):continue
   result[rel]=sha(z.read(name))
  return result
def main():
 if len(sys.argv)!=2:
  print('Usage: python '+Path(__file__).name+' <current-source-folder-or-full-source.zip>');return 2
 m=json.loads(Path(__file__).with_name('PATCH_MANIFEST_3716.json').read_text(encoding='utf-8'))
 g=inventory(sys.argv[1])
 if all(g.get(f)==h for f,h in m['targetChecks'].items()):
  print('ALREADY_COMPLETE: v3.7.16 핵심 파일이 이미 일치합니다. 재적용할 필요 없습니다.');return 0
 variant=m['baseVariants'][BASE]
 bad=[f for f,h in variant['checks'].items() if g.get(f)!=h]
 collisions=[f for f in variant['newPaths'] if f in g]
 protected=[f for f,h in variant['protectedChecks'].items() if g.get(f)!=h]
 if bad or collisions or protected:
  print('STOP: 예상 기준 v'+BASE+'와 다릅니다. 덮어쓰지 마세요.')
  for label,items in [('기준 불일치',bad),('새 파일 충돌',collisions),('기존 엔진 변경',protected)]:
   for f in items[:20]:print(label+': '+f)
  return 2
 print('PASS_BASE: 정상 v'+BASE+' 기준입니다. 백업 후 해당 패치 적용 가능. 이 검사는 파일과 서버를 변경하지 않았습니다.');return 0
if __name__=='__main__':
 try:sys.exit(main())
 except (OSError,ValueError,zipfile.BadZipFile,json.JSONDecodeError) as error:print('STOP:',error);sys.exit(2)
