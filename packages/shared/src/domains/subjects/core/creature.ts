import { type CoreMeta } from '#core'
import { valuesOf } from '#utils'

/** An attack trait that ignores a qualified damage defense ("from nonmagical attacks ..."). */
export const DAMAGE_DEFENSE_BYPASS_CODE = {
  MAGICAL: 'MAGICAL',
  SILVERED: 'SILVERED',
  ADAMANTINE: 'ADAMANTINE'
} as const

export type DamageDefenseBypassCode = keyof typeof DAMAGE_DEFENSE_BYPASS_CODE

export const DAMAGE_DEFENSE_BYPASS_OPTIONS: readonly CoreMeta<DamageDefenseBypassCode>[] = [
  { code: DAMAGE_DEFENSE_BYPASS_CODE.MAGICAL, label: 'Magical' },
  { code: DAMAGE_DEFENSE_BYPASS_CODE.SILVERED, label: 'Silvered' },
  { code: DAMAGE_DEFENSE_BYPASS_CODE.ADAMANTINE, label: 'Adamantine' }
]

export const CREATURE_CATEGORY_CODE = {
  NPC: 'NPC',
  MONSTER: 'MONSTER',
  BEAST: 'BEAST',
  COMPANION: 'COMPANION',
  SUMMON: 'SUMMON'
} as const

export type CreatureCategoryCode = keyof typeof CREATURE_CATEGORY_CODE

export type CreatureCategoryOption = CoreMeta<CreatureCategoryCode>

export const CREATURE_CATEGORY_REGISTRY: Record<CreatureCategoryCode, CreatureCategoryOption> = {
  [CREATURE_CATEGORY_CODE.NPC]: {
    code: CREATURE_CATEGORY_CODE.NPC,
    label: 'NPC',
    description: 'A named non-player character with personality, bonds, and flaws.'
  },
  [CREATURE_CATEGORY_CODE.MONSTER]: {
    code: CREATURE_CATEGORY_CODE.MONSTER,
    label: 'Monster',
    description: 'A DM-facing stat block intended for combat encounters.'
  },
  [CREATURE_CATEGORY_CODE.BEAST]: {
    code: CREATURE_CATEGORY_CODE.BEAST,
    label: 'Beast',
    description: 'A natural animal creature — often used as mounts, companions, or wild encounters.'
  },
  [CREATURE_CATEGORY_CODE.COMPANION]: {
    code: CREATURE_CATEGORY_CODE.COMPANION,
    label: 'Companion',
    description: 'A creature bound to a PC — familiars, animal companions, and similar.'
  },
  [CREATURE_CATEGORY_CODE.SUMMON]: {
    code: CREATURE_CATEGORY_CODE.SUMMON,
    label: 'Summon',
    description: 'A conjured or summoned creature under temporary control.'
  }
} as const

export const CREATURE_CATEGORY_OPTIONS = valuesOf(
  CREATURE_CATEGORY_REGISTRY
) as readonly CreatureCategoryOption[]

export const CREATURE_MOUNT_TYPE_CODE = {
  CONTROLLED: 'CONTROLLED',
  INDEPENDENT: 'INDEPENDENT'
} as const

export type CreatureMountTypeCode = keyof typeof CREATURE_MOUNT_TYPE_CODE

export const CREATURE_COMPANION_BOND_TYPE_CODE = {
  FAMILIAR: 'FAMILIAR',
  ANIMAL_COMPANION: 'ANIMAL_COMPANION',
  SUMMON: 'SUMMON'
} as const

export type CreatureCompanionBondTypeCode = keyof typeof CREATURE_COMPANION_BOND_TYPE_CODE

export const CREATURE_INITIATIVE_MODE_CODE = {
  USES_PC_INITIATIVE: 'USES_PC_INITIATIVE',
  OWN_INITIATIVE: 'OWN_INITIATIVE'
} as const

export type CreatureInitiativeModeCode = keyof typeof CREATURE_INITIATIVE_MODE_CODE
