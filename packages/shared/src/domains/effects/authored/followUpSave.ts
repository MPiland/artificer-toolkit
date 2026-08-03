import type { OutcomeAuthored, SavingThrowAuthored } from '#authored'
import {
  EFFECT_KIND,
  type FollowUpSaveAttemptKind,
  type FollowUpSaveBranchKind,
  type FollowUpSaveTiming
} from '#core'

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
