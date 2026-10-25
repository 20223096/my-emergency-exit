# 서울역 프론트엔드/API 계약

## 조회

`GET /api/maps`에서 `seoul-station-line4-prototype-v1`을 선택하고 `GET /api/maps/seoul-station-line4-prototype-v1`로 전체 그래프를 받는다. 기존 지도 응답 필드는 유지되며 노드/간선의 provenance 필드는 선택적으로 추가되었다.

`GET /api/scenarios`에서 `map_id`가 신규 지도 ID인 항목을 사용한다.

| 시나리오 ID | 조건 |
|---|---|
| `seoul-fire-a-approach` | `blocked_edge_ids: ["E11_OUT"]` |
| `seoul-fire-a-exit` | `blocked_exit_ids: ["EXIT_11"]` |
| `seoul-fire-b-stair` | `blocked_edge_ids: ["STAIR_A"]` |
| `seoul-fire-b-unreachable` | `blocked_edge_ids: ["STAIR_A", "STAIR_B"]` |

`hazard_edge_ids`는 SVG 화재 가정 표시에만 사용하며 라우팅 조건은 반드시 `conditions`를 사용한다.

## 계산 요청

```json
{
  "map_id": "seoul-station-line4-prototype-v1",
  "start_node_id": "S3",
  "blocked_edge_ids": ["STAIR_A"],
  "blocked_exit_ids": [],
  "congestion_delays": {"STAIR_B": 20},
  "walking_speed_mps": 1.2,
  "stair_speed_mps": 0.8,
  "reaction_delay_s": 5
}
```

`POST /api/routes/calculate`는 단일 결과, `POST /api/routes/compare`는 같은 시작점·속도·반응시간의 무조건 기준선과 재난 조건 결과를 반환한다. `stair_speed_mps`는 선택 필드다. 생략하면 계단에도 `walking_speed_mps`를 사용하므로 기존 요청 계약이 유지된다.

## 비교 응답

기존 `baseline`, `scenario`, `path_changed`, `exit_changed`, `distance_delta_m`, `total_time_delta_s`, `change_reasons`를 그대로 사용한다. 각 경로에는 출구, 노드/간선, 거리, 이동시간, 반응시간, 총시간과 적용 조건이 포함된다.

unreachable이면 `reachable=false`, 배열은 비고 출구·거리·시간과 비교 delta는 `null`이다. 프론트엔드는 이를 0으로 변환하지 않는다. `distance_delta_m`은 우회 거리 차이이며 사용자의 되돌아간 거리가 아니다.

## 화면 흐름과 초기화

지도와 S1/S2/S3를 선택하고 기본 계산 또는 시나리오 비교를 수행한다. 같은 지도에서 시나리오를 바꿀 때 사용자가 고른 시작점은 유지된다. 평지/계단 속도, 반응시간과 혼잡 구간 지연을 입력할 수 있다. 초기화는 재난·혼잡 조건과 결과를 비우고 기본 속도(1.2/0.8m/s), 반응시간(5초)으로 복원한다.

SVG는 기본/변경 경로, 차단, 혼잡, 계단, 출구 폐쇄와 화재 가정 위치를 구분한다. 화면과 지도 메타데이터에 실제 재난 안내가 아니라는 안전 고지를 표시한다.
