import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ConcentrationEndReason } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { ActiveEffectRepeatTrigger } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { CompiledActionZonePlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { CompiledManifestComponent } from '@artificer-toolkit/shared/compilers'
import type {
  SpatialEffectInstance,
  SpatialTriggerMode,
  SpatialTurnTrigger
} from '@artificer-toolkit/shared/vtt'

/**
 * The events an Encounter raises on the creature that holds effects or reactions (ADR 0039 decision
 * 4). The kinds are structural facts every System has; a System's event vocabulary binds its
 * authored codes to them, so shared code never names a System's events. A rest is the Sheet's event,
 * so only its subscription is here. See the rules-runtime guide's "Event hooks" section.
 */
export type EncounterEvent =
  /** The holder takes an action, which may make an attack roll or cast a spell, aimed at an enemy or not. */
  | { kind: 'ACTION'; attackRoll: boolean; spellCast: boolean; againstEnemy: boolean }
  /**
   * An attack roll is made against the holder, by `attackerActorId` on `turnActorId`'s turn. `melee`
   * is the attack's classification (a melee weapon or melee spell attack), never its distance.
   */
  | {
      kind: 'ATTACKED'
      holderActorId: string
      attackerActorId: string | null
      turnActorId: string | null
      melee: boolean
    }
  /** The holder's attack hits. */
  | { kind: 'HIT' }
  /**
   * The holder makes an ability check or saving throw. `ability` is the test's ability, by authored
   * code (null for a test with none, a death save) or by definition id, whose added dice it spends;
   * null for a test that adds no dice (a contest's), which never spends a die held for one that does.
   */
  | {
      kind: 'TEST'
      test: 'CHECK' | 'SAVE'
      ability: { code: string | null } | { definitionId: string } | null
    }
  /**
   * The holder takes damage. `AFTER`, it survived the holder's defenses and intercepts: of these types
   * (null for a source that dealt several), from `damagerActorId` (null when nobody dealt it).
   * `BEFORE`, it is about to land as the batch settling it plans it, taking the holder's current hit
   * points from `before` to `after`; an intercept it meets changes where it lands. `damageTaken` is the
   * whole blow after resistance, vulnerability and immunity (not the overflow past 0), of
   * `damageTypeId`, and `critical` when it came from a critical hit.
   */
  | {
      kind: 'DAMAGED'
      phase: 'AFTER'
      damagerActorId: string | null
      damageTypeIds: readonly (string | null)[]
      dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
    }
  | {
      kind: 'DAMAGED'
      phase: 'BEFORE'
      hitPoints: { before: number; after: number }
      damageTaken: number
      damageTypeId: string | null
      critical: boolean
    }
  /** An effect is about to kill the holder outright. */
  | { kind: 'KILLED' }
  /**
   * An attack or harmful spell is about to be aimed at the holder by a creature of this Creature type
   * (null for a Character, whose type is not in its facts).
   */
  | { kind: 'HARMFUL_ACTION_AIMED'; attackerCreatureTypeId: string | null }
  | { kind: 'HIT_POINTS_REGAINED' }
  /** The holder is defeated (dead, or at 0 hit points as its kind defeats). */
  | { kind: 'DEFEATED' }
  /** A held effect bars the holder from maintaining a link (the System's casting lock). */
  | { kind: 'MAINTENANCE_BARRED' }
  /** The holder is incapacitated or defeated, or the sources named are. */
  | { kind: 'INCAPACITATED'; of: 'HOLDER' }
  | { kind: 'INCAPACITATED'; of: 'SOURCE'; sourceActorIds: ReadonlySet<string> }
  /** The holder has these conditions. */
  | { kind: 'CONDITION_HELD'; conditionIds: readonly string[] }
  /** The holder neither holds nor wears any item but these. */
  | { kind: 'ITEM_RELEASED'; itemInstanceIdsOnActor: readonly string[] }
  /** Another creature uses this basic action on the holder. */
  | { kind: 'ACTION_USED_ON_HOLDER'; basicActionDefinitionId: string }
  /** The holder's turn ends without it attacking a hostile creature or taking damage. */
  | { kind: 'IDLE_TURN' }
  /** The holder moves of its own will. */
  | { kind: 'MOVED' }
  /** The holder leaves the area holding the effect. */
  | { kind: 'AREA_LEFT' }
  /**
   * An attack hits the holder: melee or ranged, a weapon or a spell attack, by an attacker it sees or
   * not, dealing these damage types.
   */
  | {
      kind: 'HIT_BY_ATTACK'
      melee: boolean
      weapon: boolean
      attackerSeen: boolean
      damageTypeIds: ReadonlySet<string>
    }
  /** Another creature casts a spell. */
  | { kind: 'SPELL_CAST_BY_OTHER' }
  /** The holder is chosen as a target of a cast of `castOwnerId` (the spell cast). */
  | { kind: 'TARGETED_BY_CAST'; castOwnerId: string }
  /**
   * A creature's footprint meets a zone, which holds the subscription: as it moves (enters and stays,
   * leaves, or passes through), at a turn boundary while it stands inside (its own turn's start or
   * end, or the zone source's turn start), or as it hits the zone's source with a melee attack.
   */
  | { kind: 'ZONE_MOVEMENT'; movement: SpatialTriggerMode }
  | { kind: 'ZONE_TURN'; boundary: SpatialTurnTrigger }
  | { kind: 'ZONE_SOURCE_MELEE_HIT' }

/** What an authored subscription listens for: an event kind and the filters it adds. */
export type EncounterEventSubscription =
  | {
      event: 'ACTION'
      /** The fact the action must raise (null: any action). */
      fact: 'attackRoll' | 'spellCast' | null
      /** Only an action aimed at an enemy of the holder. */
      againstEnemyOnly: boolean
    }
  /** `valueDomainCode` is the domain whose grants decide which tests spend the effect. */
  | { event: 'TEST'; test: 'CHECK' | 'SAVE'; valueDomainCode: string }
  | { event: 'DAMAGED'; by: 'ANYONE' | 'SOURCE_SIDE'; damageTypeIds: readonly string[] | null }
  | { event: 'INCAPACITATED'; of: 'HOLDER' | 'SOURCE' }
  /**
   * The holder stands farther than `beyondFeet` from the source. No event raises it: the
   * post-commit relationship sweep measures the Scene (`encounterSeparatedEffects`).
   */
  | { event: 'SEPARATED'; from: 'SOURCE'; beyondFeet: number }
  | { event: 'CONDITION_HELD'; conditionIds: readonly string[] }
  | { event: 'ACTION_USED_ON_HOLDER'; actionDefinitionIds: readonly string[] }
  | { event: 'REST'; restKind: 'SHORT' | 'LONG' }
  | {
      event:
        | 'ATTACKED'
        | 'HIT'
        | 'HIT_POINTS_REGAINED'
        | 'DEFEATED'
        | 'MAINTENANCE_BARRED'
        | 'ITEM_RELEASED'
        | 'IDLE_TURN'
        | 'MOVED'
        | 'AREA_LEFT'
    }

/** What an effect does when one of its subscriptions is met: it ends, or its holder repeats its save. */
export type EncounterEffectHook =
  | { hook: 'END'; subscription: EncounterEventSubscription }
  | {
      hook: 'REPEAT_SAVE'
      subscription: Extract<EncounterEventSubscription, { event: 'DAMAGED' }>
      trigger: ActiveEffectRepeatTrigger
    }

/**
 * What a maintenance link (Concentration) does when an event meets one of its subscriptions: it
 * breaks for `reason`, or its holder owes a save. The System supplies the hooks in priority order.
 */
export type MaintenanceLinkHook =
  | {
      hook: 'BREAK'
      reason: Exclude<ConcentrationEndReason, 'CHOSEN'>
      subscription: EncounterEventSubscription
    }
  | { hook: 'SAVE'; subscription: Extract<EncounterEventSubscription, { event: 'DAMAGED' }> }

/**
 * A reaction an event offers its holder, by the event and the authored trigger it met. A damage-type
 * reaction names the types that triggered it (those it names that the hit deals), which its effect
 * may bind; any other names none.
 */
export type EncounterReactionHook =
  | {
      event: 'HIT_BY_ATTACK'
      trigger: 'ATTACKED_SELF' | 'DAMAGE_TAKEN'
      triggerDamageTypeIds: readonly string[]
    }
  | { event: 'SPELL_CAST_BY_OTHER'; trigger: 'SPELL_CAST' }
  | { event: 'TARGETED_BY_CAST'; trigger: 'TARGETED_SELF' }

/**
 * A held damage interception (`DAMAGE_INTERCEPTION`) by its authored payload, which is its
 * subscription: it intercepts damage about to take its holder from above 0 hit points to 0, and an
 * outright kill when `negatesKill`.
 */
export type DamageInterceptionSubscription = {
  negatesKill: boolean
  /** A blow of these types, or a critical hit, is not met. */
  excludes?: { damageTypeIds: readonly string[]; critical: boolean }
  /** A blow taking more than this many hit points is not met. */
  maxDamageTaken?: number
}

/**
 * A held incoming gate (`INCOMING_ATTACK_GATE`) by its authored payload, which is its subscription: it
 * intercepts a harmful action aimed at its holder by an attacker of a listed Creature type (any
 * attacker when unlisted).
 */
export type IncomingGateSubscription = {
  payload: { attackerCreatureTypeIds?: readonly string[] | undefined }
}

/**
 * A placed zone's compiled interactions, which are its subscription: the movements, the turn
 * boundaries and the melee hit on its source it acts on.
 */
export type ZoneEventSubscription = Pick<
  SpatialEffectInstance,
  'triggerModes' | 'turnTriggers' | 'retaliatesMeleeHits'
>

/** The recurrence a stored effect authors its subscriptions in. */
export type EncounterEffectRecurrence = Extract<
  ActiveRuleEffectRecord['definition'],
  { schemaVersion: 2 }
>['recurrence']

/** System-owned event vocabulary: how the System's authored codes subscribe to the event table. */
export interface EventVocabularyCapabilityAdapter {
  readonly gameSystemId: string
  /** The hooks an effect's recurrence authors, in authored order; a code the System lacks throws. */
  effectHooks(recurrence: EncounterEffectRecurrence): readonly EncounterEffectHook[]
  /**
   * The subscription a zone component's authored interactions compile to, in canonical order; null
   * when it names none, or one the System does not model.
   */
  zoneSubscription(
    interactionKinds: CompiledManifestComponent['interactionKinds']
  ): Pick<
    CompiledActionZonePlacement,
    'triggerModes' | 'turnTriggers' | 'retaliatesMeleeHits'
  > | null
}
