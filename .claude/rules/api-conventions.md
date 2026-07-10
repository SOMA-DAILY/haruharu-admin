# API 연동 규약

> 출처: 노션 "어드민 API 명세 (프런트 연동용)". 어드민 서버(`haruharu-BE`의 `admin` 모듈)와 계약.
> API 연동 코드(`src/api/**`, 화면의 데이터 페칭)를 작성·수정할 때 항상 확인한다.

## 계약 요약

- **Base URL**: `${VITE_API_BASE_URL}/api/v1/admin` — 유저 API 서버와 **다른 배포**(도메인/포트 분리).
- **인증**: `Authorization: Bearer {admin_access_token}`. 유저 JWT와 **다른 토큰**(시크릿 분리, 상호 불통).
- **직렬화**: 응답 바디 필드는 **snake_case**. ⚠️ **쿼리 파라미터명은 camelCase**(예: `scheduledDate`).
- **페이지네이션**: `page`(0-based, 기본 0) · `size`(기본 20, 최대 100). 응답에 `page` 메타 포함.
- **응답 래퍼**: 전 엔드포인트 `{ isSuccess, data, error }`.

## 지켜야 할 것

1. **응답 타입은 snake_case 그대로 둔다.** (`src/api/types.ts`) 임의로 camelCase 변환하지 말 것 — 명세와 1:1 유지가 디버깅에 유리. 표시용 가공은 컴포넌트에서.
2. **쿼리 파라미터는 camelCase.** (`scheduledDate`, `keyword` 등) 응답과 케이스가 다르다는 점을 혼동하지 말 것.
3. **래퍼 언랩은 인터셉터 한 곳에서만.** `src/api/client.ts`가 `{isSuccess,data}`를 벗겨 `data`만 반환한다. 개별 호출부에서 다시 벗기지 말 것.
4. **에러는 `ApiError`(code, message)로 통일.** 401은 인터셉터가 토큰 폐기 + `/login` 리다이렉트를 처리한다.
5. **엔드포인트 추가 시**: `types.ts`(타입) → `endpoints.ts`(호출) → `queries.ts`(React Query 훅) 순으로 계층 유지.
6. **enum 값**은 명세 그대로 대문자 상수(`ACTIVE`, `APP_STORE` 등). 표시 라벨/색은 `components/StatusTag.tsx`에서 매핑.

## 아직 없는 필드/화면 (백엔드 후속)

명세에 "후속"으로 표기된 것은 UI에서 **placeholder/안내 배너**로 처리하고, 있는 것처럼 가짜로 채우지 않는다.
- 유저 성별·나이·본인인증(identity 도메인) · 정지/환불/코인조정(쓰기) · 신고·미션검수 · 대시보드 추세차트(`/dashboard/metrics`)

## 명세 변경 시

노션 명세가 갱신되면 `types.ts`·`endpoints.ts`를 먼저 맞추고, 영향받는 화면을 확인한다.
불일치(명세엔 있는데 서버가 안 주거나 반대)는 추측하지 말고 백엔드에 확인.
