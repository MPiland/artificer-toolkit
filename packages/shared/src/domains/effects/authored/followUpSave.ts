import type { OutcomeAuthored, SavingThrowAuthored } from '#authored'
import {
  EFFECT_KIND,
  type FollowUpSaveAttemptKind,
  type FollowUpSaveBranchKind,
  type FollowUpSaveTiming
} from '#core'
import type { CombatPerceptionRequirement } from '../../rules/combatPerception.js'

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
}
