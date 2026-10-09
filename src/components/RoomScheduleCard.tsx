import { useState } from 'react'
import { Alert, Button, Card, Empty, Image, Space, Table, Tag, Typography, theme } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useRoomMissions, type RoomMissionRow } from '../api/queries'
import type { AnnouncementStatus, MissionAnnouncement, RoomDetail, RoomMission } from '../api/types'
import { REVEAL_LABEL, dayOf } from '../config/chatScheduleDefaults'
import { AnnouncementStatusTag, AnnouncementTypeTag, MissionStatusTag, MissionTypeTag } from './StatusTag'
import MissionModal from './MissionModal'
import AnnouncementModal from './AnnouncementModal'
import { useMissionActions } from './useMissionActions'

const PAST: AnnouncementStatus[] = ['SENT', 'CANCELED', 'FAILED']
const isPast = (a: MissionAnnouncement) => PAST.includes(a.status)
const isDone = (m: RoomMission) => m.status === 'CLOSED' || m.status === 'CANCELED'
const byTime = (a: string, b: string) => dayjs(a).valueOf() - dayjs(b).valueOf()
// 이모지(서로게이트 쌍)가 안 깨지게 코드포인트 단위로 자름
const ellipsis = (s: string, n = 30) => {
  const chars = Array.from(s)
  return chars.length > n ? `${chars.slice(0, n).join('')}…` : s
}
const notButton = (e: React.MouseEvent) => !(e.target as HTMLElement).closest('button, .ant-image')

type MissionModalState = { open: boolean; mission: RoomMission | null }
type AnnouncementModalState = { open: boolean; mission: RoomMission | null; announcement: MissionAnnouncement | null }

// E1 방 상세 > 방 편성 카드. 미션 목록 + 미션별 안내 목록
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
  const { data, isLoading, isError } = useRoomMissions(roomId)
  const actions = useMissionActions(roomId, room)
  const [missionModal, setMissionModal] = useState<MissionModalState>({ open: false, mission: null })
  const [announcementModal, setAnnouncementModal] = useState<AnnouncementModalState>({
    open: false,
    mission: null,
    announcement: null,
  })
  const [collapsed, setCollapsed] = useState<number[]>([])

  const roomClosed = room.status === 'ENDED' || room.status === 'CANCELLED'
  const startsAt = room.starts_at ? dayjs(room.starts_at) : null
  const rows = [...(data ?? [])].sort((a, b) => byTime(a.mission.opens_at, b.mission.opens_at))
  const pastStyle = { color: token.colorTextTertiary, background: token.colorFillQuaternary }

  const openMission = (mission: RoomMission | null) => setMissionModal({ open: true, mission })
  const openAnnouncement = (mission: RoomMission, announcement: MissionAnnouncement | null) =>
    setAnnouncementModal({ open: true, mission, announcement })
  // 시작 전 미션만 수정 가능. 안내 추가는 취소·방 종료 전까지
  const canEdit = (m: RoomMission) => m.status === 'SCHEDULED' && dayjs().isBefore(dayjs(m.opens_at))
  const canAnnounce = (m: RoomMission) => m.status !== 'CANCELED' && !roomClosed

  const columns: ColumnsType<RoomMissionRow> = [
    {
      title: '시작',
      key: 'opens_at',
      width: 110,
      render: (_, { mission: m }) => (
        <>
          {dayjs(m.opens_at).format('MM/DD HH:mm')}
          {m.closes_at && (
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>~ {dayjs(m.closes_at).format('MM/DD HH:mm')}</div>
          )}
        </>
      ),
    },
    {
      title: 'DAY',
      key: 'day',
      width: 70,
      render: (_, { mission: m }) => {
        const day = dayOf(dayjs(m.opens_at), startsAt)
        return day == null ? '-' : day <= 0 ? '시작 전' : day
      },
    },
    { title: '유형', key: 'type', width: 110, render: (_, { mission: m }) => <MissionTypeTag type={m.type} /> },
    {
      title: '내용',
      key: 'details',
      render: (_, { mission: m }) => {
        const fields = m.details?.reveal_fields ?? []
        const content = m.details?.content
        return (
          <Space size={8} align="center">
            {m.image && <Image src={m.image.url} alt="미션 사진" width={36} height={36} style={{ objectFit: 'cover', borderRadius: 6 }} />}
            {fields.length > 0 ? (
              <Space size={4} wrap>
                {fields.map((f) => (
                  <Tag key={f} color="gold" style={{ marginInlineEnd: 0 }}>
                    {REVEAL_LABEL[f] ?? f}
                  </Tag>
                ))}
              </Space>
            ) : content ? (
              <span title={content}>{ellipsis(content)}</span>
            ) : (
              '-'
            )}
          </Space>
        )
      },
    },
    { title: '상태', key: 'status', width: 80, render: (_, { mission: m }) => <MissionStatusTag status={m.status} /> },
  ]
  if (canWrite) {
    columns.push({
      title: '동작',
      key: 'actions',
      width: 210,
      render: (_, { mission: m }) => (
        <Space size={0}>
          {canEdit(m) && !roomClosed && (
            <Button type="link" size="small" onClick={() => openMission(m)}>
              수정
            </Button>
          )}
          {canAnnounce(m) && (
            <Button type="link" size="small" onClick={() => openAnnouncement(m, null)}>
              안내 추가
            </Button>
          )}
          {!isDone(m) && !roomClosed && (
            <Button type="link" size="small" danger onClick={() => actions.cancelMission(m)}>
              취소
            </Button>
          )}
        </Space>
      ),
    })
  }

  const announcementColumns = (m: RoomMission): ColumnsType<MissionAnnouncement> => {
    const cols: ColumnsType<MissionAnnouncement> = [
      { title: '용도', dataIndex: 'announcement_type', width: 90, render: (_, a) => <AnnouncementTypeTag type={a.announcement_type} /> },
      { title: '시각', dataIndex: 'run_at', width: 100, render: (v: string) => dayjs(v).format('MM/DD HH:mm') },
      {
        title: '채팅 글',
        dataIndex: 'content',
        render: (v: string | null, a) => (
          <>
            {v ? <span title={v}>{ellipsis(v, 40)}</span> : '-'}
            {a.message_deleted_at && <Tag style={{ marginInlineStart: 6 }}>삭제됨</Tag>}
          </>
        ),
      },
      { title: '푸시', dataIndex: 'push', width: 64, render: (v: boolean) => (v ? 'ON' : 'OFF') },
      {
        title: '상태',
        dataIndex: 'status',
        width: 80,
        render: (s: AnnouncementStatus, a) => <AnnouncementStatusTag status={s} failReason={a.fail_reason} />,
      },
    ]
    if (canWrite) {
      cols.push({
        title: '동작',
        key: 'actions',
        width: 210,
        render: (_, a) => {
          if (a.status === 'SCHEDULED') {
            return (
              <Space size={0}>
                {canAnnounce(m) && (
                  <Button type="link" size="small" onClick={() => openAnnouncement(m, a)}>
                    수정
                  </Button>
                )}
                {/* 시작 전 미션의 안내는 지금 보낼 수 없다 */}
                {canAnnounce(m) && !dayjs().isBefore(dayjs(m.opens_at)) && (
                  <Button type="link" size="small" onClick={() => actions.sendNow(a)}>
                    지금 보내기
                  </Button>
                )}
                <Button type="link" size="small" onClick={() => actions.cancelAnnouncement(a)}>
                  취소
                </Button>
              </Space>
            )
          }
          if (a.status === 'SENT' && a.sent_message_id != null && !a.message_deleted_at) {
            return (
              <Button type="link" size="small" danger onClick={() => actions.deleteMessage(a)}>
                삭제
              </Button>
            )
          }
          return null
        },
      })
    }
    return cols
  }

  return (
    <Card
      title="방 편성"
      extra={
        canWrite &&
        !roomClosed && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openMission(null)}>
            미션 추가
          </Button>
        )
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        방 생성 때 넣은 채팅 편성이 미션으로 들어옴. 미션은 시작 전까지만 수정, 채팅 글과 푸시는 미션별 안내에서 수정. 공개는 시각이 지나면 되돌릴 수 없음
      </Typography.Paragraph>
      {isError ? (
        <Alert type="error" showIcon title="방 편성을 불러오지 못했습니다." />
      ) : (
        <Table<RoomMissionRow>
          rowKey={(r) => r.mission.mission_id}
          size="small"
          loading={isLoading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 760 }}
          expandable={{
            expandedRowKeys: rows.map((r) => r.mission.mission_id).filter((id) => !collapsed.includes(id)),
            onExpand: (expanded, r) =>
              setCollapsed((prev) =>
                expanded ? prev.filter((id) => id !== r.mission.mission_id) : [...prev, r.mission.mission_id],
              ),
            expandedRowRender: ({ mission: m, announcements }) =>
              announcements.length === 0 ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  안내 없음 (채팅 글 없이 미션만 열림)
                </Typography.Text>
              ) : (
                <Table<MissionAnnouncement>
                  rowKey="announcement_id"
                  size="small"
                  columns={announcementColumns(m)}
                  dataSource={[...announcements].sort((a, b) => byTime(a.run_at, b.run_at))}
                  pagination={false}
                  onRow={(a) => ({
                    style: isPast(a) ? pastStyle : undefined,
                    // 지난 안내는 눌러서 읽기 전용으로 열어봄
                    onClick: (e) => {
                      if (isPast(a) && notButton(e)) openAnnouncement(m, a)
                    },
                  })}
                />
              ),
          }}
          onRow={({ mission: m }) => ({
            style: isDone(m) ? pastStyle : undefined,
            // 수정할 수 없는 미션은 눌러서 읽기 전용으로 열어봄
            onClick: (e) => {
              if (!canEdit(m) && notButton(e)) openMission(m)
            },
          })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="편성 없음" /> }}
        />
      )}
      <MissionModal
        open={missionModal.open}
        roomId={roomId}
        room={room}
        mission={missionModal.mission}
        canWrite={canWrite}
        onClose={() => setMissionModal({ open: false, mission: null })}
      />
      <AnnouncementModal
        open={announcementModal.open}
        roomId={roomId}
        room={room}
        mission={announcementModal.mission}
        announcement={announcementModal.announcement}
        canWrite={canWrite}
        onClose={() => setAnnouncementModal({ open: false, mission: null, announcement: null })}
      />
    </Card>
  )
}
