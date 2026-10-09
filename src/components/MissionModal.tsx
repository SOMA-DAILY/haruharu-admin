import { useEffect } from 'react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useCreateMission, useUpdateMission } from '../api/queries'
import { ApiError } from '../api/client'
import type { MissionImage, MissionType, RevealField, RoomDetail, RoomMission, RoomMissionBody } from '../api/types'
import {
  DEFAULT_PUSH_BODY,
  DEFAULT_PUSH_TITLE,
  MESSAGE_MAX,
  MISSION_TYPES,
  MISSION_TYPE_LABEL,
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
  REVEAL_FIELDS,
  REVEAL_LABEL,
} from '../config/chatScheduleDefaults'
import ChatBubblePreview from './ChatBubblePreview'
import MissionImagePicker from './MissionImagePicker'
import { useMissionActions } from './useMissionActions'

const fmt = (d: Dayjs) => d.format('YYYY-MM-DDTHH:mm:ss')

type Mode = 'SCHEDULED' | 'NOW'
type Values = {
  type: MissionType
  mode: Mode
  opens_at?: Dayjs
  closes_at?: Dayjs | null
  reveal_fields: RevealField[]
  content?: string // ANNOUNCEMENT 본문 (details.content)
  image: MissionImage | null
  // 아래는 생성 때 함께 만드는 START 안내
  announcement_content?: string // PROFILE_REVEAL 의 채팅 글 (선택)
  push: boolean
  push_title?: string
  push_body?: string
}

// 서버 검증 경로 → 폼 칸. ANNOUNCEMENT 는 본문과 안내 글이 같은 칸
const fieldOf = (path: string, type: MissionType): keyof Values | undefined => {
  switch (path) {
    case 'type':
    case 'details':
      return 'type'
    case 'opens_at':
    case 'announcement.run_at':
      return 'opens_at'
    case 'closes_at':
      return 'closes_at'
    case 'details.content':
      return 'content'
    case 'details.reveal_fields':
      return 'reveal_fields'
    case 'image_key':
      return 'image'
    case 'announcement.content':
      return type === 'ANNOUNCEMENT' ? 'content' : 'announcement_content'
    case 'announcement.push_title':
      return 'push_title'
    case 'announcement.push_body':
      return 'push_body'
    default:
      return undefined
  }
}

export default function MissionModal({
  open,
  roomId,
  room,
  mission,
  canWrite,
  onClose,
}: {
  open: boolean
  roomId: number
  room: RoomDetail
  mission: RoomMission | null // null = 미션 추가
  canWrite: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<Values>()
  const createMut = useCreateMission(roomId)
  const updateMut = useUpdateMission(roomId)
  const actions = useMissionActions(roomId, room)

  const roomClosed = room.status === 'ENDED' || room.status === 'CANCELLED'
  // 시작했거나 취소된 미션은 수정할 수 없다 (409 MISSION_NOT_EDITABLE)
  const editable = !mission || (mission.status === 'SCHEDULED' && dayjs().isBefore(dayjs(mission.opens_at)))
  const readOnly = !canWrite || roomClosed || !editable

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue(
      mission
        ? {
            type: mission.type,
            mode: 'SCHEDULED',
            opens_at: dayjs(mission.opens_at),
            closes_at: mission.closes_at ? dayjs(mission.closes_at) : null,
            reveal_fields: mission.details.reveal_fields ?? [],
            content: mission.details.content ?? '',
            image: mission.image,
            push: false,
          }
        : {
            type: 'ANNOUNCEMENT',
            mode: 'SCHEDULED',
            opens_at: undefined,
            closes_at: null,
            reveal_fields: [],
            content: '',
            image: null,
            announcement_content: '',
            push: false,
          },
    )
  }, [open, mission, form])

  const type = Form.useWatch('type', form) ?? 'ANNOUNCEMENT'
  const mode = Form.useWatch('mode', form) ?? 'SCHEDULED'
  const opensAt = Form.useWatch('opens_at', form)
  const revealFields = Form.useWatch('reveal_fields', form) ?? []
  const content = Form.useWatch('content', form) ?? ''
  const announcementContent = Form.useWatch('announcement_content', form) ?? ''
  const image = Form.useWatch('image', form)
  const push = Form.useWatch('push', form) ?? false
  const isReveal = type === 'PROFILE_REVEAL'

  // 경고 (저장은 막지 않음). 기준 시각이 없으면 해당 경고 생략
  const at: Dayjs | undefined = mode === 'NOW' ? dayjs() : opensAt
  const startsAt = room.starts_at ? dayjs(room.starts_at) : null
  const finalOpensAt = room.final_selection_opens_at ? dayjs(room.final_selection_opens_at) : null
  const warnings: string[] = []
  if (at) {
    if (!mission && push && at.hour() < 8) warnings.push('00~08시엔 푸시가 가지 않아요')
    if (isReveal && revealFields.length > 0 && finalOpensAt && at.isAfter(finalOpensAt)) warnings.push('최종 선택 이후 공개예요')
    if (startsAt && at.isBefore(startsAt)) warnings.push('방이 열릴 때 나가요')
  }

  const onPushChange = (checked: boolean) => {
    if (!checked) return
    if (!form.getFieldValue('push_title')) form.setFieldValue('push_title', DEFAULT_PUSH_TITLE)
    if (!form.getFieldValue('push_body')) form.setFieldValue('push_body', DEFAULT_PUSH_BODY)
  }

  // PUT 은 전체 교체: closes_at·image_key 를 빼면 지워지므로 항상 지금 값을 보낸다
  const toBody = (v: Values, opensAtValue: string): RoomMissionBody => {
    const reveal = v.type === 'PROFILE_REVEAL'
    const text = v.content?.trim() ? v.content : null
    const body: RoomMissionBody = {
      type: v.type,
      details: reveal ? { reveal_fields: v.reveal_fields ?? [] } : { content: text },
      image_key: v.image?.key ?? null,
      opens_at: opensAtValue,
      closes_at: v.closes_at ? fmt(v.closes_at) : null,
    }
    // 안내는 생성 때만 함께 보낸다. 이후엔 안내 API 로 고친다
    if (!mission) {
      body.announcement = {
        announcement_type: 'START',
        run_at: opensAtValue,
        content: reveal ? (v.announcement_content?.trim() ? v.announcement_content : null) : text,
        push: !!v.push,
        push_title: v.push && v.push_title?.trim() ? v.push_title : null,
        push_body: v.push && v.push_body?.trim() ? v.push_body : null,
      }
    }
    return body
  }

  const applyServerError = (e: unknown, v: Values) => {
    if (e instanceof ApiError && e.status === 400 && e.fieldErrors) {
      const errors = new Map<keyof Values, string>()
      let unknown: string | undefined
      for (const [path, msg] of Object.entries(e.fieldErrors)) {
        const name = fieldOf(path, v.type)
        if (!name) unknown ??= msg
        else if (!errors.has(name)) errors.set(name, msg)
      }
      form.setFields([...errors].map(([name, msg]) => ({ name, errors: [msg] })))
      if (unknown) message.error(unknown)
      return
    }
    if (actions.handleError(e, '저장에 실패했습니다.')) onClose()
  }

  const save = async (v: Values) => {
    try {
      if (!mission) {
        await createMut.mutateAsync(toBody(v, v.mode === 'NOW' ? fmt(dayjs()) : fmt(v.opens_at!)))
      } else {
        await updateMut.mutateAsync({ missionId: mission.mission_id, body: toBody(v, fmt(v.opens_at!)) })
      }
      onClose()
    } catch (e) {
      applyServerError(e, v)
    }
  }

  const onFinish = (v: Values) => {
    if (v.mode !== 'NOW') return save(v)
    actions.confirmSendNow(() => save(v))
  }

  const title = mission ? `미션 수정 ${dayjs(mission.opens_at).format('MM/DD HH:mm')}` : '미션 추가'
  const saving = createMut.isPending || updateMut.isPending
  const previewText = isReveal ? announcementContent : content

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={660}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>취소</Button>
          {!readOnly && (
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              저장
            </Button>
          )}
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={readOnly}
        onFinish={onFinish}
        // '지금'으로 바꾸면 시각 칸 오류를 지운다
        onValuesChange={(changed) => 'mode' in changed && form.setFields([{ name: 'opens_at', errors: [] }])}
      >
        {/* 유형은 만든 뒤 바꿀 수 없다 */}
        <Form.Item name="type" label="유형" style={{ marginBottom: 16 }}>
          <Radio.Group disabled={readOnly || !!mission}>
            {MISSION_TYPES.map((t) => (
              <Radio key={t} value={t}>
                {MISSION_TYPE_LABEL[t]}
              </Radio>
            ))}
          </Radio.Group>
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
          <Form.Item label="시작 시각" required style={{ marginBottom: 16 }}>
            <Space align="start">
              {!mission && (
                <Form.Item name="mode" noStyle>
                  <Radio.Group>
                    <Radio value="SCHEDULED">예약</Radio>
                    <Radio value="NOW">지금</Radio>
                  </Radio.Group>
                </Form.Item>
              )}
              <Form.Item
                name="opens_at"
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
          <Form.Item name="closes_at" label="마감 시각" style={{ marginBottom: 16 }}>
            <DatePicker
              showTime={{ minuteStep: 5, format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              placeholder="방 종료까지"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </div>

        {isReveal ? (
          <Form.Item
            name="reveal_fields"
            label="공개 항목"
            rules={[{ required: true, type: 'array', min: 1, message: '공개할 항목을 하나 이상 골라주세요' }]}
          >
            <Select
              mode="multiple"
              allowClear
              options={REVEAL_FIELDS.map((f) => ({ value: f, label: REVEAL_LABEL[f] }))}
            />
          </Form.Item>
        ) : (
          <Form.Item
            name="content"
            label="안내 문구"
            rules={[{ required: true, whitespace: true, message: '안내 문구를 입력해 주세요' }]}
            extra={mission ? '보낼 채팅 글은 방 편성 카드의 안내에서 따로 고쳐요' : '채팅방에 올라갈 글이에요'}
          >
            <Input.TextArea rows={3} maxLength={MESSAGE_MAX} showCount />
          </Form.Item>
        )}

        <Form.Item name="image" label="사진">
          <MissionImagePicker disabled={readOnly} />
        </Form.Item>

        {!mission && (
          <>
            <Divider titlePlacement="start" plain>
              시작 안내
            </Divider>
            {isReveal && (
              <Form.Item name="announcement_content" label="채팅 글" extra="비우면 채팅 글 없이 공개 푸시만 나가요">
                <Input.TextArea rows={3} maxLength={MESSAGE_MAX} showCount />
              </Form.Item>
            )}
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
          </>
        )}

        {warnings.length > 0 && (
          <Space orientation="vertical" size={6} style={{ width: '100%', marginBottom: 16 }}>
            {warnings.map((w) => (
              <Alert key={w} type="warning" showIcon title={w} />
            ))}
          </Space>
        )}
      </Form>
      {!mission && previewText.trim() && (
        <ChatBubblePreview content={previewText} at={at ?? dayjs()} imageUrl={image?.url} />
      )}
    </Modal>
  )
}
