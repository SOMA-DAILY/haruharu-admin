import { useEffect } from 'react'
import { Card, Form, Input, Button, Alert, Typography, Skeleton, Tag, App } from 'antd'
import { PageHeader } from '../layout/AdminLayout'
import { useAuth } from '../auth/AuthContext'
import { useDemoCode, useSetDemoCode } from '../api/queries'
import { ApiError } from '../api/client'

function DemoCodePanel() {
  const { message } = App.useApp()
  const { data, isLoading, isError } = useDemoCode()
  const setMut = useSetDemoCode()
  const [form] = Form.useForm<{ code: string }>()

  useEffect(() => {
    if (data?.code) form.setFieldsValue({ code: data.code })
  }, [data?.code, form])

  const onSubmit = async (v: { code: string }) => {
    try {
      await setMut.mutateAsync({ code: v.code })
      message.success('데모 접근 코드를 설정했습니다. 옛 코드는 즉시 무효화됩니다.')
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '설정에 실패했습니다.')
    }
  }

  if (isError) return <Alert type="error" showIcon message="데모 코드를 불러오지 못했습니다." />

  return (
    <Skeleton loading={isLoading} active>
      <div style={{ marginBottom: 20 }}>
        <Typography.Text type="secondary">현재 상태</Typography.Text>
        <div style={{ marginTop: 6 }}>
          {data?.configured ? (
            <>
              <Tag color="green">설정됨 · 데모 로그인 열림</Tag>
              <Typography.Text copyable strong style={{ marginLeft: 8, fontSize: 15, letterSpacing: 1 }}>
                {data.code}
              </Typography.Text>
            </>
          ) : (
            <Tag color="default">미설정 · 데모 로그인 닫힘</Tag>
          )}
        </div>
      </div>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="코드는 자격증명 성격입니다. 교체하면 기존 코드는 즉시 무효화됩니다. (최소 12자)"
      />

      <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false} style={{ maxWidth: 420 }}>
        <Form.Item
          name="code"
          label="데모 접근 코드"
          rules={[{ required: true, min: 12, max: 100, message: '12~100자로 입력하세요.' }]}
        >
          <Input placeholder="HARU-DEMO-2026" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={setMut.isPending}>
          {data?.configured ? '코드 교체' : '코드 설정'}
        </Button>
      </Form>
    </Skeleton>
  )
}

export default function DemoPage() {
  const { me } = useAuth()
  const isSuper = me?.role === 'SUPER'

  return (
    <>
      <PageHeader title="데모 코드" subtitle="심사용 데모 로그인 게이트 코드" />
      <Card>
        {isSuper ? (
          <DemoCodePanel />
        ) : (
          <Alert
            type="warning"
            showIcon
            message="SUPER 권한 전용"
            description="데모 접근 코드 관리는 SUPER 역할만 접근할 수 있습니다."
          />
        )}
      </Card>
    </>
  )
}
