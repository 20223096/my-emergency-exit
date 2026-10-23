from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from pydantic import ValidationError

from app.models.schemas import IndoorMap, MapSummary, Scenario

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


class DataRepository:
    def __init__(self, data_dir: Path = DATA_DIR):
        self.data_dir = data_dir

    def list_maps(self) -> list[MapSummary]:
        maps = [self._load_map_file(path) for path in sorted(self.data_dir.glob("*_map.json"))]
        return [MapSummary(id=m.id, name=m.metadata.name, description=m.metadata.description,
                           experimental=m.metadata.experimental) for m in maps]

    @lru_cache(maxsize=32)
    def get_map(self, map_id: str) -> IndoorMap:
        for path in sorted(self.data_dir.glob("*_map.json")):
            indoor_map = self._load_map_file(path)
            if indoor_map.id == map_id:
                return indoor_map
        raise KeyError(f"map_id '{map_id}' does not exist")

    @lru_cache(maxsize=1)
    def list_scenarios(self) -> list[Scenario]:
        path = self.data_dir / "scenarios.json"
        raw = json.loads(path.read_text(encoding="utf-8"))
        return [Scenario.model_validate(item) for item in raw]

    @staticmethod
    def _load_map_file(path: Path) -> IndoorMap:
        try:
            return IndoorMap.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError, ValidationError) as exc:
            raise RuntimeError(f"invalid map data in {path.name}: {exc}") from exc


repository = DataRepository()
