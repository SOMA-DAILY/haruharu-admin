import { useState } from 'react'
import { Modal, Form, DatePicker, InputNumber, Result, Typography, Button, App } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { Dayjs } from 'dayjs'
import { useCreateRoom } from '../api/queries'
import { ApiError } from '../api/client'

const fmt = (d: Dayjs) => d.format('YYYY-MM-DDTHH:mm:ss')

type FormValues = {
  starts_at: Dayjs
  final_selection_opens_at: Dayjs
  final_selection_closes_at: Dayjs
  result_at: Dayjs
  ends_at: Dayjs
  total_days: number
  max_uses?: number
  invite_expires_at?: Dayjs
}

export default function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()
  const createMut = useCreateRoom()
  const [created, setCreated] = useState<{ room_id: number; code: string } | null>(null)

  const close = () => {
    form.resetFields()
    setCreated(null)
    onClose()
  }

  const onFinish = async (v: FormValues) => {
    try {
      const res = await createMut.mutateAsync({
        starts_at: fmt(v.starts_at),
        final_selection_opens_at: fmt(v.final_selection_opens_at),
        final_selection_closes_at: fmt(v.final_selection_closes_at),
        result_at: fmt(v.result_at),
        ends_at: fmt(v.ends_at),
        total_days: v.total_days,
        max_uses: v.max_uses ?? null,
        invite_expires_at: v.invite_expires_at ? fmt(v.invite_expires_at) : null,
      })
      setCreated(res)
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '방 생성에 실패했습니다.')
    }
  }

  return (
    <Modal
      title="방 생성 + 초대코드 발급"
      open={open}
      onCancel={close}
      destroyOnClose
      footer={
        created
          ? [
              <Button key="go" type="primary" onClick={() => navigate(`/sessions/${created.room_id}`)}>
                방 상세로
              </Button>,
              <Button key="close" onClick={close}>
                닫기
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={close}>
                취소
              </Button>,
              <Button key="ok" type="primary" loading={createMut.isPending} onClick={() => form.submit()}>
                생성
              </Button>,
            ]
      }
    >
      {created ? (
        <Result
          status="success"
          title="방이 생성되었습니다"
          subTitle={
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#61656c', fontSize: 13 }}>초대코드 (신청자에게 전달)</div>
              <Typography.Title level={2} copyable style={{ margin: '6px 0', letterSpacing: 2 }}>
                {created.code}
              </Typography.Title>
              <div style={{ color: '#9aa0a8', fontSize: 12 }}>방 ID #{created.room_id}</div>
            </div>
          }
        />
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={{ total_days: 3, max_uses: 6 }}>
          {(
            [
              ['starts_at', '방 시작 (영상 슬롯 앵커)'],
              ['final_selection_opens_at', '최종선택 오픈'],
              ['final_selection_closes_at', '최종선택 마감'],
              ['result_at', '결과 공개'],
              ['ends_at', '방 종료'],
            ] as const
          ).map(([name, label]) => (
            <Form.Item key={name} name={name} label={label} rules={[{ required: true, message: '시각을 선택하세요.' }]}>
              <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
            </Form.Item>
          ))}
          <Form.Item name="total_days" label="총 일수" rules={[{ required: true, message: '총 일수를 입력하세요.' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="max_uses" label="초대코드 정원 (비우면 무제한)" tooltip="3:3이면 6">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="예: 6" />
          </Form.Item>
          <Form.Item name="invite_expires_at" label="초대코드 만료 (비우면 무기한)">
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  )
}
