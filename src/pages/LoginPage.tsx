import { useState } from 'react'
import { Button, Card, Form, Input, Typography, App } from 'antd'
import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { colors } from '../theme'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string })?.from ?? '/'

  const onFinish = async (v: { email: string; password: string }) => {
    setLoading(true)
    try {
      await login(v.email, v.password)
      navigate(from, { replace: true })
    } catch (e) {
      // 명세: 계정 존재 여부 비노출 → 단일 메시지
      const msg = e instanceof ApiError ? e.message : '로그인에 실패했습니다.'
      message.error(msg || '이메일 또는 비밀번호를 확인해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.sidebarBg,
      }}
    >
      <Card style={{ width: 380 }} styles={{ body: { padding: 32 } }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: colors.brandGradient,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#fff',
              fontSize: 20,
            }}
          >
            하
          </div>
          <Typography.Title level={4} style={{ marginTop: 12, marginBottom: 0 }}>
            하루하루 운영 어드민
          </Typography.Title>
          <Typography.Text type="secondary">관리자 계정으로 로그인</Typography.Text>
        </div>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="email"
            label="이메일"
            rules={[{ required: true, type: 'email', message: '이메일을 입력해 주세요.' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="admin@haruharu.app" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            label="비밀번호"
            rules={[{ required: true, message: '비밀번호를 입력해 주세요.' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="비밀번호" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            로그인
          </Button>
        </Form>
      </Card>
    </div>
  )
}
