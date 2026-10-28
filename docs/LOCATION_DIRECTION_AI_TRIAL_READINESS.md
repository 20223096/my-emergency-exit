# 위치·방향 확인 AI 소규모 시험 준비

작성일: 2026-10-28  
기준 커밋: `ae941e132cd6325b03d127fdb0ef42a34c642104`  
상태: **평가 도구·계약 준비 완료 / 실제 이미지·모델·추론·평가 결과 없음 (`not_run`)**

## 1. 범위와 안전 경계

이 도구는 촬영 허가를 받고 개인정보가 없다고 검토된 이미지에 대해 외부 모델의 후보 출력을 평가하기 위한 오프라인 도구다. 이미지를 읽거나 AI 추론을 실행하지 않는다. 실험 장소의 `location_id`는 실험 라벨이며, 검증 없이 `C_CENTER`, `P_SOUTH`, `C_EAST`, `C_WEST` 같은 서울역 프로토타입 그래프 노드와 동일시하지 않는다.

개인정보가 포함되거나 포함 여부가 불명확한 사진은 매니페스트에 추가하지 않는다. 검증기는 각 레코드에 다음 두 조건을 요구한다.

- `permission_status = APPROVED_FOR_EVALUATION`
- `privacy_review_status = CLEARED_NO_PERSONAL_DATA`

도구는 이미지 내용을 자동 판별하지 못한다. 위 값은 권한 담당자와 검토자가 확인한 뒤 기록해야 하며, 거짓 선언을 기술적으로 탐지한다는 뜻이 아니다.

## 2. 산출물 구조

```text
experiments/location_direction_ai/
├── contracts/
│   ├── dataset_manifest.schema.json
│   └── prediction_output.schema.json
├── examples/
│   ├── dataset_manifest.template.json
│   ├── dataset_record.example.json
│   └── predictions.template.json
├── tests/test_trial_contract.py
├── trial_contract.py
├── validate_dataset.py
└── evaluate_predictions.py
```

JSON Schema는 도구 간 계약 문서이고, 실행 검증은 외부 패키지가 필요 없는 `trial_contract.py`가 담당한다.

## 3. 데이터 규격

| 필드 | 의미와 검증 규칙 |
|---|---|
| `image_id` | 데이터셋 내 고유 ID. 파일명이나 사람 식별자를 사용하지 않는다. |
| `image_path` | 매니페스트 기준 안전한 상대경로. jpg/jpeg/png/webp만 허용한다. 저장소 템플릿에는 실제 이미지를 포함하지 않는다. |
| `location_id` | 실험 장소 라벨. 목록 밖 장소는 `OUT_OF_SCOPE`. 그래프 노드 ID와의 대응은 별도 현장 검증 전 금지한다. |
| `facing_direction` | 실험별 통제 방향 ID. `DIRECTION_01` 또는 검증된 outgoing-edge 대응표의 ID를 사용한다. |
| `capture_session_id` | 연속 촬영 세션 ID. 한 세션이 REFERENCE와 TEST에 동시에 들어가면 검증 실패한다. |
| `reference_or_test` | `REFERENCE` 또는 독립 검증용 `TEST`. |
| `human_verified` | 위치·방향을 사람이 확인했을 때만 `true`; 평가에는 true만 허용한다. |
| `permission_status` | `APPROVED_FOR_EVALUATION/PENDING/REJECTED`; 평가에는 승인 상태만 허용한다. |
| `privacy_review_status` | 개인정보 없음 검토가 완료된 `CLEARED_NO_PERSONAL_DATA`만 허용한다. |
| `quality_flags` | `BLUR`, `LOW_LIGHT`, `OCCLUSION`, `PARTIAL_SIGNAGE`, `GLARE`, `MOTION_BLUR`, `OUT_OF_SCOPE`, `NONE`. |

빈 템플릿은 유효하지만 평가할 TEST 레코드가 없으므로 결과가 `not_run`이다. `dataset_record.example.json`은 필드 작성 예시일 뿐 실제 데이터셋이나 이미지가 아니다.

검증 명령:

```bash
python3 experiments/location_direction_ai/validate_dataset.py \
  experiments/location_direction_ai/examples/dataset_manifest.template.json
```

실제 파일 존재까지 확인하려면 `--require-files`를 추가한다. 승인된 이미지는 저장소에 자동 복사되지 않으며 보관 위치·접근 권한·파기 정책을 별도로 따라야 한다.
도구 폴더의 `.gitignore`는 `approved-images/`, `images/`, `evaluation-output/`을 제외해 사진과 평가 원시 출력이 실수로 커밋되는 것을 줄인다. 이는 접근통제나 개인정보 보호조치를 대신하지 않는다.

## 4. AI 후보 출력 계약

`prediction_output.schema.json`은 다음을 요구한다.

- 실행 상태: `not_run` 또는 `completed`
- 모델 식별자와 버전: 완료된 실행에 필수
- 내림차순 `location_candidates`와 `direction_candidates`
- `decidable`과 판단 보류 사유
- confidence 점수 종류, 의미 검증 여부와 검증 메모

판단 보류 사유는 `LOW_CONFIDENCE`, `AMBIGUOUS_TOP_CANDIDATES`, `OUT_OF_SCOPE`, `POOR_IMAGE_QUALITY`, `MODEL_ERROR`, `UNSUPPORTED_INPUT`이다. 모델이 없으면 템플릿처럼 `run_status=not_run`, `model=null`, `records=[]`를 사용한다. 평가기가 후보 값을 생성하거나 보완하지 않는다.

## 5. 평가 지표와 분모

| 지표 | 계산 정의 |
|---|---|
| 위치 top-1 정확도 | in-scope TEST 전체 중 정답 위치가 첫 후보인 비율. 판단 보류는 오답으로 남는다. |
| 위치 top-k 정확도 | in-scope TEST 전체 중 정답 위치가 앞 k개 후보에 포함된 비율. |
| 방향 정확도 | in-scope TEST 전체 중 확정된 첫 방향이 정답인 비율. 판단 보류는 오답으로 남는다. |
| 판단 보류율 | 전체 TEST 중 `decidable=false` 비율. |
| 잘못된 위치 확정률 | 확정한 전체 입력 중 위치가 틀린 비율. 목록 밖 장소를 위치로 확정한 경우도 포함한다. |
| 높은 신뢰도의 오분류 | 검증된 점수 의미와 사전 고정 임계값이 모두 있을 때만 건수 계산. 아니면 `not_computed`. |
| 목록 밖 장소 거부 성능 | `OUT_OF_SCOPE` TEST 중 판단 보류한 비율. |

confidence가 확률인지 유사도인지, 범위·정렬 방향·보정 방식이 무엇인지 모델 문서와 검증 데이터로 확인하기 전에는 임계값을 설정하지 않는다. `confidence_semantics.verified=false`인데 `--high-confidence-threshold`를 넘기면 평가기는 실패한다.

평가 명령:

```bash
python3 experiments/location_direction_ai/evaluate_predictions.py \
  --dataset experiments/location_direction_ai/examples/dataset_manifest.template.json \
  --predictions experiments/location_direction_ai/examples/predictions.template.json \
  --top-k 2
```

현재 템플릿 실행 결과는 실제 모델이 없으므로 `status: not_run`이다.

## 6. QR·수동 선택 비교 기준

세 방식은 입력 정보가 다르므로 단일 정확도 표만으로 우열을 판단하면 불공정하다.

| 방식 | 입력 정보 | 필요한 인프라 | 대표 실패 |
|---|---|---|---|
| 이미지 AI | 장면 픽셀과 학습된 참조 이미지 | 모델·카메라·참조 데이터 | 유사 장소, 가림, 저조도, 범위 밖 고신뢰 오답 |
| QR | 마커에 직접 인코딩된 위치/방향 ID | 현장 마커 설치·유지 | 훼손, 접근 불가, 잘못 부착, 스캔 실패 |
| 수동 선택 | 사용자의 표지·장소 이해와 후보 목록 | 이해 가능한 UI·현장 표지 | 후보 혼동, 잘못된 자기 위치 판단 |

공정한 비교는 다음 두 층으로 나눈다.

1. **같은 사용자 과업 비교:** 같은 승인된 장소 집합, 같은 기기·조명·시간 제한, 같은 성공 정의(정답 위치+방향), 같은 재시도 횟수로 완료율·오답·보류·소요시간을 비교한다.
2. **운영 조건 비교:** QR 설치/유지 비용, AI 참조 이미지 갱신 비용, 수동 후보 교육 부담을 별도 기록한다. QR이 정답 ID를 직접 제공한다는 정보 우위를 숨기지 않는다.

AI는 QR이 없는 상황의 보조 가능성을, QR은 설치된 환경의 결정적 식별 기준을, 수동 선택은 추가 인프라 없는 기준을 각각 보고한다. AI가 다른 방식보다 더 적은 정보를 받았다는 이유로 오류를 면제하거나, QR의 마커 정보를 AI 성능으로 간주하지 않는다.

## 7. 현재 경로 API의 START 제한 감사

제한은 Pydantic `RouteRequest` 필드 타입이 아니라 런타임 검증에서 발생한다.

1. `backend/app/models/schemas.py`의 `RouteRequest.start_node_id`는 일반 문자열이다.
2. `backend/app/core/routing.py::_validate_request`가 ID 존재를 확인한 뒤 `nodes[id].type != NodeType.START`이면 `RouteInputError`를 발생시킨다.
3. `backend/app/api/routes.py`가 이를 HTTP 422로 변환한다.
4. Dijkstra 초기 heap 자체는 요청 노드에서 시작할 수 있지만, 위 정책 검증 때문에 JUNCTION/STAIR/EXIT는 도달하지 못한다.

이 제한은 검증된 S1/S2/S3만 출발점으로 허용해 미확인 내부 노드가 사용자 위치처럼 사용되는 것을 막는다. 현재 `C_CENTER`, `P_SOUTH`, `C_EAST`, `C_WEST`는 `JUNCTION`이므로 AI 출력과 이름이 같더라도 직접 경로 요청에 사용할 수 없다.

## 8. 향후 분기점 재탐색에 필요한 변경사항

이번 작업에서는 아래 변경을 구현하지 않았다.

- API: `start_node_id`의 허용 타입 정책 또는 별도 `current_node_id` 계약, 위치 출처·사람 확인·모델 버전 필드 정의
- 그래프: 노드별 `allowed_as_origin`, 현장 검증 상태, 위치 라벨 매핑 버전, 방향 간선 후보와 접근성 메타데이터
- 라우팅: JUNCTION/STAIR 시작 허용 범위, 시작점이 차단 경계에 있을 때의 규칙, 방향을 고려한 첫 간선 제한, 단방향·층·폐쇄 검증
- 비교 의미: “재난 전 참고 경로”를 같은 임의 노드에서 다시 계산할지, 기존 S1~S3 기준과 비교할지 결정
- 안전 흐름: AI 후보를 바로 사용하지 않고 top-k 확인, 고정 마커 교차확인, `ABSTAIN` 시 수동 선택으로 전환
- 테스트: 각 허용 노드의 정상/차단/도달 불가, 잘못된 방향 간선, 지도 버전 불일치, 미검증 노드 거부, 회귀 수치
- 프론트엔드: 현재 위치 확인 단계와 공식 안내 우선 문구. Figma 변경은 별도 승인 후 수행

그래프 알고리즘은 임의 노드 시작을 기술적으로 탐색할 수 있지만, 데이터의 실제 위치 대응과 정책이 먼저 검증되어야 한다. 단순히 START 타입 검사를 제거하는 것은 충분한 구현이 아니다.

## 9. 준비 상태

| 항목 | 상태 |
|---|---|
| 데이터·출력 JSON 계약 | 준비됨 |
| 승인·개인정보·세션 누수 검증 | 준비됨 |
| 평가 지표 계산기 | 준비됨 |
| 빈 템플릿 `not_run` 처리 | 준비됨 |
| 실제 승인 이미지 | 없음 |
| 실제 모델 및 confidence 의미 검증 | 없음 |
| 실제 AI 추론·성능 결과 | **not_run** |
| 경로 엔진 연결 | 감사만 완료, 미구현 |

