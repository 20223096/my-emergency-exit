#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from trial_contract import evaluate, validate_dataset, validate_predictions


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Score external location/direction predictions; this tool performs no inference")
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--top-k", type=int, default=2)
    parser.add_argument("--high-confidence-threshold", type=float)
    args = parser.parse_args()
    if args.top_k < 1:
        parser.error("--top-k must be at least 1")
    try:
        dataset, predictions = load(args.dataset), load(args.predictions)
    except (OSError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "invalid", "errors": [str(error)]}, ensure_ascii=False, indent=2))
        return 2
    errors = validate_dataset(dataset, manifest_path=args.dataset) + validate_predictions(predictions)
    if args.high_confidence_threshold is not None and not predictions.get("confidence_semantics", {}).get("verified", False):
        errors.append("a high-confidence threshold cannot be used until confidence_semantics.verified is true")
    if errors:
        print(json.dumps({"status": "invalid", "errors": errors}, ensure_ascii=False, indent=2))
        return 1
    result = evaluate(dataset, predictions, top_k=args.top_k, high_confidence_threshold=args.high_confidence_threshold)
    result["disclaimer"] = "offline metrics only; no route-engine integration or safety performance claim"
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] in {"completed", "not_run"} else 1


if __name__ == "__main__":
    raise SystemExit(main())

