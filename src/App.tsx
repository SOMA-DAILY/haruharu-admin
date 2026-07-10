import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './layout/AdminLayout'
import ProtectedRoute from './auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SessionsPage from './pages/SessionsPage'
import RoomDetailPage from './pages/RoomDetailPage'
import UsersPage from './pages/UsersPage'
import UserDetailPage from './pages/UserDetailPage'
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
          <Route
            path="/iap"
            element={
              <PlaceholderPage
                title="재화·결제(IAP)"
                subtitle="인앱결제 내역·환불"
                note="환불·코인 수동조정 API는 백엔드 이슈 6 후속입니다. 현재는 유저 상세의 결제 내역으로 확인하세요."
              />
            }
          />
          <Route
            path="/iap/:id"
            element={<PlaceholderPage title="결제 상세" note="결제 상세 전용 API는 백엔드 후속(이슈 6) 예정입니다." />}
          />
          <Route
            path="/audit"
            element={
              <PlaceholderPage
                title="관리자·감사로그"
                subtitle="관리자 계정 및 활동 로그"
                note="감사로그 조회 API는 백엔드 후속입니다."
              />
            }
          />
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
