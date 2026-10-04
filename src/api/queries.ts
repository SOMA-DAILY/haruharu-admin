import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { dashboardApi, roomsApi, usersApi, operatorMissionsApi } from './endpoints'
import type { RoomListQuery, UserListQuery } from './endpoints'

export const useDashboardSummary = () =>
  useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.summary })

export const useRooms = (q: RoomListQuery) =>
  useQuery({ queryKey: ['rooms', q], queryFn: () => roomsApi.list(q) })

export const useRoom = (roomId: number) =>
  useQuery({ queryKey: ['room', roomId], queryFn: () => roomsApi.detail(roomId), enabled: !!roomId })

export const useOperatorMissions = (roomId: number, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ['operator-missions', roomId], initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => operatorMissionsApi.list(roomId, pageParam),
    getNextPageParam: (page) => page.next_cursor ?? undefined, enabled: enabled && roomId > 0, refetchInterval: 2000,
  })

export const useUsers = (q: UserListQuery) =>
  useQuery({ queryKey: ['users', q], queryFn: () => usersApi.list(q) })

export const useUser = (userId: number) =>
  useQuery({ queryKey: ['user', userId], queryFn: () => usersApi.detail(userId), enabled: !!userId })
