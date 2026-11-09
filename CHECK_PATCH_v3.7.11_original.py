#!/usr/bin/env python3
"""Read-only preflight for the ORIGINAL-PDF v3.7.11 patch from v3.7.10.
No extraction, file writes, web requests or deployment actions are performed.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Current GitHub source directory or source ZIP')
    parser.add_argument('--manifest', type=Path, default=Path(__file__).with_name('PATCH_MANIFEST_v3.7.11_original.json'))
    args = parser.parse_args()
    archive = None
    try:
        manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
        if args.source.is_dir():
            root = args.source.resolve()
            def read(name: str) -> bytes | None:
                f = (root / name).resolve()
                if root not in f.parents:
                    raise ValueError('Unsafe manifest path')
                return f.read_bytes() if f.is_file() else None
        elif args.source.is_file() and zipfile.is_zipfile(args.source):
            archive = zipfile.ZipFile(args.source)
            names = set(archive.namelist())
            prefixes = [n[:-len('package.json')] for n in names if n.endswith('package.json') and n[:-len('package.json')]+'site/assets/data/catalog.json' in names]
            if len(prefixes) != 1:
                raise ValueError('Expected exactly one project root in source ZIP')
            prefix = prefixes[0]
            def read(name: str) -> bytes | None:
                return archive.read(prefix+name) if prefix+name in names else None
        else:
            raise ValueError('An existing source directory or valid ZIP is required')
        base_errors, target_errors = [], []
        for name, before in manifest['requiredBaseFiles'].items():
            blob = read(name)
            actual = digest(blob) if blob is not None else None
            after = manifest['changed'].get(name, {}).get('sha256_after', before)
            if actual != before:
                base_errors.append(name)
            if actual != after:
                target_errors.append(name)
        for name, details in manifest['added'].items():
            blob = read(name)
            if blob is not None:
                base_errors.append('unexpected new file: '+name)
            if blob is None or digest(blob) != details['sha256_after']:
                target_errors.append('missing/different new file: '+name)
        forbidden = [p for p in manifest.get('forbiddenReconstructionPaths', []) if read(p) is not None]
        if forbidden:
            print('STOP - reconstructed/obsolete round-5 files were found:')
            for p in forbidden: print(p)
            print('Use a clean v3.7.10 source snapshot or compare manually. No files were changed.')
            return 2
        if not base_errors:
            print(f'PASS BASE: all {len(manifest["requiredBaseFiles"])} v3.7.10 files match. This original-PDF patch is applicable.')
        elif not target_errors:
            print('PASS TARGET: this exact original-PDF v3.7.11 build is already present. Do not reapply unnecessarily.')
        else:
            print('STOP - source is neither complete v3.7.10 nor this complete original-PDF v3.7.11 build.')
            print('Differences vs v3.7.10:')
            for p in base_errors[:40]: print('  '+p)
            print('Do not overwrite or mix patch versions. No files were changed.')
            return 2
        print('This checks local source bytes only. Live GitHub/Apps Script/Sheets/Worker were NOT verified.')
        print('Back up Sheets and inspect r05 Reports/Exams/Questions/QuestionOverrides BEFORE deployment or teacher-page access.')
        print('An authenticated teacher page can automatically sync the new catalog.')
        return 0
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as exc:
        print('ERROR: '+str(exc), file=sys.stderr)
        return 3
    finally:
        if archive is not None: archive.close()

if __name__ == '__main__':
    sys.exit(main())
