import { Avatar, Space, Tag, Typography, theme } from 'antd'
import { CloudFilled } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'

// 앱 운영 말풍선 미리보기 (B1: 구름 아바타, 하루, 운영 칩, 연파랑 말풍선)
export default function ChatBubblePreview({
  content,
  at,
  imageUrl,
}: {
  content: string
  at: Dayjs
  imageUrl?: string | null
}) {
  const { token } = theme.useToken()
  return (
    <div style={{ background: token.colorFillQuaternary, borderRadius: token.borderRadius, padding: 12 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        앱에서 이렇게 보여요
      </Typography.Text>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Avatar size={34} icon={<CloudFilled />} style={{ background: token.colorPrimary, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <Space size={6} style={{ marginBottom: 4 }}>
            <Typography.Text style={{ fontSize: 12 }}>하루</Typography.Text>
            <Tag color="blue" bordered={false} style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px' }}>
              운영
            </Tag>
          </Space>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <div
              style={{
                background: token.colorPrimaryBg,
                border: `1px solid ${token.colorPrimaryBorder}`,
                borderRadius: 14,
                padding: '8px 12px',
                maxWidth: 260,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 13,
              }}
            >
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="미션 사진"
                  style={{ display: 'block', width: '100%', borderRadius: 8, marginBottom: content ? 6 : 0 }}
                />
              )}
              {content}
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              {at.locale('ko').format('A h:mm')}
            </Typography.Text>
          </div>
        </div>
      </div>
    </div>
  )
}
