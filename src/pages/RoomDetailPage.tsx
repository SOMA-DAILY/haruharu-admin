import { Card, Descriptions, Table, Button, Alert, Skeleton, Space, Tag } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useRoom } from '../api/queries'
import { RoomStatusTag } from '../components/StatusTag'
import type { RoomMember } from '../api/types'
import { OperatorMissionPanel } from '../components/OperatorMissionPanel'

const memberColumns = (nav: (uid: number) => void): ColumnsType<RoomMember> => [
  { title: '유저 ID', dataIndex: 'user_id', width: 90, render: (v: number) => <a onClick={() => nav(v)}>{v}</a> },
  { title: '닉네임', dataIndex: 'nickname', render: (v: string | null) => v ?? <Tag>미설정</Tag> },
  {
    title: '성별',
    dataIndex: 'gender',
    width: 80,
    render: (g: string) => <Tag color={g === 'FEMALE' ? 'magenta' : 'blue'}>{g === 'FEMALE' ? '여성' : '남성'}</Tag>,
  },
  { title: '나이', dataIndex: 'age', width: 70, render: (v: number | null) => v ?? '-' },
  { title: '지역', dataIndex: 'region', width: 100, render: (v: string | null) => v ?? '-' },
  { title: '참여시각', dataIndex: 'joined_at', render: (v: string) => dayjs(v).format('MM/DD HH:mm') },
]

export default function RoomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useRoom(Number(id))

  if (isError) return <Alert type="error" message="방 정보를 찾을 수 없습니다." showIcon />

  return (
    <>
      <PageHeader
        title={`방 상세 #${id}`}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sessions')}>
            목록
          </Button>
        }
      />
      <Skeleton loading={isLoading} active>
        {data && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card>
              <Descriptions column={3} bordered size="small">
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
            <OperatorMissionPanel room={data} />
            <Card title={`참여자 (${data.members.length})`}>
              <Table<RoomMember>
                rowKey="member_id"
                columns={memberColumns((uid) => navigate(`/users/${uid}`))}
                dataSource={data.members}
                pagination={false}
                size="small"
              />
            </Card>
          </Space>
        )}
      </Skeleton>
    </>
  )
}
