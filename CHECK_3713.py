#!/usr/bin/env python3
"""Read-only compatibility checker for the Young's Physics 3.7.13 patch.
No source edits, extraction, network access, credentials, or deployment.
"""
import hashlib,json,sys,zipfile
from pathlib import Path,PurePosixPath

def sha(data):return hashlib.sha256(data).hexdigest()
def inventory(target):
 p=Path(target)
 if p.is_dir():
  candidates=[p]+[q for q in p.iterdir() if q.is_dir() and q.name!='.git']
  roots=[q for q in candidates if (q/'package.json').is_file() and (q/'site/assets/data/catalog.json').is_file()]
  if len(roots)!=1:raise ValueError('package.json과 site 폴더가 있는 프로젝트 루트를 하나로 찾을 수 없습니다.')
  root=roots[0]
  return {f.relative_to(root).as_posix():sha(f.read_bytes()) for f in root.rglob('*') if f.is_file() and '.git' not in f.relative_to(root).parts and 'node_modules' not in f.relative_to(root).parts}
 if not p.is_file() or not zipfile.is_zipfile(p):raise ValueError('현재 GitHub 저장소 전체 ZIP 또는 소스 폴더를 지정하세요.')
 with zipfile.ZipFile(p) as z:
  names=[i.filename for i in z.infolist() if not i.is_dir() and not i.filename.startswith('__MACOSX/')]
  roots=[n[:-len('site/assets/data/catalog.json')] for n in names if n.endswith('site/assets/data/catalog.json') and n[:-len('site/assets/data/catalog.json')]+'package.json' in names]
  if len(roots)!=1:raise ValueError('ZIP 안 프로젝트 루트를 하나로 식별할 수 없습니다.')
  prefix=roots[0];result={}
  for n in names:
   if not n.startswith(prefix):continue
   rel=n[len(prefix):];parts=PurePosixPath(rel).parts
   if '..' in parts or rel.startswith('/') or '\\' in rel:raise ValueError('안전하지 않은 ZIP 경로')
   if rel in result:raise ValueError('ZIP 내부 중복 경로: '+rel)
   result[rel]=sha(z.read(n))
  return result

def main():
 if len(sys.argv)!=2:
  print('사용법: python CHECK_3713.py 현재_GitHub_전체소스.zip (또는 소스폴더)');return 2
 m=json.loads(Path(__file__).with_name('PATCH_MANIFEST_3713.json').read_text(encoding='utf-8'));got=inventory(sys.argv[1])
 if all(got.get(f)==h for f,h in m['targetChecks'].items()):
  print('ALREADY_COMPLETE: 이번 v3.7.13 기능이 이미 반영되어 있습니다. 재적용하지 마세요.');return 0
 errors=[f for f,h in m['baseChecks'].items() if got.get(f)!=h]
 collisions=[f for f,h in m['newFiles'].items() if f in got and got[f]!=h]
 old=[f for f in got if 'r05-web-reconstructed' in f]
 if errors or collisions or old:
  print('STOP: '+m['baseVersion']+' 기준과 일치하지 않습니다. 덮어쓰지 마세요.')
  for f in errors[:30]:print('  기준 차이/누락:',f)
  for f in collisions[:20]:print('  신규 파일 충돌:',f)
  for f in old[:10]:print('  이전 재구성본 흔적:',f)
  if 'site/assets/core.js' in errors:print('과거 v3.7.5 누락 복구 여부도 확인해야 합니다. 옛 패치를 임의로 덮어쓰지 마세요.')
  print('증분은 정상 v3.7.12, 누적은 정상 v3.7.10용입니다. 해당 기준의 패치를 사용하세요.');return 2
 print('PASS_BASE: '+m['baseVersion']+' 기준과 일치합니다. 현재 운영 커밋·GAS 버전 확인 및 Sheets 백업 후 적용하세요.')
 print('읽기 전용 검사입니다. 파일 수정·서버 접속·배포·동기화를 수행하지 않았습니다.')
 for f,h in m['preserveOnly'].items():
  if f in got and got[f]!=h:print('PRESERVE_CONFIG:',f,'운영값을 그대로 보존하세요. 이번 패치에서 제외했습니다.')
 return 0
if __name__=='__main__':
 try:sys.exit(main())
 except (OSError,ValueError,zipfile.BadZipFile,json.JSONDecodeError) as e:print('STOP:',e);sys.exit(2)
