import type { ActivationAuthored, FollowUpSaveBranchAuthored, OutcomeAuthored } from '#authored'
import { EFFECT_KIND } from '#core'

export type FollowUpCheckBranchAuthored =
  | Exclude<FollowUpSaveBranchAuthored, { kind: 'OUTCOMES' }>
  | {
      kind: 'OUTCOMES'
      endCurrent: boolean
      resultKind: 'SINGLE' | 'SEQUENCE'
      outcomes: OutcomeAuthored[]
    }

export type FollowUpCheckAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.FOLLOW_UP_CHECK
  label: string
  activation: ActivationAuthored
  ability: string
  fixedDc: number
  skillId?: string
  toolEquipmentId?: string
  actorKinds: Array<'TARGET' | 'CREATURE_WITHIN_REACH'>
  repeatable: boolean
  onSuccess: FollowUpCheckBranchAuthored
  onFailure: FollowUpCheckBranchAuthored
}
