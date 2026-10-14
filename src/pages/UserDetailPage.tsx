import { Card, Descriptions, Table, Button, Alert, Skeleton, Space, Statistic, Tag, Empty } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useUser } from '../api/queries'
import { UserStatusTag, IapStatusTag } from '../components/StatusTag'
import type { UserPayment } from '../api/types'

const paymentColumns: ColumnsType<UserPayment> = [
  { title: '구매 ID', dataIndex: 'purchase_id', width: 90 },
  { title: '상품', dataIndex: 'store_product_id' },
  { title: '티켓', dataIndex: 'ticket_amount', width: 80 },
  {
    title: '스토어',
    dataIndex: 'store',
    width: 110,
    render: (s: string) => <Tag>{s === 'APP_STORE' ? 'App Store' : 'Play Store'}</Tag>,
  },
  { title: '상태', dataIndex: 'status', width: 90, render: (s: UserPayment['status']) => <IapStatusTag status={s} /> },
  {
    title: '구매시각',
    dataIndex: 'purchased_at',
    render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
  },
]

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useUser(Number(id))
  // 참여한 방 아이디만 최신 입장순으로(같은 방은 한 번)
  const roomIds = [...new Set(data?.participations.map((p) => p.room_id) ?? [])]

  if (isError) return <Alert type="error" message="유저 정보를 찾을 수 없습니다." showIcon />

  return (
    <>
      <PageHeader
        title={`유저 상세 #${id}`}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>
            목록
          </Button>
        }
      />
      <Skeleton loading={isLoading} active>
        {data && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="프로필">
              <Descriptions column={3} bordered size="small">
                <Descriptions.Item label="상태">
                  <UserStatusTag status={data.status} />
                </Descriptions.Item>
                <Descriptions.Item label="닉네임">{data.profile?.nickname ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="지역">{data.profile?.region ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="MBTI">{data.profile?.mbti ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="소속">{data.profile?.affiliation ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="키">{data.profile?.height ? `${data.profile.height}cm` : '-'}</Descriptions.Item>
                <Descriptions.Item label="가입일" span={3}>
                  {dayjs(data.created_at).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              </Descriptions>
              {/* 명세: 성별·나이·본인인증은 identity 도메인 별도 이슈 → placeholder */}
              <Alert
                style={{ marginTop: 12 }}
                type="info"
                showIcon
                message="성별·나이·본인인증(실명/CI·DI)은 백엔드 identity 도메인 후속 연동 예정"
              />
            </Card>

            <Card title="티켓">
              <Statistic title="잔액" value={data.ticket.balance} suffix="장" />
            </Card>

            <Card title={`결제 내역 (${data.payments.length})`}>
              {data.payments.length ? (
                <Table rowKey="purchase_id" columns={paymentColumns} dataSource={data.payments} pagination={false} size="small" />
              ) : (
                <Empty description="결제 내역 없음" />
              )}
            </Card>

            <Card title={`참여 방 이력 (${roomIds.length})`}>
              {roomIds.length ? (
                <Space size={[8, 8]} wrap>
                  {roomIds.map((rid) => (
                    <Tag key={rid} color="blue" style={{ cursor: 'pointer' }} onClick={() => navigate(`/sessions/${rid}`)}>
                      #{rid}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Empty description="참여 이력 없음" />
              )}
            </Card>
          </Space>
        )}
      </Skeleton>
    </>
  )
}
