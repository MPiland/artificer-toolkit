import type {
  DurationAuthored,
  FacetAuthored,
  OutcomeAuthored,
  OutcomeRowMetadataAuthored,
  RangeAuthored,
  TargetingAuthored
} from '#authored'
import type {
  ActivationCode,
  PathCodesByTrigger,
  PathGroupType,
  PathLifecycleConsumeEvent,
  PathLifecycleEndEvent,
  PathLifecycleRecurringKind,
  PathLifecycleTurnActor,
  PathLifecycleTurnBoundary,
  PathOriginKind,
  PathRollTableKind,
  PathUsage,
  Trigger
} from '#core'

export type PathEntryBase = {
  id: string
  order: number // int
}

export type PathEntryWithMetadata = PathEntryBase & OutcomeRowMetadataAuthored

export type PathLifecycleAuthored = {
  recurringKind?: PathLifecycleRecurringKind
  /** Whose turn boundary counts a timed effect down; absent means the target's end of turn. */
  turnAnchor?: { actor: PathLifecycleTurnActor; boundary: PathLifecycleTurnBoundary }
  consumeOnFirstEvents?: PathLifecycleConsumeEvent[]
  endOnEvents?: PathLifecycleEndEvent[]
  /**
   * Events that end the effect early. Damage taken is filtered by whose damage counts (`SOURCE_SIDE`
   * is the effect source and its allies, for Charm Person) and, when set, which damage types; an
   * attack roll or a cast ends it only against an enemy (Sanctuary).
   */
  endOnTriggers?: (
    | {
        event: 'DAMAGE_TAKEN'
        by: 'ANYONE' | 'SOURCE_SIDE'
        damageTypeIds?: string[]
      }
    | { event: 'ATTACK_ROLL' | 'SPELL_CAST'; against: 'ENEMY' }
  )[]
  /** Condition types that end the effect early while its holder has any of them. */
  endOnConditionIds?: string[]
  /** The holder may end the effect themselves, at the cost of this activation. */
  holderEnd?: { activation: ActivationCode }
}

export type ResultBlockAuthored<TOutcome extends OutcomeAuthored = OutcomeAuthored> = {
  id: string
  resultKind: 'SINGLE' | 'SEQUENCE'
  /** UUID-backed System maintenance definition, when this result creates a maintained effect. */
  maintenanceDefinitionId?: string
  duration?: DurationAuthored
  lifecycle?: PathLifecycleAuthored
  outcomes: TOutcome[]
}

export type PathChoiceOptionAuthored<TOutcome extends OutcomeAuthored = OutcomeAuthored> =
  PathEntryWithMetadata & {
    resultBlock: ResultBlockAuthored<TOutcome>
  }

export type PathRollTableRowAuthored<TOutcome extends OutcomeAuthored = OutcomeAuthored> =
  PathEntryBase & {
    rollRange?: [number, number]
    rollValue?: number
  } & (
      | {
          resolutionKind: 'RESULT'
          resultBlock: ResultBlockAuthored<TOutcome>
        }
      | {
          resolutionKind: 'REPEAT_TABLE'
          repeat: {
            count: number
            rerollValues: Array<PathEntryBase & { value: number }>
          }
        }
    )

export type EffectPathBaseAuthored<TTrigger extends Trigger = Trigger> = {
  id: string
  order: number // int
  pathCode: PathCodesByTrigger<TTrigger>
  groupType: PathGroupType
  originKind?: PathOriginKind
  /**
   * The path's result is owed only while this facet holds for the attack it rides on (a passive
   * Effect's `ON_HIT` damage). Groups are OR-ed, each group's conditions AND-ed.
   */
  restrictions?: FacetAuthored
  /** The result is owed to at most one attack in a turn, whichever qualifies first. */
  usage?: PathUsage
  rangeOverride?: RangeAuthored
  targetingOverride?: TargetingAuthored
}

export type EffectPathAuthored<
  TTrigger extends Trigger = Trigger,
  TOutcome extends OutcomeAuthored = OutcomeAuthored,
  K extends PathRollTableKind = PathRollTableKind
> = EffectPathBaseAuthored<TTrigger> &
  (
    | {
        selectionKind: 'FIXED'
        resultBlock: ResultBlockAuthored<TOutcome>
      }
    | {
        selectionKind: 'CHOICE'
        options: PathChoiceOptionAuthored<TOutcome>[]
      }
    | {
        selectionKind: 'ROLL_TABLE'
        dieConfig: string
        rollTableKind: K
        rows: PathRollTableRowAuthored<TOutcome>[]
      }
  )
