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
    description: 'Continuously active without a triggering event.',
    tooltip: 'Always active.'
  },
  [PATH_CODE.ON_USE]: {
    code: PATH_CODE.ON_USE,
    label: 'On Use',
    description: 'Occurs when an activated effect is used successfully.',
    tooltip: 'When an effect is used.'
  },
  [PATH_CODE.ON_CAST]: {
    code: PATH_CODE.ON_CAST,
    label: 'On Cast',
    description: 'Occurs when a spell or magical effect is cast.',
    tooltip: 'When a spell is cast.'
  },
  [PATH_CODE.ON_ATTACK]: {
    code: PATH_CODE.ON_ATTACK,
    label: 'On Attack',
    description: 'Occurs when an attack is made.',
    tooltip: 'When an attack is made.'
  },
  [PATH_CODE.ON_HIT]: {
    code: PATH_CODE.ON_HIT,
    label: 'On Hit',
    description: 'Occurs when an attack successfully hits a target.',
    tooltip: 'When an attack hits.'
  },
  [PATH_CODE.ON_MISS]: {
    code: PATH_CODE.ON_MISS,
    label: 'On Miss',
    description: 'Occurs when an attack misses a target.',
    tooltip: 'When an attack misses.'
  },
  [PATH_CODE.ON_CRIT]: {
    code: PATH_CODE.ON_CRIT,
    label: 'On Critical Hit',
    description: 'Occurs when an attack results in a critical hit.',
    tooltip: 'On a critical hit.'
  },
  [PATH_CODE.ON_SAVE_FAIL]: {
    code: PATH_CODE.ON_SAVE_FAIL,
    label: 'On Save Failure',
    description: 'Occurs when a creature fails a saving throw.',
    tooltip: 'When a save fails.'
  },
  [PATH_CODE.ON_SAVE_SUCCESS]: {
    code: PATH_CODE.ON_SAVE_SUCCESS,
    label: 'On Save Success',
    description: 'Occurs when a creature succeeds on a saving throw.',
    tooltip: 'When a save succeeds.'
  },
  [PATH_CODE.START_OF_TURN]: {
    code: PATH_CODE.START_OF_TURN,
    label: 'Start of Turn',
    description: "Occurs at the beginning of a creature's turn.",
    tooltip: 'At turn start.'
  },
  [PATH_CODE.END_OF_TURN]: {
    code: PATH_CODE.END_OF_TURN,
    label: 'End of Turn',
    description: "Occurs at the end of a creature's turn.",
    tooltip: 'At turn end.'
  },
  [PATH_CODE.ON_MOVE]: {
    code: PATH_CODE.ON_MOVE,
    label: 'On Move',
    description: 'Occurs when a creature, player, or NPC moves.',
    tooltip: 'When moving.'
  },
  [PATH_CODE.ON_HP_ZERO]: {
    code: PATH_CODE.ON_HP_ZERO,
    label: 'On HP Zero',
    description: "Occurs when a creature, player, or NPC's hit points drop to zero.",
    tooltip: 'When hit points drop to zero.'
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
    description: 'Roll within a range of values.',
    tooltip: 'Range of rolls'
  },
  [PATH_ROLL_TABLE_KIND.EXACT]: {
    code: PATH_ROLL_TABLE_KIND.EXACT,
    label: 'Exact',
    description: 'Roll for an exact value.',
    tooltip: 'Exact roll value'
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
    description: 'Direct outcome without rolling to determine effect.',
    tooltip: 'Direct outcome'
  },
  [PATH_RESOLUTION_KIND.ROLL_TABLE]: {
    code: PATH_RESOLUTION_KIND.ROLL_TABLE,
    label: 'Roll Table',
    description: 'Outcome based on a roll table to determine effect.',
    tooltip: 'Roll table outcome'
  },
  [PATH_RESOLUTION_KIND.ROLL_TABLE_REPEAT]: {
    code: PATH_RESOLUTION_KIND.ROLL_TABLE_REPEAT,
    label: 'Repeat Roll Table',
    description: 'Roll the same table again using the authored repeat and reroll rules.',
    tooltip: 'Repeat the current roll table'
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
    description: 'Only a single effect outcome for this path.',
    tooltip: 'Single effect outcome'
  },
  [PATH_GROUP_TYPE.CHOICE]: {
    code: PATH_GROUP_TYPE.CHOICE,
    label: 'Choice',
    description: 'Choice of effect outcomes for this path.',
    tooltip: 'Choice of effect outcomes'
  },
  [PATH_GROUP_TYPE.SEQUENTIAL]: {
    code: PATH_GROUP_TYPE.SEQUENTIAL,
    label: 'Sequential',
    description: 'Multiple effect outcomes that occur sequentially for this path.',
    tooltip: 'Sequential effect outcomes'
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
    description: 'The path starts from the effect source.',
    tooltip: 'From the original source.'
  },
  [PATH_ORIGIN_KIND.PRIMARY_TARGET]: {
    code: PATH_ORIGIN_KIND.PRIMARY_TARGET,
    label: 'Primary Target',
    description: "The path starts from the effect's primary target.",
    tooltip: 'From the primary target.'
  },
  [PATH_ORIGIN_KIND.PREVIOUS_ENTRY_TARGET]: {
    code: PATH_ORIGIN_KIND.PREVIOUS_ENTRY_TARGET,
    label: 'Previous Entry Target',
    description: 'The path starts from the target of the previous sequential entry.',
    tooltip: 'From the prior entry target.'
  }
} as const

export const PATH_ORIGIN_KIND_OPTIONS = valuesOf(
  PATH_ORIGIN_KIND_REGISTRY
) as readonly PathOriginKindOption[]

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
  [TRIGGER.ENTER_AREA]: [PATH_CODE.PASSIVE]
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
    description: 'No recurring lifecycle application.',
    tooltip: 'No recurrence.'
  },
  [PATH_LIFECYCLE_RECURRING_KIND.START_OF_TURN]: {
    code: PATH_LIFECYCLE_RECURRING_KIND.START_OF_TURN,
    label: 'Start Of Turn',
    description: 'Re-applies at the start of each turn while active.',
    tooltip: 'Recurring at turn start.'
  },
  [PATH_LIFECYCLE_RECURRING_KIND.END_OF_TURN]: {
    code: PATH_LIFECYCLE_RECURRING_KIND.END_OF_TURN,
    label: 'End Of Turn',
    description: 'Re-applies at the end of each turn while active.',
    tooltip: 'Recurring at turn end.'
  }
} as const

export const PATH_LIFECYCLE_RECURRING_KIND_OPTIONS = valuesOf(
  PATH_LIFECYCLE_RECURRING_KIND_REGISTRY
) as readonly PathLifecycleRecurringKindOption[]

export const PATH_LIFECYCLE_CONSUME_EVENT = {
  ON_ATTACK_ROLL: 'ON_ATTACK_ROLL',
  ON_CAST_SPELL: 'ON_CAST_SPELL'
} as const

export type PathLifecycleConsumeEvent = keyof typeof PATH_LIFECYCLE_CONSUME_EVENT

export type PathLifecycleConsumeEventOption = CoreMeta<PathLifecycleConsumeEvent>

export const PATH_LIFECYCLE_CONSUME_EVENT_REGISTRY: Record<
  PathLifecycleConsumeEvent,
  PathLifecycleConsumeEventOption
> = {
  [PATH_LIFECYCLE_CONSUME_EVENT.ON_ATTACK_ROLL]: {
    code: PATH_LIFECYCLE_CONSUME_EVENT.ON_ATTACK_ROLL,
    label: 'On Attack Roll',
    description: 'Consume the effect on the first attack roll event.',
    tooltip: 'Consumed by first attack roll.'
  },
  [PATH_LIFECYCLE_CONSUME_EVENT.ON_CAST_SPELL]: {
    code: PATH_LIFECYCLE_CONSUME_EVENT.ON_CAST_SPELL,
    label: 'On Cast Spell',
    description: 'Consume the effect on the first cast spell event.',
    tooltip: 'Consumed by first spell cast.'
  }
} as const

export const PATH_LIFECYCLE_CONSUME_EVENT_OPTIONS = valuesOf(
  PATH_LIFECYCLE_CONSUME_EVENT_REGISTRY
) as readonly PathLifecycleConsumeEventOption[]

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
    description: 'The duration counts down on the turns of the creature the effect is on.',
    tooltip: 'Counted on the target’s turns.'
  },
  [PATH_LIFECYCLE_TURN_ACTOR.SOURCE]: {
    code: PATH_LIFECYCLE_TURN_ACTOR.SOURCE,
    label: 'Source',
    description: 'The duration counts down on the turns of the creature that created the effect.',
    tooltip: 'Counted on the source’s turns.'
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
    description: 'One round of the duration passes at the start of that creature’s turn.',
    tooltip: 'Counted at turn start.'
  },
  [PATH_LIFECYCLE_TURN_BOUNDARY.END_OF_TURN]: {
    code: PATH_LIFECYCLE_TURN_BOUNDARY.END_OF_TURN,
    label: 'End Of Turn',
    description: 'One round of the duration passes at the end of that creature’s turn.',
    tooltip: 'Counted at turn end.'
  }
} as const

export const PATH_LIFECYCLE_TURN_BOUNDARY_OPTIONS = valuesOf(
  PATH_LIFECYCLE_TURN_BOUNDARY_REGISTRY
) as readonly PathLifecycleTurnBoundaryOption[]

export const PATH_LIFECYCLE_END_EVENT = {
  ON_ATTACK_ROLL: 'ON_ATTACK_ROLL',
  ON_CAST_SPELL: 'ON_CAST_SPELL',
  ON_HIT_POINTS_REGAINED: 'ON_HIT_POINTS_REGAINED'
} as const

export type PathLifecycleEndEvent = keyof typeof PATH_LIFECYCLE_END_EVENT

export type PathLifecycleEndEventOption = CoreMeta<PathLifecycleEndEvent>

export const PATH_LIFECYCLE_END_EVENT_REGISTRY: Record<
  PathLifecycleEndEvent,
  PathLifecycleEndEventOption
> = {
  [PATH_LIFECYCLE_END_EVENT.ON_ATTACK_ROLL]: {
    code: PATH_LIFECYCLE_END_EVENT.ON_ATTACK_ROLL,
    label: 'On Attack Roll',
    description: 'The effect ends when an attack roll event occurs.',
    tooltip: 'Ends on attack roll.'
  },
  [PATH_LIFECYCLE_END_EVENT.ON_CAST_SPELL]: {
    code: PATH_LIFECYCLE_END_EVENT.ON_CAST_SPELL,
    label: 'On Cast Spell',
    description: 'The effect ends when a spell cast event occurs.',
    tooltip: 'Ends on spell cast.'
  },
  [PATH_LIFECYCLE_END_EVENT.ON_HIT_POINTS_REGAINED]: {
    code: PATH_LIFECYCLE_END_EVENT.ON_HIT_POINTS_REGAINED,
    label: 'On Hit Points Regained',
    description: 'The effect ends when the affected creature regains hit points.',
    tooltip: 'Ends on healing.'
  }
} as const

export const PATH_LIFECYCLE_END_EVENT_OPTIONS = valuesOf(
  PATH_LIFECYCLE_END_EVENT_REGISTRY
) as readonly PathLifecycleEndEventOption[]
