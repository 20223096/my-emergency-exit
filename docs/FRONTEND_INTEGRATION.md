# 프론트엔드 연동 구조

현재 `frontend/`는 기획 UI 확정 전에 API 계약과 SVG 경로 표시를 검증하기 위한 React + TypeScript 기반입니다. 최종 화면이 아니라 재사용 가능한 데이터·렌더링 계층과 개발용 테스트 화면을 제공합니다.

## 컴포넌트 구조

- `src/types/api.ts`: FastAPI Pydantic 모델과 동일한 TypeScript 계약
- `src/api/client.ts`: API 주소, 상태 검사, JSON 처리와 구조화된 오류
- `src/api/routes.ts`: health, maps, scenarios, calculate, compare 호출 함수
- `src/hooks/useMapData.ts`: 지도 목록·시나리오·선택 지도 로딩 상태 관리
- `src/utils/mapGeometry.ts`: viewBox와 평행 간선 SVG 경로 계산
- `src/components/MapCanvas.tsx`: 상태 없는 SVG 지도 렌더러
- `src/App.tsx`: 임시 지도·시작점·시나리오 선택 및 계산/비교 화면

## API 연동

기본 주소는 `http://127.0.0.1:8000`이며 `VITE_API_BASE_URL`로 변경합니다. 응답이 404이면 `not_found`, 422이면 `validation`, 그 외 HTTP 오류는 `server`, fetch 실패는 `network`, JSON 해석 실패는 `invalid_response`로 구분합니다. 백엔드가 꺼져 있어도 오류 상태를 표시하고 React 화면은 유지됩니다.

프론트엔드 타입에는 `RouteResult`의 출구·거리·이동시간·총시간 `null` 가능성을 반영했습니다. 임의 응답 필드는 추가하지 않았습니다.

## 좌표와 층

`x`, `y`의 최솟값과 최댓값에 여백을 더해 SVG `viewBox`를 계산하고 컨테이너에 반응형으로 맞춥니다. 좌표는 상대 위치 표현에만 사용하며 거리와 시간은 API 응답값만 표시합니다. 전체 층 또는 단일 층을 선택할 수 있고 노드 라벨에 층을 표시합니다. 단일 층에서는 양 끝 노드가 해당 층에 있는 간선만 표시합니다.

## 경로 및 상태 시각화

모든 상태 판정은 노드 쌍이 아니라 ID로 수행합니다.

- 기본 경로: `baseline.path_edges`의 간선 ID
- 변경 경로: `scenario.path_edges`의 간선 ID
- 차단: `blocked_edge_ids`
- 폐쇄 출구: `blocked_exit_ids`
- 혼잡: `congestion_delays`의 간선 ID와 초
- 경로 없음: `reachable=false`를 별도 문구로 표시

간선과 노드에는 `<title>`을 제공해 ID, 길이, 방향, 층과 유형을 확인할 수 있습니다. 일방통행은 화살표 marker로 구분합니다.

## 평행 간선

같은 노드 쌍의 간선을 그룹화한 뒤 Edge ID 순서에 따라 서로 다른 이차 베지어 곡선 오프셋을 적용합니다. A12와 A17은 독립 SVG 요소이며, A12 차단이 A17 스타일에 영향을 주지 않습니다. 경로 강조도 `path_edges` ID를 사용합니다.

## 실제 지도 교체

노드·간선 JSON이 기존 API 스키마를 유지하면 프론트엔드 구조 변경은 필요 없습니다. 좌표 범위는 viewBox가 자동 처리합니다. 새로운 Node/Edge 유형을 추가할 경우 타입과 스타일만 보완해야 합니다.

## UI 초안 반영 시 변경 영역

최종 UI에서는 주로 `App.tsx`와 `styles.css`를 교체합니다. API 함수, 타입, `useMapData`, `MapCanvas`, 좌표 유틸리티는 재사용할 수 있습니다. 이후에는 사용자가 개별 간선·출구·혼잡 시간을 직접 편집하는 컨트롤, 모바일 접근성, 디자인 토큰과 제품 문구를 기획안에 맞춰 추가해야 합니다.
