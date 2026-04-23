import type { EffectAuthored, NonManifestOutcomeAuthored, ShapeAuthored, SpeedAuthored } from '#authored'
import {
  ABILITY_CODE,
  EFFECT_KIND,
  MANIFEST_KIND,
  type ManifestKind,
  type NumericExpr,
  type SizeCode,
  type Trigger
} from '#core'

export type ManifestBehaviorAuthored<
  TTrigger extends Trigger = Trigger
> = EffectAuthored<TTrigger, NonManifestOutcomeAuthored>

export type ManifestNestedBehaviorAuthored<
  TTrigger extends Trigger = Trigger
> = ManifestBehaviorAuthored<TTrigger>

export const SUMMON_DAMAGEABILITY_KIND = {
  NORMAL: 'NORMAL',
  INVULNERABLE: 'INVULNERABLE',
  SPECIAL: 'SPECIAL'
} as const

export const SUMMON_VISIBILITY_KIND = {
  VISIBLE: 'VISIBLE',
  INVISIBLE: 'INVISIBLE',
  SPECIAL: 'SPECIAL'
} as const

export type SummonDamageabilityKind = keyof typeof SUMMON_DAMAGEABILITY_KIND
export type SummonVisibilityKind = keyof typeof SUMMON_VISIBILITY_KIND
export type SummonAbilityScoreCode = Exclude<keyof typeof ABILITY_CODE, 'SPELLCASTING'>

export type SummonStatBlockAuthored = {
  size?: SizeCode
  armorClass?: NumericExpr
  armorClassNote?: string
  hitPoints?: NumericExpr
  speeds?: SpeedAuthored[]
  abilityScores?: Partial<Record<SummonAbilityScoreCode, NumericExpr>>
  senses?: string[]
  passivePerception?: NumericExpr
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  conditionImmunities?: string[]
  damageabilityKind?: SummonDamageabilityKind
  visibilityKind?: SummonVisibilityKind
  occupiesSpace?: boolean
}

type ManifestAuthoredBase = {
  id: string
  effectKind: typeof EFFECT_KIND.MANIFEST
  label?: string
  shape?: ShapeAuthored
}

type CreatureManifestAuthored = ManifestAuthoredBase & {
  manifestKind: typeof MANIFEST_KIND.CREATURE
  creatureId?: string
  statBlock?: never
  behaviors?: never
}

type SummonManifestAuthored = ManifestAuthoredBase & {
  manifestKind: typeof MANIFEST_KIND.SUMMON
  creatureId?: never
  statBlock?: SummonStatBlockAuthored
  behaviors?: ManifestBehaviorAuthored[]
}

type NonCreatureManifestAuthored = ManifestAuthoredBase & {
  manifestKind: Exclude<ManifestKind, typeof MANIFEST_KIND.CREATURE | typeof MANIFEST_KIND.SUMMON>
  creatureId?: never
  statBlock?: never
  behaviors?: ManifestBehaviorAuthored[]
}

export type ManifestAuthored
  = | CreatureManifestAuthored
    | SummonManifestAuthored
    | NonCreatureManifestAuthored



