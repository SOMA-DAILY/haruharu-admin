import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/endpoints'
import { tokenStore } from '../api/client'
import type { AdminMe } from '../api/types'

interface AuthState {
  me: AdminMe | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null)
  const [loading, setLoading] = useState(true)
  const qc = useQueryClient()

  // 새로고침 시 토큰이 있으면 /me로 세션 복구
  useEffect(() => {
    if (!tokenStore.getAccess()) {
      setLoading(false)
      return
    }
    authApi
      .me()
      .then(setMe)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { access_token, refresh_token } = await authApi.login({ email, password })
    tokenStore.set(access_token, refresh_token)
    setMe(await authApi.me())
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      tokenStore.clear()
      setMe(null)
      qc.clear()
    }
  }

  return (
    <AuthContext.Provider value={{ me, loading, login, logout }}>{children}</AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
