# UI / 컴포넌트 규약

> 화면·컴포넌트를 작성할 때 확인. 목업(`../admin-*-mockup.html`)이 기준 디자인이다.

## 원칙

- **목업을 기준으로 구현한다.** 새 화면은 대응하는 `admin-*-mockup.html`을 먼저 확인.
- **antd 컴포넌트를 우선 사용한다.** 커스텀 마크업/CSS는 antd로 안 되는 경우에만.
- **디자인 토큰은 `src/theme.ts`에서만.** 색상 하드코딩 대신 테마 토큰/`colors` 사용. 목업 색을 임의 변경하지 말 것.

## 구조

```
src/
  pages/       라우트별 화면 (한 파일 = 한 화면)
  layout/      AdminLayout(사이드바) · PageHeader
  components/   재사용 컴포넌트 (StatusTag 등)
  config/nav   사이드바 항목 (라우트·그룹·배지·비활성 태그)
```

- 화면 상단 타이틀은 `PageHeader`(layout) 사용 — 직접 만들지 말 것.
- 사이드바에 항목 추가/변경은 `config/nav.tsx` 한 곳에서. 라우트는 `App.tsx`와 짝을 맞춘다.
- enum 표시(상태 태그 등)는 `components/StatusTag.tsx`에 모은다.

## 데이터 화면 필수 상태 처리

목록/상세 화면은 아래 상태를 **모두** 다룬다(빈 화면 방치 금지):
- 로딩: `Skeleton` / `Table loading`
- 에러: `Alert`(조회 실패 안내)
- 빈 데이터: `Empty`
- null 필드: `-` 또는 `미설정` 태그 (명세상 nullable 필드 많음 — 항상 방어)

## 텍스트

- UI 문구는 한국어. 날짜는 `dayjs`로 포맷(`YYYY-MM-DD HH:mm` 등).
- 운영자 대상 화면이므로 용어는 명세/도메인 용어(세션·방·매칭큐·열쇠 등)를 따른다.

## 검증

새 화면은 커밋 전 **dev 서버로 실제 렌더링을 확인**한다(빌드 통과만으로 끝내지 않음).
