import { Card, Result } from 'antd'
import { PageHeader } from '../layout/AdminLayout'

// 목업은 있으나 백엔드 API가 후속(이슈 5~7)인 화면용 placeholder.
// API가 준비되면 각 전용 페이지로 교체.
export default function PlaceholderPage({
  title,
  subtitle,
  note,
}: {
  title: string
  subtitle?: string
  note: string
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <Result status="info" title="백엔드 API 연동 대기" subTitle={note} />
      </Card>
    </>
  )
}
