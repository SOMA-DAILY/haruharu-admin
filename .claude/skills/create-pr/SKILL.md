---
description: PR 컨벤션 검증 + PR 생성. 화면 구현 완료 후 호출. develop 브랜치 대상 PR 자동 생성.
when_to_use: 사용자가 "PR 생성/만들어/올려줘", "풀리퀘 만들어줘" 등 PR 생성을 요청하거나 구현 완료 후 커밋/PR을 요청할 때.
argument-hint: "[#이슈번호]"
allowed-tools: Bash(git status) Bash(git log *) Bash(git diff *) Bash(git add *) Bash(git commit *) Bash(git push *) Bash(git switch *) Bash(gh pr create *) Bash(gh pr view *) Bash(npm run build) Bash(cat *)
---

## 언제 쓰나?

- 구현 완료 후 커밋/PR 생성 시
- 사용자가 직접 `/create-pr #이슈번호` 입력 시
- 전제: `npm run build`(타입체크+빌드) 통과 + 화면 동작 검증 완료 상태

## 실행 절차

### Step 0. Secret Policy 확인 (필수)

`.claude/rules/secret-policy.md` 커밋 전 체크리스트를 먼저 통과한다.
`.env`/토큰/PII가 staged에 없는지 `git diff --staged` 로 확인. 위반 시 중단.

### Step 1. 빌드 확인

```bash
npm run build
```
실패 시 중단하고 사용자에게 보고.

### Step 2. 현재 상태 확인

```bash
git status
git log --oneline origin/develop..HEAD
git diff origin/develop...HEAD --name-only
```

### Step 3. 브랜치명 검증

`.claude/rules/git-conventions.md` 형식: `{tag}/{이슈번호}` (예: `feat/12`).
`main`/`develop`에서 직접 작업 중이면 새 브랜치로 옮기도록 안내.

### Step 4. 커밋 (미커밋 변경이 있으면)

커밋 메시지 형식: `[#{번호}]; {tag}: {설명}` (AI 공동 작성 표기 없이).

### Step 5. PR 제목·본문

제목: `[#{번호}]; {tag}: {설명}`
본문:
```markdown
## 📌 Related Issue
closes #{이슈번호}

## #️⃣ 요약
{커밋 기반 1-2문장}

## 📝 작업 내용
- [ ]

## 👍 동작 확인
- [ ] `npm run build` 통과
- [ ] dev 서버에서 화면 렌더링/동작 확인
- [ ] 기존 화면 회귀 없음

## 🖼️ 스크린샷 (선택)
```
사용자에게 본문 확인 요청.

### Step 6. PR 생성

```bash
git push -u origin {현재브랜치}
gh pr create --title "[#{번호}]; {tag}: {설명}" --body "{본문}" --base develop
```

### Step 7. 완료 보고

PR URL 출력. 네이밍 컨벤션 위반 있으면 함께 보고.
