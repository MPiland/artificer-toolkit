import type { CheckChoiceAuthored, HeldEscapeDcAuthored } from './check.js'
import type { ActivationAuthored } from './effect.js'
import type { FailureMarginRiderAuthored } from './followUpSave.js'
import type {
  DurationAuthored,
  FacetAuthored,
  ModifierGrantAuthored,
  OutcomeAuthored,
  OutcomeRowMetadataAuthored,
  RangeAuthored,
  TargetingAuthored
} from '#authored'
import type {
  ActivationCode,
  EquipmentCategoryCode,
  EquipmentPropertyCode,
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
   * attack roll or a cast ends it only against an enemy (Sanctuary); another creature using one of
   * the named basic actions on the holder ends it (rousing a sleeper); the effect source being
   * incapacitated or defeated ends it on every holder (Knight Leadership).
   */
  endOnTriggers?: (
    | {
        event: 'DAMAGE_TAKEN'
        by: 'ANYONE' | 'SOURCE_SIDE'
        damageTypeIds?: string[]
      }
    | { event: 'ATTACK_ROLL' | 'SPELL_CAST'; against: 'ENEMY' }
    | { event: 'ACTION_USED_ON_HOLDER'; actionDefinitionIds: string[] }
    | { event: 'INCAPACITATED'; of: 'SOURCE' }
  )[]
  /** Condition types that end the effect early while its holder has any of them. */
  endOnConditionIds?: string[]
  /** The holder may end the effect themselves, at the cost of this activation. */
  holderEnd?: { activation: ActivationCode }
  /**
   * Only the effect's source meets it: its grants about attackers apply, and an attack consumes
   * it, only when the source is the attacker.
   */
  fromSourceOnly?: boolean
  /**
   * The effect ends after this many uses; a modifier domain spends them (Mirror Image's
   * duplicates). The runtime counts them down in `remainingUses`.
   */
  uses?: number
  /**
   * The effect is dormant until its anchor actor's final counted turn and active only during that
   * turn: a timed effect made now that waits for that actor's next turn.
   */
  activeOnlyOnFinalAnchorTurn?: boolean
  /**
   * A zone's failed-save condition is held by the zone (D142, D146): it ends when the zone ends,
   * on `ON_LEAVING_AREA` when the creature leaves the area, and on a successful `escape`.
   */
  heldBySource?: boolean
  /** The check a creature held by the zone may make to free itself, at the cost of `activation`. */
  escape?: {
    activation: ActivationAuthored
    checks: CheckChoiceAuthored
    dc: HeldEscapeDcAuthored
  }
  /**
   * What the holder is left with when the effect ends, however it ends (expiry, Concentration, an end
   * trigger, death): these modifier grants, held for `turns` of the holder's own turns (Haste's
   * lethargy). Only an `APPLY_GRANT` effect carries one.
   */
  onEnd?: {
    turns: number // int
    modifiers: ModifierGrantAuthored[]
  }
}

export type ResultBlockAuthored<TOutcome extends OutcomeAuthored = OutcomeAuthored> = {
  id: string
  resultKind: 'SINGLE' | 'SEQUENCE'
  /** UUID-backed System maintenance definition, when this result creates a maintained effect. */
  maintenanceDefinitionId?: string
  duration?: DurationAuthored
  lifecycle?: PathLifecycleAuthored
  /** Only a direct saving throw's failed result block (ON_SAVE_FAIL) carries one. */
  failureMarginRider?: FailureMarginRiderAuthored
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

/**
 * One item the target holds or wears, chosen when the action is used (Heat Metal's metal object,
 * Magic Weapon's weapon). Every listed filter must hold; `equipmentIds` matches the item or a
 * variant ancestor. A grant with `bindsChosenItem` applies only to that item, and the effect ends
 * when it leaves the holder's equipment.
 */
export type PathChosenItemAuthored = {
  category?: EquipmentCategoryCode
  requiredProperties?: EquipmentPropertyCode[]
  excludedProperties?: EquipmentPropertyCode[]
  equipmentIds?: string[]
}

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
  chosenItem?: PathChosenItemAuthored
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
