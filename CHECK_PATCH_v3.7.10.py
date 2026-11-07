#!/usr/bin/env python3
"""Read-only v3.7.10 patch preflight. No extraction, writes or network calls."""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Current GitHub source folder or downloaded source ZIP')
    parser.add_argument('--manifest', type=Path, default=Path(__file__).with_name('PATCH_MANIFEST_v3.7.10.json'))
    args = parser.parse_args()
    archive = None
    try:
        manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
        if args.source.is_dir():
            root = args.source.resolve()
            def read_file(name: str) -> bytes | None:
                f = (root / name).resolve()
                if root not in f.parents:
                    raise ValueError('Unsafe file path in manifest')
                return f.read_bytes() if f.is_file() else None
        elif args.source.is_file() and zipfile.is_zipfile(args.source):
            archive = zipfile.ZipFile(args.source)
            names = set(archive.namelist())
            candidates = [n[:-len('package.json')] for n in names
                          if n.endswith('package.json') and n[:-len('package.json')] + 'site/assets/data/catalog.json' in names]
            if len(candidates) != 1:
                raise ValueError('Cannot identify one project root in ZIP')
            prefix = candidates[0]
            def read_file(name: str) -> bytes | None:
                return archive.read(prefix + name) if prefix + name in names else None
        else:
            raise ValueError('Source must be an existing folder or valid ZIP')
        errors = []
        checked = 0
        for name, before in manifest['requiredBaseFiles'].items():
            after = manifest['changed'].get(name, {}).get('sha256_after', before)
            content = read_file(name)
            checked += 1
            if content is None:
                errors.append('MISSING: ' + name)
            elif sha(content) not in {before, after}:
                errors.append('DIFFERENT: ' + name)
        for name, expected in manifest['added'].items():
            content = read_file(name)
            if content is not None and sha(content) != expected['sha256_after']:
                errors.append('NEW FILE CONFLICT: ' + name)
        if errors:
            print('STOP - source does not match the verified v3.7.9/v3.7.10 baseline.')
            for item in errors:
                print(item)
            print('Do not overwrite. Compare the current source first. No files were changed.')
            return 2
        print(f'PASS - {checked} required base files match; new files are absent or match this patch.')
        print('Read-only source check only. Live deployment/Sheets are NOT verified.')
        print('Back up Sheets and review existing advanced round 4 records/QuestionOverrides (both version IDs) BEFORE deployment or teacher login.')
        print('An authenticated teacher page may automatically sync the changed catalog.')
        return 0
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        return 3
    finally:
        if archive is not None:
            archive.close()


if __name__ == '__main__':
    sys.exit(main())
