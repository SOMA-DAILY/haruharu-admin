import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Switch, Tag, Alert, App } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { PageHeader } from '../layout/AdminLayout'
import { useAuth } from '../auth/AuthContext'
import { useMissions, useCreateMission, useUpdateMission } from '../api/queries'
import { ApiError } from '../api/client'
import type { AdminMission } from '../api/types'

function MissionsPanel() {
  const { message } = App.useApp()
  const { data, isLoading, isError } = useMissions()
  const createMut = useCreateMission()
  const updateMut = useUpdateMission()

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<AdminMission | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const onCreate = async (v: { description: string; points: number }) => {
    try {
      await createMut.mutateAsync(v)
      message.success('미션을 생성했습니다.')
      setCreateOpen(false)
      createForm.resetFields()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '생성에 실패했습니다.')
    }
  }

  const onEdit = async (v: { description: string; points: number; active: boolean }) => {
    if (!editing) return
    try {
      await updateMut.mutateAsync({ id: editing.id, body: v })
      message.success('수정했습니다.')
      setEditing(null)
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '수정에 실패했습니다.')
    }
  }

  const columns: ColumnsType<AdminMission> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '미션 문구', dataIndex: 'description' },
    { title: '포인트', dataIndex: 'points', width: 90 },
    {
      title: '활성',
      dataIndex: 'active',
      width: 100,
      render: (a: boolean) => (a ? <Tag color="green">활성</Tag> : <Tag color="default">비활성</Tag>),
    },
    {
      title: '',
      key: 'action',
      width: 90,
      render: (_, r) => (
        <Button
          size="small"
          onClick={() => {
            setEditing(r)
            editForm.setFieldsValue({ description: r.description, points: r.points, active: r.active })
          }}
        >
          수정
        </Button>
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
      <Table<AdminMission> rowKey="id" loading={isLoading} columns={columns} dataSource={data} pagination={false} />

      <Modal
        title="미션 생성"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="생성"
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={onCreate} requiredMark={false} initialValues={{ points: 0 }}>
          <Form.Item
            name="description"
            label="미션 문구"
            rules={[{ required: true, max: 500, message: '문구를 입력하세요(최대 500자).' }]}
          >
            <Input.TextArea rows={3} placeholder="오늘 먹은 가장 맛있는 음식을 보여주세요" showCount maxLength={500} />
          </Form.Item>
          <Form.Item name="points" label="완주 포인트(열쇠, 현재 미사용)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`미션 수정 #${editing?.id ?? ''}`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => editForm.submit()}
        okText="저장"
        confirmLoading={updateMut.isPending}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={onEdit} requiredMark={false}>
          <Form.Item name="description" label="미션 문구" rules={[{ min: 1, max: 500 }]}>
            <Input.TextArea rows={3} showCount maxLength={500} />
          </Form.Item>
          <Form.Item name="points" label="완주 포인트">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="active" label="활성 (끄면 소프트 삭제 = 배정 후보 제외)" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default function MissionsPage() {
  const { me } = useAuth()
  const isSuper = me?.role === 'SUPER'

  return (
    <>
      <PageHeader title="미션 관리" subtitle="미션 문구 카탈로그 (활성 미션이 방 배정 후보)" />
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
