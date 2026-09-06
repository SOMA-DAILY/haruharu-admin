// 어드민 API 응답 타입 (노션: 어드민 API 명세 프런트 연동용, 2026-07-10)
// 응답 바디 필드는 snake_case 유지

// ===== 공통 =====
export interface ApiResponse<T> {
  isSuccess: boolean
  data: T | null
  error?: { code: string; message: string } | null
}

export interface PageMeta {
  page: number // 0-based
  size: number
  total_elements: number
  total_pages: number
}

export interface Paged<T> {
  content: T[]
  page: PageMeta
}

// ===== Enum =====
export type Role = 'SUPER' | 'OPERATOR' | 'CS'
export type RoomStatus = 'PENDING' | 'ACTIVE' | 'SELECTING' | 'ENDED' | 'CANCELLED'
export type RoomInviteStatus = 'ACTIVE' | 'DISABLED' | 'EXPIRED'
export type Gender = 'MALE' | 'FEMALE'
export type UserStatus = 'ONBOARDING' | 'ACTIVE' | 'INACTIVE' | 'BANNED' | 'DELETED'
export type IapStore = 'APP_STORE' | 'PLAY_STORE'
export type IapPurchaseStatus = 'OWNED' | 'REFUNDED'

// ===== 인증 =====
export interface LoginRequest {
  email: string
  password: string
}
export interface TokenPair {
  access_token: string
  refresh_token: string
}
export interface AdminMe {
  admin_id: number
  email: string
  name: string
  role: Role
}

// ===== 어드민 계정 관리 (#234 · SUPER 전용) =====
export type AdminAccountStatus = 'ACTIVE' | 'INACTIVE'

export interface AdminAccount {
  id: number
  email: string
  name: string
  role: Role
  status: AdminAccountStatus
  last_login_at: string | null
}
export interface CreateAdminAccountBody {
  email: string
  password: string
  name: string
  role: Role
}
export interface UpdateAdminAccountBody {
  role?: Role
  status?: AdminAccountStatus
}

// ===== 미션 카탈로그 (SUPER 전용 · revision 모델, BE #364) =====
export type MissionAttributeLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type MissionGoal = 'OBSERVATION' | 'PREFERENCE' | 'MEANING' | 'VALUE' | 'PERSONAL' | 'RELATIONAL'
export type ActivationChannel = 'VIDEO' | 'GROUP_CHAT'
export type InteractionScope = 'SELF' | 'GROUP' | 'SPECIFIC_MEMBER'
export type PreferenceLeakRisk = 'NONE' | 'LOW' | 'HIGH'
export type MissionPeriod = 'MORNING' | 'AFTERNOON'

export interface MissionEligibility {
  day_number: number // 1~3
  period: MissionPeriod
}

export interface AdminMissionRevision {
  id: number
  revision_number: number
  description: string
  disclosure_depth: MissionAttributeLevel
  mission_goal: MissionGoal
  activation_channel: ActivationChannel
  interaction_scope: InteractionScope
  participation_burden: MissionAttributeLevel
  privacy_risk: MissionAttributeLevel
  preference_leak_risk: PreferenceLeakRisk
  capture_difficulty: MissionAttributeLevel
  semantic_cluster: string
  base_quality_score: number
  is_fallback: boolean
  eligibilities: MissionEligibility[]
  created_at: string
}

export interface AdminMission {
  id: number
  active_revision_id: number
  active: boolean
  active_revision: AdminMissionRevision
}

// 생성 · revision 발행 공통 바디 (13필드)
export interface MissionRevisionBody {
  description: string
  disclosure_depth: MissionAttributeLevel
  mission_goal: MissionGoal
  activation_channel: ActivationChannel
  interaction_scope: InteractionScope
  participation_burden: MissionAttributeLevel
  privacy_risk: MissionAttributeLevel
  preference_leak_risk: PreferenceLeakRisk
  capture_difficulty: MissionAttributeLevel
  semantic_cluster: string
  base_quality_score: number
  is_fallback: boolean
  eligibilities: MissionEligibility[]
}

// ===== 데모 접근 코드 (SUPER 전용) =====
export interface DemoAccessCode {
  code: string | null
  configured: boolean
}
export interface SetDemoCodeBody {
  code: string
}

// ===== 대시보드 =====
export interface DashboardSummary {
  active_rooms: { total: number; by_day: Record<string, number> }
  matching_queue: { total: number; female: number; male: number }
  today_signups: number
}

// 대시보드 추이(metrics) — 기간별 가입·매칭 시계열 (BE #244)
export interface MatchingPoint {
  date: string
  applications: number
  matched: number
  expired: number
  success_rate: number | null // matched/(matched+expired), 분모 0이면 null
}
export interface DashboardMetrics {
  range: { from: string; to: string }
  signups: { date: string; count: number }[]
  matching: {
    daily: MatchingPoint[]
    overall: Omit<MatchingPoint, 'date'>
  }
}

// ===== 세션(방) =====
export interface RoomListItem {
  room_id: number
  status: RoomStatus
  scheduled_date: string
  current_day: number
  member_count: number
  female_count: number
  male_count: number
  started_at: string | null
}

export interface RoomMember {
  member_id: number
  user_id: number
  gender: Gender | null // 초대코드 입장은 미수집 → 운영진이 부여
  joined_at: string
  nickname: string | null // 실명 닉네임(프로필)
  pseudonym: string | null // 방 세션 가명(미배정 시 null, BE #393/#400)
  age: number | null
  region: string | null
}

export interface RoomDetail {
  room_id: number
  status: RoomStatus
  scheduled_date: string
  total_days: number
  current_day: number
  started_at: string | null
  ended_at: string | null
  member_count: number
  female_count: number
  male_count: number
  members: RoomMember[]
}

// 방 생성·초대코드 (초대코드 MVP)
// 방별 미션 슬롯 (BE #361) — total_days × 2(오전/오후)개 필수
export interface RoomMissionSlot {
  day_number: number
  period: MissionPeriod
  opens_at: string
  closes_at: string
}
export interface CreateRoomBody {
  starts_at: string
  final_selection_opens_at: string
  final_selection_closes_at: string
  result_at: string
  ends_at: string
  total_days: number
  max_uses?: number | null
  invite_expires_at?: string | null
  mission_slots: RoomMissionSlot[]
}
export interface RoomCreated {
  room_id: number
  code: string
}
export interface RoomInvite {
  invite_id: number
  code: string
  status: RoomInviteStatus
  max_uses: number | null
  used_count: number
  expires_at: string | null
  created_by: string
}
export interface ReissueInviteBody {
  max_uses?: number | null
  expires_at?: string | null
}
export interface AssignGenderBody {
  gender: Gender
}
export interface RoomMemberAssigned {
  member_id: number
  user_id: number
  gender: Gender
  pseudonym: string | null // 성별 부여 시 백필 (BE #400)
}

// ===== 유저 =====
export interface UserListItem {
  user_id: number
  nickname: string | null
  region: string | null
  status: UserStatus
  created_at: string
}

export interface UserPayment {
  purchase_id: number
  store_product_id: string
  coin_amount: number
  store: IapStore
  status: IapPurchaseStatus
  purchased_at: string
  refunded_at: string | null
}

// ===== 어드민 IAP 결제 내역 (#237) =====
export interface IapPurchaseListItem {
  id: number
  user_id: number
  nickname: string | null
  store_product_id: string
  store: IapStore
  coin_amount: number
  status: IapPurchaseStatus
  purchased_at: string
  refunded_at: string | null
}

export interface IapPurchaseDetail extends IapPurchaseListItem {
  product_id: number
  store_transaction_id: string
}

export interface UserDetail {
  user_id: number
  status: UserStatus
  created_at: string
  profile: {
    nickname: string | null
    region: string | null
    mbti: string | null
    affiliation: string | null
    height: number | null
  } | null
  coin: { paid: number; reward: number; total: number }
  payments: UserPayment[]
  participations: {
    room_id: number
    room_status: RoomStatus
    scheduled_date: string
    joined_at: string
  }[]
}
