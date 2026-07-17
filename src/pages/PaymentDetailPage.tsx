import { Card, Descriptions, Button, Alert, Skeleton, Space, Tooltip } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useIapPurchase } from '../api/queries'
import { IapStatusTag, StoreTag } from '../components/StatusTag'

export default function PaymentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useIapPurchase(Number(id))

  if (isError) return <Alert type="error" message="결제 내역을 찾을 수 없습니다." showIcon />

  return (
    <>
      <PageHeader
        title={`결제 상세 #${id}`}
        extra={
          <Space>
            {/* 환불·재검증(쓰기)은 백엔드 이슈 6 후속 */}
            <Tooltip title="백엔드 후속(이슈 6) 연동 예정">
              <Button disabled>재검증</Button>
            </Tooltip>
            <Tooltip title="백엔드 후속(이슈 6) 연동 예정">
              <Button danger disabled>
                환불
              </Button>
            </Tooltip>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/iap')}>
              목록
            </Button>
          </Space>
        }
      />
      <Skeleton loading={isLoading} active>
        {data && (
          <Card>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="상태">
                <IapStatusTag status={data.status} />
              </Descriptions.Item>
              <Descriptions.Item label="스토어">
                <StoreTag store={data.store} />
              </Descriptions.Item>
              <Descriptions.Item label="구매 유저">
                <a onClick={() => navigate(`/users/${data.user_id}`)}>
                  {data.nickname ?? '(미설정)'} #{data.user_id}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="지급 코인">{data.coin_amount}</Descriptions.Item>
              <Descriptions.Item label="상품 ID">{data.product_id}</Descriptions.Item>
              <Descriptions.Item label="스토어 상품 ID">{data.store_product_id}</Descriptions.Item>
              <Descriptions.Item label="스토어 거래 ID" span={2}>
                <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{data.store_transaction_id}</span>
              </Descriptions.Item>
              <Descriptions.Item label="구매 시각">
                {dayjs(data.purchased_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="환불 시각">
                {data.refunded_at ? dayjs(data.refunded_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Skeleton>
    </>
  )
}
