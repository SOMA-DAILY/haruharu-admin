import { Alert, Button, Card, Space, Table, Tag, Typography } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { roomsApi } from '../api/endpoints'

import type { RoomSelection } from '../api/types'

export default function RoomSelectionPanel({ roomId }: { roomId: number }) {
  const query = useQuery({ queryKey: ['room', roomId, 'selections'], queryFn: () => roomsApi.selections(roomId) })
  return <Card title={`방 ${roomId} 선택표`} extra={<Button onClick={() => void query.refetch()} loading={query.isFetching}>새로고침</Button>}>
    {query.isError ? <Alert type="error" showIcon title="선택 내역을 불러오지 못했습니다." action={<Button onClick={() => void query.refetch()}>다시 시도</Button>} /> : <Table<RoomSelection>
      rowKey={row => row.chooser.user_id} dataSource={query.data} loading={query.isLoading} pagination={false} size="small"
      onRow={row => ({ style: row.matched ? { background: 'var(--ant-color-primary-bg, #f0f5ff)' } : undefined })}
      columns={[
        { title: '선택한 사람', key: 'chooser', render: (_, row) => <Typography.Text strong>{row.chooser.name} (#{row.chooser.user_id})</Typography.Text> },
        { title: '선택한 상대', key: 'selected', render: (_, row) => <Space><ArrowRightOutlined /><Typography.Text type={row.selected ? undefined : 'secondary'}>{row.selected ? `${row.selected.name} (#${row.selected.user_id})` : '선택 없음'}</Typography.Text></Space> },
        { title: '결과', key: 'result', render: (_, row) => row.matched ? <Tag color="purple">매칭</Tag> : row.mutual ? <Tag color="blue">상호 선택</Tag> : row.selected ? <Tag>선택</Tag> : <Tag>없음</Tag> },
      ]} locale={{ emptyText: '참여자가 없습니다.' }}
    />}
  </Card>
}
