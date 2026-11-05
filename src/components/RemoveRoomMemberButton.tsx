import { App, Button, Input, Space, Typography } from 'antd'
import { useRemoveRoomMember } from '../api/queries'
import type { RoomMember } from '../api/types'
export function RemoveRoomMemberButton({ roomId, member }: { roomId: number; member: RoomMember }) {
  const { modal, message } = App.useApp()
  const remove = useRemoveRoomMember(roomId)
  const confirm = () => {
    let reason = ''
    modal.confirm({
      title: `${member.pseudonym ?? member.nickname ?? '참가자'} 님을 이 방에서 퇴장시킬까요?`,
      content: <Space direction="vertical">
        <Typography.Text>이 방의 접근과 관련 기록·1:1 대화가 앱에서 사라집니다. 원본은 보관하며 다른 방의 활동은 유지합니다. 같은 방에는 다시 입장할 수 없습니다.</Typography.Text>
        <Input.TextArea aria-label="퇴장 사유" placeholder="관리자용 사유 (선택)" maxLength={200} onChange={e => { reason = e.target.value }} />
      </Space>,
      okText: '퇴장시키기', okButtonProps: { danger: true }, cancelText: '취소',
      onOk: async () => {
        try { await remove.mutateAsync({ memberId: member.member_id, reason }); message.success('퇴장 처리하고 관련 기록을 앱에서 숨겼습니다.') }
        catch (e) { message.error(e instanceof Error ? e.message : '퇴장 처리에 실패했습니다.'); throw e }
      },
    })
  }
  return <Button size="small" danger loading={remove.isPending} onClick={confirm}>퇴장</Button>
}
