import type { Dayjs } from 'dayjs'
import type { RevealField } from '../api/types'

// 채팅 P0 기본 편성 (채팅 P0 기능명세 §F3). 서버엔 기본값 없음.
// 방 생성 모달 [채팅 편성] 에 채워져 뜨고, 고친 채로 POST /rooms 의 chat_schedule[] 로 감.

export const REVEAL_FIELDS: RevealField[] = ['MBTI', 'INTO_NOW', 'AGE', 'DEPARTMENT']
export const REVEAL_LABEL: Record<RevealField, string> = {
  MBTI: 'MBTI',
  INTO_NOW: '요즘 빠져 있는 것',
  AGE: '나이',
  DEPARTMENT: '학과',
}

// 푸시를 켰을 때 채워 넣는 기본 문구
export const DEFAULT_PUSH_TITLE = '📢 하루 공지'
export const DEFAULT_PUSH_BODY = '방 채팅에 새 공지가 올라왔어요'

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
