from __future__ import annotations

import unittest

from experiments.location_direction_ai.trial_contract import evaluate, validate_dataset, validate_predictions


def record(image_id, location, direction, *, out=False):
    return {
        "image_id": image_id, "image_path": f"images/{image_id}.jpg",
        "location_id": location, "facing_direction": direction,
        "capture_session_id": f"session-{image_id}", "reference_or_test": "TEST",
        "human_verified": True, "permission_status": "APPROVED_FOR_EVALUATION",
        "privacy_review_status": "CLEARED_NO_PERSONAL_DATA",
        "quality_flags": ["OUT_OF_SCOPE"] if out else ["NONE"],
    }


class TrialContractTest(unittest.TestCase):
    def setUp(self):
        self.dataset = {
            "schema_version": "1.0", "dataset_id": "synthetic-unit-test",
            "location_label_scope": "EXPERIMENT_ONLY_NOT_VERIFIED_AS_REAL_GRAPH_NODE",
            "records": [record("one", "SITE_A", "D1"), record("two", "OUT_OF_SCOPE", "NA", out=True)],
        }

    def test_empty_templates_return_not_run(self):
        dataset = {**self.dataset, "records": []}
        predictions = {
            "schema_version": "1.0", "run_status": "not_run", "model": None,
            "confidence_semantics": {"score_type": "UNSPECIFIED", "verified": False, "verification_note": "none"},
            "records": [],
        }
        self.assertEqual([], validate_dataset(dataset))
        self.assertEqual([], validate_predictions(predictions))
        self.assertEqual("not_run", evaluate(dataset, predictions, top_k=2, high_confidence_threshold=None)["status"])

    def test_metrics_and_rejection(self):
        predictions = {
            "schema_version": "1.0", "run_status": "completed",
            "model": {"model_id": "synthetic-test-double", "model_version": "0"},
            "confidence_semantics": {"score_type": "PROBABILITY", "verified": True, "verification_note": "unit test"},
            "records": [
                {"image_id": "one", "location_candidates": [{"id": "SITE_A", "confidence": .9}], "direction_candidates": [{"id": "D1", "confidence": .8}], "decidable": True, "abstention_reason": "NONE"},
                {"image_id": "two", "location_candidates": [], "direction_candidates": [], "decidable": False, "abstention_reason": "OUT_OF_SCOPE"},
            ],
        }
        self.assertEqual([], validate_dataset(self.dataset))
        self.assertEqual([], validate_predictions(predictions))
        result = evaluate(self.dataset, predictions, top_k=2, high_confidence_threshold=.8)
        self.assertEqual(1.0, result["metrics"]["out_of_scope_rejection_rate"])
        self.assertEqual(1.0, result["metrics"]["location_top1_accuracy"])

    def test_unapproved_or_session_leak_is_rejected(self):
        self.dataset["records"][0]["permission_status"] = "PENDING"
        self.dataset["records"].append({**record("three", "SITE_A", "D1"), "reference_or_test": "REFERENCE", "capture_session_id": "session-two"})
        errors = validate_dataset(self.dataset)
        self.assertTrue(any("not approved" in error for error in errors))
        self.assertTrue(any("must not cross" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

