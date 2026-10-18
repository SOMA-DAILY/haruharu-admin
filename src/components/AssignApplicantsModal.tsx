import { useState } from 'react'
import { Alert, App, Button, Modal, Select, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { ApiError } from '../api/client'
import { useAssignApplications, useRooms } from '../api/queries'
import type { CohortApplication, RoomListItem } from '../api/types'

const ERROR_TEXT: Record<string, string> = {
  ROOM_NOT_ASSIGNABLE: '끝났거나 취소된 방, 또는 기수가 없는 방입니다.',
  COHORT_APPLICATION_NOT_ASSIGNABLE: '넣을 수 없는 신청이 있습니다. 목록을 새로고침해 상태를 확인하세요.',
  ROOM_GENDER_CAPACITY_EXCEEDED: '방의 성별 정원을 넘습니다.',
}

const genderTag = (g: string | null) =>
  g ? <Tag color={g === 'FEMALE' ? 'magenta' : 'blue'}>{g === 'FEMALE' ? '여성' : '남성'}</Tag> : '-'

const roomLabel = (r: RoomListItem) =>
  [
    `#${r.room_id}`,
    r.started_at ? dayjs(r.started_at).format('MM/DD HH:mm') : r.scheduled_date,
    r.name,
    `지금 여 ${r.female_count} / 남 ${r.male_count}`,
    `정원 여 ${r.female_capacity ?? '-'} / 남 ${r.male_capacity ?? '-'}`,
  ]
    .filter(Boolean)
    .join(', ')

// 방에 넣기 (A4). 이 기수의 끝나지 않은 방만 고를 수 있다. 정원은 서버가 다시 검사한다(BE #516)
export default function AssignApplicantsModal({
  cohortId,
  applicants,
  open,
  onClose,
}: {
  cohortId: number
  applicants: CohortApplication[]
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [roomId, setRoomId] = useState<number>()
  const rooms = useRooms({ cohortId, size: 100 })
  const assign = useAssignApplications()
  const options = (rooms.data?.content ?? []).filter((r) => r.status !== 'ENDED' && r.status !== 'CANCELLED')
  const room = options.find((r) => r.room_id === roomId)

  const female = room ? room.female_count + applicants.filter((a) => a.gender === 'FEMALE').length : 0
  const male = room ? room.male_count + applicants.filter((a) => a.gender === 'MALE').length : 0
  const over =
    !!room &&
    ((room.female_capacity != null && female > room.female_capacity) ||
      (room.male_capacity != null && male > room.male_capacity))

  const close = () => {
    setRoomId(undefined)
    onClose()
  }
  const submit = async () => {
    try {
      await assign.mutateAsync({ roomId: roomId!, applicationIds: applicants.map((a) => a.application_id) })
      message.success(`${applicants.length}명을 #${roomId} 방에 넣었습니다.`)
      close()
    } catch (e) {
      message.error(e instanceof ApiError ? (ERROR_TEXT[e.code] ?? e.message) : '방에 넣지 못했습니다.')
    }
  }

  return (
    <Modal
      title={`방에 넣기 (${applicants.length}명)`}
      open={open}
      onCancel={close}
      width={720}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={close}>
          취소
        </Button>,
        <Button key="ok" type="primary" loading={assign.isPending} disabled={!room || over} onClick={submit}>
          {applicants.length}명 넣기
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 6 }}>방</div>
      <Select
        style={{ width: '100%', marginBottom: 16 }}
        placeholder={options.length === 0 && !rooms.isLoading ? '이 기수의 방이 없습니다. 방 생성에서 기수를 골라 만드세요.' : '방 선택'}
        loading={rooms.isLoading}
        value={roomId}
        onChange={setRoomId}
        options={options.map((r) => ({ value: r.room_id, label: roomLabel(r) }))}
      />
      <div style={{ marginBottom: 6 }}>넣을 사람</div>
      <Table<CohortApplication>
        rowKey="application_id"
        size="small"
        pagination={false}
        dataSource={applicants}
        columns={[
          { title: '이름 (PASS)', dataIndex: 'name' },
          { title: '성별', dataIndex: 'gender', render: genderTag },
          { title: '나이', dataIndex: 'age', render: (v: number | null) => v ?? '-' },
          { title: '학교 / 학과', key: 'school', render: (_, a) => `${a.school} / ${a.department}` },
          {
            title: '참여 이력',
            dataIndex: 'past_room_ids',
            render: (ids: number[]) => (ids.length ? ids.map((id) => `#${id}`).join(', ') : '처음'),
          },
        ]}
      />
      {room && (
        <Alert
          style={{ marginTop: 14 }}
          type={over ? 'error' : 'success'}
          message={
            <>
              넣은 뒤 #{room.room_id} = 여 {female} / 남 {male}{' '}
              <Typography.Text type="secondary">
                (정원 여 {room.female_capacity ?? '-'} / 남 {room.male_capacity ?? '-'})
              </Typography.Text>
              {over && ' 정원을 넘습니다'}
            </>
          }
        />
      )}
    </Modal>
  )
}
