# Secret Policy: 시크릿 유출 방지 (프런트)

## 원칙

**실제 값을 가진 시크릿은 절대 git에 올리지 않는다.**
프런트 번들은 브라우저로 그대로 노출되므로, 애초에 **비밀키·토큰·크리덴셜을 소스/`.env`에 두지 않는다.**
환경 설정은 `.env`(git 미추적)에만 쓰고, 저장소에는 `.env.example`(플레이스홀더)만 커밋한다.

## 파일별 git 허용 정책

| 파일 | git 허용 | 이유 |
|------|---------|------|
| `.env.example` | O | 플레이스홀더/기본값만 |
| `.env` | X | 실제 값 포함 가능 |
| `.env.local`, `.env.*.local` | X | 로컬 실제 값 |
| `src/**` | O | 단, 하드코딩 시크릿 없어야 함 (아래 참조) |

## 허용/금지 패턴 예시

```ts
// GOOD — 환경변수 참조 (빌드 시 주입)
baseURL: `${import.meta.env.VITE_API_BASE_URL}/api/v1/admin`

// GOOD — 토큰은 런타임에 로그인으로 발급받아 localStorage 보관
tokenStore.set(access_token, refresh_token)

// BAD — 하드코딩 (커밋 차단)
const ADMIN_PASSWORD = 'P@ssw0rd!'
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
const apiKey = 'sk_live_abcd1234'
```

## ⚠️ 프런트 특유 주의

- `VITE_` 프리픽스 환경변수는 **빌드 시 클라이언트 번들에 그대로 박힌다.** 브라우저에서 누구나 볼 수 있으므로 **비밀값을 `VITE_`로 두지 말 것.** (base URL·공개 키 정도만 허용)
- 운영자 계정/비밀번호를 코드나 목 데이터에 남기지 말 것.
- 실제 액세스/리프레시 토큰 문자열을 로그·주석·테스트 픽스처에 붙여넣지 말 것.
- 스크린샷·목 데이터에 실제 유저 PII(실명·CI/DI·연락처)를 쓰지 말 것 → 가상 데이터 사용.

## 커밋 전 필수 체크리스트 (CRITICAL)

- [ ] `git diff --staged --name-only` 에 `.env`, `.env.local`, `.env.*.local` 없음 (`.env.example`만 허용)
- [ ] staged 변경에 하드코딩된 토큰(`eyJ...` JWT), 비밀번호, `sk_`/`api-key` 류 문자열 없음
- [ ] `VITE_*` 값에 비밀키·시크릿 없음 (공개 가능한 값만)
- [ ] 목 데이터/스크린샷에 실제 유저 PII 없음

위 항목 중 하나라도 위반 시 **커밋 차단** — `.githooks/pre-commit` 이 자동 감지한다.

## 훅 설치 (최초 1회)

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

## 유출 발생 시

1. 즉시 중단 · 팀 공유
2. 유출된 시크릿 즉시 rotate (토큰 폐기·재발급)
3. `git filter-repo` 또는 BFG Repo Cleaner로 git history에서 제거
