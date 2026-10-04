import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Col, DatePicker, Empty, Form, Input, Image, Modal, Radio, Row, Skeleton, Space, Switch, Table, Tabs, TimePicker, Typography, theme } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useAuth } from '../auth/AuthContext'
import { operatorMissionsApi } from '../api/endpoints'
import { useOperatorMissions } from '../api/queries'
import type { OperatorMission, OperatorMissionInput, MissionImage, RoomDetail } from '../api/types'
import { OperatorMissionStatusTag } from './StatusTag'

type Photo = { status: 'none' | 'uploading' | 'error' | 'ready'; file?: File; image?: MissionImage; error?: string }
type Draft = { template_id: string; content: string; mode: 'now' | 'scheduled'; date?: Dayjs; time?: Dayjs; notify_participants: boolean }
type Action = { kind: 'create' | 'update'; input: OperatorMissionInput; id?: number } | { kind: 'cancel' | 'delete'; id: number }
function requestKey() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function OperatorMissionPanel({ room }: { room: RoomDetail }) {
  const { me } = useAuth()
  const permitted = me?.role === 'SUPER' || me?.role === 'OPERATOR'
  const query = useOperatorMissions(room.room_id, permitted)
  const qc = useQueryClient()
  const { token } = theme.useToken()
  const [form] = Form.useForm<Draft>()
  const [category, setCategory] = useState('전체')
  const [photo, setPhoto] = useState<Photo>({ status: 'none' })
  const upload = useRef<AbortController | null>(null)
  const photoVersion = useRef(0)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const photoBlocked = photo.status === 'uploading' || photo.status === 'error'
  const [editing, setEditing] = useState<OperatorMission | null>(null)
  const [confirmation, setConfirmation] = useState<{ kind: 'cancel' | 'delete'; item: OperatorMission } | null>(null)
  const busy = useRef(false)
  const key = useRef(requestKey())
  const initialized = useRef(false)
  const info = query.data?.pages[0]
  const content = Form.useWatch('content', form) ?? ''
  const mode = Form.useWatch('mode', form) ?? 'now'
  const templates = info?.templates ?? []
  const rows = query.data?.pages.flatMap((page) => page.items) ?? []
  const stopped = info ? !['PENDING', 'ACTIVE'].includes(info.room_status) : false
  const unavailable = stopped || (mode === 'now' && info?.room_status !== 'ACTIVE')
  const mutation = useMutation({
    mutationFn: async (action: Action) => {
      if (action.kind === 'create') return operatorMissionsApi.create(room.room_id, action.input)
      if (action.kind === 'update') return operatorMissionsApi.update(room.room_id, action.id!, action.input)
      if (action.kind === 'cancel') return operatorMissionsApi.cancel(room.room_id, action.id)
      return operatorMissionsApi.delete(room.room_id, action.id!)
    },
    onSuccess: (_result, action) => {
      if (action.kind === 'create' || action.kind === 'update') {
        setEditing(null)
        removePhoto()
        key.current = requestKey()
      }
      setConfirmation(null)
      void qc.invalidateQueries({ queryKey: ['operator-missions', room.room_id] })
    },
    onError: () => { void qc.invalidateQueries({ queryKey: ['operator-missions', room.room_id] }) },
    onSettled: () => { busy.current = false },
  })
  function execute(action: Action) {
    if (busy.current) return
    busy.current = true
    mutation.mutate(action)
  }
  function removePhoto() {
    photoVersion.current += 1
    upload.current?.abort()
    setPhoto({ status: 'none' })
    key.current = requestKey()
  }
  async function uploadPhoto(file: File) {
    upload.current?.abort()
    const version = ++photoVersion.current
    key.current = requestKey()
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setPhoto({ status: 'error', file, error: 'JPG·PNG 사진을 10MB 이하로 선택해 주세요.' })
      return
    }
    const controller = new AbortController()
    upload.current = controller
    setPhoto({ status: 'uploading', file })
    try {
      const image = await operatorMissionsApi.uploadImage(room.room_id, file, controller.signal)
      if (photoVersion.current === version) setPhoto({ status: 'ready', image, file })
    } catch (error) {
      if (photoVersion.current === version && !controller.signal.aborted) setPhoto({ status: 'error', file, error: error instanceof Error ? error.message : '사진을 올리지 못했어요.' })
    }
  }
  useEffect(() => () => { photoVersion.current += 1; upload.current?.abort() }, [])
  function choose(id: string) {
    const item = templates.find((entry) => entry.template_id === id)
    if (!item) return
    form.setFieldsValue({ template_id: id, content: item.content })
    key.current = requestKey()
  }
  useEffect(() => {
    if (initialized.current || !info?.templates.length) return
    const item = info.templates[0]
    if (item) {
      form.setFieldsValue({ template_id: item.template_id, content: item.content, mode: info.room_status === 'PENDING' ? 'scheduled' : 'now', notify_participants: true })
      initialized.current = true
    }
  }, [info, form])

  function edit(item: OperatorMission) {
    setEditing(item)
    setCategory('전체')
    removePhoto()
    if (item.image) setPhoto({ status: 'ready', image: item.image })
    form.setFieldsValue({ template_id: item.template_id, content: item.content, mode: 'scheduled',
      date: dayjs(item.scheduled_at), time: dayjs(item.scheduled_at), notify_participants: item.notify_participants })
    mutation.reset()
    document.getElementById('operator-mission-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function submit(draft: Draft) {
    if (!info || busy.current || photoBlocked) return
    const at = draft.mode === 'scheduled' && draft.date && draft.time
      ? `${draft.date.format('YYYY-MM-DD')}T${draft.time.format('HH:mm')}:00` : null
    if (draft.mode === 'scheduled' && (!at || !info.starts_at || !info.final_selection_opens_at
      || !dayjs(at).isAfter(dayjs(info.server_now)) || dayjs(at).isBefore(dayjs(info.starts_at))
      || !dayjs(at).isBefore(dayjs(info.final_selection_opens_at)))) {
      form.setFields([{ name: 'date', errors: ['방 촬영 기간 안의 미래 시각을 선택해 주세요.'] }])
      return
    }
    const input: OperatorMissionInput = { request_key: editing?.request_key ?? key.current,
      template_id: draft.template_id, content: draft.content.trim(), notify_participants: draft.notify_participants, scheduled_at: at, image_id: photo.image?.id ?? null }
    execute(editing ? { kind: 'update', id: editing.id, input } : { kind: 'create', input })
  }

  if (!permitted) return <Card title="운영자 미션 제공"><Alert type="warning" showIcon title="미션을 보낼 권한이 없어요." description="발송 권한이 있는 운영자 계정으로 확인해 주세요." /></Card>
  if (!info && query.isLoading) return <Card title="운영자 미션 제공"><Skeleton active /></Card>
  if (!info) return <Card title="운영자 미션 제공"><Alert type="error" showIcon title="미션 정보를 불러오지 못했어요." action={<Button onClick={() => void query.refetch()}>다시 불러오기</Button>} /></Card>

  return <Space orientation="vertical" size={16} style={{ width: '100%' }}>
    <Card id="operator-mission-composer" title={editing ? '예약 미션 수정' : '운영자 미션 제공'}>
      <Typography.Paragraph type="secondary">미션을 고르고 지금 보내거나 원하는 날짜와 시간에 예약하세요.</Typography.Paragraph>
      {stopped && <Alert type="info" showIcon title="미션 제공이 종료됐어요. 지난 이력은 확인할 수 있습니다." style={{ marginBottom: 16 }} />}
      {query.isError && <Alert type="warning" showIcon title="최신 상태를 불러오지 못했어요." action={<Button onClick={() => void query.refetch()}>새로고침</Button>} style={{ marginBottom: 16 }} />}
      {mutation.isError && <Alert type="error" showIcon title={mutation.error.message} style={{ marginBottom: 16 }} />}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={15}>
          <Form form={form} layout="vertical" onFinish={submit} disabled={mutation.isPending || stopped}
            onValuesChange={() => { key.current = requestKey() }} initialValues={{ mode: 'now', notify_participants: true }}>
            <Tabs activeKey={category} onChange={setCategory}
              items={['전체', '자기소개', '일상', '취향'].map((value) => ({ key: value, label: `${value} ${value === '전체' ? templates.length : templates.filter((item) => item.category === value).length}`, disabled: mutation.isPending || stopped }))} />
            <Form.Item name="template_id" rules={[{ required: true, message: '기본 미션을 선택해 주세요.' }]}>
              <Radio.Group onChange={(event) => choose(event.target.value)} style={{ width: '100%' }}>
                <Space orientation="vertical" style={{ width: '100%', maxHeight: 320, overflowY: 'auto' }}>
                  {templates.filter((item) => category === '전체' || item.category === category).map((item) =>
                    <Radio key={item.template_id} value={item.template_id} style={{ padding: 12, whiteSpace: 'pre-line' }}>{item.content}</Radio>)}
                </Space>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="content" label="미션 문구" extra="선택한 문구를 자유롭게 바꿀 수 있어요."
              rules={[{ required: true, whitespace: true, message: '미션 문구를 입력해 주세요.' }, { max: 500 }]}>
              <Input.TextArea rows={3} maxLength={500} showCount />
            </Form.Item>
            <Form.Item label="참고 사진 (선택)" extra="기본 사진은 없어요. JPG·PNG 한 장, 최대 10MB까지 첨부할 수 있어요.">
              <input ref={fileInput} type="file" accept="image/jpeg,image/png" aria-label="미션 참고 사진 선택"
                disabled={mutation.isPending || stopped} onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void uploadPhoto(file)
                }} />
              {photo.status === 'uploading' && <Alert type="info" title="사진을 올리는 중이에요…" style={{ marginTop: 12 }} />}
              {photo.status === 'error' && <Alert type="error" title={photo.error ?? '사진을 올리지 못했어요.'} description="다시 시도하거나 사진을 제거한 뒤 보내 주세요."
                style={{ marginTop: 12 }} action={<Button onClick={() => { if (photo.file) void uploadPhoto(photo.file) }}>다시 시도</Button>} />}
              {photo.image && <div style={{ marginTop: 12 }}><Image src={photo.image.url} alt="첨부한 미션 참고 사진" width={120} style={{ objectFit: 'contain' }} /></div>}
              {photo.status !== 'none' && <Space style={{ marginTop: 8 }}><Button disabled={mutation.isPending} onClick={() => fileInput.current?.click()}>사진 교체</Button><Button disabled={mutation.isPending} onClick={removePhoto}>사진 제거</Button></Space>}
            </Form.Item>
            <Form.Item name="mode" label="발송 방법">
              <Radio.Group optionType="button" buttonStyle="solid" options={[{ label: '지금 보내기', value: 'now', disabled: Boolean(editing) || info.room_status !== 'ACTIVE' }, { label: '시간 지정', value: 'scheduled' }]} />
            </Form.Item>
            {mode === 'scheduled' && <Row gutter={16}>
              <Col xs={24} sm={12}><Form.Item name="date" label="발송 날짜" rules={[{ required: true, message: '날짜를 선택해 주세요.' }]}>
                <DatePicker format="YYYY.MM.DD" style={{ width: '100%' }} />
              </Form.Item></Col>
              <Col xs={24} sm={12}><Form.Item name="time" label="발송 시간 (한국 시간)" rules={[{ required: true, message: '시간을 선택해 주세요.' }]}>
                <TimePicker format="HH:mm" minuteStep={1} style={{ width: '100%' }} />
              </Form.Item></Col>
              <Col span={24}><Typography.Paragraph type="secondary">한국 시간 기준 {dayjs(info.starts_at).format('MM/DD HH:mm')}부터 {dayjs(info.final_selection_opens_at).format('MM/DD HH:mm')} 전까지 예약할 수 있어요.</Typography.Paragraph></Col>
            </Row>}
            <Form.Item name="notify_participants" valuePropName="checked" label="참가자에게 알림 보내기"><Switch /></Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={mutation.isPending} disabled={unavailable || mutation.isPending || photoBlocked || !content.trim()}>
                {editing ? '예약 수정 저장' : mode === 'scheduled' ? '예약하기' : '지금 보내기'}
              </Button>
              {editing && <Button onClick={() => { setEditing(null); removePhoto(); mutation.reset(); key.current = requestKey() }}>수정 닫기</Button>}
              <Typography.Text type="secondary">이 방 참가자 {room.member_count}명에게 제공됩니다.</Typography.Text>
            </Space>
          </Form>
        </Col>
        <Col xs={24} lg={9}>
          <div style={{ padding: 20, borderRadius: token.borderRadiusLG, background: token.colorFillAlter }}>
            <Typography.Text strong>채팅 카드 미리보기</Typography.Text>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <img src="/operator-avatar.png" alt="" width={36} height={36} style={{ borderRadius: '50%' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <Typography.Text style={{ color: token.colorPrimary }}>하루 <TagLabel /></Typography.Text>
                <div style={{ padding: 16, marginTop: 8, border: `1px solid ${token.colorPrimaryBorder}`, background: token.colorBgContainer, borderRadius: token.borderRadiusLG, overflowWrap: 'anywhere' }}>
                  {photo.image && <Image src={photo.image.url} alt="참고 사진 미리보기" width="100%" style={{ maxHeight: 280, objectFit: 'contain', borderRadius: token.borderRadius }} />}
                  {photo.status === 'uploading' && <Skeleton.Image active style={{ width: '100%' }} />}
                  <Typography.Text type="secondary">오늘의 미션</Typography.Text>
                  <Typography.Paragraph strong style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{content || '미션을 선택해 주세요.'}</Typography.Paragraph>
                  <div style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: token.colorTextLightSolid, background: token.colorPrimary, borderRadius: token.borderRadius }}>촬영하러 가기</div>
                </div>
              </div>
            </div>
            <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>참가자는 버튼을 눌러 기존 피드에 영상을 올립니다.</Typography.Paragraph>
          </div>
        </Col>
      </Row>
    </Card>
    <Card title="미션 발송·예약 이력">
      <Table<OperatorMission> rowKey="id" dataSource={rows} pagination={false} scroll={{ x: 850 }}
        locale={{ emptyText: <Empty description="아직 제공한 미션이 없어요." /> }}
        columns={[
          { title: '미션 문구', width: 320, render: (_, item) => <Space>{item.image && !item.delete_requested_at && <Image src={item.image.url} alt="발송 참고 사진" width={48} />}<span style={{ whiteSpace: 'pre-line' }}>{item.content}</span></Space> },
          { title: '발송/예약 시각', render: (_, item) => dayjs(item.sent_at ?? item.scheduled_at).format('MM/DD HH:mm') },
          { title: '참가자 알림', render: (_, item) => item.notify_participants ? '켜짐' : '꺼짐' },
          { title: '상태', render: (_, item) => <Space orientation="vertical"><OperatorMissionStatusTag item={item} />{item.fail_reason && <Typography.Text type="danger">{item.fail_reason}</Typography.Text>}</Space> },
          { title: '관리', width: 200, render: (_, item) => <Space wrap>
            {item.status === 'SCHEDULED' && <><Button disabled={mutation.isPending} onClick={() => edit(item)}>수정</Button><Button danger type="text" disabled={mutation.isPending} onClick={() => setConfirmation({ kind: 'cancel', item })}>취소</Button></>}
            {item.status === 'SENT' && !item.delete_requested_at && <Button danger type="text" disabled={mutation.isPending} onClick={() => setConfirmation({ kind: 'delete', item })}>삭제</Button>}
            {item.status === 'FAILED' && info.room_status === 'ACTIVE' && <Button disabled={mutation.isPending} onClick={() => execute({ kind: 'create', input: { request_key: requestKey(), template_id: item.template_id, content: item.content, notify_participants: item.notify_participants, scheduled_at: null, image_id: item.image_id } })}>다시 보내기</Button>}
          </Space> },
        ]} />
      {query.hasNextPage && <Button style={{ marginTop: 16 }} loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>이전 이력 더 보기</Button>}
    </Card>
    <Modal open={Boolean(confirmation)} title={confirmation?.kind === 'cancel' ? '예약을 취소할까요?' : '이 미션을 삭제할까요?'}
      okText={confirmation?.kind === 'cancel' ? '예약 취소' : '삭제'} cancelText="닫기" okButtonProps={{ danger: true }}
      confirmLoading={mutation.isPending} onCancel={() => { if (!mutation.isPending) setConfirmation(null) }}
      onOk={() => { if (confirmation) execute({ kind: confirmation.kind, id: confirmation.item.id }) }}>
      {confirmation?.kind === 'cancel' ? '예약한 미션과 참가자 알림이 발송되지 않습니다.' : '채팅의 미션 카드가 삭제됩니다.'}
      {mutation.isError && <Alert type="error" title={mutation.error.message} />}
    </Modal>
  </Space>
}

function TagLabel() {
  const { token } = theme.useToken()
  return <span style={{ fontSize: 11, padding: '2px 6px', background: token.colorPrimaryBg, borderRadius: 6 }}>운영</span>
}
