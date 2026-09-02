import { useState } from 'react'
import {
  Modal,
  Form,
  DatePicker,
  InputNumber,
  Result,
  Typography,
  Button,
  Divider,
  Space,
  App,
} from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import { Form as AntForm } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { Dayjs } from 'dayjs'
import { useCreateRoom } from '../api/queries'
import { ApiError } from '../api/client'
import { PERIODS, PERIOD_LABEL } from '../config/missionEnums'
import type { MissionPeriod, RoomMissionSlot } from '../api/types'

const fmt = (d: Dayjs) => d.format('YYYY-MM-DDTHH:mm:ss')
const slotKey = (day: number, period: MissionPeriod) => `${day}-${period}`

type SlotVal = { opens?: Dayjs; closes?: Dayjs }
type FormValues = {
  starts_at: Dayjs
  final_selection_opens_at: Dayjs
  final_selection_closes_at: Dayjs
  result_at: Dayjs
  ends_at: Dayjs
  total_days: number
  max_uses?: number
  invite_expires_at?: Dayjs
  slots?: Record<string, SlotVal>
}

export default function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()
  const createMut = useCreateRoom()
  const [created, setCreated] = useState<{ room_id: number; code: string } | null>(null)

  const totalDays: number = AntForm.useWatch('total_days', form) ?? 3
  const days = Array.from({ length: Math.max(1, totalDays) }, (_, i) => i + 1)

  const close = () => {
    form.resetFields()
    setCreated(null)
    onClose()
  }

  // 시작시각 기준으로 슬롯 노출 시각 자동 채우기 (오전 09~12, 오후 18~21)
  const autofill = () => {
    const start = form.getFieldValue('starts_at') as Dayjs | undefined
    if (!start) {
      message.warning('먼저 "방 시작" 시각을 선택하세요.')
      return
    }
    const slots: Record<string, SlotVal> = {}
    days.forEach((d) => {
      const base = start.add(d - 1, 'day')
      slots[slotKey(d, 'MORNING')] = {
        opens: base.hour(9).minute(0).second(0),
        closes: base.hour(12).minute(0).second(0),
      }
      slots[slotKey(d, 'AFTERNOON')] = {
        opens: base.hour(18).minute(0).second(0),
        closes: base.hour(21).minute(0).second(0),
      }
    })
    form.setFieldValue('slots', slots)
  }

  const onFinish = async (v: FormValues) => {
    const mission_slots: RoomMissionSlot[] = []
    for (const d of days) {
      for (const p of PERIODS) {
        const s = v.slots?.[slotKey(d, p)]
        if (s?.opens && s?.closes) {
          mission_slots.push({ day_number: d, period: p, opens_at: fmt(s.opens), closes_at: fmt(s.closes) })
        }
      }
    }
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
        mission_slots,
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
      width={620}
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
          <Divider titlePlacement="start" plain>
            일정
          </Divider>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="total_days" label="총 일수" rules={[{ required: true, message: '입력' }]}>
              <InputNumber min={1} max={7} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="max_uses" label="코드 정원(비우면 무제한)" tooltip="3:3이면 6">
              <InputNumber min={1} style={{ width: '100%' }} placeholder="6" />
            </Form.Item>
            <Form.Item name="invite_expires_at" label="코드 만료(비우면 무기한)">
              <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
            </Form.Item>
          </div>

          <Divider titlePlacement="start" plain>
            미션 슬롯 (Day별 오전·오후 카드 노출 시각)
          </Divider>
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={autofill}
            style={{ marginBottom: 12 }}
          >
            시작시각 기준 자동 채우기
          </Button>
          {days.map((d) => (
            <div key={d} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Day{d}</div>
              {PERIODS.map((p) => (
                <Space key={p} align="baseline" style={{ display: 'flex', marginBottom: 4 }}>
                  <span style={{ width: 40, fontSize: 12, color: '#61656c' }}>{PERIOD_LABEL[p]}</span>
                  <Form.Item
                    name={['slots', slotKey(d, p), 'opens']}
                    rules={[{ required: true, message: '노출 시작' }]}
                    style={{ margin: 0 }}
                  >
                    <DatePicker showTime placeholder="노출 시작" format="MM-DD HH:mm" />
                  </Form.Item>
                  <span style={{ color: '#9aa0a8' }}>~</span>
                  <Form.Item
                    name={['slots', slotKey(d, p), 'closes']}
                    rules={[{ required: true, message: '노출 종료' }]}
                    style={{ margin: 0 }}
                  >
                    <DatePicker showTime placeholder="노출 종료" format="MM-DD HH:mm" />
                  </Form.Item>
                </Space>
              ))}
            </div>
          ))}
        </Form>
      )}
    </Modal>
  )
}
