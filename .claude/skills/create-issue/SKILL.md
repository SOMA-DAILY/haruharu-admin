---
description: GitHub 이슈 생성. 기능(feat)·버그(fix)·기술작업(chore/refactor) 타입을 감지해 형식에 맞게 생성. 새 작업 시작 전 호출.
when_to_use: 사용자가 "이슈 생성/만들어/파줘", "이슈 먼저" 등 이슈 생성을 요청하거나, 구현 요청에 이슈가 없을 때 자동 제안.
argument-hint: "[이슈 설명]"
allowed-tools: Bash(gh issue create *) Bash(gh issue list *) Bash(gh label list *) Bash(gh label create *) Bash(cat *)
---

## 언제 쓰나?

- 이슈 없이 구현 요청이 들어왔을 때 (항상 코드 전에 이슈 먼저)
- 사용자가 직접 `/create-issue` 입력 시
- **이 스킬 완료 후 → 구현 시작 (게이트 3)**

## 실행 절차

### Step 1. 타입 감지

사용자 설명(`$ARGUMENTS`)을 분석해 타입 결정:
- `fix` → "오류/에러/버그/안됨/실패" 포함 시
- `feat` → "화면/기능/추가/구현/연동/만들어" 포함 시
- `chore` or `refactor` → "리팩토링/설정/분리/정리/의존성" 포함 시

불명확하면 사용자에게 확인.

### Step 2. 이슈 제목 생성

`.claude/rules/git-conventions.md` 형식 준수:
```
{tag}: {설명}
```
예) `feat: 세션(방) 목록 화면 + rooms API 연동`

사용자 확인 후 진행.

### Step 3. 이슈 본문 작성

**feat 타입:**
```
## ✨ 기능/화면 설명
{설명}

## 📌 배경 및 목적
{배경}

## 🖼️ 대응 목업 / 화면
- admin-{...}-mockup.html

## 🔌 연동 API (명세 기준)
-

## 📝 작업 내용
- [ ]
- [ ]
```

**fix 타입:**
```
## 🐛 버그 설명
{설명}

## 🔁 재현 방법
1.

## ✅ 기대 / ❌ 실제
기대:
실제:
```

**chore/refactor 타입:**
```
## 📌 작업 내용
{설명}

## 🔄 AS-IS / TO-BE
AS-IS:
TO-BE:
```

본문 초안을 보여주고 수정 여부 확인.

### Step 4. GitHub 이슈 생성

라벨 매핑: `feat`→`feature`, `fix`→`bug`, `chore/refactor`→`task`.
라벨이 없으면(`gh label list`) 생성하거나 라벨 없이 진행.

```bash
gh issue create --title "{tag}: {설명}" --label "{label}" --body "{본문}"
```

### Step 5. 완료 보고

생성된 이슈 URL·번호 출력 → "이제 #{번호} 구현을 시작할까요?"
