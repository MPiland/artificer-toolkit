import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'
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
