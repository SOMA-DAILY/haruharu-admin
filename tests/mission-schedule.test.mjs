import assert from 'node:assert/strict'
import { test } from 'node:test'
import dayjs from 'dayjs'
import {
  DEFAULT_PUSH_BODY,
  DEFAULT_PUSH_TITLE,
  PAIR_CHAT_PUSH_BODY,
  PAIR_CHAT_PUSH_TITLE,
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
  RECORDING_PUSH_BODY,
  RECORDING_PUSH_TITLE,
  isPairChatMessage,
  missionTimeLabel,
  pairChatMessage,
  pushDefaultsFor,
} from '../src/config/chatScheduleDefaults.ts'

const pairChat = (opens_at, closes_at) => ({ type: 'PAIR_CHAT', opens_at, closes_at })

test('pair chat rows show start ~ end, with the end date only when it falls on another day', () => {
  assert.equal(missionTimeLabel(pairChat('2026-10-28T20:00:00', '2026-10-28T22:00:00')), '20:00 ~ 22:00')
  assert.equal(missionTimeLabel(pairChat('2026-10-28T23:00:00', '2026-10-29T01:30:00')), '23:00 ~ 10/29 01:30')
  // 다른 종류는 마감 시각이 있어도 시작 시각만
  assert.equal(missionTimeLabel({ type: 'RECORDING', opens_at: '2026-10-28T20:00:00', closes_at: '2026-10-28T22:00:00' }), '20:00')
  assert.equal(missionTimeLabel({ type: 'ANNOUNCEMENT', opens_at: '2026-10-28T08:00:00', closes_at: null }), '08:00')
})

test('push defaults follow the mission type and keep operator-edited text', () => {
  assert.deepEqual(pushDefaultsFor('PAIR_CHAT', {}), { push_title: PAIR_CHAT_PUSH_TITLE, push_body: PAIR_CHAT_PUSH_BODY })
  // 다른 종류의 기본 문구 그대로면 바꿔 넣는다 (양방향)
  assert.deepEqual(
    pushDefaultsFor('PAIR_CHAT', { push_title: RECORDING_PUSH_TITLE, push_body: DEFAULT_PUSH_BODY }),
    { push_title: PAIR_CHAT_PUSH_TITLE, push_body: PAIR_CHAT_PUSH_BODY },
  )
  assert.deepEqual(
    pushDefaultsFor('ANNOUNCEMENT', { push_title: PAIR_CHAT_PUSH_TITLE, push_body: PAIR_CHAT_PUSH_BODY }),
    { push_title: DEFAULT_PUSH_TITLE, push_body: DEFAULT_PUSH_BODY },
  )
  assert.deepEqual(pushDefaultsFor('PAIR_CHAT', { push_title: '오늘 밤 1:1', push_body: null }), {
    push_title: '오늘 밤 1:1',
    push_body: PAIR_CHAT_PUSH_BODY,
  })
  // 기존 종류는 그대로
  assert.deepEqual(pushDefaultsFor('RECORDING', { push_title: '', push_body: DEFAULT_PUSH_BODY }), {
    push_title: RECORDING_PUSH_TITLE,
    push_body: RECORDING_PUSH_BODY,
  })
  assert.deepEqual(pushDefaultsFor('PROFILE_REVEAL', { push_title: RECORDING_PUSH_TITLE }), {
    push_title: DEFAULT_PUSH_TITLE,
    push_body: DEFAULT_PUSH_BODY,
  })
  assert.ok(PAIR_CHAT_PUSH_TITLE.length <= PUSH_TITLE_MAX && PAIR_CHAT_PUSH_BODY.length <= PUSH_BODY_MAX)
})

test('pair chat start message uses the end time, falls back to 22시, and recognizes its own untouched text', () => {
  const tail = '까지 1:1 대화 시간이에요. 궁금했던 사람의 프로필을 눌러 말을 걸어 보세요.'
  assert.equal(pairChatMessage(), `지금부터 22시${tail}`)
  assert.equal(pairChatMessage(dayjs('2026-10-28T23:00:00')), `지금부터 23시${tail}`)
  assert.equal(pairChatMessage(dayjs('2026-10-29T09:30:00')), `지금부터 9시 30분${tail}`)
  for (const message of [pairChatMessage(), pairChatMessage(dayjs('2026-10-29T09:30:00'))]) assert.equal(isPairChatMessage(message), true)
  assert.equal(isPairChatMessage(`지금부터 22시${tail} 늦지 마세요!`), false)
  assert.equal(isPairChatMessage(''), false)
  assert.equal(isPairChatMessage(undefined), false)
})
