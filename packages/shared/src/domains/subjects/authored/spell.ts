import type {
  CastingTimeUnitCode,
  SpellAttribute,
  SUBJECT
} from '#core'
import type {
  CapabilityAuthored,
  DurationAuthored,
  RangeAuthored,
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
  attributes?: SpellAttribute[]
  description: string
  castingTime: CastingTimeAuthored
  capabilities?: CapabilityAuthored[]
  /** @deprecated Transitional compatibility only; move spell delivery semantics into capability invocation. */
  range?: RangeAuthored
  /** @deprecated Transitional compatibility only; move spell lifetime semantics into branches/outcomes. */
  duration?: DurationAuthored
  level: number // int
  classIds: string[]
  magicSchoolId: string
  /** @deprecated Use capabilities. */
  effects?: EffectAuthored[]
  /** @deprecated Encode scaling structurally in capability outcomes. */
  atHigherLevels?: string
  materialDescription?: string
  userId: string
  systemId: string
}
