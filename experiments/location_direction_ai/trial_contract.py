"""Validation and metrics for the offline location/direction trial.

This module never reads image pixels and never performs inference.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_SPLITS = {"REFERENCE", "TEST"}
ALLOWED_PERMISSIONS = {"APPROVED_FOR_EVALUATION", "PENDING", "REJECTED"}
ALLOWED_QUALITY_FLAGS = {
    "BLUR", "LOW_LIGHT", "OCCLUSION", "PARTIAL_SIGNAGE", "GLARE",
    "MOTION_BLUR", "OUT_OF_SCOPE", "NONE",
}
ALLOWED_ABSTENTION_REASONS = {
    "NONE", "LOW_CONFIDENCE", "AMBIGUOUS_TOP_CANDIDATES", "OUT_OF_SCOPE",
    "POOR_IMAGE_QUALITY", "MODEL_ERROR", "UNSUPPORTED_INPUT",
}
LOCATION_SCOPE = "EXPERIMENT_ONLY_NOT_VERIFIED_AS_REAL_GRAPH_NODE"


def _text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_dataset(data: Any, *, manifest_path: Path | None = None,
                     require_files: bool = False) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["root must be an object"]
    if data.get("schema_version") != "1.0":
        errors.append("schema_version must be '1.0'")
    if not _text(data.get("dataset_id")):
        errors.append("dataset_id must be a non-empty string")
    if data.get("location_label_scope") != LOCATION_SCOPE:
        errors.append(f"location_label_scope must be '{LOCATION_SCOPE}'")
    records = data.get("records")
    if not isinstance(records, list):
        return errors + ["records must be an array"]

    seen_ids: set[str] = set()
    test_sessions: set[str] = set()
    reference_sessions: set[str] = set()
    base = manifest_path.parent if manifest_path else Path.cwd()
    fields = (
        "image_id", "image_path", "location_id", "facing_direction",
        "capture_session_id", "reference_or_test", "human_verified",
        "permission_status", "privacy_review_status", "quality_flags",
    )
    for index, record in enumerate(records):
        prefix = f"records[{index}]"
        if not isinstance(record, dict):
            errors.append(f"{prefix} must be an object")
            continue
        missing = [field for field in fields if field not in record]
        if missing:
            errors.append(f"{prefix} missing fields: {', '.join(missing)}")
            continue
        for field in ("image_id", "image_path", "location_id", "facing_direction", "capture_session_id"):
            if not _text(record[field]):
                errors.append(f"{prefix}.{field} must be a non-empty string")
        image_id = record["image_id"]
        if isinstance(image_id, str):
            if image_id in seen_ids:
                errors.append(f"duplicate image_id: {image_id}")
            seen_ids.add(image_id)
        image_path = record["image_path"]
        if isinstance(image_path, str):
            path = Path(image_path)
            if path.is_absolute() or ".." in path.parts:
                errors.append(f"{prefix}.image_path must be a safe relative path")
            if path.suffix.lower() not in ALLOWED_IMAGE_EXTENSIONS:
                errors.append(f"{prefix}.image_path has an unsupported extension")
            if require_files and not (base / path).is_file():
                errors.append(f"{prefix}.image_path does not exist: {image_path}")
        split = record["reference_or_test"]
        if split not in ALLOWED_SPLITS:
            errors.append(f"{prefix}.reference_or_test is invalid")
        session = record["capture_session_id"]
        if _text(session):
            (test_sessions if split == "TEST" else reference_sessions).add(session)
        if record["human_verified"] is not True:
            errors.append(f"{prefix}.human_verified must be true before evaluation")
        if record["permission_status"] not in ALLOWED_PERMISSIONS:
            errors.append(f"{prefix}.permission_status is invalid")
        elif record["permission_status"] != "APPROVED_FOR_EVALUATION":
            errors.append(f"{prefix} is not approved for evaluation")
        if record["privacy_review_status"] != "CLEARED_NO_PERSONAL_DATA":
            errors.append(f"{prefix} must be cleared as containing no personal data")
        flags = record["quality_flags"]
        if not isinstance(flags, list) or any(flag not in ALLOWED_QUALITY_FLAGS for flag in flags):
            errors.append(f"{prefix}.quality_flags contains an invalid value")
        elif len(flags) != len(set(flags)) or ("NONE" in flags and len(flags) > 1):
            errors.append(f"{prefix}.quality_flags must be unique and NONE must stand alone")
    overlap = test_sessions & reference_sessions
    if overlap:
        errors.append("capture_session_id must not cross REFERENCE/TEST: " + ", ".join(sorted(overlap)))
    return errors


def validate_predictions(data: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["root must be an object"]
    if data.get("schema_version") != "1.0":
        errors.append("schema_version must be '1.0'")
    status = data.get("run_status")
    if status not in {"not_run", "completed"}:
        errors.append("run_status must be not_run or completed")
    model = data.get("model")
    records = data.get("records")
    semantics = data.get("confidence_semantics")
    if status == "not_run":
        if model is not None or records != []:
            errors.append("not_run requires model=null and records=[]")
    elif not isinstance(model, dict) or not _text(model.get("model_id")) or not _text(model.get("model_version")):
        errors.append("completed requires model_id and model_version")
    if not isinstance(semantics, dict) or not isinstance(semantics.get("verified"), bool):
        errors.append("confidence_semantics with boolean verified is required")
    if not isinstance(records, list):
        return errors + ["records must be an array"]
    seen: set[str] = set()
    for index, record in enumerate(records):
        prefix = f"records[{index}]"
        if not isinstance(record, dict):
            errors.append(f"{prefix} must be an object")
            continue
        image_id = record.get("image_id")
        if not _text(image_id):
            errors.append(f"{prefix}.image_id must be a non-empty string")
        elif image_id in seen:
            errors.append(f"duplicate prediction image_id: {image_id}")
        else:
            seen.add(image_id)
        for field in ("location_candidates", "direction_candidates"):
            candidates = record.get(field)
            if not isinstance(candidates, list):
                errors.append(f"{prefix}.{field} must be an array")
                continue
            previous: float | None = None
            for candidate in candidates:
                if not isinstance(candidate, dict) or not _text(candidate.get("id")) or not isinstance(candidate.get("confidence"), (int, float)):
                    errors.append(f"{prefix}.{field} has an invalid candidate")
                    continue
                score = float(candidate["confidence"])
                if previous is not None and score > previous:
                    errors.append(f"{prefix}.{field} must be sorted by descending confidence")
                previous = score
        decidable = record.get("decidable")
        reason = record.get("abstention_reason")
        if not isinstance(decidable, bool) or reason not in ALLOWED_ABSTENTION_REASONS:
            errors.append(f"{prefix} has invalid decidable/abstention_reason")
        elif decidable and reason != "NONE":
            errors.append(f"{prefix}: decidable=true requires abstention_reason=NONE")
        elif decidable and (not record.get("location_candidates") or not record.get("direction_candidates")):
            errors.append(f"{prefix}: decidable=true requires location and direction candidates")
        elif not decidable and reason == "NONE":
            errors.append(f"{prefix}: abstention requires a reason")
    return errors


def evaluate(dataset: dict[str, Any], predictions: dict[str, Any], *, top_k: int,
             high_confidence_threshold: float | None) -> dict[str, Any]:
    if predictions["run_status"] == "not_run":
        return {"status": "not_run", "reason": "no model predictions supplied", "metrics": None}
    tests = [record for record in dataset["records"] if record["reference_or_test"] == "TEST"]
    if not tests:
        return {"status": "not_run", "reason": "no independent TEST records", "metrics": None}
    by_image = {record["image_id"]: record for record in predictions["records"]}
    missing = sorted(record["image_id"] for record in tests if record["image_id"] not in by_image)
    if missing:
        return {"status": "invalid", "reason": "missing predictions", "missing_image_ids": missing, "metrics": None}

    total = len(tests)
    in_scope_total = sum(
        record["location_id"] != "OUT_OF_SCOPE" and "OUT_OF_SCOPE" not in record["quality_flags"]
        for record in tests
    )
    abstained = top1_hits = topk_hits = direction_hits = 0
    confirmed = wrong_confirmed = high_confidence_errors = 0
    out_total = out_rejected = 0
    threshold_verified = predictions["confidence_semantics"]["verified"]
    for truth in tests:
        prediction = by_image[truth["image_id"]]
        out_of_scope = truth["location_id"] == "OUT_OF_SCOPE" or "OUT_OF_SCOPE" in truth["quality_flags"]
        if out_of_scope:
            out_total += 1
            if not prediction["decidable"]:
                out_rejected += 1
        if not prediction["decidable"]:
            abstained += 1
            continue
        confirmed += 1
        locations = prediction["location_candidates"]
        top1 = locations[0]["id"] if locations else None
        if not out_of_scope and top1 == truth["location_id"]:
            top1_hits += 1
        else:
            wrong_confirmed += 1
            if threshold_verified and high_confidence_threshold is not None and locations and locations[0]["confidence"] >= high_confidence_threshold:
                high_confidence_errors += 1
        if not out_of_scope and truth["location_id"] in [item["id"] for item in locations[:top_k]]:
            topk_hits += 1
        if not out_of_scope:
            directions = prediction["direction_candidates"]
            if directions and directions[0]["id"] == truth["facing_direction"]:
                direction_hits += 1

    ratio = lambda numerator, denominator: round(numerator / denominator, 6) if denominator else None
    high_metric: dict[str, Any]
    if not threshold_verified or high_confidence_threshold is None:
        high_metric = {
            "status": "not_computed",
            "reason": "confidence semantics must be verified and a threshold supplied",
            "count": None,
        }
    else:
        high_metric = {"status": "computed", "threshold": high_confidence_threshold, "count": high_confidence_errors}
    return {
        "status": "completed",
        "evaluated_test_records": total,
        "metrics": {
            "location_top1_accuracy": ratio(top1_hits, in_scope_total),
            f"location_top{top_k}_accuracy": ratio(topk_hits, in_scope_total),
            "direction_accuracy": ratio(direction_hits, in_scope_total),
            "abstention_rate": ratio(abstained, total),
            "wrong_location_confirmation_rate": ratio(wrong_confirmed, confirmed),
            "wrong_location_confirmations": wrong_confirmed,
            "high_confidence_misclassifications": high_metric,
            "out_of_scope_rejection_rate": ratio(out_rejected, out_total),
            "out_of_scope_count": out_total,
        },
    }

