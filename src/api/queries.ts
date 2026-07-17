import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminsApi, dashboardApi, iapApi, roomsApi, usersApi } from './endpoints'
import type { IapPurchaseQuery, MetricsQuery, RoomListQuery, UserListQuery } from './endpoints'
import type { CreateAdminAccountBody, UpdateAdminAccountBody } from './types'

export const useDashboardSummary = () =>
  useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.summary })

export const useDashboardMetrics = (q?: MetricsQuery) =>
  useQuery({ queryKey: ['dashboard', 'metrics', q], queryFn: () => dashboardApi.metrics(q) })

export const useRooms = (q: RoomListQuery) =>
  useQuery({ queryKey: ['rooms', q], queryFn: () => roomsApi.list(q) })

export const useRoom = (roomId: number) =>
  useQuery({ queryKey: ['room', roomId], queryFn: () => roomsApi.detail(roomId), enabled: !!roomId })

export const useUsers = (q: UserListQuery) =>
  useQuery({ queryKey: ['users', q], queryFn: () => usersApi.list(q) })

export const useUser = (userId: number) =>
  useQuery({ queryKey: ['user', userId], queryFn: () => usersApi.detail(userId), enabled: !!userId })

export const useIapPurchases = (q: IapPurchaseQuery) =>
  useQuery({ queryKey: ['iap', 'purchases', q], queryFn: () => iapApi.list(q) })

export const useIapPurchase = (id: number) =>
  useQuery({ queryKey: ['iap', 'purchase', id], queryFn: () => iapApi.detail(id), enabled: !!id })

// ===== 어드민 계정 (#234) =====
export const useAdminAccounts = (enabled = true) =>
  useQuery({ queryKey: ['admins'], queryFn: adminsApi.list, enabled })

export const useCreateAdminAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAdminAccountBody) => adminsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admins'] }),
  })
}

export const useUpdateAdminAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateAdminAccountBody }) => adminsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admins'] }),
  })
}
