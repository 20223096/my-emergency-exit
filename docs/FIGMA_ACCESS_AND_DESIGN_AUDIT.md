# Figma 접근 및 디자인 감사

## 접근 결과

- 확인일: 2026-10-28 (Asia/Seoul)
- 파일: `VpZTcGIDFsrcvzAHonOvIC`, 대상 노드 `16:592`
- 인증: `mcp__figma__whoami` 성공 — `won10201@kookmin.ac.kr`
- 세션: `mcp__figma__create_session` 성공
- `mcp__figma__get_metadata`: 성공
- `mcp__figma__get_design_context`: 성공. 상위 section은 sparse 응답이어서 실제 화면 `19:102106`, 지도 `19:101593`, 패널 `26:639`을 각각 재조회함.
- `mcp__figma__get_screenshot`: 성공 — 원본 화면 1303×755
- `mcp__figma__get_variable_defs`: 성공
- 이번 실행에는 권한 오류가 없었으므로 실패 도구/오류 메시지는 없음.

## 확인한 실제 디자인 값

| 항목 | Figma 값 | 코드 반영 |
|---|---:|---|
| 실제 작업 프레임 | 1303×755 | `.app-shell` 최대 1303px |
| 지도 열 | 800px | desktop grid 800px |
| 우측 패널 | 416px | desktop grid 416px |
| 열 간격 | 34px | grid gap 34px |
| 지도 본문 | 800×492px | canvas 높이 492px |
| 패널 간격 | 12px | side column gap 12px |
| 카드 모서리 | 12px | panel/result/map radius 12px |
| 패널 padding | 12px | panel padding 12px |
| 제목 | Pretendard Variable Bold, 24px, line-height 1.334 | 24px 패널 제목 및 Pretendard 우선순위 |
| 본문/컨트롤 | Pretendard Variable Medium 13–15px, 일부 42dot Sans | 폰트 fallback과 크기 계층 반영 |
| 조건 경로 | `#3E5AF4`, 배경 `#F3F5FF` | `--blue`, scenario card |
| 선택 출구 | `#02A67C` | `--green` |
| 차단 | `#EF4452` | `--red` |
| 일반 레이블 | `#171719` | 기본 글자색 |
| 패널 배경 | `#F7F7F7` | panel/legend |
| 기본 경로 | 회색 점선 | SVG baseline overlay |
| 조건 경로 | 파란 실선 | SVG scenario overlay |

원본은 Pretendard Variable과 42dot Sans를 혼용한다. 저장소에는 웹폰트 파일이 없으므로 CSS font stack만 동일하게 지정하며, 설치되지 않은 환경에서는 Noto Sans KR/system font로 대체된다.

## 반영 판단

- 원본의 지도/패널 비율, 결과 카드, 경로 토글, 색상과 spacing을 반영했다.
- Figma의 서울역 공식 안내도 이미지는 좌표가 계산 그래프와 정합됐다는 증거가 없으므로 코드 배경으로 가져오지 않았다. 현재 SVG는 계산 그래프만 표시하고 설명 문구로 공식 안내도와 구분한다.
- Figma 스크린샷은 시각 비교 기준으로만 사용했으며 제품 코드에 삽입하지 않았다.
- Figma 예시의 `54m`, `118m`, `60초`, `123.3초`는 목업 값이므로 하드코딩하지 않고 API 결과만 표시한다.

## 반응형 확인

- 1440×900/1280×800: 800px 지도와 최대 416px 패널을 유지하며 좁은 desktop에서는 열 폭을 유연하게 축소한다.
- 390×844: 패널은 지도 아래 한 열로 이동한다. 그래프 가독성을 위해 지도 canvas만 680px로 유지하고 해당 viewport 내부에서 수평 스크롤한다. 페이지 전체의 의도치 않은 가로 overflow는 만들지 않는다.

