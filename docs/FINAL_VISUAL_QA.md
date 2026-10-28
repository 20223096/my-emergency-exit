# 최종 결과 화면 및 Figma 정밀 QA

검증일: 2026-10-28 (Asia/Seoul)  
Figma: `VpZTcGIDFsrcvzAHonOvIC`, 화면 `19:102106`, 지도 `19:101593`, 패널 `26:639`  
브라우저: Playwright + 로컬 Google Chrome, desktop 1440×900 / mobile 390×844

## 결과 상태 캡처

| 상태 | 캡처 | API와 화면 |
|---|---|---|
| S3 기본 완료 | `screenshots/final-results/01-s3-baseline.png` | 11번, 56m, 52.5초 일치 |
| S3 화재 A | `02-s3-fire-a.png` | 11번→12번, 60m, 55.833초 일치 |
| S3 화재 B | `03-s3-fire-b.png` | 11번→13번, 66m, 61.667초 일치 |
| 11번 출구 폐쇄 | `04-exit-11-closed.png` | 12번, 60m, 55.833초 일치 |
| 계단 A+B 차단 | `05-unreachable-stairs-a-b.png` | API null 거리/시간, UI 미표시 일치 |
| 완료 후 조건 변경 | `06-condition-changed.png` | 이전 결과 및 scenario overlay 0개 |
| 입력 오류 | `07-input-error.png` | 필드 오류, 비교 버튼 disabled |
| API 오류 | `08-api-error.png` | server 오류와 다시 시도 구분 |
| 다시 시도 성공 | `09-api-retry-success.png` | HTTP 200 후 화재 A 결과 복구 |
| 모바일 화재 A | `10-mobile-fire-a-390x844.png` | body 390px, 지도 내부 680px 스크롤 |

기계 판독 가능한 API/DOM 비교와 overlay 개수는 `docs/FINAL_VISUAL_QA.json`에 보존했다.

## Figma와 일치한 실측값

| 항목 | Figma | Chrome 실측 | 차이 |
|---|---:|---:|---:|
| 작업 프레임 최대 폭 | 1303px | 1303px | 0 |
| 지도 열 | 800px | 800px | 0 |
| 우측 열 | 416px | 416px | 0 |
| 열 간격 | 34px | 34px | 0 |
| 지도 canvas 높이 | 492px | 492px | 0 |
| 완료 조건 패널 | 144px | 144px | 0 |
| 결과 카드 폭 | 380px | 380px | 0 |
| panel/card radius | 12px | 12px | 0 |
| card padding | 12px 24px | 12px 24px | 0 |

색상도 조건 경로 `#3E5AF4`, 선택 출구 `#02A67C`, 차단 `#EF4452`, panel `#F7F7F7`을 유지한다. 기본 경로는 회색 점선, 조건 경로는 파란 실선이며 API의 `path_edges`와 동일한 SVG edge ID에만 그려진다.

## 남은 차이와 판단

- 결과 카드 높이: Figma 92px, 실제 104px(+12px). 실제 UI는 `도달 가능/경로 없음`, “이동거리/모의 이동시간” 레이블을 명시해 해석과 접근성을 높인다. 의도적 차이이다.
- 결과 패널 높이: Figma 317px, 실제 403px. 실제 change reason과 명시적 metric label 때문에 늘었다. 기능 데이터 손실을 피하기 위한 의도적 차이이다.
- Figma는 공식 안내도 이미지를 40% opacity로 사용하지만, 현재 그래프와 좌표 정합이 검증되지 않았다. 정확히 겹친 것처럼 오인시키지 않기 위해 계산 그래프만 사용한다. 의도적 안전 차이이다.
- Figma 예시 수치(54m/118m 등)는 목업이므로 API 결과로 대체한다. 의도적 기능 차이이다.
- 모바일은 Figma 전용 프레임이 없다. desktop 구조를 한 열로 재배치하고 지도만 내부 수평 스크롤한다. 문서 전체 overflow는 0px이다.

## 폰트

- Pretendard `1.3.9`: 제작자 공식 `pretendard` npm 패키지의 variable WOFF2/CSS를 번들 import.
- 42dot Sans variable: `@fontsource-variable/42dot-sans` 패키지의 WOFF2와 OFL 파일을 번들 import.
- 두 글꼴 모두 SIL Open Font License 1.1이며 웹 임베딩과 앱 번들이 허용된다.
- Chrome computed style에서 기본 UI는 `Pretendard Variable`, 결과 카드/토글/텍스트 버튼은 `42dot Sans Variable`로 확인했다.
- 개인 컴퓨터 설치 폰트에는 의존하지 않는다.

## 기능 QA

- 재난 변경과 계산 버튼 활성/비활성: 통과.
- 로딩 중 버튼 disabled 및 강제 두 번째 클릭에도 요청 1회: 통과.
- 조건 변경 시 결과와 overlay 제거: 통과.
- API 오류/도달 불가 표현 분리 및 retry 200 복구: 통과.
- 재난 전 참고 경로/조건 경로 동시 표시: 통과.
- 각 API `path_edges` 6개와 browser baseline/scenario overlay 6개 일치; 도달 불가는 scenario overlay 0개.
- 모바일: `body.scrollWidth=390`, viewport 390, `.map-viewport.scrollWidth=680`; 페이지 overflow 없이 지도만 스크롤.

## 한계

실측 거리, 공식 비상구 판정, 공식 안내도-그래프 좌표 정합, 실제 군중 데이터는 확보되지 않았다. 따라서 실제 안전성·골든타임·생존율·군중 예측 결과로 해석할 수 없다.

