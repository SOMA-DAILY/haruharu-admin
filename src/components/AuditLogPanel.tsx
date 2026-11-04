import { useState } from 'react'
import { Alert, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Link } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { useAdminAccounts, useAuditLogs, useAuditReviews, useAuditSummary, useCreateAuditReview } from '../api/queries'
import { ApiError } from '../api/client'
import type { AuditAction, AuditLog, AuditReview, AuditTargetType } from '../api/types'

const ACTION_LABEL: Record<AuditAction, string> = {
  LOGIN: '로그인',
  LOGIN_FAIL: '로그인 실패',
  LOGOUT: '로그아웃',
  VIEW: '조회',
  VIEW_USERS: '유저 목록 조회',
  VIEW_USER: '유저 상세 조회',
  VIEW_ROOMS: '방 목록 조회',
  VIEW_ROOM: '방 상세 조회',
  VIEW_ROOM_ACTIVITY: '방 활동 조회',
  VIEW_REPORTS: '신고 목록 조회',
  VIEW_REPORT: '신고 상세 조회',
  CREATE: '생성',
  UPDATE: '수정',
  DELETE: '삭제',
  EXPORT: '반출',
}
const ACTION_COLOR: Partial<Record<AuditAction, string>> = { EXPORT: 'red', LOGIN_FAIL: 'orange', DELETE: 'volcano' }

function Target({ type, id }: { type: AuditTargetType | null; id: number | null }) {
  if (!type) return <>-</>
  if (id == null) return <Tag>{type}</Tag>
  if (type === 'USER') return <Link to={`/users/${id}`}>유저 #{id}</Link>
  if (type === 'ROOM') return <Link to={`/sessions/${id}`}>방 #{id}</Link>
  if (type === 'REPORT') return <Link to="/reports">신고 #{id}</Link>
  return <>{type} #{id}</>
}

/** 개인정보 접속기록 (#96, 안전성 확보조치 기준 제8조). SUPER 전용. */
export default function AuditLogPanel() {
  const { message } = App.useApp()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(6, 'day'), dayjs()])
  const [adminId, setAdminId] = useState<number>()
  const [action, setAction] = useState<AuditAction>()
  const [targetId, setTargetId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewForm] = Form.useForm<{ note?: string }>()

  const from = range[0].format('YYYY-MM-DD')
  const to = range[1].format('YYYY-MM-DD')
  const admins = useAdminAccounts()
  const logs = useAuditLogs({ adminId, action, targetId: targetId ?? undefined, from, to, page, size: 50 })
  const summary = useAuditSummary({ from, to })
  const reviews = useAuditReviews()
  const createReview = useCreateAuditReview()

  const totals = (summary.data?.per_admin ?? []).reduce((a, r) => ({ views: a.views + r.views, exports: a.exports + r.exports }), { views: 0, exports: 0 })
  const heavyAdmins = new Set((summary.data?.heavy_viewers ?? []).map((h) => h.admin.id)).size
  const reset = () => setPage(0)

  const columns: ColumnsType<AuditLog> = [
    { title: '일시', dataIndex: 'occurred_at', width: 150, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
    { title: '관리자', dataIndex: 'admin', width: 130, render: (a: AuditLog['admin'], r) => (a ? `${a.name ?? '-'} #${a.id}` : <Typography.Text type="secondary">{r.detail ?? '-'}</Typography.Text>) },
    { title: '행위', dataIndex: 'action', width: 130, render: (v: AuditAction) => <Tag color={ACTION_COLOR[v]}>{ACTION_LABEL[v] ?? v}</Tag> },
    { title: '대상', key: 'target', width: 120, render: (_, r) => <Target type={r.target_type} id={r.target_id} /> },
    { title: '사유', dataIndex: 'reason', ellipsis: true, render: (v: string | null, r) => v ?? (r.action === 'EXPORT' ? r.detail : null) ?? '-' },
    { title: 'IP', dataIndex: 'ip', width: 130, render: (v: string | null) => v ?? '-' },
    { title: '결과', dataIndex: 'status_code', width: 70, render: (v: number) => <Tag color={v >= 400 ? 'red' : 'green'}>{v}</Tag> },
  ]
  const reviewColumns: ColumnsType<AuditReview> = [
    { title: '점검 월', dataIndex: 'period', width: 100 },
    { title: '확인자', dataIndex: 'admin', width: 140, render: (a: AuditReview['admin']) => `${a.name ?? '-'} #${a.id}` },
    { title: '일시', dataIndex: 'reviewed_at', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '메모', dataIndex: 'note', render: (v: string | null) => v ?? '-' },
  ]

  const submitReview = async (v: { note?: string }) => {
    try {
      await createReview.mutateAsync({ period: dayjs().format('YYYY-MM'), note: v.note })
      message.success('이번 달 점검을 기록했습니다.')
      setReviewOpen(false)
      reviewForm.resetFields()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '기록하지 못했습니다.')
    }
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={12}>
        <Col span={8}>
          <Card size="small" hoverable onClick={() => { setAction(undefined); reset() }}>
            <Statistic title="조회 수" value={totals.views} loading={summary.isLoading} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" hoverable onClick={() => { setAction('EXPORT'); reset() }}>
            <Statistic title="반출 수" value={totals.exports} loading={summary.isLoading} styles={totals.exports ? { content: { color: '#cf1322' } } : undefined} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" hoverable onClick={() => { const h = summary.data?.heavy_viewers[0]; if (h) { setAdminId(h.admin.id); reset() } }}>
            <Statistic title={`대량 조회 관리자 (하루 ${summary.data?.heavy_view_threshold ?? 200}건 이상)`} value={heavyAdmins} loading={summary.isLoading} styles={heavyAdmins ? { content: { color: '#cf1322' } } : undefined} />
          </Card>
        </Col>
      </Row>
      {summary.isError && <Alert type="warning" showIcon title="요약을 불러오지 못했습니다" />}

      <Space wrap>
        <DatePicker.RangePicker value={range} allowClear={false} onChange={(v) => { if (v?.[0] && v[1]) { setRange([v[0], v[1]]); reset() } }} />
        <Select placeholder="관리자 (전체)" allowClear style={{ width: 170 }} value={adminId} loading={admins.isLoading}
          onChange={(v) => { setAdminId(v); reset() }} options={(admins.data ?? []).map((a) => ({ value: a.id, label: `${a.name} #${a.id}` }))} />
        <Select placeholder="행위 (전체)" allowClear style={{ width: 160 }} value={action}
          onChange={(v) => { setAction(v); reset() }} options={(Object.keys(ACTION_LABEL) as AuditAction[]).map((k) => ({ value: k, label: ACTION_LABEL[k] }))} />
        <InputNumber placeholder="대상 ID" min={1} style={{ width: 120 }} value={targetId} onChange={(v) => { setTargetId(v); reset() }} />
      </Space>

      {logs.isError && <Alert type="error" showIcon title="접속기록을 불러오지 못했습니다" description="서버 #554 배포 전이면 이 API 가 없습니다." />}
      <Table<AuditLog>
        rowKey="log_id"
        size="small"
        loading={logs.isLoading}
        columns={columns}
        dataSource={logs.data?.content}
        locale={{ emptyText: <Empty description="이 조건의 기록이 없습니다" /> }}
        pagination={{ current: page + 1, pageSize: 50, total: logs.data?.page.total_elements ?? 0, showSizeChanger: false, onChange: (p) => setPage(p - 1) }}
      />

      <Card size="small" title="정기 점검 (월 1회)" extra={<Button type="primary" onClick={() => setReviewOpen(true)}>이번 달 점검 완료</Button>}>
        {reviews.isError && <Alert type="error" showIcon title="점검 이력을 불러오지 못했습니다" />}
        <Table<AuditReview> rowKey="review_id" size="small" loading={reviews.isLoading} columns={reviewColumns} dataSource={reviews.data} pagination={false}
          locale={{ emptyText: <Empty description="점검 기록이 없습니다" /> }} />
      </Card>

      <Modal title={`${dayjs().format('YYYY-MM')} 접속기록 점검`} open={reviewOpen} onCancel={() => setReviewOpen(false)} onOk={() => reviewForm.submit()}
        okText="기록" confirmLoading={createReview.isPending} destroyOnHidden>
        <Form form={reviewForm} layout="vertical" onFinish={submitReview}>
          <Typography.Paragraph type="secondary">반출 내역과 대량 조회 관리자를 확인했으면 기록합니다.</Typography.Paragraph>
          <Form.Item name="note" label="메모" rules={[{ max: 500 }]}>
            <Input.TextArea rows={3} placeholder="예: 반출 2건 사유 확인, 이상 없음" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
