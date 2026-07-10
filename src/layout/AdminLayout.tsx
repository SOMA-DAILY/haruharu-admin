import { useMemo } from 'react'
import { Layout, Menu, Avatar, Badge, Tag, Dropdown, Typography } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { navItems } from '../config/nav'
import { colors } from '../theme'
import { useAuth } from '../auth/AuthContext'

const { Sider, Content } = Layout

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { me, logout } = useAuth()

  // nav 항목을 group별로 묶어 antd Menu 구조로 변환
  const menuItems = useMemo(() => {
    const groups: string[] = []
    navItems.forEach((n) => {
      if (!groups.includes(n.group)) groups.push(n.group)
    })
    return groups.map((group) => ({
      key: group,
      type: 'group' as const,
      label: group,
      children: navItems
        .filter((n) => n.group === group)
        .map((n) => ({
          key: n.key,
          icon: n.icon,
          disabled: n.disabled,
          label: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {n.label}
              {n.badge != null && <Badge count={n.badge} size="small" />}
              {n.tag && (
                <Tag style={{ marginLeft: 'auto', fontSize: 11 }} color="default">
                  {n.tag}
                </Tag>
              )}
            </span>
          ),
        })),
    }))
  }, [])

  // 현재 경로에 맞는 최상위 메뉴 선택 (상세 페이지는 부모 목록 하이라이트)
  const selectedKey = useMemo(() => {
    const match = navItems
      .filter((n) => n.key !== '/' && location.pathname.startsWith(n.key))
      .sort((a, b) => b.key.length - a.key.length)[0]
    return match?.key ?? '/'
  }, [location.pathname])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={232} theme="dark" style={{ background: colors.sidebarBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 22px 18px' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: colors.brandGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#fff',
              fontSize: 15,
            }}
          >
            하
          </div>
          <div>
            <b style={{ color: '#fff', fontSize: 15 }}>하루하루</b>
            <div style={{ color: '#6b7280', fontSize: 11 }}>운영 어드민</div>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ background: colors.sidebarBg, borderInlineEnd: 'none' }}
          onClick={({ key }) => navigate(key)}
        />
        <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: 16 }}>
          <Dropdown
            menu={{
              items: [{ key: 'logout', icon: <LogoutOutlined />, label: '로그아웃', onClick: logout }],
            }}
            placement="topLeft"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Avatar style={{ background: colors.violet }}>
                {me?.name?.[0] ?? '운'}
              </Avatar>
              <div>
                <div style={{ color: '#fff', fontSize: 13 }}>{me?.name ?? '운영자'}</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>{me?.role ?? 'OPERATOR'}</div>
              </div>
            </div>
          </Dropdown>
        </div>
      </Sider>
      <Layout>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

// 페이지 상단 타이틀 (목업 topbar 대응)
export function PageHeader({ title, subtitle, extra }: { title: string; subtitle?: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
      </div>
      <div style={{ marginLeft: 'auto' }}>{extra}</div>
    </div>
  )
}
