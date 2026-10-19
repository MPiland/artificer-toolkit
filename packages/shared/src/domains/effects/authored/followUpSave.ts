import type {
  ConditionAuthored,
  OutcomeAuthored,
  PathLifecycleAuthored,
  SavingThrowAuthored
} from '#authored'
import {
  EFFECT_KIND,
  type FollowUpSaveAttemptKind,
  type FollowUpSaveBranchKind,
  type FollowUpSaveTiming
} from '#core'
import type { CombatPerceptionRequirement } from '../../rules/combatPerception.js'

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

export type FollowUpSaveBranchAuthored =
  | {
      kind: Exclude<FollowUpSaveBranchKind, 'OUTCOMES'>
    }
  | {
      kind: 'OUTCOMES'
      endCurrent: boolean
      resultKind: 'SINGLE' | 'SEQUENCE'
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
