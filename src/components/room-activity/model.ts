import dayjs from 'dayjs'
import type { RoomActivity, RoomActivityType, RoomDetail, RoomMember } from '../../api/types'

export const reactionEmoji: Record<string, string> = { LIKE: '👍', HEART: '❤️', LOVE: '😍', LAUGH: '😂', WOW: '😮', FIRE: '🔥' }
export type ActivityCounts = Record<RoomActivityType, number>
export interface ActivitySlot {
  key: string
  start: number | null
  day: number | null
  videos: RoomActivity[]
  events: RoomActivity[]
}
const HOUR = 3_600_000
export const memberName = (member: RoomMember) => member.pseudonym || '가명 없음'
export const gridColumns = (count: number) => Math.max(3, Math.min(5, Math.ceil(count / 2)))

export function roomStart(room: RoomDetail): number {
  if (room.starts_at) return dayjs(room.starts_at).valueOf()
  // 구형 방의 일차 경계는 실제 시작일의 09시. 서버의 dateOfDay(1)와 동일하다.
  if (room.started_at) return dayjs(room.started_at).subtract(9, 'hour').startOf('day').add(9, 'hour').valueOf()
  return dayjs(`${room.scheduled_date}T09:00:00`).valueOf()
}
export function relatedTo(event: RoomActivity, userId?: number) {
  return userId == null || event.actor?.user_id === userId || event.target?.user_id === userId
}
export function countsOf(events: RoomActivity[]): ActivityCounts {
  return events.reduce((counts, event) => { counts[event.type]++; return counts }, { VIDEO: 0, CHAT: 0, REACTION: 0, QUESTION: 0 })
}
// Keep the transcript continuous. Empty video hours seek the next chat, or the final one.
export function findChatSlot(slots: ActivitySlot[], selected: ActivitySlot, userId?: number): ActivitySlot | undefined {
  const available = slots.filter(slot => slot.events.some(event => event.type === 'CHAT' && relatedTo(event, userId)))
  return available.find(slot => slot.key === selected.key)
    ?? available.find(slot => selected.start != null && slot.start != null && slot.start >= selected.start)
    ?? available.at(-1)
}
export function slotLabel(slot: ActivitySlot) {
  return slot.start == null ? '시각 확인 불가' : `${dayjs(slot.start).format('MM.DD HH:mm')}–${dayjs(slot.start).add(1, 'hour').format('HH:mm')}`
}

export function buildSlots(room: RoomDetail, events: RoomActivity[], day?: number, now = Date.now()): ActivitySlot[] {
  const base = roomStart(room)
  const slots = new Map<string, ActivitySlot>()
  const dayAt = (time: number) => time >= base && time < base + room.total_days * 24 * HOUR
    ? Math.floor((time - base) / (24 * HOUR)) + 1 : null
  const ensure = (start: number | null) => {
    const key = start == null ? 'unknown' : String(start)
    if (!slots.has(key)) slots.set(key, { key, start, day: start == null ? null : dayAt(start), videos: [], events: [] })
    return slots.get(key)!
  }
  const scheduledEnd = room.ends_at ? dayjs(room.ends_at).valueOf() : base + room.total_days * 24 * HOUR
  const actualEnd = room.ended_at ? Math.min(scheduledEnd, dayjs(room.ended_at).valueOf()) : scheduledEnd
  const end = room.status === 'ENDED' ? actualEnd : Math.min(actualEnd, now)
  const from = day == null ? base : base + (day - 1) * 24 * HOUR
  const to = day == null ? end : Math.min(end, from + 24 * HOUR)
  if (Number.isFinite(from) && room.status !== 'PENDING') {
    for (let start = from; start < to; start += HOUR) ensure(start)
  }
  for (const event of events) {
    const raw = event.type === 'VIDEO' ? event.video?.slot_start ?? event.occurred_at : event.occurred_at
    const time = dayjs(raw).valueOf()
    const start = Number.isFinite(time) && Number.isFinite(base)
      ? (event.type === 'VIDEO' && event.video?.slot_start ? time : base + Math.floor((time - base) / HOUR) * HOUR) : null
    const slot = ensure(start)
    if (event.type === 'VIDEO') slot.videos.push(event)
    else slot.events.push(event)
  }
  return [...slots.values()].sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity)).map(slot => ({
    ...slot,
    events: slot.events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id - b.id || a.type.localeCompare(b.type)),
  }))
}
