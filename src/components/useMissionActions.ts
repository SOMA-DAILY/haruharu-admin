import { App } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import {
  useCancelAnnouncement,
  useCancelMission,
  useDeleteAnnouncementMessage,
  useSendAnnouncementNow,
} from '../api/queries'
import { ApiError } from '../api/client'
import type { MissionAnnouncement, RoomDetail, RoomMission } from '../api/types'

const ref = (a: MissionAnnouncement) => ({ missionId: a.mission_id, id: a.announcement_id })

// 방 편성 카드와 미션·안내 모달이 같이 쓰는 확인창 + 409 처리
export function useMissionActions(roomId: number, room: RoomDetail) {
  const { message, modal } = App.useApp()
  const qc = useQueryClient()
  const cancelMissionMut = useCancelMission(roomId)
  const sendNowMut = useSendAnnouncementNow(roomId)
  const cancelMut = useCancelAnnouncement(roomId)
  const deleteMut = useDeleteAnnouncementMessage(roomId)

  // 409 면 토스트 + 재조회 후 true 반환 (호출부가 모달을 닫음)
  const handleError = (e: unknown, fallback: string) => {
    if (e instanceof ApiError && e.status === 409) {
      message.error(e.message)
      qc.invalidateQueries({ queryKey: ['room-missions', roomId] })
      return true
    }
    message.error(e instanceof ApiError ? e.message : fallback)
    return false
  }

  const confirmSendNow = (onOk: () => Promise<void>) =>
    modal.confirm({
      title: '지금 보낼까요?',
      content: room.status === 'PENDING' ? '방이 열릴 때 나가요' : undefined,
      okText: '보내기',
      cancelText: '닫기',
      onOk,
    })

  const sendNow = (a: MissionAnnouncement) =>
    confirmSendNow(async () => {
      try {
        await sendNowMut.mutateAsync(ref(a))
      } catch (e) {
        handleError(e, '지금 보내기에 실패했습니다.')
      }
    })

  const cancelAnnouncement = (a: MissionAnnouncement) =>
    modal.confirm({
      title: '예약한 글을 취소할까요?',
      okType: 'danger',
      okText: '예약 취소',
      cancelText: '닫기',
      onOk: async () => {
        try {
          await cancelMut.mutateAsync(ref(a))
        } catch (e) {
          handleError(e, '예약 취소에 실패했습니다.')
        }
      },
    })

  const deleteMessage = (a: MissionAnnouncement, after?: () => void) =>
    modal.confirm({
      title: '보낸 글을 지울까요?',
      okType: 'danger',
      okText: '삭제',
      cancelText: '닫기',
      onOk: async () => {
        try {
          await deleteMut.mutateAsync(ref(a))
          after?.()
        } catch (e) {
          handleError(e, '삭제에 실패했습니다.')
        }
      },
    })

  const cancelMission = (m: RoomMission) =>
    modal.confirm({
      title: '미션을 취소할까요?',
      content: '예약된 글도 함께 취소돼요. 되돌릴 수 없어요',
      okType: 'danger',
      okText: '미션 취소',
      cancelText: '닫기',
      onOk: async () => {
        try {
          await cancelMissionMut.mutateAsync(m.mission_id)
        } catch (e) {
          handleError(e, '미션 취소에 실패했습니다.')
        }
      },
    })

  const sendNowRaw = (a: MissionAnnouncement) => sendNowMut.mutateAsync(ref(a))

  return { sendNow, sendNowRaw, cancelAnnouncement, deleteMessage, cancelMission, confirmSendNow, handleError }
}
