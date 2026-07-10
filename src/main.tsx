import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, App as AntdApp } from 'antd'
import koKR from 'antd/locale/ko_KR'
import 'dayjs/locale/ko'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { theme } from './theme'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={koKR} theme={theme}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
