import { useEffect } from 'react'
import { Alert, App, Button, Checkbox, DatePicker, Form, Input, Modal, Radio, Select, Space } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useCreateAnnouncement, useUpdateAnnouncement } from '../api/queries'
import { ApiError } from '../api/client'
import type { AnnouncementBody, AnnouncementType, MissionAnnouncement, RoomDetail, RoomMission } from '../api/types'
import {
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_TYPE_LABEL,
  DEFAULT_PUSH_BODY,
  DEFAULT_PUSH_TITLE,
  MESSAGE_MAX,
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
} from '../config/chatScheduleDefaults'
import ChatBubblePreview from './ChatBubblePreview'
import { useMissionActions } from './useMissionActions'

const fmt = (d: Dayjs) => d.format('YYYY-MM-DDTHH:mm:ss')
const FIELDS = ['announcement_type', 'run_at', 'content', 'push_title', 'push_body'] as const

type Mode = 'SCHEDULED' | 'NOW'
type Values = {
  announcement_type: AnnouncementType
  mode: Mode
  run_at?: Dayjs
  content?: string
  push: boolean
  push_title?: string
  push_body?: string
}

// 미션에 붙는 채팅 안내(글 + 푸시) 추가·수정
export default function AnnouncementModal({
  open,
  roomId,
  room,
  mission,
  announcement,
  canWrite,
  onClose,
}: {
  open: boolean
  roomId: number
  room: RoomDetail
  mission: RoomMission | null
  announcement: MissionAnnouncement | null // null = 안내 추가
  canWrite: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<Values>()
  const createMut = useCreateAnnouncement(roomId)
  const updateMut = useUpdateAnnouncement(roomId)
  const actions = useMissionActions(roomId, room)

  const roomClosed = room.status === 'ENDED' || room.status === 'CANCELLED'
  const usable = !!mission && mission.status !== 'CANCELED' && !roomClosed
  const readOnly = !canWrite || !usable || (!!announcement && announcement.status !== 'SCHEDULED')
  const canDeleteSent =
    canWrite &&
    !!announcement &&
    announcement.status === 'SENT' &&
    announcement.sent_message_id != null &&
    !announcement.message_deleted_at
  const opensAt = mission ? dayjs(mission.opens_at) : null
  // 시작 전 미션은 지금 보낼 수 없다 (공개 시각을 앞당기는 우회 경로 없음)
  const canSendNow = !!opensAt && !dayjs().isBefore(opensAt)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue(
      announcement
        ? {
            announcement_type: announcement.announcement_type,
            mode: 'SCHEDULED',
            run_at: dayjs(announcement.run_at),
            content: announcement.content ?? '',
            push: announcement.push,
            push_title: announcement.push_title ?? (announcement.push ? DEFAULT_PUSH_TITLE : undefined),
            push_body: announcement.push_body ?? (announcement.push ? DEFAULT_PUSH_BODY : undefined),
          }
        : { announcement_type: 'REMINDER', mode: 'SCHEDULED', run_at: undefined, content: '', push: false },
    )
  }, [open, announcement, form])

  const type = Form.useWatch('announcement_type', form) ?? 'REMINDER'
  const mode = Form.useWatch('mode', form) ?? 'SCHEDULED'
  const runAt = Form.useWatch('run_at', form)
  const content = Form.useWatch('content', form) ?? ''
  const push = Form.useWatch('push', form) ?? false
  // 본문 없는 안내는 공개 미션의 START 만 (채팅 글 없이 공개 푸시만)
  const contentOptional = mission?.type === 'PROFILE_REVEAL' && type === 'START'

  const at: Dayjs | undefined = mode === 'NOW' ? dayjs() : runAt
  const startsAt = room.starts_at ? dayjs(room.starts_at) : null
  const warnings: string[] = []
  if (at) {
    if (push && at.hour() < 8) warnings.push('00~08시엔 푸시가 가지 않아요')
    if (startsAt && at.isBefore(startsAt)) warnings.push('방이 열릴 때 나가요')
  }

  const onPushChange = (checked: boolean) => {
    if (!checked) return
    if (!form.getFieldValue('push_title')) form.setFieldValue('push_title', DEFAULT_PUSH_TITLE)
    if (!form.getFieldValue('push_body')) form.setFieldValue('push_body', DEFAULT_PUSH_BODY)
  }

  // PUT 은 전체 교체라 모든 칸을 그대로 보낸다
  const toBody = (v: Values, runAtValue: string): AnnouncementBody => ({
    announcement_type: v.announcement_type,
    run_at: runAtValue,
    content: v.content?.trim() ? v.content : null,
    push: !!v.push,
    push_title: v.push && v.push_title?.trim() ? v.push_title : null,
    push_body: v.push && v.push_body?.trim() ? v.push_body : null,
  })

  const applyServerError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 400 && e.fieldErrors) {
      const entries = Object.entries(e.fieldErrors)
      const known = entries.filter(([name]) => (FIELDS as readonly string[]).includes(name))
      form.setFields(known.map(([name, msg]) => ({ name: name as keyof Values, errors: [msg] })))
      if (known.length < entries.length) message.error(entries.find(([name]) => !known.some(([k]) => k === name))![1])
      return
    }
    if (actions.handleError(e, '저장에 실패했습니다.')) onClose()
  }

  const save = async (v: Values, runAtValue: string) => {
    if (!mission) return
    try {
      if (!announcement) {
        await createMut.mutateAsync({ missionId: mission.mission_id, body: toBody(v, runAtValue) })
      } else {
        await updateMut.mutateAsync({
          missionId: mission.mission_id,
          id: announcement.announcement_id,
          body: toBody(v, runAtValue),
        })
      }
      onClose()
    } catch (e) {
      applyServerError(e)
    }
  }

  const onFinish = (v: Values) => {
    if (v.mode !== 'NOW') return save(v, fmt(v.run_at!))
    // 지금 보내기: 추가면 현재 시각으로 POST, 수정이면 PUT 후 send-now
    actions.confirmSendNow(async () => {
      if (!mission) return
      if (!announcement) return save(v, fmt(dayjs()))
      try {
        await updateMut.mutateAsync({
          missionId: mission.mission_id,
          id: announcement.announcement_id,
          body: toBody(v, announcement.run_at),
        })
      } catch (e) {
        applyServerError(e)
        return
      }
      try {
        await actions.sendNowRaw(announcement)
        onClose()
      } catch (e) {
        if (actions.handleError(e, '지금 보내기에 실패했습니다.')) onClose()
      }
    })
  }

  const title = announcement ? `안내 수정 ${dayjs(announcement.run_at).format('MM/DD HH:mm')}` : '안내 추가'
  const saving = createMut.isPending || updateMut.isPending

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={660}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {canDeleteSent && (
              <Button danger onClick={() => actions.deleteMessage(announcement!, onClose)}>
                보낸 글 삭제
              </Button>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>취소</Button>
            {!readOnly && (
              <Button type="primary" loading={saving} onClick={() => form.submit()}>
                저장
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={readOnly}
        onFinish={onFinish}
        // '지금'으로 바꾸면 시각 칸 오류를 지운다
        onValuesChange={(changed) => 'mode' in changed && form.setFields([{ name: 'run_at', errors: [] }])}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16 }}>
          <Form.Item label="보낼 시각" required style={{ marginBottom: 16 }}>
            <Space align="start">
              <Form.Item name="mode" noStyle>
                <Radio.Group>
                  <Radio value="SCHEDULED">예약</Radio>
                  <Radio value="NOW" disabled={!canSendNow}>
                    지금 보내기
                  </Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="run_at"
                style={{ margin: 0 }}
                rules={[
                  { required: mode !== 'NOW', message: '시각을 선택하세요.' },
                  {
                    validator: (_, value?: Dayjs) =>
                      mode === 'NOW' || !value || !opensAt || !value.isBefore(opensAt)
                        ? Promise.resolve()
                        : Promise.reject(new Error('안내는 미션 시작 이후로 지정해 주세요')),
                  },
                ]}
              >
                <DatePicker
                  showTime={{ minuteStep: 5, format: 'HH:mm' }}
                  format="YYYY-MM-DD HH:mm"
                  disabled={readOnly || mode === 'NOW'}
                  style={{ width: 180 }}
                />
              </Form.Item>
            </Space>
          </Form.Item>
          {/* 용도는 만든 뒤 바꿀 수 없다 */}
          <Form.Item name="announcement_type" label="용도" style={{ marginBottom: 16 }}>
            <Select
              disabled={readOnly || !!announcement}
              options={ANNOUNCEMENT_TYPES.map((t) => ({ value: t, label: ANNOUNCEMENT_TYPE_LABEL[t] }))}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="content"
          label="채팅 글"
          dependencies={['announcement_type']}
          rules={[
            {
              validator: (_, value?: string) =>
                value?.trim() || contentOptional
                  ? Promise.resolve()
                  : Promise.reject(new Error('안내 내용을 입력해 주세요')),
            },
          ]}
          extra={contentOptional ? '비우면 채팅 글 없이 공개 푸시만 나가요' : undefined}
        >
          <Input.TextArea rows={3} maxLength={MESSAGE_MAX} showCount />
        </Form.Item>

        <Form.Item name="push" valuePropName="checked" style={{ marginBottom: push ? 8 : 16 }}>
          <Checkbox onChange={(e) => onPushChange(e.target.checked)}>푸시 알림도 보내기</Checkbox>
        </Form.Item>
        {push && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              name="push_title"
              label="알림 제목"
              rules={[{ max: PUSH_TITLE_MAX, message: `${PUSH_TITLE_MAX}자까지 쓸 수 있어요` }]}
            >
              <Input maxLength={PUSH_TITLE_MAX} showCount />
            </Form.Item>
            <Form.Item
              name="push_body"
              label="알림 본문"
              rules={[{ max: PUSH_BODY_MAX, message: `${PUSH_BODY_MAX}자까지 쓸 수 있어요` }]}
            >
              <Input maxLength={PUSH_BODY_MAX} showCount />
            </Form.Item>
          </div>
        )}

        {warnings.length > 0 && (
          <Space orientation="vertical" size={6} style={{ width: '100%', marginBottom: 16 }}>
            {warnings.map((w) => (
              <Alert key={w} type="warning" showIcon title={w} />
            ))}
          </Space>
        )}
      </Form>
      {content.trim() && <ChatBubblePreview content={content} at={at ?? dayjs()} imageUrl={mission?.image?.url} />}
    </Modal>
  )
}
