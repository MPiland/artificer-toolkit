import type { CoreMeta, Trigger } from '#core'
import { TRIGGER } from '#core'

export const MOMENT = {
  PASSIVE: 'PASSIVE',
  ON_CAST: 'ON_CAST',
  ON_ATTACK: 'ON_ATTACK',
  ON_HIT: 'ON_HIT',
  ON_CRIT: 'ON_CRIT',
  ON_SAVE_FAIL: 'ON_SAVE_FAIL',
  ON_SAVE_SUCCESS: 'ON_SAVE_SUCCESS',
  START_OF_TURN: 'START_OF_TURN',
  END_OF_TURN: 'END_OF_TURN',
  ON_MOVE: 'ON_MOVE',
  ON_HP_ZERO: 'ON_HP_ZERO',
  ON_MISS: 'ON_MISS'
} as const

export type MomentCode = keyof typeof MOMENT

export type MomentOption = CoreMeta<MomentCode>

export const MOMENT_REGISTRY: Record<MomentCode, MomentOption> = {
  [MOMENT.PASSIVE]: {
    code: MOMENT.PASSIVE,
    label: 'Passive',
    description: 'Continuously active without a triggering event.',
    tooltip: 'Always active.'
  },
  [MOMENT.ON_CAST]: {
    code: MOMENT.ON_CAST,
    label: 'On Cast',
    description: 'Occurs when a spell or magical effect is cast.',
    tooltip: 'When a spell is cast.'
  },
  [MOMENT.ON_ATTACK]: {
    code: MOMENT.ON_ATTACK,
    label: 'On Attack',
    description: 'Occurs when an attack is made.',
    tooltip: 'When an attack is made.'
  },
  [MOMENT.ON_HIT]: {
    code: MOMENT.ON_HIT,
    label: 'On Hit',
    description: 'Occurs when an attack successfully hits a target.',
    tooltip: 'When an attack hits.'
  },
  [MOMENT.ON_MISS]: {
    code: MOMENT.ON_MISS,
    label: 'On Miss',
    description: 'Occurs when an attack misses a target.',
    tooltip: 'When an attack misses.'
  },
  [MOMENT.ON_CRIT]: {
    code: MOMENT.ON_CRIT,
    label: 'On Critical Hit',
    description: 'Occurs when an attack results in a critical hit.',
    tooltip: 'On a critical hit.'
  },
  [MOMENT.ON_SAVE_FAIL]: {
    code: MOMENT.ON_SAVE_FAIL,
    label: 'On Save Failure',
    description: 'Occurs when a creature fails a saving throw.',
    tooltip: 'When a save fails.'
  },
  [MOMENT.ON_SAVE_SUCCESS]: {
    code: MOMENT.ON_SAVE_SUCCESS,
    label: 'On Save Success',
    description: 'Occurs when a creature succeeds on a saving throw.',
    tooltip: 'When a save succeeds.'
  },
  [MOMENT.START_OF_TURN]: {
    code: MOMENT.START_OF_TURN,
    label: 'Start of Turn',
    description: 'Occurs at the beginning of a creature\'s turn.',
    tooltip: 'At turn start.'
  },
  [MOMENT.END_OF_TURN]: {
    code: MOMENT.END_OF_TURN,
    label: 'End of Turn',
    description: 'Occurs at the end of a creature\'s turn.',
    tooltip: 'At turn end.'
  },
  [MOMENT.ON_MOVE]: {
    code: MOMENT.ON_MOVE,
    label: 'On Move',
    description: 'Occurs when a creature, player, or npc moves.',
    tooltip: 'When moving.'
  },
  [MOMENT.ON_HP_ZERO]: {
    code: MOMENT.ON_HP_ZERO,
    label: 'On HP Zero',
    description:
      'Occurs when a creature, player, or npc\'s hitpoints drop to zero.',
    tooltip: 'When hitpoints drop to zero.'
  }
} as const

export const MOMENT_OPTIONS = Object.values(MOMENT_REGISTRY) as MomentOption[]

export const MOMENT_ROLL_TABLE_KIND = {
  RANGE: 'RANGE',
  EXACT: 'EXACT'
} as const

export type MomentRollTableKind = keyof typeof MOMENT_ROLL_TABLE_KIND

export type MomentRollTableKindOption = CoreMeta<MomentRollTableKind>

export const MOMENT_ROLL_TABLE_KIND_REGISTRY: Record<
  MomentRollTableKind,
  MomentRollTableKindOption
> = {
  [MOMENT_ROLL_TABLE_KIND.RANGE]: {
    code: MOMENT_ROLL_TABLE_KIND.RANGE,
    label: 'Range',
    description: 'Roll within a range of values.',
    tooltip: 'Range of rolls'
  },

  [MOMENT_ROLL_TABLE_KIND.EXACT]: {
    code: MOMENT_ROLL_TABLE_KIND.EXACT,
    label: 'Exact',
    description: 'Roll for an exact value.',
    tooltip: 'Exact roll value'
  }
}

export const MOMENT_ROLL_TABLE_KIND_OPTIONS = Object.values(
  MOMENT_ROLL_TABLE_KIND_REGISTRY
) as MomentRollTableKindOption[]

export const MOMENT_RESOLUTION_KIND = {
  DIRECT: 'DIRECT',
  ROLL_TABLE: 'ROLL_TABLE'
} as const

export type MomentResolutionKind = keyof typeof MOMENT_RESOLUTION_KIND

export type MomentResolutionKindOption = CoreMeta<MomentResolutionKind>

export const MOMENT_RESOLUTION_KIND_REGISTRY: Record<
  MomentResolutionKind,
  MomentResolutionKindOption
> = {
  [MOMENT_RESOLUTION_KIND.DIRECT]: {
    code: MOMENT_RESOLUTION_KIND.DIRECT,
    label: 'Direct',
    description: 'Direct outcome without rolling to determine effect.',
    tooltip: 'Direct outcome'
  },

  [MOMENT_RESOLUTION_KIND.ROLL_TABLE]: {
    code: MOMENT_RESOLUTION_KIND.ROLL_TABLE,
    label: 'Roll Table',
    description: 'Outcome based on a roll table to determine effect.',
    tooltip: 'Roll table outcome'
  }
} as const

export const MOMENT_RESOLUTION_KIND_OPTIONS = Object.values(
  MOMENT_RESOLUTION_KIND_REGISTRY
) as MomentResolutionKindOption[]

export const MOMENT_GROUP_TYPE = {
  SINGLE: 'SINGLE',
  CHOICE: 'CHOICE',
  SEQUENTIAL: 'SEQUENTIAL'
} as const

export type MomentGroupType = keyof typeof MOMENT_GROUP_TYPE

export type MomentGroupTypeOption = CoreMeta<MomentGroupType>

export const MOMENT_GROUP_TYPE_REGISTRY: Record<
  MomentGroupType,
  MomentGroupTypeOption
> = {
  [MOMENT_GROUP_TYPE.SINGLE]: {
    code: MOMENT_GROUP_TYPE.SINGLE,
    label: 'Single',
    description: 'Only a single effect outcome for this moment.',
    tooltip: 'Single effect outcome'
  },

  [MOMENT_GROUP_TYPE.CHOICE]: {
    code: MOMENT_GROUP_TYPE.CHOICE,
    label: 'Choice',
    description: 'Choice of effect outcomes for this moment.',
    tooltip: 'Choice of effect outcomes'
  },

  [MOMENT_GROUP_TYPE.SEQUENTIAL]: {
    code: MOMENT_GROUP_TYPE.SEQUENTIAL,
    label: 'Sequential',
    description:
      'Multiple effect outcomes that occur sequentially for this moment.',
    tooltip: 'Sequential effect outcomes'
  }
} as const

export const MOMENT_GROUP_TYPE_OPTIONS = Object.values(
  MOMENT_GROUP_TYPE_REGISTRY
) as MomentGroupTypeOption[]

export const MOMENTS_BY_TRIGGER: Record<Trigger, readonly MomentCode[]> = {
  [TRIGGER.MELEE_WEAPON_ATTACK]: [
    MOMENT.ON_ATTACK,
    MOMENT.ON_HIT,
    MOMENT.ON_MISS,
    MOMENT.ON_CRIT
  ],
  [TRIGGER.UNARMED_ATTACK]: [
    MOMENT.ON_ATTACK,
    MOMENT.ON_HIT,
    MOMENT.ON_MISS,
    MOMENT.ON_CRIT
  ],
  [TRIGGER.RANGED_WEAPON_ATTACK]: [
    MOMENT.ON_ATTACK,
    MOMENT.ON_HIT,
    MOMENT.ON_MISS,
    MOMENT.ON_CRIT
  ],
  [TRIGGER.SPELL_ATTACK]: [
    MOMENT.ON_ATTACK,
    MOMENT.ON_HIT,
    MOMENT.ON_MISS,
    MOMENT.ON_CRIT
  ],
  [TRIGGER.SAVING_THROW]: [MOMENT.ON_SAVE_FAIL, MOMENT.ON_SAVE_SUCCESS],
  [TRIGGER.ENTER_AREA]: [MOMENT.PASSIVE]
} as const

export type MomentsByTrigger<TTrigger extends Trigger>
  = (typeof MOMENTS_BY_TRIGGER)[TTrigger][number]
