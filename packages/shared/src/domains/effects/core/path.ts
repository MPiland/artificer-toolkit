import type { CoreMeta, Trigger } from '#core'
import { TRIGGER } from '#core'
import { valuesOf } from '#utils'

export const PATH_CODE = {
  PASSIVE: 'PASSIVE',
  ON_USE: 'ON_USE',
  ON_CAST: 'ON_CAST',
  ON_ATTACK: 'ON_ATTACK',
  ON_HIT: 'ON_HIT',
  ON_CRIT: 'ON_CRIT',
  ON_SAVE_FAIL: 'ON_SAVE_FAIL',
  ON_SAVE_SUCCESS: 'ON_SAVE_SUCCESS',
  ON_CHECK_SUCCESS: 'ON_CHECK_SUCCESS',
  START_OF_TURN: 'START_OF_TURN',
  END_OF_TURN: 'END_OF_TURN',
  ON_MOVE: 'ON_MOVE',
  ON_HP_ZERO: 'ON_HP_ZERO',
  ON_MISS: 'ON_MISS'
} as const

export type PathCode = keyof typeof PATH_CODE

export type PathCodeOption = CoreMeta<PathCode>

export const PATH_CODE_REGISTRY: Record<PathCode, PathCodeOption> = {
  [PATH_CODE.PASSIVE]: {
    code: PATH_CODE.PASSIVE,
    label: 'Passive',
    description: 'Always active.'
  },
  [PATH_CODE.ON_USE]: {
    code: PATH_CODE.ON_USE,
    label: 'On Use',
    description: 'When an effect is used.'
  },
  [PATH_CODE.ON_CAST]: {
    code: PATH_CODE.ON_CAST,
    label: 'On Cast',
    description: 'When a spell is cast.'
  },
  [PATH_CODE.ON_ATTACK]: {
    code: PATH_CODE.ON_ATTACK,
    label: 'On Attack',
    description: 'When an attack is made.'
  },
  [PATH_CODE.ON_HIT]: {
    code: PATH_CODE.ON_HIT,
    label: 'On Hit',
    description: 'When an attack hits.'
  },
  [PATH_CODE.ON_MISS]: {
    code: PATH_CODE.ON_MISS,
    label: 'On Miss',
    description: 'When an attack misses.'
  },
  [PATH_CODE.ON_CRIT]: {
    code: PATH_CODE.ON_CRIT,
    label: 'On Critical Hit',
    description: 'On a critical hit.'
  },
  [PATH_CODE.ON_SAVE_FAIL]: {
    code: PATH_CODE.ON_SAVE_FAIL,
    label: 'On Save Failure',
    description: 'When a save fails.'
  },
  [PATH_CODE.ON_SAVE_SUCCESS]: {
    code: PATH_CODE.ON_SAVE_SUCCESS,
    label: 'On Save Success',
    description: 'When a save succeeds.'
  },
  [PATH_CODE.ON_CHECK_SUCCESS]: {
    code: PATH_CODE.ON_CHECK_SUCCESS,
    label: 'On Check Success',
    description: 'When a check succeeds.'
  },
  [PATH_CODE.START_OF_TURN]: {
    code: PATH_CODE.START_OF_TURN,
    label: 'Start of Turn',
    description: 'At turn start.'
  },
  [PATH_CODE.END_OF_TURN]: {
    code: PATH_CODE.END_OF_TURN,
    label: 'End of Turn',
    description: 'At turn end.'
  },
  [PATH_CODE.ON_MOVE]: {
    code: PATH_CODE.ON_MOVE,
    label: 'On Move',
    description: 'When moving.'
  },
  [PATH_CODE.ON_HP_ZERO]: {
    code: PATH_CODE.ON_HP_ZERO,
    label: 'On HP Zero',
    description: 'When hit points drop to zero.'
  }
} as const

export const PATH_CODE_OPTIONS = valuesOf(PATH_CODE_REGISTRY) as PathCodeOption[]

export const PATH_ROLL_TABLE_KIND = {
  RANGE: 'RANGE',
  EXACT: 'EXACT'
} as const

export type PathRollTableKind = keyof typeof PATH_ROLL_TABLE_KIND

export type PathRollTableKindOption = CoreMeta<PathRollTableKind>

export const PATH_ROLL_TABLE_KIND_REGISTRY: Record<PathRollTableKind, PathRollTableKindOption> = {
  [PATH_ROLL_TABLE_KIND.RANGE]: {
    code: PATH_ROLL_TABLE_KIND.RANGE,
    label: 'Range',
    description: 'Range of rolls'
  },
  [PATH_ROLL_TABLE_KIND.EXACT]: {
    code: PATH_ROLL_TABLE_KIND.EXACT,
    label: 'Exact',
    description: 'Exact roll value'
  }
}

export const PATH_ROLL_TABLE_KIND_OPTIONS = valuesOf(
  PATH_ROLL_TABLE_KIND_REGISTRY
) as PathRollTableKindOption[]

export const PATH_RESOLUTION_KIND = {
  DIRECT: 'DIRECT',
  ROLL_TABLE: 'ROLL_TABLE',
  ROLL_TABLE_REPEAT: 'ROLL_TABLE_REPEAT'
} as const

export type PathResolutionKind = keyof typeof PATH_RESOLUTION_KIND

export type PathResolutionKindOption = CoreMeta<PathResolutionKind>

export const PATH_RESOLUTION_KIND_REGISTRY: Record<PathResolutionKind, PathResolutionKindOption> = {
  [PATH_RESOLUTION_KIND.DIRECT]: {
    code: PATH_RESOLUTION_KIND.DIRECT,
    label: 'Direct',
    description: 'Direct outcome'
  },
  [PATH_RESOLUTION_KIND.ROLL_TABLE]: {
    code: PATH_RESOLUTION_KIND.ROLL_TABLE,
    label: 'Roll Table',
    description: 'Roll table outcome'
  },
  [PATH_RESOLUTION_KIND.ROLL_TABLE_REPEAT]: {
    code: PATH_RESOLUTION_KIND.ROLL_TABLE_REPEAT,
    label: 'Repeat Roll Table',
    description: 'Repeat the current roll table'
  }
} as const

export const PATH_RESOLUTION_KIND_OPTIONS = valuesOf(
  PATH_RESOLUTION_KIND_REGISTRY
) as PathResolutionKindOption[]

export const PATH_GROUP_TYPE = {
  SINGLE: 'SINGLE',
  CHOICE: 'CHOICE',
  SEQUENTIAL: 'SEQUENTIAL'
} as const

export type PathGroupType = keyof typeof PATH_GROUP_TYPE

export type PathGroupTypeOption = CoreMeta<PathGroupType>

export const PATH_GROUP_TYPE_REGISTRY: Record<PathGroupType, PathGroupTypeOption> = {
  [PATH_GROUP_TYPE.SINGLE]: {
    code: PATH_GROUP_TYPE.SINGLE,
    label: 'Single',
    description: 'Single effect outcome'
  },
  [PATH_GROUP_TYPE.CHOICE]: {
    code: PATH_GROUP_TYPE.CHOICE,
    label: 'Choice',
    description: 'Choice of effect outcomes'
  },
  [PATH_GROUP_TYPE.SEQUENTIAL]: {
    code: PATH_GROUP_TYPE.SEQUENTIAL,
    label: 'Sequential',
    description: 'Sequential effect outcomes'
  }
} as const

export const PATH_GROUP_TYPE_OPTIONS = valuesOf(PATH_GROUP_TYPE_REGISTRY) as PathGroupTypeOption[]

export const PATH_ORIGIN_KIND = {
  SOURCE: 'SOURCE',
  PRIMARY_TARGET: 'PRIMARY_TARGET',
  PREVIOUS_ENTRY_TARGET: 'PREVIOUS_ENTRY_TARGET'
} as const

export type PathOriginKind = keyof typeof PATH_ORIGIN_KIND

export type PathOriginKindOption = CoreMeta<PathOriginKind>

export const PATH_ORIGIN_KIND_REGISTRY: Record<PathOriginKind, PathOriginKindOption> = {
  [PATH_ORIGIN_KIND.SOURCE]: {
    code: PATH_ORIGIN_KIND.SOURCE,
    label: 'Source',
    description: 'From the original source.'
  },
  [PATH_ORIGIN_KIND.PRIMARY_TARGET]: {
    code: PATH_ORIGIN_KIND.PRIMARY_TARGET,
    label: 'Primary Target',
    description: 'From the primary target.'
  },
  [PATH_ORIGIN_KIND.PREVIOUS_ENTRY_TARGET]: {
    code: PATH_ORIGIN_KIND.PREVIOUS_ENTRY_TARGET,
    label: 'Previous Entry Target',
    description: 'From the prior entry target.'
  }
} as const

export const PATH_ORIGIN_KIND_OPTIONS = valuesOf(
  PATH_ORIGIN_KIND_REGISTRY
) as readonly PathOriginKindOption[]

export const PATH_USAGE = {
  ONCE_PER_TURN: 'ONCE_PER_TURN'
} as const

export type PathUsage = keyof typeof PATH_USAGE

export type PathUsageOption = CoreMeta<PathUsage>

export const PATH_USAGE_REGISTRY: Record<PathUsage, PathUsageOption> = {
  [PATH_USAGE.ONCE_PER_TURN]: {
    code: PATH_USAGE.ONCE_PER_TURN,
    label: 'Once per Turn',
    description: 'Owed to one attack each turn, the first that qualifies.'
  }
} as const

export const PATH_USAGE_OPTIONS = valuesOf(PATH_USAGE_REGISTRY) as readonly PathUsageOption[]

export const PATH_CODES_BY_TRIGGER: Record<Trigger, readonly PathCode[]> = {
  [TRIGGER.ACTIVATED]: [PATH_CODE.ON_USE],
  [TRIGGER.MELEE_WEAPON_ATTACK]: [
    PATH_CODE.ON_ATTACK,
    PATH_CODE.ON_HIT,
    PATH_CODE.ON_MISS,
    PATH_CODE.ON_CRIT
  ],
  [TRIGGER.UNARMED_ATTACK]: [
    PATH_CODE.ON_ATTACK,
    PATH_CODE.ON_HIT,
    PATH_CODE.ON_MISS,
    PATH_CODE.ON_CRIT
  ],
  [TRIGGER.RANGED_WEAPON_ATTACK]: [
    PATH_CODE.ON_ATTACK,
    PATH_CODE.ON_HIT,
    PATH_CODE.ON_MISS,
    PATH_CODE.ON_CRIT
  ],
  [TRIGGER.MELEE_SPELL_ATTACK]: [
    PATH_CODE.ON_ATTACK,
    PATH_CODE.ON_HIT,
    PATH_CODE.ON_MISS,
    PATH_CODE.ON_CRIT
  ],
  [TRIGGER.RANGED_SPELL_ATTACK]: [
    PATH_CODE.ON_ATTACK,
    PATH_CODE.ON_HIT,
    PATH_CODE.ON_MISS,
    PATH_CODE.ON_CRIT
  ],
  [TRIGGER.INCOMING_SAVING_THROW]: [PATH_CODE.PASSIVE],
  [TRIGGER.SAVING_THROW]: [PATH_CODE.ON_SAVE_FAIL, PATH_CODE.ON_SAVE_SUCCESS],
  [TRIGGER.CHECK]: [PATH_CODE.ON_CHECK_SUCCESS],
  [TRIGGER.ENTER_AREA]: [PATH_CODE.PASSIVE],
  [TRIGGER.INCOMING_DAMAGE]: [PATH_CODE.PASSIVE],
  [TRIGGER.HP_ZERO]: [PATH_CODE.ON_SAVE_FAIL, PATH_CODE.ON_SAVE_SUCCESS],
  [TRIGGER.INCOMING_WEAPON_HIT]: [PATH_CODE.PASSIVE],
  [TRIGGER.ROLL_INITIATIVE]: [PATH_CODE.PASSIVE],
  [TRIGGER.START_OF_TURN]: [PATH_CODE.PASSIVE]
} as const

export type PathCodesByTrigger<TTrigger extends Trigger> =
  (typeof PATH_CODES_BY_TRIGGER)[TTrigger][number]

export const PATH_LIFECYCLE_RECURRING_KIND = {
  NONE: 'NONE',
  START_OF_TURN: 'START_OF_TURN',
  END_OF_TURN: 'END_OF_TURN'
} as const

export type PathLifecycleRecurringKind = keyof typeof PATH_LIFECYCLE_RECURRING_KIND

export type PathLifecycleRecurringKindOption = CoreMeta<PathLifecycleRecurringKind>

export const PATH_LIFECYCLE_RECURRING_KIND_REGISTRY: Record<
  PathLifecycleRecurringKind,
  PathLifecycleRecurringKindOption
> = {
  [PATH_LIFECYCLE_RECURRING_KIND.NONE]: {
    code: PATH_LIFECYCLE_RECURRING_KIND.NONE,
    label: 'None',
    description: 'No recurrence.'
  },
  [PATH_LIFECYCLE_RECURRING_KIND.START_OF_TURN]: {
    code: PATH_LIFECYCLE_RECURRING_KIND.START_OF_TURN,
    label: 'Start Of Turn',
    description: 'Recurring at turn start.'
  },
  [PATH_LIFECYCLE_RECURRING_KIND.END_OF_TURN]: {
    code: PATH_LIFECYCLE_RECURRING_KIND.END_OF_TURN,
    label: 'End Of Turn',
    description: 'Recurring at turn end.'
  }
} as const

export const PATH_LIFECYCLE_RECURRING_KIND_OPTIONS = valuesOf(
  PATH_LIFECYCLE_RECURRING_KIND_REGISTRY
) as readonly PathLifecycleRecurringKindOption[]

export const PATH_LIFECYCLE_TURN_ACTOR = {
  TARGET: 'TARGET',
  SOURCE: 'SOURCE'
} as const

export type PathLifecycleTurnActor = keyof typeof PATH_LIFECYCLE_TURN_ACTOR

export type PathLifecycleTurnActorOption = CoreMeta<PathLifecycleTurnActor>

export const PATH_LIFECYCLE_TURN_ACTOR_REGISTRY: Record<
  PathLifecycleTurnActor,
  PathLifecycleTurnActorOption
> = {
  [PATH_LIFECYCLE_TURN_ACTOR.TARGET]: {
    code: PATH_LIFECYCLE_TURN_ACTOR.TARGET,
    label: 'Target',
    description: 'Counted on the target’s turns.'
  },
  [PATH_LIFECYCLE_TURN_ACTOR.SOURCE]: {
    code: PATH_LIFECYCLE_TURN_ACTOR.SOURCE,
    label: 'Source',
    description: 'Counted on the source’s turns.'
  }
} as const

export const PATH_LIFECYCLE_TURN_ACTOR_OPTIONS = valuesOf(
  PATH_LIFECYCLE_TURN_ACTOR_REGISTRY
) as readonly PathLifecycleTurnActorOption[]

export const PATH_LIFECYCLE_TURN_BOUNDARY = {
  START_OF_TURN: 'START_OF_TURN',
  END_OF_TURN: 'END_OF_TURN'
} as const

export type PathLifecycleTurnBoundary = keyof typeof PATH_LIFECYCLE_TURN_BOUNDARY

export type PathLifecycleTurnBoundaryOption = CoreMeta<PathLifecycleTurnBoundary>

export const PATH_LIFECYCLE_TURN_BOUNDARY_REGISTRY: Record<
  PathLifecycleTurnBoundary,
  PathLifecycleTurnBoundaryOption
> = {
  [PATH_LIFECYCLE_TURN_BOUNDARY.START_OF_TURN]: {
    code: PATH_LIFECYCLE_TURN_BOUNDARY.START_OF_TURN,
    label: 'Start Of Turn',
    description: 'Counted at turn start.'
  },
  [PATH_LIFECYCLE_TURN_BOUNDARY.END_OF_TURN]: {
    code: PATH_LIFECYCLE_TURN_BOUNDARY.END_OF_TURN,
    label: 'End Of Turn',
    description: 'Counted at turn end.'
  }
} as const

export const PATH_LIFECYCLE_TURN_BOUNDARY_OPTIONS = valuesOf(
  PATH_LIFECYCLE_TURN_BOUNDARY_REGISTRY
) as readonly PathLifecycleTurnBoundaryOption[]

/** The rest whose finish turns a standing effect back on once it has ended. */
export const PATH_LIFECYCLE_RETURNS_ON = {
  LONG_REST: 'LONG_REST',
  SHORT_REST: 'SHORT_REST'
} as const

export type PathLifecycleReturnsOn = keyof typeof PATH_LIFECYCLE_RETURNS_ON

export const PATH_LIFECYCLE_RETURNS_ON_OPTIONS: readonly CoreMeta<PathLifecycleReturnsOn>[] = [
  {
    code: PATH_LIFECYCLE_RETURNS_ON.LONG_REST,
    label: 'Long Rest',
    description: 'Comes back when its holder finishes a long rest.'
  },
  {
    code: PATH_LIFECYCLE_RETURNS_ON.SHORT_REST,
    label: 'Short Rest',
    description: 'Comes back when its holder finishes a short or long rest.'
  }
]

/** Which earlier effects a new one ends: `PER_SOURCE`, its source's from the same Effect on any holder. */
export const PATH_LIFECYCLE_EXCLUSIVITY = {
  PER_SOURCE: 'PER_SOURCE'
} as const

export type PathLifecycleExclusivity = keyof typeof PATH_LIFECYCLE_EXCLUSIVITY

export const PATH_LIFECYCLE_EXCLUSIVITY_OPTIONS: readonly CoreMeta<PathLifecycleExclusivity>[] = [
  {
    code: PATH_LIFECYCLE_EXCLUSIVITY.PER_SOURCE,
    label: 'One Per Source',
    description: 'A new one from the same source ends its earlier one, on any creature.'
  }
]
