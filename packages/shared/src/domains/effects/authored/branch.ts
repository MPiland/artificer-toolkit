import type { DurationAuthored, OutcomeAuthored } from '#authored'
import {
  BRANCH_ROLL_TABLE_KIND,
  type BRANCH_RESOLUTION_KIND,
  type BranchLifecycleConsumeEvent,
  type BranchLifecycleEndEvent,
  type BranchLifecycleRecurringKind,
  type BranchGroupType,
  type BranchRollTableKind,
  type BranchesByTrigger,
  type Trigger
} from '#core'

export type BranchEffectPayload = OutcomeAuthored

export type BranchRollTableEntryPayload = {
  [BRANCH_ROLL_TABLE_KIND.RANGE]: (
    {
      rollRange: [number, number]
      id: string
      duration?: DurationAuthored
    }
  )
  [BRANCH_ROLL_TABLE_KIND.EXACT]: (
    {
      rollValue: number
      id: string
      duration?: DurationAuthored
    }
  )
}

export type BranchRollTableEntry<K extends BranchRollTableKind = BranchRollTableKind> = BranchRollTableEntryPayload[K]

export type BranchAuthoredBase<TTrigger extends Trigger = Trigger> = {
  id: string
  branch: BranchesByTrigger<TTrigger>
  groupType: BranchGroupType
}

export type BranchLifecycleAuthored = {
  recurringKind?: BranchLifecycleRecurringKind
  consumeOnFirstEvent?: BranchLifecycleConsumeEvent
  endOnEvents?: BranchLifecycleEndEvent[]
}

export type BranchDirect = {
  resolutionKind: typeof BRANCH_RESOLUTION_KIND.DIRECT
  duration?: DurationAuthored
  lifecycle?: BranchLifecycleAuthored
} & BranchEffectPayload

export type BranchRollTablePayload = {
  [K in keyof typeof BRANCH_ROLL_TABLE_KIND]: {
    resolutionKind: typeof BRANCH_RESOLUTION_KIND.ROLL_TABLE
    rollTableKind: K
    table: (BranchRollTableEntry<K> & BranchEffectPayload)[]
    dieConfig: string
  }
}

export type BranchRollTable<K extends BranchRollTableKind = BranchRollTableKind> = BranchRollTablePayload[K]

export type BranchAuthored<
  TTrigger extends Trigger = Trigger,
  K extends BranchRollTableKind = BranchRollTableKind
>
  = | (BranchAuthoredBase<TTrigger> & BranchDirect)
    | (BranchAuthoredBase<TTrigger> & BranchRollTable<K>)
