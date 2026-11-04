import type { ReportReason } from '../api/types'

/** 신고 사유 라벨 — 앱 신고 화면 카피와 1:1 (BE ReportReason). */
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  CHILD_SAFETY: '미성년자·아동 안전',
  INAPPROPRIATE_MEDIA: '부적절한 사진·영상',
  ABUSIVE_LANGUAGE: '욕설·비방·혐오',
  FAKE_PROFILE: '허위 프로필·사칭',
  SPAM_AD: '광고·스팸',
  OTHER: '기타',
}
