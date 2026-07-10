import { useState } from 'react'
import { Card, Table, Input, Select, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useUsers } from '../api/queries'
import { UserStatusTag } from '../components/StatusTag'
import type { UserListItem, UserStatus } from '../api/types'

const columns: ColumnsType<UserListItem> = [
  { title: '유저 ID', dataIndex: 'user_id', width: 90 },
  { title: '닉네임', dataIndex: 'nickname', render: (v: string | null) => v ?? <Tag>미설정</Tag> },
  { title: '지역', dataIndex: 'region', width: 120, render: (v: string | null) => v ?? '-' },
  { title: '상태', dataIndex: 'status', width: 100, render: (s: UserStatus) => <UserStatusTag status={s} /> },
  {
    title: '가입일',
    dataIndex: 'created_at',
    width: 160,
    render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
  },
]

export default function UsersPage() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState<string>()
  const [status, setStatus] = useState<UserStatus>()
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  const { data, isLoading } = useUsers({ keyword, status, page, size })

  return (
    <>
      <PageHeader title="유저 관리" subtitle="가입 유저를 조회합니다" />
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="닉네임 검색"
            allowClear
            style={{ width: 220 }}
            onSearch={(v) => {
              setKeyword(v || undefined)
              setPage(0)
            }}
          />
          <Select
            placeholder="상태"
            allowClear
            style={{ width: 140 }}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            options={[
              { value: 'ONBOARDING', label: '온보딩' },
              { value: 'ACTIVE', label: '활성' },
              { value: 'INACTIVE', label: '휴면' },
              { value: 'BANNED', label: '정지' },
              { value: 'DELETED', label: '탈퇴' },
            ]}
          />
        </Space>
        <Table<UserListItem>
          rowKey="user_id"
          loading={isLoading}
          columns={columns}
          dataSource={data?.content}
          onRow={(r) => ({ onClick: () => navigate(`/users/${r.user_id}`), style: { cursor: 'pointer' } })}
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
