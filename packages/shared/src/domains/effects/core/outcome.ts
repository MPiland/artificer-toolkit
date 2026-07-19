import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const EFFECT_KIND = {
  DAMAGE: 'DAMAGE',
  CONDITION: 'CONDITION',
  HEAL: 'HEAL',
  APPLY_GRANT: 'APPLY_GRANT',
  FORCED_MOVEMENT: 'FORCED_MOVEMENT',
  TELEPORT: 'TELEPORT',
  MANIFEST: 'MANIFEST',
  MOVE_MANIFEST: 'MOVE_MANIFEST',
  COMMAND_MANIFEST: 'COMMAND_MANIFEST',
  MANUAL_ADJUDICATION: 'MANUAL_ADJUDICATION'
} as const

export const MANIFEST_KIND = {
  CREATURE: 'CREATURE',
  SUMMON: 'SUMMON',
  ZONE: 'ZONE',
  SENSOR: 'SENSOR',
  WEAPON: 'WEAPON',
  OBJECT: 'OBJECT',
  ILLUSION: 'ILLUSION'
} as const

export type ManifestKind = keyof typeof MANIFEST_KIND
export type ManifestKindOption = CoreMeta<ManifestKind>

export const MANIFEST_KIND_REGISTRY: Record<ManifestKind, ManifestKindOption> = {
  [MANIFEST_KIND.CREATURE]: {
    code: MANIFEST_KIND.CREATURE,
    label: 'Creature',
    tooltip: 'Reference an existing creature record.',
    description: 'Reference an existing creature record.'
  },
  [MANIFEST_KIND.SUMMON]: {
    code: MANIFEST_KIND.SUMMON,
    label: 'Summon',
    tooltip: 'Create a bespoke summoned entity tied to this effect.',
    description: 'Create a bespoke summoned entity tied to this effect.'
  },
  [MANIFEST_KIND.ZONE]: {
    code: MANIFEST_KIND.ZONE,
    label: 'Zone',
    tooltip: 'Create a persistent area or field.',
    description: 'Create a persistent area or field.'
  },
  [MANIFEST_KIND.SENSOR]: {
    code: MANIFEST_KIND.SENSOR,
    label: 'Sensor',
    tooltip: 'Create a persistent magical sensor.',
    description: 'Create a persistent magical sensor.'
  },
  [MANIFEST_KIND.WEAPON]: {
    code: MANIFEST_KIND.WEAPON,
    label: 'Weapon',
    tooltip: 'Create a persistent manifested weapon.',
    description: 'Create a persistent manifested weapon.'
  },
  [MANIFEST_KIND.OBJECT]: {
    code: MANIFEST_KIND.OBJECT,
    label: 'Object',
    tooltip: 'Create a persistent manifested object.',
    description: 'Create a persistent manifested object.'
  },
  [MANIFEST_KIND.ILLUSION]: {
    code: MANIFEST_KIND.ILLUSION,
    label: 'Illusion',
    tooltip: 'Create a persistent manifested illusion.',
    description: 'Create a persistent manifested illusion.'
  }
} as const

export const MANIFEST_KIND_OPTIONS = valuesOf(
  MANIFEST_KIND_REGISTRY
) as readonly ManifestKindOption[]

export type EffectKind = keyof typeof EFFECT_KIND
export type NonManifestEffectKind = Exclude<EffectKind, typeof EFFECT_KIND.MANIFEST>

export type EffectKindOption = CoreMeta<EffectKind>

export const EFFECT_KIND_REGISTRY: Record<EffectKind, EffectKindOption> = {
  [EFFECT_KIND.DAMAGE]: {
    code: EFFECT_KIND.DAMAGE,
    label: 'Damage',
    tooltip: 'This effect deals damage.',
    description: 'This effect deals damage.'
  },
  [EFFECT_KIND.CONDITION]: {
    code: EFFECT_KIND.CONDITION,
    label: 'Condition',
    tooltip: 'This effect applies a condition.',
    description: 'This effect applies a condition.'
  },
  [EFFECT_KIND.HEAL]: {
    code: EFFECT_KIND.HEAL,
    label: 'Heal',
    tooltip: 'This effect restores hit points or grants temporary hit points.',
    description: 'This effect restores hit points or grants temporary hit points.'
  },
  [EFFECT_KIND.APPLY_GRANT]: {
    code: EFFECT_KIND.APPLY_GRANT,
    label: 'Apply Grant',
    tooltip: 'This effect applies one or more typed grants for a duration or trigger.',
    description: 'This effect applies one or more typed grants for a duration or trigger.'
  },
  [EFFECT_KIND.FORCED_MOVEMENT]: {
    code: EFFECT_KIND.FORCED_MOVEMENT,
    label: 'Forced Movement',
    tooltip: 'This effect compels movement with typed direction, distance, and action-economy usage.',
    description: 'This effect compels movement with typed direction, distance, and action-economy usage.'
  },
  [EFFECT_KIND.TELEPORT]: {
    code: EFFECT_KIND.TELEPORT,
    label: 'Teleport',
    tooltip: 'This effect repositions a creature.',
    description: 'This effect repositions a creature.'
  },
  [EFFECT_KIND.MANIFEST]: {
    code: EFFECT_KIND.MANIFEST,
    label: 'Manifest',
    tooltip: 'This effect creates a persistent manifested thing such as a summon, wall, cloud, or sensor.',
    description: 'This effect creates a persistent manifested thing such as a summon, wall, cloud, or sensor.'
  },
  [EFFECT_KIND.MOVE_MANIFEST]: {
    code: EFFECT_KIND.MOVE_MANIFEST,
    label: 'Move Manifest',
    tooltip: 'This effect repositions a previously created manifestation.',
    description: 'This effect repositions a previously created manifestation.'
  },
  [EFFECT_KIND.COMMAND_MANIFEST]: {
    code: EFFECT_KIND.COMMAND_MANIFEST,
    label: 'Command Manifest',
    tooltip: 'This effect commands a previously created manifestation to use one of its behaviors.',
    description: 'This effect commands a previously created manifestation to use one of its behaviors.'
  },
  [EFFECT_KIND.MANUAL_ADJUDICATION]: {
    code: EFFECT_KIND.MANUAL_ADJUDICATION,
    label: 'Manual Adjudication',
    tooltip: 'This outcome is descriptive and must be resolved by a player or GM.',
    description: 'Marks behavior the engine intentionally does not automate.'
  }
} as const

export const EFFECT_KIND_OPTIONS = valuesOf(
  EFFECT_KIND_REGISTRY
) as readonly EffectKindOption[]

export const NON_MANIFEST_EFFECT_KIND_OPTIONS = EFFECT_KIND_OPTIONS.filter(
  (option): option is CoreMeta<NonManifestEffectKind> => option.code !== EFFECT_KIND.MANIFEST
)
