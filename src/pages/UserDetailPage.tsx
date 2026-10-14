import { Card, Descriptions, Table, Button, Alert, Skeleton, Space, Statistic, Tag, Empty, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useUser, useUserRooms } from '../api/queries'
import { useAuth } from '../auth/AuthContext'
import { UserStatusTag, RoomStatusTag, IapStatusTag } from '../components/StatusTag'
import type { UserPayment, UserDetail, UserRoomHistory, UserRoomOutcome } from '../api/types'

const paymentColumns: ColumnsType<UserPayment> = [
  { title: '구매 ID', dataIndex: 'purchase_id', width: 90 },
  { title: '상품', dataIndex: 'store_product_id' },
  { title: '티켓', dataIndex: 'ticket_amount', width: 80 },
  {
    title: '스토어',
    dataIndex: 'store',
    width: 110,
    render: (s: string) => <Tag>{s === 'APP_STORE' ? 'App Store' : 'Play Store'}</Tag>,
  },
  { title: '상태', dataIndex: 'status', width: 90, render: (s: UserPayment['status']) => <IapStatusTag status={s} /> },
  {
    title: '구매시각',
    dataIndex: 'purchased_at',
    render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
  },
]

const participationColumns: (nav: (id: number) => void) => ColumnsType<UserDetail['participations'][number]> = (
  nav,
) => [
  { title: '방 ID', dataIndex: 'room_id', width: 90, render: (v: number) => <a onClick={() => nav(v)}>{v}</a> },
  {
    title: '상태',
    dataIndex: 'room_status',
    width: 100,
    render: (s: UserDetail['participations'][number]['room_status']) => <RoomStatusTag status={s} />,
  },
  { title: '예정일', dataIndex: 'scheduled_date', width: 120 },
  { title: '참여시각', dataIndex: 'joined_at', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
]

const OUTCOME_MAP: Record<UserRoomOutcome, { color: string; label: string }> = {
  MATCHED: { color: 'green', label: '매칭 성사' },
  MUTUAL: { color: 'blue', label: '서로 선택(미성사)' },
  ONE_WAY: { color: 'orange', label: '한쪽만 선택' },
  PASSED: { color: 'default', label: '선택 안 함' },
  NOT_SUBMITTED: { color: 'default', label: '미제출' },
}

const GENDER_LABEL: Record<string, string> = { FEMALE: '여', MALE: '남' }

const fmtTime = (v: string) => dayjs(v).format('MM-DD HH:mm')

// 새 모델 방은 시작~종료 시각, 시각이 없는 옛 방은 예정일 + 일수
const periodOf = (r: UserRoomHistory) =>
  r.starts_at
    ? `${fmtTime(r.starts_at)} ~ ${r.ends_at ? fmtTime(r.ends_at) : ''}`
    : `${r.scheduled_date} · ${r.total_days}일`

const roomHistoryColumns = (
  toRoom: (id: number) => void,
  toUser: (id: number) => void,
): ColumnsType<UserRoomHistory> => [
  { title: '방', dataIndex: 'room_id', width: 70, render: (v: number) => <a onClick={() => toRoom(v)}>#{v}</a> },
  {
    title: '상태',
    dataIndex: 'room_status',
    width: 80,
    render: (s: UserRoomHistory['room_status']) => <RoomStatusTag status={s} />,
  },
  {
    title: '기간',
    key: 'period',
    width: 220,
    render: (_, r) => <span style={{ whiteSpace: 'nowrap' }}>{periodOf(r)}</span>,
  },
  { title: '입장', dataIndex: 'joined_at', width: 110, render: fmtTime },
  {
    title: '방 안의 이름',
    key: 'pseudonym',
    width: 130,
    render: (_, r) => (
      <Space size={4}>
        {r.pseudonym ?? <Typography.Text type="secondary">가명 없음</Typography.Text>}
        {r.gender && <Tag>{GENDER_LABEL[r.gender] ?? r.gender}</Tag>}
      </Space>
    ),
  },
  {
    title: '최종 선택',
    key: 'selected',
    width: 130,
    render: (_, r) => {
      if (r.selected) return <a onClick={() => toUser(r.selected!.user_id)}>{r.selected.name}</a>
      if (r.outcome === 'PASSED') return '선택 안 함'
      if (r.outcome === 'NOT_SUBMITTED') return '미제출'
      return '-'
    },
  },
  { title: '받은 선택', dataIndex: 'received_count', width: 90, render: (v: number) => `${v}명` },
  {
    title: '결과',
    dataIndex: 'outcome',
    width: 140,
    render: (o: UserRoomOutcome | null) => (o ? <Tag color={OUTCOME_MAP[o].color}>{OUTCOME_MAP[o].label}</Tag> : '-'),
  },
  {
    title: '활동',
    key: 'activity',
    width: 140,
    render: (_, r) => `영상 ${r.video_count} · 채팅 ${r.chat_count}`,
  },
]

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { me } = useAuth()
  // 최종 선택·활동은 방 선택 패널과 같은 권한(SUPER·OPERATOR). CS는 기본 참여 이력만 본다.
  const canSeeRoomDetail = me?.role === 'SUPER' || me?.role === 'OPERATOR'
  const { data, isLoading, isError } = useUser(Number(id))
  const rooms = useUserRooms(Number(id), canSeeRoomDetail)
  const matchedCount = rooms.data?.filter((r) => r.outcome === 'MATCHED').length ?? 0

  if (isError) return <Alert type="error" message="유저 정보를 찾을 수 없습니다." showIcon />

  return (
    <>
      <PageHeader
        title={`유저 상세 #${id}`}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>
            목록
          </Button>
        }
      />
      <Skeleton loading={isLoading} active>
        {data && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="프로필">
              <Descriptions column={3} bordered size="small">
                <Descriptions.Item label="상태">
                  <UserStatusTag status={data.status} />
                </Descriptions.Item>
                <Descriptions.Item label="닉네임">{data.profile?.nickname ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="지역">{data.profile?.region ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="MBTI">{data.profile?.mbti ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="소속">{data.profile?.affiliation ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="키">{data.profile?.height ? `${data.profile.height}cm` : '-'}</Descriptions.Item>
                <Descriptions.Item label="가입일" span={3}>
                  {dayjs(data.created_at).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              </Descriptions>
              {/* 명세: 성별·나이·본인인증은 identity 도메인 별도 이슈 → placeholder */}
              <Alert
                style={{ marginTop: 12 }}
                type="info"
                showIcon
                message="성별·나이·본인인증(실명/CI·DI)은 백엔드 identity 도메인 후속 연동 예정"
              />
            </Card>

            <Card title="티켓">
              <Statistic title="잔액" value={data.ticket.balance} suffix="장" />
            </Card>

            <Card title={`결제 내역 (${data.payments.length})`}>
              {data.payments.length ? (
                <Table rowKey="purchase_id" columns={paymentColumns} dataSource={data.payments} pagination={false} size="small" />
              ) : (
                <Empty description="결제 내역 없음" />
              )}
            </Card>

            {canSeeRoomDetail ? (
              <Card
                title={`참여 방 이력 (${rooms.data?.length ?? data.participations.length})`}
                extra={rooms.data?.length ? <Typography.Text type="secondary">매칭 성사 {matchedCount}회</Typography.Text> : null}
              >
                {rooms.isError ? (
                  <Alert type="error" showIcon message="방 참여 이력을 불러오지 못했습니다." />
                ) : (
                  <Table<UserRoomHistory>
                    rowKey="room_id"
                    loading={rooms.isLoading}
                    columns={roomHistoryColumns(
                      (rid) => navigate(`/sessions/${rid}`),
                      (uid) => navigate(`/users/${uid}`),
                    )}
                    dataSource={rooms.data}
                    locale={{ emptyText: <Empty description="참여 이력 없음" /> }}
                    pagination={false}
                    size="small"
                    scroll={{ x: 1110 }}
                  />
                )}
              </Card>
            ) : (
              <Card title={`참여 방 이력 (${data.participations.length})`}>
                {data.participations.length ? (
                  <Table
                    rowKey="room_id"
                    columns={participationColumns((rid) => navigate(`/sessions/${rid}`))}
                    dataSource={data.participations}
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Empty description="참여 이력 없음" />
                )}
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  최종 선택·매칭 결과·활동은 운영자(SUPER·OPERATOR) 권한에서 보입니다.
                </Typography.Text>
              </Card>
            )}
          </Space>
        )}
      </Skeleton>
    </>
  )
}
