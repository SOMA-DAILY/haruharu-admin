import { useState } from 'react'
import { Alert, App, Button, Card, Descriptions, Drawer, Select, Skeleton, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useReport, useReports, useResolveReport } from '../api/queries'
import { ApiError } from '../api/client'
import { ReportStatusTag, UserStatusTag } from '../components/StatusTag'
import { REPORT_REASON_LABEL } from '../config/reportLabels'
import { useAuth } from '../auth/AuthContext'
import type { AdminReport, ReportStatus } from '../api/types'

const STATUS_OPTIONS = [
  { value: 'RECEIVED', label: '접수' },
  { value: 'SANCTIONED', label: '제재' },
  { value: 'REJECTED', label: '기각' },
]

function Person({ user_id, nickname }: { user_id: number; nickname: string | null }) {
  return (
    <span>
      {nickname ?? <Tag>미설정</Tag>} <Typography.Text type="secondary">#{user_id}</Typography.Text>
    </span>
  )
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const { modal, message } = App.useApp()
  const { me } = useAuth()
  const canResolve = me?.role === 'SUPER' || me?.role === 'OPERATOR'
  const [status, setStatus] = useState<ReportStatus | undefined>('RECEIVED')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const list = useReports({ status, page, size })
  const detail = useReport(selectedId)
  const resolve = useResolveReport()

  const confirm = (r: AdminReport, action: 'approve' | 'reject') => {
    modal.confirm({
      title: action === 'approve' ? '제재 승인' : '신고 기각',
      content:
        action === 'approve'
          ? `${r.reported.nickname ?? `#${r.reported.user_id}`} 유저는 앱의 모든 기능을 쓸 수 없게 됩니다. 되돌릴 수 없습니다.`
          : '이 신고를 기각합니다. 피신고자 상태는 바뀌지 않습니다.',
      okText: action === 'approve' ? '승인' : '기각',
      okButtonProps: { danger: action === 'approve' },
      onOk: () =>
        resolve
          .mutateAsync({ reportId: r.report_id, action })
          .then(() => message.success(action === 'approve' ? '제재했습니다' : '기각했습니다'))
          .catch((e) => message.error(e instanceof ApiError ? e.message : '처리하지 못했어요')),
    })
  }

  const columns: ColumnsType<AdminReport> = [
    { title: '신고 시각', dataIndex: 'created_at', width: 150, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '신고자', dataIndex: 'reporter', width: 160, render: (p: AdminReport['reporter']) => <Person {...p} /> },
    {
      title: '피신고자',
      dataIndex: 'reported',
      width: 200,
      render: (p: AdminReport['reported']) => (
        <Space size={4}>
          <Person user_id={p.user_id} nickname={p.nickname} />
          {p.status === 'BANNED' && <UserStatusTag status="BANNED" />}
        </Space>
      ),
    },
    {
      title: '방',
      dataIndex: 'room_id',
      width: 90,
      render: (id: number | null, row) =>
        id == null ? '-' : (
          <Typography.Link
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/sessions/${id}?userId=${row.reported.user_id}`)
            }}
          >
            #{id}
          </Typography.Link>
        ),
    },
    { title: '사유', dataIndex: 'reason', width: 150, render: (r: AdminReport['reason']) => REPORT_REASON_LABEL[r] },
    { title: '상세', dataIndex: 'detail', ellipsis: true, render: (v: string | null) => v ?? '-' },
    { title: '상태', dataIndex: 'status', width: 90, render: (s: ReportStatus) => <ReportStatusTag status={s} /> },
  ]

  const r = detail.data
  return (
    <>
      <PageHeader title="신고·안전" subtitle="유저 신고를 확인하고 제재 또는 기각합니다" />
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="상태 (전체)"
            allowClear
            style={{ width: 140 }}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            options={STATUS_OPTIONS}
          />
        </Space>
        {list.isError && <Alert type="error" showIcon style={{ marginBottom: 16 }} title="신고 목록을 불러오지 못했어요" />}
        <Table<AdminReport>
          rowKey="report_id"
          loading={list.isLoading}
          columns={columns}
          dataSource={list.data?.content}
          onRow={(row) => ({ onClick: () => setSelectedId(row.report_id), style: { cursor: 'pointer' } })}
          pagination={{
            current: (list.data?.page.page ?? 0) + 1,
            pageSize: size,
            total: list.data?.page.total_elements ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p - 1)
              setSize(ps)
            },
          }}
        />
      </Card>

      <Drawer title={r ? `신고 #${r.report_id}` : '신고'} size={520} open={selectedId != null} onClose={() => setSelectedId(null)}>
        {detail.isLoading && <Skeleton active />}
        {detail.isError && <Alert type="error" showIcon title="신고를 불러오지 못했어요" />}
        {r && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="상태"><ReportStatusTag status={r.status} /></Descriptions.Item>
              <Descriptions.Item label="신고 시각">{dayjs(r.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="신고자">
                <Space><Person {...r.reporter} /><Button size="small" onClick={() => navigate(`/users/${r.reporter.user_id}`)}>유저 상세</Button></Space>
              </Descriptions.Item>
              <Descriptions.Item label="피신고자">
                <Space>
                  <Person user_id={r.reported.user_id} nickname={r.reported.nickname} />
                  {r.reported.status && <UserStatusTag status={r.reported.status} />}
                  <Button size="small" onClick={() => navigate(`/users/${r.reported.user_id}`)}>유저 상세</Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="신고가 난 방">
                {r.room_id == null ? '-' : (
                  <Button size="small" type="primary" onClick={() => navigate(`/sessions/${r.room_id}?userId=${r.reported.user_id}`)}>
                    방 #{r.room_id} 피신고자 영상·채팅
                  </Button>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="이 유저 신고 건수">{r.reported_user_report_count ?? '-'}건</Descriptions.Item>
              <Descriptions.Item label="사유">{REPORT_REASON_LABEL[r.reason]}</Descriptions.Item>
              <Descriptions.Item label="상세">{r.detail ?? '-'}</Descriptions.Item>
              {r.question_id != null && <Descriptions.Item label="익명 질문 id">#{r.question_id}</Descriptions.Item>}
              <Descriptions.Item label="피신고자 참여 방 전체">
                {r.reported.room_ids.length === 0
                  ? '-'
                  : (
                    <Space wrap>
                      {r.reported.room_ids.map((id) => (
                        <Button key={id} size="small" onClick={() => navigate(`/sessions/${id}?userId=${r.reported.user_id}`)}>
                          방 #{id} 영상·채팅
                        </Button>
                      ))}
                    </Space>
                  )}
              </Descriptions.Item>
            </Descriptions>
            {r.status === 'RECEIVED' ? (
              canResolve ? (
                <Space>
                  <Button danger type="primary" loading={resolve.isPending} onClick={() => confirm(r, 'approve')}>제재 승인</Button>
                  <Button loading={resolve.isPending} onClick={() => confirm(r, 'reject')}>기각</Button>
                </Space>
              ) : (
                <Alert type="info" showIcon title="제재 승인·기각은 SUPER·OPERATOR 권한에서만 할 수 있어요" />
              )
            ) : (
              <Alert
                type="success"
                showIcon
                title="처리된 신고입니다"
                description={r.resolved_at ? `${dayjs(r.resolved_at).format('YYYY-MM-DD HH:mm')} 관리자 #${r.resolved_by_admin_id ?? '-'}` : undefined}
              />
            )}
          </Space>
        )}
      </Drawer>
    </>
  )
}
