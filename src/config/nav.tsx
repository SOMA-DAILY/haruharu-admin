import type { ReactNode } from 'react'
import {
  DashboardOutlined,
  HomeOutlined,
  TeamOutlined,
  UserOutlined,
  CreditCardOutlined,
  VideoCameraOutlined,
  WarningOutlined,
  SettingOutlined,
  SafetyOutlined,
  KeyOutlined,
} from '@ant-design/icons'

export type NavItem = {
  key: string // 라우트 경로
  label: string
  icon: ReactNode
  group: string
  disabled?: boolean
  tag?: string // 비활성 사유(추후/준비중)
}

// 목업 사이드바(admin-dashboard-mockup.html) 기준
export const navItems: NavItem[] = [
  { key: '/', label: '대시보드', icon: <DashboardOutlined />, group: '모니터링' },
  // 세션 배지는 AdminLayout에서 active_rooms.total(실데이터)로 주입
  { key: '/sessions', label: '세션(방) 관리', icon: <HomeOutlined />, group: '운영' },
  { key: '/cohort-applications', label: '기수 신청', icon: <TeamOutlined />, group: '운영' },
  { key: '/users', label: '유저 관리', icon: <UserOutlined />, group: '운영' },
  { key: '/iap', label: '재화·결제(IAP)', icon: <CreditCardOutlined />, group: '운영' },
  {
    key: '/moderation',
    label: '미션 영상 검수',
    icon: <VideoCameraOutlined />,
    group: '운영',
    disabled: true,
    tag: '추후',
  },
  {
    key: '/reports',
    label: '신고·안전',
    icon: <WarningOutlined />,
    group: '운영',
    disabled: true,
    tag: '준비중',
  },
  {
    key: '/policy',
    label: '정책값 관리',
    icon: <SettingOutlined />,
    group: '시스템',
    disabled: true,
    tag: '추후',
  },
  { key: '/demo', label: '데모 코드', icon: <KeyOutlined />, group: '시스템' },
  { key: '/audit', label: '관리자·감사로그', icon: <SafetyOutlined />, group: '시스템' },
]
