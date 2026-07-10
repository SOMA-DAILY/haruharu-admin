import { get, post } from './client'
import type {
  AdminMe,
  DashboardSummary,
  LoginRequest,
  Paged,
  RoomDetail,
  RoomListItem,
  RoomStatus,
  TokenPair,
  UserDetail,
  UserListItem,
  UserStatus,
} from './types'

// ===== 인증 (#187) =====
export const authApi = {
  login: (body: LoginRequest) => post<TokenPair>('/auth/login', body),
  logout: () => post<null>('/auth/logout'),
  me: () => get<AdminMe>('/me'),
}

// ===== 대시보드 (#189) =====
export const dashboardApi = {
  summary: () => get<DashboardSummary>('/dashboard/summary'),
}

// ===== 세션(방) (#191) =====
export interface RoomListQuery {
  status?: RoomStatus
  scheduledDate?: string // YYYY-MM-DD (쿼리 파라미터는 camelCase)
  page?: number
  size?: number
}
export const roomsApi = {
  list: (q: RoomListQuery) => get<Paged<RoomListItem>>('/rooms', q),
  detail: (roomId: number) => get<RoomDetail>(`/rooms/${roomId}`),
}

// ===== 유저 (#193) =====
export interface UserListQuery {
  keyword?: string
  status?: UserStatus
  page?: number
  size?: number
}
export const usersApi = {
  list: (q: UserListQuery) => get<Paged<UserListItem>>('/users', q),
  detail: (userId: number) => get<UserDetail>(`/users/${userId}`),
}
