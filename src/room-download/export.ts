import { strToU8, zipSync } from 'fflate'
import type { Paged, RoomActivity, RoomDetail } from '../api/types'

export const MAX_EVENTS = 20_000
export const MAX_VIDEOS = 100
export const MAX_BYTES = 150 * 1024 * 1024
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024
export class ExportError extends Error {}
const PAGE_SIZE = 100
const MAX_PAGES = MAX_EVENTS / PAGE_SIZE

type Options = { day?: number; userId?: number; includeVideos: boolean }
type FetchPage = (page: number, signal: AbortSignal) => Promise<Paged<RoomActivity>>
type Progress = (message: string) => void

export async function collectActivities(fetchPage: FetchPage, cutoff: number, signal: AbortSignal): Promise<RoomActivity[]> {
  const unique = new Map<string, RoomActivity>()
  let total = -1
  let pages = -1
  for (let page = 0; page < MAX_PAGES; page++) {
    signal.throwIfAborted()
    const result = await fetchPage(page, signal)
    const meta = result.page
    if (!meta || !Number.isInteger(meta.total_elements) || meta.total_elements < 0 || meta.total_elements > MAX_EVENTS || !Number.isInteger(meta.total_pages) || meta.total_pages < 0 || meta.total_pages > MAX_PAGES || meta.page !== page || meta.total_pages !== Math.ceil(meta.total_elements / PAGE_SIZE) || (total !== -1 && (total !== meta.total_elements || pages !== meta.total_pages))) throw new ExportError('활동 목록이 변경되었거나 허용 범위를 넘었습니다. 다시 시도해 주세요.')
    total = meta.total_elements
    pages = meta.total_pages
    const expected = Math.min(PAGE_SIZE, total - page * PAGE_SIZE)
    if (result.content.length !== expected) throw new ExportError('일부 활동을 받지 못했습니다. 다시 시도해 주세요.')
    for (const event of result.content) {
      const key = `${event.type}-${event.id}`
      if (unique.has(key)) throw new ExportError('활동 목록이 조회 중 변경되었습니다. 다시 시도해 주세요.')
      unique.set(key, event)
    }
    if (page + 1 >= pages) {
      if (unique.size !== total) throw new ExportError('전체 활동 수가 일치하지 않습니다. 다시 시도해 주세요.')
      return [...unique.values()].filter(event => {
        const timestamp = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(event.occurred_at) ? event.occurred_at : `${event.occurred_at}+09:00`)
        if (!Number.isFinite(timestamp)) throw new ExportError('활동 시각을 확인할 수 없습니다.')
        return timestamp <= cutoff
      })
    }
  }
  throw new ExportError('활동 페이지가 허용 범위를 넘었습니다.')
}

export function safeVideoUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !/^(haruharu-prod-media|haruharu-dev-media)\.s3\.ap-northeast-2\.amazonaws\.com$/.test(url.hostname)) return null
    return url.href
  } catch { return null }
}

function selected(events: RoomActivity[], userId?: number) {
  return events.filter(e => (e.type === 'CHAT' || (e.type === 'VIDEO' && e.video && !e.video.hidden)) && (userId == null || e.actor?.user_id === userId))
}

async function readVideo(url: string, signal: AbortSignal, available: number): Promise<{ data: Uint8Array; extension: string }> {
  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' })
  if (!response.ok) throw new Error(response.status === 403 ? '링크 만료 또는 접근 거부' : '영상 요청 실패')
  if (!response.body) throw new ExportError('영상 데이터를 읽을 수 없습니다')
  const limit = Math.min(MAX_VIDEO_BYTES, available)
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) { await response.body.cancel(); throw new ExportError('영상 크기 제한 초과') }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) throw new ExportError('영상 크기 제한 초과')
      chunks.push(value)
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const extension = contentType === 'video/quicktime' ? 'mov' : contentType === 'video/mp4' ? 'mp4' : 'bin'
  return { data: bytes, extension }
}

export async function createRoomArchive(room: RoomDetail, options: Options, fetchPage: FetchPage, signal: AbortSignal, progress: Progress) {
  const cutoff = Date.now()
  progress('활동 목록을 확인하고 있습니다.')
  const events = selected(await collectActivities(fetchPage, cutoff, signal), options.userId)
  if (events.some(e => !Number.isSafeInteger(e.id) || e.id <= 0 || (e.type === 'VIDEO' && (!Number.isSafeInteger(e.video?.id) || e.video!.id <= 0)))) throw new ExportError('활동 식별자를 확인할 수 없습니다.')
  const videos = events.filter(e => e.type === 'VIDEO' && e.video)
  if (options.includeVideos && videos.length > MAX_VIDEOS) throw new ExportError(`영상이 ${MAX_VIDEOS}개를 초과합니다. 일차 또는 참여자를 선택해 주세요.`)
  const files: Record<string, Uint8Array> = {}
  const videoPaths = new Map<number, string>()
  const failures: { video_id: number; reason: string }[] = []
  let totalBytes = 0
  if (options.includeVideos) {
    for (const [index, event] of videos.entries()) {
      signal.throwIfAborted()
      const video = event.video!
      progress(`영상 다운로드 중 ${index + 1} / ${videos.length}`)
      const url = safeVideoUrl(video.video_url)
      if (!url) { failures.push({ video_id: video.id, reason: '허용되지 않은 영상 주소' }); continue }
      try {
        const { data, extension } = await readVideo(url, signal, MAX_BYTES - totalBytes)
        const path = `videos/${video.id}.${extension}`
        files[path] = data
        videoPaths.set(video.id, path)
        totalBytes += data.length
      } catch (error) {
        signal.throwIfAborted()
        failures.push({ video_id: video.id, reason: error instanceof Error && ['링크 만료 또는 접근 거부', '영상 요청 실패', '영상 데이터를 읽을 수 없습니다', '영상 크기 제한 초과'].includes(error.message) ? error.message : '영상 다운로드 실패' })
      }
    }
  }
  // 영상 포함 여부와 관계없이 채팅/영상의 삭제 또는 숨김을 확인한다.
  progress('현재 공개 상태를 다시 확인하고 있습니다.')
  const current = selected(await collectActivities(fetchPage, Date.now(), signal), options.userId)
  const visible = new Set(current.map(e => `${e.type}-${e.id}`))
  if (events.some(e => !visible.has(`${e.type}-${e.id}`))) throw new ExportError('다운로드 중 활동이 숨김 또는 삭제되었습니다. 다시 시도해 주세요.')
  signal.throwIfAborted()
  const people = new Map(room.members.map(m => [m.user_id, m.pseudonym || null]))
  const exported = events.map(e => ({
    type: e.type, id: e.id, occurred_at: e.occurred_at, day: e.day,
    user_id: e.actor?.user_id ?? null, pseudonym: e.actor ? people.get(e.actor.user_id) ?? null : null,
    ...(e.type === 'CHAT' ? { content: e.content, reply_type: e.reply_type ?? null } : { video_id: e.video!.id, caption: e.video!.caption, mission_id: e.video!.mission_id, slot_start: e.video!.slot_start, file: videoPaths.get(e.video!.id) ?? null }),
  }))
  const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2))
  files['manifest.json'] = json({ room_id: room.room_id, room_started_at: room.starts_at ?? room.started_at ?? null, room_ended_at: room.ends_at ?? room.ended_at ?? null, room_actual_started_at: room.started_at ?? null, room_actual_ended_at: room.ended_at ?? null, total_days: room.total_days ?? null, participants: room.members.filter(m => options.userId == null || m.user_id === options.userId).map(m => ({ user_id: m.user_id, pseudonym: m.pseudonym || null, joined_at: m.joined_at ?? null })), snapshot_at: new Date(cutoff).toISOString(), day: options.day ?? null, user_id: options.userId ?? null, include_videos: options.includeVideos, event_count: exported.length, video_count: videos.length, failed_video_count: failures.length, status: failures.length ? 'partial' : 'complete', note: '현재 조회된 상태의 스냅샷이며 과거 수정 이력은 포함하지 않습니다. 답장 종류만 제공되며 대상 ID는 제공되지 않습니다.' })
  files['events.json'] = json(exported)
  if (files['events.json'].byteLength > 10 * 1024 * 1024) throw new ExportError('활동 자료가 너무 큽니다. 일차 또는 참여자를 선택해 주세요.')
  files['failures.json'] = json(failures)
  files['읽는법.txt'] = strToU8('이 자료는 다운로드 시작 시각을 기준으로 조회한 현재 스냅샷입니다. 과거 수정 이력은 포함하지 않습니다.\nevents.json에는 그룹 채팅과 공개 영상 메타데이터가 시간순으로 담깁니다. videos 폴더에는 다운로드한 원본 영상이 있습니다. 답장 종류만 제공되며 대상 ID는 제공되지 않습니다. failures.json에서 받지 못한 영상과 사유를 확인하세요. 개인 프로필, 익명질문, 최종 선택, 1:1 채팅은 포함하지 않습니다.\n')
  progress('압축 파일을 만들고 있습니다.')
  const archive = zipSync(files, { level: 0 })
  signal.throwIfAborted()
  return { archive, failures, videoCount: videos.length }
}
