import { useQuery } from '@tanstack/react-query'
import { dashboardApi, iapApi, roomsApi, usersApi } from './endpoints'
import type { IapPurchaseQuery, MetricsQuery, RoomListQuery, UserListQuery } from './endpoints'

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
