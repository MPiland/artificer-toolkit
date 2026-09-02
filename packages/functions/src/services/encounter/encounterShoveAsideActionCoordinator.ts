import { randomInt } from 'node:crypto'

import { type DBLike, type EncounterActorRecord, type EncounterRecord } from '@artificer-toolkit/db'
import type { OptionalCombatActionIntentDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  ServerCompletedRuleExecutionDto,
  ServerOptionalCombatContestPendingApplicationContextDto,
  ServerRuleExecutionApplicationOutputsDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { serverRuleExecutionApplicationOutputsDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumCanonicalJson } from '@artificer-toolkit/db'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  areSquareGridFootprintsAdjacent,
  deriveSquareGridShoveAsideDestinations,
  enumerateSquareGridFootprint,
  lengthMeasurementInSceneUnits
} from '@artificer-toolkit/shared/vtt'

import type { LiveSessionCommandAuthority } from '../campaign/liveSessionCommandAuthority.js'
import {
  createRuleExecutionOccurrenceService,
  type RuleExecutionAggregatePort
} from '../rules/ruleExecutionOccurrenceService.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  createDnd5eOptionalCombatActionSelectionDescriptor,
  resolveDnd5eOptionalCombatActionSelection
} from '../rules/systems/dnd5e/optionalCombatActionSelection.js'
import { createDnd5eOptionalCombatContestGraph } from '../rules/systems/dnd5e/optionalCombatContestGraph.js'
import {
  isDnd5eOptionalCombatContestPendingContextCurrent,
  prepareDnd5eOptionalCombatContestPendingContext,
  requireDnd5eOptionalCombatContestRequestParticipant
} from '../rules/systems/dnd5e/optionalCombatContestPendingContext.js'
import { resolveDnd5eShoveAside } from '../rules/systems/dnd5e/optionalMovementPolicy.js'
import {
  lockEncounterActiveEffectTargets,
  type LockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import {
  prepareActionEconomyConsumption,
  consumePreparedActionEconomy
} from './encounterActionSettlementCore.js'
import { prepareEncounterActorOptionalContestFacts } from './encounterActorOptionalContestContext.js'
import {
  createEncounterActionStartIntent,
  revalidateEncounterActionSceneDependency,
  toEncounterActionSceneDependency,
  type LockedEncounterActionSceneContext
} from './encounterActionSceneContext.js'
import {
  settleEncounterShoveAsideMovement,
  shoveAsideSceneStateChecksum
} from './encounterActionForcedMovement.js'
import { evaluateEncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'
import {
  completeEncounterOptionalContestActionExecution,
  type OptionalContestD20Policy
} from './encounterOptionalContestActionExecution.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { lockEncounterRuleExecutionCommandContext } from './encounterRuleExecutionCommandContext.js'

type AutomationMode = 'AUTOMATIC' | 'ASSISTED'
type ContestParticipant = 'INITIATOR' | 'DEFENDER'

export type EncounterShoveAsideCommand = {
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

type ResumeShoveAsideCommand = {
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

type ResolvedShoveAside = {
  actionEconomy: Awaited<ReturnType<typeof prepareActionEconomyConsumption>>
  encounter: EncounterRecord
  pending: ServerOptionalCombatContestPendingApplicationContextDto
  sceneContext: LockedEncounterActionSceneContext
  sourceActor: EncounterActorRecord
  targetActor: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
  graph: ReturnType<typeof createDnd5eOptionalCombatContestGraph>
}

function activeShoveAsideDefinition(input: {
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
  )
    return null
  return (
    activeOptionalCombatDefinitions({
      automationMode: input.encounter.automationMode,
      snapshot: snapshot.data
    }).find(
      (definition) =>
        definition.document.kind === 'SHOVE_ASIDE' &&
        definition.definitionId === input.intent!.definitionId
    ) ?? null
  )
}

export function isActiveEncounterShoveAsideIntent(input: {
  encounter: EncounterRecord
  intent: OptionalCombatActionIntentDto | null | undefined
}): boolean {
  return activeShoveAsideDefinition(input) !== null
}

function sizeRank(size: string | null): number | null {
  switch (size) {
    case 'TINY':
      return 0
    case 'SMALL':
      return 1
    case 'MEDIUM':
      return 2
    case 'LARGE':
      return 3
    case 'HUGE':
      return 4
    case 'GARGANTUAN':
      return 5
    default:
      return null
  }
}

function shoveAsideDisplacement(grid: LockedEncounterActionSceneContext['grid']): number {
  try {
    const displacement = lengthMeasurementInSceneUnits({ amount: 5, unit: 'FEET' }, grid)
    if (displacement === null || displacement <= 0) {
      throw new EncounterValidationError(
        'Shove Aside displacement cannot be converted for this Scene.'
      )
    }
    return displacement
  } catch (error) {
    if (error instanceof EncounterValidationError) throw error
    throw new EncounterValidationError(
      'Shove Aside displacement cannot be converted for this Scene.'
    )
  }
}

function effectivePolicy(
  character: LockedEncounterActiveEffectTargets['lockedCharacters'] extends ReadonlyMap<
    string,
    infer Value
  >
    ? Value
    : never
) {
  return (
    character.effectiveRulePolicyOutput ??
    (character.overlay.kind === 'MATERIALIZED'
      ? character.overlay.rulePolicyOutput
      : character.mechanics.rulePolicyOutput)
  )
}

function actorFacts(input: {
  actor: EncounterActorRecord
  checkDefinitionId: string
  targets: LockedEncounterActiveEffectTargets
}) {
  if (input.actor.kind === 'CHARACTER' && input.actor.sourceId) {
    const character = input.targets.lockedCharacters.get(input.actor.sourceId)
    if (!character) throw new EncounterConflictError('Shove Aside Character facts are stale.')
    const modifier = character.mechanics.initiativeActorFacts.checkTotals[input.checkDefinitionId]
    const policy = effectivePolicy(character)
    const mode = policy.rollModes.skillChecks[input.checkDefinitionId] ?? 'NORMAL'
    const contributors = (
      policy.rollContributorEvidence.skillChecks[input.checkDefinitionId] ?? []
    ).map(({ sourceId, grantId, domainKey, influence }) => ({
      sourceId,
      grantId: grantId ?? null,
      domainKey: domainKey ?? null,
      influence
    }))
    return {
      controllerCharacterId: character.id,
      contributors,
      incapacitated: character.activeConditionDefinitionIds.length === 0 ? false : null,
      modifier: Number.isSafeInteger(modifier) ? modifier : null,
      rollMode: mode,
      size: character.mechanics.initiativeActorFacts.effectiveSize
    }
  }
  if (input.actor.kind === 'CREATURE') {
    const facts = prepareEncounterActorOptionalContestFacts({
      targets: input.targets,
      targetActorId: input.actor.id
    })
    return {
      controllerCharacterId: null,
      contributors: [],
      incapacitated:
        Array.isArray(input.actor.conditions) && input.actor.conditions.length === 0 ? false : null,
      modifier: facts?.ruleFacts.checkTotals[input.checkDefinitionId] ?? null,
      rollMode: 'NORMAL' as const,
      size: facts?.size ?? null
    }
  }
  return {
    controllerCharacterId: null,
    contributors: [],
    incapacitated: null,
    modifier: null,
    rollMode: 'NORMAL' as const,
    size: null
  }
}

function automaticFaces(policy: OptionalContestD20Policy, rollD20?: () => number) {
  const count = policy.rollMode === 'NORMAL' ? 1 : 2
  return Array.from({ length: count }, () => (rollD20 ?? (() => randomInt(1, 21)))())
}

function sealedPolicy(
  policy: ServerOptionalCombatContestPendingApplicationContextDto['initiator'],
  requestNodeId: OptionalContestD20Policy['requestNodeId']
): OptionalContestD20Policy {
  if (policy.requestNodeId !== requestNodeId)
    throw new EncounterConflictError('Shove Aside request policy is stale.')
  return { ...policy, requestNodeId }
}

function completeExecution(input: {
  execution: ServerCompletedRuleExecutionDto
  pending: ServerOptionalCombatContestPendingApplicationContextDto
}) {
  const evidence = input.pending.rollEvidence
  if (!evidence.initiator || !evidence.defender)
    throw new EncounterConflictError('Shove Aside evidence is incomplete.')
  return completeEncounterOptionalContestActionExecution({
    execution: input.execution,
    initiator: sealedPolicy(input.pending.initiator, 'initiator_d20'),
    defender: sealedPolicy(input.pending.defender, 'target_d20'),
    rolls: new Map([
      ['INITIATOR', evidence.initiator.rawFaces],
      ['DEFENDER', evidence.defender.rawFaces]
    ])
  })
}

function nextParticipant(
  pending: ServerOptionalCombatContestPendingApplicationContextDto
): ContestParticipant {
  if (pending.rollEvidence.initiator === null) return 'INITIATOR'
  if (pending.rollEvidence.defender === null) return 'DEFENDER'
  throw new EncounterConflictError('Shove Aside contest is already complete.')
}

function sealedIntent(
  pending: ServerOptionalCombatContestPendingApplicationContextDto
): OptionalCombatActionIntentDto {
  if (pending.selection.kind !== 'SHOVE_ASIDE')
    throw new EncounterConflictError('Shove Aside selection is unavailable.')
  const definitionId = pending.optionalCombat.definitionId
  return {
    definitionId,
    optionId: pending.optionId,
    selectionContract: pending.selectionContractChecksum,
    selections: [
      {
        fieldId: checksumRuleDocument({ definitionId, role: 'DEFENDER_CHECK' }),
        value: { kind: 'ENTITY' as const, entityId: pending.selection.defenderCheckDefinitionId }
      },
      {
        fieldId: checksumRuleDocument({ definitionId, role: 'DESTINATION' }),
        value: { kind: 'POSITION' as const, position: pending.selection.destination }
      }
    ].sort((left, right) => left.fieldId.localeCompare(right.fieldId))
  }
}

async function resolveCurrent(input: {
  db: DBLike
  command: EncounterShoveAsideCommand
  expectedPending?: ServerOptionalCombatContestPendingApplicationContextDto
  participant?: ContestParticipant
}): Promise<ResolvedShoveAside> {
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
    !sourceActor ||
    !targetActor ||
    sourceActor.id === targetActor.id ||
    encounter.status !== 'ACTIVE' ||
    encounter.currentActorId !== sourceActor.id ||
    encounter.automationMode === 'MANUAL'
  )
    throw new EncounterConflictError('Shove Aside is not current.')
  if (
    !input.participant &&
    locked.context.role !== 'OWNER' &&
    (sourceActor.kind !== 'CHARACTER' ||
      !sourceActor.sourceId ||
      locked.context.assignedCharacterId !== sourceActor.sourceId)
  )
    throw new EncounterConflictError('Shove Aside authority is unavailable.')
  const definition = activeShoveAsideDefinition({
    encounter,
    intent: input.command.optionalCombatIntent
  })
  if (
    !definition ||
    input.command.actionId !== definition.definitionId ||
    !input.command.optionalCombatIntent
  )
    throw new EncounterConflictError('Shove Aside is unavailable.')
  const sceneContext = await revalidateEncounterActionSceneDependency({
    db: input.db,
    encounterId: encounter.id,
    actorId: sourceActor.id,
    targetActorId: targetActor.id,
    dependency:
      input.expectedPending?.sceneContext ??
      toEncounterActionSceneDependency(input.command.sceneContext)
  })
  if (!sceneContext?.scene || sceneContext.grid.kind !== 'SQUARE')
    throw new EncounterConflictError('Shove Aside requires an authoritative square-grid Scene.')
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
  const parameters = definition.document.parameters
  if (parameters.kind !== 'SHOVE_ASIDE')
    throw new EncounterConflictError('Shove Aside definition is invalid.')
  const attacker = actorFacts({
    actor: sourceActor,
    checkDefinitionId: parameters.initiatorCheckDefinitionId,
    targets
  })
  const scene = sceneContext.scene.state
  const sourceToken = scene.tokens.find((token) => token.id === sceneContext.sourceToken.tokenId)
  const targetToken = scene.tokens.find((token) => token.id === sceneContext.targetToken.tokenId)
  if (!sourceToken || !targetToken)
    throw new EncounterConflictError('Shove Aside tokens are stale.')
  const attackerFootprint = enumerateSquareGridFootprint(sceneContext.grid, sourceToken)
  const targetFootprint = enumerateSquareGridFootprint(sceneContext.grid, targetToken)
  if (!attackerFootprint || !targetFootprint)
    throw new EncounterConflictError('Shove Aside token geometry is stale.')
  const occupants = scene.tokens
    .filter((token) => token.id !== sourceToken.id && token.id !== targetToken.id)
    .map((token) => {
      const footprint = enumerateSquareGridFootprint(sceneContext.grid, token)
      return footprint ? { footprint, tokenId: token.id } : null
    })
  if (occupants.some((entry) => entry === null))
    throw new EncounterConflictError('Shove Aside occupancy is stale.')
  const displacement = shoveAsideDisplacement(sceneContext.grid)
  const destinations = deriveSquareGridShoveAsideDestinations({
    attacker: { footprint: attackerFootprint, tokenId: sourceToken.id },
    displacement,
    target: { footprint: targetFootprint, tokenId: targetToken.id },
    occupants: occupants as { footprint: typeof attackerFootprint; tokenId: string }[],
    state: { ...scene, grid: sceneContext.grid }
  })
  const targetCheckDefinitionIds = parameters.defenderCheckDefinitionIds.filter(
    (id) => actorFacts({ actor: targetActor, checkDefinitionId: id, targets }).modifier !== null
  )
  if (targetCheckDefinitionIds.length === 0)
    throw new EncounterValidationError('Shove Aside defender checks are unavailable.')
  if (destinations.length === 0)
    throw new EncounterValidationError('Shove Aside has no legal destination.')
  let descriptor: ReturnType<typeof createDnd5eOptionalCombatActionSelectionDescriptor>
  let selection: ReturnType<typeof resolveDnd5eOptionalCombatActionSelection>
  try {
    descriptor = createDnd5eOptionalCombatActionSelectionDescriptor({
      actionId: input.command.actionId,
      actorId: sourceActor.id,
      definition,
      targetActorId: targetActor.id,
      targetCheckDefinitionIds,
      allowedDestinationPositions: destinations.map((candidate) => candidate.position)
    })
    selection = resolveDnd5eOptionalCombatActionSelection({
      definition,
      descriptor,
      intent: input.command.optionalCombatIntent
    })
  } catch (error) {
    if (error instanceof EncounterConflictError || error instanceof EncounterValidationError)
      throw error
    throw new EncounterConflictError('Shove Aside selection is unavailable.')
  }
  const destination = selection.positions.DESTINATION
  const defenderCheckDefinitionId = selection.entities.DEFENDER_CHECK
  if (!destination || !defenderCheckDefinitionId)
    throw new EncounterConflictError('Shove Aside selection is incomplete.')
  const defender = actorFacts({
    actor: targetActor,
    checkDefinitionId: defenderCheckDefinitionId,
    targets
  })
  const economy = await prepareActionEconomyConsumption({
    db: input.db,
    encounter,
    activation: { code: 'ACTION', amount: 1 },
    gameSystemId: encounter.gameSystemId,
    sourceActor,
    targets
  })
  const policy = resolveDnd5eShoveAside({
    automationMode: encounter.automationMode,
    gameSystemId: encounter.gameSystemId,
    optionalCombatSnapshot: encounter.optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: encounter.optionalCombatSnapshotChecksum,
    attackerActorId: sourceActor.id,
    attackerSizeRank: sizeRank(attacker.size),
    actionEconomy: 'ACTION',
    actionEconomyAvailable: economy !== null,
    contest: { initiatorTotal: null, targetTotal: null },
    destination: {
      isLegal: destinations.some(
        (candidate) =>
          candidate.position.x === destination.x && candidate.position.y === destination.y
      ),
      remainsWithinAttackerReach: true,
      distanceFeet: 5
    },
    targetActorId: targetActor.id,
    targetCheckDefinitionId: defenderCheckDefinitionId,
    targetIncapacitated: defender.incapacitated,
    targetInReach: areSquareGridFootprintsAdjacent({
      grid: sceneContext.grid,
      left: attackerFootprint,
      right: targetFootprint
    }),
    targetSizeRank: sizeRank(defender.size),
    qualifiedInitiatorContributors: attacker.contributors.map((contributor) => ({
      id: contributor.sourceId,
      influence: contributor.influence,
      reason: 'EXISTING_QUALIFIED_FACT' as const
    }))
  })
  if (policy.kind === 'JUDGMENT_REQUIRED')
    throw new EncounterValidationError(`Shove Aside requires GM adjudication: ${policy.reason}.`)
  if (
    policy.kind !== 'PROPOSED' ||
    attacker.modifier === null ||
    defender.modifier === null ||
    economy === null ||
    economy === undefined
  )
    throw new EncounterConflictError('Shove Aside is unavailable.')
  const preparedEconomy = economy
  const graph = createDnd5eOptionalCombatContestGraph({
    ...policy.proposal.pin,
    moduleContractVersion: 1
  })
  const stateChecksum = shoveAsideSceneStateChecksum({
    destination,
    displacement: { amount: 5, unit: 'FEET', sceneUnits: displacement },
    scene,
    sourceToken,
    targetToken
  })
  const current: Parameters<typeof prepareDnd5eOptionalCombatContestPendingContext>[0] = {
    actionKind: 'SHOVE_ASIDE',
    actionId: input.command.actionId,
    sourceActorId: sourceActor.id,
    targetActorId: targetActor.id,
    initiatorControllerCharacterId: attacker.controllerCharacterId,
    sceneContext: toEncounterActionSceneDependency(sceneContext),
    positionalDependencyChecksum: checksumRuleDocument(
      toEncounterActionSceneDependency(sceneContext)
    ),
    optionalCombat: {
      snapshotChecksum: encounter.optionalCombatSnapshotChecksum!,
      definitionId: policy.proposal.pin.definitionId,
      definitionVersion: policy.proposal.pin.definitionVersion,
      definitionChecksum: policy.proposal.pin.definitionChecksum,
      moduleKey: policy.proposal.pin.moduleKey,
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
    source: {
      kind: 'OPTIONAL_COMBAT_DEFINITION',
      definitionId: policy.proposal.pin.definitionId,
      definitionVersion: policy.proposal.pin.definitionVersion,
      definitionChecksum: policy.proposal.pin.definitionChecksum,
      moduleKey: policy.proposal.pin.moduleKey,
      moduleContractVersion: 1
    },
    target:
      targetActor.kind === 'CHARACTER' && targetActor.sourceId
        ? (() => {
            const character = targets.lockedCharacters.get(targetActor.sourceId)
            if (!character) throw new EncounterConflictError('Shove Aside target is stale.')
            return {
              kind: 'CHARACTER' as const,
              characterId: character.id,
              streamVersion: character.streamVersion,
              projectionChecksum: character.mechanics.projectionChecksum,
              mechanicalContextChecksum: character.overlay.mechanicalContextChecksum,
              stateChecksum: checksumRuleDocument({
                checkDefinitionId: defenderCheckDefinitionId,
                streamVersion: character.streamVersion
              })
            }
          })()
        : {
            kind: 'ENCOUNTER_ACTOR' as const,
            currentnessChecksum: checksumRuleDocument({
              actorId: targetActor.id,
              checkDefinitionId: defenderCheckDefinitionId
            })
          },
    initiator: {
      actorId: sourceActor.id,
      requestNodeId: 'initiator_d20',
      rollMode: policy.proposal.contest.initiatorMode,
      contributors: policy.proposal.contest.initiatorContributors.map((contributor) => ({
        sourceId: contributor.id,
        grantId: null,
        domainKey: null,
        influence: contributor.influence
      })),
      contributorChecksum: checksumRuleDocument(
        policy.proposal.contest.initiatorContributors.map((contributor) => ({
          sourceId: contributor.id,
          grantId: null,
          domainKey: null,
          influence: contributor.influence
        }))
      ),
      modifier: attacker.modifier
    },
    defender: {
      actorId: targetActor.id,
      requestNodeId: 'target_d20',
      rollMode: defender.rollMode,
      contributors: defender.contributors,
      contributorChecksum: checksumRuleDocument(defender.contributors),
      modifier: defender.modifier,
      checkDefinitionId: defenderCheckDefinitionId
    },
    rollEvidence: input.expectedPending?.rollEvidence ?? { initiator: null, defender: null },
    selection: {
      kind: 'SHOVE_ASIDE',
      defenderCheckDefinitionId,
      destination,
      displacement: { amount: 5, unit: 'FEET', sceneUnits: displacement },
      sceneId: scene.id,
      sceneVersion: scene.version,
      targetTokenId: targetToken.id,
      stateChecksum
    },
    actionEconomy: {
      definitionId: preparedEconomy.definitionId,
      definitionVersion: preparedEconomy.definitionVersion,
      definitionChecksum: preparedEconomy.definitionChecksum,
      maximum: preparedEconomy.maximum,
      beforeUsed: preparedEconomy.beforeUsed
    }
  }
  const pending = prepareDnd5eOptionalCombatContestPendingContext(current)
  if (
    input.expectedPending &&
    !isDnd5eOptionalCombatContestPendingContextCurrent({ pending: input.expectedPending, current })
  )
    throw new EncounterConflictError('Shove Aside pending facts changed.')
  if (input.participant) {
    const requiredCharacterId =
      input.participant === 'INITIATOR'
        ? attacker.controllerCharacterId
        : defender.controllerCharacterId
    if (
      locked.context.role !== 'OWNER' &&
      (!requiredCharacterId || locked.context.assignedCharacterId !== requiredCharacterId)
    )
      throw new EncounterConflictError('Shove Aside authority is unavailable.')
  }
  return {
    actionEconomy: economy,
    encounter,
    pending,
    sceneContext,
    sourceActor,
    targetActor,
    targets,
    graph
  }
}

function aggregatePort(command: EncounterShoveAsideCommand): RuleExecutionAggregatePort {
  return {
    async withLockedAuthorized(db, run) {
      const locked = await lockEncounterRuleExecutionCommandContext(db, {
        actorUserId: command.actorUserId,
        authority: 'ACTIVE_MEMBER',
        encounterId: command.encounterId,
        ...(command.liveSessionAuthority
          ? { liveSessionAuthority: command.liveSessionAuthority }
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

async function settlement(input: {
  db: DBLike
  command: EncounterShoveAsideCommand
  execution: ServerCompletedRuleExecutionDto
  occurrenceId: string
  pending: ServerOptionalCombatContestPendingApplicationContextDto
  resolved: ResolvedShoveAside
}) {
  if (input.pending.selection.kind !== 'SHOVE_ASIDE')
    throw new EncounterConflictError('Shove Aside selection is unavailable.')
  const complete = completeExecution({ execution: input.execution, pending: input.pending })
  const sourceWon = complete.initiator.total > complete.defender.total
  if (sourceWon)
    await settleEncounterShoveAsideMovement({
      db: input.db,
      encounter: input.resolved.encounter,
      actorUserId: input.command.actorUserId,
      commandId: input.command.commandId,
      commandFingerprint: checksumRuleDocument({
        occurrenceId: input.occurrenceId,
        pending: input.pending
      }),
      sceneContext: input.resolved.sceneContext,
      sourceActorId: input.resolved.sourceActor.id,
      targetActorId: input.resolved.targetActor.id,
      destination: input.pending.selection.destination,
      displacement: input.pending.selection.displacement,
      stateChecksum: input.pending.selection.stateChecksum,
      ...(input.command.liveSessionAuthority
        ? { liveSessionAuthority: input.command.liveSessionAuthority }
        : {})
    })
  await consumePreparedActionEconomy({
    db: input.db,
    sourceActor: input.resolved.sourceActor,
    consumption: input.resolved.actionEconomy!
  })
  return serverRuleExecutionApplicationOutputsDtoSchema.parse({
    kind: 'CONTESTED_ACTION',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    sourceActorId: input.pending.sourceActorId,
    targetActorId: input.pending.targetActorId,
    sealedContextChecksum: checksumRuleDocument(input.pending),
    policy: input.pending.optionalCombat,
    contestGraph: input.pending.contestGraph,
    sourceRoll: complete.initiator,
    targetRoll: complete.defender,
    outcome: sourceWon ? 'SOURCE_WIN' : 'TARGET_WIN_OR_TIE',
    stateTransition: sourceWon
      ? {
          kind: 'SCENE_TOKEN_MOVED',
          destination: input.pending.selection.destination,
          tokenId: input.pending.selection.targetTokenId
        }
      : { kind: 'NONE' },
    actionEconomyTransition: { ...input.resolved.actionEconomy }
  }) as Extract<ServerRuleExecutionApplicationOutputsDto, { kind: 'CONTESTED_ACTION' }>
}

export async function executeEncounterShoveAsideOccurrence(input: {
  db: DBLike
  runtime: RulesRuntimeService
  command: EncounterShoveAsideCommand
  rollD20?: () => number
}) {
  let resolved: ResolvedShoveAside | null = null
  const automaticRolls = new Map<ContestParticipant, readonly number[]>()
  return createRuleExecutionOccurrenceService({
    db: input.db,
    runtime: input.runtime,
    completionApplicator: {
      async apply({ db, execution, occurrenceId, pendingApplicationContext }) {
        if (!resolved || pendingApplicationContext?.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST')
          throw new EncounterConflictError('Shove Aside settlement is unavailable.')
        const pending = pendingApplicationContext.rollEvidence.initiator
          ? pendingApplicationContext
          : prepareDnd5eOptionalCombatContestPendingContext({
              ...pendingApplicationContext,
              rollEvidence: {
                initiator: {
                  requestId: 'initiator_d20',
                  rawFaces: [...(automaticRolls.get('INITIATOR') ?? [])]
                },
                defender: {
                  requestId: 'target_d20',
                  rawFaces: [...(automaticRolls.get('DEFENDER') ?? [])]
                }
              }
            })
        return {
          applicationOutputs: await settlement({
            db,
            command: input.command,
            execution,
            occurrenceId,
            pending,
            resolved
          })
        }
      }
    }
  }).executeResolved(aggregatePort(input.command), {
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
    async resolve({ db }) {
      resolved = await resolveCurrent({ db, command: input.command })
      const mode: AutomationMode =
        resolved.encounter.automationMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'ASSISTED'
      return {
        published: resolved.graph.published,
        facts: {
          'dnd5e.optional-combat.contest.initiator-modifier': resolved.pending.initiator.modifier,
          'dnd5e.optional-combat.contest.target-modifier': resolved.pending.defender.modifier
        },
        ...(mode === 'ASSISTED'
          ? { allowPaused: true }
          : {
              async resolveAutomaticEvidence({ request }) {
                const participant = request.nodeId === 'initiator_d20' ? 'INITIATOR' : 'DEFENDER'
                const policy = sealedPolicy(
                  participant === 'INITIATOR'
                    ? resolved!.pending.initiator
                    : resolved!.pending.defender,
                  participant === 'INITIATOR' ? 'initiator_d20' : 'target_d20'
                )
                const rawFaces = automaticFaces(policy, input.rollD20)
                automaticRolls.set(participant, rawFaces)
                return {
                  requestId: request.requestId,
                  value:
                    policy.rollMode === 'ADVANTAGE'
                      ? Math.max(...rawFaces)
                      : policy.rollMode === 'DISADVANTAGE'
                        ? Math.min(...rawFaces)
                        : rawFaces[0]!
                }
              }
            }),
        pendingApplicationContext: resolved.pending
      }
    }
  })
}

export async function resumeEncounterShoveAsideOccurrence(input: {
  db: DBLike
  runtime: RulesRuntimeService
  command: ResumeShoveAsideCommand
  pending: ServerOptionalCombatContestPendingApplicationContextDto
  rollD20?: () => number
}) {
  const participant = nextParticipant(input.pending)
  const command: EncounterShoveAsideCommand = {
    actionId: input.pending.actionId,
    actorId: input.pending.sourceActorId,
    actorUserId: input.command.actorUserId,
    commandId: input.command.commandId,
    correlationId: input.command.correlationId,
    encounterId: input.command.encounterId,
    expectedEncounterVersion: input.command.expectedEncounterVersion,
    optionalCombatIntent: sealedIntent(input.pending),
    sceneContext: null,
    targetActorId: input.pending.targetActorId,
    ...(input.command.liveSessionAuthority
      ? { liveSessionAuthority: input.command.liveSessionAuthority }
      : {})
  }
  let resolved: ResolvedShoveAside | null = null
  return createRuleExecutionOccurrenceService({ db: input.db, runtime: input.runtime }).resume(
    aggregatePort(command),
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
      async resolve({ db, applicationContext }) {
        if (applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST')
          throw new EncounterConflictError('Shove Aside occurrence is unavailable.')
        resolved = await resolveCurrent({
          db,
          command,
          expectedPending: applicationContext,
          participant
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
        if (applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST')
          throw new EncounterConflictError('Shove Aside occurrence is unavailable.')
        const resolution = resolutionIntent as
          | { kind: 'PHYSICAL'; requestId: string; rawFaces: readonly number[] }
          | { kind: 'SYSTEM'; requestId: string }
        const currentParticipant = requireDnd5eOptionalCombatContestRequestParticipant({
          pending: applicationContext,
          requestNodeId: request.nodeId
        })
        if (currentParticipant !== participant || resolution.requestId !== request.requestId)
          throw new EncounterConflictError('Shove Aside request is unavailable.')
        const policy = sealedPolicy(
          currentParticipant === 'INITIATOR'
            ? applicationContext.initiator
            : applicationContext.defender,
          currentParticipant === 'INITIATOR' ? 'initiator_d20' : 'target_d20'
        )
        const rawFaces =
          resolution.kind === 'SYSTEM' ? automaticFaces(policy, input.rollD20) : resolution.rawFaces
        const expectedFaces = policy.rollMode === 'NORMAL' ? 1 : 2
        if (
          rawFaces.length !== expectedFaces ||
          rawFaces.some((face) => !Number.isSafeInteger(face) || face < 1 || face > 20)
        )
          throw new EncounterValidationError('Shove Aside dice are invalid.')
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
          if (!resolved || pendingApplicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST')
            throw new EncounterConflictError('Shove Aside settlement is unavailable.')
          return {
            applicationOutputs: await settlement({
              db,
              command,
              execution,
              occurrenceId,
              pending: pendingApplicationContext,
              resolved
            })
          }
        }
      }
    }
  )
}
