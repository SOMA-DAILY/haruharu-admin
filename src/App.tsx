import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './layout/AdminLayout'
import ProtectedRoute from './auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SessionsPage from './pages/SessionsPage'
import RoomDetailPage from './pages/RoomDetailPage'
import UsersPage from './pages/UsersPage'
import UserDetailPage from './pages/UserDetailPage'
import IapPage from './pages/IapPage'
import PaymentDetailPage from './pages/PaymentDetailPage'
import AuditPage from './pages/AuditPage'
import MissionsPage from './pages/MissionsPage'
import PlaceholderPage from './pages/PlaceholderPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:id" element={<RoomDetailPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/:id" element={<UserDetailPage />} />
          <Route path="/iap" element={<IapPage />} />
          <Route path="/iap/:id" element={<PaymentDetailPage />} />
          <Route path="/missions" element={<MissionsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route
            path="/moderation"
            element={
              <PlaceholderPage
                title="미션 영상 검수"
                subtitle="MVP 제외 기능"
                note="미션 기능은 MVP 범위에서 제외되었습니다(2026-07-09). 백엔드 이슈 7 이후 활성화됩니다."
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
