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
  Card,
  Input,
  Select,
  Switch,
  Tag,
} from 'antd'
import { DeleteOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Form as AntForm } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { Dayjs } from 'dayjs'
import { useCreateRoom } from '../api/queries'
import { ApiError } from '../api/client'
import { PERIODS, PERIOD_LABEL } from '../config/missionEnums'
import type { MissionPeriod, RevealField, RoomMissionSlot, ScheduleItemBody } from '../api/types'
import {
  CHAT_SCHEDULE_DEFAULTS,
  DEFAULT_PUSH_BODY,
  DEFAULT_PUSH_TITLE,
  MESSAGE_MAX,
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
  REVEAL_FIELDS,
  REVEAL_LABEL,
  dayOf,
  resolveRunAt,
  type ScheduleTimeRule,
} from '../config/chatScheduleDefaults'

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
  mission_enabled: boolean
  slots?: Record<string, SlotVal>
}

// ===== 채팅 편성 (E0) =====
// rule 있는 줄 = 기본 편성 줄(시각 자동 계산, 공개 항목 고정), 없는 줄 = [+ 글 추가] 로 넣은 줄
type ScheduleRow = {
  uid: number
  rule: ScheduleTimeRule | null
  dirty: boolean // 시각을 손으로 바꿨으면 true → 방 시작/최종선택 오픈이 바뀌어도 재계산 안 함
  run_at?: Dayjs
  reveal_fields: RevealField[]
  message_content: string
  push: boolean
  push_title: string
  push_body: string
  error?: string
}

let rowSeq = 0
const defaultRows = (start?: Dayjs | null, final?: Dayjs | null): ScheduleRow[] =>
  CHAT_SCHEDULE_DEFAULTS.map((d) => ({
    uid: ++rowSeq,
    rule: d.rule,
    dirty: false,
    run_at: resolveRunAt(d.rule, start, final),
    reveal_fields: [...d.reveal_fields],
    message_content: d.message_content,
    push: d.push,
    push_title: d.push_title ?? '',
    push_body: d.push_body ?? '',
  }))

const rowError = (r: ScheduleRow) => {
  if (!r.run_at) return '시각을 선택하세요.'
  if (!r.message_content.trim() && r.reveal_fields.length === 0) return '운영 글이나 공개 항목 중 하나는 있어야 해요'
  return undefined
}

function ChatScheduleSection({
  rows,
  setRows,
  startsAt,
  finalOpensAt,
}: {
  rows: ScheduleRow[]
  setRows: React.Dispatch<React.SetStateAction<ScheduleRow[]>>
  startsAt?: Dayjs | null
  finalOpensAt?: Dayjs | null
}) {
  const update = (uid: number, patch: Partial<ScheduleRow>) =>
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch, error: undefined } : r)))

  const recalcAll = () =>
    setRows((prev) =>
      prev.map((r) => (r.rule ? { ...r, dirty: false, run_at: resolveRunAt(r.rule, startsAt, finalOpensAt), error: undefined } : r)),
    )

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        uid: ++rowSeq,
        rule: null,
        dirty: true,
        run_at: undefined,
        reveal_fields: [],
        message_content: '',
        push: false,
        push_title: '',
        push_body: '',
      },
    ])

  return (
    <>
      <Divider titlePlacement="start" plain>
        채팅 편성
      </Divider>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Tag color="blue">{rows.length}줄</Tag>
        <Space>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={recalcAll}>
            시각 다시 계산
          </Button>
          <Button size="small" icon={<PlusOutlined />} onClick={addRow}>
            글 추가
          </Button>
        </Space>
      </div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
        방 시작과 최종선택 시각으로 시각이 자동 계산됨. 문구와 시각을 여기서 고친 채로 만들면 그대로 예약됨. 만든 뒤에는 방 상세 [방 편성] 에서 고침.
      </Typography.Paragraph>
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        {rows.map((r) => {
          const day = dayOf(r.run_at, startsAt)
          const beforeStart = !!(r.run_at && startsAt && r.run_at.isBefore(startsAt))
          return (
            <Card key={r.uid} size="small" styles={{ body: { padding: 12 } }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 150, flexShrink: 0 }}>
                  <DatePicker
                    showTime={{ minuteStep: 5, format: 'HH:mm' }}
                    format="MM/DD HH:mm"
                    placeholder="시각"
                    value={r.run_at}
                    status={r.error && !r.run_at ? 'error' : undefined}
                    onChange={(v) => update(r.uid, { run_at: v ?? undefined, dirty: true })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ marginTop: 6 }}>
                    <Tag>{day != null ? `DAY ${day}` : 'DAY -'}</Tag>
                    {r.rule?.kind === 'beforeFinal' && (
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        최종선택 {r.rule.hours}시간 전
                      </Typography.Text>
                    )}
                  </div>
                  {beforeStart && (
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                      방 시작 전이면 방이 열릴 때 나감
                    </Typography.Text>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <Space size={4} wrap style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        공개 항목
                      </Typography.Text>
                      {r.rule ? (
                        r.reveal_fields.length > 0 ? (
                          r.reveal_fields.map((f) => (
                            <Tag key={f} color="gold" style={{ marginInlineEnd: 0 }}>
                              {REVEAL_LABEL[f]}
                            </Tag>
                          ))
                        ) : (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            없음
                          </Typography.Text>
                        )
                      ) : (
                        <Select
                          mode="multiple"
                          size="small"
                          allowClear
                          placeholder="없음"
                          style={{ minWidth: 180 }}
                          value={r.reveal_fields}
                          onChange={(v: RevealField[]) => update(r.uid, { reveal_fields: v })}
                          options={REVEAL_FIELDS.map((f) => ({ value: f, label: REVEAL_LABEL[f] }))}
                        />
                      )}
                    </Space>
                    <Space size={6}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        푸시
                      </Typography.Text>
                      <Switch
                        size="small"
                        checked={r.push}
                        checkedChildren="ON"
                        unCheckedChildren="OFF"
                        onChange={(checked) =>
                          update(r.uid, {
                            push: checked,
                            ...(checked
                              ? {
                                  push_title: r.push_title || DEFAULT_PUSH_TITLE,
                                  push_body: r.push_body || DEFAULT_PUSH_BODY,
                                }
                              : {}),
                          })
                        }
                      />
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        aria-label="줄 삭제"
                        onClick={() => setRows((prev) => prev.filter((x) => x.uid !== r.uid))}
                      />
                    </Space>
                  </div>
                  <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    maxLength={MESSAGE_MAX}
                    showCount
                    value={r.message_content}
                    status={r.error && r.run_at ? 'error' : undefined}
                    onChange={(e) => update(r.uid, { message_content: e.target.value })}
                    style={{ marginBottom: 20 }}
                  />
                  {r.push && (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <Input
                        size="small"
                        prefix={<Typography.Text type="secondary" style={{ fontSize: 12 }}>제목</Typography.Text>}
                        maxLength={PUSH_TITLE_MAX}
                        showCount
                        value={r.push_title}
                        onChange={(e) => update(r.uid, { push_title: e.target.value })}
                      />
                      <Input
                        size="small"
                        prefix={<Typography.Text type="secondary" style={{ fontSize: 12 }}>본문</Typography.Text>}
                        maxLength={PUSH_BODY_MAX}
                        showCount
                        value={r.push_body}
                        onChange={(e) => update(r.uid, { push_body: e.target.value })}
                      />
                    </div>
                  )}
                  {r.error && (
                    <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                      {r.error}
                    </Typography.Text>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </Space>
    </>
  )
}

export default function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()
  const createMut = useCreateRoom()
  const [created, setCreated] = useState<{ room_id: number; code: string } | null>(null)

  const totalDays: number = AntForm.useWatch('total_days', form) ?? 3
  const days = Array.from({ length: Math.max(1, totalDays) }, (_, i) => i + 1)
  const missionEnabled: boolean = AntForm.useWatch('mission_enabled', form) ?? true

  // 채팅 편성: 방 시작/최종선택 오픈이 바뀌면 손 안 댄 기본 줄만 재계산
  const startsAt: Dayjs | undefined = AntForm.useWatch('starts_at', form)
  const finalOpensAt: Dayjs | undefined = AntForm.useWatch('final_selection_opens_at', form)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(() => defaultRows())
  const onValuesChange = (changed: Partial<FormValues>, all: FormValues) => {
    if (!('starts_at' in changed || 'final_selection_opens_at' in changed)) return
    setScheduleRows((prev) =>
      prev.map((r) => {
        if (!r.rule || r.dirty) return r
        const run_at = resolveRunAt(r.rule, all.starts_at, all.final_selection_opens_at)
        // 시각이 채워졌으면 이전 오류('시각을 선택하세요.') 제거
        return { ...r, run_at, error: run_at ? undefined : r.error }
      }),
    )
  }

  const close = () => {
    form.resetFields()
    setCreated(null)
    setScheduleRows(defaultRows())
    onClose()
  }

  // 시작시각 기준 오프셋으로 슬롯 자동 채우기 (BE RoomMissionSlotSchedule.defaults 규칙과 일치).
  // 오전 시작+3h~+8h, 오후 +9h~+14h, day마다 +24h → opens≥시작·겹침 없음 보장.
  const autofill = () => {
    const start = form.getFieldValue('starts_at') as Dayjs | undefined
    if (!start) {
      message.warning('먼저 "방 시작" 시각을 선택하세요.')
      return
    }
    const slots: Record<string, SlotVal> = {}
    days.forEach((d) => {
      const dayOffset = (d - 1) * 24
      slots[slotKey(d, 'MORNING')] = {
        opens: start.add(dayOffset + 3, 'hour'),
        closes: start.add(dayOffset + 8, 'hour'),
      }
      slots[slotKey(d, 'AFTERNOON')] = {
        opens: start.add(dayOffset + 9, 'hour'),
        closes: start.add(dayOffset + 14, 'hour'),
      }
    })
    form.setFieldValue('slots', slots)
  }

  const onFinish = async (v: FormValues) => {
    // 미션 켜짐일 때만 슬롯 조립·전송. 꺼짐이면 미전송(BE #450).
    const mission_slots: RoomMissionSlot[] = []
    if (v.mission_enabled) {
      for (const d of days) {
        for (const p of PERIODS) {
          const s = v.slots?.[slotKey(d, p)]
          if (s?.opens && s?.closes) {
            mission_slots.push({ day_number: d, period: p, opens_at: fmt(s.opens), closes_at: fmt(s.closes) })
          }
        }
      }
    }
    const checked = scheduleRows.map((r) => ({ ...r, error: rowError(r) }))
    if (checked.some((r) => r.error)) {
      setScheduleRows(checked)
      message.warning('채팅 편성을 확인하세요.')
      return
    }
    const chat_schedule: ScheduleItemBody[] = scheduleRows.map((r) => ({
      run_at: fmt(r.run_at!),
      reveal_fields: r.reveal_fields,
      message_content: r.message_content.trim() ? r.message_content : null,
      push: r.push,
      push_title: r.push && r.push_title.trim() ? r.push_title : null,
      push_body: r.push && r.push_body.trim() ? r.push_body : null,
    }))
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
        mission_enabled: v.mission_enabled,
        ...(v.mission_enabled ? { mission_slots } : {}),
        chat_schedule,
      })
      setCreated(res)
    } catch (e) {
      // 400 이 chat_schedule[i].xxx 칸으로 오면 그 줄 아래에 표시
      const rowErrors = new Map<number, string>()
      if (e instanceof ApiError && e.status === 400 && e.fieldErrors) {
        for (const [field, msg] of Object.entries(e.fieldErrors)) {
          const m = /^chat_schedule\[(\d+)\]/.exec(field)
          if (m && Number(m[1]) < scheduleRows.length && !rowErrors.has(Number(m[1]))) rowErrors.set(Number(m[1]), msg)
        }
      }
      if (rowErrors.size > 0) {
        setScheduleRows((prev) => prev.map((r, i) => (rowErrors.has(i) ? { ...r, error: rowErrors.get(i) } : r)))
        return
      }
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
        <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={onValuesChange} requiredMark={false} initialValues={{ total_days: 3, max_uses: 6, mission_enabled: true }}>
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
            미션
          </Divider>
          <Form.Item
            name="mission_enabled"
            label="미션 사용"
            valuePropName="checked"
            tooltip="끄면 이 방은 미션 슬롯을 만들지 않고 영상·그룹채팅 미션 활동도 기록하지 않습니다."
            style={{ marginBottom: missionEnabled ? 8 : 0 }}
          >
            <Switch checkedChildren="사용" unCheckedChildren="미사용" />
          </Form.Item>
          {missionEnabled && (
            <>
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
                각 슬롯은 <b>방 시작 이후 ~ 최종선택 오픈 이전</b>이어야 하고, 시간대끼리 겹치면 안 됩니다. 자동 채우기를 권장합니다.
              </Typography.Paragraph>
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
            </>
          )}

          <ChatScheduleSection
            rows={scheduleRows}
            setRows={setScheduleRows}
            startsAt={startsAt}
            finalOpensAt={finalOpensAt}
          />
        </Form>
      )}
    </Modal>
  )
}
