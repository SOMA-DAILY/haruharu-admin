import { useEffect, useState } from 'react'
import { Alert, App, Button, Card, Col, Collapse, Form, Input, Modal, Row, Skeleton, Space, Table, Typography } from 'antd'
import dayjs from 'dayjs'
import { PageHeader } from '../layout/AdminLayout'
import { useAuth } from '../auth/AuthContext'
import { useAppUpdatePolicy, useAppUpdatePolicyHistory, useUpdateAppUpdatePolicy } from '../api/queries'
import type { AppUpdatePolicy, AppUpdatePolicyHistory, UpdateAppUpdatePolicyBody } from '../api/types'

const versionPattern = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/
const normalize = (v?: string) => v?.trim() || null
const label = (v: string | null) => v ?? '미설정 · 강제 없음'
type Values = { ios_minimum_version: string; android_minimum_version: string }

export default function AppUpdatePolicyPage() {
  const { message, modal } = App.useApp()
  const { me } = useAuth()
  const policy = useAppUpdatePolicy()
  const history = useAppUpdatePolicyHistory()
  const mutation = useUpdateAppUpdatePolicy()
  const [form] = Form.useForm<Values>()
  const values = Form.useWatch([], form) as Partial<Values> | undefined
  const [baseline, setBaseline] = useState<AppUpdatePolicy | null>(null)
  const [dirty, setDirty] = useState(false)
  const [confirmation, setConfirmation] = useState<UpdateAppUpdatePolicyBody | null>(null)
  const editable = me?.role === 'SUPER'
  const changed = baseline && (normalize(values?.ios_minimum_version) !== baseline.ios_minimum_version ||
    normalize(values?.android_minimum_version) !== baseline.android_minimum_version)

  useEffect(() => {
    if (policy.data && !dirty) {
      setBaseline(policy.data)
      form.setFieldsValue({ ios_minimum_version: policy.data.ios_minimum_version ?? '', android_minimum_version: policy.data.android_minimum_version ?? '' })
    }
  }, [policy.data, dirty, form])

  async function reload() {
    const result = await policy.refetch()
    if (!result.data || result.isError) { message.error('현재 기준을 불러오지 못했습니다. 입력 내용은 유지됩니다.'); return }
    setBaseline(result.data)
    form.setFieldsValue({ ios_minimum_version: result.data.ios_minimum_version ?? '', android_minimum_version: result.data.android_minimum_version ?? '' })
    setDirty(false)
  }
  function requestReload() {
    if (dirty && changed) modal.confirm({ title: '입력한 내용을 버리고 현재 기준을 불러올까요?', onOk: reload })
    else void reload()
  }
  function prepare(v: Values) {
    if (!baseline || !editable || !changed) return
    setConfirmation({ ios_minimum_version: normalize(v.ios_minimum_version), android_minimum_version: normalize(v.android_minimum_version), revision: baseline.revision })
  }
  async function save() {
    if (!confirmation || mutation.isPending) return
    try {
      await mutation.mutateAsync(confirmation)
      setDirty(false)
      setConfirmation(null)
      message.success('최소 지원 버전을 저장했습니다.')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '저장하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  const columns = [
    { title: '변경 일시', dataIndex: 'changed_at', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: 'iOS', render: (_: unknown, r: AppUpdatePolicyHistory) => `${label(r.previous_ios_minimum_version)} → ${label(r.ios_minimum_version)}` },
    { title: 'Android', render: (_: unknown, r: AppUpdatePolicyHistory) => `${label(r.previous_android_minimum_version)} → ${label(r.android_minimum_version)}` },
    { title: '관리자', dataIndex: 'changed_by', render: (id: number) => `#${id}` },
  ]
  return <>
    <PageHeader title="최소 버전 관리" subtitle="앱 최소 지원 버전 · 저장한 기준보다 낮은 앱에 업데이트를 안내합니다." />
    <Space orientation="vertical" size={24} style={{ width: '100%' }}>
      {policy.isError && <Alert type="error" showIcon title="최소 버전을 불러오지 못했습니다." action={<Button onClick={requestReload}>다시 시도</Button>} />}
      <Card title="앱 최소 버전" extra={<Button onClick={requestReload} loading={policy.isFetching} disabled={mutation.isPending}>현재 기준 새로고침</Button>}>
        <Skeleton loading={policy.isLoading} active>
          {!editable && <Alert type="info" showIcon title="조회만 가능합니다. 최소 버전 변경은 SUPER 관리자만 할 수 있습니다." style={{ marginBottom: 16 }} />}
          <Typography.Paragraph type="secondary">스토어에서 새 버전을 설치할 수 있는지 확인한 뒤 저장해 주세요. 비워두면 해당 플랫폼의 강제 업데이트가 해제됩니다.</Typography.Paragraph>
          <Form form={form} layout="vertical" onFinish={prepare} onValuesChange={() => setDirty(true)} disabled={!editable || !baseline || mutation.isPending} requiredMark={false}>
            <Row gutter={[32, 16]}>
              {(['ios', 'android'] as const).map(os => {
                const name = `${os}_minimum_version` as keyof Values
                const minimum = normalize(values?.[name])
                return <Col xs={24} md={12} key={os}>
                  <Typography.Title level={5}>{os === 'ios' ? 'iPhone · iOS' : 'Android'}</Typography.Title>
                  <Form.Item name={name} label="최소 지원 버전" rules={[{ validator: async (_, value: string | undefined) => {
                    const v = normalize(value)
                    if (v && !versionPattern.test(v)) throw new Error('1.2.3 형식으로 입력해 주세요. 각 숫자는 0~999999입니다.')
                  } }]}>
                    <Input placeholder="미설정 · 강제 업데이트 없음" maxLength={40} />
                  </Form.Item>
                  <Typography.Paragraph>{minimum ? <>{minimum} 미만 → 업데이트 필요<br />{minimum} 이상 → 앱 이용 가능</> : '강제 업데이트 없음'}</Typography.Paragraph>
                  <Typography.Text type="secondary">현재 저장된 기준: {label(baseline?.[name] ?? null)}</Typography.Text>
                </Col>
              })}
            </Row>
            <Space style={{ marginTop: 24 }}>
              {editable && <Button type="primary" htmlType="submit" disabled={!changed} loading={mutation.isPending}>변경 내용 확인</Button>}
              <Typography.Text type="secondary">{baseline?.updated_at ? `마지막 변경 ${dayjs(baseline.updated_at).format('YYYY-MM-DD HH:mm')} · 관리자 #${baseline.updated_by}` : '아직 설정한 기준이 없습니다.'}</Typography.Text>
            </Space>
          </Form>
        </Skeleton>
      </Card>
      <div>
        <Typography.Title level={5}>언제 적용되나요?</Typography.Title>
        <Typography.Paragraph>앱 실행 또는 백그라운드에서 돌아올 때 확인합니다. 업데이트를 누르면 해당 스토어로 이동합니다.</Typography.Paragraph>
        <Typography.Text type="secondary">통신 실패 시 마지막으로 확인한 기준을 사용합니다. 첫 조회도 실패하면 임의로 앱을 차단하지 않습니다.</Typography.Text>
      </div>
      <Collapse items={[{ key: 'history', label: '최근 변경 이력', children: history.isError
        ? <Alert type="error" title="변경 이력을 불러오지 못했습니다." action={<Button onClick={() => void history.refetch()}>다시 시도</Button>} />
        : <Table rowKey="id" size="small" loading={history.isLoading} dataSource={history.data} columns={columns} pagination={false} locale={{ emptyText: '변경 이력이 없습니다.' }} scroll={{ x: 720 }} /> }]} />
    </Space>
    <Modal title="최소 지원 버전을 저장할까요?" open={!!confirmation} onCancel={() => { if (!mutation.isPending) setConfirmation(null) }} onOk={() => void save()} okText="확인하고 저장" cancelText="취소" confirmLoading={mutation.isPending} closable={!mutation.isPending} maskClosable={!mutation.isPending} cancelButtonProps={{ disabled: mutation.isPending }}>
      <Typography.Paragraph>iOS: {label(baseline?.ios_minimum_version ?? null)} → {label(confirmation?.ios_minimum_version ?? null)}<br />Android: {label(baseline?.android_minimum_version ?? null)} → {label(confirmation?.android_minimum_version ?? null)}</Typography.Paragraph>
      <Alert type="warning" showIcon title="저장한 최소 버전보다 낮은 사용자는 앱에 진입할 수 없습니다." description="기준을 올리기 전에 각 스토어에서 해당 버전을 실제로 설치할 수 있는지 확인해 주세요." />
    </Modal>
  </>
}
