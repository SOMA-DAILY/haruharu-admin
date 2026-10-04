import { Tag } from 'antd'
import type { RoomStatus, UserStatus, IapPurchaseStatus, OperatorMission } from '../api/types'

const ROOM_MAP: Record<RoomStatus, { color: string; label: string }> = {
  PENDING: { color: 'gold', label: '대기' },
  ACTIVE: { color: 'green', label: '진행중' },
  ENDED: { color: 'default', label: '종료' },
  SELECTING: { color: 'purple', label: '최종선택' },
  CANCELLED: { color: 'default', label: '취소' },
}

export function OperatorMissionStatusTag({ item }: { item: OperatorMission }) {
  const statuses = { SCHEDULED: ['blue', '예약됨'], SENDING: ['processing', '발송 중'], SENT: ['green', '발송 완료'], FAILED: ['red', '발송 실패'], CANCELLED: ['default', '취소됨'] } as const
  const [color, label] = statuses[item.status]
  return <Tag color={item.delete_requested_at ? 'default' : color}>{item.delete_processed_at ? '삭제됨' : item.delete_requested_at ? '삭제 중' : label}</Tag>
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
