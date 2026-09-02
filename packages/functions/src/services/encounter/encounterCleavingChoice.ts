import { v5 as uuidv5 } from 'uuid'

import {
  checksumCanonicalJson,
  createEncounterRepository,
  createRuleOccurrenceRepository,
  createVttSceneRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord,
  type RuleOccurrenceRecord
} from '@artificer-toolkit/db'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  storedRuleExecutionResultDtoSchema,
  type ServerAggregateChoicePendingSnapshotDto,
  type ServerRuleExecutionApplicationOutputsDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  lengthMeasurementInSceneUnits,
  measureSceneTokenFootprintDistance
} from '@artificer-toolkit/shared/vtt'

import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  resolveDnd5eCleaving,
  type Dnd5eOptionalResolutionPin
} from '../rules/systems/dnd5e/optionalResolutionPolicy.js'
import type { LockedEncounterActionSceneContext } from './encounterActionSceneContext.js'
import {
  lockEncounterActiveEffectTargets,
  type LockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import {
  applyLockedEncounterActorMechanicsBatch,
  applyLockedEncounterCharacterMechanicsBatch,
  type EvaluatedEncounterMechanicsBatch
} from './encounterCharacterMechanicsBatch.js'
import type { CharacterRuleActionApplication } from '../rules/characterRuleActionSystemAdapter.js'
import { revalidateEncounterActionSceneDependency } from './encounterActionSceneContext.js'
import { evaluateEncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'
import { EncounterConflictError } from './encounterErrors.js'
import {
  compileEncounterCurrentProjection,
  projectGm,
  snapshotStatBlock
} from './encounterProjection.js'

const DND5E_CLEAVING_OCCURRENCE_NAMESPACE = 'f14e5297-ff30-5b22-9182-6cb2d5e3f5ed'

type CleavingContext = Extract<
  ServerAggregateChoicePendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' }
>

type CleavingDamageApplication = {
  ordinal: number
  kind: 'DAMAGE'
  sourceNodeId: string
  sourceOperationKey: string
  damageTypeId: string
  requestedAmount: number
  resolvedAmount: number
  appliedAmount: number
  beforeCurrentHitPoints: number
  afterCurrentHitPoints: number
  beforeTemporaryHitPoints: number
  afterTemporaryHitPoints: number
  maximumHitPoints: number
  targetActorId: string
  damageDisposition: 'NORMAL' | 'IMMUNE' | 'RESISTANT' | 'VULNERABLE' | 'CANCELLED'
}

function toMechanicsDamageApplication(
  application: CleavingDamageApplication
): Extract<CharacterRuleActionApplication, { kind: 'DAMAGE' }> {
  return {
    ...application,
    authoredPath: null,
    resolvedPath: null
  }
}

/** The minimal finalized output surface Cleaving is allowed to retain. */
type CleavingApplicationFacts = {
  nestedD20: unknown | null
  d20: { total: number; selectedNatural: number } | null
  targetTransition: {
    before: { currentHitPoints: number; temporaryHitPoints: number; maximumHitPoints: number }
    after: { currentHitPoints: number; temporaryHitPoints: number; maximumHitPoints: number }
  }
  applications: readonly CleavingDamageApplication[]
}

function isMechanicsBatch(
  value: ServerRuleExecutionApplicationOutputsDto
): value is Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
> {
  return (
    value.kind === 'CHARACTER_MECHANICS_BATCH' || value.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
}

function normalizeCleavingApplication(
  value: CleavingApplicationFacts | ServerRuleExecutionApplicationOutputsDto,
  targetActorId?: string
): CleavingApplicationFacts | null {
  if (!('kind' in value)) return value
  if (!isMechanicsBatch(value)) return null
  if (!value.d20) return null
  if (!targetActorId) return null
  const applications: CleavingDamageApplication[] = []
  for (const application of value.applications) {
    if (application.kind !== 'DAMAGE') continue
    applications.push({
      ordinal: application.ordinal,
      kind: 'DAMAGE',
      sourceNodeId: application.sourceNodeId,
      sourceOperationKey: application.sourceOperationKey,
      damageTypeId: application.damageTypeId,
      requestedAmount: application.requestedAmount,
      resolvedAmount: application.resolvedAmount,
      appliedAmount: application.appliedAmount,
      beforeCurrentHitPoints: application.beforeCurrentHitPoints,
      afterCurrentHitPoints: application.afterCurrentHitPoints,
      beforeTemporaryHitPoints: application.beforeTemporaryHitPoints,
      afterTemporaryHitPoints: application.afterTemporaryHitPoints,
      maximumHitPoints: application.maximumHitPoints,
      targetActorId,
      damageDisposition: application.damageDisposition
    })
  }
  return {
    nestedD20: value.nestedD20,
    d20: { total: value.d20.total, selectedNatural: value.d20.selectedNatural },
    targetTransition: value.targetTransition,
    applications
  }
}

export interface EncounterCleavingCandidateFact {
  actorId: string
  armorClass: number | null
  footprintChecksum: string
  originalAttackCanHit: boolean | null
  targetActorVersion: number
  targetStateChecksum: string
  targetTokenId: string
  withinAttackerReach: boolean | null
}

/**
 * Derives only exact, already-locked target facts. Statless Custom actors are
 * intentionally omitted: without an authoritative AC, the original attack
 * cannot be revalidated against them.
 */
export function discoverEncounterCleavingCandidates(input: {
  actorIdByTokenId: ReadonlyMap<string, string>
  d20: { selectedNatural: number; total: number }
  encounter: EncounterRecord
  initialTargetActorId: string
  sourceActorId: string
  actionRange: unknown
  lockedCharacterFacts: LockedEncounterActiveEffectTargets['lockedCharacters']
  sceneContext: LockedEncounterActionSceneContext
}): readonly EncounterCleavingCandidateFact[] {
  if (!input.sceneContext.scene) return []
  const parsedRange = rangeDtoSchema.safeParse(input.actionRange)
  if (!parsedRange.success || parsedRange.data.rangeKind !== 'DISTANCE') return []
  const reach = lengthMeasurementInSceneUnits(
    { amount: parsedRange.data.amount, unit: parsedRange.data.unit },
    input.sceneContext.grid
  )
  if (reach === null) return []
  const sourceToken = input.sceneContext.scene.state.tokens.find(
    (token) => token.id === input.sceneContext.sourceToken.tokenId
  )
  if (!sourceToken || input.actorIdByTokenId.get(sourceToken.id) !== input.sourceActorId) return []
  return input.sceneContext.scene.state.tokens
    .flatMap((token): EncounterCleavingCandidateFact[] => {
      const actorId = input.actorIdByTokenId.get(token.id)
      const actor = input.encounter.actors.find((candidate) => candidate.id === actorId)
      if (
        !actor ||
        actor.id === input.sourceActorId ||
        actor.id === input.initialTargetActorId ||
        actor.kind === 'CUSTOM'
      ) {
        return []
      }
      const armorClass =
        actor.kind === 'CHARACTER' && actor.sourceId
          ? (input.lockedCharacterFacts.get(actor.sourceId)?.effectiveRulePolicyOutput?.derivedStats
              .armorClass?.effective ?? null)
          : actor.kind === 'CREATURE'
            ? (snapshotStatBlock(actor)?.armorClass ?? null)
            : null
      if (armorClass === null) return []
      const withinAttackerReach =
        measureSceneTokenFootprintDistance(input.sceneContext.grid, sourceToken, token) <= reach
      const originalAttackCanHit =
        input.d20.selectedNatural === 1
          ? false
          : input.d20.selectedNatural === 20
            ? true
            : input.d20.total >= armorClass
      return [
        {
          actorId: actor.id,
          armorClass,
          footprintChecksum: checksumRuleDocument({
            height: token.height,
            position: token.position,
            rotationDegrees: token.rotationDegrees,
            tokenId: token.id,
            width: token.width
          }),
          originalAttackCanHit,
          targetActorVersion:
            actor.kind === 'CHARACTER' && actor.sourceId
              ? (input.lockedCharacterFacts.get(actor.sourceId)?.streamVersion ?? -1)
              : (actor.sourceRevision ?? -1),
          targetStateChecksum: checksumRuleDocument(actor),
          targetTokenId: token.id,
          withinAttackerReach
        }
      ]
    })
    .filter((candidate) => candidate.targetActorVersion >= 0)
    .sort(
      (left, right) =>
        left.actorId.localeCompare(right.actorId) ||
        left.targetTokenId.localeCompare(right.targetTokenId)
    )
}

export interface EncounterCleavingSettlementFacts {
  action: CleavingContext['action']
  actionMechanic: Readonly<Record<string, unknown>>
  activeEffectTransitions: readonly unknown[]
  application: CleavingApplicationFacts | ServerRuleExecutionApplicationOutputsDto
  candidates: readonly EncounterCleavingCandidateFact[]
  chainStep: number
  encounter: EncounterRecord
  initialTargetActorId: string
  parentOccurrenceId: string
  parentResultChecksum: string
  sourceActorId: string
  sourceControllerCharacterId: string | null
  sourceCurrentness: CleavingContext['sourceCurrentness']
  scene: {
    effectiveGridChecksum: string
    sceneId: string
    sceneVersion: number
    sourceTokenId: string
  }
  stateEffectTransitions: readonly unknown[]
  visitedTargetActorIds: readonly string[]
}

export function cleavingChildOccurrenceIdentity(input: {
  parentOccurrenceId: string
  chainStep: number
}): string {
  return uuidv5(
    `${input.parentOccurrenceId}:${input.chainStep}:optional-combat-cleaving`,
    DND5E_CLEAVING_OCCURRENCE_NAMESPACE
  )
}

export function cleavingChildCommandIdentity(input: { occurrenceId: string }): string {
  return uuidv5(`${input.occurrenceId}:command`, DND5E_CLEAVING_OCCURRENCE_NAMESPACE)
}

function hasMeleeAttackKind(actionMechanic: Readonly<Record<string, unknown>>): boolean {
  return actionMechanic.attackKind === 'MELEE'
}

function exactTransferableDamage(input: {
  application: CleavingApplicationFacts
  activeEffectTransitions: readonly unknown[]
  stateEffectTransitions: readonly unknown[]
}): CleavingDamageApplication | null {
  if (input.activeEffectTransitions.length !== 0 || input.stateEffectTransitions.length !== 0)
    return null
  if (input.application.nestedD20 !== null || input.application.applications.length !== 1)
    return null
  const [candidate] = input.application.applications
  if (!candidate || candidate.kind !== 'DAMAGE') return null
  return candidate
}

function initialTargetQualifies(application: CleavingApplicationFacts): boolean {
  const { before, after } = application.targetTransition
  return (
    before.currentHitPoints === before.maximumHitPoints &&
    before.temporaryHitPoints === 0 &&
    after.currentHitPoints === 0
  )
}

function optionFromCandidate(input: {
  candidate: EncounterCleavingCandidateFact & { armorClass: number }
  pin: Dnd5eOptionalResolutionPin
}): CleavingContext['options'][number] {
  const option = {
    targetActorId: input.candidate.actorId,
    targetTokenId: input.candidate.targetTokenId,
    targetActorVersion: input.candidate.targetActorVersion,
    targetStateChecksum: input.candidate.targetStateChecksum,
    armorClass: input.candidate.armorClass,
    footprintChecksum: input.candidate.footprintChecksum
  }
  return { ...option, optionId: checksumRuleDocument({ ...option, pin: input.pin }) }
}

/**
 * Builds only a sealed post-action Cleaving choice. It never selects a target,
 * recalculates damage, or mutates Encounter state.
 */
export function createEncounterCleavingChoicePendingSnapshot(
  input: EncounterCleavingSettlementFacts
): ServerAggregateChoicePendingSnapshotDto | null {
  const application = normalizeCleavingApplication(input.application, input.initialTargetActorId)
  if (!application) return null
  const damage = exactTransferableDamage({
    application,
    activeEffectTransitions: input.activeEffectTransitions,
    stateEffectTransitions: input.stateEffectTransitions
  })
  const d20 = application.d20
  if (
    !damage ||
    !d20 ||
    !hasMeleeAttackKind(input.actionMechanic) ||
    !initialTargetQualifies(application) ||
    damage.resolvedAmount - damage.appliedAmount <= 0
  ) {
    return null
  }
  const eligibleCandidates = input.candidates.filter(
    (candidate) =>
      candidate.actorId !== input.sourceActorId &&
      candidate.actorId !== input.initialTargetActorId &&
      !input.visitedTargetActorIds.includes(candidate.actorId)
  )
  const eligibleTargetActorIds = eligibleCandidates.map((candidate) => candidate.actorId)
  const proposals = eligibleCandidates.flatMap((candidate) => {
    if (candidate.armorClass === null) return []
    const normalizedCandidate = { ...candidate, armorClass: candidate.armorClass }
    const resolution = resolveDnd5eCleaving({
      automationMode: input.encounter.automationMode,
      gameSystemId: input.encounter.gameSystemId,
      optionalCombatSnapshot: input.encounter.optionalCombatSnapshot,
      optionalCombatSnapshotChecksum: input.encounter.optionalCombatSnapshotChecksum,
      attackKind: 'MELEE',
      attackTotal: d20.total,
      attackerActorId: input.sourceActorId,
      chainStep: input.chainStep,
      eligibleTargetActorIds,
      initialTargetActorId: input.initialTargetActorId,
      initialTargetReducedToZero: true,
      initialTargetWasUndamaged: true,
      mixedDamageOrRiderAmbiguity: false,
      nextTarget: {
        actorId: normalizedCandidate.actorId,
        armorClass: normalizedCandidate.armorClass,
        withinAttackerReach: normalizedCandidate.withinAttackerReach,
        originalAttackResolution: {
          naturalRoll: d20.selectedNatural,
          originalAttackCanHitNextTarget: normalizedCandidate.originalAttackCanHit
        }
      },
      remainingFinalDamage: damage.resolvedAmount - damage.appliedAmount,
      visitedTargetActorIds: input.visitedTargetActorIds
    })
    return resolution.kind === 'PROPOSED'
      ? [{ candidate: normalizedCandidate, proposal: resolution.proposal }]
      : []
  })
  if (proposals.length === 0) return null
  const pin = proposals[0]!.proposal.pin
  if (
    proposals.some(
      ({ proposal }) => checksumRuleDocument(proposal.pin) !== checksumRuleDocument(pin)
    )
  )
    return null
  const options = proposals
    .map(({ candidate }) => optionFromCandidate({ candidate, pin }))
    .sort((left, right) => left.optionId.localeCompare(right.optionId))
  const occurrenceId = cleavingChildOccurrenceIdentity({
    parentOccurrenceId: input.parentOccurrenceId,
    chainStep: input.chainStep + 1
  })
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    snapshotKind: 'AGGREGATE_CHOICE',
    schemaVersion: 1,
    occurrenceId,
    optionalCombatSnapshotChecksum: input.encounter.optionalCombatSnapshotChecksum,
    applicationContext: {
      kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING',
      schemaVersion: 1,
      parentOccurrenceId: input.parentOccurrenceId,
      parentResultChecksum: input.parentResultChecksum,
      sourceActorId: input.sourceActorId,
      sourceControllerCharacterId: input.sourceControllerCharacterId,
      action: input.action,
      sourceCurrentness: input.sourceCurrentness,
      initialTargetActorId: input.initialTargetActorId,
      chainStep: input.chainStep + 1,
      optionalCombat: {
        definitionId: pin.definitionId,
        definitionVersion: pin.definitionVersion,
        definitionChecksum: pin.definitionChecksum
      },
      scene: {
        sceneId: input.scene.sceneId,
        sceneVersion: input.scene.sceneVersion,
        effectiveGridChecksum: input.scene.effectiveGridChecksum,
        sourceTokenId: input.scene.sourceTokenId
      },
      originalAttack: { total: d20.total, naturalRoll: d20.selectedNatural },
      damage: {
        sourceNodeId: damage.sourceNodeId,
        sourceOperationKey: damage.sourceOperationKey,
        damageTypeId: damage.damageTypeId,
        resolvedAmount: damage.resolvedAmount,
        appliedAmount: damage.appliedAmount,
        remainingAmount: damage.resolvedAmount - damage.appliedAmount,
        envelopeChecksum: checksumRuleDocument({
          schemaVersion: 1,
          sourceNodeId: damage.sourceNodeId,
          sourceOperationKey: damage.sourceOperationKey,
          damageTypeId: damage.damageTypeId,
          requestedAmount: damage.requestedAmount,
          resolvedAmount: damage.resolvedAmount,
          appliedAmount: damage.appliedAmount,
          beforeCurrentHitPoints: damage.beforeCurrentHitPoints,
          afterCurrentHitPoints: damage.afterCurrentHitPoints,
          beforeTemporaryHitPoints: damage.beforeTemporaryHitPoints,
          afterTemporaryHitPoints: damage.afterTemporaryHitPoints,
          maximumHitPoints: damage.maximumHitPoints,
          targetActorId: damage.targetActorId,
          damageDisposition: damage.damageDisposition
        })
      },
      visitedTargetActorIds: input.visitedTargetActorIds,
      options
    }
  })
}

/** Persists one replay-safe child immediately after its base action has settled. */
export async function persistEncounterCleavingChoice(input: {
  db: DBLike
  encounter: EncounterRecord
  expectedEncounterVersion: number
  parentOccurrenceId: string
  sourceActor: EncounterActorRecord
  action: CleavingContext['action']
  sourceCurrentness: CleavingContext['sourceCurrentness']
  targetActor: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
  actionMechanic: Readonly<Record<string, unknown>>
  result: StoredRuleExecutionResultDto
  sceneContext: LockedEncounterActionSceneContext | null
}): Promise<ServerAggregateChoicePendingSnapshotDto | null> {
  if (
    !input.sceneContext ||
    input.result.status !== 'COMPLETE' ||
    !isMechanicsBatch(input.result.applicationOutputs)
  ) {
    return null
  }
  const scene = input.sceneContext.scene
  if (!scene) return null
  const actorIdByTokenId = new Map<string, string>()
  for (const binding of await createVttSceneRepository(input.db).listActorTokenBindings(
    input.encounter.id
  )) {
    if (actorIdByTokenId.has(binding.tokenId)) return null
    actorIdByTokenId.set(binding.tokenId, binding.actorId)
  }
  const application = normalizeCleavingApplication(
    input.result.applicationOutputs,
    input.targetActor.id
  )
  if (!application) return null
  const d20 = application.d20
  if (!d20) return null
  const pendingSnapshot = createEncounterCleavingChoicePendingSnapshot({
    encounter: input.encounter,
    application,
    action: input.action,
    actionMechanic: input.actionMechanic,
    activeEffectTransitions: input.result.applicationOutputs.activeEffectTransitions,
    stateEffectTransitions: input.result.applicationOutputs.stateEffectTransitions,
    candidates: discoverEncounterCleavingCandidates({
      actorIdByTokenId,
      d20,
      encounter: input.encounter,
      initialTargetActorId: input.targetActor.id,
      sourceActorId: input.sourceActor.id,
      actionRange: input.action.range,
      lockedCharacterFacts: input.targets.lockedCharacters,
      sceneContext: input.sceneContext
    }),
    chainStep: 0,
    initialTargetActorId: input.targetActor.id,
    parentOccurrenceId: input.parentOccurrenceId,
    parentResultChecksum: checksumRuleDocument(input.result),
    sourceActorId: input.sourceActor.id,
    sourceControllerCharacterId:
      input.sourceActor.kind === 'CHARACTER' ? input.sourceActor.sourceId : null,
    sourceCurrentness: input.sourceCurrentness,
    scene: {
      sceneId: scene.state.id,
      sceneVersion: scene.state.version,
      effectiveGridChecksum: checksumRuleDocument(input.sceneContext.grid),
      sourceTokenId: input.sceneContext.sourceToken.tokenId
    },
    visitedTargetActorIds: [input.targetActor.id]
  })
  if (!pendingSnapshot) return null
  await createRuleOccurrenceRepository(input.db).createPending({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.encounter.id,
    campaignId: input.encounter.campaignId,
    expectedAggregateVersion: input.expectedEncounterVersion,
    occurrenceId: pendingSnapshot.occurrenceId,
    pendingSnapshot,
    rootCommandId: cleavingChildCommandIdentity({ occurrenceId: pendingSnapshot.occurrenceId })
  })
  return pendingSnapshot
}

type CleavingResolution = { kind: 'DECLINE' } | { kind: 'OPTION'; optionId: string }

type CleavingLockedContext = {
  encounter: EncounterRecord
  context: {
    actorUserId: string
    assignedCharacterId: string | null
    currentVersion: number
    role: 'OWNER' | 'PLAYER'
    advanceVersion: (expectedVersion: number) => Promise<number>
  }
}

function requireCleavingPending(occurrence: RuleOccurrenceRecord): CleavingContext {
  const snapshot = occurrence.pendingSnapshot
  if (
    occurrence.state !== 'PENDING' ||
    !snapshot ||
    snapshot.snapshotKind !== 'AGGREGATE_CHOICE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING'
  ) {
    throw new EncounterConflictError('Cleaving choice is unavailable.')
  }
  return snapshot.applicationContext
}

function requireCleavingAuthority(input: {
  context: CleavingContext
  locked: CleavingLockedContext
}) {
  if (input.locked.context.role === 'OWNER') return
  if (
    input.context.sourceControllerCharacterId === null ||
    input.locked.context.assignedCharacterId !== input.context.sourceControllerCharacterId
  ) {
    throw new EncounterConflictError('Cleaving choice is unavailable.')
  }
}

function currentNonCharacterSourceChecksum(actor: EncounterActorRecord): string {
  return checksumRuleDocument(actor)
}

function requireCleavingDefinition(input: {
  context: CleavingContext
  encounter: EncounterRecord
}) {
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.safeParse(
    input.encounter.optionalCombatSnapshot
  )
  if (
    !snapshot.success ||
    input.encounter.optionalCombatSnapshotChecksum === null ||
    checksumCanonicalJson(snapshot.data) !== input.encounter.optionalCombatSnapshotChecksum
  ) {
    throw new EncounterConflictError('Cleaving rule definition is stale.')
  }
  const definition = activeOptionalCombatDefinitions({
    automationMode: input.encounter.automationMode,
    snapshot: snapshot.data
  }).find(
    (candidate) =>
      candidate.document.kind === 'CLEAVING' &&
      candidate.definitionId === input.context.optionalCombat.definitionId
  )
  if (
    !definition ||
    definition.definitionVersion !== input.context.optionalCombat.definitionVersion ||
    definition.definitionChecksum !== input.context.optionalCombat.definitionChecksum
  ) {
    throw new EncounterConflictError('Cleaving rule definition is stale.')
  }
}

function damageApplication(input: {
  context: CleavingContext
  targetActor: EncounterActorRecord
}): CleavingDamageApplication {
  const resolvedAmount = input.context.damage.remainingAmount
  const temporaryLost = Math.min(input.targetActor.tempHitPoints, resolvedAmount)
  const currentLost = Math.min(input.targetActor.currentHitPoints, resolvedAmount - temporaryLost)
  return {
    ordinal: 0,
    kind: 'DAMAGE',
    sourceNodeId: input.context.damage.sourceNodeId,
    sourceOperationKey: input.context.damage.sourceOperationKey,
    damageTypeId: input.context.damage.damageTypeId,
    requestedAmount: resolvedAmount,
    resolvedAmount,
    appliedAmount: temporaryLost + currentLost,
    beforeCurrentHitPoints: input.targetActor.currentHitPoints,
    afterCurrentHitPoints: input.targetActor.currentHitPoints - currentLost,
    beforeTemporaryHitPoints: input.targetActor.tempHitPoints,
    afterTemporaryHitPoints: input.targetActor.tempHitPoints - temporaryLost,
    maximumHitPoints: input.targetActor.maxHitPoints,
    targetActorId: input.targetActor.id,
    damageDisposition: 'NORMAL'
  }
}

function requireSelectedOption(input: {
  context: CleavingContext
  resolution: CleavingResolution
}): CleavingContext['options'][number] | null {
  const { resolution } = input
  if (resolution.kind !== 'OPTION') return null
  const option = input.context.options.find(
    (candidate) => candidate.optionId === resolution.optionId
  )
  if (!option) throw new EncounterConflictError('Cleaving target is unavailable.')
  return option
}

/**
 * Settles a sealed Cleaving choice under the caller's already-held Encounter
 * command locks. It uses only the already-finalized damage component; this
 * function never evaluates an attack, rider, critical, or resistance again.
 */
export async function settleEncounterCleavingChoice(input: {
  db: DBLike
  command: {
    commandId: string
    commandFingerprint: string
    correlationId: string | null
    expectedEncounterVersion: number
    expectedOccurrenceVersion: number
    occurrenceId: string
    resolution: CleavingResolution
  }
  locked: CleavingLockedContext
  occurrence: RuleOccurrenceRecord
}): Promise<{
  occurrence: RuleOccurrenceRecord
  result: Extract<StoredRuleExecutionResultDto, { status: 'AGGREGATE_CHOICE_COMPLETE' }>
}> {
  if (
    input.command.expectedEncounterVersion !== input.locked.context.currentVersion ||
    input.command.expectedOccurrenceVersion !== input.occurrence.version ||
    input.command.occurrenceId !== input.occurrence.id
  ) {
    throw new EncounterConflictError('Cleaving choice is stale.')
  }
  const context = requireCleavingPending(input.occurrence)
  requireCleavingAuthority({ context, locked: input.locked })
  requireCleavingDefinition({ context, encounter: input.locked.encounter })
  const occurrences = createRuleOccurrenceRepository(input.db)
  const parentReceipt = await occurrences.findTerminalReceiptByOccurrence(
    'ENCOUNTER',
    input.locked.encounter.id,
    context.parentOccurrenceId
  )
  if (
    !parentReceipt ||
    checksumRuleDocument(parentReceipt.resultPayload) !== context.parentResultChecksum
  ) {
    throw new EncounterConflictError('Cleaving parent action is stale.')
  }
  const sourceActor = input.locked.encounter.actors.find(
    (actor) => actor.id === context.sourceActorId
  )
  if (!sourceActor) throw new EncounterConflictError('Cleaving source is unavailable.')
  const selected = requireSelectedOption({ context, resolution: input.command.resolution })
  if (
    selected &&
    input.locked.context.role !== 'OWNER' &&
    !input.locked.encounter.actors.some(
      (actor) => actor.id === selected.targetActorId && actor.public
    )
  ) {
    throw new EncounterConflictError('Cleaving target is unavailable.')
  }
  let updatedActor: EncounterActorRecord | null = null
  let targetTransition: EvaluatedEncounterMechanicsBatch['targetTransition'] | null = null
  let settledApplication: CleavingDamageApplication | null = null
  let settledTarget: EncounterActorRecord | null = null
  let settledSceneContext: Awaited<ReturnType<typeof revalidateEncounterActionSceneDependency>> =
    null
  let settledTargets: LockedEncounterActiveEffectTargets | null = null
  let appliedAmount = 0
  if (selected) {
    const targetActor = input.locked.encounter.actors.find(
      (actor) => actor.id === selected.targetActorId
    )
    if (!targetActor || context.visitedTargetActorIds.includes(targetActor.id))
      throw new EncounterConflictError('Cleaving target is unavailable.')
    const sceneContext = await revalidateEncounterActionSceneDependency({
      db: input.db,
      encounterId: input.locked.encounter.id,
      actorId: sourceActor.id,
      targetActorId: targetActor.id,
      dependency: {
        sceneId: context.scene.sceneId,
        sceneVersion: context.scene.sceneVersion,
        sourceTokenId: context.scene.sourceTokenId,
        targetTokenId: selected.targetTokenId
      }
    })
    if (
      !sceneContext ||
      checksumRuleDocument(sceneContext.grid) !== context.scene.effectiveGridChecksum
    )
      throw new EncounterConflictError('Cleaving Scene is stale.')
    settledSceneContext = sceneContext
    const targetFootprintChecksum = checksumRuleDocument({
      height: sceneContext.targetToken.height,
      position: sceneContext.targetToken.position,
      rotationDegrees: sceneContext.targetToken.rotationDegrees,
      tokenId: sceneContext.targetToken.tokenId,
      width: sceneContext.targetToken.width
    })
    if (targetFootprintChecksum !== selected.footprintChecksum) {
      throw new EncounterConflictError('Cleaving target geometry is stale.')
    }
    const reach = rangeDtoSchema.safeParse(context.action.range)
    const range =
      reach.success && reach.data.rangeKind === 'DISTANCE'
        ? lengthMeasurementInSceneUnits(
            { amount: reach.data.amount, unit: reach.data.unit },
            sceneContext.grid
          )
        : null
    if (
      range === null ||
      measureSceneTokenFootprintDistance(
        sceneContext.grid,
        sceneContext.sourceToken,
        sceneContext.targetToken
      ) > range
    ) {
      throw new EncounterConflictError('Cleaving target is outside the sealed reach.')
    }
    const evaluated = await evaluateEncounterActorRuleSnapshot({
      db: input.db,
      encounter: input.locked.encounter
    })
    const targets = await lockEncounterActiveEffectTargets({
      trx: input.db,
      encounter: evaluated.reconciledEncounter,
      actors: evaluated.reconciledEncounter.actors,
      attunementSlotOverride: null,
      getEncounterActorSnapshot: async () => ({
        rules: evaluated.snapshot.output,
        encounter: evaluated.reconciledEncounter
      })
    })
    settledTargets = targets
    const currentTarget = evaluated.reconciledEncounter.actors.find(
      (actor) => actor.id === targetActor.id
    )
    if (!currentTarget) throw new EncounterConflictError('Cleaving target is unavailable.')
    const sourceCharacter =
      context.sourceCurrentness.kind === 'CHARACTER'
        ? targets.lockedCharacters.get(context.sourceCurrentness.characterId)
        : null
    if (
      (context.sourceCurrentness.kind === 'CHARACTER' &&
        (!sourceCharacter ||
          sourceCharacter.actor.id !== sourceActor.id ||
          sourceCharacter.streamVersion !== context.sourceCurrentness.streamVersion ||
          sourceCharacter.mechanics.projectionChecksum !==
            context.sourceCurrentness.projectionChecksum ||
          sourceCharacter.overlay.mechanicalContextChecksum !==
            context.sourceCurrentness.mechanicalContextChecksum)) ||
      (context.sourceCurrentness.kind === 'ENCOUNTER_ACTOR' &&
        (sourceActor.kind === 'CHARACTER' ||
          sourceActor.sourceRevision !== context.sourceCurrentness.sourceRevision ||
          currentNonCharacterSourceChecksum(sourceActor) !==
            context.sourceCurrentness.stateChecksum))
    ) {
      throw new EncounterConflictError('Cleaving source is stale.')
    }
    const currentArmorClass =
      currentTarget.kind === 'CHARACTER' && currentTarget.sourceId
        ? (targets.lockedCharacters.get(currentTarget.sourceId)?.effectiveRulePolicyOutput
            ?.derivedStats.armorClass?.effective ?? null)
        : currentTarget.kind === 'CREATURE'
          ? (snapshotStatBlock(currentTarget)?.armorClass ?? null)
          : null
    const currentTargetVersion =
      currentTarget.kind === 'CHARACTER' && currentTarget.sourceId
        ? (targets.lockedCharacters.get(currentTarget.sourceId)?.streamVersion ?? null)
        : currentTarget.kind === 'CREATURE'
          ? currentTarget.sourceRevision
          : null
    if (
      currentArmorClass === null ||
      currentTargetVersion === null ||
      currentTargetVersion !== selected.targetActorVersion ||
      checksumRuleDocument(currentTarget) !== selected.targetStateChecksum ||
      currentArmorClass !== selected.armorClass ||
      (context.originalAttack.naturalRoll !== 20 &&
        (context.originalAttack.naturalRoll === 1 ||
          context.originalAttack.total < currentArmorClass))
    ) {
      throw new EncounterConflictError('Cleaving target is no longer hit by the original attack.')
    }
    const application = damageApplication({ context, targetActor: currentTarget })
    settledApplication = application
    settledTarget = currentTarget
    if (currentTarget.kind === 'CHARACTER') {
      const character = currentTarget.sourceId
        ? targets.lockedCharacters.get(currentTarget.sourceId)
        : null
      if (!character) throw new EncounterConflictError('Cleaving Character target is unavailable.')
      const applied = await applyLockedEncounterCharacterMechanicsBatch({
        trx: input.db,
        actorUserId: input.locked.context.actorUserId,
        encounterId: input.locked.encounter.id,
        occurrenceId: input.occurrence.id,
        commandId: input.command.commandId,
        sourceCommandId: input.command.commandId,
        targetActor: currentTarget,
        targetCharacterId: character.id,
        mechanics: character.mechanics,
        overlay: character.overlay,
        effectiveMaximumHitPoints: character.maximumHitPoints,
        conditionDefinitions: character.conditionDefinitions,
        effectiveScalarValues: character.effectiveScalarValues,
        applications: [toMechanicsDamageApplication(application)],
        forceVersionAdvance: false
      })
      updatedActor = applied.updatedActor
      targetTransition = applied.targetTransition
      appliedAmount = application.appliedAmount
      await createEncounterRepository(input.db).updateActor(updatedActor)
    } else {
      const applied = await applyLockedEncounterActorMechanicsBatch({
        trx: input.db,
        targetActor: currentTarget,
        initialConditionRows: currentTarget.conditions,
        effectiveScalarValues: targets.effectiveScalarValuesByActorId?.get(currentTarget.id),
        applications: [toMechanicsDamageApplication(application)]
      })
      updatedActor = applied.updatedActor
      targetTransition = applied.targetTransition
      appliedAmount = application.appliedAmount
    }
  }
  const nextEncounterVersion = await input.locked.context.advanceVersion(
    input.command.expectedEncounterVersion
  )
  const nextEncounter: EncounterRecord = {
    ...input.locked.encounter,
    version: nextEncounterVersion,
    actors: updatedActor
      ? input.locked.encounter.actors.map((actor) =>
          actor.id === updatedActor!.id ? updatedActor! : actor
        )
      : input.locked.encounter.actors
  }
  const applicationOutputs = {
    kind: 'CLEAVING_DAMAGE' as const,
    schemaVersion: 1 as const,
    occurrenceId: input.occurrence.id,
    parentOccurrenceId: context.parentOccurrenceId,
    sourceActorId: context.sourceActorId,
    targetActorId: selected?.targetActorId ?? null,
    selectedOptionId: selected?.optionId ?? null,
    sealedContextChecksum: checksumRuleDocument(context),
    outcome: selected ? ('APPLIED' as const) : ('DECLINED' as const),
    damage: {
      sourceNodeId: context.damage.sourceNodeId,
      sourceOperationKey: context.damage.sourceOperationKey,
      damageTypeId: context.damage.damageTypeId,
      requestedAmount: context.damage.remainingAmount,
      resolvedAmount: context.damage.remainingAmount,
      appliedAmount
    },
    targetTransition: targetTransition
      ? {
          checksum: targetTransition.checksum,
          before: targetTransition.before,
          after: targetTransition.after
        }
      : null
  }
  const completedOccurrence = await occurrences.complete({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.locked.encounter.id,
    occurrenceId: input.occurrence.id,
    expectedOccurrenceVersion: input.command.expectedOccurrenceVersion,
    expectedAggregateVersion: input.command.expectedEncounterVersion,
    nextAggregateVersion: nextEncounterVersion
  })
  const result = storedRuleExecutionResultDtoSchema.parse({
    status: 'AGGREGATE_CHOICE_COMPLETE',
    schemaVersion: 1,
    occurrenceId: completedOccurrence.id,
    occurrenceVersion: completedOccurrence.version,
    applicationOutputs
  }) as Extract<StoredRuleExecutionResultDto, { status: 'AGGREGATE_CHOICE_COMPLETE' }>
  if (
    selected &&
    updatedActor &&
    settledApplication &&
    settledTarget &&
    settledSceneContext &&
    settledTargets &&
    targetTransition &&
    updatedActor.currentHitPoints === 0 &&
    settledApplication.beforeCurrentHitPoints === settledApplication.maximumHitPoints &&
    settledApplication.beforeTemporaryHitPoints === 0 &&
    settledApplication.requestedAmount > settledApplication.appliedAmount
  ) {
    const actorIdByTokenId = new Map<string, string>()
    for (const binding of await createVttSceneRepository(input.db).listActorTokenBindings(
      input.locked.encounter.id
    )) {
      if (actorIdByTokenId.has(binding.tokenId)) {
        throw new EncounterConflictError('Cleaving Scene token binding is unavailable.')
      }
      actorIdByTokenId.set(binding.tokenId, binding.actorId)
    }
    const chained = createEncounterCleavingChoicePendingSnapshot({
      encounter: nextEncounter,
      application: {
        nestedD20: null,
        d20: {
          total: context.originalAttack.total,
          selectedNatural: context.originalAttack.naturalRoll
        },
        targetTransition,
        applications: [settledApplication]
      },
      action: context.action,
      actionMechanic: { attackKind: context.action.attackKind },
      activeEffectTransitions: [],
      stateEffectTransitions: [],
      candidates: discoverEncounterCleavingCandidates({
        actorIdByTokenId,
        d20: {
          total: context.originalAttack.total,
          selectedNatural: context.originalAttack.naturalRoll
        },
        encounter: nextEncounter,
        initialTargetActorId: context.initialTargetActorId,
        sourceActorId: context.sourceActorId,
        actionRange: context.action.range,
        lockedCharacterFacts: settledTargets.lockedCharacters,
        sceneContext: settledSceneContext
      }),
      chainStep: context.chainStep,
      initialTargetActorId: context.initialTargetActorId,
      parentOccurrenceId: completedOccurrence.id,
      parentResultChecksum: checksumRuleDocument(result),
      sourceActorId: context.sourceActorId,
      sourceControllerCharacterId: context.sourceControllerCharacterId,
      sourceCurrentness: context.sourceCurrentness,
      scene: context.scene,
      visitedTargetActorIds: [...context.visitedTargetActorIds, updatedActor.id]
    })
    if (chained) {
      await occurrences.createPending({
        aggregateKind: 'ENCOUNTER',
        aggregateId: input.locked.encounter.id,
        campaignId: input.locked.encounter.campaignId,
        expectedAggregateVersion: nextEncounterVersion,
        occurrenceId: chained.occurrenceId,
        pendingSnapshot: chained,
        rootCommandId: cleavingChildCommandIdentity({ occurrenceId: chained.occurrenceId })
      })
    }
  }
  await occurrences.appendReceipt({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.locked.encounter.id,
    commandId: input.command.commandId,
    commandFingerprint: input.command.commandFingerprint,
    occurrenceId: completedOccurrence.id,
    aggregateVersion: nextEncounterVersion,
    commandType: 'RESOLVE_RULE_OCCURRENCE',
    actorUserId: input.locked.context.actorUserId,
    correlationId: input.command.correlationId,
    commandMetadata: {
      schemaVersion: 1,
      transition: 'OPTIONAL_COMBAT_CLEAVING',
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      expectedAggregateVersion: input.command.expectedEncounterVersion,
      expectedOccurrenceVersion: input.command.expectedOccurrenceVersion,
      response: input.command.resolution,
      optionalCombatSnapshotChecksum: input.locked.encounter.optionalCombatSnapshotChecksum
    },
    resultPayload: result
  })
  const snapshot = await evaluateEncounterActorRuleSnapshot({
    db: input.db,
    encounter: nextEncounter
  })
  await createEncounterRepository(input.db).publishCurrentProjection(
    compileEncounterCurrentProjection(
      projectGm(nextEncounter, snapshot.snapshot.output),
      snapshot.snapshot
    )
  )
  return { occurrence: completedOccurrence, result }
}
