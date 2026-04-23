import type {
  CastingTimeUnitCode,
  SpellComponent,
  SpellAttribute,
  SUBJECT,
  AuthoredRecordStatus
} from '#core'
import type {
  EffectAuthored
} from '#authored'

export type CastingTimeAuthored = {
  unit: CastingTimeUnitCode
  amount: number
}

export type SpellAuthored = {
  kind: typeof SUBJECT.SPELL
  id: string
  label: string
  status?: AuthoredRecordStatus
  attributes?: SpellAttribute[]
  components?: SpellComponent[]
  description: string
  castingTime: CastingTimeAuthored
  effects?: EffectAuthored[]
  level: number // int
  classIds: string[]
  magicSchoolId: string
  materialDescription?: string
  userId: string
  systemId: string
}

