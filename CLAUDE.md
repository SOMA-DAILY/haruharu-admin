# Haruharu Admin (운영 어드민 프런트)

## Tech Stack
Vite · React 19 · TypeScript · Ant Design(antd) · React Router · TanStack Query · axios · dayjs
어드민 서버(`/api/v1/admin/**`) 연동 전용 웹 콘솔. 소비자 앱(`haruharu-FE`)·백엔드(`haruharu-BE`)와 별도 레포.

---

## 작업 실행 게이트 (필수 — 절대 건너뛰지 않는다)

모든 구현 요청은 아래 4단계 게이트를 순서대로 통과한다. 각 단계는 **사용자 승인 후** 다음 단계로 넘어간다.

| 게이트 | 내 행동 | 사용자에게 묻는 것 |
|--------|---------|-----------------|
| 1. 계획 | 의도 파악 → 변경 범위·화면·API 정리해서 보여줌 | "이슈 생성할까요?" |
| 2. 이슈 | GitHub 이슈 생성 (`/create-issue`) | "구현 시작할까요?" |
| 3. 구현 | 코드 작성 → `npm run build`(타입체크+빌드) 통과 → 화면 동작 검증 | "커밋/PR 할까요?" |
| 4. 커밋·PR | `secret-policy` 확인 → 커밋 → PR 생성 (`/create-pr`) | — |

**금지 사항:**
- 사용자가 "만들어줘" 라고 해도 계획 없이 바로 코드 작성 금지
- 이슈 없이 구현 시작 금지
- 구현 완료 후 사용자 승인 없이 바로 커밋/PR 금지
- 이전에 승인받은 단계라도 새 대화에선 현재 단계 다시 확인

---

## 상황 → 스킬 라우팅

| 상황 | 실행 | 참고 규칙 |
|------|------|---------|
| 이슈 없이 "만들어줘" 요청 | `/create-issue` → 구현 | git-conventions |
| 새 화면/기능 구현 | 계획 → 이슈 → 구현 → 검증 | ui-conventions · api-conventions |
| API 연동 코드 작성·수정 | 명세 규약 확인 | api-conventions |
| 화면 동작 확인 | dev 서버 + 스크린샷 검증 | - |
| PR 생성 | `/create-pr #이슈번호` | git-conventions |
| 커밋·PR 생성 전 | `secret-policy` 체크리스트 확인 필수 | secret-policy |

> 이슈 없이 구현 요청 들어오면 **무조건 `/create-issue` 먼저.**

---

## Rules

| 파일 | 적용 시점 |
|------|---------|
| [secret-policy](.claude/rules/secret-policy.md) | 커밋·PR 생성 전 필수 확인 |
| [git-conventions](.claude/rules/git-conventions.md) | 커밋·브랜치·PR 생성 시 |
| [api-conventions](.claude/rules/api-conventions.md) | 어드민 API 연동 코드 작성·수정 시 |
| [ui-conventions](.claude/rules/ui-conventions.md) | 화면/컴포넌트 작성 시 |

---

## API 연동 요약 (상세: api-conventions)

- Base URL: `${VITE_API_BASE_URL}/api/v1/admin` — 유저 API 서버와 다른 배포
- 인증: `Authorization: Bearer {admin_access_token}` (유저 JWT와 다른 토큰)
- 응답 바디 **snake_case** / 쿼리 파라미터 **camelCase**
- 응답 래퍼 `{ isSuccess, data, error }` — `src/api/client.ts` 인터셉터가 `data`만 언랩
- 명세 출처: 노션 "어드민 API 명세 (프런트 연동용)"

---

## 참고 문서

| 용도 | URL |
|------|-----|
| Claude Code Skills 공식 문서 | https://code.claude.com/docs/ko/skills |
| Ant Design 컴포넌트 | https://ant.design/components/overview |
| TanStack Query | https://tanstack.com/query/latest |
