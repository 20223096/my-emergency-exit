# 내비상구(My Emergency Exit)

서울역 4호선 일부 구역을 단순화한 그래프에서 기본 경로와 화재·혼잡 가정 이후의 경로를 비교하는 시연용 프로토타입입니다.

> 실제 서울역 구조, 공식 피난 출구 또는 안전한 피난 경로를 인증하지 않습니다. 거리와 계단·통로 연결은 실험용 가정을 포함하며 정밀 화재·연기·군중·행동 시뮬레이션이 아닙니다.

## 제출 범위

- 기존 가상 지도 `virtual-station-v1` 보존
- 서울역 프로토타입 `seoul-station-line4-prototype-v1`
- 출발점 S1/S2/S3와 10~14번 일반 출입구 후보
- 화재 A: 11번 출구 접근 통로 차단
- 화재 B: 승강장 주 계단 A 차단
- 계단 B 혼잡 지연 및 계단 A+B 동시 차단
- 단일 계산과 차단 전/후 비교 화면
- unreachable의 `null` 거리·시간 처리

## 기술 구성

- Backend: Python 3.11+, FastAPI, Pydantic v2, Uvicorn
- Routing: 표준 라이브러리 `heapq` 기반 결정적 Dijkstra 동등 구현
- Frontend: React, TypeScript, Vite, SVG
- Test: pytest, FastAPI TestClient, Vitest, Testing Library, jsdom

## 실행

터미널 1:

```bash
cd my-emergency-exit/backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

터미널 2:

```bash
cd my-emergency-exit/frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 연다. API는 기본적으로 `http://127.0.0.1:8000`을 사용한다. 다른 주소는 `frontend/.env`의 `VITE_API_BASE_URL`로 지정한다.

## 권장 시연 순서

1. 서울역 프로토타입 지도와 S3를 선택한다.
2. 기본 조건에서 `경로 계산`을 눌러 현재 조건 결과를 확인한다.
3. 화재 A를 선택하고 `기본 경로와 비교`를 누른다.
4. 화재 B를 선택하고 비교한다.
5. 화재 B 상태에서 `STAIR_B`에 20초 혼잡을 추가하고 비교한다.
6. `대피 경로 없음 테스트 · 계단 A+B 차단`을 선택해 unreachable을 확인한다.
7. 초기화 및 새로고침 후 기본 상태 복원을 확인한다.

상세 발표 절차는 [최종 시연 스크립트](docs/FINAL_DEMO_SCRIPT.md)를 따른다.

## 테스트

```bash
cd my-emergency-exit/backend
python3 -m pytest -q

cd ../frontend
npm test -- --run
npm run build
```

최종 QA 기준 백엔드 45개, 프론트엔드 24개, 총 69개 테스트와 프론트엔드 프로덕션 빌드가 통과했다.

## 주요 API

- `GET /api/health`
- `GET /api/maps`
- `GET /api/maps/{map_id}`
- `GET /api/scenarios`
- `POST /api/routes/calculate`
- `POST /api/routes/compare`

서울역 호출 계약은 [프론트엔드/API 계약](docs/FRONTEND_API_CONTRACT_SEOUL_STATION.md)을 참고한다.

## 제출 문서

- [최종 QA 및 테스트 결과](docs/FINAL_DEMO_TEST_RESULTS.md)
- [최종 시연 스크립트](docs/FINAL_DEMO_SCRIPT.md)
- [프로토타입 한계](docs/PROTOTYPE_LIMITATIONS.md)
- [서울역 범위와 근거](docs/SEOUL_STATION_PROTOTYPE_SCOPE.md)
- [서울역 API 계약](docs/FRONTEND_API_CONTRACT_SEOUL_STATION.md)
