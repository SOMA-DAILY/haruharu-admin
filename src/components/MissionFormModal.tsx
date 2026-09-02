import { Fragment, useEffect } from 'react'
import { Modal, Form, Input, Select, InputNumber, Switch, Checkbox, Divider, Alert, Typography } from 'antd'
import { Form as AntForm } from 'antd'
import type { AdminMissionRevision, MissionRevisionBody, MissionPeriod } from '../api/types'
import {
  ATTR_LEVELS,
  MISSION_GOALS,
  ACTIVATION_CHANNELS,
  INTERACTION_SCOPES,
  PREFERENCE_LEAK_RISKS,
  PERIOD_LABEL,
  PERIODS,
  DAYS,
} from '../config/missionEnums'

type FormShape = Omit<MissionRevisionBody, 'eligibilities'> & { eligibilityKeys: string[] }

const eliKey = (day: number, period: MissionPeriod) => `${day}-${period}`

function toFormValues(r: AdminMissionRevision | null | undefined): Partial<FormShape> {
  if (!r) return { is_fallback: false, base_quality_score: 0.5, eligibilityKeys: [] }
  return {
    description: r.description,
    disclosure_depth: r.disclosure_depth,
    mission_goal: r.mission_goal,
    activation_channel: r.activation_channel,
    interaction_scope: r.interaction_scope,
    participation_burden: r.participation_burden,
    privacy_risk: r.privacy_risk,
    preference_leak_risk: r.preference_leak_risk,
    capture_difficulty: r.capture_difficulty,
    semantic_cluster: r.semantic_cluster,
    base_quality_score: r.base_quality_score,
    is_fallback: r.is_fallback,
    eligibilityKeys: r.eligibilities.map((e) => eliKey(e.day_number, e.period)),
  }
}

export default function MissionFormModal({
  open,
  onClose,
  title,
  submitText,
  initial,
  pending,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  submitText: string
  initial?: AdminMissionRevision | null
  pending: boolean
  onSubmit: (body: MissionRevisionBody) => Promise<void>
}) {
  const [form] = Form.useForm<FormShape>()

  // 폼 열릴 때 초기값 주입
  useEffect(() => {
    if (open) form.setFieldsValue(toFormValues(initial) as FormShape)
  }, [open, initial, form])

  const channel = AntForm.useWatch('activation_channel', form)
  const isFallback = AntForm.useWatch('is_fallback', form)

  // 제약 1: GROUP_CHAT → captureDifficulty=LOW 고정
  useEffect(() => {
    if (channel === 'GROUP_CHAT') form.setFieldValue('capture_difficulty', 'LOW')
  }, [channel, form])
  // 제약 2: isFallback → 4필드 최저 고정
  useEffect(() => {
    if (isFallback) {
      form.setFieldsValue({
        disclosure_depth: 'LOW',
        participation_burden: 'LOW',
        privacy_risk: 'LOW',
        preference_leak_risk: 'NONE',
      })
    }
  }, [isFallback, form])

  const captureLocked = channel === 'GROUP_CHAT'
  const fallbackLocked = !!isFallback

  const submit = async (v: FormShape) => {
    const body: MissionRevisionBody = {
      description: v.description,
      disclosure_depth: v.disclosure_depth,
      mission_goal: v.mission_goal,
      activation_channel: v.activation_channel,
      interaction_scope: v.interaction_scope,
      participation_burden: v.participation_burden,
      privacy_risk: v.privacy_risk,
      preference_leak_risk: v.preference_leak_risk,
      capture_difficulty: v.capture_difficulty,
      semantic_cluster: v.semantic_cluster,
      base_quality_score: v.base_quality_score,
      is_fallback: v.is_fallback,
      eligibilities: (v.eligibilityKeys ?? []).map((k) => {
        const [day, period] = k.split('-')
        return { day_number: Number(day), period: period as MissionPeriod }
      }),
    }
    await onSubmit(body)
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={submitText}
      confirmLoading={pending}
      width={640}
      destroyOnClose
    >
      {initial && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="기존 버전은 보존되고 새 버전이 발행됩니다."
        />
      )}
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
        <Divider titlePlacement="start" plain>
          문구
        </Divider>
        <Form.Item
          name="description"
          label="미션 문구"
          rules={[{ required: true, max: 500, message: '문구를 입력하세요(최대 500자).' }]}
        >
          <Input.TextArea rows={2} showCount maxLength={500} placeholder="오늘 먹은 가장 맛있는 음식을 보여주세요" />
        </Form.Item>

        <Divider titlePlacement="start" plain>
          분류
        </Divider>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="mission_goal" label="목표(missionGoal)" rules={[{ required: true }]}>
            <Select options={MISSION_GOALS} placeholder="선택" />
          </Form.Item>
          <Form.Item
            name="semantic_cluster"
            label="의미 군집(semanticCluster)"
            rules={[
              { required: true, message: '군집을 입력하세요.' },
              { pattern: /^[A-Z][A-Z0-9_]{0,49}$/, message: '대문자 시작, 영대문자·숫자·_ 만, 최대 50자' },
            ]}
          >
            <Input placeholder="ROUTINE, FOOD, OUTFIT …" />
          </Form.Item>
        </div>

        <Divider titlePlacement="start" plain>
          안전성 {fallbackLocked && <Typography.Text type="secondary">(fallback: 최저 고정)</Typography.Text>}
        </Divider>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Form.Item name="disclosure_depth" label="자기개방 깊이" rules={[{ required: true }]}>
            <Select options={ATTR_LEVELS} disabled={fallbackLocked} placeholder="선택" />
          </Form.Item>
          <Form.Item name="privacy_risk" label="프라이버시 위험" rules={[{ required: true }]}>
            <Select options={ATTR_LEVELS} disabled={fallbackLocked} placeholder="선택" />
          </Form.Item>
          <Form.Item name="preference_leak_risk" label="선호 노출 위험" rules={[{ required: true }]}>
            <Select options={PREFERENCE_LEAK_RISKS} disabled={fallbackLocked} placeholder="선택" />
          </Form.Item>
        </div>

        <Divider titlePlacement="start" plain>
          수행
        </Divider>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="activation_channel" label="활성 채널(activationChannel)" rules={[{ required: true }]}>
            <Select options={ACTIVATION_CHANNELS} placeholder="선택" />
          </Form.Item>
          <Form.Item name="interaction_scope" label="상호작용 범위(interactionScope)" rules={[{ required: true }]}>
            <Select options={INTERACTION_SCOPES} placeholder="선택" />
          </Form.Item>
          <Form.Item name="participation_burden" label="참여 부담" rules={[{ required: true }]}>
            <Select options={ATTR_LEVELS} disabled={fallbackLocked} placeholder="선택" />
          </Form.Item>
          <Form.Item
            name="capture_difficulty"
            label="촬영 난이도"
            tooltip={captureLocked ? '그룹채팅 미션은 LOW 고정' : undefined}
            rules={[{ required: true }]}
          >
            <Select options={ATTR_LEVELS} disabled={captureLocked} placeholder="선택" />
          </Form.Item>
        </div>

        <Divider titlePlacement="start" plain>
          사용 시점(eligibilities)
        </Divider>
        <Form.Item
          name="eligibilityKeys"
          rules={[{ required: true, message: '최소 1개 시점을 선택하세요.' }]}
        >
          <Checkbox.Group style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '8px 16px', alignItems: 'center' }}>
              <div />
              {PERIODS.map((p) => (
                <div key={p} style={{ fontSize: 12, color: '#9aa0a8', textAlign: 'center' }}>
                  {PERIOD_LABEL[p]}
                </div>
              ))}
              {DAYS.map((d) => (
                <Fragment key={d}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Day{d}</div>
                  {PERIODS.map((p) => (
                    <div key={`${d}-${p}`} style={{ textAlign: 'center' }}>
                      <Checkbox value={eliKey(d, p)} />
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </Checkbox.Group>
        </Form.Item>

        <Divider titlePlacement="start" plain>
          기타
        </Divider>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
          <Form.Item name="base_quality_score" label="기본 품질 점수(0~1)" rules={[{ required: true }]}>
            <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_fallback" label="fallback (비상 안전 미션)" valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
