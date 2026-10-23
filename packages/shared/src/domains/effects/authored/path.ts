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
  LengthUnitCode,
  EquipmentPropertyCode,
  PathCodesByTrigger,
  PathGroupType,
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
  /** System `effectConsumeEvent` codes. */
  consumeOnFirstEvents?: string[]
  /** System `effectEndEvent` codes. */
  endOnEvents?: string[]
  /**
   * Events that end the effect early. Damage taken is filtered by whose damage counts (`SOURCE_SIDE`
   * is the effect source and its allies, for Charm Person) and, when set, which damage types; an
   * action with a System-listed trait (an attack roll, a cast) ends it only against an enemy (Sanctuary); another creature using one of
   * the named basic actions on the holder ends it (rousing a sleeper); the effect source being
   * incapacitated or defeated ends it on every holder (Knight Leadership); the holder standing more
   * than `beyondFeet` from the effect source ends it (Warding Bond).
   */
  endOnTriggers?: (
    | {
        event: 'DAMAGE_TAKEN'
        by: 'ANYONE' | 'SOURCE_SIDE'
        damageTypeIds?: string[]
      }
    | { event: 'ACTION_TRAIT'; trait: string; against: 'ENEMY' }
    | { event: 'ACTION_USED_ON_HOLDER'; actionDefinitionIds: string[] }
    | { event: 'INCAPACITATED'; of: 'SOURCE' }
    | { event: 'SEPARATED'; from: 'SOURCE'; beyondFeet: number }
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
  /**
   * The result block's held outcomes (a removal from play) are not held at once: at the end of each
   * of the holder's turns while the duration lasts, the holder rolls a d20, and a roll of
   * `minimumRoll` or higher applies them until the holder's next turn starts or the duration ends
   * (Blink).
   */
  turnEndGate?: {
    minimumRoll: number // int 2..20
  }
  /**
   * Actions the holder may take while the effect is held, beside its own allowances (Expeditious
   * Retreat's bonus-action Dash, Haste's extra action). Each is listed with the named basic actions
   * (and a weapon attack when `weaponAttack`), charged to `activation`; a `FREE` one spends only its
   * own `usesPerTurn`, shared by everything it offers.
   */
  grantedActions?: {
    activation: ActivationCode
    usesPerTurn?: number // int, required when activation is FREE
    actionDefinitionIds: string[]
    weaponAttack?: boolean
  }[]
  /**
   * Choices the effect offers a creature beside the holder's own turns (D160). `MOVE_HELD_EFFECT`
   * lets `offeredTo` (the effect's source, or its holder) move the effect, with its remaining
   * duration and Concentration, to another creature within `range`, charged to `activation`, once
   * `when` holds for the holder. `REPEAT_SOURCE_PATH` (D166) lets the effect's source re-run the
   * named paths of the Effect that made it against the holder, charged to `activation`. Only an
   * `APPLY_GRANT` effect carries one. `when` and `range` belong to a move offer, `pathIds` to a
   * repeat offer.
   */
  effectOffers?: {
    kind: 'MOVE_HELD_EFFECT' | 'REPEAT_SOURCE_PATH'
    offeredTo: 'SOURCE' | 'HOLDER'
    when?: 'HOLDER_AT_ZERO_HP'
    activation: ActivationCode
    range?: { amount: number; unit: LengthUnitCode }
    pathIds?: string[]
  }[]
}

/**
 * A condition on the target that the result block checks when the action resolves, before its own
 * effects: while unmet, the block does nothing to that target.
 */
export type ResultBlockGateAuthored =
  | {
      kind: 'TARGET_HIT_POINTS_AT_MOST' | 'TARGET_HIT_POINTS_AT_LEAST'
      /** The target's current hit points must be at most (AT_MOST) or at least (AT_LEAST) this many. */
      amount: number // int >= 1
    }
  | {
      /**
       * The block's other outcomes apply only if the named damage outcome of the same path took the
       * target from above 0 hit points to 0. The damage outcome itself is never gated by it.
       */
      kind: 'REDUCED_TO_ZERO_BY'
      damageOutcomeId: string
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
  gate?: ResultBlockGateAuthored
  /**
   * Damage types that switch the block off for a creature that took any of them since its last
   * turn began (a Troll's acid and fire, a Vampire's radiant).
   */
  suppressedByDamageTypeIds?: string[]
  outcomes: TOutcome[]
}

export type PathChoiceOptionAuthored<TOutcome extends OutcomeAuthored = OutcomeAuthored> =
  PathEntryWithMetadata & {
    resultBlock: ResultBlockAuthored<TOutcome>
  }

/** One tier of a hit-point path: its block resolves when the target's hit points are at most `atMost`. */
export type PathHitPointTierRowAuthored<TOutcome extends OutcomeAuthored = OutcomeAuthored> =
  PathEntryBase & {
    atMost: number // int >= 1
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
    | {
        /**
         * Exactly one tier applies, never several: the row with the lowest `atMost` that the target's
         * current hit points satisfy. No satisfied row means no effect.
         */
        selectionKind: 'HIT_POINT_TIERS'
        rows: PathHitPointTierRowAuthored<TOutcome>[]
      }
  )
