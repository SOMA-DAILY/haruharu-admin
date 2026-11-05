import { Alert, Button, Skeleton, Statistic } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useReports } from '../api/queries'

/** 대시보드 "신고 미처리 큐": 접수(RECEIVED) 건수 + 목록 링크 (#95). */
export default function ReportQueueCard() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useReports({ status: 'RECEIVED', page: 0, size: 1 })
  if (isLoading) return <Skeleton active paragraph={{ rows: 1 }} />
  if (isError) return <Alert type="warning" showIcon title="신고 건수를 불러오지 못했어요" />
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Statistic title="접수 대기" value={data?.page.total_elements ?? 0} suffix="건" />
      <Button type="primary" onClick={() => navigate('/reports')}>
        신고 목록
      </Button>
    </div>
  )
}
