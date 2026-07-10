# 하루하루 운영 어드민 (haruharu-admin)

하루하루 어드민 서버(`/api/v1/admin/**`)를 위한 운영자용 웹 콘솔.
Vite + React + TypeScript + Ant Design.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 타입체크 + 프로덕션 빌드
```

## 환경변수

`.env`

| 키 | 설명 | 기본값 |
|---|---|---|
| `VITE_API_BASE_URL` | 어드민 서버 오리진 (유저 API 서버와 별도) | `http://localhost:8080` |

클라이언트는 `${VITE_API_BASE_URL}/api/v1/admin` 을 baseURL로 사용.

## API 연동 규약 (노션: 어드민 API 명세 프런트 연동용)

- **인증**: `Authorization: Bearer {admin_access_token}` (유저 JWT와 다른 토큰)
- **직렬화**: 응답 바디는 **snake_case**, 쿼리 파라미터는 **camelCase** (예: `scheduledDate`)
- **응답 래퍼**: `{ isSuccess, data, error }` — `src/api/client.ts` 인터셉터가 `data`만 언랩
- **페이지네이션**: `page`(0-based) · `size`(기본 20, 최대 100)
- **401**: 토큰 폐기 후 `/login` 리다이렉트

## 구조

```
src/
  api/         client(axios)·types·endpoints·queries(react-query)
  auth/        AuthContext·ProtectedRoute
  config/      nav (사이드바 항목)
  layout/      AdminLayout (사이드바 + PageHeader)
  components/  StatusTag 등 공용
  pages/       화면별 컴포넌트
  theme.ts     antd 테마 (목업 디자인 토큰)
```

## 화면 ↔ 목업 ↔ API 매핑

| 라우트 | 목업 | API | 상태 |
|---|---|---|---|
| `/login` | admin-login | `POST /auth/login` | ✅ 연동 |
| `/` | admin-dashboard | `GET /dashboard/summary` | ✅ 연동 (추세 차트는 후속) |
| `/sessions`, `/sessions/:id` | admin-sessions / room-detail | `GET /rooms`, `/rooms/{id}` | ✅ 연동 |
| `/users`, `/users/:id` | admin-users / user-detail | `GET /users`, `/users/{id}` | ✅ 연동 |
| `/iap`, `/iap/:id` | admin-iap / payment-detail | (이슈 6 후속) | ⏳ placeholder |
| `/audit` | admin-audit | (후속) | ⏳ placeholder |
| `/moderation` | admin-moderation | (이슈 7 후속) | ⏳ MVP 제외 |

placeholder 화면은 백엔드 API가 준비되면 전용 페이지로 교체.
