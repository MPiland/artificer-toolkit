import type { GetEncounterOptionalActionChoicesInputDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { sizeCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { toCharacterInitiativeActorFacts } from '@artificer-toolkit/rules-runtime/character/characterInitiativeFacts'
import { targetPolicyPermitsEncounterActor } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import {
  snapshotCreatureEquipmentLoadout,
  snapshotCreatureEquipmentSources
} from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import { readEncounterActorOptionalContestFacts } from '@artificer-toolkit/rules-runtime/encounterActorOptionalContestContext'
import { createDnd5eOptionalCombatActionSelectionDescriptor } from '@artificer-toolkit/rules-runtime/systems/dnd5e/optionalCombatActionSelection'
import type { QueryCtx } from '../_generated/server'
import { prepareNativeEncounterActionMechanics } from './actionMechanicsPreparation'
import { prepareNativeActionEconomy } from './actionEconomy'
import { readNativeActionSceneContext } from './actionSceneContext'

/** Shares current source, target and issued choices between discovery and command execution. */
export async function readNativeDisarmSelection(
  ctx: QueryCtx,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    actor: EncounterRunActorState
    target: EncounterRunActorState
    command: GetEncounterOptionalActionChoicesInputDto
    campaignOwnerUserId: string
  }
) {
  const { state, actors, actor, target, command } = input
  if (
    state.status !== 'ACTIVE' ||
    state.currentActorId !== actor.id ||
    state.automationMode === 'MANUAL' ||
    state.id !== command.encounterId ||
    state.version !== command.expectedVersion ||
    actor.id !== command.actorId ||
    target.id !== command.targetActorId ||
    actor.id === target.id ||
    actor.encounterId !== state.id ||
    target.encounterId !== state.id ||
    !state.actorIds.includes(actor.id) ||
    !state.actorIds.includes(target.id) ||
    actors.filter((value) => value.id === actor.id).length !== 1 ||
    actors.filter((value) => value.id === target.id).length !== 1 ||
    checksumCanonicalJson(actors.find((value) => value.id === actor.id)) !==
      checksumCanonicalJson(actor) ||
    checksumCanonicalJson(actors.find((value) => value.id === target.id)) !==
      checksumCanonicalJson(target)
  )
    throw new Error('Optional combat contest is not current.')
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.safeParse(state.optionalCombatSnapshot)
  if (
    !snapshot.success ||
    checksumCanonicalJson(snapshot.data) !== state.optionalCombatSnapshotChecksum
  )
    throw new Error('Optional combat Disarm snapshot is stale.')
  const definition = activeOptionalCombatDefinitions({
    automationMode: state.automationMode,
    snapshot: snapshot.data
  }).find(
    (value) => value.document.kind === 'DISARM' && value.definitionId === command.definitionId
  )
  if (!definition) throw new Error('Optional combat Disarm is unavailable.')

  const prepared = await prepareNativeEncounterActionMechanics(ctx, {
    state,
    actors,
    actor,
    target,
    actionId: command.actionId,
    campaignOwnerUserId: input.campaignOwnerUserId
  })
  const { source, sourceFacts, targetFacts } = prepared
  const sceneContext = await readNativeActionSceneContext(ctx, state, command, 'MEMBER')
  if (
    !targetPolicyPermitsEncounterActor({
      actorId: actor.id,
      targetActorId: target.id,
      targetPolicy: prepared.targetPolicy,
      sceneContext
    })
  )
    throw new Error('The selected action does not permit this target.')
  const invocation =
    source.kind === 'CHARACTER_ACTION'
      ? source.candidate.mechanicFacts.invocation
      : source.capability.mechanicFacts.invocation
  if (invocation.activation?.code !== 'ACTION' || invocation.activation.amount !== 1)
    throw new Error('Disarm requires one normalized ACTION activation.')
  const actionEconomy = await prepareNativeActionEconomy(ctx, {
    state,
    actor,
    userId: input.campaignOwnerUserId,
    activation: { code: 'ACTION', amount: 1 },
    target: sourceFacts
  })

  const sourcePolicyFacts = (() => {
    if (source.kind === 'CHARACTER_ACTION') {
      const character = sourceFacts.characterFacts
      if (!character || !sourceFacts.characterCurrentness)
        throw new Error('Optional combat Character source is stale.')
      const decisions = source.effectivePolicyOutput.actionDecisions.filter(
        (value) =>
          value.status === 'AVAILABLE' &&
          value.actionId === source.candidate.actionId &&
          value.effectId === source.candidate.effectId
      )
      if (decisions.length !== 1 || !decisions[0])
        throw new Error('Optional combat Character action policy is stale.')
      const equipment = source.candidate.equipment
      const attacks = source.effectivePolicyOutput.rollContributorEvidence.attacks
      const baseContributors = {
        MELEE: attacks.MELEE.map(({ sourceId, grantId, domainKey, influence }) => ({
          sourceId,
          grantId,
          domainKey,
          influence
        })),
        RANGED: attacks.RANGED.map(({ sourceId, grantId, domainKey, influence }) => ({
          sourceId,
          grantId,
          domainKey,
          influence
        })),
        SPELL: attacks.SPELL.map(({ sourceId, grantId, domainKey, influence }) => ({
          sourceId,
          grantId,
          domainKey,
          influence
        })),
        UNARMED: attacks.UNARMED.map(({ sourceId, grantId, domainKey, influence }) => ({
          sourceId,
          grantId,
          domainKey,
          influence
        }))
      }
      return {
        equipment:
          equipment?.equipmentId && equipment.equipped
            ? {
                id: equipment.itemInstanceId,
                category: equipment.category ?? null,
                properties: equipment.properties ?? [],
                state: 'EQUIPPED' as const
              }
            : null,
        size: toCharacterInitiativeActorFacts({
          snapshot: character.ruleEvaluation.snapshot,
          registry: character.ruleEvaluation.registry,
          rulePolicyOutput: source.effectivePolicyOutput
        }).effectiveSize,
        attack: {
          modifier: decisions[0].mechanic.attackBonus,
          rollMode: decisions[0].mechanic.attackRollMode,
          baseContributors,
          relationshipContributors: prepared.relationshipContributors
        }
      }
    }
    const binding = source.capability.equipmentBinding
    const loadout = binding
      ? snapshotCreatureEquipmentLoadout(actor).find(
          (entry) => entry.id === binding.loadoutEntryId && entry.useState === 'HELD'
        )
      : null
    const equipment = binding
      ? snapshotCreatureEquipmentSources(actor).find(
          (entry) =>
            entry.loadoutEntryId === binding.loadoutEntryId &&
            entry.equipmentId === binding.equipmentId &&
            entry.sourceRevision === binding.sourceRevision &&
            entry.sourceVersionId === binding.sourceVersionId &&
            entry.sourceChecksum === binding.sourceChecksum
        )
      : null
    const payload =
      typeof actor.snapshot === 'object' &&
      actor.snapshot !== null &&
      !Array.isArray(actor.snapshot) &&
      typeof actor.snapshot.payload === 'object' &&
      actor.snapshot.payload !== null &&
      !Array.isArray(actor.snapshot.payload)
        ? actor.snapshot.payload
        : null
    const size = sizeCodeSchema.safeParse(payload?.size)
    return {
      equipment:
        loadout && equipment
          ? {
              id: equipment.loadoutEntryId,
              category: equipment.compiled.category,
              properties: equipment.compiled.properties,
              state: 'HELD' as const
            }
          : null,
      size: size.success ? size.data : null,
      attack: {
        modifier: source.capability.attackMechanic?.attackBonus ?? null,
        rollMode: source.capability.attackMechanic?.rollMode ?? null,
        baseContributors:
          source.capability.attackMechanic?.rollMode === 'NORMAL'
            ? { MELEE: [], RANGED: [], SPELL: [], UNARMED: [] }
            : null,
        relationshipContributors: prepared.relationshipContributors
      }
    }
  })()
  const defenderFacts = (() => {
    if (target.kind === 'CHARACTER') {
      const character = targetFacts.characterFacts
      if (!character || !targetFacts.characterCurrentness || !targetFacts.effectiveRulePolicyOutput)
        throw new Error('Optional combat Character target is stale.')
      const facts = toCharacterInitiativeActorFacts({
        snapshot: character.ruleEvaluation.snapshot,
        registry: character.ruleEvaluation.registry,
        rulePolicyOutput: targetFacts.effectiveRulePolicyOutput
      })
      return {
        ownerState: 'CHARACTER_SHEET' as const,
        heldItemIds: character.character.state.equipment.equipped,
        checkTotals: facts.checkTotals,
        equipment: facts.equippedItems,
        size: facts.effectiveSize,
        character,
        currentness: targetFacts.characterCurrentness
      }
    }
    if (target.kind !== 'CREATURE') throw new Error('Optional combat target is unavailable.')
    const facts = readEncounterActorOptionalContestFacts(target)
    return {
      ownerState: 'ENCOUNTER_ACTOR' as const,
      heldItemIds: snapshotCreatureEquipmentLoadout(target)
        .filter((entry) => entry.useState === 'HELD')
        .map((entry) => entry.id),
      checkTotals: facts?.ruleFacts.checkTotals ?? {},
      equipment: [],
      size: facts?.size ?? null
    }
  })()
  const descriptor = createDnd5eOptionalCombatActionSelectionDescriptor({
    actionId: command.actionId,
    actorId: actor.id,
    definition,
    heldItemIds: defenderFacts.heldItemIds,
    targetCheckDefinitionIds: Object.keys(defenderFacts.checkTotals),
    targetActorId: target.id
  })
  return {
    prepared,
    sceneContext,
    actionEconomy,
    sourcePolicyFacts,
    defenderFacts,
    definition,
    descriptor
  }
}
