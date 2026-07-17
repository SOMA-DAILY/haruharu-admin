import axios, { AxiosError } from 'axios'
import type { ApiResponse } from './types'

const ACCESS_TOKEN_KEY = 'haruharu_admin_access_token'
const REFRESH_TOKEN_KEY = 'haruharu_admin_refresh_token'

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access)
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

// dev에선 VITE_API_BASE_URL 을 비워 상대경로(/api/v1/admin)로 요청 → Vite 프록시가 CORS 우회.
// prod 빌드에선 실제 어드민 서버 절대 URL 을 지정.
export const http = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/admin`,
  timeout: 15000,
})

// 요청: admin access token 주입
http.interceptors.request.use((config) => {
  const token = tokenStore.getAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 응답 래퍼가 담긴 에러
export class ApiError extends Error {
  code: string
  status?: number
  constructor(code: string, message: string, status?: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

// 응답: { isSuccess, data, error } 래퍼를 벗겨 data만 반환
http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>
    if (body && typeof body === 'object' && 'isSuccess' in body) {
      if (!body.isSuccess) {
        throw new ApiError(
          body.error?.code ?? 'UNKNOWN',
          body.error?.message ?? '요청 처리 중 오류가 발생했습니다.',
          response.status,
        )
      }
      response.data = body.data
    }
    return response
  },
  (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status
    // 401 → 토큰 폐기 후 로그인으로
    if (status === 401) {
      tokenStore.clear()
      if (location.pathname !== '/login') location.assign('/login')
    }
    const err = error.response?.data?.error
    return Promise.reject(
      new ApiError(err?.code ?? 'NETWORK', err?.message ?? error.message, status),
    )
  },
)

// data만 꺼내는 헬퍼
export async function get<T>(url: string, params?: object): Promise<T> {
  const res = await http.get<T>(url, { params })
  return res.data
}
export async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.post<T>(url, body)
  return res.data
}
export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.patch<T>(url, body)
  return res.data
}
