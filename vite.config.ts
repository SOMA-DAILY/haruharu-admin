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
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              // 프록시는 서버-서버라 브라우저 Origin이 불필요. 제거해 백엔드 CORS 필터에
              // 걸리지 않게 함(로컬 오리진이 dev 허용목록에 없어도 동작).
              configure: (proxy) => {
                proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
              },
            },
          },
        }
      : undefined,
  }
})
