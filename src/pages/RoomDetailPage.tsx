import { useState } from 'react'
import {
  Card,
  Descriptions,
  Table,
  Button,
  Alert,
  Skeleton,
  Space,
  Tag,
  Select,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Typography,
  App,
} from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useRoom, useRoomInvites, useCancelRoom, useReissueInvite, useAssignGender, useUpdateRoomType, useRoomGroups, useAssignRoomOrganization } from '../api/queries'
import { useAuth } from '../auth/AuthContext'
import { RoomStatusTag, RoomInviteStatusTag, RoomTypeTag } from '../components/StatusTag'
import { ApiError } from '../api/client'
import type { RoomMember, RoomInvite, Gender } from '../api/types'
import RoomActivityPanel from '../components/RoomActivityPanel'
import RoomSelectionPanel from '../components/RoomSelectionPanel'
import RoomScheduleCard from '../components/RoomScheduleCard'

const fmt = (d: Dayjs) => d.format('YYYY-MM-DDTHH:mm:ss')

function InvitesCard({ roomId, canWrite }: { roomId: number; canWrite: boolean }) {
  const { message } = App.useApp()
  const { data, isLoading } = useRoomInvites(roomId, canWrite)
  const reissueMut = useReissueInvite(roomId)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<{ max_uses?: number; expires_at?: Dayjs }>()

  const onReissue = async (v: { max_uses?: number; expires_at?: Dayjs }) => {
    try {
      await reissueMut.mutateAsync({
        max_uses: v.max_uses ?? null,
        expires_at: v.expires_at ? fmt(v.expires_at) : null,
      })
      message.success('새 초대코드를 발급했습니다.')
      setOpen(false)
      form.resetFields()
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '재발급에 실패했습니다.')
    }
  }

  const columns: ColumnsType<RoomInvite> = [
    {
      title: '코드',
      dataIndex: 'code',
      render: (c: string) => (
        <Typography.Text copyable strong style={{ letterSpacing: 1 }}>
          {c}
        </Typography.Text>
      ),
    },
    { title: '상태', dataIndex: 'status', width: 90, render: (s) => <RoomInviteStatusTag status={s} /> },
    {
      title: '사용/정원',
      key: 'uses',
      width: 100,
      render: (_, r) => `${r.used_count} / ${r.max_uses ?? '∞'}`,
    },
    {
      title: '만료',
      dataIndex: 'expires_at',
      render: (v: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '무기한'),
    },
    { title: '발급', dataIndex: 'created_by', width: 100 },
  ]

  return (
    <Card
      title="초대코드"
      extra={
        canWrite && (
          <Button icon={<ReloadOutlined />} onClick={() => setOpen(true)}>
            재발급
          </Button>
        )
      }
    >
      <Table<RoomInvite>
        rowKey="invite_id"
        loading={isLoading}
        columns={columns}
        dataSource={data}
        pagination={false}
        size="small"
        locale={{ emptyText: '초대코드 없음' }}
      />
      <Modal
        title="초대코드 재발급"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="재발급"
        confirmLoading={reissueMut.isPending}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="기존 유효 코드는 만료되고 새 코드가 발급됩니다."
        />
        <Form form={form} layout="vertical" onFinish={onReissue} requiredMark={false} initialValues={{ max_uses: 6 }}>
          <Form.Item name="max_uses" label="정원 (비우면 무제한)">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="예: 6" />
          </Form.Item>
          <Form.Item name="expires_at" label="만료 (비우면 무기한)">
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default function RoomDetailPage() {
  const { id } = useParams()
  const roomId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = location.state?.roomListReturnTo
  const roomListPath = typeof returnTo === 'string' && (returnTo === '/sessions' || returnTo.startsWith('/sessions?')) ? returnTo : '/sessions'
  const { me } = useAuth()
  const canWrite = me?.role === 'SUPER' || me?.role === 'OPERATOR'
  const { message, modal } = App.useApp()
  const { data, isLoading, isError } = useRoom(roomId)
  const cancelMut = useCancelRoom(roomId)
  const assignMut = useAssignGender(roomId)
  const groupQuery = useRoomGroups()
  const organizationMut = useAssignRoomOrganization()
  const typeMut = useUpdateRoomType(roomId)

  if (isError) return <Alert type="error" message="방 정보를 찾을 수 없습니다." showIcon />

  const cancellable = canWrite && data && data.status !== 'ENDED' && data.status !== 'CANCELLED'

  const onCancel = () =>
    modal.confirm({
      title: '방 취소',
      content: '이 방을 취소(CANCELLED)합니다. 되돌릴 수 없습니다.',
      okType: 'danger',
      okText: '취소 처리',
      cancelText: '닫기',
      onOk: async () => {
        try {
          await cancelMut.mutateAsync()
          message.success('방을 취소했습니다.')
        } catch (e) {
          message.error(e instanceof ApiError ? e.message : '취소에 실패했습니다.')
        }
      },
    })

  const assign = async (memberId: number, gender: Gender) => {
    try {
      await assignMut.mutateAsync({ memberId, body: { gender } })
      message.success('성별을 부여했습니다.')
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '성별 부여에 실패했습니다.')
    }
  }

  const changeType = async (value: string) => {
    try {
      await typeMut.mutateAsync(value === 'TEST')
      message.success('방 구분을 변경했습니다.')
    } catch (e) {
      message.error(e instanceof ApiError && e.code !== 'NETWORK' ? e.message : '방 구분 변경에 실패했습니다.')
    }
  }

  const memberColumns: ColumnsType<RoomMember> = [
    { title: '유저 ID', dataIndex: 'user_id', width: 90, render: (v: number) => <a onClick={() => navigate(`/users/${v}`)}>{v}</a> },
    { title: '닉네임(실명)', dataIndex: 'nickname', render: (v: string | null) => v ?? <Tag>미설정</Tag> },
    {
      title: '가명',
      dataIndex: 'pseudonym',
      width: 100,
      render: (v: string | null) => (v ? <Tag color="purple">{v}</Tag> : <Tag>미배정</Tag>),
    },
    {
      title: '성별',
      dataIndex: 'gender',
      width: 120,
      render: (g: Gender | null, r) => {
        if (g) return <Tag color={g === 'FEMALE' ? 'magenta' : 'blue'}>{g === 'FEMALE' ? '여성' : '남성'}</Tag>
        if (!canWrite) return <Tag>미지정</Tag>
        return (
          <Select
            size="small"
            placeholder="부여"
            style={{ width: 90 }}
            onChange={(val: Gender) => assign(r.member_id, val)}
            options={[
              { value: 'FEMALE', label: '여성' },
              { value: 'MALE', label: '남성' },
            ]}
          />
        )
      },
    },
    { title: '나이', dataIndex: 'age', width: 70, render: (v: number | null) => v ?? '-' },
    { title: '지역', dataIndex: 'region', width: 100, render: (v: string | null) => v ?? '-' },
    { title: '참여시각', dataIndex: 'joined_at', render: (v: string) => dayjs(v).format('MM/DD HH:mm') },
  ]

  return (
    <>
      <PageHeader
        title={`방 상세 #${id}`}
        extra={
          <Space>
            {cancellable && (
              <Button danger loading={cancelMut.isPending} onClick={onCancel}>
                방 취소
              </Button>
            )}
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(roomListPath)}>
              목록
            </Button>
          </Space>
        }
      />
      <Skeleton loading={isLoading} active>
        {data && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card>
              <Descriptions column={3} bordered size="small">
                <Descriptions.Item label="기수" span={3}>
                  {canWrite ? <Select aria-label="방 기수 변경" size="small" style={{ minWidth: 160 }} allowClear
                    loading={groupQuery.isPending || organizationMut.isPending} disabled={groupQuery.isError || organizationMut.isPending}
                    placeholder="기수 미지정" value={data.group_id ?? undefined} options={(groupQuery.data ?? []).map(g => ({ value: g.id, label: g.name }))}
                    onChange={async value => { try { await organizationMut.mutateAsync({ room_ids: [roomId], group_id: value, clear_group: value == null }); message.success('기수를 변경했습니다.') } catch (error) { message.error(error instanceof ApiError ? error.message : '기수를 변경하지 못했습니다.') } }} /> : data.group_name ?? '기수 미지정'}
                </Descriptions.Item>
                <Descriptions.Item label="방 구분" span={3}>
                  {canWrite ? (
                    <Select
                      aria-label="방 구분 변경"
                      size="small"
                      style={{ width: 120 }}
                      placeholder="미설정" value={data.is_test == null ? undefined : data.is_test ? 'TEST' : 'OPERATIONAL'}
                      disabled={typeMut.isPending}
                      loading={typeMut.isPending}
                      onChange={changeType}
                      options={[{ value: 'OPERATIONAL', label: '운영방' }, { value: 'TEST', label: '테스트방' }]}
                    />
                  ) : <RoomTypeTag isTest={data.is_test} />}
                </Descriptions.Item>
                <Descriptions.Item label="상태">
                  <RoomStatusTag status={data.status} />
                </Descriptions.Item>
                <Descriptions.Item label="예정일">{data.scheduled_date}</Descriptions.Item>
                <Descriptions.Item label="진행">
                  {data.current_day > 0 ? `${data.current_day} / ${data.total_days}일차` : `- / ${data.total_days}일차`}
                </Descriptions.Item>
                <Descriptions.Item label="인원">
                  {data.member_count}명 (여 {data.female_count} / 남 {data.male_count})
                </Descriptions.Item>
                <Descriptions.Item label="시작">
                  {data.started_at ? dayjs(data.started_at).format('YYYY-MM-DD HH:mm') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="종료">
                  {data.ended_at ? dayjs(data.ended_at).format('YYYY-MM-DD HH:mm') : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
            <Card title={`참여자 (${data.members.length})`}>
              <Table<RoomMember>
                rowKey="member_id"
                columns={memberColumns}
                dataSource={data.members}
                pagination={false}
                size="small"
              />
            </Card>

            <RoomScheduleCard roomId={roomId} room={data} canWrite={canWrite} />
            <RoomActivityPanel key={roomId} room={data} />
            <RoomSelectionPanel roomId={roomId} />

            {canWrite && <InvitesCard roomId={roomId} canWrite={canWrite} />}
          </Space>
        )}
      </Skeleton>
    </>
  )
}
