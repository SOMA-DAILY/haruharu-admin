import { roomsApi } from './endpoints'
import type { RoomActivity } from './types'

// 완전한 목록만 분석에 사용한다. 중간 페이지 실패/갱신을 미업로드나 0건으로 해석하지 않는다.
export async function fetchRoomActivitySnapshot(roomId: number, day?: number, signal?: AbortSignal): Promise<RoomActivity[]> {
  const unique = new Map<string, RoomActivity>()
  let total: number | undefined
  for (let page = 0; ; page++) {
    signal?.throwIfAborted()
    const result = await roomsApi.activities(roomId, { day, page, size: 100, order: 'asc' }, signal)
    if (result.page.page !== page || (total != null && total !== result.page.total_elements)) {
      throw new Error('조회 중 활동 내역이 변경되었습니다. 다시 불러와 주세요.')
    }
    total = result.page.total_elements
    for (const event of result.content) unique.set(`${event.type}-${event.id}`, event)
    if (page + 1 >= result.page.total_pages) break
    if (!result.content.length) throw new Error('일부 활동 내역을 받지 못했습니다. 다시 불러와 주세요.')
  }
  if (unique.size !== total) throw new Error('전체 활동 내역이 일치하지 않습니다. 다시 불러와 주세요.')
  return [...unique.values()]
}
