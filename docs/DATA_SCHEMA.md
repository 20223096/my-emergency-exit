# 데이터 스키마

지도 파일은 `backend/app/data/*_map.json`에 둡니다. 서버는 파일을 검색한 뒤 JSON 내부의 `id`로 지도를 선택합니다.

## Node

| 필드 | 형식 | 의미 |
|---|---|---|
| `id` | string | 지도 내 고유 식별자 |
| `type` | enum | `START`, `JUNCTION`, `STAIR`, `EXIT` |
| `x`, `y` | number | 화면 표시용 상대 좌표 |
| `floor` | integer | 층 |
| `label` | string | 표시 이름 |

## Edge

| 필드 | 형식 | 의미 |
|---|---|---|
| `id` | string | 지도 내 고유 식별자 |
| `source`, `target` | string | 연결 노드 ID |
| `length_m` | number > 0 | 가정한 구간 길이(m) |
| `type` | enum | `CORRIDOR`, `STAIR` |
| `bidirectional` | boolean | `false`면 source → target만 허용 |

중복 ID, 존재하지 않는 노드 참조, 0 이하 길이는 지도 로딩 시 거부됩니다.

서로 다른 간선 ID가 같은 두 노드를 연결하는 것은 별도 물리 통로일 수 있으므로 로딩 오류로 처리하지 않습니다. 대신 `app.core.data_quality.find_parallel_edges()`가 평행 간선과 겹치는 통행 방향을 검출합니다. 현재 샘플의 A12와 A17은 `E3 → T1` 방향이 겹치므로 실제 지도 자료 수신 후 동일 통로인지 별도 통로인지 확인해야 합니다.

현재 엔진은 NetworkX가 아니라 간선 객체 목록을 보존하는 자체 인접 리스트를 사용하므로 같은 두 노드 사이의 서로 다른 간선 ID를 독립적으로 저장하고 차단합니다. 향후 NetworkX로 교체할 경우 일반 `DiGraph`가 아닌 간선 키를 보존하는 `MultiDiGraph`를 사용해야 합니다.

## Scenario

`scenarios.json`의 항목은 `id`, `name`, `description`, `map_id`, `start_node_id`와 `conditions`를 가집니다. conditions에는 `blocked_edge_ids`, `blocked_exit_ids`, `congestion_delays`가 있으며 생략하면 각각 빈 값입니다.

## 실제 지도 데이터 교체

1. 별도 `*_map.json` 파일을 추가하고 고유한 지도 `id`를 지정합니다.
2. 실제 조사 자료로 노드 연결, 층, 통로 길이와 방향성을 작성합니다.
3. 모든 출발점은 `START`, 도착 후보는 `EXIT`로 지정합니다.
4. `/api/maps`와 `/api/maps/{map_id}`로 로딩을 확인합니다.
5. 새 지도용 고정 경로·차단·일방통행 테스트를 추가합니다.

`x`, `y`는 렌더링용 상대 좌표이고 `length_m`가 이동시간 계산에 사용되는 실제 단위 필드입니다. 두 값을 서로 환산하지 않습니다.
