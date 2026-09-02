import type {
  MissionAttributeLevel,
  MissionGoal,
  ActivationChannel,
  InteractionScope,
  PreferenceLeakRisk,
  MissionPeriod,
} from '../api/types'

type Opt<T extends string> = { value: T; label: string }

export const ATTR_LEVELS: Opt<MissionAttributeLevel>[] = [
  { value: 'LOW', label: '낮음(LOW)' },
  { value: 'MEDIUM', label: '보통(MEDIUM)' },
  { value: 'HIGH', label: '높음(HIGH)' },
]
export const MISSION_GOALS: Opt<MissionGoal>[] = [
  { value: 'OBSERVATION', label: '관찰(OBSERVATION)' },
  { value: 'PREFERENCE', label: '취향(PREFERENCE)' },
  { value: 'MEANING', label: '이유(MEANING)' },
  { value: 'VALUE', label: '가치관(VALUE)' },
  { value: 'PERSONAL', label: '개인적(PERSONAL)' },
  { value: 'RELATIONAL', label: '관계적(RELATIONAL)' },
]
export const ACTIVATION_CHANNELS: Opt<ActivationChannel>[] = [
  { value: 'VIDEO', label: '영상(VIDEO)' },
  { value: 'GROUP_CHAT', label: '그룹채팅(GROUP_CHAT)' },
]
export const INTERACTION_SCOPES: Opt<InteractionScope>[] = [
  { value: 'SELF', label: '혼자(SELF)' },
  { value: 'GROUP', label: '그룹(GROUP)' },
  { value: 'SPECIFIC_MEMBER', label: '특정멤버(SPECIFIC_MEMBER)' },
]
export const PREFERENCE_LEAK_RISKS: Opt<PreferenceLeakRisk>[] = [
  { value: 'NONE', label: '없음(NONE)' },
  { value: 'LOW', label: '낮음(LOW)' },
  { value: 'HIGH', label: '높음(HIGH)' },
]

// 짧은 라벨 (목록 태그용)
export const GOAL_LABEL: Record<MissionGoal, string> = {
  OBSERVATION: '관찰',
  PREFERENCE: '취향',
  MEANING: '이유',
  VALUE: '가치관',
  PERSONAL: '개인적',
  RELATIONAL: '관계적',
}
export const ATTR_COLOR: Record<MissionAttributeLevel, string> = {
  LOW: 'default',
  MEDIUM: 'blue',
  HIGH: 'orange',
}
export const PERIOD_LABEL: Record<MissionPeriod, string> = { MORNING: '오전', AFTERNOON: '오후' }
export const PERIODS: MissionPeriod[] = ['MORNING', 'AFTERNOON']
export const DAYS = [1, 2, 3]
