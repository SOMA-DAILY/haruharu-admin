# 배포

어드민 프런트의 dev/prod 배포 구성과 절차. 계정 `049705857590`, 리전 `ap-northeast-2`(인증서만 `us-east-1`).

## 아키텍처

```
브라우저 ─https─> {dev-admin|admin}.haruharu.co.kr (CloudFront + S3)   ← 어드민 웹(SPA)
        ─https─> {dev-api|api}.haruharu.co.kr   (ALB → 어드민 서버)   ← API, 크로스오리진 직접 호출(CORS)
```

- 웹과 API는 **다른 오리진** → 어드민 서버 CORS `allowedOrigins` 에 웹 오리진 필요.
  - dev: `https://dev-admin.haruharu.co.kr` · prod: `https://admin.haruharu.co.kr`
- 둘 다 https → Mixed Content 없음.

## 인프라 (구성됨)

| 리소스 | dev | prod |
|---|---|---|
| S3 버킷(비공개) | `haruharu-admin-dev` | `haruharu-admin-prod` |
| CloudFront | `E1UHFEHEO4FRI` (`d2picum97efo33`) | `E2SFCSLB97Z3TY` (`d1qrng4o0aussk`) |
| 접속 도메인 | `dev-admin.haruharu.co.kr` | `admin.haruharu.co.kr` |
| ACM(us-east-1) | dev-admin | admin |
| API 주소 | `https://dev-api.haruharu.co.kr` | `https://api.haruharu.co.kr` |

공통: CloudFront OAC(비공개 버킷) · SPA 폴백(403·404→`/index.html` 200) · 기본 루트 `index.html` · Route53 A/AAAA Alias.

## CI/CD

- **CI** (`ci.yml`): PR(develop/main) 시 `lint` + `build`.
- **네이밍** (`naming-convention.yml`): 이슈/PR/브랜치명 컨벤션 강제.
- **CD** (`deploy.yml`):
  - **dev** — `develop` push(머지) 시 **자동**.
  - **prod** — Actions → **Deploy** → **Run workflow** → `environment=prod` **수동 실행**.
  - 공통 단계: `npm ci && npm run build`(`VITE_API_BASE_URL` 환경변수) → `aws s3 sync --delete` → CloudFront 무효화 `/*`.

### 인증 (키리스 · OIDC)

| 항목 | 값 |
|---|---|
| OIDC 공급자 | `token.actions.githubusercontent.com` |
| 배포 역할 | `gha-haruharu-admin-deploy` (repo `SOMA-DAILY/haruharu-admin` 신뢰) |
| 권한 | S3(dev·prod 버킷) put/delete/list + CloudFront 무효화(dev·prod 배포) |

### 변수 (Settings → Environments)

레포 공통: `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`.
환경별(dev/prod): `AWS_S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `VITE_API_BASE_URL`.

## prod 배포 절차

1. (선행) BE prod CORS `ADMIN_CORS_ALLOWED_ORIGINS`에 `https://admin.haruharu.co.kr` 포함 확인.
2. 배포할 코드가 있는 브랜치에서 GitHub → Actions → **Deploy** → **Run workflow** → `environment: prod`.
3. 완료 후 `https://admin.haruharu.co.kr` 확인.

## 로컬 개발

`.env` 에 `VITE_API_PROXY_TARGET` 지정 시 Vite dev 서버가 `/api` 를 어드민 서버로 프록시(로컬 CORS 우회). 배포와 무관.
