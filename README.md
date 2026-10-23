# 내비상구(NaviExit)

대형 복합시설의 가상 공간 그래프에서 통로 차단, 출구 폐쇄, 혼잡 지연에 따른 대피경로 변화를 비교하는 실험용 프로토타입입니다. 실제 재난용 안내 시스템이나 실제 서울역 지도·안전성 판단 도구가 아닙니다.

## 기술 스택

- Python 3.11+
- FastAPI, Pydantic v2, Uvicorn
- 결정적 Dijkstra 동등 알고리즘(표준 라이브러리 heap 기반)
- pytest, FastAPI TestClient

## 설치 및 실행

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

서버는 기본적으로 `http://127.0.0.1:8000`에서 실행됩니다. Swagger UI는 `http://127.0.0.1:8000/docs`, OpenAPI JSON은 `http://127.0.0.1:8000/openapi.json`입니다.

## 테스트

```bash
cd backend
python -m pytest
```

## 샘플 요청

```bash
curl -X POST http://127.0.0.1:8000/api/routes/compare \
  -H 'Content-Type: application/json' \
  -d '{
    "map_id": "virtual-station-v1",
    "start_node_id": "S1",
    "blocked_edge_ids": ["A04"],
    "blocked_exit_ids": [],
    "congestion_delays": {"A05": 12},
    "walking_speed_mps": 1.2,
    "reaction_delay_s": 5
  }'
```

상세 계약은 [API 명세](docs/API_SPEC.md), 지도 교체법은 [데이터 스키마](docs/DATA_SCHEMA.md), 실험 조건과 한계는 [가정](docs/ASSUMPTIONS.md)을 참고하세요.

## 기획팀 자료 수신 후 작업

- 실제 공간의 노드·간선 연결, 층, 통행 방향과 통로 길이로 실험 지도를 교체합니다.
- A12/A17처럼 같은 노드 쌍을 연결하는 간선이 동일 물리 통로인지 별도 통로인지 확인합니다.
- 근거자료에 따라 보행속도, 계단 보정, 반응시간과 혼잡 지연 정책을 확정합니다.
- UI 초안에 맞춰 지도 좌표 스케일링, 기본/변경 경로 강조, 차단·폐쇄·혼잡 입력과 경로 없음·오류 상태를 연결합니다.
- 지도 JSON 구조와 API ID 참조 방식은 유지할 수 있으며 실제 데이터별 회귀 테스트를 추가합니다.
