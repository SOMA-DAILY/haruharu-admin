import { useRef, useState, type Key } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, App, Button, Card, Descriptions, Empty, Input, Segmented, Select, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

import { PageHeader } from '../layout/AdminLayout'
import { useAuth } from '../auth/AuthContext'
import { useRooms, useRoom, useMidCandidates, useMidAvailability, useMidActions } from '../api/queries'
import type { Gender, ParticipationCandidate } from '../api/types'

export default function MidParticipationPage() {
  const [params, setParams] = useSearchParams()
  const rawRoom = Number(params.get('roomId'))
  const roomId = Number.isSafeInteger(rawRoom) && rawRoom > 0 ? rawRoom : 0
  const { me } = useAuth()
  const canWrite = me?.role === 'SUPER' || me?.role === 'OPERATOR'
  const { message, modal } = App.useApp()
  const [keyword, setKeyword] = useState('')
  const [gender, setGender] = useState<Gender | undefined>()
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<ParticipationCandidate[]>([])
  const sending = useRef(false)
  const candidates = useMidCandidates({ keyword, gender, page, size: 20 })
  const rooms = useRooms({ status: 'ACTIVE', size: 100 })
  const room = useRoom(roomId)
  const availability = useMidAvailability(roomId)
  const actions = useMidActions(roomId)
  const currentMembers = new Set(room.data?.members.map(m => m.user_id) ?? [])
  const selectedIds = selected.map(p => p.user_id)
  const cohort = availability.data?.cohort_sequence ? `${availability.data.cohort_sequence}기` : ''
  const target = `방 #${roomId}${cohort ? ` · ${cohort}` : ''} · ${room.data?.current_day ?? '-'}일차`
  const disabled = !canWrite || !selected.length || actions.create.isPending || !room.data || !availability.data?.recruiting || !availability.data.available
  const fail = (e: unknown) => message.error(e instanceof Error ? e.message : '제안을 보내지 못했어요. 다시 시도해 주세요.')

  const confirm = () => {
    if (disabled || sending.current) return
    const recipients = [...selected]
    const seats = availability.data!.available
    const expires = availability.data!.default_expires_at
    modal.confirm({
      title: `${recipients.length}명에게 참여를 제안할까요?`,
      width: 600,
      okText: '제안 보내기', cancelText: '돌아가기',
      content: <Space direction="vertical" size={20} style={{ width: '100%', marginTop: 16 }}>
        <Descriptions column={1} size="small" items={[
          { key: 'room', label: '참여할 방', children: target },
          { key: 'users', label: '받는 사람', children: recipients.map(p => p.nickname ?? `#${p.user_id}`).join(', ') },
          { key: 'seats', label: '입장 가능 인원', children: `선착순 ${seats}명` },
          { key: 'expiry', label: '수락 가능한 시간', children: expires ? `${dayjs(expires).format('MM.DD HH:mm')}까지` : '발송 후 최대 1시간' },
        ]} />
        <Card size="small" title="푸시 알림 미리보기">
          <Typography.Paragraph strong>{cohort ? `${cohort} ` : ''}중간 참여 초대</Typography.Paragraph>
          <Typography.Text>현재 {room.data?.current_day ?? '-'}일차가 진행 중인 {cohort || '하루방'}에 초대합니다. 참여하시겠어요?</Typography.Text>
        </Card>
        <Typography.Text type="secondary">사전 등록 없이 바로 제안합니다. 이미 이 방에 있거나 퇴장한 사람은 제외하고, 먼저 수락한 인원만 입장합니다.</Typography.Text>
      </Space>,
      onOk: async () => {
        if (sending.current) return
        sending.current = true
        try {
          const sent = await actions.create.mutateAsync({ seats, user_ids: recipients.map(p => p.user_id) })
          message.success(`${sent.recipients.length}명에게 참여 제안을 보냈어요.`)
          setSelected([])
        } catch (e) {
          fail(e)
          void availability.refetch()
          throw e
        } finally { sending.current = false }
      },
    })
  }
  const columns: ColumnsType<ParticipationCandidate> = [
    { title: '참가자', key: 'user', render: (_, r) => <Space><a href={`/users/${r.user_id}`}>{r.nickname ?? '닉네임 미설정'} · #{r.user_id}</a>{currentMembers.has(r.user_id) && <Tag>이미 참여 중</Tag>}</Space> },
    { title: '성별', dataIndex: 'gender', render: (v: Gender | null) => v === 'MALE' ? '남성' : v === 'FEMALE' ? '여성' : '미설정' },
    { title: '영상 업로드 ↓', dataIndex: 'video_count', render: (v: number) => <Typography.Text strong>{v}개</Typography.Text> },
    { title: '최근 영상 업로드', dataIndex: 'last_video_uploaded_at', render: (v: string | null) => v ? dayjs(v).format('YY.MM.DD HH:mm') : '기록 없음' },
  ]
  const changeSelection = (keys: Key[], rows: ParticipationCandidate[]) => {
    const keep = new Set(keys.slice(0, 100).map(Number))
    const merged = new Map([...selected, ...rows.filter(Boolean)].map(p => [p.user_id, p]))
    setSelected([...merged.values()].filter(p => keep.has(p.user_id)))
  }
  return <>
    <PageHeader title="중간 참여" subtitle="영상 업로드 기록을 보고, 함께할 사람에게 직접 참여를 제안하세요." />
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Card title="1. 참여를 제안할 방">
        <Space wrap size={20}>
          <Select aria-label="참여를 제안할 방" placeholder="진행 중인 방 선택" style={{ minWidth: 320 }} loading={rooms.isLoading} value={roomId || undefined}
            labelRender={p => p.value === roomId && room.data ? target : p.label}
            options={(rooms.data?.content ?? []).map(r => ({ value: r.room_id, label: `방 #${r.room_id} · ${r.current_day}일차` }))}
            onChange={(id: number) => { setSelected([]); setParams({ roomId: String(id) }) }} />
          {availability.data && <><Typography.Text>현재 {availability.data.member_count} / {availability.data.capacity}명</Typography.Text><Tag color="blue">빈자리 {availability.data.available}명</Tag></>}
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>남은 자리는 수락한 순서로 채워집니다. 제안은 발송 후 최대 1시간 동안 유효해요.</Typography.Paragraph>
        {rooms.isError && <Alert type="error" title="방 목록을 불러오지 못했어요." action={<Button onClick={() => void rooms.refetch()}>다시 시도</Button>} />}
        {(availability.isError || room.isError) && <Alert type="error" title="방 정보를 확인하지 못했어요." action={<Button onClick={() => { void room.refetch(); void availability.refetch() }}>다시 확인</Button>} />}
        {availability.data && (!availability.data.recruiting || !availability.data.available) && <Alert type="info" title={!availability.data.recruiting ? '이 방은 현재 중간 참여자를 모집할 수 없어요.' : '빈자리가 없어 제안을 보낼 수 없어요.'} style={{ marginTop: 16 }} />}
      </Card>
      <Card title="2. 제안할 참가자 선택">
        <Space wrap style={{ marginBottom: 20 }}>
          <Segmented aria-label="참가자 성별" value={gender ?? 'ALL'} options={[{ label: '전체', value: 'ALL' }, { label: '여성', value: 'FEMALE' }, { label: '남성', value: 'MALE' }]}
            onChange={v => { setGender(v === 'ALL' ? undefined : v as Gender); setPage(0) }} />
          <Input.Search aria-label="참가자 검색" placeholder="이름 또는 회원 ID 검색" allowClear onSearch={v => { setKeyword(v); setPage(0) }} style={{ width: 260 }} />
          <Typography.Text type="secondary">전체 기록 · 영상 업로드 수 ↓</Typography.Text>
        </Space>
        {candidates.isError && <Alert type="error" title="참가자를 불러오지 못했어요." action={<Button onClick={() => void candidates.refetch()}>다시 시도</Button>} />}
        <Table<ParticipationCandidate> rowKey="user_id" loading={candidates.isLoading} columns={columns} dataSource={candidates.data?.content ?? []} scroll={{ x: 760 }}
          locale={{ emptyText: <Empty description="조건에 맞는 참가자가 없어요." /> }}
          rowSelection={canWrite ? { selectedRowKeys: selectedIds, preserveSelectedRowKeys: true, onChange: changeSelection,
            getCheckboxProps: r => ({ disabled: currentMembers.has(r.user_id) || selected.length >= 100 && !selectedIds.includes(r.user_id) }) } : undefined}
          pagination={{ current: page + 1, pageSize: 20, total: candidates.data?.page.total_elements ?? 0, showSizeChanger: false, onChange: p => setPage(p - 1) }} />
        <Typography.Text type="secondary">성공적으로 업로드한 영상 수입니다. 채팅과 질문은 집계하지 않아요.</Typography.Text>
      </Card>
      <Card>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space direction="vertical" size={4}>
            <Typography.Text strong>{selected.length ? `${selected.map(p => p.nickname ?? `#${p.user_id}`).join(', ')} · ${selected.length}명 선택` : '제안할 참가자를 선택해 주세요.'}</Typography.Text>
            {roomId > 0 && <Typography.Text type="secondary">{target} · 빈자리 {availability.data?.available ?? '-'}명</Typography.Text>}
          </Space>
          <Button type="primary" disabled={disabled} loading={actions.create.isPending} onClick={confirm}>{selected.length}명에게 제안 보내기</Button>
        </Space>
      </Card>
    </Space>
  </>
}
