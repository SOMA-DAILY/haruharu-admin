import { useState } from 'react'
import { Card, Table, Select, DatePicker, Space, Button, Tooltip, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useQuery } from '@tanstack/react-query'
import { roomsApi } from '../api/endpoints'
import { useRoomActivitySummary, useRooms } from '../api/queries'
import { useAuth } from '../auth/AuthContext'
import { RoomStatusTag } from '../components/StatusTag'
import CreateRoomModal from '../components/CreateRoomModal'
import type { RoomListItem, RoomStatus } from '../api/types'

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

export default function SessionsPage() {
  const navigate = useNavigate()
  const { me } = useAuth()
  const canWrite = me?.role === 'SUPER' || me?.role === 'OPERATOR'
  const [status, setStatus] = useState<RoomStatus>()
  const [date, setDate] = useState<Dayjs | null>(null)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useRooms({
    status,
    scheduledDate: date ? date.format('YYYY-MM-DD') : undefined,
    page,
    size,
  })

  return (
    <>
      <PageHeader
        title="세션(방) 관리"
        subtitle="소개팅 방 조회 · 생성"
        extra={
          canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              방 생성
            </Button>
          )
        }
      />
      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="상태"
            allowClear
            style={{ width: 140 }}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            options={STATUS_OPTIONS}
          />
          <DatePicker
            placeholder="예정일"
            value={date}
            onChange={(d) => {
              setDate(d)
              setPage(0)
            }}
          />
        </Space>
        <Table<RoomListItem>
          rowKey="room_id"
          loading={isLoading}
          columns={columns}
          dataSource={data?.content}
          onRow={(r) => ({ onClick: () => navigate(`/sessions/${r.room_id}`), style: { cursor: 'pointer' } })}
          pagination={{
            current: (data?.page.page ?? 0) + 1,
            pageSize: size,
            total: data?.page.total_elements ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p - 1)
              setSize(ps)
            },
          }}
        />
      </Card>
    </>
  )
}
