import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ActiveEffectRepeatTrigger } from '@artificer-toolkit/schema/shared/activeRuleEffects'

/**
 * The events an Encounter or Sheet raises on the creature that holds effects (ADR 0039 decision 4).
 * The kinds are structural facts every System has; a System's event vocabulary binds its authored
 * codes to them, so shared code never names a System's events. See the rules-runtime guide's
 * "Event hooks" section.
 */
export type EncounterEvent =
  /** The holder takes an action, which may make an attack roll or cast a spell, aimed at an enemy or not. */
  | { kind: 'ACTION'; attackRoll: boolean; spellCast: boolean; againstEnemy: boolean }
  /** An attack roll is made against the holder, by `attackerActorId` on `turnActorId`'s turn. */
  | {
      kind: 'ATTACKED'
      holderActorId: string
      attackerActorId: string | null
      turnActorId: string | null
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
   * The holder takes damage that survived its defenses, of these types (null for a source that dealt
   * several), from `damagerActorId` (null when nobody dealt it).
   */
  | {
      kind: 'DAMAGED'
      damagerActorId: string | null
      damageTypeIds: readonly (string | null)[]
      dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
    }
  | { kind: 'HIT_POINTS_REGAINED' }
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
  /** The holder finishes a rest. */
  | { kind: 'REST'; restKind: 'SHORT' | 'LONG' }

/** What an authored subscription listens for: an event kind and the filters it adds. */
export type EncounterEventSubscription =
  | {
      event: 'ACTION'
      requires: 'ANY' | 'ATTACK_ROLL' | 'SPELL_CAST'
      /** Only an action aimed at an enemy of the holder. */
      againstEnemyOnly: boolean
    }
  /** `valueDomainCode` is the domain whose grants decide which tests spend the effect. */
  | { event: 'TEST'; test: 'CHECK' | 'SAVE'; valueDomainCode: string }
  | { event: 'DAMAGED'; by: 'ANYONE' | 'SOURCE_SIDE'; damageTypeIds: readonly string[] | null }
  | { event: 'INCAPACITATED'; of: 'HOLDER' | 'SOURCE' }
  | { event: 'CONDITION_HELD'; conditionIds: readonly string[] }
  | { event: 'ACTION_USED_ON_HOLDER'; actionDefinitionIds: readonly string[] }
  | { event: 'REST'; restKind: 'SHORT' | 'LONG' }
  | {
      event:
        | 'ATTACKED'
        | 'HIT'
        | 'HIT_POINTS_REGAINED'
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
}
