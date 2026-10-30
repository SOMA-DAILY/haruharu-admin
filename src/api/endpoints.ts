import { del, get, http, patch, post, put } from './client'
import type {
  AppUpdatePolicy,
  AppUpdatePolicyHistory,
  UpdateAppUpdatePolicyBody,
  AdminAccount,
  AdminMe,
  AnnouncementBody,
  AnnouncementPage,
  AssignGenderBody,
  CreateAdminAccountBody,
  CreateRoomBody,
  DemoAccessCode,
  SetDemoCodeBody,
  UpdateAdminAccountBody,
  DashboardMetrics,
  DashboardSummary,
  IapPurchaseDetail,
  IapPurchaseListItem,
  IapPurchaseStatus,
  LoginRequest,
  MissionAnnouncement,
  MissionImage,
  Paged,
  ReissueInviteBody,
  RoomCreated,
  RoomDetail,
  RoomInvite,
  RoomListItem,
  RoomMemberAssigned,
  RoomMission,
  RoomMissionBody,
  RoomMissionPage,
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
  groupId?: number
  ungrouped?: boolean
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
  groups: (page = 0) => get<import('./types').Paged<import('./types').RoomGroup>>('/room-groups', { page, size: 100 }),
  createGroup: (name: string) => post<import('./types').RoomGroup>('/room-groups', { name }),
  assignOrganization: (body: import('./types').RoomOrganizationBody) => patch<null>('/rooms/organization', body),
  activities: async (roomId: number, q: RoomActivityQuery, signal?: AbortSignal) =>
    (await http.get<Paged<RoomActivity>>(`/rooms/${roomId}/activities`, { params: q, signal })).data,
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
}

// ===== 방 미션·안내 (BE #482 · #484 · #486. 조회 전 역할, 쓰기 SUPER·OPERATOR) =====
export interface CursorQuery {
  after?: number
  size?: number
}
export const roomMissionsApi = {
  list: (roomId: number, q?: CursorQuery) => get<RoomMissionPage>(`/rooms/${roomId}/missions`, q),
  detail: (roomId: number, missionId: number) => get<RoomMission>(`/rooms/${roomId}/missions/${missionId}`),
  create: (roomId: number, body: RoomMissionBody) => post<RoomMission>(`/rooms/${roomId}/missions`, body),
  // 시작 전 미션 전체 교체 (closes_at·image_key 를 빼면 지워짐)
  update: (roomId: number, missionId: number, body: RoomMissionBody) =>
    put<RoomMission>(`/rooms/${roomId}/missions/${missionId}`, body),
  cancel: (roomId: number, missionId: number) => post<RoomMission>(`/rooms/${roomId}/missions/${missionId}/cancel`),
  announcements: (roomId: number, missionId: number, q?: CursorQuery) =>
    get<AnnouncementPage>(`/rooms/${roomId}/missions/${missionId}/announcements`, q),
  createAnnouncement: (roomId: number, missionId: number, body: AnnouncementBody) =>
    post<MissionAnnouncement>(`/rooms/${roomId}/missions/${missionId}/announcements`, body),
  updateAnnouncement: (roomId: number, missionId: number, id: number, body: AnnouncementBody) =>
    put<MissionAnnouncement>(`/rooms/${roomId}/missions/${missionId}/announcements/${id}`, body),
  sendAnnouncementNow: (roomId: number, missionId: number, id: number) =>
    post<MissionAnnouncement>(`/rooms/${roomId}/missions/${missionId}/announcements/${id}/send-now`),
  cancelAnnouncement: (roomId: number, missionId: number, id: number) =>
    post<MissionAnnouncement>(`/rooms/${roomId}/missions/${missionId}/announcements/${id}/cancel`),
  deleteAnnouncementMessage: (roomId: number, missionId: number, id: number) =>
    del<MissionAnnouncement>(`/rooms/${roomId}/missions/${missionId}/announcements/${id}/message`),
}

// 미션 사진 (multipart file. JPG·PNG 10MB 이하). 응답 key 를 미션 image_key 로 보낸다
export const missionImagesApi = {
  upload: async (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return (await http.post<MissionImage>('/mission-images', body, { timeout: 60000 })).data
  },
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

// ===== 데모 접근 코드 (SUPER 전용) =====
export const demoApi = {
  getCode: () => get<DemoAccessCode>('/demo/access-code'),
  setCode: (body: SetDemoCodeBody) => put<DemoAccessCode>('/demo/access-code', body),
}

export const appUpdatePolicyApi = {
  get: () => get<AppUpdatePolicy>('/app-update-policy'),
  update: (body: UpdateAppUpdatePolicyBody) => put<AppUpdatePolicy>('/app-update-policy', body),
  history: () => get<AppUpdatePolicyHistory[]>('/app-update-policy/history'),
}

export interface ParticipationCandidateQuery { keyword?: string; gender?: import('./types').Gender; page?: number; size?: number }
export const midParticipationApi = {
  candidates: (q: ParticipationCandidateQuery) => get<import('./types').Paged<import('./types').ParticipationCandidate>>('/mid-participation/candidates', q),
  campaigns: (roomId: number) => get<import('./types').ParticipationCampaign[]>(`/rooms/${roomId}/mid-participation`),
  availability: (roomId: number) => get<import('./types').ParticipationAvailability>(`/rooms/${roomId}/mid-participation/availability`),
  create: (roomId: number, body: import('./types').ParticipationCampaignBody) => post<import('./types').ParticipationCampaign>(`/rooms/${roomId}/mid-participation`, body),
  resend: (id: number) => post<import('./types').ParticipationCampaign>(`/mid-participation/campaigns/${id}/resend`),
  cancel: (id: number) => post<import('./types').ParticipationCampaign>(`/mid-participation/campaigns/${id}/cancel`),
  remove: (roomId: number, memberId: number, reason: string) => post<unknown>(`/rooms/${roomId}/members/${memberId}/remove`, { reason }),
}
