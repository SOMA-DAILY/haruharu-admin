# 배포 (dev)

어드민 프런트의 dev 배포 구성과 절차. 계정 `049705857590`, 리전 `ap-northeast-2`(인증서만 `us-east-1`).

## 아키텍처

```
브라우저 ─https─> dev-admin.haruharu.co.kr (CloudFront + S3)   ← 어드민 웹(SPA)
        ─https─> dev-api.haruharu.co.kr   (ALB → 어드민 서버)  ← API, 크로스오리진 직접 호출(CORS)
```

- 웹과 API는 **다른 오리진** → 어드민 서버 CORS `allowedOrigins` 에 `https://dev-admin.haruharu.co.kr` 필요.
- 둘 다 https → Mixed Content 없음.

## 인프라 (구성됨)

| 리소스 | 값 |
|---|---|
| S3 버킷(비공개) | `haruharu-admin-dev` |
| CloudFront 배포 | `E1UHFEHEO4FRI` (`d2picum97efo33.cloudfront.net`) |
| 접속 도메인 | `dev-admin.haruharu.co.kr` (Route53 A/AAAA Alias → CloudFront) |
| ACM 인증서 | `dev-admin.haruharu.co.kr` (us-east-1) |
| S3 접근 | CloudFront OAC (버킷 정책으로 CloudFront 서비스 프린시펄만 허용) |
| SPA 폴백 | CloudFront 오류응답 403·404 → `/index.html` (200) |
| 기본 루트 객체 | `index.html` |

## CI/CD

- **CI** (`ci.yml`): PR(develop/main) 시 `npm run lint` + `npm run build`.
- **네이밍** (`naming-convention.yml`): 이슈/PR/브랜치명 컨벤션 강제.
- **CD** (`deploy.yml`): `develop` push(머지) 또는 수동 실행 시
  1. `npm ci && npm run build` (`VITE_API_BASE_URL=https://dev-api.haruharu.co.kr`)
  2. `aws s3 sync dist/ s3://haruharu-admin-dev --delete`
  3. CloudFront 무효화 `/*`

### 인증 (키리스 · OIDC)

GitHub Actions → AWS 는 **OIDC 역할 assume** (장기 액세스 키 없음).

| 항목 | 값 |
|---|---|
| OIDC 공급자 | `token.actions.githubusercontent.com` |
| 배포 역할 | `gha-haruharu-admin-deploy` (repo `SOMA-DAILY/haruharu-admin` 만 신뢰) |
| 권한 | S3 list/put/delete (`haruharu-admin-dev`) + CloudFront 무효화(해당 배포) |

### 레포 변수 (Settings → Variables)

| 이름 | 값 |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::049705857590:role/gha-haruharu-admin-deploy` |
| `AWS_REGION` | `ap-northeast-2` |
| `AWS_S3_BUCKET` | `haruharu-admin-dev` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1UHFEHEO4FRI` |

## 수동 배포

GitHub → Actions → **Deploy (dev)** → Run workflow (develop 기준).

## 로컬 개발

`.env` 에 `VITE_API_PROXY_TARGET` 지정 시 Vite dev 서버가 `/api` 를 어드민 서버로 프록시(로컬 CORS 우회). 배포와 무관.
