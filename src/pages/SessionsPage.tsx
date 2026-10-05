import { useState } from 'react'
import { Card, Table, Select, DatePicker, Space, Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useRooms } from '../api/queries'
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
