import { Tag } from 'antd'
import type { RoomStatus, UserStatus, IapPurchaseStatus } from '../api/types'

const ROOM_MAP: Record<RoomStatus, { color: string; label: string }> = {
  PENDING: { color: 'gold', label: '대기' },
  ACTIVE: { color: 'green', label: '진행중' },
  ENDED: { color: 'default', label: '종료' },
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
export function IapStatusTag({ status }: { status: IapPurchaseStatus }) {
  const m = IAP_MAP[status]
  return <Tag color={m.color}>{m.label}</Tag>
}
