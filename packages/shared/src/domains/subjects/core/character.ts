import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const CHARACTER_ABILITY_GENERATION_METHOD = {
  STANDARD_ARRAY: 'STANDARD_ARRAY',
  POINT_BUY: 'POINT_BUY',
  MANUAL_ROLLED: 'MANUAL_ROLLED'
} as const

export type CharacterAbilityGenerationMethod = keyof typeof CHARACTER_ABILITY_GENERATION_METHOD

export type CharacterAbilityGenerationMethodOption = CoreMeta<CharacterAbilityGenerationMethod>

export const ABILITY_GENERATION_METHOD_REGISTRY: Record<
  CharacterAbilityGenerationMethod,
  CharacterAbilityGenerationMethodOption
> = {
  [CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY]: {
    code: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
    label: 'Standard Array'
  },

  [CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY]: {
    code: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
    label: 'Point Buy'
  },

  [CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED]: {
    code: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
    label: 'Manual / Rolled'
  }
} as const

export const CHARACTER_ABILITY_GENERATION_METHOD_OPTIONS = valuesOf(
  ABILITY_GENERATION_METHOD_REGISTRY
) as readonly CharacterAbilityGenerationMethodOption[]

export const STANDARD_ARRAY_SCORES = ['8', '10', '12', '13', '14', '15'] as const

export type StandardArrayScore = (typeof STANDARD_ARRAY_SCORES)[number]

export type StandardArrayScoreOption = CoreMeta<StandardArrayScore>

export const STANDARD_ARRAY_SCORE_REGISTRY: Record<StandardArrayScore, StandardArrayScoreOption> = {
  ['8']: {
    code: '8',
    label: '8'
  },

  ['10']: {
    code: '10',
    label: '10'
  },

  ['12']: {
    code: '12',
    label: '12'
  },

  ['13']: {
    code: '13',
    label: '13'
  },

  ['14']: {
    code: '14',
    label: '14'
  },

  ['15']: {
    code: '15',
    label: '15'
  }
} as const

export const STANDARD_ARRAY_SCORE_OPTIONS = [...valuesOf(STANDARD_ARRAY_SCORE_REGISTRY)].sort(
  (a, b) => Number(a.code) - Number(b.code)
) as readonly StandardArrayScoreOption[]

export const POINT_BUY_SCORES = ['8', '9', '10', '11', '12', '13', '14', '15'] as const

export type PointBuyScore = (typeof POINT_BUY_SCORES)[number]

export type PointBuyScoreOption = CoreMeta<PointBuyScore> & { cost: number }

export const POINT_BUY_SCORE_REGISTRY: Record<PointBuyScore, PointBuyScoreOption> = {
  ['8']: {
    code: '8',
    label: '8',
    cost: 0
  },

  ['9']: {
    code: '9',
    label: '9',
    cost: 1
  },

  ['10']: {
    code: '10',
    label: '10',
    cost: 2
  },

  ['11']: {
    code: '11',
    label: '11',
    cost: 3
  },

  ['12']: {
    code: '12',
    label: '12',
    cost: 4
  },

  ['13']: {
    code: '13',
    label: '13',
    cost: 5
  },

  ['14']: {
    code: '14',
    label: '14',
    cost: 7
  },

  ['15']: {
    code: '15',
    label: '15',
    cost: 9
  }
} as const

export const POINT_BUY_SCORE_OPTIONS = [...valuesOf(POINT_BUY_SCORE_REGISTRY)].sort(
  (a, b) => Number(a.code) - Number(b.code)
) as readonly PointBuyScoreOption[]

export const POINT_BUY_TOTAL_POINTS = 27 as const

export const ADVANCEMENT_METHOD_CODE = {
  MILESTONE: 'MILESTONE',
  EXPERIENCE: 'EXPERIENCE'
} as const

export type AdvancementMethodCode = keyof typeof ADVANCEMENT_METHOD_CODE

export type AdvancementMethodOption = CoreMeta<AdvancementMethodCode>

export const ADVANCEMENT_METHOD_REGISTRY: Record<AdvancementMethodCode, AdvancementMethodOption> = {
  [ADVANCEMENT_METHOD_CODE.MILESTONE]: {
    code: ADVANCEMENT_METHOD_CODE.MILESTONE,
    label: 'Milestone'
  },

  [ADVANCEMENT_METHOD_CODE.EXPERIENCE]: {
    code: ADVANCEMENT_METHOD_CODE.EXPERIENCE,
    label: 'Experience'
  }
} as const

export const ADVANCEMENT_METHOD_OPTIONS = valuesOf(
  ADVANCEMENT_METHOD_REGISTRY
) as readonly AdvancementMethodOption[]

export const HITPOINT_CALCULATION_METHOD_CODE = {
  FIXED: 'FIXED',
  MANUAL: 'MANUAL'
} as const

export type HitpointCalculationMethodCode = keyof typeof HITPOINT_CALCULATION_METHOD_CODE

export type HitpointCalculationMethodOption = CoreMeta<HitpointCalculationMethodCode>

export const HITPOINT_CALC_METHOD_REGISTRY: Record<
  HitpointCalculationMethodCode,
  HitpointCalculationMethodOption
> = {
  [HITPOINT_CALCULATION_METHOD_CODE.FIXED]: {
    code: HITPOINT_CALCULATION_METHOD_CODE.FIXED,
    label: 'Fixed'
  },

  [HITPOINT_CALCULATION_METHOD_CODE.MANUAL]: {
    code: HITPOINT_CALCULATION_METHOD_CODE.MANUAL,
    label: 'Manual'
  }
} as const

export const HITPOINT_CALC_METHOD_OPTIONS = valuesOf(
  HITPOINT_CALC_METHOD_REGISTRY
) as readonly HitpointCalculationMethodOption[]

export const CHARACTER_EXTRA_KIND_CODE = {
  COMPANION: 'COMPANION',
  MOUNT: 'MOUNT',
  OWNED: 'OWNED',
  VEHICLE: 'VEHICLE'
} as const

export type CharacterExtraKindCode = keyof typeof CHARACTER_EXTRA_KIND_CODE

export type CharacterExtraKindOption = CoreMeta<CharacterExtraKindCode>

export const CHARACTER_EXTRA_KIND_REGISTRY: Record<
  CharacterExtraKindCode,
  CharacterExtraKindOption
> = {
  [CHARACTER_EXTRA_KIND_CODE.COMPANION]: {
    code: CHARACTER_EXTRA_KIND_CODE.COMPANION,
    label: 'Companion'
  },
  [CHARACTER_EXTRA_KIND_CODE.MOUNT]: {
    code: CHARACTER_EXTRA_KIND_CODE.MOUNT,
    label: 'Mount'
  },
  [CHARACTER_EXTRA_KIND_CODE.OWNED]: {
    code: CHARACTER_EXTRA_KIND_CODE.OWNED,
    label: 'Owned Creature'
  },
  [CHARACTER_EXTRA_KIND_CODE.VEHICLE]: {
    code: CHARACTER_EXTRA_KIND_CODE.VEHICLE,
    label: 'Vehicle'
  }
} as const

export const CHARACTER_EXTRA_KIND_OPTIONS = valuesOf(
  CHARACTER_EXTRA_KIND_REGISTRY
) as readonly CharacterExtraKindOption[]

export const CREATURE_RELATIONSHIP_KIND_CODE = {
  COMPANION: 'COMPANION',
  MOUNT: 'MOUNT',
  OWNED: 'OWNED'
} as const

export type CreatureRelationshipKindCode = keyof typeof CREATURE_RELATIONSHIP_KIND_CODE

export type CreatureRelationshipKindOption = CoreMeta<CreatureRelationshipKindCode>

export const CREATURE_RELATIONSHIP_KIND_REGISTRY: Record<
  CreatureRelationshipKindCode,
  CreatureRelationshipKindOption
> = {
  [CREATURE_RELATIONSHIP_KIND_CODE.COMPANION]: {
    code: CREATURE_RELATIONSHIP_KIND_CODE.COMPANION,
    label: 'Companion'
  },
  [CREATURE_RELATIONSHIP_KIND_CODE.MOUNT]: {
    code: CREATURE_RELATIONSHIP_KIND_CODE.MOUNT,
    label: 'Mount'
  },
  [CREATURE_RELATIONSHIP_KIND_CODE.OWNED]: {
    code: CREATURE_RELATIONSHIP_KIND_CODE.OWNED,
    label: 'Owned Creature'
  }
} as const

export const CREATURE_RELATIONSHIP_KIND_OPTIONS = valuesOf(
  CREATURE_RELATIONSHIP_KIND_REGISTRY
) as readonly CreatureRelationshipKindOption[]

export const CREATURE_ORIGIN_KIND_CODE = {
  WORLD: 'WORLD',
  SUMMONED: 'SUMMONED'
} as const

export type CreatureOriginKindCode = keyof typeof CREATURE_ORIGIN_KIND_CODE

export type CreatureOriginKindOption = CoreMeta<CreatureOriginKindCode>

export const CREATURE_ORIGIN_KIND_REGISTRY: Record<
  CreatureOriginKindCode,
  CreatureOriginKindOption
> = {
  [CREATURE_ORIGIN_KIND_CODE.WORLD]: {
    code: CREATURE_ORIGIN_KIND_CODE.WORLD,
    label: 'World'
  },
  [CREATURE_ORIGIN_KIND_CODE.SUMMONED]: {
    code: CREATURE_ORIGIN_KIND_CODE.SUMMONED,
    label: 'Summoned'
  }
} as const

export const CREATURE_ORIGIN_KIND_OPTIONS = valuesOf(
  CREATURE_ORIGIN_KIND_REGISTRY
) as readonly CreatureOriginKindOption[]
