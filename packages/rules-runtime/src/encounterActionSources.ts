import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { characterFormCreatureView } from './encounterActorForm.js'
import { StaleCharacterActionError, UnavailableCreatureActionError } from './encounterErrors.js'
import { discoverEncounterFeatureActions } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { snapshotFeatureDefinitions } from './encounterActorState.js'
import { isInstalledMeleeAttackTrigger } from './platformRulesRuntime.js'
import type { EncounterFeatureActionCapabilityDescriptor } from './encounterFeatureActionCapabilityDiscovery.js'
import {
  parseGrantedActionId,
  resolveGrantedAction,
  standingGrantedActions
} from './encounterGrantedActions.js'
import {
  discoverEncounterRepeatPath,
  parseRepeatPathActionId,
  type EncounterRepeatPathCapabilityDescriptor
} from './encounterRepeatPathAction.js'
import {
  discoverEncounterRuleAction,
  parseEncounterRuleActionId,
  type EncounterRuleActionCapabilityDescriptor
} from './encounterRuleAction.js'
import {
  discoverEncounterBasicActions,
  isEncounterBasicActionId,
  type EncounterBasicActionCapabilityDescriptor,
  type EncounterBasicActionEntry
} from './encounterBasicActionCapabilityDiscovery.js'

type CompiledCharacterAction = Extract<
  CompiledActionEntryPoint,
  { kind: 'CHARACTER_ACTION'; compilation: { kind: 'COMPILED' } }
>

export type EncounterActionSourceInput = {
  actor: EncounterRunActorState
  actionId: string
  gameSystemId: string
  characterSource?: {
    id: string
    streamVersion: number
    candidate: CharacterActionCandidate
    entry: CompiledCharacterAction
    effectivePolicyOutput: CharacterRulePolicyOutput
  }
  system?: SystemAuthoredDto
  /** The Run's pinned Spells (D163), so a Creature's granted casts are discovered. */
  spells: ReadonlyMap<string, CompiledSpell>
  /** The System's current authored basic actions, read for a basic action's identity. */
  basicActions?: readonly EncounterBasicActionEntry[]
  /**
   * The actor's held effects and the once-per-turn keys it has spent, read for a granted action
   * (D160); required when `actionId` names one.
   */
  granted?: {
    heldEffects: Parameters<typeof resolveGrantedAction>[0]['heldEffects']
    spentKeys: readonly string[]
  }
  /**
   * Every Run actor's held effects, the Run's turn and the once-per-turn keys the actor has spent,
   * read for a repeat offer (D166, D190a); required when `actionId` names one.
   */
  repeat?: Pick<
    Parameters<typeof discoverEncounterRepeatPath>[0],
    'effectsByHolder' | 'turn' | 'spentKeys'
  >
  /** The Run's automation mode and optional combat rules, read for a rule-raised action. */
  rules?: Pick<EncounterRunState, 'automationMode' | 'optionalCombatSnapshot'>
}

/** What a caller names; the loader adds the System and the basic action the id names. */
export type EncounterActionSourceRequest = Omit<
  EncounterActionSourceInput,
  'system' | 'basicActions' | 'repeat' | 'spells' | 'rules'
>

export type NativeEncounterActionSource =
  | {
      kind: 'CREATURE'
      actor: EncounterRunActorState
      capability: EncounterFeatureActionCapabilityDescriptor
    }
  | {
      kind: 'BASIC_ACTION'
      actor: EncounterRunActorState
      capability: EncounterBasicActionCapabilityDescriptor
      /** Set when a held effect's offer grants the action: the key its use spends, null for none. */
      grantedUseKey?: string | null
    }
  | {
      kind: 'REPEAT_PATH'
      actor: EncounterRunActorState
      capability: EncounterRepeatPathCapabilityDescriptor
      /** The item the cast chose, which the repeat's paths act on. */
      boundItemInstanceId?: string
      /** Set when the use is a free cast-turn use (D190a): the key it spends. */
      grantedUseKey?: string
    }
  | {
      kind: 'RULE'
      actor: EncounterRunActorState
      capability: EncounterRuleActionCapabilityDescriptor
    }
  | {
      kind: 'CHARACTER_ACTION'
      actor: EncounterRunActorState
      characterId: string
      characterStreamVersion: number
      candidate: CharacterActionCandidate
      entry: CompiledCharacterAction
      effectivePolicyOutput: CharacterRulePolicyOutput
    }

/**
 * Whether the source's action is a melee attack, by the System's classification of its trigger (a
 * melee weapon or melee spell attack), never by distance: a reach attack is still melee.
 */
export function isMeleeAttackSource(gameSystemId: string, source: NativeEncounterActionSource) {
  return isInstalledMeleeAttackTrigger(
    gameSystemId,
    source.kind === 'CHARACTER_ACTION'
      ? source.candidate.mechanicFacts.invocation.triggerCode
      : source.capability.mechanicFacts.invocation.triggerCode
  )
}

/** The ability definitions a System authors, as Creature discovery reads them. */
export function systemAbilityDefinitions(system: SystemAuthoredDto) {
  return 'abilities' in system && Array.isArray(system.abilities)
    ? system.abilities.map((ability) => ({ id: ability.id, code: ability.code }))
    : []
}

/** Resolves an action from current authoritative sources, never caller mechanics. */
export function resolveEncounterActionSource(
  input: EncounterActionSourceInput
): NativeEncounterActionSource {
  const { actor } = input
  if (actor.systemId !== input.gameSystemId)
    throw new Error('Encounter action source does not match the Encounter Game System.')
  if (parseRepeatPathActionId(actor.id, input.actionId)) {
    const { system } = input
    if (!system || system.id !== input.gameSystemId || !input.repeat)
      throw new Error('The selected repeat action source is stale.')
    const { capability, boundItemInstanceId, freeUseKey } = discoverEncounterRepeatPath({
      ...input.repeat,
      actorId: actor.id,
      actionId: input.actionId,
      gameSystemId: input.gameSystemId,
      conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: systemAbilityDefinitions(system)
    })
    return {
      kind: 'REPEAT_PATH',
      actor,
      capability,
      ...(boundItemInstanceId === undefined ? {} : { boundItemInstanceId }),
      ...(freeUseKey === null ? {} : { grantedUseKey: freeUseKey })
    }
  }
  // A rule-raised action belongs to the rule, so any actor kind takes it the same way.
  if (parseEncounterRuleActionId(actor.id, input.actionId)) {
    const { system } = input
    if (!system || system.id !== input.gameSystemId || !input.rules)
      throw new Error('The selected rule action is stale.')
    const capability = discoverEncounterRuleAction({
      actorId: actor.id,
      actionId: input.actionId,
      gameSystemId: input.gameSystemId,
      state: input.rules,
      conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: systemAbilityDefinitions(system)
    })
    return { kind: 'RULE', actor, capability }
  }
  if (isEncounterBasicActionId(actor.id, input.actionId)) {
    const { system } = input
    if (!system || system.id !== input.gameSystemId)
      throw new Error('The selected basic action source is stale.')
    const grantedId = parseGrantedActionId(input.actionId)
    const granted = grantedId
      ? resolveGrantedAction({
          actionId: input.actionId,
          heldEffects: input.granted?.heldEffects ?? [],
          standing: standingGrantedActions(snapshotFeatureDefinitions(actor)),
          spentKeys: input.granted?.spentKeys ?? []
        })
      : null
    const baseActionId = granted?.baseActionId ?? input.actionId
    const capability = discoverEncounterBasicActions({
      actorId: actor.id,
      gameSystemId: input.gameSystemId,
      entries: input.basicActions ?? [],
      conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: systemAbilityDefinitions(system)
    }).available.find((value) => value.actionId === baseActionId)
    if (!capability) throw new Error('The selected basic action source is stale.')
    if (!granted) return { kind: 'BASIC_ACTION', actor, capability }
    // The offer decides what the action spends; the action's own mechanics are unchanged.
    const { invocation } = capability.mechanicFacts
    return {
      kind: 'BASIC_ACTION',
      actor,
      grantedUseKey: granted.useKey,
      capability: {
        ...capability,
        actionId: input.actionId,
        mechanicFacts: {
          ...capability.mechanicFacts,
          invocation: {
            ...invocation,
            activation: { ...invocation.activation, code: granted.offer.activation, amount: 1 }
          }
        }
      }
    }
  }
  // A Character in a creature form acts from the form's stat block, not its Sheet (SPELLS-28.T4d).
  const creature = actor.kind === 'CHARACTER' ? characterFormCreatureView(actor) : actor
  if (actor.kind === 'CHARACTER' && creature === null) {
    const character = input.characterSource
    if (
      !character ||
      actor.sourceId !== character.id ||
      actor.systemId !== input.gameSystemId ||
      character.entry.actionId !== input.actionId ||
      character.entry.effectId !== character.candidate.effectId
    )
      throw new StaleCharacterActionError('The selected Character action source is stale.')
    return {
      kind: 'CHARACTER_ACTION',
      actor,
      characterId: character.id,
      characterStreamVersion: character.streamVersion,
      candidate: character.candidate,
      entry: character.entry,
      effectivePolicyOutput: character.effectivePolicyOutput
    }
  }
  if (creature?.kind !== 'CREATURE')
    throw new Error('Native action execution requires an action source.')
  const system = input.system
  if (!system || system.id !== input.gameSystemId)
    throw new Error('The selected Creature action source is stale.')
  const actions = discoverEncounterFeatureActions({
    actor: creature,
    conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: systemAbilityDefinitions(system),
    spells: input.spells
  })
  // A passive effect that fires on reaching 0 hit points is a source only for the creature it
  // defeated; admission lets only a rule-raised root name a defeated actor. A start-of-turn trait
  // is a source for its holder; admission lets only a rule-raised root name it.
  const capability =
    actions.available.find((value) => value.actionId === input.actionId) ??
    (creature.defeated
      ? actions.passiveHpZeroEffects
          .map((effect) => effect.capability)
          .find((value) => value.actionId === input.actionId)
      : undefined) ??
    actions.passiveStartOfTurnEffects
      .map((effect) => effect.capability)
      .find((value) => value.actionId === input.actionId)
  if (!capability) {
    const unavailable = actions.unavailable.find((value) => value.actionId === input.actionId)
    if (unavailable) throw new UnavailableCreatureActionError(unavailable.label, unavailable.reason)
    throw new Error('The selected Creature action source is stale.')
  }
  return { kind: 'CREATURE', actor, capability }
}

/**
 * The Creature's Legendary Action Features. Their options run only in a Legendary window at the end
 * of another creature's turn, never as the Creature's own turn action (D63).
 */
export function encounterLegendaryActionFeatureIds(
  actor: EncounterRunActorState
): ReadonlySet<string> {
  return new Set(
    snapshotFeatureDefinitions(actor)
      .filter((feature) => feature.section === 'LEGENDARY_ACTION')
      .map((feature) => feature.id)
  )
}

/** The action's display name for logs and prompts; a Character action may have none. */
export function encounterActionSourceLabel(source: NativeEncounterActionSource): string {
  return source.kind === 'CHARACTER_ACTION' ? source.candidate.label : source.capability.label
}
