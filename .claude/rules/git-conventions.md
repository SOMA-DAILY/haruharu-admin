# Git Conventions

> haruharu 조직 공통 컨벤션(`haruharu-BE`와 동일)을 어드민 프런트에도 적용한다.

## 브랜치 전략 (Git Flow 변형)

```
main        ← 운영 배포 (보호 브랜치)
develop     ← 개발/스테이징 (기본 브랜치)
feat/123    ← develop에서 분기
fix/456     ← develop에서 분기
hotfix/789  ← main에서 직접 분기 (긴급 수정만)
```

> 신규 레포라 `develop`이 없으면 최초 1회 생성: `git switch -c develop && git push -u origin develop` 후 GitHub 기본 브랜치를 `develop`으로 변경.

## 커밋 메시지 형식

```
[#이슈번호]; <tag>: <설명>
```

예시:
```
[#12]; feat: 세션(방) 목록 화면 + rooms API 연동
[#13]; fix: 유저 상세 코인 지갑 null 처리 누락 수정
[#14]; refactor: API 클라이언트 응답 언랩 인터셉터 분리
[#15]; chore: antd 테마 토큰 목업 기준 정리
```

## 허용 태그

| 태그 | 용도 |
|------|------|
| `feat` | 새 화면/기능 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 (동작 변경 없음) |
| `style` | 포맷팅/CSS (동작 변경 없음) |
| `docs` | 문서 |
| `chore` | 빌드/설정/의존성 |
| `perf` | 성능 개선 |
| `ci` | CI 설정 |
| `revert` | 커밋 되돌리기 |

## PR 제목 형식

```
[#이슈번호]; <tag>: <설명>
```

## 이슈 제목 형식

```
<tag>: <설명>
```

## 커밋 서명

커밋 메시지 마지막에 Claude 공동 작성 표기를 붙인다(하네스 규칙).
