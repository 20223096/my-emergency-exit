# 데모 및 제출 준비도

## 검증 결과

- Git 기준 시작점: `codex/figma-frontend-redesign` / `cbbb13c825eab65ddc45af71d6abd2a6a8049763`, 시작 시 clean.
- 백엔드: 45 passed.
- 프론트엔드: 27 passed (4 files).
- 총 자동 테스트: **72 passed**.
- 프론트 빌드: `tsc -b && vite build` 성공.
- 실제 HTTP: `GET /api/health` 200 `{"status":"ok"}`, Vite `/` 200, `POST /api/routes/compare` 성공.
- HTTP S3 화재 A 확인: 11번/56m/52.5초 → 12번/60m/55.833초.
- API 실패, 도달 불가, stale 결과 제거, 입력 오류는 Vitest에서 회귀 검증.

## 캡처

- `docs/screenshots/figma-ui-1440x900.png`
- `docs/screenshots/figma-ui-1280x800.png`
- `docs/screenshots/figma-ui-390x844.png`

Playwright는 설치되어 있지 않아 로컬 Google Chrome headless로 동일 viewport를 캡처했다. 캡처는 필수 재난 상황이 미입력된 초기 상태를 보여주며 계산 버튼 disabled, 경로 토글 disabled, desktop 800/416 배치, mobile 단일 열과 지도 내부 스크롤을 확인한다.

## 데모 순서

1. 서울역 프로토타입 지도를 선택하고 S1/S2/S3 기본 조건을 비교한다.
2. S3 화재 A에서 출구 11→12, 화재 B에서 11→13 변화를 설명한다.
3. `L4P01`에 0/10/20초 고정 지연을 입력해 “군중 예측이 아닌 사용자 가정값”임을 명시한다.
4. 평지/계단 속도와 출발 지연을 바꿔 거리와 시간의 다른 영향을 보여준다.
5. 11번 출구 폐쇄와 계단 A+B 차단으로 출구 변경/도달 불가를 확인한다.
6. 결과 뒤 조건을 바꿔 과거 경로가 즉시 사라지는 상태를 보여준다.
7. 잘못된 속도와 API 중단을 사용해 항목 오류 및 재시도를 보여준다.

## 제출 전 남은 한계

- 실측 거리, 공식 비상구, 실제 통행 가능성, 안내도-그래프 좌표 정합 데이터가 없다.
- Pretendard/42dot Sans 웹폰트 asset이 저장소에 없어 시스템 설치 여부에 따라 fallback된다.
- 결과 상태의 자동 브라우저 클릭 캡처는 Playwright 부재로 수행하지 않았고 컴포넌트 테스트와 실제 API POST로 분리 검증했다.
- SUMO/LEGION식 군중 시뮬레이션, 시간 재생, 인파 흐름 AI, 위치·방향 AI, AR은 후속 기술 시험 대상이다.

