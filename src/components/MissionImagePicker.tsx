import { useState } from 'react'
import { Button, Image, Space, Typography, Upload } from 'antd'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { useUploadMissionImage } from '../api/queries'
import { ApiError } from '../api/client'
import type { MissionImage } from '../api/types'

const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const IMAGE_HINT = 'JPG·PNG 사진을 10MB 이하로 선택해 주세요.'

// 사진을 먼저 올리고(POST /mission-images) 받은 key 를 미션에 붙인다
export default function MissionImagePicker({
  value,
  onChange,
  disabled,
  compact,
  onUploadingChange,
}: {
  value?: MissionImage | null
  onChange?: (v: MissionImage | null) => void
  disabled?: boolean
  compact?: boolean // 방 생성 모달 줄 안에 넣는 작은 모양
  onUploadingChange?: (uploading: boolean) => void
}) {
  const uploadMut = useUploadMissionImage()
  const [error, setError] = useState<string>()

  const upload = async (file: File) => {
    setError(undefined)
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > IMAGE_MAX_BYTES) {
      setError(IMAGE_HINT)
      return
    }
    onUploadingChange?.(true)
    try {
      onChange?.(await uploadMut.mutateAsync(file))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '사진을 올리지 못했어요.')
    } finally {
      onUploadingChange?.(false)
    }
  }

  const size = compact ? 'small' : undefined
  const preview = value && (
    <Image
      src={value.url}
      alt="미션 사진"
      width={compact ? 40 : 120}
      height={compact ? 40 : undefined}
      style={{ borderRadius: compact ? 6 : 8, objectFit: 'cover' }}
    />
  )
  const buttons = !disabled && (
    <Space size={compact ? 4 : 8}>
      <Upload
        accept="image/jpeg,image/png"
        showUploadList={false}
        beforeUpload={(file) => {
          void upload(file)
          return false
        }}
      >
        <Button size={size} icon={<UploadOutlined />} loading={uploadMut.isPending}>
          {value ? '사진 바꾸기' : '사진 첨부'}
        </Button>
      </Upload>
      {value && (
        <Button size={size} icon={<DeleteOutlined />} onClick={() => onChange?.(null)}>
          사진 떼기
        </Button>
      )}
    </Space>
  )

  return (
    <Space orientation="vertical" size={compact ? 2 : 6}>
      {compact ? (
        <Space size={8} align="center">
          {preview}
          {buttons}
        </Space>
      ) : (
        <>
          {preview}
          {buttons}
        </>
      )}
      {!value && disabled && <Typography.Text type="secondary">없음</Typography.Text>}
      {error && (
        <Typography.Text type="danger" style={compact ? { fontSize: 12 } : undefined}>
          {error}
        </Typography.Text>
      )}
    </Space>
  )
}
