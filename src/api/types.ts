// 어드민 API 응답 타입 (노션: 어드민 API 명세 프런트 연동용, 2026-07-10)
// 응답 바디 필드는 snake_case 유지

// ===== 공통 =====
export interface ApiResponse<T> {
  isSuccess: boolean
  data: T | null
  error?: { code: string; message: string; fields?: { field: string; message: string }[] } | null
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
  today_signups: number
}

// 대시보드 추이(metrics) — 기간별 가입 시계열 (자동매칭 지표는 BE #452에서 제거)
export interface DashboardMetrics {
  range: { from: string; to: string }
  signups: { date: string; count: number }[]
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
  // 방 일정 (BE #457 추가. 옛 서버 응답엔 없을 수 있어 optional + nullable)
  starts_at?: string | null
  final_selection_opens_at?: string | null
  ends_at?: string | null
  member_count: number
  female_count: number
  male_count: number
  members: RoomMember[]
}

export type RoomActivityType = 'VIDEO' | 'CHAT' | 'REACTION' | 'QUESTION'
export interface ActivityParticipant { user_id: number; name: string }
export interface RoomSelection {
  chooser: ActivityParticipant
  selected: ActivityParticipant | null
  submitted: boolean
  mutual: boolean
  matched: boolean
}
export interface ActivityVideo {
  slot_start: string | null
  id: number
  video_url: string
  thumbnail_url: string | null
  caption: string | null
  hidden: boolean
  mission_id: number | null
}
export interface RoomActivity {
  type: RoomActivityType
  id: number
  occurred_at: string
  day: number | null
  actor: ActivityParticipant | null
  target: ActivityParticipant | null
  content: string | null
  video: ActivityVideo | null
  reaction_type: string | null
  answer: string | null
  answered_at: string | null
}
export interface RoomActivitySummary {
  counts: { videos: number; chats: number; reactions: number; questions: number }
  members: {
    user_id: number
    name: string
    videos: number
    chats: number
    reactions_sent: number
    reactions_received: number
    questions_received: number
  }[]
}

// 방 생성·초대코드 (초대코드 MVP)
export interface CreateRoomBody {
  starts_at: string
  final_selection_opens_at: string
  final_selection_closes_at: string
  result_at: string
  ends_at: string
  total_days: number
  max_uses?: number | null
  invite_expires_at?: string | null
  missions?: RoomMissionBody[] // 최대 100개. 서버 기본 미션 없음
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
// 방 미션·안내 (BE #482 · #484 · #486). 예전 편성 한 줄 = 미션 하나 + 안내 하나
export type RevealField = 'MBTI' | 'INTO_NOW' | 'AGE' | 'DEPARTMENT'
export type MissionType = 'ANNOUNCEMENT' | 'PROFILE_REVEAL' | 'RECORDING'
export type MissionStatus = 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'CANCELED'
export type AnnouncementType = 'START' | 'REMINDER' | 'RESULT'
export type AnnouncementStatus = 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELED' | 'FAILED'
// url 은 1시간짜리 서명 주소(미리보기용). 변하지 않는 건 key
export interface MissionImage {
  key: string
  url: string
  width: number
  height: number
}
// type 에 따라 한쪽만 온다: ANNOUNCEMENT·RECORDING = content(RECORDING 은 촬영 주제), PROFILE_REVEAL = reveal_fields
export interface MissionDetails {
  content?: string | null
  reveal_fields?: RevealField[] | null
}
export interface RoomMission {
  mission_id: number
  room_id: number
  type: MissionType
  details: MissionDetails
  image: MissionImage | null
  opens_at: string
  closes_at: string | null // null = 방 종료까지
  effective_closes_at: string | null
  status: MissionStatus
  interaction_type: string
  requires_response: boolean
  can_respond: boolean
}
export interface RoomMissionPage {
  missions: RoomMission[]
  next_cursor: number | null
}
export interface MissionAnnouncement {
  announcement_id: number
  mission_id: number
  room_id: number
  announcement_type: AnnouncementType
  run_at: string
  content: string | null
  push: boolean
  push_title: string | null
  push_body: string | null
  status: AnnouncementStatus
  fail_reason: string | null
  sent_message_id: number | null
  message_deleted_at: string | null // 보낸 글 삭제 시각
  legacy_schedule_item_id: number | null
  created_by: string | null
  updated_by: string | null
  sent_at: string | null
  created_at: string | null
  updated_at: string | null
}
export interface AnnouncementPage {
  announcements: MissionAnnouncement[]
  next_cursor: number | null
}
// 안내 추가·수정 공통 바디 (PUT 은 전체 교체)
export interface AnnouncementBody {
  announcement_type: AnnouncementType
  run_at: string
  content: string | null
  push: boolean
  push_title: string | null
  push_body: string | null
}
// 미션 생성·수정 공통 바디 (PUT 은 전체 교체. announcement 는 생성 때만)
export interface RoomMissionBody {
  type: MissionType
  details: MissionDetails
  image_key: string | null
  opens_at: string
  closes_at: string | null
  announcement?: AnnouncementBody
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
