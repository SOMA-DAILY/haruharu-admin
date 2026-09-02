import { get, patch, post, put } from './client'
import type {
  AdminAccount,
  AdminMe,
  AdminMission,
  AdminMissionRevision,
  AssignGenderBody,
  CreateAdminAccountBody,
  CreateRoomBody,
  DemoAccessCode,
  MissionRevisionBody,
  SetDemoCodeBody,
  UpdateAdminAccountBody,
  DashboardMetrics,
  DashboardSummary,
  IapPurchaseDetail,
  IapPurchaseListItem,
  IapPurchaseStatus,
  LoginRequest,
  Paged,
  ReissueInviteBody,
  RoomCreated,
  RoomDetail,
  RoomInvite,
  RoomListItem,
  RoomMemberAssigned,
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

// ===== 대시보드 (#189 · metrics #244) =====
export interface MetricsQuery {
  from?: string // YYYY-MM-DD (옵션, 미지정 시 최근 14일)
  to?: string
}
export const dashboardApi = {
  summary: () => get<DashboardSummary>('/dashboard/summary'),
  metrics: (q?: MetricsQuery) => get<DashboardMetrics>('/dashboard/metrics', q),
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
  // 쓰기 (SUPER·OPERATOR)
  create: (body: CreateRoomBody) => post<RoomCreated>('/rooms', body),
  invites: (roomId: number) => get<RoomInvite[]>(`/rooms/${roomId}/invites`),
  reissueInvite: (roomId: number, body: ReissueInviteBody) =>
    post<RoomInvite>(`/rooms/${roomId}/invites`, body),
  cancel: (roomId: number) => post<null>(`/rooms/${roomId}/cancel`),
  assignGender: (roomId: number, memberId: number, body: AssignGenderBody) =>
    patch<RoomMemberAssigned>(`/rooms/${roomId}/members/${memberId}`, body),
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

// ===== 재화·결제 IAP (#237) =====
export interface IapPurchaseQuery {
  status?: IapPurchaseStatus
  userId?: number
  storeProductId?: string
  page?: number
  size?: number
}
export const iapApi = {
  list: (q: IapPurchaseQuery) => get<Paged<IapPurchaseListItem>>('/iap/purchases', q),
  detail: (id: number) => get<IapPurchaseDetail>(`/iap/purchases/${id}`),
}

// ===== 어드민 계정 관리 (#234 · SUPER 전용) =====
export const adminsApi = {
  list: () => get<AdminAccount[]>('/admins'),
  create: (body: CreateAdminAccountBody) => post<AdminAccount>('/admins', body),
  update: (id: number, body: UpdateAdminAccountBody) => patch<AdminAccount>(`/admins/${id}`, body),
}

// ===== 미션 카탈로그 (SUPER 전용 · revision 모델) =====
export interface MissionListQuery {
  page?: number
  size?: number
}
export const missionsApi = {
  list: (q?: MissionListQuery) => get<Paged<AdminMission>>('/missions', q),
  create: (body: MissionRevisionBody) => post<AdminMission>('/missions', body),
  // 수정 = 새 revision 발행 (과거 revision 보존)
  publishRevision: (id: number, body: MissionRevisionBody) =>
    post<AdminMission>(`/missions/${id}/revisions`, body),
  changeStatus: (id: number, active: boolean) =>
    patch<AdminMission>(`/missions/${id}/status`, { active }),
  revisions: (id: number, q?: MissionListQuery) =>
    get<Paged<AdminMissionRevision>>(`/missions/${id}/revisions`, q),
}

// ===== 데모 접근 코드 (SUPER 전용) =====
export const demoApi = {
  getCode: () => get<DemoAccessCode>('/demo/access-code'),
  setCode: (body: SetDemoCodeBody) => put<DemoAccessCode>('/demo/access-code', body),
}
