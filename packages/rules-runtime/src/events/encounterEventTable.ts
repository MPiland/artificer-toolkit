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
import type { EncounterActionSceneContext } from '../encounterActionTargetPolicy.js'

/**
 * The events an Encounter raises on the creature that holds effects or reactions (ADR 0039 decision
 * 4). The kinds are structural facts every System has; a System's event vocabulary binds its
 * authored codes to them, so shared code never names a System's events. Every way an effect's
 * lifetime ends is one of them (a rest too, which the Sheet raises). See the rules-runtime guide's
 * "Event hooks" section.
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
  /** The holder's turn begins. */
  | { kind: 'TURN_STARTED' }
  /** The holder fails a saving throw this exact rule definition asked for. */
  | { kind: 'SAVE_FAILED'; definition: { id: string; version: number; checksum: string } }
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
  /** The holder leaves the area of this zone, which ends the effects the zone holds on it. */
  | { kind: 'AREA_LEFT'; zoneEffectId: string }
  /**
   * A turn of the actor the effect counts its lifetime on starts or ends. The caller raises it on
   * the effects anchored to that actor.
   */
  | { kind: 'TURN_BOUNDARY'; stage: 'START_OF_TURN' | 'END_OF_TURN' }
  /** The holder's token stands `feet` from `sourceActorId`'s, measured between footprints. */
  | { kind: 'SEPARATED'; sourceActorId: string; feet: number }
  /** The holder finishes a rest of this kind. */
  | { kind: 'REST'; restKind: 'SHORT' | 'LONG' }
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
  /** Another creature rolls the d20 of an attack roll, before its result is shown. */
  | { kind: 'ATTACK_ROLLED_BY_OTHER' }
  /**
   * Another creature's attack, aimed at a creature other than the holder, is about to roll its d20:
   * whether the holder sees the attacker, the attacker's size code, the Scene from the holder to the
   * attack's target (null off a Scene), and the equipment categories the holder has equipped.
   */
  | {
      kind: 'ATTACK_AIMED_AT_OTHER'
      gameSystemId: string
      attackerSeen: boolean
      attackerSizeCode: string | null
      targetScene: EncounterActionSceneContext | null
      holderEquippedCategories: readonly string[]
    }
  /**
   * An attack on the holder has hit or missed: whether the holder sees the attacker, the attacker's
   * size code, and the Scene from the holder to the attacker (null off a Scene).
   */
  | {
      kind: 'ATTACK_RESOLVED_ON_HOLDER'
      gameSystemId: string
      hit: boolean
      attackerSeen: boolean
      attackerSizeCode: string | null
      attackerScene: EncounterActionSceneContext | null
    }
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
  /** The holder stands farther than `beyondFeet` from the effect's source. */
  | { event: 'SEPARATED'; from: 'SOURCE'; beyondFeet: number }
  /** A turn boundary of this stage, of the actor the effect counts its lifetime on. */
  | { event: 'TURN_BOUNDARY'; stage: 'START_OF_TURN' | 'END_OF_TURN' }
  | { event: 'CONDITION_HELD'; conditionIds: readonly string[] }
  | { event: 'ACTION_USED_ON_HOLDER'; actionDefinitionIds: readonly string[] }
  | { event: 'REST'; restKind: 'SHORT' | 'LONG' }
  /** The failed save of the rule definition pinned at exactly this version and checksum. */
  | { event: 'SAVE_FAILED'; definition: { id: string; version: number; checksum: string } }
  | {
      event:
        | 'ATTACKED'
        | 'HIT'
        | 'HIT_POINTS_REGAINED'
        | 'DEFEATED'
        | 'TURN_STARTED'
        | 'MAINTENANCE_BARRED'
        | 'ITEM_RELEASED'
        | 'IDLE_TURN'
        | 'MOVED'
        | 'AREA_LEFT'
    }

/**
 * What an effect does when one of its subscriptions is met: it ends, it counts one tick off its
 * lifetime (and ends when none remain), or its holder repeats its save.
 */
export type EncounterEffectHook =
  | { hook: 'END'; subscription: EncounterEventSubscription }
  | {
      hook: 'COUNT_DOWN'
      subscription: Extract<EncounterEventSubscription, { event: 'TURN_BOUNDARY' }>
    }
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
 * What an action the rules raise does when an event meets its subscription: the Encounter runs it as
 * its holder's own action, once the command that raised the event has committed. The holder is
 * defeated, its turn begins, or it fails the save a rule asked for.
 */
export type EncounterRaiseActionHook = {
  hook: 'RAISE_ACTION'
  subscription:
    | { event: 'DEFEATED' | 'TURN_STARTED' }
    | Extract<EncounterEventSubscription, { event: 'SAVE_FAILED' }>
}

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
  | { event: 'ATTACK_ROLLED_BY_OTHER'; trigger: 'ATTACK_ROLL_BY_OTHER' }
  | { event: 'ATTACK_AIMED_AT_OTHER'; trigger: 'ATTACK_ON_OTHER' }
  | { event: 'ATTACK_RESOLVED_ON_HOLDER'; trigger: 'ATTACK_RESOLVED_ON_SELF' }
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

/**
 * An actor relationship hold (a grapple) by its sealed payload, which is its subscription: it breaks
 * once the held creature stands beyond the reach it sealed from its source, or the source can't act.
 */
export type RelationshipHoldSubscription = { sourceActorId: string; sealedReachFeet: number }

/** The recurrence a stored effect authors its subscriptions in. */
export type EncounterEffectRecurrence = Extract<
  ActiveRuleEffectRecord['definition'],
  { schemaVersion: 2 }
>['recurrence']

/** System-owned event vocabulary: how the System's authored codes subscribe to the event table. */
export interface EventVocabularyCapabilityAdapter {
  readonly gameSystemId: string
  /**
   * The hooks an effect's recurrence authors, in authored order; a code the System lacks throws. The
   * count of a timed effect is structural, so `effectHooks` adds it for every System.
   */
  effectHooks(recurrence: EncounterEffectRecurrence): readonly EncounterEffectHook[]
  /**
   * The hook a passive Effect's authored trigger code subscribes, so the Encounter raises the Effect
   * as its holder's action; null for a trigger that raises no action.
   */
  raiseActionHook(triggerCode: string): EncounterRaiseActionHook | null
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
