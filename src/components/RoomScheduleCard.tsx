import { useState } from 'react'
import { Alert, Button, Card, Empty, Space, Table, Tag, Typography, theme } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useRoomSchedule } from '../api/queries'
import type { RevealField, RoomDetail, RoomScheduleItem, ScheduleStatus } from '../api/types'
import { REVEAL_LABEL } from '../config/chatScheduleDefaults'
import { ScheduleStatusTag } from './StatusTag'
import ScheduleItemModal, { useScheduleActions } from './ScheduleItemModal'

const PAST: ScheduleStatus[] = ['SENT', 'CANCELED', 'FAILED']
const isPast = (r: RoomScheduleItem) => PAST.includes(r.status)
// 이모지(서로게이트 쌍)가 안 깨지게 코드포인트 단위로 자름
const ellipsis = (s: string, n = 30) => {
  const chars = Array.from(s)
  return chars.length > n ? `${chars.slice(0, n).join('')}…` : s
}

// E1 방 상세 > 방 편성 카드
export default function RoomScheduleCard({
  roomId,
  room,
  canWrite,
}: {
  roomId: number
  room: RoomDetail
  canWrite: boolean
}) {
  const { token } = theme.useToken()
  const { data, isLoading, isError } = useRoomSchedule(roomId)
  const actions = useScheduleActions(roomId, room)
  const [modal, setModal] = useState<{ open: boolean; item: RoomScheduleItem | null }>({ open: false, item: null })

  const roomClosed = room.status === 'ENDED' || room.status === 'CANCELLED'
  const rows = [...(data ?? [])].sort((a, b) => dayjs(a.run_at).valueOf() - dayjs(b.run_at).valueOf())
  const openModal = (item: RoomScheduleItem | null) => setModal({ open: true, item })

  const columns: ColumnsType<RoomScheduleItem> = [
    { title: '시각', dataIndex: 'run_at', width: 100, render: (v: string) => dayjs(v).format('MM/DD HH:mm') },
    { title: 'DAY', dataIndex: 'day', width: 60, render: (v: number | null) => (v == null ? '-' : v <= 0 ? '시작 전' : v) },
    {
      title: '공개 항목',
      dataIndex: 'reveal_fields',
      width: 150,
      render: (v: RevealField[] | null) =>
        v && v.length > 0 ? (
          <Space orientation="vertical" size={4}>
            {v.map((f) => (
              <Tag key={f} color="gold" style={{ marginInlineEnd: 0 }}>
                {REVEAL_LABEL[f] ?? f}
              </Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '운영 글',
      dataIndex: 'message_content',
      render: (v: string | null, r) => (
        <>
          {v ? <span title={v}>{ellipsis(v)}</span> : '-'}
          {r.message_deleted_at && (
            <Tag style={{ marginInlineStart: 6 }}>삭제됨</Tag>
          )}
        </>
      ),
    },
    { title: '푸시', dataIndex: 'push', width: 64, render: (v: boolean) => (v ? 'ON' : 'OFF') },
    {
      title: '상태',
      dataIndex: 'status',
      width: 80,
      render: (s: ScheduleStatus, r) => <ScheduleStatusTag status={s} failReason={r.fail_reason} />,
    },
  ]
  if (canWrite) {
    columns.push({
      title: '동작',
      key: 'actions',
      width: 200,
      render: (_, r) => {
        if (r.status === 'SCHEDULED') {
          return (
            <Space size={0}>
              <Button type="link" size="small" onClick={() => openModal(r)}>
                수정
              </Button>
              <Button type="link" size="small" onClick={() => actions.sendNow(r)}>
                지금 보내기
              </Button>
              <Button type="link" size="small" onClick={() => actions.cancel(r)}>
                취소
              </Button>
            </Space>
          )
        }
        if (r.status === 'SENT' && r.sent_message_id != null && !r.message_deleted_at) {
          return (
            <Button type="link" size="small" danger onClick={() => actions.deleteMessage(r)}>
              삭제
            </Button>
          )
        }
        return null
      },
    })
  }

  return (
    <Card
      title="방 편성"
      extra={
        canWrite &&
        !roomClosed && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
            글 추가
          </Button>
        )
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        방 생성 때 넣은 채팅 편성이 그대로 들어옴. 시각과 문구는 여기서 방마다 수정. 공개는 시각이 지나면 되돌릴 수 없음
      </Typography.Paragraph>
      {isError ? (
        <Alert type="error" showIcon title="방 편성을 불러오지 못했습니다." />
      ) : (
        <Table<RoomScheduleItem>
          rowKey="id"
          size="small"
          loading={isLoading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          rowClassName={(r) => (isPast(r) ? 'room-schedule-row-past' : '')}
          onRow={(r) => ({
            style: isPast(r) ? { color: token.colorTextTertiary, background: token.colorFillQuaternary } : undefined,
            // 지난 행은 눌러서 읽기 전용으로 열어봄 (E2-3)
            onClick: (e) => {
              if (isPast(r) && !(e.target as HTMLElement).closest('button')) openModal(r)
            },
          })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="편성 없음" /> }}
        />
      )}
      <ScheduleItemModal
        open={modal.open}
        roomId={roomId}
        room={room}
        item={modal.item}
        canWrite={canWrite}
        onClose={() => setModal({ open: false, item: null })}
      />
    </Card>
  )
}
