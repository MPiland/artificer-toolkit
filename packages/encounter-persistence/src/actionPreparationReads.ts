import { prepareEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import { evaluateEncounterAttackAction } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { parseGrantedActionId } from '@artificer-toolkit/rules-runtime/encounterGrantedActions'
import { parseRepeatPathActionId } from '@artificer-toolkit/rules-runtime/encounterRepeatPathAction'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { readEncounterBasicActionEntries } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  resolveEncounterActionSource,
  type EncounterActionSourceRequest,
  type NativeEncounterActionSource
} from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  readEncounterDisarmSelection,
  requireEncounterDisarmDefinition
} from '@artificer-toolkit/rules-runtime/encounterDisarmPreparation'
import { encounterFacingRule } from '@artificer-toolkit/rules-runtime/encounterFacing'
import { loadEncounterFlankingFacts } from '@artificer-toolkit/rules-runtime/encounterPositionalContributors'
import { encounterHolderState } from '@artificer-toolkit/rules-runtime/encounterHolderDefense'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import {
  lockedRelationshipActionFacts,
  type EncounterRelationshipD20Contributor
} from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import type { EncounterWieldConflictAcceptance } from '@artificer-toolkit/rules-runtime/encounterWieldConflict'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'
import type { CharacterTurnFacts } from '@artificer-toolkit/rules-runtime/character/turnFacts'
import type { GetEncounterOptionalActionChoicesInputDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { ActionSceneRequestDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  readEncounterActionAreaSceneInputs,
  readEncounterActionSceneInputs
} from './actionSceneInputs.js'
import { rejectDomain } from './domainRejections.js'
import { refuseStaleCharacterAction } from './staleCharacterAction.js'
import { listActiveRuleEffects } from './effectStore.js'
import { loadMovementTargets } from './movementTargetReads.js'
import { readRunActors } from './documents.js'
import { readEncounterSpellPins } from './spellPins.js'
import { readTurnMovedFeet, readTurnUses } from './turnMovement.js'
import type { EncounterReadPorts, EncounterTurnReadTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

type Campaign = EncounterDocument<'campaigns'>

type ActionEconomyInput<TFacts extends CharacterTurnFacts> = {
  actor: EncounterRunActorState
  state: EncounterRunState
  campaign: Campaign
  activation: { code: string; amount: number }
  target?: MovementTarget<TFacts>
}

/** Re-reads exact action geometry in the same transaction as its mechanics. */
export async function readActionSceneContext(
  tx: EncounterTurnReadTransaction,
  state: EncounterRunState,
  command: ActionSceneRequestDto
) {
  const inputs = await readEncounterActionSceneInputs(tx, state, command, tx.ports.sceneReaders)
  if (!inputs) return null
  const { sceneGrid, ...context } = inputs
  return {
    ...context,
    grid: resolveEncounterSceneGrid({ encounter: state, sceneGrid })
  }
}

/** The current published definitions as the Campaign's owner reads them. */
export function campaignDefinitions(
  tx: { readonly ports: Pick<EncounterReadPorts, 'readCurrentDefinition'> },
  campaign: Campaign
) {
  return {
    requireCurrent: async (definitionId: string) => {
      const current = await tx.ports.readCurrentDefinition(definitionId, campaign.ownerUserId)
      if (!current) throw new Error('The rule definition is unavailable.')
      return current
    }
  }
}

/** What the actor can do now, read from its current target; the caller's own target when it has one. */
export async function readActionHolderState(
  tx: EncounterTurnReadTransaction,
  input: {
    actor: EncounterRunActorState
    state: EncounterRunState
    campaign: Campaign
    target?: MovementTarget
  }
) {
  const target =
    input.target ??
    (
      await loadMovementTargets(tx, {
        state: input.state,
        campaign: input.campaign,
        targetActorIds: [input.actor.id]
      })
    ).get(input.actor.id)
  if (!target) throw new Error('Encounter actor state is unavailable.')
  return encounterHolderState({
    target,
    gameSystemId: input.state.gameSystemId,
    definitions: campaignDefinitions(tx, input.campaign),
    speedDefinitions: (await tx.ports.requireSystem(input.state.gameSystemId)).speeds,
    runEffectsByActorId: await loadRunActiveEffects(tx, {
      state: input.state,
      actors: await readRunActors(tx, input.state)
    }),
    readTurnMovedFeet: () => readTurnMovedFeet(tx, { state: input.state, actorId: input.actor.id })
  })
}

function economyInput<TFacts extends CharacterTurnFacts>(
  tx: EncounterTurnReadTransaction<TFacts>,
  input: ActionEconomyInput<TFacts>
) {
  return {
    actor: input.actor,
    state: input.state,
    activation: input.activation,
    target: input.target,
    loadTarget: async () =>
      (
        await loadMovementTargets(tx, {
          state: input.state,
          campaign: input.campaign,
          targetActorIds: [input.actor.id]
        })
      ).get(input.actor.id),
    definitions: campaignDefinitions(tx, input.campaign)
  }
}

/** Refuses an unavailable allowance (movement and Disarm have no override). */
export async function prepareActionEconomy<TFacts extends CharacterTurnFacts>(
  tx: EncounterTurnReadTransaction<TFacts>,
  input: ActionEconomyInput<TFacts>
) {
  return prepareEncounterActionEconomy(economyInput(tx, input))
}

/**
 * Reports an unavailable allowance as overridable for Assisted RESOLVE_ACTION, and where an attack
 * stands in the actor's Attack action (`triggerCode` is empty for actions that are not attacks).
 */
export async function evaluateActionAttackAction<TFacts extends CharacterTurnFacts>(
  tx: EncounterTurnReadTransaction<TFacts>,
  input: ActionEconomyInput<TFacts> & {
    triggerCode: string
    replacesAttack?: boolean
    /** The Creature Feature the action belongs to, when a slot may name it. */
    featureId?: string
  }
) {
  return evaluateEncounterAttackAction({
    ...economyInput(tx, input),
    triggerCode: input.triggerCode,
    replacesAttack: input.replacesAttack,
    featureId: input.featureId
  })
}

/** Resolves an action from current authoritative sources, never caller mechanics. */
async function loadActionSource(
  tx: EncounterTurnReadTransaction,
  campaign: Campaign,
  state: EncounterRunState,
  input: EncounterActionSourceRequest
): Promise<NativeEncounterActionSource> {
  if (input.actor.systemId !== input.gameSystemId)
    throw new Error('Encounter action source does not match the Encounter Game System.')
  const basicActions = await readEncounterBasicActionEntries({
    actorId: input.actor.id,
    actionId: input.actionId,
    gameSystemId: input.gameSystemId,
    definitions: campaignDefinitions(tx, campaign)
  })
  const system =
    input.actor.kind === 'CREATURE' ||
    (input.actor.kind === 'CHARACTER' && input.actor.form !== null) ||
    basicActions.length > 0 ||
    parseRepeatPathActionId(input.actor.id, input.actionId)
      ? await tx.ports.requireSystem(input.gameSystemId)
      : undefined
  // A granted action resolves against the holder's effects and spent uses as they stand now (D160).
  const granted =
    input.actor.kind !== 'CUSTOM' && parseGrantedActionId(input.actionId)
      ? {
          heldEffects: await listActiveRuleEffects(tx, turnEffectOwner(input.actor, state.id)),
          spentKeys: await readTurnUses(tx, { state, actorId: input.actor.id })
        }
      : undefined
  // A repeat offer resolves against every holder's effects: its carrier is on the creature it repeats
  // on. A free cast-turn use resolves against the turn and its spent uses (D190a).
  const repeat = parseRepeatPathActionId(input.actor.id, input.actionId)
    ? {
        effectsByHolder: await loadRunActiveEffects(tx, {
          state,
          actors: await readRunActors(tx, state)
        }),
        turn: state,
        spentKeys: await readTurnUses(tx, { state, actorId: input.actor.id })
      }
    : undefined
  // Only a Creature, or a Character in a Creature form, casts from the Run's pinned Spells (D163).
  const spells = system ? await readEncounterSpellPins(tx, state.id) : new Map()
  return resolveEncounterActionSource({
    ...input,
    system,
    basicActions,
    granted,
    repeat,
    spells
  })
}

/** Every current Run actor's active effects, keyed by actor; `given` effects are used as read. */
async function loadRunActiveEffects(
  tx: EncounterTurnReadTransaction,
  input: {
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    given?: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  }
) {
  const expectedActorIds = new Set(input.state.actorIds)
  if (
    expectedActorIds.size !== input.state.actorIds.length ||
    input.actors.length !== expectedActorIds.size ||
    new Set(input.actors.map((actor) => actor.id)).size !== input.actors.length ||
    input.actors.some(
      (actor) => actor.encounterId !== input.state.id || !expectedActorIds.has(actor.id)
    )
  )
    throw new Error('Encounter actor state does not match the Run.')
  if (input.actors.some((actor) => actor.kind === 'CHARACTER' && !actor.sourceId))
    throw new Error('Encounter Character actor source is unavailable.')
  return new Map(
    await Promise.all(
      input.actors.map(
        async (actor) =>
          [
            actor.id,
            input.given?.get(actor.id) ??
              (await listActiveRuleEffects(
                tx,
                actor.kind === 'CHARACTER'
                  ? { kind: 'CHARACTER', characterId: actor.sourceId! }
                  : {
                      kind: 'ENCOUNTER_ACTOR',
                      encounterId: input.state.id,
                      targetActorId: actor.id
                    }
              ))
          ] as const
      )
    )
  )
}

/** Loads every current Run actor's effects before preparing relationship-bound action facts. */
export async function loadActionRelationshipFacts(
  tx: EncounterTurnReadTransaction,
  input: {
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    sourceActorId: string
    targetActorId: string
    actionEffectId: string
    activeEffectsByActorId?: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  }
): Promise<readonly EncounterRelationshipD20Contributor[]> {
  const expectedActorIds = new Set(input.state.actorIds)
  if (!expectedActorIds.has(input.sourceActorId) || !expectedActorIds.has(input.targetActorId))
    throw new Error('Encounter actor state does not match the Run.')
  const activeEffectsByActorId = await loadRunActiveEffects(tx, {
    state: input.state,
    actors: input.actors,
    ...(input.activeEffectsByActorId ? { given: input.activeEffectsByActorId } : {})
  })
  return lockedRelationshipActionFacts({
    actionEffectId: input.actionEffectId,
    sourceActorId: input.sourceActorId,
    targetActorId: input.targetActorId,
    targets: { activeEffectsByActorId }
  })
}

/** Loads current source, target, and resource facts without choosing a caller policy or publishing. */
export async function prepareActionMechanics<TFacts extends CharacterTurnFacts>(
  tx: EncounterTurnReadTransaction<TFacts>,
  input: {
    state: EncounterRunState
    campaign: Campaign
    actor: EncounterRunActorState
    target: EncounterRunActorState
    actors: readonly EncounterRunActorState[]
    actionId: string
    wieldConflictAcceptance: EncounterWieldConflictAcceptance
    overridable: boolean
    readsSharedTest?: boolean
    ammunition?: { itemInstanceId?: string; attacks: number }
    movementTargets?: ReadonlyMap<string, MovementTarget<TFacts>>
    sceneContext?: Awaited<ReturnType<typeof readActionSceneContext>>
    loadAttackPerception?: Parameters<
      typeof prepareEncounterActionMechanics<TFacts>
    >[0]['loadAttackPerception']
    /** Which observers see the subject, for a melee attack's Flanking facts on its Scene. */
    observersSeeing?: Parameters<typeof loadEncounterFlankingFacts>[0]['observersSeeing']
  }
) {
  const { state, actor, target } = input
  const movementTargets =
    input.movementTargets ??
    (await loadMovementTargets(tx, {
      state,
      campaign: input.campaign,
      targetActorIds: [...new Set([actor.id, target.id])],
      includeReactionSources: true
    }))
  return prepareEncounterActionMechanics({
    state,
    actor,
    target,
    actors: input.actors,
    actionId: input.actionId,
    wieldConflictAcceptance: input.wieldConflictAcceptance,
    overridable: input.overridable,
    readsSharedTest: input.readsSharedTest,
    ammunition: input.ammunition,
    movementTargets,
    sceneContext: input.sceneContext,
    loadAttackPerception: input.loadAttackPerception,
    loadFlanking: async ({ sourceFacts, targetFacts, capabilityDefinitionId }) => {
      const { sceneContext, observersSeeing } = input
      if (!sceneContext || !observersSeeing) return null
      const scene = await readEncounterActionAreaSceneInputs(
        tx,
        state,
        {
          actorId: actor.id,
          sceneId: sceneContext.sceneId,
          expectedSceneVersion: sceneContext.sceneVersion
        },
        tx.ports.sceneReaders
      )
      return loadEncounterFlankingFacts({
        gameSystemId: state.gameSystemId,
        actors: input.actors,
        attacker: sourceFacts,
        target: targetFacts,
        grid: sceneContext.grid,
        tokens: scene.tokens,
        capabilityDefinitionId,
        loadTarget: async (entry) => {
          const loaded =
            movementTargets.get(entry.id) ??
            (
              await loadMovementTargets(tx, {
                state,
                campaign: input.campaign,
                targetActorIds: [entry.id]
              })
            ).get(entry.id)
          if (!loaded) throw new Error('Encounter action facts are stale.')
          return loaded
        },
        definitions: campaignDefinitions(tx, input.campaign),
        observersSeeing
      })
    },
    loadSource: (sourceInput) => loadActionSource(tx, input.campaign, state, sourceInput),
    loadRelationshipFacts: (factsInput) => loadActionRelationshipFacts(tx, factsInput)
  }).catch(refuseStaleCharacterAction)
}

/** The current Disarm choices for the optional-action drawer, from stored facts. */
export async function readDisarmSelection<TFacts extends CharacterTurnFacts>(
  tx: EncounterTurnReadTransaction<TFacts>,
  input: {
    state: EncounterRunState
    campaign: Campaign
    actors: EncounterRunActorState[]
    actor: EncounterRunActorState
    target: EncounterRunActorState
    command: GetEncounterOptionalActionChoicesInputDto
  }
) {
  const { state, campaign, actor, target, command } = input
  const definition = requireEncounterDisarmDefinition(input)
  const prepared = await prepareActionMechanics(tx, {
    state,
    campaign,
    actors: input.actors,
    actor,
    target,
    actionId: command.actionId,
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: false
  })
  const selection = readEncounterDisarmSelection({
    actor,
    target,
    actionId: command.actionId,
    definition,
    prepared,
    sceneContext: await readActionSceneContext(tx, state, command),
    facing: encounterFacingRule(state),
    rejectTarget: () => rejectDomain('TARGET_UNAVAILABLE', 'Optional combat target is unavailable.')
  })
  await prepareActionEconomy(tx, {
    state,
    campaign,
    actor,
    activation: { code: 'ACTION', amount: 1 },
    target: prepared.sourceFacts
  })
  // The drawer labels held items from the defender's own Character facts.
  return { ...selection, definition, targetCharacter: prepared.targetFacts.characterFacts }
}
