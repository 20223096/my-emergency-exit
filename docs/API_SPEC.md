# API 명세

모든 API는 JSON을 사용합니다. 입력 스키마 오류와 존재하지 않는 노드·간선은 `422`, 존재하지 않는 지도는 `404`로 응답합니다. FastAPI 기본 오류 형식은 `{"detail": ...}`입니다.

## `GET /api/health`

```json
{"status":"ok","service":"naviexit-backend"}
```

## `GET /api/maps`

사용 가능한 지도 요약 배열을 반환합니다.

```json
[{"id":"virtual-station-v1","name":"가상 복합시설 실험 지도","description":"...","experimental":true}]
```

## `GET /api/maps/{map_id}`

지도 메타데이터와 `nodes`, `edges` 전체를 반환합니다. 프론트엔드는 노드의 `x`, `y`를 상대 위치로만 사용해야 합니다.

## `GET /api/scenarios`

사전 정의 시나리오 배열을 반환합니다. 각 항목은 `id`, `name`, `description`, `map_id`, `start_node_id`, `conditions`를 포함합니다.

## `POST /api/routes/calculate`

요청:

```json
{
  "map_id":"virtual-station-v1",
  "start_node_id":"S1",
  "blocked_edge_ids":["A04"],
  "blocked_exit_ids":["E2"],
  "congestion_delays":{"A05":10},
  "walking_speed_mps":1.2,
  "reaction_delay_s":5
}
```

성공 응답:

```json
{
  "reachable":true,
  "path_nodes":["S1","J3","T2","T1","E3"],
  "path_edges":["A18","A10","A11","A12"],
  "selected_exit_id":"E3",
  "distance_m":75.0,
  "movement_time_s":62.5,
  "reaction_delay_s":5.0,
  "total_time_s":67.5,
  "applied_conditions":{
    "blocked_edge_ids":["A04"],
    "blocked_exit_ids":["E2"],
    "congestion_delays":{"A05":10.0},
    "walking_speed_mps":1.2
  }
}
```

경로가 없으면 `reachable=false`, 경로 배열은 빈 배열, `selected_exit_id`, `distance_m`, `movement_time_s`, `total_time_s`는 `null`입니다.

## `POST /api/routes/compare`

요청 형식은 calculate와 같습니다. 응답은 `baseline`, `scenario`, `path_changed`, `exit_changed`, `distance_delta_m`, `total_time_delta_s`, `change_reasons`를 포함합니다. delta는 `scenario - baseline`입니다. 한쪽 경로가 없으면 해당 delta는 `null`입니다.

`change_reasons`는 차단, 폐쇄, 혼잡 입력과 계산 결과를 조합한 규칙 기반 문구이며 LLM을 사용하지 않습니다.

## 오류 예시

```json
{"detail":"map_id 'unknown' does not exist"}
```

```json
{"detail":"unknown edge id(s): A99"}
```

Pydantic 범위 오류(0 이하 속도, 음수 지연 등)는 필드 위치와 검증 사유가 담긴 표준 `422` 배열을 반환합니다.
