import type {
  ConditionAuthored,
  OutcomeAuthored,
  PathLifecycleAuthored,
  ResultBlockGateAuthored,
  SavingThrowAuthored
} from '#authored'
import {
  EFFECT_KIND,
  type FollowUpSaveAttemptKind,
  type FollowUpSaveBranchKind,
  type FollowUpSaveTiming
} from '#core'
import type { CombatPerceptionRequirement } from '../../vtt/combatPerception.js'

/**
 * Conditions a save failed by at least `failedBy` also applies, for the save's duration ("if the
 * saving throw fails by 5 or more, the target falls unconscious"). They end on their own triggers,
 * independently of the failure's outcomes. A follow-up save carries it, and so does the failed
 * result block of a direct saving throw.
 */
export type FailureMarginRiderAuthored = {
  id: string
  failedBy: number
  outcomes: ConditionAuthored[]
  lifecycle: {
    endOnTriggers?: PathLifecycleAuthored['endOnTriggers']
  }
}

/** What the target perceives of its source, which a repeated save's policy reads each turn. */
export type FollowUpSaveRepeatPerceptionAuthored = {
  kind: 'PERCEPTION'
  observer: 'TARGET'
  subject: 'SOURCE'
  requirement: CombatPerceptionRequirement
}

export type FollowUpSaveRepeatRollInfluenceAuthored = {
  influence: 'ADVANTAGE' | 'DISADVANTAGE'
  when: FollowUpSaveRepeatPerceptionAuthored
}

/** The repeat is attempted only on turns its perception requirement is met (or unmet). */
export type FollowUpSaveRepeatAttemptGateAuthored = {
  allow: 'WHEN_MET' | 'WHEN_UNMET'
  when: FollowUpSaveRepeatPerceptionAuthored
}

/**
 * An event that makes the holder repeat this save outside its own turn. The held effect's runtime
 * raises it (a room funnel hook); damage is the only event so far. Closed to the holder's own
 * actions: those are an escape (`lifecycle.escape`), not a repeat trigger.
 */
export type FollowUpSaveRepeatTriggerAuthored = {
  kind: 'DAMAGE_TAKEN'
  /** Whose damage triggers it, the same vocabulary as the `DAMAGE_TAKEN` end trigger. */
  by: 'ANYONE' | 'SOURCE_SIDE'
  /** Any damage type when absent. */
  damageTypeIds?: string[]
  /** How the triggered roll differs from the turn-end one ("advantage if triggered by damage"). */
  rollInfluence?: 'ADVANTAGE' | 'DISADVANTAGE'
}

export type FollowUpSaveBranchAuthored =
  | {
      kind: Exclude<FollowUpSaveBranchKind, 'OUTCOMES'>
    }
  | {
      kind: 'OUTCOMES'
      endCurrent: boolean
      resultKind: 'SINGLE' | 'SEQUENCE'
      /** An immediate save's branch checks it on the target before its outcomes, as a result block's gate does. */
      gate?: ResultBlockGateAuthored
      outcomes: OutcomeAuthored[]
    }

export type FollowUpSaveAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.FOLLOW_UP_SAVE
  timing: FollowUpSaveTiming
  /** Required only when a one-time immediate save repeats after a failure. */
  repeatTiming?: FollowUpSaveTiming
  /** System-authored policy for a repeated save; runtime evaluation stays outside this contract. */
  repeatRollInfluence?: FollowUpSaveRepeatRollInfluenceAuthored
  repeatAttemptGate?: FollowUpSaveRepeatAttemptGateAuthored
  /** Events that repeat the save besides its timing; only the turn-end repeat has a consumer today. */
  repeatTriggers?: FollowUpSaveRepeatTriggerAuthored[]
  savingThrow: SavingThrowAuthored
  attempts:
    | {
        kind: Extract<FollowUpSaveAttemptKind, 'ONCE'>
        repeatOnFailure?: boolean
      }
    | {
        kind: Extract<FollowUpSaveAttemptKind, 'THRESHOLDS'>
        successesToEnd: number
        failuresToResolve: number
        consecutive: boolean
      }
  onSuccess: FollowUpSaveBranchAuthored
  onFailure: FollowUpSaveBranchAuthored
  onDurationComplete?: FollowUpSaveBranchAuthored
  failureMarginRider?: FailureMarginRiderAuthored
}
