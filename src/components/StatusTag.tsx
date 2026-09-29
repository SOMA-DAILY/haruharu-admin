import { Tag, Tooltip } from 'antd'
import type {
  RoomStatus,
  RoomInviteStatus,
  UserStatus,
  IapPurchaseStatus,
  IapStore,
  Role,
  AdminAccountStatus,
  ScheduleStatus,
} from '../api/types'

const ROOM_MAP: Record<RoomStatus, { color: string; label: string }> = {
  PENDING: { color: 'gold', label: '대기' },
  ACTIVE: { color: 'green', label: '진행중' },
  SELECTING: { color: 'blue', label: '선택중' },
  ENDED: { color: 'default', label: '종료' },
  CANCELLED: { color: 'red', label: '취소' },
}

const INVITE_MAP: Record<RoomInviteStatus, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: '유효' },
  DISABLED: { color: 'default', label: '비활성' },
  EXPIRED: { color: 'red', label: '만료' },
}

const USER_MAP: Record<UserStatus, { color: string; label: string }> = {
  ONBOARDING: { color: 'blue', label: '온보딩' },
  ACTIVE: { color: 'green', label: '활성' },
  INACTIVE: { color: 'default', label: '휴면' },
  BANNED: { color: 'red', label: '정지' },
  DELETED: { color: 'default', label: '탈퇴' },
}

const IAP_MAP: Record<IapPurchaseStatus, { color: string; label: string }> = {
  OWNED: { color: 'green', label: '보유' },
  REFUNDED: { color: 'red', label: '환불' },
}

export function RoomStatusTag({ status }: { status: RoomStatus }) {
  const m = ROOM_MAP[status]
  return <Tag color={m.color}>{m.label}</Tag>
}
export function UserStatusTag({ status }: { status: UserStatus }) {
  const m = USER_MAP[status]
  return <Tag color={m.color}>{m.label}</Tag>
}
export function RoomInviteStatusTag({ status }: { status: RoomInviteStatus }) {
  const m = INVITE_MAP[status]
  return <Tag color={m.color}>{m.label}</Tag>
}
export function IapStatusTag({ status }: { status: IapPurchaseStatus }) {
  const m = IAP_MAP[status]
  return <Tag color={m.color}>{m.label}</Tag>
}

export function StoreTag({ store }: { store: IapStore }) {
  return store === 'APP_STORE' ? <Tag color="default">App Store</Tag> : <Tag color="green">Play Store</Tag>
}

const ROLE_MAP: Record<Role, string> = { SUPER: 'red', OPERATOR: 'blue', CS: 'default' }
export function RoleTag({ role }: { role: Role }) {
  return <Tag color={ROLE_MAP[role]}>{role}</Tag>
}

export function AdminStatusTag({ status }: { status: AdminAccountStatus }) {
  return status === 'ACTIVE' ? <Tag color="green">활성</Tag> : <Tag color="default">비활성</Tag>
}

const SCHEDULE_MAP: Record<ScheduleStatus, { color: string; label: string }> = {
  SCHEDULED: { color: 'blue', label: '예약' },
  SENDING: { color: 'processing', label: '발송중' },
  SENT: { color: 'green', label: '보냄' },
  CANCELED: { color: 'default', label: '취소' },
  FAILED: { color: 'red', label: '실패' },
}
export function ScheduleStatusTag({ status, failReason }: { status: ScheduleStatus; failReason?: string | null }) {
  const m = SCHEDULE_MAP[status] ?? { color: 'default', label: status }
  const tag = <Tag color={m.color}>{m.label}</Tag>
  return status === 'FAILED' && failReason ? <Tooltip title={failReason}>{tag}</Tooltip> : tag
}
