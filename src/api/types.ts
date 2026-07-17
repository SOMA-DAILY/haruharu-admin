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
export type RoomStatus = 'PENDING' | 'ACTIVE' | 'ENDED'
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
  gender: 'FEMALE' | 'MALE'
  joined_at: string
  nickname: string | null
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
