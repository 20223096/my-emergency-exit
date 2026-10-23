# 프론트엔드 테스트 결과

검증일: 2026-10-23 (Asia/Seoul)

## 자동화 테스트

```bash
cd frontend
npm run test
```

결과: **3개 테스트 파일, 15개 테스트 전체 통과**

검증 항목:

- 지도 데이터 로딩과 지도/시나리오 API 실패 처리
- 404, 422, 500과 네트워크 오류 분류
- 노드·간선 SVG 렌더링
- 기본/변경 경로의 Edge ID 기반 강조
- 차단 통로, 폐쇄 출구, 혼잡 지연, 선택 시작점 표시
- A12/A17 독립 곡선 렌더링과 일방향 화살표
- 층 필터
- 지도·시작점·사전 시나리오 선택
- 비교 API 요청 조건과 응답 반영
- `reachable=false` 경로 없음 표시

백엔드에서는 `python3 -m pytest` 실행 결과 **31개 테스트 전체 통과**를 유지했습니다.

## 빌드

```bash
cd frontend
npm run build
```

TypeScript 프로젝트 빌드와 Vite production build가 성공했습니다. 생성된 `dist/`는 `.gitignore`로 제외합니다.

## 실제 연동과 프리뷰

- 실행 중인 FastAPI의 health, maps, scenarios, calculate, compare 엔드포인트가 정상 응답함을 확인했습니다.
- Swagger UI와 OpenAPI JSON은 HTTP 200을 반환했습니다.
- Vite 개발 서버의 HTML 응답과 백엔드 CORS 허용 출처 `http://localhost:5173`을 확인합니다.
- 컴포넌트의 실제 DOM/SVG 렌더링은 jsdom 기반 React Testing Library로 검증했습니다.

이 실행 환경에는 사용자 화면을 조작하는 브라우저 도구가 없어 실제 브라우저 클릭·육안 검증은 수행하지 못했습니다. 개발 서버 HTTP 확인과 자동화된 DOM/SVG 테스트 결과를 브라우저 육안 검증과 구분합니다.

## 알려진 제한사항

- 화면은 기획 UI 전의 개발용 테스트 도구이며 완성 디자인이 아닙니다.
- 개별 통로·출구·혼잡 값을 직접 편집하는 UI는 없고 사전 시나리오를 사용합니다.
- 여러 층을 전체 보기에서 함께 표시할 때 실제 평면 관계를 의미하지 않습니다.
- 마우스 hover의 SVG `<title>` 외에 상세 팝오버는 구현하지 않았습니다.
- 실시간 위치, 군중 시뮬레이션, 실제 재난 안전성 판단은 범위 밖입니다.
