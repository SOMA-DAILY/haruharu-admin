import { useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Collapse,
  DatePicker,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Tag,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateMission, useUpdateAnnouncement, useUpdateMission } from '../api/queries'
import { ApiError } from '../api/client'
import type {
  AnnouncementBody,
  MissionAnnouncement,
  MissionImage,
  MissionType,
  RevealField,
  RoomDetail,
  RoomMission,
  RoomMissionBody,
} from '../api/types'
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
  dayOf,
  pushDefaultsFor,
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
  content?: string // ANNOUNCEMENT 본문 · RECORDING 촬영 주제 (details.content). 시작 글로도 함께 보낸다
  image: MissionImage | null
  // 아래는 미션과 함께 다루는 시작 글 (START 안내)
  announcement_content?: string // PROFILE_REVEAL 의 채팅 글 (선택)
  push: boolean
  push_title?: string
  push_body?: string
}

// 서버 검증 경로 → 폼 칸. ANNOUNCEMENT·RECORDING 은 본문과 안내 글이 같은 칸
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
    // 아래 셋은 시작 글을 따로 고칠 때(PUT 안내) 오는 경로
    case 'run_at':
      return 'opens_at'
    case 'content':
      return type === 'PROFILE_REVEAL' ? 'announcement_content' : 'content'
    case 'push_title':
    case 'push_body':
      return path
    case 'details.reveal_fields':
      // 공개 항목 칸은 프로필 공개에만 있다. 다른 종류에서 오면 종류 칸에 보인다
      return type === 'PROFILE_REVEAL' ? 'reveal_fields' : 'type'
    case 'image_key':
      return 'image'
    case 'announcement.content':
      return type === 'PROFILE_REVEAL' ? 'announcement_content' : 'content'
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
  start,
  scheduledExtras,
  canWrite,
  onClose,
}: {
  open: boolean
  roomId: number
  room: RoomDetail
  mission: RoomMission | null // null = 미션 추가
  start: MissionAnnouncement | null // 미션의 시작 글. 예약 상태면 미션과 함께 고친다
  scheduledExtras: MissionAnnouncement[] // 시작 글 말고 예약된 글 (시각을 늦출 때 걸리는지 확인)
  canWrite: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<Values>()
  const createMut = useCreateMission(roomId)
  const updateMut = useUpdateMission(roomId)
  const updateStartMut = useUpdateAnnouncement(roomId)
  const actions = useMissionActions(roomId, room)

  const roomClosed = room.status === 'ENDED' || room.status === 'CANCELLED'
  // 시작했거나 취소된 미션은 수정할 수 없다 (409 MISSION_NOT_EDITABLE)
  const editable = !mission || (mission.status === 'SCHEDULED' && dayjs().isBefore(dayjs(mission.opens_at)))
  const readOnly = !canWrite || roomClosed || !editable
  // 시작 글이 예약 상태일 때만 미션과 함께 고친다 (없거나 취소·발송된 글은 그대로 둔다)
  const withStart = !mission || start?.status === 'SCHEDULED'
  const [moreOpen, setMoreOpen] = useState(false)
  // 보기 전용일 땐 이미 나간 글의 내용·푸시도 보여준다
  const showStart = withStart || (readOnly && !!start)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    setMoreOpen(!!mission?.closes_at)
    form.setFieldsValue(
      mission
        ? {
            type: mission.type,
            mode: 'SCHEDULED',
            opens_at: dayjs(mission.opens_at),
            closes_at: mission.closes_at ? dayjs(mission.closes_at) : null,
            reveal_fields: mission.details.reveal_fields ?? [],
            // 채팅에 실제로 나가는 건 시작 글이라 그 글을 먼저 보여준다
            content: (mission.type === 'PROFILE_REVEAL' ? null : start?.content) ?? mission.details.content ?? '',
            image: mission.image,
            announcement_content: start?.content ?? '',
            push: start?.push ?? false,
            push_title: start?.push_title ?? (start?.push ? DEFAULT_PUSH_TITLE : undefined),
            push_body: start?.push_body ?? (start?.push ? DEFAULT_PUSH_BODY : undefined),
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
  }, [open, mission, start, form])

  const type = Form.useWatch('type', form) ?? 'ANNOUNCEMENT'
  const mode = Form.useWatch('mode', form) ?? 'SCHEDULED'
  const opensAt = Form.useWatch('opens_at', form)
  const revealFields = Form.useWatch('reveal_fields', form) ?? []
  const content = Form.useWatch('content', form) ?? ''
  const announcementContent = Form.useWatch('announcement_content', form) ?? ''
  const image = Form.useWatch('image', form)
  const push = Form.useWatch('push', form) ?? false
  const isReveal = type === 'PROFILE_REVEAL'
  const isRecording = type === 'RECORDING'

  // 경고 (저장은 막지 않음). 기준 시각이 없으면 해당 경고 생략
  const at: Dayjs | undefined = mode === 'NOW' ? dayjs() : opensAt
  const startsAt = room.starts_at ? dayjs(room.starts_at) : null
  const finalOpensAt = room.final_selection_opens_at ? dayjs(room.final_selection_opens_at) : null
  const warnings: string[] = []
  if (at) {
    if (withStart && push && at.hour() < 8) warnings.push('00~08시엔 푸시가 가지 않아요')
    if (isReveal && revealFields.length > 0 && finalOpensAt && at.isAfter(finalOpensAt)) warnings.push('최종 선택 이후 공개예요')
    if (startsAt && at.isBefore(startsAt)) warnings.push('방이 열릴 때 나가요')
  }

  // 푸시 문구: 비었거나 다른 유형의 기본 문구 그대로면 지금 유형의 기본 문구로 채운다 (운영자가 고친 문구는 둔다)
  const fillPushDefaults = (missionType: MissionType) =>
    form.setFieldsValue(
      pushDefaultsFor(missionType === 'RECORDING', {
        push_title: form.getFieldValue('push_title'),
        push_body: form.getFieldValue('push_body'),
      }),
    )
  const onPushChange = (checked: boolean) => {
    if (checked) fillPushDefaults(form.getFieldValue('type'))
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
    // 시작 글은 생성 때만 함께 보낸다. 수정은 안내 API 로 따로 보낸다 (save 참고)
    if (!mission) body.announcement = toStartBody(v, opensAtValue)
    return body
  }
  const toStartBody = (v: Values, runAtValue: string): AnnouncementBody => ({
    announcement_type: 'START',
    run_at: runAtValue,
    content:
      v.type === 'PROFILE_REVEAL'
        ? v.announcement_content?.trim()
          ? v.announcement_content
          : null
        : v.content?.trim()
          ? v.content
          : null,
    push: !!v.push,
    push_title: v.push && v.push_title?.trim() ? v.push_title : null,
    push_body: v.push && v.push_body?.trim() ? v.push_body : null,
  })

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
      if (errors.has('closes_at')) setMoreOpen(true)
      if (unknown) message.error(unknown)
      return
    }
    if (actions.handleError(e, '저장에 실패했습니다.')) onClose()
  }

  const save = async (v: Values) => {
    if (!mission) {
      try {
        await createMut.mutateAsync(toBody(v, v.mode === 'NOW' ? fmt(dayjs()) : fmt(v.opens_at!)))
        onClose()
      } catch (e) {
        applyServerError(e, v)
      }
      return
    }
    // 수정: 미션과 시작 글을 이어서 고친다. 서버는 글이 미션 시작보다 앞서면 거절하므로
    // 시각을 늦출 땐 글 → 미션, 당기거나 그대로면 미션 → 글 순서로 보낸다
    const oldOpens = dayjs(mission.opens_at)
    const newOpens = v.opens_at!
    const later = newOpens.isAfter(oldOpens)
    if (later) {
      const blocking = scheduledExtras.find((a) => dayjs(a.run_at).isBefore(newOpens))
      if (blocking) {
        form.setFields([
          {
            name: 'opens_at',
            errors: [`${dayjs(blocking.run_at).format('MM/DD HH:mm')}에 예약된 글이 있어요. 그 글을 먼저 옮겨 주세요`],
          },
        ])
        return
      }
    }
    const saveMission = () => updateMut.mutateAsync({ missionId: mission.mission_id, body: toBody(v, fmt(newOpens)) })
    const steps = [saveMission]
    if (start && withStart) {
      // 시작 글이 미션보다 늦게 잡혀 있었으면 그 간격을 지킨다
      const runAt = fmt(newOpens.add(dayjs(start.run_at).diff(oldOpens), 'millisecond'))
      const saveStart = () =>
        updateStartMut.mutateAsync({
          missionId: mission.mission_id,
          id: start.announcement_id,
          body: toStartBody(v, runAt),
        })
      if (later) steps.unshift(saveStart)
      else steps.push(saveStart)
    }
    for (const [i, step] of steps.entries()) {
      try {
        await step()
      } catch (e) {
        if (i === 0) return applyServerError(e, v)
        // 앞 단계는 이미 저장됐다. 목록을 새로 불러와 지금 상태를 보여준다
        message.warning(`일부만 저장됐어요. ${e instanceof ApiError ? e.message : '목록에서 다시 확인해 주세요.'}`)
        qc.invalidateQueries({ queryKey: ['room-missions', roomId] })
        onClose()
        return
      }
    }
    onClose()
  }

  const onFinish = (v: Values) => {
    if (v.mode !== 'NOW') return save(v)
    actions.confirmSendNow(() => save(v))
  }

  const title = mission
    ? `${readOnly ? '미션 보기' : '미션 수정'} · ${dayjs(mission.opens_at).format('MM/DD HH:mm')}`
    : '미션 추가'
  const saving = createMut.isPending || updateMut.isPending || updateStartMut.isPending
  const previewText = isReveal ? announcementContent : content
  const day = dayOf(at, startsAt)
  // 시작 글을 함께 고칠 수 없는 미션: 글이 없거나 이미 취소된 경우 (보기 전용일 땐 안내 불필요)
  const startNote =
    mission && !withStart && !readOnly ? (start ? '시작 글이 취소돼서 미션만 고쳐요' : '시작 글이 없는 미션이라 미션만 고쳐요') : null

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={560}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>{readOnly ? '닫기' : '취소'}</Button>
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
        onFinishFailed={({ errorFields }) => errorFields.some((f) => f.name[0] === 'closes_at') && setMoreOpen(true)}
        // '지금'으로 바꾸면 시각 칸 오류를 지운다
        onValuesChange={(changed) => 'mode' in changed && form.setFields([{ name: 'opens_at', errors: [] }])}
      >
        {/* 종류는 만든 뒤 바꿀 수 없다 */}
        <Form.Item name="type" label="종류" style={{ marginBottom: 16 }}>
          <Radio.Group
            disabled={readOnly || !!mission}
            optionType="button"
            onChange={(e) => form.getFieldValue('push') && fillPushDefaults(e.target.value)}
            options={MISSION_TYPES.map((t) => ({ value: t, label: MISSION_TYPE_LABEL[t] }))}
          />
        </Form.Item>

        <Form.Item label="보낼 시각" required style={{ marginBottom: 16 }}>
          <Space align="start" wrap>
            {!mission && (
              <Form.Item name="mode" noStyle>
                <Radio.Group style={{ lineHeight: '32px' }}>
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
            {day != null && <Tag style={{ marginInlineEnd: 0, marginTop: 5 }}>{day <= 0 ? '방 시작 전' : `${day}일차`}</Tag>}
          </Space>
        </Form.Item>

        {isReveal ? (
          <>
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
            {showStart && (
              <Form.Item name="announcement_content" label="채팅에 올라갈 글" extra="비우면 채팅 글 없이 공개만 돼요">
                <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={MESSAGE_MAX} showCount />
              </Form.Item>
            )}
          </>
        ) : (
          <Form.Item
            name="content"
            label="채팅에 올라갈 글"
            rules={[{ required: true, whitespace: true, message: '글을 입력해 주세요' }]}
            extra={isRecording ? '앱에서 이 글 아래에 [촬영하러 가기] 버튼이 붙어요' : undefined}
          >
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={MESSAGE_MAX} showCount />
          </Form.Item>
        )}

        <Form.Item name="image" label="사진" style={{ marginBottom: 16 }}>
          <MissionImagePicker disabled={readOnly} />
        </Form.Item>

        {showStart && (
          <>
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

        {/* 잘 안 쓰는 칸은 접어 둔다. 값이 있으면 펼친 채로 연다 */}
        <Collapse
          ghost
          size="small"
          activeKey={moreOpen ? ['more'] : []}
          onChange={(keys) => setMoreOpen(keys.length > 0)}
          style={{ marginInline: -12, marginBottom: 8 }}
          items={[
            {
              key: 'more',
              label: '더 보기',
              forceRender: true,
              children: (
                <Form.Item name="closes_at" label="마감 시각" extra="비우면 방이 끝날 때까지 열려 있어요" style={{ marginBottom: 0 }}>
                  <DatePicker
                    showTime={{ minuteStep: 5, format: 'HH:mm' }}
                    format="YYYY-MM-DD HH:mm"
                    placeholder="방 종료까지"
                    style={{ width: 180 }}
                  />
                </Form.Item>
              ),
            },
          ]}
        />

        {startNote && <Alert type="info" showIcon title={startNote} style={{ marginBottom: 16 }} />}
        {warnings.length > 0 && (
          <Space orientation="vertical" size={6} style={{ width: '100%', marginBottom: 16 }}>
            {warnings.map((w) => (
              <Alert key={w} type="warning" showIcon title={w} />
            ))}
          </Space>
        )}
      </Form>
      {previewText.trim() && <ChatBubblePreview content={previewText} at={at ?? dayjs()} imageUrl={image?.url} />}
    </Modal>
  )
}
