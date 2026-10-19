import { useState } from 'react'
import { Card, Table, Input, Select, Space, Tag, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useIapPurchases } from '../api/queries'
import { IapStatusTag, StoreTag } from '../components/StatusTag'
import type { IapPurchaseListItem, IapPurchaseStatus } from '../api/types'

const columns: ColumnsType<IapPurchaseListItem> = [
  { title: '구매 ID', dataIndex: 'id', width: 90 },
  {
    title: '유저',
    key: 'user',
    render: (_, r) => (
      <span>
        {r.nickname ?? <Tag>미설정</Tag>} <span style={{ color: '#9aa0a8', fontSize: 12 }}>#{r.user_id}</span>
      </span>
    ),
  },
  { title: '상품', dataIndex: 'store_product_id', width: 140 },
  { title: '코인', dataIndex: 'coin_amount', width: 80 },
  { title: '스토어', dataIndex: 'store', width: 120, render: (s) => <StoreTag store={s} /> },
  { title: '상태', dataIndex: 'status', width: 90, render: (s: IapPurchaseStatus) => <IapStatusTag status={s} /> },
  {
    title: '구매시각',
    dataIndex: 'purchased_at',
    width: 160,
    render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
  },
]

export default function IapPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<IapPurchaseStatus>()
  const [storeProductId, setStoreProductId] = useState<string>()
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  const { data, isLoading, isError } = useIapPurchases({ status, storeProductId, page, size })

  return (
    <>
      <PageHeader title="재화·결제(IAP)" subtitle="인앱결제 내역을 조회합니다" />
      {/* 환불·재검증·코인 수동조정(쓰기)은 백엔드 이슈 6 후속 → 현재는 조회만 */}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="환불·재검증·코인 수동조정은 백엔드 후속(이슈 6) 연동 예정 — 현재는 조회 전용입니다."
      />
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
            options={[
              { value: 'OWNED', label: '보유' },
              { value: 'REFUNDED', label: '환불' },
            ]}
          />
          <Input.Search
            placeholder="상품 id (예: groom_60)"
            allowClear
            style={{ width: 220 }}
            onSearch={(v) => {
              setStoreProductId(v || undefined)
              setPage(0)
            }}
          />
        </Space>
        <Table<IapPurchaseListItem>
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={data?.content}
          onRow={(r) => ({ onClick: () => navigate(`/iap/${r.id}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: isError ? '조회 실패' : '결제 내역 없음' }}
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
