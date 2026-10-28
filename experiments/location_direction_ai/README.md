# Location/direction AI offline trial tools

These standard-library-only tools validate an approved image manifest and score externally produced predictions. They do not load images or run an AI model.

```bash
python3 experiments/location_direction_ai/validate_dataset.py \
  experiments/location_direction_ai/examples/dataset_manifest.template.json

python3 experiments/location_direction_ai/evaluate_predictions.py \
  --dataset experiments/location_direction_ai/examples/dataset_manifest.template.json \
  --predictions experiments/location_direction_ai/examples/predictions.template.json
```

The templates contain no images or predictions, so evaluation returns `not_run`.

