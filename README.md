# 내비상구(NaviExit)

대형 복합시설의 가상 공간 그래프에서 통로 차단, 출구 폐쇄, 혼잡 지연에 따른 대피경로 변화를 비교하는 실험용 프로토타입입니다. 실제 재난용 안내 시스템이나 실제 서울역 지도·안전성 판단 도구가 아닙니다.

## 기술 스택

- Python 3.11+
- FastAPI, Pydantic v2, Uvicorn
- 결정적 Dijkstra 동등 알고리즘(표준 라이브러리 heap 기반)
- pytest, FastAPI TestClient

## 설치 및 실행

### 백엔드

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

서버는 기본적으로 `http://127.0.0.1:8000`에서 실행됩니다. Swagger UI는 `http://127.0.0.1:8000/docs`, OpenAPI JSON은 `http://127.0.0.1:8000/openapi.json`입니다.

### 프론트엔드

```bash
cd frontend
cp .env.example .env  # 선택 사항: 기본 API 주소를 변경할 때만 사용
npm install
npm run dev
```

프론트엔드는 `http://localhost:5173`에서 확인합니다. 기본 API 주소는 `http://127.0.0.1:8000`이며 `VITE_API_BASE_URL` 환경변수로 변경할 수 있습니다. 실제 `.env`는 Git에 포함하지 않습니다.

백엔드와 프론트엔드는 각각 별도 터미널에서 실행해야 합니다. 현재 화면은 최종 제품 UI가 아니라 지도 선택, 시작점·시나리오 선택, 계산·비교 API와 SVG 렌더링을 검증하는 개발용 화면입니다.

## 테스트

```bash
cd backend
python -m pytest

cd ../frontend
npm run test
npm run build
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

프론트엔드 내부 구조와 교체 지점은 [프론트엔드 연동 문서](docs/FRONTEND_INTEGRATION.md), 검증 결과는 [프론트엔드 테스트 결과](docs/FRONTEND_TEST_RESULTS.md)를 참고하세요.
