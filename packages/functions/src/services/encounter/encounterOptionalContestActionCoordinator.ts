import { randomInt } from 'node:crypto'

import {
  createEncounterRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord
} from '@artificer-toolkit/db'
import type { OptionalCombatActionIntentDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  ServerCompletedRuleExecutionDto,
  ServerOptionalCombatContestPendingApplicationContextDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumCanonicalJson } from '@artificer-toolkit/db'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { LiveSessionCommandAuthority } from '../campaign/liveSessionCommandAuthority.js'
import {
  createRuleExecutionOccurrenceService,
  type RuleExecutionAggregatePort
} from '../rules/ruleExecutionOccurrenceService.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { characterRuleActionSystemAdapterRegistry } from '../rules/characterRuleActionSystemAdapterRegistry.js'
import { buildCompiledActionCompilerSource } from '../rules/characterActionEntryPointCompiler.js'
import {
  createDnd5eOptionalCombatActionSelectionDescriptor,
  resolveDnd5eOptionalCombatActionSelection
} from '../rules/systems/dnd5e/optionalCombatActionSelection.js'
import { createDnd5eOptionalCombatContestGraph } from '../rules/systems/dnd5e/optionalCombatContestGraph.js'
import { prepareDnd5eDisarmContest } from '../rules/systems/dnd5e/optionalActionPolicy.js'
import {
  isDnd5eOptionalCombatContestPendingContextCurrent,
  prepareDnd5eOptionalCombatContestPendingContext,
  requireDnd5eOptionalCombatContestRequestParticipant
} from '../rules/systems/dnd5e/optionalCombatContestPendingContext.js'
import { evaluateEncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'
import {
  lockEncounterActiveEffectTargets,
  type LockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import { prepareActionEconomyConsumption } from './encounterActionSettlementCore.js'
import {
  prepareEncounterActorOptionalContestContext,
  prepareEncounterActorOptionalContestFacts
} from './encounterActorOptionalContestContext.js'
import { withLockedEncounterCharacterOptionalContestContext } from './encounterCharacterOptionalContestContext.js'
import {
  createEncounterActionStartIntent,
  revalidateEncounterActionSceneDependency,
  toEncounterActionSceneDependency,
  type LockedEncounterActionSceneContext
} from './encounterActionSceneContext.js'
import {
  completeEncounterOptionalContestActionExecution,
  type OptionalContestD20Policy
} from './encounterOptionalContestActionExecution.js'
import {
  resolveEncounterOptionalContestActionSource,
  type EncounterOptionalContestActionSource
} from './encounterOptionalContestActionSource.js'
import { settleEncounterOptionalContestAction } from './encounterOptionalContestActionSettlement.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { lockEncounterRuleExecutionCommandContext } from './encounterRuleExecutionCommandContext.js'
import { snapshotCreatureEquipmentLoadout } from '../rules/encounterCreatureEquipmentSources.js'

type AutomationMode = 'AUTOMATIC' | 'ASSISTED'

export type EncounterOptionalContestActionCommand = {
  actionId: string
  actorId: string
  actorUserId: string
  commandId: string
  correlationId: string | null
  encounterId: string
  expectedEncounterVersion: number
  optionalCombatIntent: OptionalCombatActionIntentDto | null | undefined
  sceneContext: LockedEncounterActionSceneContext | null
  targetActorId: string
  liveSessionAuthority?: LiveSessionCommandAuthority
}

type ResolvedContest = {
  attunementSlotOverride: number | null
  encounter: EncounterRecord
  sourceActor: EncounterActorRecord
  targetActor: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
  source: EncounterOptionalContestActionSource
  pending: ServerOptionalCombatContestPendingApplicationContextDto
  graph: ReturnType<typeof createDnd5eOptionalCombatContestGraph>
  actionEconomy: Awaited<ReturnType<typeof prepareActionEconomyConsumption>>
}

function activeDisarmDefinition(input: {
  encounter: EncounterRecord
  intent: OptionalCombatActionIntentDto | null | undefined
}) {
  if (!input.intent || input.encounter.automationMode === 'MANUAL') return null
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.safeParse(
    input.encounter.optionalCombatSnapshot
  )
  if (
    !snapshot.success ||
    input.encounter.optionalCombatSnapshotChecksum === null ||
    checksumCanonicalJson(snapshot.data) !== input.encounter.optionalCombatSnapshotChecksum
  ) {
    return null
  }
  return (
    activeOptionalCombatDefinitions({
      automationMode: input.encounter.automationMode,
      snapshot: snapshot.data
    }).find(
      (definition) =>
        definition.document.kind === 'DISARM' &&
        definition.definitionId === input.intent!.definitionId
    ) ?? null
  )
}

/** A cheap route probe; full intent/selection validation remains inside the locked coordinator. */
export function isActiveEncounterDisarmIntent(input: {
  encounter: EncounterRecord
  intent: OptionalCombatActionIntentDto | null | undefined
}): boolean {
  return activeDisarmDefinition(input) !== null
}

function characterPublished(
  source: Extract<EncounterOptionalContestActionSource, { kind: 'CHARACTER_ACTION' }>
) {
  return source.entry.schemaVersion === 4
    ? source.entry.compilation.executionPlan.kind === 'SINGLE_GRAPH'
      ? source.entry.compilation.executionPlan.published
      : source.entry.compilation.executionPlan.test.published
    : source.entry.compilation.published
}

function sourcePublished(source: EncounterOptionalContestActionSource) {
  if (source.kind === 'CHARACTER_ACTION') return characterPublished(source)
  const adapter = characterRuleActionSystemAdapterRegistry.get(source.capability.gameSystemId)
  if (!adapter)
    throw new EncounterValidationError('Optional combat Feature execution is unavailable.')
  const plan = adapter.compileExecutionPlan?.({
    action: source.capability,
    compilerSource: buildCompiledActionCompilerSource(source.capability)
  }) ?? { kind: 'SINGLE_GRAPH' as const, published: adapter.compile({ action: source.capability }) }
  return plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published
}

function activation(source: EncounterOptionalContestActionSource): { code: 'ACTION'; amount: 1 } {
  const value =
    source.kind === 'CHARACTER_ACTION'
      ? source.candidate.mechanicFacts.invocation.activation
      : source.capability.mechanicFacts.invocation.activation
  if (!value || value.code !== 'ACTION' || value.amount !== 1) {
    throw new EncounterValidationError('Disarm requires one normalized ACTION activation.')
  }
  return { code: 'ACTION', amount: 1 }
}

function requireDisarmSelection(pending: ServerOptionalCombatContestPendingApplicationContextDto) {
  if (pending.actionKind !== 'DISARM' || pending.selection.kind !== 'DISARM') {
    throw new EncounterConflictError('Disarm settlement is unavailable.')
  }
  return pending.selection
}

function sealedContestPolicy(input: {
  policy: ServerOptionalCombatContestPendingApplicationContextDto['initiator']
  requestNodeId: OptionalContestD20Policy['requestNodeId']
}): OptionalContestD20Policy {
  if (input.policy.requestNodeId !== input.requestNodeId) {
    throw new EncounterConflictError('Optional combat contest request policy is stale.')
  }
  return { ...input.policy, requestNodeId: input.requestNodeId }
}

function contestExecution(input: {
  execution: ServerCompletedRuleExecutionDto
  pending: ServerOptionalCombatContestPendingApplicationContextDto
}) {
  const evidence = input.pending.rollEvidence
  if (!evidence.initiator || !evidence.defender) {
    throw new EncounterConflictError('Optional combat contest evidence is incomplete.')
  }
  return completeEncounterOptionalContestActionExecution({
    execution: input.execution,
    initiator: sealedContestPolicy({
      policy: input.pending.initiator,
      requestNodeId: 'initiator_d20'
    }),
    defender: sealedContestPolicy({
      policy: input.pending.defender,
      requestNodeId: 'target_d20'
    }),
    rolls: new Map([
      ['INITIATOR', evidence.initiator.rawFaces],
      ['DEFENDER', evidence.defender.rawFaces]
    ])
  })
}

function automaticFaces(policy: OptionalContestD20Policy, rollD20?: () => number) {
  const count = policy.rollMode === 'NORMAL' ? 1 : 2
  return Array.from({ length: count }, () => (rollD20 ?? (() => randomInt(1, 21)))())
}

async function resolveCurrentContest(input: {
  db: DBLike
  command: EncounterOptionalContestActionCommand
  occurrenceId: string
  expectedPending?: ServerOptionalCombatContestPendingApplicationContextDto
  responseParticipant?: 'INITIATOR' | 'DEFENDER'
}): Promise<ResolvedContest> {
  const locked = await lockEncounterRuleExecutionCommandContext(input.db, {
    actorUserId: input.command.actorUserId,
    authority: 'ACTIVE_MEMBER',
    encounterId: input.command.encounterId,
    ...(input.command.liveSessionAuthority
      ? { liveSessionAuthority: input.command.liveSessionAuthority }
      : {})
  })
  const encounter = locked.encounter
  const sourceActor = encounter.actors.find((actor) => actor.id === input.command.actorId)
  const targetActor = encounter.actors.find((actor) => actor.id === input.command.targetActorId)
  if (
    encounter.status !== 'ACTIVE' ||
    encounter.currentActorId !== input.command.actorId ||
    !sourceActor ||
    !targetActor ||
    sourceActor.id === targetActor.id ||
    encounter.automationMode === 'MANUAL'
  ) {
    throw new EncounterConflictError('Optional combat contest is not current.')
  }
  const definition = activeDisarmDefinition({
    encounter,
    intent: input.command.optionalCombatIntent
  })
  if (!definition || !input.command.optionalCombatIntent) {
    throw new EncounterConflictError('Optional combat Disarm is unavailable.')
  }
  const sceneContext = await revalidateEncounterActionSceneDependency({
    db: input.db,
    encounterId: encounter.id,
    actorId: sourceActor.id,
    targetActorId: targetActor.id,
    dependency:
      input.expectedPending?.sceneContext ??
      toEncounterActionSceneDependency(input.command.sceneContext)
  })
  const evaluated = await evaluateEncounterActorRuleSnapshot({ db: input.db, encounter })
  const targets = await lockEncounterActiveEffectTargets({
    trx: input.db,
    encounter,
    actors: encounter.actors,
    attunementSlotOverride: locked.context.attunementSlotOverride,
    getEncounterActorSnapshot: async () => ({
      rules: evaluated.snapshot.output,
      encounter: evaluated.reconciledEncounter
    })
  })
  const source = await resolveEncounterOptionalContestActionSource({
    db: input.db,
    actionId: input.command.actionId,
    actor: sourceActor,
    targetActorId: targetActor.id,
    targets
  })
  if (!source) throw new EncounterConflictError('Optional combat action source is unavailable.')
  const respondentCharacterId =
    input.responseParticipant === 'INITIATOR'
      ? source.kind === 'CHARACTER_ACTION'
        ? source.characterId
        : null
      : input.responseParticipant === 'DEFENDER' && targetActor.kind === 'CHARACTER'
        ? targetActor.sourceId
        : null
  if (
    locked.context.role !== 'OWNER' &&
    (!respondentCharacterId || locked.context.assignedCharacterId !== respondentCharacterId)
  ) {
    throw new EncounterConflictError('Optional combat action authority is unavailable.')
  }
  const targetFacts =
    targetActor.kind === 'CHARACTER' && targetActor.sourceId
      ? (() => {
          const character = targets.lockedCharacters.get(targetActor.sourceId)
          if (!character) throw new EncounterConflictError('Optional combat target is stale.')
          return {
            heldItemIds: character.mechanics.commandState.state.equipment.equipped,
            targetCheckDefinitionIds: Object.keys(
              character.mechanics.initiativeActorFacts.checkTotals
            ),
            targetEquipment: character.mechanics.initiativeActorFacts.equippedItems,
            targetSize: character.mechanics.initiativeActorFacts.effectiveSize,
            ownerState: 'CHARACTER_SHEET' as const
          }
        })()
      : targetActor.kind === 'CREATURE'
        ? (() => {
            const loadout = snapshotCreatureEquipmentLoadout(targetActor).filter(
              (entry) => entry.useState === 'HELD'
            )
            const actorFacts = prepareEncounterActorOptionalContestFacts({
              targets,
              targetActorId: targetActor.id
            })
            return {
              heldItemIds: loadout.map((entry) => entry.id),
              targetCheckDefinitionIds: actorFacts
                ? Object.keys(actorFacts.ruleFacts.checkTotals)
                : [],
              targetEquipment: [],
              targetSize: actorFacts?.size ?? null,
              ownerState: 'ENCOUNTER_ACTOR' as const
            }
          })()
        : null
  if (!targetFacts) throw new EncounterConflictError('Optional combat target is unavailable.')
  const descriptor = createDnd5eOptionalCombatActionSelectionDescriptor({
    actionId: input.command.actionId,
    actorId: sourceActor.id,
    definition,
    heldItemIds: targetFacts.heldItemIds,
    targetCheckDefinitionIds: targetFacts.targetCheckDefinitionIds,
    targetActorId: targetActor.id
  })
  const selection = resolveDnd5eOptionalCombatActionSelection({
    definition,
    descriptor,
    intent: input.command.optionalCombatIntent
  })
  const heldItemId = selection.entities.HELD_ITEM ?? null
  const checkDefinitionId = selection.entities.DEFENDER_CHECK ?? null
  if (!heldItemId || !checkDefinitionId)
    throw new EncounterConflictError('Disarm selection is incomplete.')
  const targetContext =
    targetFacts.ownerState === 'CHARACTER_SHEET'
      ? null
      : prepareEncounterActorOptionalContestContext({
          targets,
          targetActorId: targetActor.id,
          loadoutEntryId: heldItemId
        })
  const targetItem =
    targetFacts.ownerState === 'CHARACTER_SHEET'
      ? targetFacts.targetEquipment.find((item) => item.itemInstanceId === heldItemId)
      : targetContext
        ? { itemInstanceId: heldItemId, properties: targetContext.equipment.properties }
        : null
  if (!targetItem) throw new EncounterConflictError('Disarm item is no longer held.')
  const preparation = prepareDnd5eDisarmContest({
    automationMode: encounter.automationMode,
    gameSystemId: encounter.gameSystemId,
    optionalCombatSnapshot: encounter.optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: encounter.optionalCombatSnapshotChecksum,
    attackerActorId: sourceActor.id,
    attackerSize: source.size,
    heldItemId,
    targetActorId: targetActor.id,
    targetCheckDefinitionId: checkDefinitionId,
    targetEquipment: { properties: targetItem.properties },
    targetItemOwnerState: targetFacts.ownerState,
    targetSize: targetFacts.targetSize,
    triggerCode: source.triggerCode,
    sourceEquipment: source.equipment,
    attack: source.attack
  })
  if (preparation.kind !== 'PROPOSED') {
    throw new EncounterValidationError('Disarm cannot be resolved from the selected facts.')
  }
  const graph = createDnd5eOptionalCombatContestGraph({
    ...preparation.proposal.pin,
    moduleContractVersion: 1
  })
  const targetCheckTotal =
    targetFacts.ownerState === 'CHARACTER_SHEET'
      ? targetFacts.targetCheckDefinitionIds.includes(checkDefinitionId)
        ? targets.lockedCharacters.get(targetActor.sourceId!)!.mechanics.initiativeActorFacts
            .checkTotals[checkDefinitionId]
        : null
      : (targetContext?.ruleFacts.checkTotals[checkDefinitionId] ?? null)
  if (!Number.isSafeInteger(targetCheckTotal)) {
    throw new EncounterConflictError('Disarm defender check is unavailable.')
  }
  const initiator: OptionalContestD20Policy = {
    actorId: sourceActor.id,
    requestNodeId: 'initiator_d20' as const,
    rollMode: preparation.proposal.contest.initiatorMode,
    contributors: preparation.proposal.contest.initiatorContributors,
    contributorChecksum: checksumRuleDocument(preparation.proposal.contest.initiatorContributors),
    modifier: source.attack.modifier!
  }
  const defender: OptionalContestD20Policy & { checkDefinitionId: string } = {
    actorId: targetActor.id,
    requestNodeId: 'target_d20' as const,
    rollMode: preparation.proposal.contest.targetMode,
    contributors: preparation.proposal.contest.targetContributors,
    contributorChecksum: checksumRuleDocument(preparation.proposal.contest.targetContributors),
    modifier: targetCheckTotal!,
    checkDefinitionId
  }
  const sourceContext =
    source.kind === 'CHARACTER_ACTION'
      ? (() => {
          const character = targets.lockedCharacters.get(source.characterId)
          if (!character) throw new EncounterConflictError('Optional combat source is stale.')
          const published = sourcePublished(source)
          return {
            kind: 'CHARACTER_ACTION' as const,
            characterId: source.characterId,
            streamVersion: source.characterStreamVersion,
            projectionChecksum: character.mechanics.projectionChecksum,
            mechanicalContextChecksum: character.overlay.mechanicalContextChecksum,
            publishedDefinitionId: published.id,
            publishedDefinitionChecksum: published.checksum
          }
        })()
      : (() => {
          const capability = source.capability
          const published = sourcePublished(source)
          return {
            kind: 'ENCOUNTER_FEATURE' as const,
            creatureSourceId: capability.creatureSourceId,
            sourceRevision: capability.sourceRevision,
            sourceVersionId: capability.sourceVersionId,
            sourceChecksum: capability.sourceChecksum,
            ownerFeatureId: capability.ownerFeatureId,
            featureOptionId: capability.featureOptionId ?? null,
            effectId: capability.effectId,
            authoredEffectChecksum: capability.authoredEffectChecksum,
            compiledEffectChecksum: capability.compiledEffectChecksum,
            publishedDefinitionId: published.id,
            publishedDefinitionChecksum: published.checksum
          }
        })()
  const actionEconomy = await prepareActionEconomyConsumption({
    db: input.db,
    encounter,
    activation: activation(source),
    gameSystemId: encounter.gameSystemId,
    sourceActor,
    targets
  })
  const current: Parameters<typeof prepareDnd5eOptionalCombatContestPendingContext>[0] = {
    actionKind: 'DISARM' as const,
    actionId: input.command.actionId,
    sourceActorId: sourceActor.id,
    targetActorId: targetActor.id,
    initiatorControllerCharacterId: source.kind === 'CHARACTER_ACTION' ? source.characterId : null,
    sceneContext: toEncounterActionSceneDependency(sceneContext),
    positionalDependencyChecksum: checksumRuleDocument(
      toEncounterActionSceneDependency(sceneContext)
    ),
    optionalCombat: {
      snapshotChecksum: encounter.optionalCombatSnapshotChecksum!,
      definitionId: preparation.proposal.pin.definitionId,
      definitionVersion: preparation.proposal.pin.definitionVersion,
      definitionChecksum: preparation.proposal.pin.definitionChecksum,
      moduleKey: preparation.proposal.pin.moduleKey,
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
      targetFacts.ownerState === 'CHARACTER_SHEET'
        ? (() => {
            const character = targets.lockedCharacters.get(targetActor.sourceId!)!
            return {
              kind: 'CHARACTER' as const,
              characterId: character.id,
              streamVersion: character.streamVersion,
              projectionChecksum: character.mechanics.projectionChecksum,
              mechanicalContextChecksum: character.overlay.mechanicalContextChecksum,
              stateChecksum: checksumRuleDocument({
                itemId: heldItemId,
                streamVersion: character.streamVersion,
                equipped: character.mechanics.commandState.state.equipment.equipped
              })
            }
          })()
        : { kind: 'ENCOUNTER_ACTOR' as const, currentnessChecksum: targetContext!.stateChecksum },
    initiator: { ...initiator, contributors: [...initiator.contributors] },
    defender: { ...defender, contributors: [...defender.contributors] },
    selection: {
      kind: 'DISARM' as const,
      heldItemId,
      defenderCheckDefinitionId: checkDefinitionId,
      heldItemStateChecksum:
        targetFacts.ownerState === 'CHARACTER_SHEET'
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
    rollEvidence: input.expectedPending?.rollEvidence ?? { initiator: null, defender: null }
  }
  const pending = prepareDnd5eOptionalCombatContestPendingContext(current)
  if (
    input.expectedPending &&
    !isDnd5eOptionalCombatContestPendingContextCurrent({ pending: input.expectedPending, current })
  ) {
    throw new EncounterConflictError('Optional combat contest pending facts changed.')
  }
  return {
    attunementSlotOverride: locked.context.attunementSlotOverride,
    encounter,
    sourceActor,
    targetActor,
    targets,
    source,
    pending,
    graph,
    actionEconomy
  }
}

function aggregatePort(input: {
  command: EncounterOptionalContestActionCommand
}): RuleExecutionAggregatePort {
  return {
    async withLockedAuthorized(db, run) {
      const locked = await lockEncounterRuleExecutionCommandContext(db, {
        actorUserId: input.command.actorUserId,
        authority: 'ACTIVE_MEMBER',
        encounterId: input.command.encounterId,
        ...(input.command.liveSessionAuthority
          ? { liveSessionAuthority: input.command.liveSessionAuthority }
          : {})
      })
      return run({
        aggregateKind: 'ENCOUNTER',
        aggregateId: locked.encounter.id,
        campaignId: locked.context.campaignId,
        actorUserId: locked.context.actorUserId,
        currentVersion: locked.context.currentVersion,
        advanceVersion: (_db, expected) => locked.context.advanceVersion(expected)
      })
    }
  }
}

export async function executeEncounterOptionalContestActionOccurrence(input: {
  db: DBLike
  runtime: RulesRuntimeService
  command: EncounterOptionalContestActionCommand
  rollD20?: () => number
}) {
  const automaticRolls = new Map<'INITIATOR' | 'DEFENDER', readonly number[]>()
  let resolved: ResolvedContest | null = null
  return createRuleExecutionOccurrenceService({
    db: input.db,
    runtime: input.runtime,
    completionApplicator: {
      async apply({ db, execution, occurrenceId, pendingApplicationContext }) {
        if (!resolved || pendingApplicationContext?.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST') {
          throw new EncounterConflictError('Optional combat contest settlement is unavailable.')
        }
        const pending = pendingApplicationContext.rollEvidence.initiator
          ? pendingApplicationContext
          : prepareDnd5eOptionalCombatContestPendingContext({
              ...pendingApplicationContext,
              rollEvidence: {
                initiator: {
                  requestId: pendingApplicationContext.initiator.requestNodeId,
                  rawFaces: [...(automaticRolls.get('INITIATOR') ?? [])]
                },
                defender: {
                  requestId: pendingApplicationContext.defender.requestNodeId,
                  rawFaces: [...(automaticRolls.get('DEFENDER') ?? [])]
                }
              }
            })
        const complete = contestExecution({ execution, pending })
        const selection = requireDisarmSelection(pending)
        const current = resolved
        const settle = async (
          target: Parameters<typeof settleEncounterOptionalContestAction>[0]['target']
        ) =>
          settleEncounterOptionalContestAction({
            db,
            occurrenceId,
            pending,
            execution: complete,
            sourceActor: current.sourceActor,
            actionEconomy: current.actionEconomy ?? null,
            target,
            updateActor: (actor) => createEncounterRepository(db).updateActor(actor)
          })
        const target = current.targetActor
        const outputs =
          target.kind === 'CHARACTER'
            ? await withLockedEncounterCharacterOptionalContestContext(
                {
                  actorUserId: input.command.actorUserId,
                  attunementSlotOverride: current.attunementSlotOverride,
                  commandId: input.command.commandId,
                  db,
                  encounter: current.encounter,
                  occurrenceId,
                  selectedItemId: selection.heldItemId,
                  sourceCommandId: input.command.commandId,
                  targetActorId: target.id,
                  targets: current.targets,
                  ...(input.command.liveSessionAuthority
                    ? { liveSessionAuthority: input.command.liveSessionAuthority }
                    : {})
                },
                (context) => settle({ kind: 'CHARACTER', context })
              )
            : await settle({
                kind: 'ENCOUNTER_ACTOR',
                context:
                  prepareEncounterActorOptionalContestContext({
                    targets: current.targets,
                    targetActorId: target.id,
                    loadoutEntryId: selection.heldItemId
                  }) ??
                  (() => {
                    throw new EncounterConflictError('Optional combat Creature target is stale.')
                  })(),
                actor: target
              })
        return { applicationOutputs: outputs }
      }
    }
  }).executeResolved(aggregatePort({ command: input.command }), {
    commandId: input.command.commandId,
    correlationId: input.command.correlationId,
    expectedAggregateVersion: input.command.expectedEncounterVersion,
    intent: createEncounterActionStartIntent({
      actionId: input.command.actionId,
      actorId: input.command.actorId,
      optionalCombatIntent: input.command.optionalCombatIntent,
      sceneContext: input.command.sceneContext,
      targetActorId: input.command.targetActorId
    }),
    allowPaused: false,
    maximumAutomaticEvidenceRequests: 2,
    async resolve({ db, occurrenceId }) {
      resolved = await resolveCurrentContest({ db, command: input.command, occurrenceId })
      const mode: AutomationMode =
        resolved.encounter.automationMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'ASSISTED'
      if (mode === 'ASSISTED') {
        return {
          published: resolved.graph.published,
          facts: {
            'dnd5e.optional-combat.contest.initiator-modifier': resolved.pending.initiator.modifier,
            'dnd5e.optional-combat.contest.target-modifier': resolved.pending.defender.modifier
          },
          allowPaused: true,
          pendingApplicationContext: resolved.pending
        }
      }
      return {
        published: resolved.graph.published,
        facts: {
          'dnd5e.optional-combat.contest.initiator-modifier': resolved.pending.initiator.modifier,
          'dnd5e.optional-combat.contest.target-modifier': resolved.pending.defender.modifier
        },
        pendingApplicationContext: resolved.pending,
        async resolveAutomaticEvidence({ request }) {
          const participant = request.nodeId === 'initiator_d20' ? 'INITIATOR' : 'DEFENDER'
          const policy = sealedContestPolicy({
            policy:
              participant === 'INITIATOR'
                ? resolved!.pending.initiator
                : resolved!.pending.defender,
            requestNodeId: participant === 'INITIATOR' ? 'initiator_d20' : 'target_d20'
          })
          const faces = automaticFaces(policy, input.rollD20)
          automaticRolls.set(participant, faces)
          const value =
            policy.rollMode === 'ADVANTAGE'
              ? Math.max(...faces)
              : policy.rollMode === 'DISADVANTAGE'
                ? Math.min(...faces)
                : faces[0]!
          return { requestId: request.requestId, value }
        }
      }
    }
  })
}

type ResumeOptionalContestActionCommand = {
  actorUserId: string
  commandId: string
  correlationId: string | null
  encounterId: string
  expectedEncounterVersion: number
  expectedOccurrenceVersion: number
  occurrenceId: string
  resolution:
    | { kind: 'ENTER_DICE'; requestId: string; rawFaces: readonly number[] }
    | { kind: 'SYSTEM_ROLL'; requestId: string }
  liveSessionAuthority?: LiveSessionCommandAuthority
}

function sealedDisarmIntent(
  pending: ServerOptionalCombatContestPendingApplicationContextDto
): OptionalCombatActionIntentDto {
  const definitionId = pending.optionalCombat.definitionId
  const selection = requireDisarmSelection(pending)
  return {
    optionId: pending.optionId,
    definitionId,
    selectionContract: pending.selectionContractChecksum,
    selections: [
      {
        fieldId: checksumRuleDocument({ definitionId, role: 'DEFENDER_CHECK' }),
        value: { kind: 'ENTITY' as const, entityId: selection.defenderCheckDefinitionId }
      },
      {
        fieldId: checksumRuleDocument({ definitionId, role: 'HELD_ITEM' }),
        value: { kind: 'ENTITY' as const, entityId: selection.heldItemId }
      }
    ].sort((left, right) => left.fieldId.localeCompare(right.fieldId))
  }
}

function nextContestParticipant(
  pending: ServerOptionalCombatContestPendingApplicationContextDto
): 'INITIATOR' | 'DEFENDER' {
  if (pending.rollEvidence.initiator === null) return 'INITIATOR'
  if (pending.rollEvidence.defender === null) return 'DEFENDER'
  throw new EncounterConflictError('Optional combat contest is already complete.')
}

/** Resumes one sealed Assisted Disarm request without accepting client mechanics or selections. */
export async function resumeEncounterOptionalContestActionOccurrence(input: {
  db: DBLike
  runtime: RulesRuntimeService
  command: ResumeOptionalContestActionCommand
  pending: ServerOptionalCombatContestPendingApplicationContextDto
  rollD20?: () => number
}) {
  const participant = nextContestParticipant(input.pending)
  const command: EncounterOptionalContestActionCommand = {
    actionId: input.pending.actionId,
    actorId: input.pending.sourceActorId,
    actorUserId: input.command.actorUserId,
    commandId: input.command.commandId,
    correlationId: input.command.correlationId,
    encounterId: input.command.encounterId,
    expectedEncounterVersion: input.command.expectedEncounterVersion,
    optionalCombatIntent: sealedDisarmIntent(input.pending),
    sceneContext: null,
    targetActorId: input.pending.targetActorId,
    ...(input.command.liveSessionAuthority
      ? { liveSessionAuthority: input.command.liveSessionAuthority }
      : {})
  }
  let resolved: ResolvedContest | null = null
  return createRuleExecutionOccurrenceService({ db: input.db, runtime: input.runtime }).resume(
    aggregatePort({ command }),
    {
      commandId: input.command.commandId,
      correlationId: input.command.correlationId,
      expectedAggregateVersion: input.command.expectedEncounterVersion,
      occurrenceId: input.command.occurrenceId,
      expectedOccurrenceVersion: input.command.expectedOccurrenceVersion,
      resolutionIntent:
        input.command.resolution.kind === 'ENTER_DICE'
          ? {
              kind: 'PHYSICAL' as const,
              requestId: input.command.resolution.requestId,
              rawFaces: input.command.resolution.rawFaces
            }
          : { kind: 'SYSTEM' as const, requestId: input.command.resolution.requestId },
      async resolve({ db, occurrenceId, applicationContext }) {
        if (applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST') {
          throw new EncounterConflictError('Optional combat contest occurrence is unavailable.')
        }
        resolved = await resolveCurrentContest({
          db,
          command,
          occurrenceId,
          expectedPending: applicationContext,
          responseParticipant: participant
        })
        return {
          published: resolved.graph.published,
          facts: {
            'dnd5e.optional-combat.contest.initiator-modifier': resolved.pending.initiator.modifier,
            'dnd5e.optional-combat.contest.target-modifier': resolved.pending.defender.modifier
          },
          pendingApplicationContext: resolved.pending
        }
      },
      async deriveOptionalContestD20Response({ applicationContext, resolutionIntent, request }) {
        if (applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST') {
          throw new EncounterConflictError('Optional combat contest occurrence is unavailable.')
        }
        const resolution = resolutionIntent as
          | { kind: 'PHYSICAL'; requestId: string; rawFaces: readonly number[] }
          | { kind: 'SYSTEM'; requestId: string }
        const currentParticipant = requireDnd5eOptionalCombatContestRequestParticipant({
          pending: applicationContext,
          requestNodeId: request.nodeId
        })
        if (currentParticipant !== participant || resolution.requestId !== request.requestId) {
          throw new EncounterConflictError('Optional combat contest request is unavailable.')
        }
        const policy = sealedContestPolicy({
          policy:
            currentParticipant === 'INITIATOR'
              ? applicationContext.initiator
              : applicationContext.defender,
          requestNodeId: currentParticipant === 'INITIATOR' ? 'initiator_d20' : 'target_d20'
        })
        const expectedFaces = policy.rollMode === 'NORMAL' ? 1 : 2
        const rawFaces =
          resolution.kind === 'SYSTEM'
            ? automaticFaces(policy, input.rollD20)
            : [...resolution.rawFaces]
        if (
          rawFaces.length !== expectedFaces ||
          rawFaces.some((face) => !Number.isSafeInteger(face) || face < 1 || face > 20)
        ) {
          throw new EncounterValidationError('Optional combat contest dice are invalid.')
        }
        const value =
          policy.rollMode === 'ADVANTAGE'
            ? Math.max(...rawFaces)
            : policy.rollMode === 'DISADVANTAGE'
              ? Math.min(...rawFaces)
              : rawFaces[0]!
        return { response: { requestId: request.requestId, value }, rawFaces }
      },
      completionApplicator: {
        async apply({ db, execution, occurrenceId, pendingApplicationContext }) {
          if (!resolved || pendingApplicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST') {
            throw new EncounterConflictError('Optional combat contest settlement is unavailable.')
          }
          const complete = contestExecution({ execution, pending: pendingApplicationContext })
          const selection = requireDisarmSelection(pendingApplicationContext)
          const settle = async (
            target: Parameters<typeof settleEncounterOptionalContestAction>[0]['target']
          ) =>
            settleEncounterOptionalContestAction({
              db,
              occurrenceId,
              pending: pendingApplicationContext,
              execution: complete,
              sourceActor: resolved!.sourceActor,
              actionEconomy: resolved!.actionEconomy ?? null,
              target,
              updateActor: (actor) => createEncounterRepository(db).updateActor(actor)
            })
          return {
            applicationOutputs:
              resolved.targetActor.kind === 'CHARACTER'
                ? await withLockedEncounterCharacterOptionalContestContext(
                    {
                      actorUserId: input.command.actorUserId,
                      attunementSlotOverride: resolved!.attunementSlotOverride,
                      commandId: input.command.commandId,
                      db,
                      encounter: resolved.encounter,
                      occurrenceId,
                      selectedItemId: selection.heldItemId,
                      sourceCommandId: input.command.commandId,
                      targetActorId: resolved.targetActor.id,
                      targets: resolved.targets,
                      ...(input.command.liveSessionAuthority
                        ? { liveSessionAuthority: input.command.liveSessionAuthority }
                        : {})
                    },
                    (context) => settle({ kind: 'CHARACTER', context })
                  )
                : await settle({
                    kind: 'ENCOUNTER_ACTOR',
                    context:
                      prepareEncounterActorOptionalContestContext({
                        targets: resolved.targets,
                        targetActorId: resolved.targetActor.id,
                        loadoutEntryId: selection.heldItemId
                      }) ??
                      (() => {
                        throw new EncounterConflictError(
                          'Optional combat Creature target is stale.'
                        )
                      })(),
                    actor: resolved.targetActor
                  })
          }
        }
      }
    }
  )
}
