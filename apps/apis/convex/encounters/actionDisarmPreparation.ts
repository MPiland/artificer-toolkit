import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerOptionalCombatContestPendingApplicationContextDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readEncounterActorOptionalContestContext } from '@artificer-toolkit/rules-runtime/encounterActorOptionalContestContext'
import { resolveDnd5eOptionalCombatActionSelection } from '@artificer-toolkit/rules-runtime/systems/dnd5e/optionalCombatActionSelection'
import { createDnd5eOptionalCombatContestGraph } from '@artificer-toolkit/rules-runtime/systems/dnd5e/optionalCombatContestGraph'
import { prepareDnd5eDisarmContest } from '@artificer-toolkit/rules-runtime/systems/dnd5e/optionalActionPolicy'
import {
  isDnd5eOptionalCombatContestPendingContextCurrent,
  prepareDnd5eOptionalCombatContestPendingContext
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/optionalCombatContestPendingContext'
import type { QueryCtx } from '../_generated/server'
import { readNativeDisarmSelection } from './actionDisarmSelection'

/** Reconstructs the settled Disarm contract from current facts without rolling or writing. */
export async function prepareNativeDisarm(
  ctx: QueryCtx,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    actor: EncounterRunActorState
    target: EncounterRunActorState
    command: ResolveEncounterActionInputDto
    campaignOwnerUserId: string
    priorContest?: ServerOptionalCombatContestPendingApplicationContextDto
  }
) {
  const { state, actor, target, command } = input
  const intent = command.optionalCombatIntent
  if (!intent) throw new Error('Optional combat Disarm is unavailable.')
  if (command.acceptedWieldConflict) throw new Error('Disarm does not stow a shield.')
  const {
    prepared,
    sceneContext,
    actionEconomy,
    sourcePolicyFacts,
    defenderFacts,
    definition,
    descriptor
  } = await readNativeDisarmSelection(ctx, {
    ...input,
    command: { ...command, definitionId: intent.definitionId }
  })
  const { source, sourceFacts, plan } = prepared
  const selection = resolveDnd5eOptionalCombatActionSelection({ definition, descriptor, intent })
  const heldItemId = selection.entities.HELD_ITEM
  const checkDefinitionId = selection.entities.DEFENDER_CHECK
  if (!heldItemId || !checkDefinitionId) throw new Error('Disarm selection is incomplete.')
  const targetContext =
    defenderFacts.ownerState === 'ENCOUNTER_ACTOR'
      ? readEncounterActorOptionalContestContext({ actor: target, loadoutEntryId: heldItemId })
      : null
  const targetItem =
    defenderFacts.ownerState === 'CHARACTER_SHEET'
      ? defenderFacts.equipment.find((item) => item.itemInstanceId === heldItemId)
      : targetContext?.equipment
  if (!targetItem) throw new Error('Disarm item is no longer held.')
  const preparation = prepareDnd5eDisarmContest({
    automationMode: state.automationMode,
    gameSystemId: state.gameSystemId,
    optionalCombatSnapshot: state.optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
    attackerActorId: actor.id,
    attackerSize: sourcePolicyFacts.size,
    heldItemId,
    targetActorId: target.id,
    targetCheckDefinitionId: checkDefinitionId,
    targetEquipment: { properties: targetItem.properties },
    targetItemOwnerState: defenderFacts.ownerState,
    targetSize: defenderFacts.size,
    triggerCode:
      source.kind === 'CHARACTER_ACTION'
        ? (source.candidate.mechanicFacts.invocation.triggerCode ?? null)
        : (source.capability.compiledEffect.invocation.triggerCode ?? null),
    sourceEquipment: sourcePolicyFacts.equipment,
    attack: sourcePolicyFacts.attack
  })
  if (preparation.kind !== 'PROPOSED')
    throw new Error('Disarm cannot be resolved from the selected facts.')
  const modifier = sourcePolicyFacts.attack.modifier
  const targetCheckTotal = defenderFacts.checkTotals[checkDefinitionId]
  if (
    modifier === null ||
    targetCheckTotal === undefined ||
    !Number.isSafeInteger(targetCheckTotal)
  )
    throw new Error('Disarm contest modifier is unavailable.')
  const graph = createDnd5eOptionalCombatContestGraph({
    ...preparation.proposal.pin,
    moduleContractVersion: 1
  })
  const published = plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published
  const sourceContext =
    source.kind === 'CHARACTER_ACTION'
      ? {
          kind: 'CHARACTER_ACTION' as const,
          characterId: source.characterId,
          streamVersion: source.characterStreamVersion,
          projectionChecksum: sourceFacts.characterCurrentness!.projectionChecksum,
          mechanicalContextChecksum: sourceFacts.characterCurrentness!.mechanicalContextChecksum,
          publishedDefinitionId: published.id,
          publishedDefinitionChecksum: published.checksum
        }
      : {
          kind: 'ENCOUNTER_FEATURE' as const,
          creatureSourceId: source.capability.creatureSourceId,
          sourceRevision: source.capability.sourceRevision,
          sourceVersionId: source.capability.sourceVersionId,
          sourceChecksum: source.capability.sourceChecksum,
          ownerFeatureId: source.capability.ownerFeatureId,
          featureOptionId: source.capability.featureOptionId ?? null,
          effectId: source.capability.effectId,
          authoredEffectChecksum: source.capability.authoredEffectChecksum,
          compiledEffectChecksum: source.capability.compiledEffectChecksum,
          publishedDefinitionId: published.id,
          publishedDefinitionChecksum: published.checksum
        }
  const sceneDependency = sceneContext
    ? {
        sceneId: sceneContext.sceneId,
        sceneVersion: sceneContext.sceneVersion,
        sourceTokenId: sceneContext.sourceToken.tokenId,
        targetTokenId: sceneContext.targetToken.tokenId
      }
    : null
  const current: Parameters<typeof prepareDnd5eOptionalCombatContestPendingContext>[0] = {
    actionKind: 'DISARM',
    actionId: command.actionId,
    sourceActorId: actor.id,
    targetActorId: target.id,
    initiatorControllerCharacterId: source.kind === 'CHARACTER_ACTION' ? source.characterId : null,
    sceneContext: sceneDependency,
    positionalDependencyChecksum: checksumRuleDocument(sceneDependency),
    optionalCombat: {
      snapshotChecksum: state.optionalCombatSnapshotChecksum,
      ...preparation.proposal.pin,
      moduleContractVersion: 1
    },
    contestGraph: {
      definitionId: graph.published.id,
      checksum: graph.published.checksum,
      identityChecksum: graph.identityChecksum
    },
    optionId: descriptor.optionId,
    selectionContractChecksum: descriptor.selectionContract,
    resolvedSelectionChecksum: checksumRuleDocument(selection),
    source: sourceContext,
    target:
      defenderFacts.ownerState === 'CHARACTER_SHEET'
        ? {
            kind: 'CHARACTER',
            characterId: defenderFacts.character.active.id,
            streamVersion: defenderFacts.character.active.streamVersion,
            projectionChecksum: defenderFacts.currentness.projectionChecksum,
            mechanicalContextChecksum: defenderFacts.currentness.mechanicalContextChecksum,
            stateChecksum: checksumRuleDocument({
              itemId: heldItemId,
              streamVersion: defenderFacts.character.active.streamVersion,
              equipped: defenderFacts.heldItemIds
            })
          }
        : { kind: 'ENCOUNTER_ACTOR', currentnessChecksum: targetContext!.stateChecksum },
    initiator: {
      actorId: actor.id,
      requestNodeId: 'initiator_d20',
      rollMode: preparation.proposal.contest.initiatorMode,
      contributors: [...preparation.proposal.contest.initiatorContributors],
      contributorChecksum: checksumRuleDocument(preparation.proposal.contest.initiatorContributors),
      modifier
    },
    defender: {
      actorId: target.id,
      requestNodeId: 'target_d20',
      rollMode: preparation.proposal.contest.targetMode,
      contributors: [...preparation.proposal.contest.targetContributors],
      contributorChecksum: checksumRuleDocument(preparation.proposal.contest.targetContributors),
      modifier: targetCheckTotal,
      checkDefinitionId
    },
    selection: {
      kind: 'DISARM',
      heldItemId,
      defenderCheckDefinitionId: checkDefinitionId,
      heldItemStateChecksum:
        defenderFacts.ownerState === 'CHARACTER_SHEET'
          ? checksumRuleDocument({
              itemId: heldItemId,
              properties: targetItem.properties,
              state: 'EQUIPPED'
            })
          : targetContext!.stateChecksum
    },
    actionEconomy: actionEconomy
      ? {
          definitionId: actionEconomy.definitionId,
          definitionVersion: actionEconomy.definitionVersion,
          definitionChecksum: actionEconomy.definitionChecksum,
          maximum: actionEconomy.maximum,
          beforeUsed: actionEconomy.beforeUsed
        }
      : null,
    rollEvidence: input.priorContest?.rollEvidence ?? { initiator: null, defender: null }
  }
  const contest = prepareDnd5eOptionalCombatContestPendingContext(current)
  if (
    input.priorContest &&
    !isDnd5eOptionalCombatContestPendingContextCurrent({ pending: input.priorContest, current })
  )
    throw new Error('Optional combat contest pending facts changed.')
  const currentnessChecksum = checksumRuleDocument({ actor, target, sceneContext, contest })
  return { prepared, contest, graph, actionEconomy, currentnessChecksum, sceneContext }
}
