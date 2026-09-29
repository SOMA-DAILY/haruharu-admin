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
  // 400 VALIDATION_ERROR 의 칸별 메시지 (서버가 field 정보를 줄 때만)
  fieldErrors?: Record<string, string>
  constructor(code: string, message: string, status?: number, fieldErrors?: Record<string, string>) {
    super(message)
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

// error.field(단일) 또는 error.fields(배열 [{field,message}] / 맵 {field: message}) 를 칸별 메시지로
function toFieldErrors(err: unknown): Record<string, string> | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as { field?: unknown; fields?: unknown; message?: unknown }
  const out: Record<string, string> = {}
  if (typeof e.field === 'string' && typeof e.message === 'string') out[e.field] = e.message
  if (Array.isArray(e.fields)) {
    for (const f of e.fields as { field?: unknown; message?: unknown }[]) {
      if (typeof f?.field === 'string' && typeof f?.message === 'string') out[f.field] = f.message
    }
  } else if (e.fields && typeof e.fields === 'object') {
    for (const [k, v] of Object.entries(e.fields as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
    }
  }
  return Object.keys(out).length ? out : undefined
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
      new ApiError(err?.code ?? 'NETWORK', err?.message ?? error.message, status, toFieldErrors(err)),
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
export async function del<T>(url: string): Promise<T> {
  const res = await http.delete<T>(url)
  return res.data
}
export async function put<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.put<T>(url, body)
  return res.data
}
