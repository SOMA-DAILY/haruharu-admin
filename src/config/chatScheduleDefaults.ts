import dayjs, { type Dayjs } from 'dayjs'
import type { AnnouncementType, MissionAnnouncement, MissionType, RevealField, RoomMission } from '../api/types'

// 채팅 P0 기본 편성 (채팅 P0 기능명세 §F3). 서버엔 기본값 없음.
// 방 생성 모달 [채팅 편성] 에 채워져 뜨고, 고친 채로 POST /rooms 의 missions[] 로 감 (한 줄 = 미션 하나 + START 안내 하나).

export const REVEAL_FIELDS: RevealField[] = ['MBTI', 'INTO_NOW', 'AGE', 'DEPARTMENT']
export const REVEAL_LABEL: Record<RevealField, string> = {
  MBTI: 'MBTI',
  INTO_NOW: '요즘 빠져 있는 것',
  AGE: '나이',
  DEPARTMENT: '학과',
}

// RECORDING(촬영, BE #496): 앱이 이 유형의 미션 글에만 [촬영하러 가기] 버튼을 단다
// PAIR_CHAT(1:1 대화, BE #540): 시작~끝 동안 참가자끼리 1:1 채팅이 열린다. 끝 시각 칸이 있는 미션 추가 창에서만 만든다
export const MISSION_TYPES: MissionType[] = ['ANNOUNCEMENT', 'PROFILE_REVEAL', 'RECORDING', 'PAIR_CHAT']
export const MISSION_TYPE_LABEL: Record<MissionType, string> = {
  ANNOUNCEMENT: '안내',
  PROFILE_REVEAL: '프로필 공개',
  RECORDING: '촬영',
  PAIR_CHAT: '1:1 대화',
}
export const ANNOUNCEMENT_TYPES: AnnouncementType[] = ['START', 'REMINDER', 'RESULT']
export const ANNOUNCEMENT_TYPE_LABEL: Record<AnnouncementType, string> = { START: '시작', REMINDER: '리마인드', RESULT: '결과' }

// 푸시를 켰을 때 채워 넣는 기본 문구
export const DEFAULT_PUSH_TITLE = '📢 하루 공지'
export const DEFAULT_PUSH_BODY = '방 채팅에 새 공지가 올라왔어요'
// 촬영 미션에 푸시를 켰을 때의 기본 문구 (예전 운영자 미션 알림과 같은 문구)
export const RECORDING_PUSH_TITLE = '🎬 하루의 새 미션'
export const RECORDING_PUSH_BODY = '운영자가 보낸 미션을 확인하고 하루를 남겨보세요'
// 1:1 대화 미션에 푸시를 켰을 때의 기본 문구
export const PAIR_CHAT_PUSH_TITLE = '💬 1:1 대화 시간'
export const PAIR_CHAT_PUSH_BODY = '궁금했던 사람과 지금 대화해 보세요'
// 안내·프로필 공개는 같은 공지 문구
const PUSH_DEFAULTS: Record<MissionType, { push_title: string; push_body: string }> = {
  ANNOUNCEMENT: { push_title: DEFAULT_PUSH_TITLE, push_body: DEFAULT_PUSH_BODY },
  PROFILE_REVEAL: { push_title: DEFAULT_PUSH_TITLE, push_body: DEFAULT_PUSH_BODY },
  RECORDING: { push_title: RECORDING_PUSH_TITLE, push_body: RECORDING_PUSH_BODY },
  PAIR_CHAT: { push_title: PAIR_CHAT_PUSH_TITLE, push_body: PAIR_CHAT_PUSH_BODY },
}
/**
 * 유형에 맞는 푸시 기본 문구. 칸이 비었거나 다른 유형의 기본 문구 그대로면 바꿔 넣고, 운영자가 고친 문구는 둔다.
 */
export function pushDefaultsFor(type: MissionType, current: { push_title?: string | null; push_body?: string | null }) {
  const pick = (key: 'push_title' | 'push_body') => {
    const value = current[key]
    return !value || Object.values(PUSH_DEFAULTS).some((d) => d[key] === value) ? PUSH_DEFAULTS[type][key] : value
  }
  return { push_title: pick('push_title'), push_body: pick('push_body') }
}

// 1:1 대화 시작 글 기본 문구. 끝 시각의 시(분이 있으면 분까지)를 넣고, 끝 시각을 아직 안 골랐으면 22시로 둔다
export function pairChatMessage(closesAt?: Dayjs | null) {
  const until = closesAt ? `${closesAt.hour()}시${closesAt.minute() ? ` ${closesAt.minute()}분` : ''}` : '22시'
  return `지금부터 ${until}까지 1:1 대화 시간이에요. 궁금했던 사람의 프로필을 눌러 말을 걸어 보세요.`
}
const PAIR_CHAT_MESSAGE = /^지금부터 \d{1,2}시( \d{1,2}분)?까지 1:1 대화 시간이에요\. 궁금했던 사람의 프로필을 눌러 말을 걸어 보세요\.$/
// 손대지 않은 기본 문구인지 (시각만 다른 것 포함). 운영자가 고친 글은 바꾸지 않으려고 본다
export const isPairChatMessage = (text?: string | null) => !!text && PAIR_CHAT_MESSAGE.test(text)

// 미션 일정 한 줄의 시각. 1:1 대화는 '시작 ~ 끝'이고, 끝이 다른 날이면 끝에 날짜를 붙인다
export function missionTimeLabel(m: Pick<RoomMission, 'type' | 'opens_at' | 'closes_at'>) {
  const opens = dayjs(m.opens_at)
  if (m.type !== 'PAIR_CHAT' || !m.closes_at) return opens.format('HH:mm')
  const closes = dayjs(m.closes_at)
  return `${opens.format('HH:mm')} ~ ${closes.format(closes.isSame(opens, 'day') ? 'HH:mm' : 'MM/DD HH:mm')}`
}

export const PUSH_TITLE_MAX = 15
export const PUSH_BODY_MAX = 30
export const MESSAGE_MAX = 500

// 시각 규칙: 'day' = 방 시작 날짜 + (day−1)일 + HH:mm / 'beforeFinal' = 최종선택 오픈 − hours
export type ScheduleTimeRule =
  | { kind: 'day'; day: number; hour: number; minute: number }
  | { kind: 'beforeFinal'; hours: number }

export interface ChatScheduleDefault {
  rule: ScheduleTimeRule
  reveal_fields: RevealField[]
  message_content: string
  push: boolean
  push_title: string | null
  push_body: string | null
}

// 1:1 대화(PAIR_CHAT)는 넣지 않는다. 방마다 방 상세 [미션 추가]에서 시작·끝을 정해 넣는다
export const CHAT_SCHEDULE_DEFAULTS: ChatScheduleDefault[] = [
  {
    rule: { kind: 'day', day: 1, hour: 8, minute: 0 },
    reveal_fields: [],
    message_content:
      '하루방이 열렸어요 ☁️ 잘 보이려고 힘들이지 말고 평소의 나를 영상에 담아봐요. 처음에는 가벼운 인사만 남겨도 충분합니다 💌',
    push: false,
    push_title: null,
    push_body: null,
  },
  {
    rule: { kind: 'day', day: 1, hour: 18, minute: 0 },
    reveal_fields: ['MBTI', 'INTO_NOW'],
    message_content: '서로의 MBTI 가 공개됐어요 👀 영상 속 모습이랑 맞는지, 요즘 빠져 있는 것도 같이 확인해봐요',
    push: false,
    push_title: null,
    push_body: null,
  },
  {
    rule: { kind: 'day', day: 2, hour: 12, minute: 0 },
    reveal_fields: ['AGE'],
    message_content: '서로의 나이가 공개됐어요 😊 영상으로 봤을 때랑 비슷한가요?',
    push: false,
    push_title: null,
    push_body: null,
  },
  {
    rule: { kind: 'day', day: 2, hour: 18, minute: 0 },
    reveal_fields: ['DEPARTMENT'],
    message_content: '서로의 학과가 공개됐어요 💙 겹치는 수업이나 건물 있는지 얘기해봐요',
    push: false,
    push_title: null,
    push_body: null,
  },
  {
    rule: { kind: 'beforeFinal', hours: 2 },
    reveal_fields: [],
    message_content:
      '2시간 뒤면 벌써 최종 선택이에요 ⏰ 아직 물어보지 못한 점과 어필하지 못한 게 있다면 지금 말해봐요!',
    push: true,
    push_title: '📢 하루 공지',
    push_body: '최종 선택까지 2시간 남았어요',
  },
]

// 규칙 → 시각. 기준 시각이 아직 없으면 undefined
export function resolveRunAt(rule: ScheduleTimeRule, startsAt?: Dayjs | null, finalOpensAt?: Dayjs | null) {
  if (rule.kind === 'day') {
    if (!startsAt) return undefined
    return startsAt
      .startOf('day')
      .add(rule.day - 1, 'day')
      .hour(rule.hour)
      .minute(rule.minute)
  }
  if (!finalOpensAt) return undefined
  return finalOpensAt.subtract(rule.hours, 'hour').second(0).millisecond(0)
}

// DAY 표기 = 방 시작 기준 달력 날짜 차 + 1
export function dayOf(runAt?: Dayjs | null, startsAt?: Dayjs | null) {
  if (!runAt || !startsAt) return undefined
  return runAt.startOf('day').diff(startsAt.startOf('day'), 'day') + 1
}

// 미션의 시작 글 = START 안내 중 살아 있는 것 우선, 가장 이른 것. 목록 한 줄과 미션 수정 창이 이 글을 미션과 함께 다룬다
export function startAnnouncementOf(announcements: MissionAnnouncement[]) {
  const starts = announcements
    .filter((a) => a.announcement_type === 'START')
    .sort((a, b) => a.run_at.localeCompare(b.run_at) || a.announcement_id - b.announcement_id)
  return starts.find((a) => a.status !== 'CANCELED') ?? starts[0] ?? null
}
