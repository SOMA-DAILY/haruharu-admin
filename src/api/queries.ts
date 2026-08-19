import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminsApi, dashboardApi, iapApi, missionsApi, roomsApi, usersApi } from './endpoints'
import type { IapPurchaseQuery, MetricsQuery, RoomListQuery, UserListQuery } from './endpoints'
import type {
  AssignGenderBody,
  CreateAdminAccountBody,
  CreateMissionBody,
  CreateRoomBody,
  ReissueInviteBody,
  UpdateAdminAccountBody,
  UpdateMissionBody,
} from './types'

export const useDashboardSummary = () =>
  useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.summary })

export const useDashboardMetrics = (q?: MetricsQuery) =>
  useQuery({ queryKey: ['dashboard', 'metrics', q], queryFn: () => dashboardApi.metrics(q) })

export const useRooms = (q: RoomListQuery) =>
  useQuery({ queryKey: ['rooms', q], queryFn: () => roomsApi.list(q) })

export const useRoom = (roomId: number) =>
  useQuery({ queryKey: ['room', roomId], queryFn: () => roomsApi.detail(roomId), enabled: !!roomId })

// 초대코드 목록 (SUPER·OPERATOR) — enabled로 CS/권한없음 시 미호출
export const useRoomInvites = (roomId: number, enabled = true) =>
  useQuery({
    queryKey: ['room', roomId, 'invites'],
    queryFn: () => roomsApi.invites(roomId),
    enabled: !!roomId && enabled,
  })

// 방 쓰기 mutation
export const useCreateRoom = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateRoomBody) => roomsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  })
}
export const useReissueInvite = (roomId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ReissueInviteBody) => roomsApi.reissueInvite(roomId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['room', roomId, 'invites'] }),
  })
}
export const useCancelRoom = (roomId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => roomsApi.cancel(roomId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room', roomId] })
      qc.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}
export const useAssignGender = (roomId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, body }: { memberId: number; body: AssignGenderBody }) =>
      roomsApi.assignGender(roomId, memberId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['room', roomId] }),
  })
}

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

// ===== 미션 카탈로그 =====
export const useMissions = (enabled = true) =>
  useQuery({ queryKey: ['missions'], queryFn: missionsApi.list, enabled })

export const useCreateMission = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateMissionBody) => missionsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  })
}
export const useUpdateMission = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateMissionBody }) => missionsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  })
}
