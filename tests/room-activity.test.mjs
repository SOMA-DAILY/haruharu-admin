import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSlots, roomStart, gridColumns, findChatSlot, relatedTo } from '../src/components/room-activity/model.ts'
const room = { status: 'ENDED', scheduled_date: '2026-10-19', starts_at: '2026-10-19T19:30:00', started_at: '2026-10-19T19:30:00', ends_at: '2026-10-22T19:30:00', ended_at: '2026-10-22T19:30:00', total_days: 3 }
const event = (type, time, overrides = {}) => ({ type, id: 1, occurred_at: time, actor: {user_id: 1}, target: {user_id: 2}, ...overrides })
test('6/8/10 participants keep 3/4/5 columns', () => {
  assert.deepEqual([6,8,10].map(gridColumns), [3,4,5])
})
test('all elapsed hours are present, including an entirely empty day', () => {
  const slots = buildSlots(room, [])
  assert.equal(slots.length,72)
  assert.deepEqual([slots[0].day, slots[23].day, slots[24].day, slots[71].day], [1,1,2,3])
  assert.equal(buildSlots(room, [], 2).length,24)
})
test('30 minute room anchor, exclusive hour boundary, late video and later reaction stay distinct', () => {
  const video = event('VIDEO','2026-10-20T19:38:00',{video:{slot_start:'2026-10-20T18:30:00'}})
  const reaction = event('REACTION','2026-10-20T19:30:00',{video:{slot_start:'2026-10-20T18:30:00'}})
  const slots=buildSlots(room,[video,reaction])
  assert.equal(slots[23].videos.length,1)
  assert.equal(slots[24].events.length,1)
  assert.equal(slots[23].events.length,0)
})
test('legacy 09:00 day anchor follows actual start, including pre-09:00 starts', () => {
  assert.equal(roomStart({...room,starts_at:null,started_at:'2026-10-20T08:00:00'}),new Date('2026-10-19T09:00:00').getTime())
})
test('continuous chat seeks within the transcript, including empty slots and participant filters', () => {
  const slots=buildSlots(room,[event('CHAT','2026-10-19T19:31:00',{target:null}),event('CHAT','2026-10-19T22:31:00',{id:2,actor:{user_id:2},target:null})])
  assert.equal(findChatSlot(slots,slots[0]).key,slots[0].key)
  assert.equal(findChatSlot(slots,slots[1]).key,slots[3].key)
  assert.equal(findChatSlot(slots,slots[71]).key,slots[3].key)
  assert.equal(findChatSlot(slots,slots[0],2).key,slots[3].key)
  assert.equal(findChatSlot(slots,slots[0],99),undefined)
  assert.equal(relatedTo(event('REACTION','2026-10-19T19:31:00'),2),true)
})
test('pending/future slots are not mislabeled as missed uploads and outside-period data is retained', () => {
  assert.equal(buildSlots({...room,status:'PENDING'},[]).length,0)
  const now=new Date('2026-10-19T20:00:00').getTime()
  assert.equal(buildSlots({...room,status:'ACTIVE'},[],undefined,now).length,1)
  assert.equal(buildSlots({...room,status:'SELECTING'},[],undefined,now).length,1)
  const slots=buildSlots(room,[event('CHAT','2026-10-19T18:00:00'),event('CHAT','2026-10-22T19:30:00',{id:2})])
  assert.equal(slots.length,74)
  assert.equal(slots[0].day,null)
  assert.equal(slots.at(-1).day,null)
})
