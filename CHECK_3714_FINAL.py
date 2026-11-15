#!/usr/bin/env python3
"""Read-only v3.7.13 -> v3.7.14 source compatibility check. No network/write."""
import json,hashlib,sys,zipfile
from pathlib import Path,PurePosixPath

def digest(b):return hashlib.sha256(b).hexdigest()

def inventory(path):
 p=Path(path)
 if p.is_dir():
  roots=[r for r in [p]+[q for q in p.iterdir() if q.is_dir()] if (r/'package.json').is_file() and (r/'site/assets/data/catalog.json').is_file()]
  if len(roots)!=1:raise ValueError('프로젝트 루트를 하나로 찾지 못했습니다.')
  root=roots[0]
  return {f.relative_to(root).as_posix():digest(f.read_bytes()) for f in root.rglob('*') if f.is_file() and '.git' not in f.relative_to(root).parts and 'node_modules' not in f.relative_to(root).parts}
 if not p.is_file() or not zipfile.is_zipfile(p):raise ValueError('운영 소스 ZIP 또는 폴더를 지정하세요.')
 with zipfile.ZipFile(p) as z:
  names=[m.filename for m in z.infolist() if not m.is_dir() and not m.filename.startswith('__MACOSX/')]
  roots=[n[:-len('site/assets/data/catalog.json')] for n in names if n.endswith('site/assets/data/catalog.json') and n[:-len('site/assets/data/catalog.json')]+'package.json' in names]
  if len(roots)!=1:raise ValueError('ZIP 안의 프로젝트 루트를 확인할 수 없습니다.')
  out={}
  for name in names:
   if not name.startswith(roots[0]):continue
   key=name[len(roots[0]):];pos=PurePosixPath(key)
   if '..' in pos.parts or key.startswith('/') or '\\' in key:raise ValueError('안전하지 않은 ZIP 경로')
   if key in out:raise ValueError('중복 ZIP 파일 경로: '+key)
   out[key]=digest(z.read(name))
  return out

def main():
 if len(sys.argv)!=2:print('사용법: python CHECK_3714_FINAL.py 현재_GitHub_전체소스.zip');return 2
 manifest=json.loads(Path(__file__).with_name('PATCH_MANIFEST_3714_FINAL.json').read_text(encoding='utf-8'))
 got=inventory(sys.argv[1]);checks=manifest['targetChecks']
 if all(got.get(k)==h for k,h in checks.items()):print('ALREADY_COMPLETE: 현재 v3.7.14 최종 원본파일이 있습니다. 재적용하지 마세요.');return 0
 conflicts=[f for f,h in manifest['baseChecks'].items() if got.get(f)!=h]
 newcollisions=[f for f,h in manifest['newFiles'].items() if f in got and got[f]!=h]
 legacy=[f for f in got if 'r05-web-reconstructed' in f or f.endswith('r06-verified-solution.pdf')]
 if conflicts or newcollisions or legacy:
  print('STOP: 정상 v3.7.13 정본과 차이가 있습니다. 무리하게 적용하지 마세요.')
  for f in conflicts[:25]:print(' 기준 불일치:',f)
  for f in newcollisions[:15]:print(' 신규 파일 충돌:',f)
  for f in legacy[:10]:print(' 이전 재구성본 잔존:',f)
  return 2
 print('PASS_BASE: 정상 v3.7.13 기준 소스입니다 (이번 최종 문제지로 교체 가능). Sheets 백업·QuestionOverrides 확인 뒤 적용할 수 있습니다.')
 print('읽기 전용이며 운영 GitHub·Apps Script·Sheets·Cloudflare에 쓰기를 수행하지 않았습니다.')
 for f,h in manifest.get('preserveOnly',{}).items():
  if got.get(f)!=h:print('PRESERVE_CONFIG:',f,'운영값을 그대로 유지합니다. 패치에서 제외했습니다.')
 return 0
if __name__=='__main__':
 try:sys.exit(main())
 except (OSError,ValueError,json.JSONDecodeError,zipfile.BadZipFile) as e:print('STOP:',e);sys.exit(2)
