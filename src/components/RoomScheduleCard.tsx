import { useState } from 'react'
import { Alert, Button, Card, Dropdown, Empty, Image, Skeleton, Space, Tag, Tooltip, Typography, theme } from 'antd'
import { BellOutlined, EnterOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import dayjs from 'dayjs'
import { useRoomMissions, type RoomMissionRow } from '../api/queries'
import type { AnnouncementStatus, MissionAnnouncement, RoomDetail, RoomMission } from '../api/types'
import { REVEAL_LABEL, dayOf, startAnnouncementOf } from '../config/chatScheduleDefaults'
import { AnnouncementStatusTag, AnnouncementTypeTag, MissionStatusTag, MissionTypeTag } from './StatusTag'
import MissionModal from './MissionModal'
import AnnouncementModal from './AnnouncementModal'
import { useMissionActions } from './useMissionActions'

const PAST: AnnouncementStatus[] = ['SENT', 'CANCELED', 'FAILED']
const isPast = (a: MissionAnnouncement) => PAST.includes(a.status)
const isDone = (m: RoomMission) => m.status === 'CLOSED' || m.status === 'CANCELED'
const byTime = (a: string, b: string) => dayjs(a).valueOf() - dayjs(b).valueOf()
const notButton = (e: React.MouseEvent) => !(e.target as HTMLElement).closest('button, .ant-image, .ant-dropdown')
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

type MissionModalState = { open: boolean; mission: RoomMission | null; start: MissionAnnouncement | null }
type AnnouncementModalState = { open: boolean; mission: RoomMission | null; announcement: MissionAnnouncement | null }

// E1 방 상세 > 미션 일정 카드. 일차별 한 줄 = 미션 하나(시작 글 포함), 추가 글만 아래 작은 줄
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
  const [missionModal, setMissionModal] = useState<MissionModalState>({ open: false, mission: null, start: null })
  const [announcementModal, setAnnouncementModal] = useState<AnnouncementModalState>({
    open: false,
    mission: null,
    announcement: null,
  })

  const roomClosed = room.status === 'ENDED' || room.status === 'CANCELLED'
  const startsAt = room.starts_at ? dayjs(room.starts_at) : null
  const rows = [...(data ?? [])].sort((a, b) => byTime(a.mission.opens_at, b.mission.opens_at))

  const openMission = (mission: RoomMission | null, start: MissionAnnouncement | null = null) =>
    setMissionModal({ open: true, mission, start })
  const openAnnouncement = (mission: RoomMission, announcement: MissionAnnouncement | null) =>
    setAnnouncementModal({ open: true, mission, announcement })
  // 시작 전 미션만 수정 가능. 글 추가는 취소·방 종료 전까지
  const canEdit = (m: RoomMission) => m.status === 'SCHEDULED' && dayjs().isBefore(dayjs(m.opens_at)) && !roomClosed
  const canAnnounce = (m: RoomMission) => m.status !== 'CANCELED' && !roomClosed
  const started = (m: RoomMission) => !dayjs().isBefore(dayjs(m.opens_at))
  const canDelete = (a: MissionAnnouncement) => a.status === 'SENT' && a.sent_message_id != null && !a.message_deleted_at

  // 날짜별 묶음 (같은 날 = 같은 일차)
  const groups: { key: string; label: string; rows: RoomMissionRow[] }[] = []
  for (const r of rows) {
    const at = dayjs(r.mission.opens_at)
    const key = at.format('YYYY-MM-DD')
    const day = dayOf(at, startsAt)
    const date = `${at.format('MM/DD')} (${WEEKDAYS[at.day()]})`
    const label = day == null ? date : day <= 0 ? `방 시작 전 · ${date}` : `${day}일차 · ${date}`
    const last = groups[groups.length - 1]
    if (last?.key === key) last.rows.push(r)
    else groups.push({ key, label, rows: [r] })
  }

  const scheduledCount = rows.filter((r) => r.mission.status === 'SCHEDULED').length
  const muted = { color: token.colorTextTertiary }

  const missionMenu = (m: RoomMission, start: MissionAnnouncement | null): MenuProps['items'] => {
    const items: NonNullable<MenuProps['items']> = []
    if (canAnnounce(m)) items.push({ key: 'add', label: '글 추가 예약', onClick: () => openAnnouncement(m, null) })
    // 시작 전 미션의 글은 지금 보낼 수 없다
    if (start?.status === 'SCHEDULED' && canAnnounce(m) && started(m))
      items.push({ key: 'now', label: '지금 보내기', onClick: () => actions.sendNow(start) })
    if (start && canDelete(start))
      items.push({ key: 'delete', label: '보낸 글 삭제', danger: true, onClick: () => actions.deleteMessage(start) })
    if (!isDone(m) && !roomClosed)
      items.push({ key: 'cancel', label: '미션 취소', danger: true, onClick: () => actions.cancelMission(m) })
    return items
  }

  const renderMission = ({ mission: m, announcements }: RoomMissionRow) => {
    const start = startAnnouncementOf(announcements)
    const extras = announcements.filter((a) => a !== start).sort((a, b) => byTime(a.run_at, b.run_at))
    const fields = m.details?.reveal_fields ?? []
    const text = start?.content ?? m.details?.content
    // 글이 이미 나갔거나(취소·실패 포함) 끝난 미션은 흐리게
    const done = isDone(m) || (start ? isPast(start) : started(m))
    const menu = canWrite ? missionMenu(m, start) : []
    return (
      <div key={m.mission_id} style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 12px',
            cursor: 'pointer',
            ...(done ? muted : {}),
          }}
          // 줄을 누르면 연다. 고칠 수 없는 미션은 읽기 전용으로 열린다
          onClick={(e) => notButton(e) && openMission(m, start)}
        >
          <div style={{ width: 48, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {dayjs(m.opens_at).format('HH:mm')}
          </div>
          <div style={{ width: 92, flexShrink: 0 }}>
            <MissionTypeTag type={m.type} />
          </div>
          {m.image && (
            <Image
              src={m.image.url}
              alt="미션 사진"
              width={32}
              height={32}
              style={{ objectFit: 'cover', borderRadius: 6 }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {fields.length > 0 && (
              <Space size={4} wrap style={{ marginBottom: text ? 2 : 0 }}>
                {fields.map((f) => (
                  <Tag key={f} color="gold" style={{ marginInlineEnd: 0 }}>
                    {REVEAL_LABEL[f] ?? f}
                  </Tag>
                ))}
              </Space>
            )}
            {text ? (
              <Typography.Text ellipsis={{ tooltip: text }} style={{ display: 'block', color: 'inherit' }}>
                {text}
              </Typography.Text>
            ) : (
              fields.length === 0 && '-'
            )}
            {m.closes_at && (
              <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                {dayjs(m.closes_at).format('MM/DD HH:mm')} 마감
              </div>
            )}
          </div>
          <Space size={8} style={{ flexShrink: 0 }}>
            {start?.push && (
              <Tooltip title={`푸시: ${start.push_title ?? ''} ${start.push_body ?? ''}`.trim()}>
                <BellOutlined style={{ color: token.colorTextSecondary }} />
              </Tooltip>
            )}
            {start?.message_deleted_at && <Tag style={{ marginInlineEnd: 0 }}>글 삭제됨</Tag>}
            {/* 글이 있는 미션은 글의 발송 상태, 취소됐거나 글이 없으면 미션 상태 */}
            {start && m.status !== 'CANCELED' && start.status !== 'CANCELED' ? (
              <AnnouncementStatusTag status={start.status} failReason={start.fail_reason} />
            ) : (
              <MissionStatusTag status={m.status} />
            )}
            {canWrite && (
              <div style={{ width: 76, display: 'flex', justifyContent: 'flex-end' }}>
                {canEdit(m) && (
                  <Button type="link" size="small" onClick={() => openMission(m, start)}>
                    수정
                  </Button>
                )}
                {menu && menu.length > 0 && (
                  <Dropdown menu={{ items: menu }} trigger={['click']} placement="bottomRight">
                    <Button type="text" size="small" icon={<MoreOutlined />} aria-label="더 보기" />
                  </Dropdown>
                )}
              </div>
            )}
          </Space>
        </div>
        {extras.map((a) => (
          <div
            key={a.announcement_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px 8px 72px',
              fontSize: 13,
              cursor: isPast(a) ? 'pointer' : undefined,
              color: isPast(a) ? token.colorTextTertiary : token.colorTextSecondary,
            }}
            // 지난 글은 눌러서 읽기 전용으로 열어봄
            onClick={(e) => isPast(a) && notButton(e) && openAnnouncement(m, a)}
          >
            <EnterOutlined style={{ transform: 'scaleX(-1)' }} />
            <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{dayjs(a.run_at).format('MM/DD HH:mm')}</span>
            <AnnouncementTypeTag type={a.announcement_type} />
            <Typography.Text ellipsis={{ tooltip: a.content ?? undefined }} style={{ flex: 1, minWidth: 0, color: 'inherit', fontSize: 13 }}>
              {a.content ?? '글 없음'}
            </Typography.Text>
            <Space size={8} style={{ flexShrink: 0 }}>
              {a.push && <BellOutlined />}
              {a.message_deleted_at && <Tag style={{ marginInlineEnd: 0 }}>삭제됨</Tag>}
              <AnnouncementStatusTag status={a.status} failReason={a.fail_reason} />
              {canWrite && (
                <div style={{ width: 76, display: 'flex', justifyContent: 'flex-end' }}>
                  {a.status === 'SCHEDULED' && canAnnounce(m) && (
                    <Button type="link" size="small" onClick={() => openAnnouncement(m, a)}>
                      수정
                    </Button>
                  )}
                  {(a.status === 'SCHEDULED' || canDelete(a)) && (
                    <Dropdown
                      trigger={['click']}
                      placement="bottomRight"
                      menu={{
                        items:
                          a.status === 'SCHEDULED'
                            ? [
                                ...(canAnnounce(m) && started(m)
                                  ? [{ key: 'now', label: '지금 보내기', onClick: () => actions.sendNow(a) }]
                                  : []),
                                { key: 'cancel', label: '예약 취소', danger: true, onClick: () => actions.cancelAnnouncement(a) },
                              ]
                            : [{ key: 'delete', label: '보낸 글 삭제', danger: true, onClick: () => actions.deleteMessage(a) }],
                      }}
                    >
                      <Button type="text" size="small" icon={<MoreOutlined />} aria-label="더 보기" />
                    </Dropdown>
                  )}
                </div>
              )}
            </Space>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card
      title={
        <Space size={8}>
          미션 일정
          {rows.length > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              {rows.length}개 · 예정 {scheduledCount}
            </Typography.Text>
          )}
        </Space>
      }
      extra={
        canWrite &&
        !roomClosed && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openMission(null)}>
            미션 추가
          </Button>
        )
      }
      styles={{ body: { padding: 0 } }}
    >
      {isError ? (
        <Alert type="error" showIcon title="미션 일정을 불러오지 못했습니다." style={{ margin: 16 }} />
      ) : isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} style={{ padding: 16 }} />
      ) : rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="미션 없음" />
      ) : (
        groups.map((g) => (
          <div key={g.key}>
            <div
              style={{
                padding: '6px 12px',
                fontSize: 12,
                color: token.colorTextSecondary,
                background: token.colorFillQuaternary,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              {g.label}
            </div>
            {g.rows.map(renderMission)}
          </div>
        ))
      )}
      <MissionModal
        open={missionModal.open}
        roomId={roomId}
        room={room}
        mission={missionModal.mission}
        start={missionModal.start}
        scheduledExtras={
          missionModal.mission
            ? (data ?? [])
                .find((r) => r.mission.mission_id === missionModal.mission!.mission_id)
                ?.announcements.filter((a) => a.status === 'SCHEDULED' && a !== missionModal.start) ?? []
            : []
        }
        canWrite={canWrite}
        onClose={() => setMissionModal({ open: false, mission: null, start: null })}
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
