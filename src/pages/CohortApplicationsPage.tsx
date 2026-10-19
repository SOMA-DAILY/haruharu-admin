import { useState } from 'react'
import { Alert, App, Button, Card, Col, Empty, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import {
  useApproveApplication,
  useCohortApplications,
  useCohorts,
  useRecruitTracks,
  useRooms,
  useUpdateApplicationMemo,
} from '../api/queries'
import type { Cohort, CohortApplication, CohortApplicationStatus, Gender, RecruitTrack } from '../api/types'
import { CohortApplicationStatusTag } from '../components/StatusTag'
import AssignApplicantsModal from '../components/AssignApplicantsModal'

const AUDIENCE: Record<string, string> = { STUDENT: '학생', WORKER: '직장인' }
const STATUS_OPTIONS: { value: CohortApplicationStatus; label: string }[] = [
  { value: 'IDENTITY_PENDING', label: 'PASS 대기' },
  { value: 'NEEDS_REVIEW', label: '확인 필요' },
  { value: 'QUEUED', label: '편성 대기' },
  { value: 'ASSIGNED', label: '방 배정' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'CANCELLED', label: '취소' },
  { value: 'NOT_ASSIGNED', label: '못 넣음' },
]
const nowrap = () => ({ style: { whiteSpace: 'nowrap' as const } })

// 트랙마다 지금 보여줄 기수: 공개 중 → 없으면 가장 최근 기수
const currentCohortOf = (cohorts: Cohort[], trackId: number) => {
  const mine = cohorts.filter((c) => c.track_id === trackId).sort((a, b) => b.sequence - a.sequence)
  return mine.find((c) => c.status === 'OPEN') ?? mine[0]
}

function TrackCard({ tracks, cohorts }: { tracks: RecruitTrack[]; cohorts: Cohort[] }) {
  const columns: ColumnsType<RecruitTrack> = [
    { title: '키', dataIndex: 'key' },
    { title: '이름', dataIndex: 'label' },
    { title: '지역 / 대상', key: 'region', render: (_, t) => `${t.region} / ${AUDIENCE[t.audience] ?? t.audience}` },
    {
      title: '문항',
      dataIndex: 'questions',
      render: (q: RecruitTrack['questions']) => ['학교', '학과', '전화번호', ...q.map((x) => x.label)].join(', '),
    },
    { title: '기수', key: 'cohort', render: (_, t) => (currentCohortOf(cohorts, t.id) ? `${currentCohortOf(cohorts, t.id)!.sequence}기` : '-') },
    {
      title: '모집',
      key: 'accepting',
      render: (_, t) =>
        !currentCohortOf(cohorts, t.id) ? (
          <Tag>기수 없음</Tag>
        ) : currentCohortOf(cohorts, t.id)!.is_accepting ? (
          <Tag color="green">모집 중</Tag>
        ) : (
          <Tag>마감</Tag>
        ),
    },
    {
      title: '마감',
      key: 'closes',
      render: (_, t) => {
        const c = currentCohortOf(cohorts, t.id)
        return c ? dayjs(c.apply_closes_at).format('MM/DD HH:mm') : '-'
      },
    },
    { title: '안내 문구', key: 'period', render: (_, t) => currentCohortOf(cohorts, t.id)?.period_label ?? '-' },
  ]
  return (
    <Card title="모집 트랙" style={{ marginBottom: 16 }}>
      <Table<RecruitTrack> rowKey="id" size="middle" pagination={false} columns={columns} dataSource={tracks} />
    </Card>
  )
}

// 집계 4칸. 신청 목록 API 의 total_elements 로 센다 (size 1)
function Stats({ cohortId }: { cohortId: number }) {
  const total = (q: ReturnType<typeof useCohortApplications>) => q.data?.page.total_elements
  const queuedF = total(useCohortApplications(cohortId, { status: 'QUEUED', gender: 'FEMALE', size: 1 }))
  const queuedM = total(useCohortApplications(cohortId, { status: 'QUEUED', gender: 'MALE', size: 1 }))
  const pending = total(useCohortApplications(cohortId, { status: 'IDENTITY_PENDING', size: 1 }))
  const review = total(useCohortApplications(cohortId, { status: 'NEEDS_REVIEW', size: 1 }))
  const rooms = (useRooms({ cohortId, size: 100 }).data?.content ?? []).filter((r) => r.status !== 'CANCELLED')
  const n = (v?: number) => v ?? '-'
  return (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={6}>
        <Card size="small">
          <Statistic title="편성 대기" value={`여 ${n(queuedF)} / 남 ${n(queuedM)}`} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="PASS 대기" value={n(pending)} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="확인 필요" value={n(review)} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="이번 기수 방" value={rooms.length ? rooms.map((r) => r.room_id).sort((a, b) => a - b).map((id) => `#${id}`).join(', ') : '-'} />
        </Card>
      </Col>
    </Row>
  )
}

export default function CohortApplicationsPage() {
  const { me } = useAuth()
  const { message } = App.useApp()
  const canWrite = me?.role === 'SUPER' || me?.role === 'OPERATOR'
  const tracks = useRecruitTracks()
  const cohorts = useCohorts()
  const cohortList = cohorts.data ?? []
  const [cohortId, setCohortId] = useState<number>()
  const selectedCohortId = cohortId ?? cohortList.find((c) => c.status === 'OPEN')?.id ?? cohortList[0]?.id
  const [status, setStatus] = useState<CohortApplicationStatus>()
  const [gender, setGender] = useState<Gender>()
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(50)
  const [selected, setSelected] = useState<CohortApplication[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const apps = useCohortApplications(selectedCohortId, { status, gender, page, size }, canWrite)
  const memoMut = useUpdateApplicationMemo()
  const approveMut = useApproveApplication()

  // 신청자 표는 번호가 들어 있어 SUPER·OPERATOR 만 (BE #515)
  if (me && !canWrite) return <Alert type="warning" showIcon message="기수 신청은 운영자(SUPER·OPERATOR)만 볼 수 있습니다." />

  const fail = (e: unknown, fallback: string) => message.error(e instanceof ApiError ? e.message : fallback)
  const saveMemo = async (a: CohortApplication, memo: string) => {
    if ((a.admin_memo ?? '') === memo.trim()) return
    try {
      await memoMut.mutateAsync({ applicationId: a.application_id, memo: memo.trim() || null })
    } catch (e) {
      fail(e, '메모를 저장하지 못했습니다.')
    }
  }
  const approve = async (a: CohortApplication) => {
    try {
      await approveMut.mutateAsync(a.application_id)
      message.success(`${a.name ?? '신청'}을 편성 대기로 올렸습니다.`)
    } catch (e) {
      fail(e, '승인하지 못했습니다.')
    }
  }

  const columns: ColumnsType<CohortApplication> = [
    { title: '이름 (PASS)', dataIndex: 'name', render: (v: string | null) => v ?? '-' },
    {
      title: '성별',
      dataIndex: 'gender',
      render: (g: Gender | null) =>
        g ? <Tag color={g === 'FEMALE' ? 'magenta' : 'blue'}>{g === 'FEMALE' ? '여성' : '남성'}</Tag> : '-',
    },
    { title: '나이', dataIndex: 'age', render: (v: number | null) => v ?? '-' },
    { title: '학교 / 학과', key: 'school', render: (_, a) => `${a.school} / ${a.department}` },
    {
      title: '번호',
      dataIndex: 'phone',
      render: (v: string | null) =>
        v ? <Typography.Text copyable={{ text: v }}>…{v.slice(-4)}</Typography.Text> : '-',
    },
    { title: '신청', dataIndex: 'applied_at', render: (v: string) => dayjs(v).format('MM/DD HH:mm') },
    {
      title: '참여 이력',
      dataIndex: 'past_room_ids',
      render: (ids: number[]) => (ids.length ? ids.map((id) => `#${id}`).join(', ') : '처음'),
    },
    { title: '상태', dataIndex: 'status', render: (s: CohortApplicationStatus) => <CohortApplicationStatusTag status={s} /> },
    { title: '방', dataIndex: 'room_id', render: (v: number | null) => (v ? `#${v}` : '-') },
    {
      title: '메모',
      key: 'memo',
      dataIndex: 'admin_memo',
      width: 240,
      render: (v: string | null, a) => (
        <Typography.Paragraph
          style={{ margin: 0 }}
          editable={{ text: v ?? '', maxLength: 500, onChange: (memo) => saveMemo(a, memo) }}
        >
          {v ?? ''}
        </Typography.Paragraph>
      ),
    },
    {
      key: 'action',
      render: (_, a) =>
        a.status === 'NEEDS_REVIEW' && (
          <Popconfirm title="편성 대기로 올릴까요?" description="성별은 PASS 성별로 맞춰집니다." onConfirm={() => approve(a)}>
            <Button size="small">승인</Button>
          </Popconfirm>
        ),
    },
  ]

  return (
    <>
      <PageHeader title="기수 신청" subtitle="앱 신청자 조회, 메모, 승인, 방에 넣기" />
      {tracks.isError || cohorts.isError ? (
        <Alert type="error" showIcon message="트랙·기수를 불러오지 못했습니다." style={{ marginBottom: 16 }} />
      ) : (
        <TrackCard tracks={tracks.data ?? []} cohorts={cohortList} />
      )}
      {selectedCohortId && <Stats cohortId={selectedCohortId} />}
      <Card>
        <Space style={{ marginBottom: 16, width: '100%' }}>
          <Typography.Text strong style={{ marginRight: 8 }}>
            앱 신청자
          </Typography.Text>
          <Select
            style={{ width: 180 }}
            placeholder="기수"
            value={selectedCohortId}
            onChange={(v) => {
              setCohortId(v)
              setSelected([])
              setPage(0)
            }}
            options={cohortList.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            allowClear
            style={{ width: 130 }}
            placeholder="전체 상태"
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            options={STATUS_OPTIONS}
          />
          <Select
            allowClear
            style={{ width: 120 }}
            placeholder="전체 성별"
            value={gender}
            onChange={(v) => {
              setGender(v)
              setPage(0)
            }}
            options={[
              { value: 'FEMALE', label: '여성' },
              { value: 'MALE', label: '남성' },
            ]}
          />
        </Space>
        <div style={{ float: 'right', marginTop: -48 }}>
          <Button type="primary" disabled={selected.length === 0} onClick={() => setAssignOpen(true)}>
            방에 넣기 ({selected.length}명)
          </Button>
        </div>
        {apps.isError ? (
          <Alert type="error" showIcon message="신청자를 불러오지 못했습니다." />
        ) : (
          <Table<CohortApplication>
            rowKey="application_id"
            loading={apps.isLoading}
            columns={columns.map((c) => (c.key === 'memo' ? c : { ...c, onHeaderCell: nowrap, onCell: nowrap }))}
            dataSource={apps.data?.content ?? []}
            locale={{ emptyText: <Empty description={selectedCohortId ? '신청자가 없습니다.' : '기수가 없습니다.'} /> }}
            rowSelection={{
              selectedRowKeys: selected.map((a) => a.application_id),
              onChange: (_, rows) => setSelected(rows),
              getCheckboxProps: (a) => ({ disabled: a.status !== 'QUEUED' }),
            }}
            pagination={{
              current: page + 1,
              pageSize: size,
              total: apps.data?.page.total_elements ?? 0,
              onChange: (p, s) => {
                setPage(p - 1)
                setSize(s)
              },
            }}
          />
        )}
      </Card>
      {selectedCohortId && (
        <AssignApplicantsModal
          cohortId={selectedCohortId}
          applicants={selected}
          open={assignOpen}
          onClose={() => {
            setAssignOpen(false)
            setSelected([])
          }}
        />
      )}
    </>
  )
}
