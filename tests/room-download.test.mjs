import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync, strFromU8 } from 'fflate'
import { collectActivities, createRoomArchive, safeVideoUrl, MAX_VIDEO_BYTES } from '../src/room-download/export.ts'

const signal = () => new AbortController().signal
const event = (id, extra = {}) => ({ type: 'CHAT', id, occurred_at: '2026-01-01T12:00:00+09:00', day: 1, actor: { user_id: 1, name: '실명' }, target: null, content: '안녕', video: null, ...extra })
const page = (content, index, total) => ({ content, page: { page: index, size: 100, total_elements: total, total_pages: Math.ceil(total / 100) } })
const room = { room_id: 4, started_at: '2026-01-01T00:00:00', ended_at: '2026-01-03T00:00:00', total_days: 3, members: [{ user_id: 1, pseudonym: '가명', joined_at: '2026-01-01T01:00:00', nickname: '실명', profile_image_url: 'SECRET' }] }
const video = (id, hidden = false) => event(id, { type: 'VIDEO', content: null, video: { id, hidden, video_url: 'https://haruharu-prod-media.s3.ap-northeast-2.amazonaws.com/a?signature=SECRET', caption: '설명', mission_id: 3, slot_start: null, thumbnail_url: 'SECRET' } })

test('모든 페이지를 순서대로 수집하고 기준 시각 이후를 제외한다', async () => {
  const rows = Array.from({ length: 101 }, (_, i) => event(i + 1))
  rows[100] = event(101, { occurred_at: '2027-01-01T00:00:00+09:00' })
  const calls = []
  const result = await collectActivities(async p => { calls.push(p); return page(rows.slice(p * 100, (p + 1) * 100), p, 101) }, Date.parse('2026-06-01T00:00:00Z'), signal())
  assert.deepEqual(calls, [0, 1]); assert.equal(result.length, 100)
})
test('중간 페이지 실패, 중복, 잘못된 페이지 수는 완성으로 처리하지 않는다', async () => {
  await assert.rejects(collectActivities(async p => { if (p) throw Error('network'); return page(Array.from({ length: 100 }, (_, i) => event(i + 1)), 0, 101) }, Date.now(), signal()))
  await assert.rejects(collectActivities(async p => page(p ? [event(1)] : Array.from({ length: 100 }, (_, i) => event(i + 1)), p, 101), Date.now(), signal()))
  await assert.rejects(collectActivities(async () => ({ content: [], page: { page: 0, total_elements: 1, total_pages: 0 } }), Date.now(), signal()))
})
test('허용된 S3 HTTPS 주소만 사용한다', () => {
  assert.ok(safeVideoUrl('https://haruharu-prod-media.s3.ap-northeast-2.amazonaws.com/x?a=b'))
  for (const url of ['http://haruharu-prod-media.s3.ap-northeast-2.amazonaws.com/x', 'https://haruharu-prod-media.s3.ap-northeast-2.amazonaws.com.evil.com/x', 'https://other.s3.ap-northeast-2.amazonaws.com/x', 'https://user@haruharu-prod-media.s3.ap-northeast-2.amazonaws.com/x']) assert.equal(safeVideoUrl(url), null)
})
test('ZIP은 숨김 영상과 개인 필드 및 서명 URL을 제외한다', async () => {
  const rows = [event(1, { reply_type: 'VIDEO' }), video(2), video(3, true), event(4, { type: 'QUESTION', content: 'SECRET' })]
  const result = await createRoomArchive(room, { includeVideos: false }, async p => page(rows, p, rows.length), signal(), () => {})
  const zip = unzipSync(result.archive)
  const text = Object.values(zip).map(strFromU8).join('\n')
  assert.doesNotMatch(text, /SECRET|실명|signature/)
  const events = JSON.parse(strFromU8(zip['events.json']))
  assert.deepEqual(events.map(e => e.id), [1, 2]); assert.equal(events[0].pseudonym, '가명'); assert.equal(events[0].reply_type, 'VIDEO')
  const manifest = JSON.parse(strFromU8(zip['manifest.json'])); assert.equal(manifest.total_days, 3); assert.equal(manifest.participants[0].joined_at, '2026-01-01T01:00:00')
})
test('취소와 영상 크기 초과를 처리하고 실패 사유를 ZIP에 담는다', async () => {
  const controller = new AbortController(); controller.abort()
  await assert.rejects(collectActivities(async () => { throw Error('called') }, Date.now(), controller.signal))
  const original = globalThis.fetch
  globalThis.fetch = async (_url, opts) => { assert.equal(opts.credentials, 'omit'); assert.equal(opts.referrerPolicy, 'no-referrer'); return new Response(new Uint8Array(1), { headers: { 'content-length': String(MAX_VIDEO_BYTES + 1) } }) }
  try {
    const rows = [video(2)]
    const result = await createRoomArchive(room, { includeVideos: true }, async p => page(rows, p, rows.length), signal(), () => {})
    assert.equal(result.failures[0].reason, '영상 크기 제한 초과')
    const zip = unzipSync(result.archive); assert.equal(JSON.parse(strFromU8(zip['manifest.json'])).status, 'partial'); assert.ok(!zip['videos/2.mp4'])
  } finally { globalThis.fetch = original }
})
test('다운로드 중 숨김 전환은 ZIP 완성을 막는다', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(new Uint8Array([1]))
  let calls = 0
  try { await assert.rejects(createRoomArchive(room, { includeVideos: true }, async p => page([video(2, calls++ > 0)], p, 1), signal(), () => {}), /숨김 또는 삭제/) } finally { globalThis.fetch = original }
})

test('영상 미포함이어도 삭제된 채팅은 ZIP 완성을 막는다', async () => {
  let calls = 0
  await assert.rejects(createRoomArchive(room, { includeVideos: false }, async p => { const rows = calls++ ? [] : [event(1)]; return page(rows, p, rows.length) }, signal(), () => {}), /숨김 또는 삭제/)
})
test('QuickTime 원본과 파일 참조는 mov 확장자로 보존한다', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'video/quicktime' } })
  try {
    const rows = [video(2)]
    const result = await createRoomArchive(room, { includeVideos: true }, async p => page(rows, p, rows.length), signal(), () => {})
    const zip = unzipSync(result.archive)
    assert.ok(zip['videos/2.mov'])
    assert.equal(JSON.parse(strFromU8(zip['events.json']))[0].file, 'videos/2.mov')
  } finally { globalThis.fetch = original }
})

test('실제 시각이 없는 방은 예정 일정을 기준 시각으로 기록한다', async () => {
  const scheduled = { ...room, started_at: null, ended_at: null, starts_at: '2026-01-01T09:00:00', ends_at: '2026-01-04T09:00:00' }
  const result = await createRoomArchive(scheduled, { includeVideos: false }, async p => page([], p, 0), signal(), () => {})
  const manifest = JSON.parse(strFromU8(unzipSync(result.archive)['manifest.json']))
  assert.equal(manifest.room_started_at, scheduled.starts_at)
  assert.equal(manifest.room_ended_at, scheduled.ends_at)
  assert.equal(manifest.room_actual_started_at, null)
  assert.equal(manifest.room_actual_ended_at, null)
  assert.equal(manifest.total_days, 3)
})
