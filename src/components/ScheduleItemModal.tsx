import { useEffect } from 'react'
import {
  Alert,
  App,
  Avatar,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd'
import { CloudFilled } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import {
  useCancelScheduleItem,
  useCreateScheduleItem,
  useDeleteScheduleMessage,
  useSendScheduleNow,
  useUpdateScheduleItem,
} from '../api/queries'
import { ApiError } from '../api/client'
import type { RevealField, RoomDetail, RoomScheduleItem, ScheduleItemBody } from '../api/types'
import {
  DEFAULT_PUSH_BODY,
  DEFAULT_PUSH_TITLE,
  MESSAGE_MAX,
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
  REVEAL_FIELDS,
  REVEAL_LABEL,
} from '../config/chatScheduleDefaults'

const fmt = (d: Dayjs) => d.format('YYYY-MM-DDTHH:mm:ss')
const EMPTY_MESSAGE = '운영 글이나 공개 항목 중 하나는 있어야 해요'

type Mode = 'SCHEDULED' | 'NOW'
type Values = {
  mode: Mode
  run_at?: Dayjs
  reveal_fields: RevealField[]
  message_content?: string
  push: boolean
  push_title?: string
  push_body?: string
}

// 서버 field 이름(snake/camel) → 폼 칸
const FIELD_MAP: Record<string, keyof Values> = {
  run_at: 'run_at',
  runAt: 'run_at',
  reveal_fields: 'reveal_fields',
  revealFields: 'reveal_fields',
  message_content: 'message_content',
  messageContent: 'message_content',
  push_title: 'push_title',
  pushTitle: 'push_title',
  push_body: 'push_body',
  pushBody: 'push_body',
}

const isPending = (room: RoomDetail) => room.status === 'PENDING'

// 표(E1)와 모달(E2)이 같이 쓰는 확인창 3종 + 409 처리
// eslint-disable-next-line react-refresh/only-export-components
export function useScheduleActions(roomId: number, room: RoomDetail) {
  const { message, modal } = App.useApp()
  const qc = useQueryClient()
  const sendNowMut = useSendScheduleNow(roomId)
  const cancelMut = useCancelScheduleItem(roomId)
  const deleteMut = useDeleteScheduleMessage(roomId)

  // 409 면 토스트 + 재조회 후 true 반환 (호출부가 모달을 닫음)
  const handleError = (e: unknown, fallback: string) => {
    if (e instanceof ApiError && e.status === 409) {
      message.error(e.message)
      qc.invalidateQueries({ queryKey: ['room-schedule', roomId] })
      return true
    }
    message.error(e instanceof ApiError ? e.message : fallback)
    return false
  }

  const confirmSendNow = (onOk: () => Promise<void>) =>
    modal.confirm({
      title: '지금 보낼까요?',
      content: isPending(room) ? '방이 열릴 때 나가요' : undefined,
      okText: '보내기',
      cancelText: '닫기',
      onOk,
    })

  const sendNow = (item: RoomScheduleItem, after?: () => void) =>
    confirmSendNow(async () => {
      try {
        await sendNowMut.mutateAsync(item.id)
        after?.()
      } catch (e) {
        handleError(e, '지금 보내기에 실패했습니다.')
      }
    })

  const cancel = (item: RoomScheduleItem, after?: () => void) =>
    modal.confirm({
      title: '예약을 취소할까요?',
      okType: 'danger',
      okText: '예약 취소',
      cancelText: '닫기',
      onOk: async () => {
        try {
          await cancelMut.mutateAsync(item.id)
          after?.()
        } catch (e) {
          handleError(e, '예약 취소에 실패했습니다.')
        }
      },
    })

  const deleteMessage = (item: RoomScheduleItem, after?: () => void) =>
    modal.confirm({
      title: '보낸 글을 지울까요?',
      okType: 'danger',
      okText: '삭제',
      cancelText: '닫기',
      onOk: async () => {
        try {
          await deleteMut.mutateAsync(item.id)
          after?.()
        } catch (e) {
          handleError(e, '삭제에 실패했습니다.')
        }
      },
    })

  const sendNowRaw = (itemId: number) => sendNowMut.mutateAsync(itemId)

  return { sendNow, sendNowRaw, cancel, deleteMessage, confirmSendNow, handleError }
}

// 앱 운영 말풍선 미리보기 (B1: 구름 아바타, 하루, 운영 칩, 연파랑 말풍선)
function BubblePreview({ content, at }: { content: string; at: Dayjs }) {
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

export default function ScheduleItemModal({
  open,
  roomId,
  room,
  item,
  canWrite,
  onClose,
}: {
  open: boolean
  roomId: number
  room: RoomDetail
  item: RoomScheduleItem | null // null = 글 추가
  canWrite: boolean
  onClose: () => void
}) {
  const [form] = Form.useForm<Values>()
  const createMut = useCreateScheduleItem(roomId)
  const updateMut = useUpdateScheduleItem(roomId)
  const actions = useScheduleActions(roomId, room)

  const readOnly = !canWrite || (!!item && item.status !== 'SCHEDULED')
  const canDeleteSent = canWrite && !!item && item.status === 'SENT' && item.sent_message_id != null && !item.message_deleted_at

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue(
      item
        ? {
            mode: 'SCHEDULED',
            run_at: dayjs(item.run_at),
            reveal_fields: item.reveal_fields ?? [],
            message_content: item.message_content ?? '',
            push: item.push,
            push_title: item.push_title ?? (item.push ? DEFAULT_PUSH_TITLE : undefined),
            push_body: item.push_body ?? (item.push ? DEFAULT_PUSH_BODY : undefined),
          }
        : { mode: 'SCHEDULED', run_at: undefined, reveal_fields: [], message_content: '', push: false },
    )
  }, [open, item, form])

  const mode = Form.useWatch('mode', form) ?? 'SCHEDULED'
  const runAt = Form.useWatch('run_at', form)
  const revealFields = Form.useWatch('reveal_fields', form) ?? []
  const content = Form.useWatch('message_content', form) ?? ''
  const push = Form.useWatch('push', form) ?? false

  // 경고 (저장은 막지 않음). 기준 시각이 없으면 해당 경고 생략
  const at: Dayjs | undefined = mode === 'NOW' ? dayjs() : runAt
  const startsAt = room.starts_at ? dayjs(room.starts_at) : null
  const finalOpensAt = room.final_selection_opens_at ? dayjs(room.final_selection_opens_at) : null
  const warnings: string[] = []
  if (at) {
    if (push && at.hour() < 8) warnings.push('00~08시엔 푸시가 가지 않아요')
    if (revealFields.length > 0 && finalOpensAt && at.isAfter(finalOpensAt)) warnings.push('최종 선택 이후 공개예요')
    if (startsAt && at.isBefore(startsAt)) warnings.push('방이 열릴 때 나가요')
  }

  const onPushChange = (checked: boolean) => {
    if (!checked) return
    if (!form.getFieldValue('push_title')) form.setFieldValue('push_title', DEFAULT_PUSH_TITLE)
    if (!form.getFieldValue('push_body')) form.setFieldValue('push_body', DEFAULT_PUSH_BODY)
  }

  // PATCH 는 null = 기존 값 유지라서, 운영 글을 비우면 빈 문자열로 보냄 (POST 는 null)
  const toBody = (v: Values, runAtValue: string | null, isPatch = false): ScheduleItemBody => ({
    run_at: runAtValue,
    reveal_fields: v.reveal_fields ?? [],
    message_content: v.message_content?.trim() ? v.message_content : isPatch ? '' : null,
    push: !!v.push,
    push_title: v.push && v.push_title?.trim() ? v.push_title : null,
    push_body: v.push && v.push_body?.trim() ? v.push_body : null,
  })

  const applyServerError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 400) {
      const fields = e.fieldErrors
      if (fields) {
        const mapped = Object.entries(fields)
          .filter(([k]) => FIELD_MAP[k])
          .map(([k, msg]) => ({ name: FIELD_MAP[k], errors: [msg] }))
        if (mapped.length) {
          form.setFields(mapped)
          return
        }
      }
      if (e.message === EMPTY_MESSAGE) {
        form.setFields([{ name: 'message_content', errors: [e.message] }])
        return
      }
    }
    if (actions.handleError(e, '저장에 실패했습니다.')) onClose()
  }

  const save = async (v: Values) => {
    try {
      if (!item) {
        await createMut.mutateAsync(toBody(v, v.mode === 'NOW' ? null : fmt(v.run_at!)))
      } else {
        await updateMut.mutateAsync({ itemId: item.id, body: toBody(v, fmt(v.run_at!), true) })
      }
      onClose()
    } catch (e) {
      applyServerError(e)
    }
  }

  const onFinish = (v: Values) => {
    if (v.mode !== 'NOW') return save(v)
    // 지금 보내기: 확인창 → 추가면 run_at null 로 POST, 수정이면 PATCH 후 send-now
    actions.confirmSendNow(async () => {
      if (!item) return save(v)
      try {
        await updateMut.mutateAsync({ itemId: item.id, body: toBody(v, item.run_at, true) })
      } catch (e) {
        applyServerError(e)
        return
      }
      try {
        await actions.sendNowRaw(item.id)
        onClose()
      } catch (e) {
        if (actions.handleError(e, '지금 보내기에 실패했습니다.')) onClose()
      }
    })
  }

  const title = item ? `방 편성 수정 ${dayjs(item.run_at).format('MM/DD HH:mm')}` : '방 편성 글 추가'
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
              <Button danger onClick={() => actions.deleteMessage(item!, onClose)}>
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
      <Form form={form} layout="vertical" requiredMark={false} disabled={readOnly} onFinish={onFinish}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16 }}>
          <Form.Item label="보낼 시각" required style={{ marginBottom: 16 }}>
            <Space align="start">
              <Form.Item name="mode" noStyle>
                <Radio.Group>
                  <Radio value="SCHEDULED">예약</Radio>
                  <Radio value="NOW">지금 보내기</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="run_at"
                noStyle={false}
                style={{ margin: 0 }}
                rules={[{ required: mode !== 'NOW', message: '시각을 선택하세요.' }]}
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
          <Form.Item name="reveal_fields" label="공개 항목" style={{ marginBottom: 16 }}>
            <Select
              mode="multiple"
              allowClear
              placeholder="없음"
              options={REVEAL_FIELDS.map((f) => ({ value: f, label: REVEAL_LABEL[f] }))}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="message_content"
          label="운영 글"
          dependencies={['reveal_fields']}
          rules={[
            {
              validator: (_, value?: string) =>
                value?.trim() || (form.getFieldValue('reveal_fields') ?? []).length > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error(EMPTY_MESSAGE)),
            },
          ]}
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
      {content.trim() && <BubblePreview content={content} at={at ?? dayjs()} />}
    </Modal>
  )
}
