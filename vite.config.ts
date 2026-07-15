import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // dev 전용: CORS 우회를 위해 /api 요청을 어드민 서버로 프록시.
  // VITE_API_PROXY_TARGET 이 설정된 경우에만 활성화(배포 빌드엔 영향 없음).
  const proxyTarget = env.VITE_API_PROXY_TARGET

  return {
    plugins: [react()],
    server: proxyTarget
      ? {
          proxy: {
            '/api': { target: proxyTarget, changeOrigin: true },
          },
        }
      : undefined,
  }
})
