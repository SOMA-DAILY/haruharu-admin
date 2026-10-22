import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Avatar, Button, Empty, Popover, Select, Tooltip, Typography } from 'antd'
import { AimOutlined, FullscreenOutlined, FullscreenExitOutlined, HeartOutlined, LeftOutlined, LinkOutlined, MessageOutlined, PlayCircleOutlined, QuestionCircleOutlined, RightOutlined, VideoCameraOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ActivityVideo, RoomActivity, RoomDetail } from '../../api/types'
import { countsOf, findChatSlot, gridColumns, memberName, reactionEmoji, relatedTo, slotLabel, type ActivitySlot } from './model'

const { Text } = Typography
interface Props {
  room: RoomDetail
  slots: ActivitySlot[]
  userId?: number
  order: 'asc' | 'desc'
  thumbnail: (video: ActivityVideo) => ReactNode
  eventCard: (event: RoomActivity) => ReactNode
  onVideo: (video: ActivityVideo) => void
}

function ContinuousChat({ slots, selected, userId, onVideo }: Pick<Props, 'slots' | 'userId' | 'onVideo'> & { selected: ActivitySlot }) {
  const container = useRef<HTMLDivElement>(null)
  const [sync, setSync] = useState(true)
  const groups = useMemo(() => slots.map(slot => ({ slot, chats: slot.events.filter(event => event.type === 'CHAT' && relatedTo(event, userId)) })).filter(group => group.chats.length), [slots, userId])
  const anchor = findChatSlot(slots, selected, userId)
  const jump = useCallback(() => {
    const root = container.current
    if (!root || !anchor) return
    const node = root.querySelector<HTMLElement>(`[data-chat-group="${anchor.key}"]`)
    if (node) root.scrollTop = node.offsetTop
  }, [anchor])
  useEffect(() => { if (sync) jump() }, [jump, sync, selected.key])
  const total = groups.reduce((sum, group) => sum + group.chats.length, 0)
  return <aside className="insights-conversation" aria-label="방 전체 채팅">
    <div className="insights-conversation-heading">
      <div><Text strong>방 채팅</Text><span className="insights-chat-total">{total}</span></div>
      <div className="insights-chat-actions">
        <Tooltip title={sync ? '영상 시간대 연동 중' : '영상 시간대 연동 꺼짐'}><Button size="small" type="text" aria-label="채팅 시간 연동" aria-pressed={sync} className={sync ? 'is-linked' : undefined} icon={<LinkOutlined />} onClick={() => setSync(value => !value)} /></Tooltip>
        <Tooltip title="영상 시각의 채팅으로 이동"><Button size="small" type="text" aria-label="영상 시각의 채팅으로 이동" disabled={!anchor} icon={<AimOutlined />} onClick={jump} /></Tooltip>
      </div>
    </div>
    {anchor?.key !== selected.key && <div className="insights-chat-notice">이 시간대에 채팅이 없습니다.</div>}
    <div className="insights-conversation-scroll" ref={container} tabIndex={0} aria-label="연속된 방 채팅 내역">
      {!groups.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="채팅이 없습니다." /> : groups.map(({ slot, chats }) => <section key={slot.key} data-chat-group={slot.key} className={`insights-chat-group${selected.key === slot.key ? ' is-current' : ''}`}>
        <div className="insights-chat-divider"><time>{slot.start == null ? '시각 미상' : dayjs(slot.start).format('MM.DD · HH:mm')}</time></div>
        {chats.map((event, index) => {
          const previous = chats[index - 1]
          const followup = previous && previous.actor?.user_id === event.actor?.user_id && dayjs(event.occurred_at).diff(dayjs(previous.occurred_at), 'minute') < 5
          return <article className={`insights-chat-message${followup ? ' is-followup' : ''}`} key={event.id} data-chat-id={event.id}>
            {!followup ? <Avatar size={28} className="insights-chat-avatar">{event.actor?.name?.slice(0, 1) ?? '?'}</Avatar> : <span />}
            <div className="insights-chat-body">
              {!followup && <div className="insights-chat-meta"><Text strong>{event.actor?.name ?? '참여자'}</Text><time title={dayjs(event.occurred_at).format('MM.DD HH:mm:ss')}>{dayjs(event.occurred_at).format('HH:mm')}</time></div>}
              {event.video && <Button className="insights-chat-video" size="small" type="text" icon={<PlayCircleOutlined />} onClick={() => onVideo(event.video!)}>영상 답장</Button>}
              <p>{event.content}</p>
            </div>
          </article>
        })}
      </section>)}
    </div>
  </aside>
}

export default function VideoBoard({ room, slots, userId, order, thumbnail, eventCard, onVideo }: Props) {
  const ordered = useMemo(() => order === 'asc' ? slots : [...slots].reverse(), [order, slots])
  const [selectedKey, setSelectedKey] = useState<string>()
  const [expanded, setExpanded] = useState(false)
  const replay = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLElement>())
  const selected = slots.find(slot => slot.key === selectedKey) ?? ordered[0]
  const members = [...room.members].sort((a, b) => a.member_id - b.member_id)
  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || [...document.querySelectorAll<HTMLElement>('[role="dialog"], .ant-popover, .ant-select-dropdown')].some(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')) return
      setExpanded(false)
    }
    window.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close) }
  }, [expanded])
  const goTo = useCallback((key: string) => {
    setSelectedKey(key)
    const root = scroller.current, node = nodes.current.get(key)
    if (root && node) root.scrollTo({ top: node.offsetTop, behavior: 'instant' })
  }, [])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !selected) return
      const direction = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key]
      const root = replay.current
      if (!direction || !root || document.querySelector('video.activity-player')) return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (target !== document.body && !root.contains(target)) return
      if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="listbox"], [role="menu"], .insights-conversation, .ant-popover')) return
      if ([...document.querySelectorAll<HTMLElement>('[role="dialog"], .ant-popover, .ant-select-dropdown')].some(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')) return
      const rect = root.getBoundingClientRect()
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return
      event.preventDefault()
      const index = ordered.findIndex(slot => slot.key === selected.key)
      const next = ordered[index + direction]
      if (next) goTo(next.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goTo, ordered, selected])
  if (!selected) return <Empty description={room.status === 'PENDING' ? '방 시작 후 활동이 표시됩니다.' : '표시할 시간대가 없습니다.'} />
  const selectedIndex = ordered.findIndex(slot => slot.key === selected.key)
  const onScroll = () => {
    const root = scroller.current
    if (!root) return
    const marker = root.scrollTop + 56
    let active = ordered[0]
    for (const slot of ordered) {
      const node = nodes.current.get(slot.key)
      if (node && node.offsetTop <= marker) active = slot
      else break
    }
    if (active && active.key !== selected.key) setSelectedKey(active.key)
  }
  return <div className={`insights-replay${expanded ? ' is-expanded' : ''}`} ref={replay} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown">
    <div className="insights-replay-toolbar">
      <Select aria-label="영상 시간대 이동" value={selected.key} options={ordered.map(slot => ({ value: slot.key, label: `${slot.day ? `${slot.day}일차 · ` : ''}${slotLabel(slot)}` }))} onChange={goTo} style={{ width: 272, maxWidth: '100%' }} />
      <div className="insights-slot-navigation"><Tooltip title="이전 시간대 (← / ↑)"><Button size="small" type="text" aria-label="이전 시간대" icon={<LeftOutlined />} disabled={selectedIndex <= 0} onClick={() => goTo(ordered[selectedIndex - 1].key)} /></Tooltip><Tooltip title="다음 시간대 (→ / ↓)"><Button size="small" type="text" aria-label="다음 시간대" icon={<RightOutlined />} disabled={selectedIndex >= ordered.length - 1} onClick={() => goTo(ordered[selectedIndex + 1].key)} /></Tooltip></div>
      <Tooltip title={expanded ? '확대 닫기 (Esc)' : '영상 모아보기 확대'}><Button className="insights-expand" aria-label={expanded ? '확대 닫기' : '영상 모아보기 확대'} aria-pressed={expanded} icon={expanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => setExpanded(value => !value)} /></Tooltip>
    </div>
    <div className="insights-board">
      <div className="insights-video-scroll" ref={scroller} onScroll={onScroll} tabIndex={0} aria-label="시간대별 참가자 영상">
        {ordered.map(slot => {
          const events = slot.events.filter(event => relatedTo(event, userId))
          const counts = countsOf(events)
          const uploaded = new Set(slot.videos.map(event => event.actor?.user_id).filter(id => id != null)).size
          const uploadClosed = slot.start != null && room.final_selection_opens_at != null && slot.start >= dayjs(room.final_selection_opens_at).valueOf()
          return <section className={`insights-slot${selected.key === slot.key ? ' is-selected' : ''}`} key={slot.key} ref={node => { if (node) nodes.current.set(slot.key, node); else nodes.current.delete(slot.key) }} data-slot-key={slot.key}>
            <div className="insights-slot-heading">
              <div className="insights-slot-time"><span>{slot.day == null ? '기간 외' : `${slot.day}일차`}</span><Text strong>{slot.start == null ? '시각 미상' : dayjs(slot.start).format('MM.DD · HH:mm')}</Text></div>
              <div className="insights-slot-stats">
                <Tooltip title={`영상 업로드 ${uploaded}/${members.length}명`}><span><VideoCameraOutlined /> {uploaded}/{members.length}</span></Tooltip>
                {!!counts.CHAT && <Tooltip title={`이 시간대 채팅 ${counts.CHAT}개`}><span><MessageOutlined /> {counts.CHAT}</span></Tooltip>}
                {(['REACTION', 'QUESTION'] as const).map(type => counts[type] > 0 && <Popover key={type} trigger="click" placement="bottomRight" title={type === 'REACTION' ? '반응' : '익명질문'} content={<div className="insights-event-popover">{events.filter(event => event.type === type).map(event => <div key={event.id}>{type === 'REACTION' ? <div className="insights-reaction-row"><span className="insights-reaction-emoji" aria-label={event.reaction_type ?? '반응'}>{reactionEmoji[event.reaction_type ?? ''] ?? '♡'}</span><span><strong>{event.actor?.name ?? '참여자'}</strong><span className="insights-event-arrow"> → </span>{event.target?.name ?? '참여자'}</span><time>{dayjs(event.occurred_at).format('HH:mm')}</time>{event.video && <Tooltip title={`${event.video.caption ?? '대상 영상'}${event.video.slot_start ? ` · ${dayjs(event.video.slot_start).format('MM.DD HH:mm')}` : ''}`}><Button type="text" size="small" aria-label="반응 대상 영상 보기" icon={<PlayCircleOutlined />} onClick={() => onVideo(event.video!)} /></Tooltip>}</div> : eventCard(event)}</div>)}</div>}><Button type="text" size="small" aria-label={`${type === 'REACTION' ? '반응' : '질문'} ${counts[type]}개`} icon={type === 'REACTION' ? <HeartOutlined /> : <QuestionCircleOutlined />}>{counts[type]}</Button></Popover>)}
              </div>
            </div>
            <div className="insights-grid-overflow"><div className="insights-fixed-grid" style={{ '--participant-columns': gridColumns(members.length) } as CSSProperties}>
              {members.map(member => {
                const videos = slot.videos.filter(event => event.actor?.user_id === member.user_id && event.video)
                const beforeJoin = slot.start != null && dayjs(member.joined_at).valueOf() >= slot.start + 3_600_000
                return <article className={`activity-video-card insights-member-card${userId === member.user_id ? ' is-selected' : ''}`} key={member.user_id} data-member-id={member.user_id}>
                  <div className="insights-member-heading"><Text strong ellipsis title={`${memberName(member)} (#${member.user_id})`}>{memberName(member)}</Text></div>
                  {videos.length ? videos.map(event => <div className="insights-member-media" key={event.id}>{thumbnail(event.video!)}<div className="activity-video-meta"><Text ellipsis title={`${event.video!.caption ?? ''} · 업로드 ${dayjs(event.occurred_at).format('HH:mm:ss')}`}>{event.video!.caption || dayjs(event.occurred_at).format('HH:mm')}</Text></div></div>)
                    : <div className="insights-no-upload"><span>{beforeJoin ? '참가 전' : uploadClosed ? '업로드 종료' : '미업로드'}</span></div>}
                </article>
              })}
            </div></div>
            {slot.videos.some(event => !members.some(member => member.user_id === event.actor?.user_id)) && <div className="insights-unassigned"><Text type="secondary">기타 참가자</Text>{slot.videos.filter(event => !members.some(member => member.user_id === event.actor?.user_id)).map(event => event.video && <div key={event.id}><Text>{event.actor?.name ?? '작성자 미상'}</Text>{thumbnail(event.video)}</div>)}</div>}
          </section>
        })}
        <div className="insights-slot-tail" aria-hidden="true" />
      </div>
      <ContinuousChat slots={slots} selected={selected} userId={userId} onVideo={onVideo} />
    </div>
  </div>
}
