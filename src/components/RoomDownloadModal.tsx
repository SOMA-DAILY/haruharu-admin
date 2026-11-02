import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Modal, Select, Space, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { roomsApi } from '../api/endpoints'
import type { RoomDetail } from '../api/types'
import { createRoomArchive, ExportError, MAX_VIDEO_BYTES, MAX_VIDEOS } from '../room-download/export'

export default function RoomDownloadModal({ room, activityDay, activityUserId }: { room: RoomDetail; activityDay?: number; activityUserId?: number }) {
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState<number>()
  const [userId, setUserId] = useState<number>()
  const [includeVideos, setIncludeVideos] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ failures: { video_id: number; reason: string }[]; videoCount: number }>()
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { controller.current?.abort(); controller.current = null }, [])
  const close = () => { controller.current?.abort(); controller.current = null; setBusy(false); setProgress(''); setOpen(false) }
  const run = async () => {
    const next = new AbortController()
    controller.current = next
    setBusy(true); setError(''); setResult(undefined)
    try {
      const output = await createRoomArchive(room, { day, userId, includeVideos }, (page, signal) => roomsApi.activities(room.room_id, { day, page, size: 100, order: 'asc' }, signal), next.signal, value => { if (controller.current === next) setProgress(value) })
      if (controller.current !== next) return
      const blob = new Blob([output.archive as BlobPart], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `room-${room.room_id}-${Date.now()}.zip`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setResult({ failures: output.failures, videoCount: output.videoCount })
    } catch (err) {
      if (controller.current === next && !next.signal.aborted) setError(err instanceof ExportError ? err.message : '자료를 완전히 수집하지 못했습니다. 조건이나 연결 상태를 확인하고 다시 시도해 주세요.')
    } finally {
      if (controller.current === next) { controller.current = null; setBusy(false); setProgress('') }
    }
  }
  return <>
    <Button icon={<DownloadOutlined />} onClick={() => { setDay(activityDay); setUserId(activityUserId); setError(''); setResult(undefined); setOpen(true) }}>자료 다운로드</Button>
    <Modal title="방 자료 다운로드" open={open} onCancel={close} destroyOnHidden footer={<Space><Button onClick={close}>{busy ? '취소' : '닫기'}</Button><Button type="primary" icon={<DownloadOutlined />} loading={busy} onClick={() => void run()}>{result?.failures.length ? '전체 다시 조회 후 재시도' : 'ZIP 다운로드'}</Button></Space>}>
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Text>한 번에 이 방의 자료를 다운로드합니다. 현재 조회된 상태의 스냅샷이며 과거 수정 이력은 포함되지 않습니다.</Typography.Text>
        <Select aria-label="다운로드 일차" style={{ width: '100%' }} disabled={busy} value={day ?? 0} onChange={value => setDay(value || undefined)} options={[{ label: '전체 일차', value: 0 }, ...Array.from({ length: room.total_days }, (_, i) => ({ label: `${i + 1}일차`, value: i + 1 }))]} />
        <Select aria-label="다운로드 참여자" style={{ width: '100%' }} placeholder="전체 참여자" allowClear disabled={busy} value={userId} onChange={setUserId} options={room.members.map(m => ({ value: m.user_id, label: m.pseudonym ? `${m.pseudonym} (#${m.user_id})` : `참여자 #${m.user_id}` }))} />
        <Checkbox disabled={busy} checked={includeVideos} onChange={e => setIncludeVideos(e.target.checked)}>원본 영상 포함</Checkbox>
        <Typography.Text type="secondary">그룹 채팅과 영상 설명을 포함합니다. 답장 종류는 제공되지만 답장 대상 ID는 현재 제공되지 않습니다. 숨김·삭제된 자료, 개인 프로필, 익명질문, 최종 선택 및 1:1 채팅은 제외합니다. 영상은 최대 {MAX_VIDEOS}개, 개당 {MAX_VIDEO_BYTES / 1024 / 1024}MB, 합계 150MB까지 받을 수 있습니다.</Typography.Text>
        {busy && <Alert type="info" showIcon title={progress} />}
        {error && <Alert type="error" showIcon title={error} />}
        {result && (result.failures.length ? <Alert type="warning" showIcon title={`부분 완료: 영상 ${result.videoCount}개 중 ${result.failures.length}개를 받지 못했습니다.`} description={<><div>ZIP의 failures.json에서도 실패 목록을 확인할 수 있습니다. 재시도하면 전체 목록을 다시 조회합니다.</div>{result.failures.map(f => <div key={f.video_id}>영상 #{f.video_id}: {f.reason}</div>)}</>} /> : <Alert type="success" showIcon title="자료 다운로드를 시작했습니다." />)}
      </Space>
    </Modal>
  </>
}
