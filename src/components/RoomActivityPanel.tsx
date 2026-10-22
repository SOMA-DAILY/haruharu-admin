import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Alert, Avatar, Button, Card, Collapse, Empty, Image, Modal, Segmented, Select, Skeleton, Space, Table, Tag, Typography, theme } from 'antd'
import { HeartOutlined, MessageOutlined, PlayCircleOutlined, QuestionCircleOutlined, ReloadOutlined, VideoCameraOutlined, FullscreenOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { roomsApi } from '../api/endpoints'
import { useRoomActivities, useRoomActivitySummary } from '../api/queries'
import type { ActivityVideo, RoomActivity, RoomActivitySummary, RoomActivityType, RoomDetail } from '../api/types'
import { fetchRoomActivitySnapshot } from '../api/roomActivitySnapshot'
import VideoBoard from './room-activity/VideoBoard'
import { buildSlots, reactionEmoji } from './room-activity/model'
import './RoomActivityPanel.css'

const { Text, Title } = Typography
const labels: Record<RoomActivityType, string> = { VIDEO: '영상', CHAT: '채팅', REACTION: '반응', QUESTION: '익명질문' }

const icons = { VIDEO: <VideoCameraOutlined />, CHAT: <MessageOutlined />, REACTION: <HeartOutlined />, QUESTION: <QuestionCircleOutlined /> }

function mediaUrl(value: string | null) {
  if (!value) return undefined
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
}

function ParticipantPhoto({ url, name }: { url?: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  const src = mediaUrl(url ?? null)
  if (!src || failed) return <span className="activity-member-photo-empty" aria-label={failed ? '사진을 불러오지 못했습니다' : '프로필 사진 없음'} title={failed ? '사진을 불러오지 못했습니다' : '프로필 사진 없음'}>—</span>
  return <Image src={src} alt={`${name} 프로필 사진`} aria-label={`${name} 프로필 사진 확대`} width={44} height={44}
    classNames={{ root: 'activity-member-photo' }} loading="lazy" onError={() => setFailed(true)}
    preview={{ cover: <FullscreenOutlined /> }} />
}

function VideoThumbnail({ video, onOpen }: { video: ActivityVideo; onOpen: () => void }) {
  const [failed, setFailed] = useState(false)
  const src = mediaUrl(video.thumbnail_url)
  return (
    <button className="activity-thumbnail" onClick={onOpen} aria-label={`${video.caption || '영상'} 재생`}>
      {src && !failed ? <img src={src} alt={video.caption || '업로드된 영상 썸네일'} loading="lazy" onError={() => setFailed(true)} />
        : <span className="activity-thumbnail-empty"><VideoCameraOutlined /><span>썸네일 없음</span></span>}
      <span className="activity-play"><PlayCircleOutlined /></span>
      {video.hidden && <Tag className="activity-hidden">숨김 영상</Tag>}
    </button>
  )
}

function VideoPlayer({ video }: { video: ActivityVideo }) {
  const [failed, setFailed] = useState(false)
  const [fullscreenError, setFullscreenError] = useState(false)
  const player = useRef<HTMLVideoElement>(null)
  const src = mediaUrl(video.video_url)
  const fullscreen = async () => {
    const element = player.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!element) return
    try {
      if (element.requestFullscreen) await element.requestFullscreen()
      else if (element.webkitEnterFullscreen) element.webkitEnterFullscreen()
      else setFullscreenError(true)
    } catch { setFullscreenError(true) }
  }
  if (!src || failed) return <Alert type="warning" showIcon title="영상을 재생할 수 없습니다." description="파일이 삭제되었거나 링크가 만료되었을 수 있습니다. 새로고침 후 다시 확인해 주세요." />
  return <div className="activity-player-container">
    <div className="activity-player-toolbar"><Button aria-label="전체화면" icon={<FullscreenOutlined />} onClick={() => void fullscreen()}>전체화면</Button></div>
    {fullscreenError && <Text type="secondary">브라우저의 영상 컨트롤에서 전체화면을 선택해 주세요.</Text>}
    <video ref={player} className="activity-player" controls playsInline preload="metadata" poster={mediaUrl(video.thumbnail_url)} src={src} onError={() => setFailed(true)} />
  </div>
}

function EventCard({ event, onVideo }: { event: RoomActivity; onVideo: (v: ActivityVideo) => void }) {
  const actor = event.actor?.name ?? '알 수 없는 참여자'
  if (event.type === 'QUESTION') {
    const participant = (person: RoomActivity['actor']) => person ? `${person.name} (#${person.user_id})` : '확인 불가'
    return <article className="activity-event activity-event-question">
      <div className="activity-event-body activity-question">
        <div className="activity-event-heading"><Tag>익명질문</Tag><Text type="secondary" className="activity-time">{dayjs(event.occurred_at).format('MM.DD HH:mm:ss')}</Text></div>
        <Space wrap size={24}>
          <Text><Text type="secondary">발신자 </Text>{participant(event.actor)}</Text>
          <Text><Text type="secondary">수신자 </Text>{participant(event.target)}</Text>
        </Space>
        <div><Text strong>질문</Text><p>{event.content}</p></div>
        <div className="activity-answer"><Text strong>답변</Text><p>{event.answer ?? '답변 대기'}</p>{event.answered_at && <Text type="secondary">답변 시각 {dayjs(event.answered_at).format('MM.DD HH:mm:ss')}</Text>}</div>
      </div>
    </article>
  }
  return (
    <article className={`activity-event activity-event-${event.type.toLowerCase()}`}>
      <Avatar className="activity-avatar" icon={icons[event.type]} />
      <div className="activity-event-body">
        <div className="activity-event-heading">
          <Space wrap size={6}><Text strong>{actor}</Text>{event.target && <><Text type="secondary">→</Text><Text strong>{event.target.name}</Text></>}<Tag>{labels[event.type]}</Tag></Space>
          <Text type="secondary" className="activity-time">{dayjs(event.occurred_at).format('MM.DD HH:mm:ss')}</Text>
        </div>
        {event.type === 'VIDEO' && event.video && <div className="activity-inline-video">
          <VideoThumbnail key={event.video.thumbnail_url} video={event.video} onOpen={() => onVideo(event.video!)} />
          <div><Text>{event.video.caption || '설명 없는 영상'}</Text>{event.video.mission_id != null && <div><Text type="secondary">미션 #{event.video.mission_id}</Text></div>}</div>
        </div>}
        {event.type === 'CHAT' && <p className="activity-message">{event.content}</p>}
        {event.type === 'REACTION' && <div className="activity-reaction">
          <span className="activity-emoji">{reactionEmoji[event.reaction_type ?? ''] ?? '💬'}</span>
          <Text>{event.target?.name ?? '참여자'}님의 영상에 {reactionEmoji[event.reaction_type ?? ''] ? '반응을 남겼습니다.' : `${event.reaction_type ?? '알 수 없는'} 반응을 남겼습니다.`}</Text>
          {event.video && <Button size="small" icon={<PlayCircleOutlined />} onClick={() => onVideo(event.video!)}>영상 보기</Button>}
        </div>}
      </div>
    </article>
  )
}

export default function RoomActivityPanel({ room }: { room: RoomDetail }) {
  const { token } = theme.useToken()
  const qc = useQueryClient()
  const [day, setDay] = useState<number>()
  const [userId, setUserId] = useState<number>()
  const [type, setType] = useState<RoomActivityType | undefined>('VIDEO')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [video, setVideo] = useState<ActivityVideo | null>(null)
  const snapshot = useQuery({
    queryKey: ['room', room.room_id, 'activities', 'insights', { day }],
    queryFn: ({ signal }) => fetchRoomActivitySnapshot(room.room_id, day, signal),
    enabled: room.room_id > 0,
    staleTime: 60_000,
  })
  const slots = useMemo(() => buildSlots(room, snapshot.data ?? [], day), [room, snapshot.data, day])
  const summary = useRoomActivitySummary(room.room_id, { day, userId })
  const pageSize = 24
  const events = useRoomActivities(room.room_id, { day, userId, type, size: pageSize, order }, type !== 'VIDEO')
  // 이어 불러오는 사이 새 활동이 생기면 같은 항목이 다음 묶음에 또 올 수 있어 걸러낸다
  const seen = new Set<string>()
  const loaded = (events.data?.pages ?? []).flatMap(p => p.content).filter(event => {
    const key = `${event.type}-${event.id}`
    return seen.has(key) ? false : (seen.add(key), true)
  })
  const total = events.data?.pages[0]?.page.total_elements ?? 0
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = events
  // 목록은 자체 스크롤 칸 안에서만 이어 붙는다 (아래 선택표·초대코드가 밀려 내려가지 않게).
  // 칸의 끝이 보이면 다음 묶음을 불러온다. 실패한 뒤에는 [다시 시도]를 눌러야 다시 요청한다
  const scroller = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = sentinel.current
    if (type === 'VIDEO' || !node || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) void fetchNextPage() }, { root: scroller.current, rootMargin: '300px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, loaded.length, type])
  const counts = summary.data?.counts
  const uploadDays = Array.from({ length: room.total_days }, (_, i) => i + 1)
  const dailyUploads = useQueries({ queries: uploadDays.map(day => ({
    queryKey: ['room', room.room_id, 'activity-summary', { day }],
    queryFn: () => roomsApi.activitySummary(room.room_id, { day }),
    enabled: room.room_id > 0,
  })) })
  const uploadValue = (index: number, participantId?: number) => {
    if (uploadDays[index] > room.current_day && ['PENDING', 'ACTIVE'].includes(room.status)) return '—'
    const query = dailyUploads[index]
    if (query.isError) return '조회 실패'
    if (!query.data) return '…'
    return participantId == null ? query.data.counts.videos : query.data.members.find(m => m.user_id === participantId)?.videos ?? 0
  }
  const busy = (events.isFetching && !isFetchingNextPage) || summary.isFetching || snapshot.isFetching
  const selectType = (value: RoomActivityType | undefined) => setType(value)
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['room', room.room_id], exact: true })
    void qc.invalidateQueries({ queryKey: ['room', room.room_id, 'activities'] })
    void qc.invalidateQueries({ queryKey: ['room', room.room_id, 'activity-summary'] })
  }
  const styles = {
    '--activity-primary': token.colorPrimary,
    '--activity-soft': token.colorPrimaryBg,
    '--activity-border': token.colorBorderSecondary,
    '--activity-muted': token.colorTextSecondary,
    '--activity-surface': token.colorFillAlter,
    '--activity-text': token.colorText,
    '--activity-overlay': token.colorBgMask,
    '--activity-on-overlay': token.colorWhite,
    '--activity-bg': token.colorBgContainer,
  } as CSSProperties
  const metrics = [
    { key: 'VIDEO' as const, label: '영상', value: counts?.videos, suffix: '개' },
    { key: 'CHAT' as const, label: '채팅', value: counts?.chats, suffix: '개' },
    { key: 'REACTION' as const, label: '반응', value: counts?.reactions, suffix: '개' },
    { key: 'QUESTION' as const, label: '질문', value: counts?.questions, suffix: '개' },
  ]
  const groups = new Map<string, RoomActivity[]>()
  loaded.forEach(event => {
    const title = `${event.day == null ? '일차 외 활동' : `DAY ${event.day}`} · ${dayjs(event.occurred_at).format('MM월 DD일')}`
    groups.set(title, [...(groups.get(title) ?? []), event])
  })
  const columns = [
    { title: '참여자', dataIndex: 'name', render: (name: string, m: RoomActivitySummary['members'][number]) => <Button type="link" onClick={() => setUserId(m.user_id)}>{name}</Button> },
    { title: '사진', key: 'profile_image', width: 76, render: (_: unknown, m: RoomActivitySummary['members'][number]) => {
      const url = room.members.find(member => member.user_id === m.user_id)?.profile_image_url
      return <ParticipantPhoto key={url ?? 'no-photo'} url={url} name={m.name} />
    } },
    { title: '영상', dataIndex: 'videos' }, { title: '채팅', dataIndex: 'chats' },
    { title: '보낸 반응', dataIndex: 'reactions_sent' }, { title: '받은 반응', dataIndex: 'reactions_received' },
    { title: '받은 질문', dataIndex: 'questions_received' },
    ...uploadDays.map((day, index) => ({
      title: `${day}일차 업로드`, key: `uploads-${day}`, width: 115,
      render: (_: unknown, member: RoomActivitySummary['members'][number]) => uploadValue(index, member.user_id),
    })),
  ]

  return <section className="room-activity" style={styles} aria-label="방 활동 대시보드">
    <Card>
      <div className="activity-filters">
        <Title level={4} style={{ margin: 0 }}>방 활동</Title>
        <Space wrap>
          <Select aria-label="활동 일차" value={day ?? 0} style={{ minWidth: 130 }} onChange={v => setDay(v || undefined)} options={[{ value: 0, label: '전체 일차' }, ...Array.from({ length: room.total_days }, (_, i) => ({ value: i + 1, label: `${i + 1}일차` }))]} />
          <Select aria-label="활동 참여자" placeholder="전체 참여자" allowClear value={userId} style={{ minWidth: 180 }} onChange={v => setUserId(v)} options={room.members.map(m => ({ value: m.user_id, label: m.pseudonym || m.nickname || `참여자 #${m.user_id}` }))} />
          {(day != null || userId != null) && <Button type="text" onClick={() => { setDay(undefined); setUserId(undefined) }}>필터 초기화</Button>}
          <Button aria-label="활동 새로고침" title="새로고침" icon={<ReloadOutlined spin={busy} />} onClick={refresh} disabled={busy} />
        </Space>
      </div>
      {summary.isError ? <Alert type="error" showIcon title="활동 요약을 불러오지 못했습니다." action={<Button size="small" onClick={() => void summary.refetch()}>다시 시도</Button>} />
        : <div className="activity-metrics" aria-busy={summary.isFetching}>{metrics.map(m => <button key={m.key} className={`activity-metric${type === m.key ? ' is-selected' : ''}`} onClick={() => selectType(type === m.key ? undefined : m.key)} aria-pressed={type === m.key}>
          <span className="activity-metric-label">{m.label}</span><span className="activity-metric-value">{m.value?.toLocaleString() ?? '—'}</span>
        </button>)}</div>}

    </Card>

    <Card className="activity-feed">
      <div className="activity-feed-toolbar">
        <div className="activity-tab-scroll"><Segmented value={type ?? 'ALL'} onChange={v => selectType(v === 'ALL' ? undefined : v as RoomActivityType)} options={[{ label: '전체 활동', value: 'ALL' }, { label: '영상 모아보기', value: 'VIDEO' }, { label: '채팅', value: 'CHAT' }, { label: '반응', value: 'REACTION' }, { label: '질문', value: 'QUESTION' }]} /></div>
        <Select aria-label="활동 정렬" value={order} onChange={v => setOrder(v)} options={[{ value: 'desc', label: '최신순' }, { value: 'asc', label: '오래된순' }]} style={{ width: 120 }} />
      </div>
      {type === 'VIDEO' ? (snapshot.isError ? <Alert type="error" showIcon title="활동을 불러오지 못했습니다." description={snapshot.error.message} action={<Button onClick={() => void snapshot.refetch()}>다시 불러오기</Button>} />
        : snapshot.isPending || snapshot.isFetching ? <Skeleton active paragraph={{ rows: 8 }} />
          : <VideoBoard key={`${room.room_id}-${day ?? 'all'}-${order}`} room={room} slots={slots} userId={userId} order={order} thumbnail={value => <VideoThumbnail key={value.thumbnail_url} video={value} onOpen={() => setVideo(value)} />} eventCard={event => <EventCard event={event} onVideo={setVideo} />} onVideo={setVideo} />)
        : events.isError && !loaded.length ? <Alert type="error" showIcon title="활동 내역을 불러오지 못했습니다." description="연결 상태와 관리자 조회 API를 확인한 후 다시 시도해 주세요." action={<Button onClick={() => void events.refetch()}>다시 시도</Button>} />
        : events.isLoading ? <Skeleton active paragraph={{ rows: 6 }} />
          : !loaded.length ? <Empty description="선택한 조건에 해당하는 활동이 없습니다." />
            : <div className="activity-scroll" ref={scroller} aria-busy={events.isFetching && !isFetchingNextPage}>{[...groups].map(([title, items]) => <section key={title} className="activity-day-group">
              <div className="activity-day-heading"><Text strong>{title}</Text><Text type="secondary">{items.length}건</Text></div>
              <div className="activity-event-list">{items.map(event => <EventCard key={`${event.type}-${event.id}`} event={event} onVideo={setVideo} />)}</div>
            </section>)}<div ref={sentinel} className="activity-scroll-end" /></div>}
      {type !== 'VIDEO' && loaded.length > 0 && <div className="activity-more">
        <Text type="secondary">총 {total.toLocaleString()}건 중 {loaded.length.toLocaleString()}건</Text>
        {isFetchNextPageError ? <Space><Text type="danger">이어서 불러오지 못했습니다.</Text><Button size="small" onClick={() => void fetchNextPage()}>다시 시도</Button></Space>
          : hasNextPage ? <Button size="small" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>더 보기</Button>
            : <Text type="secondary">마지막 활동입니다</Text>}
      </div>}
    </Card>
    <Card className="activity-member-table" size="small">
      <Collapse ghost items={[{ key: 'members', label: '참여자별 활동 현황', children: summary.isError ? <Text type="secondary">요약을 다시 불러와 주세요.</Text> : <>
        {dailyUploads.some(q => q.isError) && <Alert type="error" showIcon title="일별 업로드 수를 불러오지 못했습니다." action={<Button onClick={() => dailyUploads.forEach(q => { void q.refetch() })}>다시 시도</Button>} />}
        <Typography.Paragraph type="secondary">일차별 업로드 열은 일차 필터와 관계없이 각 일차 전체를 표시합니다. 하단 총계·평균은 방 전체 참여자 {room.members.length}명 기준이며, 업로드 0건인 참여자도 포함합니다. 진행 중인 일차는 현재까지의 수치입니다.</Typography.Paragraph>
        <Table rowKey="user_id" size="small" loading={summary.isLoading} columns={columns} dataSource={summary.data?.members} pagination={false} scroll={{ x: 716 + uploadDays.length * 115 }} locale={{ emptyText: '참여자가 없습니다.' }}
          summary={() => <Table.Summary>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={7}><Text strong>방 전체 일별 총 업로드</Text></Table.Summary.Cell>
              {uploadDays.map((day, index) => <Table.Summary.Cell key={day} index={7 + index}>{uploadValue(index)}</Table.Summary.Cell>)}
            </Table.Summary.Row>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={7}><Text strong>방 전체 일별 1인당 평균 업로드</Text></Table.Summary.Cell>
              {uploadDays.map((day, index) => {
                const total = uploadValue(index)
                return <Table.Summary.Cell key={day} index={7 + index}>{typeof total === 'number' ? `${(room.members.length ? total / room.members.length : 0).toFixed(1)}개` : total}</Table.Summary.Cell>
              })}
            </Table.Summary.Row>
          </Table.Summary>}
        />
      </> }]} />
    </Card>
    <Modal title={video?.caption || '영상 보기'} open={video != null} onCancel={() => setVideo(null)} footer={null} destroyOnHidden width="min(1100px, 96vw)" className="activity-video-modal" style={styles}>
      {video && <VideoPlayer key={`${video.id}-${video.video_url}`} video={video} />}
    </Modal>
  </section>
}
