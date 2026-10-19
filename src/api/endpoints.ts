import { del, get, http, patch, post, put } from './client'
import type { MissionImage, OperatorMission, OperatorMissionInput, OperatorMissionPage } from './types'
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
  RoomScheduleItem,
  ScheduleItemBody,
  RoomStatus,
  RoomActivity,
  RoomActivitySummary,
  RoomActivityType,
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
  isTest?: boolean
  status?: RoomStatus
  scheduledDate?: string // YYYY-MM-DD (쿼리 파라미터는 camelCase)
  page?: number
  size?: number
}
export interface RoomActivityQuery {
  day?: number
  userId?: number
  type?: RoomActivityType
  page?: number
  size?: number
  order?: 'asc' | 'desc'
}
export const roomsApi = {
  activities: (roomId: number, q: RoomActivityQuery) => get<Paged<RoomActivity>>(`/rooms/${roomId}/activities`, q),
  selections: (roomId: number) => get<import('./types').RoomSelection[]>(`/rooms/${roomId}/selections`),
  activitySummary: (roomId: number, q: Pick<RoomActivityQuery, 'day' | 'userId'>) =>
    get<RoomActivitySummary>(`/rooms/${roomId}/activity/summary`, q),
  list: (q: RoomListQuery) => get<Paged<RoomListItem>>('/rooms', q),
  detail: (roomId: number) => get<RoomDetail>(`/rooms/${roomId}`),
  updateType: (roomId: number, isTest: boolean) =>
    patch<{ room_id: number; is_test: boolean }>(`/rooms/${roomId}/type`, { is_test: isTest }),
  // 쓰기 (SUPER·OPERATOR)
  create: (body: CreateRoomBody) => post<RoomCreated>('/rooms', body),
  invites: (roomId: number) => get<RoomInvite[]>(`/rooms/${roomId}/invites`),
  reissueInvite: (roomId: number, body: ReissueInviteBody) =>
    post<RoomInvite>(`/rooms/${roomId}/invites`, body),
  cancel: (roomId: number) => post<null>(`/rooms/${roomId}/cancel`),
  assignGender: (roomId: number, memberId: number, body: AssignGenderBody) =>
    patch<RoomMemberAssigned>(`/rooms/${roomId}/members/${memberId}`, body),
  // 방 편성 (조회 전 역할, 쓰기 SUPER·OPERATOR)
  schedule: (roomId: number) => get<RoomScheduleItem[]>(`/rooms/${roomId}/schedule`),
  createScheduleItem: (roomId: number, body: ScheduleItemBody) =>
    post<RoomScheduleItem>(`/rooms/${roomId}/schedule`, body),
  updateScheduleItem: (roomId: number, itemId: number, body: ScheduleItemBody) =>
    patch<RoomScheduleItem>(`/rooms/${roomId}/schedule/${itemId}`, body),
  sendScheduleNow: (roomId: number, itemId: number) =>
    post<RoomScheduleItem>(`/rooms/${roomId}/schedule/${itemId}/send-now`),
  cancelScheduleItem: (roomId: number, itemId: number) =>
    post<RoomScheduleItem>(`/rooms/${roomId}/schedule/${itemId}/cancel`),
  deleteScheduleMessage: (roomId: number, itemId: number) =>
    del<null>(`/rooms/${roomId}/schedule/${itemId}/message`),
}

export const operatorMissionsApi = {
  uploadImage: async (roomId: number, file: File, signal: AbortSignal) => {
    const body = new FormData()
    body.append('file', file)
    return (await http.post<MissionImage>(`/rooms/${roomId}/operator-missions/images`, body, { signal, timeout: 60000 })).data
  },
  list: (roomId: number, cursor?: number) => get<OperatorMissionPage>(`/rooms/${roomId}/operator-missions`, { cursor, size: 20 }),
  create: (roomId: number, body: OperatorMissionInput) => post<OperatorMission>(`/rooms/${roomId}/operator-missions`, body),
  update: (roomId: number, id: number, body: OperatorMissionInput) => put<OperatorMission>(`/rooms/${roomId}/operator-missions/${id}`, body),
  cancel: (roomId: number, id: number) => post<OperatorMission>(`/rooms/${roomId}/operator-missions/${id}/cancel`),
  delete: (roomId: number, id: number) => del<OperatorMission>(`/rooms/${roomId}/operator-missions/${id}`),
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
