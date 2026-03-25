import type { CoreMeta, Trigger } from '#core'
import { TRIGGER } from '#core'
import { valuesOf } from '#utils'

export const BRANCH = {
  PASSIVE: 'PASSIVE',
  ON_USE: 'ON_USE',
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

export type BranchCode = keyof typeof BRANCH

export type BranchOption = CoreMeta<BranchCode>

export const BRANCH_REGISTRY: Record<BranchCode, BranchOption> = {
  [BRANCH.PASSIVE]: {
    code: BRANCH.PASSIVE,
    label: 'Passive',
    description: 'Continuously active without a triggering event.',
    tooltip: 'Always active.'
  },
  [BRANCH.ON_USE]: {
    code: BRANCH.ON_USE,
    label: 'On Use',
    description: 'Occurs when an activated capability is used successfully.',
    tooltip: 'When a capability is used.'
  },
  [BRANCH.ON_CAST]: {
    code: BRANCH.ON_CAST,
    label: 'On Cast',
    description: 'Occurs when a spell or magical effect is cast.',
    tooltip: 'When a spell is cast.'
  },
  [BRANCH.ON_ATTACK]: {
    code: BRANCH.ON_ATTACK,
    label: 'On Attack',
    description: 'Occurs when an attack is made.',
    tooltip: 'When an attack is made.'
  },
  [BRANCH.ON_HIT]: {
    code: BRANCH.ON_HIT,
    label: 'On Hit',
    description: 'Occurs when an attack successfully hits a target.',
    tooltip: 'When an attack hits.'
  },
  [BRANCH.ON_MISS]: {
    code: BRANCH.ON_MISS,
    label: 'On Miss',
    description: 'Occurs when an attack misses a target.',
    tooltip: 'When an attack misses.'
  },
  [BRANCH.ON_CRIT]: {
    code: BRANCH.ON_CRIT,
    label: 'On Critical Hit',
    description: 'Occurs when an attack results in a critical hit.',
    tooltip: 'On a critical hit.'
  },
  [BRANCH.ON_SAVE_FAIL]: {
    code: BRANCH.ON_SAVE_FAIL,
    label: 'On Save Failure',
    description: 'Occurs when a creature fails a saving throw.',
    tooltip: 'When a save fails.'
  },
  [BRANCH.ON_SAVE_SUCCESS]: {
    code: BRANCH.ON_SAVE_SUCCESS,
    label: 'On Save Success',
    description: 'Occurs when a creature succeeds on a saving throw.',
    tooltip: 'When a save succeeds.'
  },
  [BRANCH.START_OF_TURN]: {
    code: BRANCH.START_OF_TURN,
    label: 'Start of Turn',
    description: 'Occurs at the beginning of a creature\'s turn.',
    tooltip: 'At turn start.'
  },
  [BRANCH.END_OF_TURN]: {
    code: BRANCH.END_OF_TURN,
    label: 'End of Turn',
    description: 'Occurs at the end of a creature\'s turn.',
    tooltip: 'At turn end.'
  },
  [BRANCH.ON_MOVE]: {
    code: BRANCH.ON_MOVE,
    label: 'On Move',
    description: 'Occurs when a creature, player, or npc moves.',
    tooltip: 'When moving.'
  },
  [BRANCH.ON_HP_ZERO]: {
    code: BRANCH.ON_HP_ZERO,
    label: 'On HP Zero',
    description:
      'Occurs when a creature, player, or npc\'s hitpoints drop to zero.',
    tooltip: 'When hitpoints drop to zero.'
  }
} as const

export const BRANCH_OPTIONS = valuesOf(BRANCH_REGISTRY) as BranchOption[]

export const BRANCH_ROLL_TABLE_KIND = {
  RANGE: 'RANGE',
  EXACT: 'EXACT'
} as const

export type BranchRollTableKind = keyof typeof BRANCH_ROLL_TABLE_KIND

export type BranchRollTableKindOption = CoreMeta<BranchRollTableKind>

export const BRANCH_ROLL_TABLE_KIND_REGISTRY: Record<
  BranchRollTableKind,
  BranchRollTableKindOption
> = {
  [BRANCH_ROLL_TABLE_KIND.RANGE]: {
    code: BRANCH_ROLL_TABLE_KIND.RANGE,
    label: 'Range',
    description: 'Roll within a range of values.',
    tooltip: 'Range of rolls'
  },

  [BRANCH_ROLL_TABLE_KIND.EXACT]: {
    code: BRANCH_ROLL_TABLE_KIND.EXACT,
    label: 'Exact',
    description: 'Roll for an exact value.',
    tooltip: 'Exact roll value'
  }
}

export const BRANCH_ROLL_TABLE_KIND_OPTIONS = valuesOf(
  BRANCH_ROLL_TABLE_KIND_REGISTRY
) as BranchRollTableKindOption[]

export const BRANCH_RESOLUTION_KIND = {
  DIRECT: 'DIRECT',
  ROLL_TABLE: 'ROLL_TABLE'
} as const

export type BranchResolutionKind = keyof typeof BRANCH_RESOLUTION_KIND

export type BranchResolutionKindOption = CoreMeta<BranchResolutionKind>

export const BRANCH_RESOLUTION_KIND_REGISTRY: Record<
  BranchResolutionKind,
  BranchResolutionKindOption
> = {
  [BRANCH_RESOLUTION_KIND.DIRECT]: {
    code: BRANCH_RESOLUTION_KIND.DIRECT,
    label: 'Direct',
    description: 'Direct outcome without rolling to determine effect.',
    tooltip: 'Direct outcome'
  },

  [BRANCH_RESOLUTION_KIND.ROLL_TABLE]: {
    code: BRANCH_RESOLUTION_KIND.ROLL_TABLE,
    label: 'Roll Table',
    description: 'Outcome based on a roll table to determine effect.',
    tooltip: 'Roll table outcome'
  }
} as const

export const BRANCH_RESOLUTION_KIND_OPTIONS = valuesOf(
  BRANCH_RESOLUTION_KIND_REGISTRY
) as BranchResolutionKindOption[]

export const BRANCH_GROUP_TYPE = {
  SINGLE: 'SINGLE',
  CHOICE: 'CHOICE',
  SEQUENTIAL: 'SEQUENTIAL'
} as const

export type BranchGroupType = keyof typeof BRANCH_GROUP_TYPE

export type BranchGroupTypeOption = CoreMeta<BranchGroupType>

export const BRANCH_GROUP_TYPE_REGISTRY: Record<
  BranchGroupType,
  BranchGroupTypeOption
> = {
  [BRANCH_GROUP_TYPE.SINGLE]: {
    code: BRANCH_GROUP_TYPE.SINGLE,
    label: 'Single',
    description: 'Only a single effect outcome for this branch.',
    tooltip: 'Single effect outcome'
  },

  [BRANCH_GROUP_TYPE.CHOICE]: {
    code: BRANCH_GROUP_TYPE.CHOICE,
    label: 'Choice',
    description: 'Choice of effect outcomes for this branch.',
    tooltip: 'Choice of effect outcomes'
  },

  [BRANCH_GROUP_TYPE.SEQUENTIAL]: {
    code: BRANCH_GROUP_TYPE.SEQUENTIAL,
    label: 'Sequential',
    description:
      'Multiple effect outcomes that occur sequentially for this branch.',
    tooltip: 'Sequential effect outcomes'
  }
} as const

export const BRANCH_GROUP_TYPE_OPTIONS = valuesOf(
  BRANCH_GROUP_TYPE_REGISTRY
) as BranchGroupTypeOption[]

export const BRANCHES_BY_TRIGGER: Record<Trigger, readonly BranchCode[]> = {
  [TRIGGER.ACTIVATED]: [BRANCH.ON_USE],
  [TRIGGER.MELEE_WEAPON_ATTACK]: [
    BRANCH.ON_ATTACK,
    BRANCH.ON_HIT,
    BRANCH.ON_MISS,
    BRANCH.ON_CRIT
  ],
  [TRIGGER.UNARMED_ATTACK]: [
    BRANCH.ON_ATTACK,
    BRANCH.ON_HIT,
    BRANCH.ON_MISS,
    BRANCH.ON_CRIT
  ],
  [TRIGGER.RANGED_WEAPON_ATTACK]: [
    BRANCH.ON_ATTACK,
    BRANCH.ON_HIT,
    BRANCH.ON_MISS,
    BRANCH.ON_CRIT
  ],
  [TRIGGER.SPELL_ATTACK]: [
    BRANCH.ON_ATTACK,
    BRANCH.ON_HIT,
    BRANCH.ON_MISS,
    BRANCH.ON_CRIT
  ],
  [TRIGGER.SAVING_THROW]: [BRANCH.ON_SAVE_FAIL, BRANCH.ON_SAVE_SUCCESS],
  [TRIGGER.ENTER_AREA]: [BRANCH.PASSIVE]
} as const

export type BranchesByTrigger<TTrigger extends Trigger>
  = (typeof BRANCHES_BY_TRIGGER)[TTrigger][number]

export const BRANCH_LIFECYCLE_RECURRING_KIND = {
  NONE: 'NONE',
  START_OF_TURN: 'START_OF_TURN',
  END_OF_TURN: 'END_OF_TURN'
} as const

export type BranchLifecycleRecurringKind = keyof typeof BRANCH_LIFECYCLE_RECURRING_KIND

export type BranchLifecycleRecurringKindOption = CoreMeta<BranchLifecycleRecurringKind>

export const BRANCH_LIFECYCLE_RECURRING_KIND_REGISTRY: Record<
  BranchLifecycleRecurringKind,
  BranchLifecycleRecurringKindOption
> = {
  [BRANCH_LIFECYCLE_RECURRING_KIND.NONE]: {
    code: BRANCH_LIFECYCLE_RECURRING_KIND.NONE,
    label: 'None',
    description: 'No recurring lifecycle application.',
    tooltip: 'No recurrence.'
  },
  [BRANCH_LIFECYCLE_RECURRING_KIND.START_OF_TURN]: {
    code: BRANCH_LIFECYCLE_RECURRING_KIND.START_OF_TURN,
    label: 'Start Of Turn',
    description: 'Re-applies at the start of each turn while active.',
    tooltip: 'Recurring at turn start.'
  },
  [BRANCH_LIFECYCLE_RECURRING_KIND.END_OF_TURN]: {
    code: BRANCH_LIFECYCLE_RECURRING_KIND.END_OF_TURN,
    label: 'End Of Turn',
    description: 'Re-applies at the end of each turn while active.',
    tooltip: 'Recurring at turn end.'
  }
} as const

export const BRANCH_LIFECYCLE_RECURRING_KIND_OPTIONS = valuesOf(
  BRANCH_LIFECYCLE_RECURRING_KIND_REGISTRY
) as readonly BranchLifecycleRecurringKindOption[]

export const BRANCH_LIFECYCLE_CONSUME_EVENT = {
  ON_ATTACK_ROLL: 'ON_ATTACK_ROLL',
  ON_CAST_SPELL: 'ON_CAST_SPELL'
} as const

export type BranchLifecycleConsumeEvent = keyof typeof BRANCH_LIFECYCLE_CONSUME_EVENT

export type BranchLifecycleConsumeEventOption = CoreMeta<BranchLifecycleConsumeEvent>

export const BRANCH_LIFECYCLE_CONSUME_EVENT_REGISTRY: Record<
  BranchLifecycleConsumeEvent,
  BranchLifecycleConsumeEventOption
> = {
  [BRANCH_LIFECYCLE_CONSUME_EVENT.ON_ATTACK_ROLL]: {
    code: BRANCH_LIFECYCLE_CONSUME_EVENT.ON_ATTACK_ROLL,
    label: 'On Attack Roll',
    description: 'Consume the effect on the first attack roll event.',
    tooltip: 'Consumed by first attack roll.'
  },
  [BRANCH_LIFECYCLE_CONSUME_EVENT.ON_CAST_SPELL]: {
    code: BRANCH_LIFECYCLE_CONSUME_EVENT.ON_CAST_SPELL,
    label: 'On Cast Spell',
    description: 'Consume the effect on the first cast spell event.',
    tooltip: 'Consumed by first spell cast.'
  }
} as const

export const BRANCH_LIFECYCLE_CONSUME_EVENT_OPTIONS = valuesOf(
  BRANCH_LIFECYCLE_CONSUME_EVENT_REGISTRY
) as readonly BranchLifecycleConsumeEventOption[]

export const BRANCH_LIFECYCLE_END_EVENT = {
  ON_ATTACK_ROLL: 'ON_ATTACK_ROLL',
  ON_CAST_SPELL: 'ON_CAST_SPELL'
} as const

export type BranchLifecycleEndEvent = keyof typeof BRANCH_LIFECYCLE_END_EVENT

export type BranchLifecycleEndEventOption = CoreMeta<BranchLifecycleEndEvent>

export const BRANCH_LIFECYCLE_END_EVENT_REGISTRY: Record<
  BranchLifecycleEndEvent,
  BranchLifecycleEndEventOption
> = {
  [BRANCH_LIFECYCLE_END_EVENT.ON_ATTACK_ROLL]: {
    code: BRANCH_LIFECYCLE_END_EVENT.ON_ATTACK_ROLL,
    label: 'On Attack Roll',
    description: 'The effect ends when an attack roll event occurs.',
    tooltip: 'Ends on attack roll.'
  },
  [BRANCH_LIFECYCLE_END_EVENT.ON_CAST_SPELL]: {
    code: BRANCH_LIFECYCLE_END_EVENT.ON_CAST_SPELL,
    label: 'On Cast Spell',
    description: 'The effect ends when a spell cast event occurs.',
    tooltip: 'Ends on spell cast.'
  }
} as const

export const BRANCH_LIFECYCLE_END_EVENT_OPTIONS = valuesOf(
  BRANCH_LIFECYCLE_END_EVENT_REGISTRY
) as readonly BranchLifecycleEndEventOption[]
