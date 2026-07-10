import type { ThemeConfig } from 'antd'

// 목업(admin-*-mockup.html)의 디자인 토큰을 antd 테마로 이식
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    colorSuccess: '#22a06b',
    colorError: '#e5484d',
    colorWarning: '#e0a915',
    colorInfo: '#1677ff',
    borderRadius: 8,
    colorBgLayout: '#f5f6f8',
    colorBorderSecondary: '#eceef1',
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif',
    fontSize: 14,
  },
  components: {
    Layout: {
      siderBg: '#0f1524',
      headerBg: '#ffffff',
      bodyBg: '#f5f6f8',
    },
    Menu: {
      darkItemBg: '#0f1524',
      darkSubMenuItemBg: '#0f1524',
      darkItemSelectedBg: '#1677ff',
    },
    Card: {
      borderRadiusLG: 12,
    },
  },
}

// 사이드바 브랜드 그라디언트 등 목업 전용 색상
export const colors = {
  sidebarBg: '#0f1524',
  brandGradient: 'linear-gradient(135deg,#1677ff,#7c5cff)',
  violet: '#7c5cff',
  textSecondary: '#61656c',
  textTertiary: '#9aa0a8',
}
