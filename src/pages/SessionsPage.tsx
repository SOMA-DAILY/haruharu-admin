import { useEffect, useState, type Key } from 'react'
import { Card, Table, Select, DatePicker, Space, Button, Alert, Empty, Tooltip, Typography, Collapse, Segmented, Modal, Form, Input, App, Skeleton } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { roomsApi } from '../api/endpoints'
import { useRoomActivitySummary, useRooms, useRoomGroups, useAssignRoomOrganization } from '../api/queries'
import { useAuth } from '../auth/AuthContext'
import { RoomStatusTag, RoomTypeTag } from '../components/StatusTag'
import CreateRoomModal from '../components/CreateRoomModal'
import { ApiError } from '../api/client'
import type { RoomListQuery } from '../api/endpoints'
import type { RoomListItem, RoomStatus, RoomGroup } from '../api/types'

const STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기' },
  { value: 'ACTIVE', label: '진행중' },
  { value: 'SELECTING', label: '선택중' },
  { value: 'ENDED', label: '종료' },
  { value: 'CANCELLED', label: '취소' },
]

// 목록 응답엔 활동 수치가 없어 방마다 활동 요약을 따로 부른다 (방 상세와 같은 조회 · 캐시 공유).
// 시작 전·취소·빈 방은 부르지 않는다. 방이 많아져 느려지면 목록용 집계 API 로 옮긴다
function RoomActivityCell({ room, kind }: { room: RoomListItem; kind: 'uploads' | 'chats' }) {
  const skip = room.status === 'PENDING' || room.status === 'CANCELLED' || room.member_count === 0
  // 진행 일수: 진행 중이면 현재 일차. 끝난 방은 목록에 일차가 없어(0) 방 상세의 총 일수를 쓴다
  const needsDetail = !skip && kind === 'uploads' && room.current_day <= 0
  const summary = useRoomActivitySummary(skip ? 0 : room.room_id, {})
  const detail = useQuery({
    queryKey: ['room', room.room_id],
    queryFn: () => roomsApi.detail(room.room_id),
    enabled: needsDetail,
  })
  if (skip) return '-'
  if (summary.isError || (needsDetail && detail.isError)) return <Typography.Text type="danger">조회 실패</Typography.Text>
  const days = room.current_day > 0 ? room.current_day : detail.data?.total_days
  if (!summary.data || (kind === 'uploads' && !days)) return <Typography.Text type="secondary">…</Typography.Text>
  const { videos, chats } = summary.data.counts
  if (kind === 'chats')
    return (
      <>
        {chats.toLocaleString()}{' '}
        <Typography.Text type="secondary">(1인 {(chats / room.member_count).toFixed(1)})</Typography.Text>
      </>
    )
  return (
    <Tooltip title={`영상 ${videos.toLocaleString()}개 ÷ ${room.member_count}명 ÷ ${days}일`}>
      {(videos / room.member_count / days!).toFixed(1)}개
    </Tooltip>
  )
}

const columns: ColumnsType<RoomListItem> = [
  { title: '방 ID', dataIndex: 'room_id', width: 90 },
  { title: '구분', dataIndex: 'is_test', width: 90, render: (value: boolean | null) => <RoomTypeTag isTest={value} /> },
  { title: '상태', dataIndex: 'status', width: 100, render: (s: RoomStatus) => <RoomStatusTag status={s} /> },
  { title: '예정일', dataIndex: 'scheduled_date', width: 120 },
  {
    title: '진행 일차',
    dataIndex: 'current_day',
    width: 100,
    render: (d: number) => (d > 0 ? `${d}일차` : '-'),
  },
  {
    title: '인원(여/남)',
    key: 'members',
    render: (_, r) => `${r.member_count}명 (${r.female_count}/${r.male_count})`,
  },
  {
    title: <Tooltip title="1인당 하루 평균 영상 업로드 수">일평균 업로드</Tooltip>,
    key: 'uploads',
    width: 130,
    render: (_, r) => <RoomActivityCell room={r} kind="uploads" />,
  },
  { title: '채팅', key: 'chats', width: 150, render: (_, r) => <RoomActivityCell room={r} kind="chats" /> },
  {
    title: '시작시각',
    dataIndex: 'started_at',
    render: (v: string | null) => (v ? dayjs(v).format('MM/DD HH:mm') : '-'),
  },
]

function GroupRoomsTable({ query, selected, onSelect, canWrite, showAll, page, size, onPageChange, onOpenRoom }: {
  query: RoomListQuery; selected: Key[]; onSelect: (ids: Key[]) => void; canWrite: boolean; showAll: () => void
  page: number; size: number; onPageChange: (page: number, size: number) => void; onOpenRoom: (id: number) => void
}) {
  const { data, isLoading, isError } = useRooms({ ...query, page, size })
  return <>
    {isError && <Alert type="error" showIcon title="방 목록을 불러오지 못했습니다." />}
    <Table<RoomListItem> rowKey="room_id" columns={columns} loading={isLoading} dataSource={data?.content}
      rowSelection={canWrite ? { selectedRowKeys: selected, onChange: onSelect, preserveSelectedRowKeys: true } : undefined}
      scroll={{ x: 880 }} size="middle"
      locale={{ emptyText: <Empty description="조건에 맞는 방이 없습니다.">{query.isTest === false && <Button onClick={showAll}>전체 방 보기</Button>}</Empty> }}
      onRow={room => ({ onClick: () => onOpenRoom(room.room_id), style: { cursor: 'pointer' } })}
      pagination={{ current: page + 1, pageSize: size, total: data?.page.total_elements ?? 0, showSizeChanger: true,
        onChange: (p, ps) => onPageChange(p - 1, ps) }} />
  </>
}

export default function SessionsPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const canWrite = me?.role === 'SUPER' || me?.role === 'OPERATOR'
  const [params, setParams] = useSearchParams()
  const view = params.get('view') ?? 'operational'
  const status = (params.get('status') || undefined) as RoomStatus | undefined
  const date = params.get('date')
  const [selected, setSelected] = useState<Key[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [groupForm] = Form.useForm<{ name: string }>()
  const [assignForm] = Form.useForm<{ group: number | 'keep' | 'none'; type: 'keep' | 'operational' | 'test' }>()
  const groups = useRoomGroups()
  const assign = useAssignRoomOrganization()
  const createGroup = useMutation({ mutationFn: roomsApi.createGroup, onSuccess: async group => {
    await qc.invalidateQueries({ queryKey: ['room-groups'] }); setGroupOpen(false); setExpanded([String(group.id)]); message.success('기수를 추가했습니다.')
  }, onError: error => message.error(error instanceof ApiError ? error.message : '기수를 추가하지 못했습니다.') })
  const changeFilter = (key: string, value?: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    for (const name of [...next.keys()]) if (name.startsWith('page.')) next.delete(name)
    setParams(next, { replace: true }); setSelected([])
  }
  const showAll = () => changeFilter('view', 'all')
  const filter: RoomListQuery = { isTest: view === 'all' ? undefined : view === 'test', status, scheduledDate: date || undefined }
  const expanded = params.has('expanded') ? params.get('expanded')!.split(',').filter(Boolean) : [String(groups.data?.[0]?.id ?? 'ungrouped')]
  const setExpanded = (keys: string[]) => {
    const next = new URLSearchParams(params)
    next.set('expanded', keys.join(','))
    setParams(next, { replace: true })
  }
  const changePage = (group: string, page: number, size: number) => {
    const next = new URLSearchParams(params)
    next.set(`page.${group}`, String(page)); next.set(`size.${group}`, String(size))
    setParams(next, { replace: true })
  }
  const openRoom = (id: number) => {
    const returnTo = location.pathname + location.search
    try { sessionStorage.setItem(`room-list-scroll:${location.search}`, String(window.scrollY)) } catch { /* Storage may be disabled. */ }
    navigate(`/sessions/${id}`, { state: { roomListReturnTo: returnTo } })
  }
  // Restore only once on return; wait for expanded tables to provide enough height.
  // User scrolling cancels restoration so a slow query cannot pull the page back.
  useEffect(() => {
    const key = `room-list-scroll:${location.search}`
    let target: number
    try { const saved = sessionStorage.getItem(key); if (saved == null) return; target = Number(saved) } catch { return }
    if (!Number.isFinite(target) || target < 0) return
    let frame = 0
    const stop = () => {
      observer.disconnect(); cancelAnimationFrame(frame); window.clearTimeout(timeout)
      window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); window.removeEventListener('keydown', stop)
    }
    const restore = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (document.documentElement.scrollHeight - window.innerHeight + 1 >= target) { window.scrollTo(0, target); stop(); try { sessionStorage.removeItem(key) } catch { /* Optional restoration. */ } }
      })
    }
    const observer = new ResizeObserver(restore)
    observer.observe(document.querySelector('main') ?? document.body)
    const timeout = window.setTimeout(stop, 5000)
    window.addEventListener('wheel', stop, { passive: true }); window.addEventListener('touchstart', stop, { passive: true }); window.addEventListener('keydown', stop)
    restore()
    return stop
    // Snapshot the entry URL only. Filter/pagination changes are not a return visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const sections: (RoomGroup | { id: 'ungrouped'; name: string })[] = [...(groups.data ?? []), { id: 'ungrouped', name: '기수 미지정' }]
  const apply = async () => {
    const value = await assignForm.validateFields()
    if (value.group === 'keep' && value.type === 'keep') { message.info('기수 또는 방 구분을 선택해 주세요.'); return }
    try {
      await assign.mutateAsync({ room_ids: selected.map(Number), group_id: typeof value.group === 'number' ? value.group : undefined,
        clear_group: value.group === 'none', is_test: value.type === 'keep' ? undefined : value.type === 'test' })
      setAssignOpen(false); setSelected([]); message.success('선택한 방을 변경했습니다.')
    } catch (error) { message.error(error instanceof ApiError ? error.message : '방을 변경하지 못했습니다.') }
  }
  return <>
    <PageHeader title="세션(방) 관리" subtitle="기수별 방 조회 · 운영 관리" extra={canWrite && <Space>
      <Button onClick={() => { groupForm.setFieldsValue({ name: `앱 ${Math.max(0, ...(groups.data ?? []).map(g => Number(g.name.match(/앱\s*(\d+)기/)?.[1] ?? 0))) + 1}기` }); setGroupOpen(true) }}>기수 추가</Button>
      <Button type="primary" icon={<PlusOutlined />} disabled={groups.isPending || groups.isError} onClick={() => setCreateOpen(true)}>방 생성</Button>
    </Space>} />
    {createOpen && <CreateRoomModal open onClose={() => setCreateOpen(false)} groups={groups.data ?? []} />}
    <Card>
      <Space wrap style={{ marginBottom: 16 }}>
        <Segmented aria-label="방 구분 필터" value={view} onChange={v => changeFilter('view', String(v))}
          options={[{ value: 'operational', label: '운영방' }, { value: 'test', label: '테스트방' }, { value: 'all', label: '전체' }]} />
        <Select aria-label="방 상태 필터" placeholder="전체 상태" allowClear style={{ width: 130 }} value={status} onChange={v => changeFilter('status', v)} options={STATUS_OPTIONS} />
        <DatePicker placeholder="예정일" value={date ? dayjs(date) : null} onChange={v => changeFilter('date', v?.format('YYYY-MM-DD'))} />
      </Space>
      {selected.length > 0 && <Space style={{ display: 'flex', marginBottom: 12 }}>
        <Typography.Text>{selected.length}개 선택</Typography.Text>
        <Button disabled={selected.length > 100} onClick={() => { assignForm.setFieldsValue({ group: 'keep', type: 'keep' }); setAssignOpen(true) }}>기수·구분 지정</Button>
        <Button type="text" onClick={() => setSelected([])}>선택 해제</Button>
        {selected.length > 100 && <Typography.Text type="secondary">한 번에 100개까지 지정할 수 있습니다.</Typography.Text>}
      </Space>}
      {groups.isPending ? <Skeleton active /> : groups.isError ? <Alert type="error" showIcon title="기수를 불러오지 못했습니다." action={<Button onClick={() => groups.refetch()}>다시 시도</Button>} /> :
        <Collapse activeKey={expanded} onChange={keys => setExpanded(typeof keys === 'string' ? [keys] : keys)} destroyOnHidden items={sections.map(group => ({
          key: String(group.id), label: group.name,
          children: <GroupRoomsTable key={group.id} query={{ ...filter, groupId: typeof group.id === 'number' ? group.id : undefined, ungrouped: group.id === 'ungrouped' }}
            selected={selected} onSelect={setSelected} canWrite={canWrite} showAll={showAll}
            page={Math.max(0, Number(params.get(`page.${group.id}`)) || 0)}
            size={[10, 20, 50, 100].includes(Number(params.get(`size.${group.id}`))) ? Number(params.get(`size.${group.id}`)) : 20}
            onPageChange={(page, size) => changePage(String(group.id), page, size)} onOpenRoom={openRoom} />,
        }))} />}
    </Card>
    <Modal title="기수 추가" open={groupOpen} onCancel={() => setGroupOpen(false)} onOk={() => groupForm.submit()} confirmLoading={createGroup.isPending} okText="추가" cancelText="취소" destroyOnHidden>
      <Form form={groupForm} layout="vertical" onFinish={v => createGroup.mutate(v.name.trim())}>
        <Form.Item label="기수 이름" name="name" rules={[{ required: true, whitespace: true, max: 50, message: '기수 이름을 50자 이내로 입력하세요.' }]}><Input autoFocus maxLength={50} placeholder="앱 4기" /></Form.Item>
      </Form>
    </Modal>
    <Modal title={`${selected.length}개 방 지정`} open={assignOpen} onCancel={() => setAssignOpen(false)} onOk={apply} confirmLoading={assign.isPending} okText="적용" cancelText="취소" destroyOnHidden>
      <Form form={assignForm} layout="vertical">
        <Form.Item label="기수" name="group"><Select options={[{ value: 'keep', label: '변경 안 함' }, ...(groups.data ?? []).map(g => ({ value: g.id, label: g.name })), { value: 'none', label: '기수 미지정' }]} /></Form.Item>
        <Form.Item label="방 구분" name="type"><Select options={[{ value: 'keep', label: '변경 안 함' }, { value: 'operational', label: '운영방' }, { value: 'test', label: '테스트방' }]} /></Form.Item>
      </Form>
    </Modal>
  </>
}
