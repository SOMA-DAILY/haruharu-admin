import { useState } from 'react'
import {
  Card,
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Alert,
  Result,
  App,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useAuth } from '../auth/AuthContext'
import { useAdminAccounts, useCreateAdminAccount, useUpdateAdminAccount } from '../api/queries'
import { RoleTag, AdminStatusTag } from '../components/StatusTag'
import { ApiError } from '../api/client'
import type { AdminAccount, Role, AdminAccountStatus } from '../api/types'

const ROLE_OPTIONS = [
  { value: 'SUPER', label: 'SUPER' },
  { value: 'OPERATOR', label: 'OPERATOR' },
  { value: 'CS', label: 'CS' },
]

function AdminAccountsPanel() {
  const { message } = App.useApp()
  const { data, isLoading, isError } = useAdminAccounts()
  const createMut = useCreateAdminAccount()
  const updateMut = useUpdateAdminAccount()

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<AdminAccount | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const onCreate = async (v: { email: string; password: string; name: string; role: Role }) => {
    try {
      await createMut.mutateAsync(v)
      message.success('계정을 생성했습니다.')
      setCreateOpen(false)
      createForm.resetFields()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '생성에 실패했습니다.')
    }
  }

  const onEdit = async (v: { role: Role; status: AdminAccountStatus }) => {
    if (!editing) return
    try {
      await updateMut.mutateAsync({ id: editing.id, body: v })
      message.success('변경했습니다.')
      setEditing(null)
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '변경에 실패했습니다.')
    }
  }

  const columns: ColumnsType<AdminAccount> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '이메일', dataIndex: 'email' },
    { title: '이름', dataIndex: 'name', width: 140 },
    { title: '역할', dataIndex: 'role', width: 110, render: (r: Role) => <RoleTag role={r} /> },
    {
      title: '상태',
      dataIndex: 'status',
      width: 100,
      render: (s: AdminAccountStatus) => <AdminStatusTag status={s} />,
    },
    {
      title: '마지막 로그인',
      dataIndex: 'last_login_at',
      width: 170,
      render: (v: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
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
            editForm.setFieldsValue({ role: r.role, status: r.status })
          }}
        >
          수정
        </Button>
      ),
    },
  ]

  if (isError) return <Alert type="error" showIcon message="관리자 계정을 불러오지 못했습니다." />

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          계정 생성
        </Button>
      </div>
      <Table<AdminAccount> rowKey="id" loading={isLoading} columns={columns} dataSource={data} pagination={false} />

      {/* 생성 */}
      <Modal
        title="관리자 계정 생성"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="생성"
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={onCreate} requiredMark={false}>
          <Form.Item name="email" label="이메일" rules={[{ required: true, type: 'email', message: '이메일을 입력하세요.' }]}>
            <Input placeholder="ops@haruharu.co.kr" />
          </Form.Item>
          <Form.Item
            name="password"
            label="초기 비밀번호"
            rules={[{ required: true, min: 8, message: '8자 이상 입력하세요.' }]}
          >
            <Input.Password placeholder="8자 이상" />
          </Form.Item>
          <Form.Item name="name" label="이름" rules={[{ required: true, message: '이름을 입력하세요.' }]}>
            <Input placeholder="운영자" />
          </Form.Item>
          <Form.Item name="role" label="역할" rules={[{ required: true, message: '역할을 선택하세요.' }]}>
            <Select options={ROLE_OPTIONS} placeholder="역할 선택" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 역할·상태 변경 */}
      <Modal
        title={`계정 수정 — ${editing?.email ?? ''}`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => editForm.submit()}
        okText="저장"
        confirmLoading={updateMut.isPending}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={onEdit} requiredMark={false}>
          <Form.Item name="role" label="역할">
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="status" label="상태">
            <Select
              options={[
                { value: 'ACTIVE', label: '활성' },
                { value: 'INACTIVE', label: '비활성' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default function AuditPage() {
  const { me } = useAuth()
  const isSuper = me?.role === 'SUPER'

  return (
    <>
      <PageHeader title="관리자·감사로그" subtitle="관리자 계정 및 활동 로그" />
      <Card>
        <Tabs
          items={[
            {
              key: 'accounts',
              label: '관리자 계정',
              children: isSuper ? (
                <AdminAccountsPanel />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="SUPER 권한 전용"
                  description="관리자 계정 관리는 SUPER 역할만 접근할 수 있습니다."
                />
              ),
            },
            {
              key: 'audit',
              label: '감사로그',
              children: (
                <Result
                  status="info"
                  title="백엔드 API 연동 대기"
                  subTitle="감사로그(admin_audit_logs) 조회 API는 백엔드 후속입니다."
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  )
}
