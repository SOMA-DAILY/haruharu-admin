import { useState } from 'react'
import { Card, Table, Button, Modal, Tag, Switch, Space, Typography, Alert, App } from 'antd'
import { PlusOutlined, VideoCameraOutlined, MessageOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useAuth } from '../auth/AuthContext'
import {
  useMissions,
  useMissionRevisions,
  useCreateMission,
  usePublishRevision,
  useChangeMissionStatus,
} from '../api/queries'
import MissionFormModal from '../components/MissionFormModal'
import { ApiError } from '../api/client'
import { GOAL_LABEL, ATTR_COLOR, PERIOD_LABEL } from '../config/missionEnums'
import type { AdminMission, MissionRevisionBody } from '../api/types'

function RevisionHistoryModal({ mission, onClose }: { mission: AdminMission | null; onClose: () => void }) {
  const { data, isLoading } = useMissionRevisions(mission?.id ?? 0, { page: 0, size: 50 }, !!mission)
  return (
    <Modal title={`revision 이력 — 미션 #${mission?.id ?? ''}`} open={!!mission} onCancel={onClose} footer={null} width={620}>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.content}
        pagination={false}
        size="small"
        columns={[
          { title: 'rev', dataIndex: 'revision_number', width: 60, render: (v) => `v${v}` },
          { title: '문구', dataIndex: 'description' },
          {
            title: '생성',
            dataIndex: 'created_at',
            width: 150,
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
          },
        ]}
      />
    </Modal>
  )
}

function MissionsPanel() {
  const { message } = App.useApp()
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const { data, isLoading, isError } = useMissions({ page, size })

  const [editing, setEditing] = useState<AdminMission | null>(null) // publish 대상
  const [createOpen, setCreateOpen] = useState(false)
  const [historyMission, setHistoryMission] = useState<AdminMission | null>(null)

  const createMut = useCreateMission()
  const publishMut = usePublishRevision(editing?.id ?? 0)
  const statusMut = useChangeMissionStatus()

  const onCreate = async (body: MissionRevisionBody) => {
    try {
      await createMut.mutateAsync(body)
      message.success('미션을 생성했습니다.')
      setCreateOpen(false)
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '생성에 실패했습니다.')
      throw e
    }
  }
  const onPublish = async (body: MissionRevisionBody) => {
    try {
      await publishMut.mutateAsync(body)
      message.success('새 버전을 발행했습니다.')
      setEditing(null)
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '발행에 실패했습니다.')
      throw e
    }
  }
  const onToggleStatus = async (m: AdminMission, active: boolean) => {
    try {
      await statusMut.mutateAsync({ id: m.id, active })
      message.success(active ? '활성화했습니다.' : '비활성화했습니다.')
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '상태 변경에 실패했습니다.')
    }
  }

  const columns: ColumnsType<AdminMission> = [
    {
      title: '문구',
      key: 'description',
      render: (_, m) => (
        <Typography.Text ellipsis style={{ maxWidth: 260 }}>
          {m.active_revision.description}
        </Typography.Text>
      ),
    },
    {
      title: '목표',
      key: 'goal',
      width: 90,
      render: (_, m) => <Tag>{GOAL_LABEL[m.active_revision.mission_goal]}</Tag>,
    },
    {
      title: '깊이',
      key: 'depth',
      width: 90,
      render: (_, m) => (
        <Tag color={ATTR_COLOR[m.active_revision.disclosure_depth]}>{m.active_revision.disclosure_depth}</Tag>
      ),
    },
    {
      title: '채널',
      key: 'channel',
      width: 70,
      render: (_, m) =>
        m.active_revision.activation_channel === 'VIDEO' ? <VideoCameraOutlined /> : <MessageOutlined />,
    },
    {
      title: '사용 시점',
      key: 'eligibilities',
      render: (_, m) => (
        <Space size={[4, 4]} wrap>
          {m.active_revision.eligibilities.map((e) => (
            <Tag key={`${e.day_number}-${e.period}`} style={{ margin: 0 }}>
              Day{e.day_number} {PERIOD_LABEL[e.period]}
            </Tag>
          ))}
        </Space>
      ),
    },
    { title: '군집', key: 'cluster', width: 110, render: (_, m) => m.active_revision.semantic_cluster },
    {
      title: 'fallback',
      key: 'fallback',
      width: 80,
      render: (_, m) => (m.active_revision.is_fallback ? <Tag color="gold">fallback</Tag> : null),
    },
    { title: 'rev', key: 'rev', width: 60, render: (_, m) => `v${m.active_revision.revision_number}` },
    {
      title: '상태',
      key: 'status',
      width: 80,
      render: (_, m) => (
        <Switch checked={m.active} loading={statusMut.isPending} onChange={(v) => onToggleStatus(m, v)} />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 170,
      render: (_, m) => (
        <Space>
          <Button size="small" onClick={() => setEditing(m)}>
            새 버전 발행
          </Button>
          <Button size="small" type="text" onClick={() => setHistoryMission(m)}>
            이력
          </Button>
        </Space>
      ),
    },
  ]

  if (isError) return <Alert type="error" showIcon message="미션을 불러오지 못했습니다." />

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          미션 생성
        </Button>
      </div>
      <Table<AdminMission>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data?.content}
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

      {/* 생성 */}
      <MissionFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="미션 생성"
        submitText="생성"
        pending={createMut.isPending}
        onSubmit={onCreate}
      />
      {/* 새 버전 발행 (현재 revision 프리필) */}
      <MissionFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`새 버전 발행 — 미션 #${editing?.id ?? ''}`}
        submitText="새 버전 발행"
        initial={editing?.active_revision}
        pending={publishMut.isPending}
        onSubmit={onPublish}
      />
      <RevisionHistoryModal mission={historyMission} onClose={() => setHistoryMission(null)} />
    </>
  )
}

export default function MissionsPage() {
  const { me } = useAuth()
  const isSuper = me?.role === 'SUPER'

  return (
    <>
      <PageHeader title="미션 관리" subtitle="미션 문구 카탈로그 (활성 미션이 방 배정 후보) · 수정=새 버전 발행" />
      <Card>
        {isSuper ? (
          <MissionsPanel />
        ) : (
          <Alert
            type="warning"
            showIcon
            message="SUPER 권한 전용"
            description="미션 카탈로그 관리는 SUPER 역할만 접근할 수 있습니다."
          />
        )}
      </Card>
    </>
  )
}
