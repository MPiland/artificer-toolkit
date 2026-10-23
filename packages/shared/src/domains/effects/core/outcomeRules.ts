export const FOLLOW_UP_CHECK_ACTOR = {
  TARGET: 'TARGET',
  CREATURE_WITHIN_REACH: 'CREATURE_WITHIN_REACH'
} as const

export const FOLLOW_UP_CHECK_ACTOR_OPTIONS = [
  { code: FOLLOW_UP_CHECK_ACTOR.TARGET, label: 'Target' },
  { code: FOLLOW_UP_CHECK_ACTOR.CREATURE_WITHIN_REACH, label: 'Creature Within Reach' }
] as const

export const MOVEMENT_RULE_KIND = {
  STOP_CURRENT_MOVEMENT: 'STOP_CURRENT_MOVEMENT',
  MOVEMENT_COST_MULTIPLIER: 'MOVEMENT_COST_MULTIPLIER',
  LIMIT_DISTANCE_FROM_ANCHOR: 'LIMIT_DISTANCE_FROM_ANCHOR',
  MAX_FALL_DISTANCE_FROM_ANCHOR: 'MAX_FALL_DISTANCE_FROM_ANCHOR',
  MAX_CLIMB_DISTANCE_FROM_ANCHOR: 'MAX_CLIMB_DISTANCE_FROM_ANCHOR',
  ADD_SPEED_TO_MOVEMENT: 'ADD_SPEED_TO_MOVEMENT'
} as const

export const MOVEMENT_RULE_KIND_OPTIONS = [
  { code: MOVEMENT_RULE_KIND.STOP_CURRENT_MOVEMENT, label: 'Stop Current Movement' },
  { code: MOVEMENT_RULE_KIND.MOVEMENT_COST_MULTIPLIER, label: 'Movement Cost Multiplier' },
  { code: MOVEMENT_RULE_KIND.LIMIT_DISTANCE_FROM_ANCHOR, label: 'Limit Distance From Anchor' },
  { code: MOVEMENT_RULE_KIND.MAX_FALL_DISTANCE_FROM_ANCHOR, label: 'Maximum Fall From Anchor' },
  { code: MOVEMENT_RULE_KIND.MAX_CLIMB_DISTANCE_FROM_ANCHOR, label: 'Maximum Climb From Anchor' },
  { code: MOVEMENT_RULE_KIND.ADD_SPEED_TO_MOVEMENT, label: 'Add Speed To Movement' }
] as const

export const ACTION_ECONOMY_RULE_KIND = {
  LOSE_ACTION: 'LOSE_ACTION',
  MAX_ATTACKS_PER_ACTIVATION: 'MAX_ATTACKS_PER_ACTIVATION',
  MAX_ATTACKS_PER_TURN: 'MAX_ATTACKS_PER_TURN'
} as const

export type ActionEconomyRuleKind = keyof typeof ACTION_ECONOMY_RULE_KIND

export const ACTION_ECONOMY_RULE_KIND_OPTIONS = [
  { code: ACTION_ECONOMY_RULE_KIND.LOSE_ACTION, label: 'Lose Action' },
  {
    code: ACTION_ECONOMY_RULE_KIND.MAX_ATTACKS_PER_ACTIVATION,
    label: 'Maximum Attacks per Activation'
  },
  { code: ACTION_ECONOMY_RULE_KIND.MAX_ATTACKS_PER_TURN, label: 'Maximum Attacks per Turn' }
] as const

export const FOLLOW_UP_SAVE_TIMING = {
  IMMEDIATE: 'IMMEDIATE',
  TARGET_TURN_START: 'TARGET_TURN_START',
  TARGET_TURN_END: 'TARGET_TURN_END',
  SOURCE_NEXT_TURN_START: 'SOURCE_NEXT_TURN_START',
  ON_TRIGGERS_ONLY: 'ON_TRIGGERS_ONLY'
} as const

export type FollowUpSaveTiming = keyof typeof FOLLOW_UP_SAVE_TIMING

export const FOLLOW_UP_SAVE_TIMING_OPTIONS = [
  { code: FOLLOW_UP_SAVE_TIMING.IMMEDIATE, label: 'Immediately' },
  { code: FOLLOW_UP_SAVE_TIMING.TARGET_TURN_START, label: 'Start of Target Turn' },
  { code: FOLLOW_UP_SAVE_TIMING.TARGET_TURN_END, label: 'End of Target Turn' },
  { code: FOLLOW_UP_SAVE_TIMING.SOURCE_NEXT_TURN_START, label: 'Start of Source Next Turn' },
  { code: FOLLOW_UP_SAVE_TIMING.ON_TRIGGERS_ONLY, label: 'Only When a Repeat Trigger Fires' }
] as const

export const FOLLOW_UP_SAVE_ATTEMPT_KIND = {
  ONCE: 'ONCE',
  THRESHOLDS: 'THRESHOLDS'
} as const

export type FollowUpSaveAttemptKind = keyof typeof FOLLOW_UP_SAVE_ATTEMPT_KIND

export const FOLLOW_UP_SAVE_ATTEMPT_KIND_OPTIONS = [
  { code: FOLLOW_UP_SAVE_ATTEMPT_KIND.ONCE, label: 'Once' },
  { code: FOLLOW_UP_SAVE_ATTEMPT_KIND.THRESHOLDS, label: 'Track Successes and Failures' }
] as const

export const FOLLOW_UP_SAVE_BRANCH_KIND = {
  END: 'END',
  CONTINUE: 'CONTINUE',
  OUTCOMES: 'OUTCOMES'
} as const

export type FollowUpSaveBranchKind = keyof typeof FOLLOW_UP_SAVE_BRANCH_KIND

export const FOLLOW_UP_SAVE_BRANCH_KIND_OPTIONS = [
  { code: FOLLOW_UP_SAVE_BRANCH_KIND.END, label: 'End Current Result' },
  { code: FOLLOW_UP_SAVE_BRANCH_KIND.CONTINUE, label: 'Continue Current Result' },
  { code: FOLLOW_UP_SAVE_BRANCH_KIND.OUTCOMES, label: 'Resolve Outcomes' }
] as const

export const MANUAL_ADJUDICATION_REASON = {
  GM_CHOICE: 'GM_CHOICE',
  PLAYER_DECLARATION: 'PLAYER_DECLARATION',
  NARRATIVE_JUDGMENT: 'NARRATIVE_JUDGMENT',
  EXTERNAL_WORLD_STATE: 'EXTERNAL_WORLD_STATE'
} as const

export type ManualAdjudicationReason = keyof typeof MANUAL_ADJUDICATION_REASON

export const MANUAL_ADJUDICATION_REASON_OPTIONS = [
  { code: MANUAL_ADJUDICATION_REASON.GM_CHOICE, label: 'GM Choice' },
  { code: MANUAL_ADJUDICATION_REASON.PLAYER_DECLARATION, label: 'Player Declaration' },
  { code: MANUAL_ADJUDICATION_REASON.NARRATIVE_JUDGMENT, label: 'Narrative Judgment' },
  { code: MANUAL_ADJUDICATION_REASON.EXTERNAL_WORLD_STATE, label: 'External World State' }
] as const
