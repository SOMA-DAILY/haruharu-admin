import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appUpdatePolicyApi, adminsApi, dashboardApi, demoApi, iapApi, missionImagesApi, roomMissionsApi, roomsApi, usersApi } from './endpoints'
import type {
  IapPurchaseQuery,
  MetricsQuery,
  RoomListQuery,
  RoomActivityQuery,
  UserListQuery,
} from './endpoints'
import type {
  UpdateAppUpdatePolicyBody,
  AnnouncementBody,
  AssignGenderBody,
  CreateAdminAccountBody,
  CreateRoomBody,
  MissionAnnouncement,
  ReissueInviteBody,
  RoomMission,
  RoomMissionBody,
  SetDemoCodeBody,
  UpdateAdminAccountBody,
} from './types'

export const useDashboardSummary = () =>
  useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.summary })

export const useDashboardMetrics = (q?: MetricsQuery) =>
  useQuery({ queryKey: ['dashboard', 'metrics', q], queryFn: () => dashboardApi.metrics(q) })

export const useRooms = (q: RoomListQuery) =>
  useQuery({ queryKey: ['rooms', q], queryFn: () => roomsApi.list(q) })

export const useRoom = (roomId: number) =>
  useQuery({ queryKey: ['room', roomId], queryFn: () => roomsApi.detail(roomId), enabled: !!roomId })

// 무한 스크롤: 서버의 page 를 올려 가며 이어 붙인다. 조건(q)이 바뀌면 처음부터
export const useRoomActivities = (roomId: number, q: Omit<RoomActivityQuery, 'page'>, enabled = true) =>
  useInfiniteQuery({
    queryKey: ['room', roomId, 'activities', q],
    queryFn: ({ pageParam }) => roomsApi.activities(roomId, { ...q, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page.page + 1 < last.page.total_pages ? last.page.page + 1 : undefined),
    enabled: roomId > 0 && enabled,
  })

export const useRoomActivitySummary = (roomId: number, q: Pick<RoomActivityQuery, 'day' | 'userId'>) =>
  useQuery({ queryKey: ['room', roomId, 'activity-summary', q], queryFn: () => roomsApi.activitySummary(roomId, q), enabled: roomId > 0 })

// 초대코드 목록 (SUPER·OPERATOR) — enabled로 CS/권한없음 시 미호출
export const useRoomInvites = (roomId: number, enabled = true) =>
  useQuery({
    queryKey: ['room', roomId, 'invites'],
    queryFn: () => roomsApi.invites(roomId),
    enabled: !!roomId && enabled,
  })

// 방 쓰기 mutation
export const useUpdateRoomType = (roomId: number) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (isTest: boolean) => roomsApi.updateType(roomId, isTest),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['room', roomId] }),
      qc.invalidateQueries({ queryKey: ['rooms'] }),
    ]),
  })
}

export const useRoomGroups = () => useQuery({
  queryKey: ['room-groups'],
  queryFn: async () => {
    const groups: import('./types').RoomGroup[] = []
    for (let page = 0; ; page++) {
      const result = await roomsApi.groups(page)
      groups.push(...result.content)
      if (page + 1 >= result.page.total_pages) return groups
    }
  },
})
export const useAssignRoomOrganization = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: roomsApi.assignOrganization,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['rooms'] }), qc.invalidateQueries({ queryKey: ['room'] })]),
  })
}
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

// ===== 방 미션·안내 =====
export interface RoomMissionRow {
  mission: RoomMission
  announcements: MissionAnnouncement[]
}
const PAGE = 100
// 커서(next_cursor)가 끝날 때까지 이어 받는다
async function fetchRoomMissions(roomId: number): Promise<RoomMissionRow[]> {
  const missions: RoomMission[] = []
  for (let after: number | undefined; ; ) {
    const page = await roomMissionsApi.list(roomId, { after, size: PAGE })
    missions.push(...page.missions)
    if (page.next_cursor == null) break
    after = page.next_cursor
  }
  return Promise.all(
    missions.map(async (mission) => {
      const announcements: MissionAnnouncement[] = []
      for (let after: number | undefined; ; ) {
        const page = await roomMissionsApi.announcements(roomId, mission.mission_id, { after, size: PAGE })
        announcements.push(...page.announcements)
        if (page.next_cursor == null) break
        after = page.next_cursor
      }
      return { mission, announcements }
    }),
  )
}
// 예약 미션이나 예약/발송중 안내가 있을 때만 15초 폴링 (상태는 app 1분 잡이 바꿈)
export const useRoomMissions = (roomId: number) =>
  useQuery({
    queryKey: ['room-missions', roomId],
    queryFn: () => fetchRoomMissions(roomId),
    enabled: roomId > 0,
    refetchInterval: (query) =>
      query.state.data?.some(
        (r) =>
          r.mission.status === 'SCHEDULED' ||
          r.announcements.some((a) => a.status === 'SCHEDULED' || a.status === 'SENDING'),
      )
        ? 15000
        : false,
  })

const useMissionMutation = <V,>(roomId: number, fn: (v: V) => Promise<unknown>) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['room-missions', roomId] }),
  })
}
export const useCreateMission = (roomId: number) =>
  useMissionMutation(roomId, (body: RoomMissionBody) => roomMissionsApi.create(roomId, body))
export const useUpdateMission = (roomId: number) =>
  useMissionMutation(roomId, ({ missionId, body }: { missionId: number; body: RoomMissionBody }) =>
    roomMissionsApi.update(roomId, missionId, body),
  )
export const useCancelMission = (roomId: number) =>
  useMissionMutation(roomId, (missionId: number) => roomMissionsApi.cancel(roomId, missionId))

type AnnouncementRef = { missionId: number; id: number }
export const useCreateAnnouncement = (roomId: number) =>
  useMissionMutation(roomId, ({ missionId, body }: { missionId: number; body: AnnouncementBody }) =>
    roomMissionsApi.createAnnouncement(roomId, missionId, body),
  )
export const useUpdateAnnouncement = (roomId: number) =>
  useMissionMutation(roomId, ({ missionId, id, body }: AnnouncementRef & { body: AnnouncementBody }) =>
    roomMissionsApi.updateAnnouncement(roomId, missionId, id, body),
  )
export const useSendAnnouncementNow = (roomId: number) =>
  useMissionMutation(roomId, ({ missionId, id }: AnnouncementRef) =>
    roomMissionsApi.sendAnnouncementNow(roomId, missionId, id),
  )
export const useCancelAnnouncement = (roomId: number) =>
  useMissionMutation(roomId, ({ missionId, id }: AnnouncementRef) =>
    roomMissionsApi.cancelAnnouncement(roomId, missionId, id),
  )
export const useDeleteAnnouncementMessage = (roomId: number) =>
  useMissionMutation(roomId, ({ missionId, id }: AnnouncementRef) =>
    roomMissionsApi.deleteAnnouncementMessage(roomId, missionId, id),
  )

export const useUploadMissionImage = () => useMutation({ mutationFn: (file: File) => missionImagesApi.upload(file) })

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

// ===== 데모 접근 코드 =====
export const useDemoCode = (enabled = true) =>
  useQuery({ queryKey: ['demo', 'access-code'], queryFn: demoApi.getCode, enabled })

export const useSetDemoCode = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SetDemoCodeBody) => demoApi.setCode(body),
    onSuccess: (data) => qc.setQueryData(['demo', 'access-code'], data),
  })
}

export const useAppUpdatePolicy = () => useQuery({ queryKey: ['app-update-policy'], queryFn: appUpdatePolicyApi.get })
export const useAppUpdatePolicyHistory = () => useQuery({ queryKey: ['app-update-policy-history'], queryFn: appUpdatePolicyApi.history })
export function useUpdateAppUpdatePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateAppUpdatePolicyBody) => appUpdatePolicyApi.update(body),
    onSuccess: (data) => {
      qc.setQueryData(['app-update-policy'], data)
      void qc.invalidateQueries({ queryKey: ['app-update-policy-history'] })
    },
  })
}
