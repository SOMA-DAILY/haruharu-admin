import { Spin } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ProtectedRoute() {
  const { me, loading } = useAuth()
  const location = useLocation()

  if (loading)
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    )

  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <Outlet />
}
