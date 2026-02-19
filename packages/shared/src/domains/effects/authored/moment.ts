import type { ConditionAuthored, DamageAuthored, DurationAuthored } from '#authored'
import {
  MOMENT_ROLL_TABLE_KIND,
  type MOMENT_RESOLUTION_KIND,
  type MomentGroupType,
  type MomentRollTableKind,
  type MomentsByTrigger,
  type Trigger
} from '#core'

export type MomentEffectPayload = DamageAuthored | ConditionAuthored

export type MomentRollTableEntryPayload = {
  [MOMENT_ROLL_TABLE_KIND.RANGE]: (
    {
      rollRange: [number, number]
      id: string
      duration?: DurationAuthored
      description?: string
    }
  )
  [MOMENT_ROLL_TABLE_KIND.EXACT]: (
    {
      rollValue: number
      id: string
      duration?: DurationAuthored
      description?: string
    }
  )
}

export type MomentRollTableEntry<K extends MomentRollTableKind = MomentRollTableKind> = MomentRollTableEntryPayload[K]

export type MomentAuthoredBase<TTrigger extends Trigger = Trigger> = {
  id: string
  moment: MomentsByTrigger<TTrigger>
  groupType: MomentGroupType
}

export type MomentDirect = {
  resolutionKind: typeof MOMENT_RESOLUTION_KIND.DIRECT
  duration?: DurationAuthored
} & MomentEffectPayload

export type MomentRollTablePayload = {
  [K in keyof typeof MOMENT_ROLL_TABLE_KIND]: {
    resolutionKind: typeof MOMENT_RESOLUTION_KIND.ROLL_TABLE
    rollTableKind: K
    table: (MomentRollTableEntry<K> & MomentEffectPayload)[]
    dieConfig: string
  }
}

export type MomentRollTable<K extends MomentRollTableKind = MomentRollTableKind> = MomentRollTablePayload[K]

export type MomentAuthored<
  TTrigger extends Trigger = Trigger,
  K extends MomentRollTableKind = MomentRollTableKind
>
  = | (MomentAuthoredBase<TTrigger> & MomentDirect)
    | (MomentAuthoredBase<TTrigger> & MomentRollTable<K>)
