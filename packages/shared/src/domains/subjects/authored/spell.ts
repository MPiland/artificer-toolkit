import type {
  CastingTimeUnitCode,
  SpellAttribute,
  SUBJECT
} from '#core'
import type { EffectAuthored } from '#authored'

export type CastingTimeAuthored = {
  unit: CastingTimeUnitCode
  amount: number
}

export type SpellAuthored = {
  kind: typeof SUBJECT.SPELL
  id: string
  label: string
  attributes?: SpellAttribute[]
  description: string
  castingTime: CastingTimeAuthored
  level: number // int
  classIds: string[]
  magicSchoolId: string
  effects?: EffectAuthored[]
  materialDescription?: string
  userId: string
  systemId: string
}
