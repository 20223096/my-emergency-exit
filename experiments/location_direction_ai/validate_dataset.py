#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from trial_contract import validate_dataset


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate an approved location/direction image manifest")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--require-files", action="store_true", help="also require every relative image_path to exist")
    args = parser.parse_args()
    try:
        data = json.loads(args.manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "invalid", "errors": [str(error)]}, ensure_ascii=False, indent=2))
        return 2
    errors = validate_dataset(data, manifest_path=args.manifest, require_files=args.require_files)
    print(json.dumps({"status": "valid" if not errors else "invalid", "record_count": len(data.get("records", [])), "errors": errors}, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())

