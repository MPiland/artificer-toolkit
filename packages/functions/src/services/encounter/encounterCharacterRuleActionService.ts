import { randomInt, randomUUID } from 'node:crypto'
import { v5 as uuidv5 } from 'uuid'

import {
  createCampaignCharacterMechanicsProjectionRepository,
  createActiveRuleEffectRepository,
  createReusableDefinitionRepository,
  createCharacterEventRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  createEncounterRepository,
  createRuleOccurrenceRepository,
  createSystemVocabularySnapshotRepository,
  withTransaction,
  type DBLike,
  type EncounterRecord,
  type Json,
  type RuleOccurrenceRecord
} from '@artificer-toolkit/db'
import {
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  CharacterMechanicsProjection,
  CompiledActionEntryPoint
} from '@artificer-toolkit/schema/projections/characterMechanics'
import { characterSheetConditionDtoSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import type { EncounterCurrentProjection } from '@artificer-toolkit/schema/projections/encounter'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { encounterProjectionEventSchema } from '@artificer-toolkit/schema/projections/encounter'
import {
  serverRuleExecutionCorrelationIdDtoSchema,
  isServerKernelRuleExecutionPendingSnapshot,
  serverRuleExecutionApplicationOutputsDtoSchema,
  serverUuidIdentityDtoSchema,
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema,
  type ServerRuleExecutionApplicationOutputsDto,
  type ServerCompletedRuleExecutionDto,
  type ServerRuleExecutionPendingApplicationContextDto,
  type RuleExecutionPhaseReceiptsDto,
  type StoredRuleExecutionResultDto,
  type ServerPublishedRuleDefinitionDto,
  serverPublishedRuleDefinitionDtoSchema
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { CharacterEvent } from '@artificer-toolkit/shared'
import { resolveCharacterEffectiveMaximumHitPoints } from '@artificer-toolkit/shared/character'
import { sql } from 'kysely'
import { z } from 'zod'

import {
  advanceCharacterMechanicsProjectionActionState,
  advanceCharacterMechanicsProjectionCommandState
} from '../character/characterMechanicsCompiler.js'
import {
  checksumCampaignCharacterMechanicalContext,
  resolveCharacterLiveSessionRuleContext
} from '../character/campaignCharacterSheet.js'
import {
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
  compileCampaignCharacterMechanicsProjection
} from '../campaign/campaignCharacterMechanicsProjection.js'
import type { CharacterRuleActionSystemAdapter } from '../rules/characterRuleActionSystemAdapter.js'
import { characterRuleActionSystemAdapterRegistry } from '../rules/characterRuleActionSystemAdapterRegistry.js'
import { resolveActionPhaseExecution } from '../rules/actionPhaseExecution.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  createRuleExecutionOccurrenceService,
  type RuleExecutionAggregatePort
} from '../rules/ruleExecutionOccurrenceService.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { refreshEncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'
import { evaluateEncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'
import { lockEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'
import { lockEncounterActionPositionalFacts } from './encounterActionPositionalFacts.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { compileEncounterCurrentProjection, projectGm } from './encounterProjection.js'
import { foldCharacterMechanicsApplications } from './encounterCharacterMechanicsBatch.js'
import {
  persistEncounterCharacterActionResourceConsumption,
  prepareEncounterCharacterActionState,
  type EncounterCharacterActionResourceConsumption
} from './encounterCharacterActionResource.js'
import { lockEncounterRuleExecutionCommandContext } from './encounterRuleExecutionCommandContext.js'
import {
  createEncounterActionStartIntent,
  revalidateEncounterActionSceneDependency,
  toEncounterActionSceneDependency,
  type LockedEncounterActionSceneContext
} from './encounterActionSceneContext.js'
import type { LiveSessionCommandAuthority } from '../campaign/liveSessionCommandAuthority.js'
import {
  DND5E_CONCENTRATION_CHECK_DEFINITION_ID,
  DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
  DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
  resolveDnd5eConcentrationSaveFacts,
  validateDnd5eConcentrationContributors
} from '../rules/systems/dnd5e/concentrationPolicy.js'

interface LockedCharacterRuleAction {
  /** The acting Character owns the selected action and any resource use. */
  characterId: string
  sourceActor: EncounterRecord['actors'][number]
  encounter: EncounterRecord
  currentProjection: EncounterCurrentProjection
  mechanics: CharacterMechanicsProjection
  maximumHitPoints: number
  overlay: Awaited<
    ReturnType<
      ReturnType<typeof createCampaignCharacterMechanicsProjectionRepository>['requireCurrent']
    >
  >
  priorProjectionChecksum: string
  adapter: CharacterRuleActionSystemAdapter
  published: ServerPublishedRuleDefinitionDto
  activeEffectPlan: Extract<
    CompiledActionEntryPoint,
    {
      schemaVersion: 2 | 3 | 4
      compilation: { kind: 'COMPILED' }
    }
  >['compilation']['activeEffectPlan']
  attunementSlotOverride: number | null
  conditionDefinitions: ReadonlyArray<{
    id: string
    label: string
    description?: string | null
  }> | null
  resourceConsumption: EncounterCharacterActionResourceConsumption | null
  /** The exact locked Character target owns all outcome state changes. */
  targetCharacterId: string
  targetConditionDefinitions: ReadonlyArray<{
    id: string
    label: string
    description?: string | null
  }> | null
  targetMaximumHitPoints: number
  targetMechanics: CharacterMechanicsProjection
  targetOverlay: Awaited<
    ReturnType<
      ReturnType<typeof createCampaignCharacterMechanicsProjectionRepository>['requireCurrent']
    >
  >
  targetPriorProjectionChecksum: string
  targetVocabularySnapshot: SystemVocabularySnapshot
  maintainedReplacement: MaintainedReplacementPreflight | null
  concentration: ConcentrationPreflight | null
}

interface MaintainedReplacementPreflight {
  definitionChecksum: string
  definitionId: string
  dependents: readonly {
    activeEffectId: string
    createdOrdinal: number
    definitionChecksum: string
    lifecycleChecksum: string
    owner: string
    version: number
  }[]
  prior: {
    descriptorChecksum: string
    id: string
    version: number
  } | null
}

interface ConcentrationPreflight {
  descriptorChecksum: string
  dependents: MaintainedReplacementPreflight['dependents']
  id: string
  maintenanceDefinitionId: string
  ownerActorId: string
  version: number
}

const DND5E_CONCENTRATION_OCCURRENCE_NAMESPACE = 'd4b06f4e-c014-49b6-8e39-3a2c790f8d57'

function maintainedDependentSnapshot(
  effect: Awaited<
    ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['listDependentEffects']>
  >[number]
): MaintainedReplacementPreflight['dependents'][number] {
  return {
    activeEffectId: effect.id,
    createdOrdinal: effect.createdOrdinal,
    definitionChecksum: effect.definitionChecksum,
    lifecycleChecksum: effect.lifecycleChecksum,
    owner:
      effect.owner.kind === 'CHARACTER'
        ? `CHARACTER:${effect.owner.characterId}`
        : `ENCOUNTER_ACTOR:${effect.owner.targetActorId}`,
    version: effect.version
  }
}

function sameMaintainedReplacementPreflight(
  left: MaintainedReplacementPreflight,
  right: MaintainedReplacementPreflight
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sameConcentrationPreflight(
  left: ConcentrationPreflight,
  right: ConcentrationPreflight
): boolean {
  return (
    left.id === right.id &&
    left.version === right.version &&
    left.ownerActorId === right.ownerActorId &&
    left.maintenanceDefinitionId === right.maintenanceDefinitionId &&
    left.descriptorChecksum === right.descriptorChecksum &&
    JSON.stringify(left.dependents) === JSON.stringify(right.dependents)
  )
}

function concentrationChildIdentity(input: {
  parentOccurrenceId: string
  ordinal: number
  sourceNodeId: string
  sourceOperationKey: string
  targetActorId: string
}): string {
  return uuidv5(
    `${input.parentOccurrenceId}:${input.ordinal}:${input.sourceNodeId}:${input.sourceOperationKey}:${input.targetActorId}:concentration-damage-check`,
    DND5E_CONCENTRATION_OCCURRENCE_NAMESPACE
  )
}

async function cleanupConcentrationMaintainedState(input: {
  db: DBLike
  encounter: EncounterRecord
  attunementSlotOverride: number | null
  concentration: ConcentrationPreflight
}) {
  const activeEffects = createActiveRuleEffectRepository(input.db)
  const state = await activeEffects.lockMaintainedStateById({
    encounterId: input.encounter.id,
    stateId: input.concentration.id
  })
  const dependents = state
    ? await activeEffects.lockDependentEffects({
        stateId: state.id,
        encounterId: input.encounter.id
      })
    : []
  const current = state
    ? {
        id: state.id,
        version: state.version,
        ownerActorId: state.ownerActorId,
        maintenanceDefinitionId: state.maintenanceDefinitionId,
        descriptorChecksum: state.descriptorChecksum,
        dependents: dependents.map(maintainedDependentSnapshot)
      }
    : null
  if (!state || !current || !sameConcentrationPreflight(input.concentration, current)) {
    throw new EncounterConflictError('Concentration state changed before cleanup.')
  }
  for (const dependent of dependents) {
    await activeEffects.deleteCas({
      id: dependent.id,
      owner: dependent.owner,
      expectedVersion: dependent.version
    })
  }
  if (
    state.descriptor.schemaVersion === 1 ||
    state.descriptor.emptyDependentPolicy === 'TERMINATE_WHEN_EMPTY'
  ) {
    await activeEffects.deleteMaintainedStateCas({
      id: state.id,
      encounterId: input.encounter.id,
      ownerActorId: state.ownerActorId,
      expectedVersion: state.version
    })
  }

  const transitions: {
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }[] = []
  const characterActorVersions = new Map<string, number>()
  const characterIds = [
    ...new Set(
      dependents.flatMap((dependent) =>
        dependent.owner.kind === 'CHARACTER' ? [dependent.owner.characterId] : []
      )
    )
  ].sort()
  for (const characterId of characterIds) {
    const owner = await input.db
      .selectFrom('characters')
      .select(['id', 'stream_version', 'status'])
      .where('id', '=', characterId)
      .forUpdate()
      .executeTakeFirst()
    if (!owner || owner.status !== 'ACTIVE') {
      throw new EncounterConflictError('A concentration dependent owner is stale.')
    }
    const mechanics = await createCharacterMechanicsProjectionRepository(input.db).requireCurrent({
      characterId,
      expectedStreamVersion: owner.stream_version
    })
    const context = await resolveCharacterLiveSessionRuleContext(input.db, characterId, {
      id: input.encounter.campaignId,
      attunementSlotOverride: input.attunementSlotOverride
    })
    if (!context) throw new EncounterConflictError('A concentration dependent context is stale.')
    const overlay = await createCampaignCharacterMechanicsProjectionRepository(
      input.db
    ).requireCurrent({
      campaignId: input.encounter.campaignId,
      characterId,
      expectedBaseMechanicsProjectionChecksum: mechanics.projectionChecksum,
      expectedCharacterStreamVersion: owner.stream_version,
      expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
        adjustments: context.adjustments,
        attunementSlotOverride: context.attunementSlotOverride
      }),
      expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
      baseMechanicsProjection: mechanics
    })
    const afterStreamVersion = await createCharacterRepository(input.db).patchSheetState(
      characterId,
      [],
      {
        expectedStreamVersion: owner.stream_version,
        afterPersist: async (trx, nextStreamVersion) => {
          const nextMechanics = advanceCharacterMechanicsProjectionCommandState({
            characterCommandState: mechanics.commandState,
            characterStreamVersion: nextStreamVersion,
            current: mechanics
          })
          await createCharacterMechanicsProjectionRepository(trx).advanceLiveCommandState({
            expectedPriorProjectionChecksum: mechanics.projectionChecksum,
            expectedPriorStreamVersion: mechanics.characterStreamVersion,
            projection: nextMechanics
          })
          await createCampaignCharacterMechanicsProjectionRepository(trx).publish({
            expectedPriorOverlayChecksum: overlay.projectionChecksum,
            projection: compileCampaignCharacterMechanicsProjection({
              campaignId: overlay.campaignId,
              characterId,
              characterStreamVersion: nextStreamVersion,
              baseMechanicsProjectionChecksum: nextMechanics.projectionChecksum,
              mechanicalContextChecksum: overlay.mechanicalContextChecksum,
              manualMaximumModifierOwner: overlay.manualMaximumModifierOwner,
              ...(overlay.kind === 'MATERIALIZED'
                ? {
                    rulePolicyInput: overlay.rulePolicyInput,
                    rulePolicyOutput: overlay.rulePolicyOutput
                  }
                : {})
            })
          })
        }
      }
    )
    transitions.push({
      characterId,
      beforeStreamVersion: owner.stream_version,
      afterStreamVersion
    })
    characterActorVersions.set(characterId, afterStreamVersion)
  }
  return {
    maintainedStateId: state.id,
    removedDependentEffectIds: dependents.map((dependent) => dependent.id),
    characterOwnerTransitions: transitions,
    characterActorVersions
  }
}

function checksumStoredRuleExecutionResult(result: StoredRuleExecutionResultDto): string {
  return checksumRuleDocument(JSON.parse(JSON.stringify(result)))
}

const actionIdSchema = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => value === value.trim(), 'Action identity must be trimmed.')

const encounterCharacterConditionsSchema = z.array(characterSheetConditionDtoSchema).max(200)

function requireValidCharacterRuleActionReceipt(
  value: unknown,
  occurrenceId: string,
  expectedTargetActorId: string | null,
  expectedSourceCharacterId: string,
  execution: Pick<ServerCompletedRuleExecutionDto, 'outputs' | 'evidence'>,
  phaseReceipts: RuleExecutionPhaseReceiptsDto | undefined,
  source: 'FRESH' | 'STORED'
): Extract<ServerRuleExecutionApplicationOutputsDto, { kind: 'CHARACTER_MECHANICS_BATCH' }> {
  const receipt = serverRuleExecutionApplicationOutputsDtoSchema.safeParse(value)
  const invalidReceipt = () =>
    new EncounterValidationError(
      source === 'STORED'
        ? 'Stored rule-execution receipt has an invalid result shape.'
        : 'The Character mechanics rule-action receipt is invalid.'
    )
  if (!receipt.success) throw invalidReceipt()
  if (
    receipt.data.kind !== 'CHARACTER_MECHANICS_BATCH' ||
    receipt.data.occurrenceId !== occurrenceId ||
    receipt.data.sourceCharacterId !== expectedSourceCharacterId ||
    (expectedTargetActorId !== null && receipt.data.targetActorId !== expectedTargetActorId)
  )
    throw invalidReceipt()
  if (
    receipt.data.targetTransition.checksum !==
    checksumRuleDocument({
      targetActorId: receipt.data.targetActorId,
      currentHitPoints: receipt.data.targetTransition.before.currentHitPoints,
      temporaryHitPoints: receipt.data.targetTransition.before.temporaryHitPoints,
      maximumHitPoints: receipt.data.targetTransition.before.maximumHitPoints,
      conditionIds: receipt.data.targetTransition.before.conditionIds
    })
  )
    throw invalidReceipt()
  const d20 = receipt.data.d20
  const sameTerminalExecution = (phaseExecution: ServerCompletedRuleExecutionDto) =>
    checksumRuleDocument({ outputs: phaseExecution.outputs, evidence: phaseExecution.evidence }) ===
    checksumRuleDocument({ outputs: execution.outputs, evidence: execution.evidence })
  const testExecution = (() => {
    if (!phaseReceipts) return execution
    if (phaseReceipts.length === 1 && phaseReceipts[0]?.phase === 'TEST') {
      if (!sameTerminalExecution(phaseReceipts[0].execution)) throw invalidReceipt()
      return phaseReceipts[0].execution
    }
    if (
      phaseReceipts.length !== 2 ||
      phaseReceipts[0]?.phase !== 'TEST' ||
      phaseReceipts[1]?.phase !== 'OUTCOME' ||
      !sameTerminalExecution(phaseReceipts[1].execution)
    )
      throw invalidReceipt()
    const test = phaseReceipts[0]
    if (!test) throw invalidReceipt()
    return test.execution
  })()
  const [activeEffectTransition] = receipt.data.activeEffectTransitions
  const maintenanceTransition = receipt.data.maintenanceTransition ?? null
  const sourceHasMaintainedRemoval =
    maintenanceTransition?.characterOwnerTransitions.some(
      (transition) => transition.characterId === expectedSourceCharacterId
    ) ?? false
  const sourceRequiresIndependentStreamVersion =
    receipt.data.sourceActorId !== receipt.data.targetActorId &&
    (receipt.data.resourceConsumption !== null || sourceHasMaintainedRemoval)
  if (
    (receipt.data.sourceCharacterStreamVersion === null) ===
    sourceRequiresIndependentStreamVersion
  )
    throw invalidReceipt()
  if (
    activeEffectTransition &&
    (activeEffectTransition.authoredEffectId !== execution.evidence.source.definitionId ||
      activeEffectTransition.frozenSourceChecksum !== execution.evidence.source.checksum ||
      activeEffectTransition.capabilityContractVersion !==
        execution.evidence.capabilityContractVersion ||
      execution.evidence.sourceEntryBindings?.filter(
        (binding) =>
          binding.sourceEntryId === activeEffectTransition.compiledEntryId &&
          binding.nodeId === activeEffectTransition.frozenGraphNodeId
      ).length !== 1 ||
      execution.evidence.trace.filter(
        (trace) => trace.nodeId === activeEffectTransition.frozenGraphNodeId
      ).length !== 1)
  )
    throw invalidReceipt()
  if (
    maintenanceTransition &&
    (!activeEffectTransition ||
      maintenanceTransition.createdDependentEffectIds.length !== 1 ||
      maintenanceTransition.createdDependentEffectIds[0] !== activeEffectTransition.activeEffectId)
  )
    throw invalidReceipt()
  if (d20 && d20.contributorChecksum !== checksumRuleDocument(d20.contributors))
    throw invalidReceipt()
  if (
    d20 &&
    !testExecution.evidence.trace.some(
      (trace) =>
        trace.inputs.contributorChecksum === d20.contributorChecksum &&
        trace.outputs.contributorChecksum === d20.contributorChecksum
    )
  )
    throw new EncounterValidationError('The Character mechanics rule-action receipt is invalid.')
  return receipt.data
}

export interface ExecuteEncounterCharacterRuleActionInput {
  actionId: string
  actorId: string
  actorUserId: string
  commandId: string
  correlationId: string | null
  encounterId: string
  expectedEncounterVersion: number
  sceneContext?: LockedEncounterActionSceneContext | null
  liveSessionAuthority?: LiveSessionCommandAuthority
  targetActorId: string
}

const assistedCharacterRuleActionResolutionDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('SYSTEM'), requestId: z.string().min(1) }),
  z.strictObject({
    kind: z.literal('PHYSICAL'),
    requestId: z.string().min(1),
    rawFaces: z.array(z.number().int().min(1).max(20)).min(1).max(2)
  }),
  z.strictObject({
    kind: z.literal('SYSTEM_OUTCOME'),
    requestIds: z.array(z.string().min(1).max(256)).min(1).max(31)
  }),
  z.strictObject({
    kind: z.literal('PHYSICAL_OUTCOME'),
    values: z
      .array(z.strictObject({ requestId: z.string().min(1).max(256), value: z.number().int() }))
      .min(1)
      .max(31)
  })
])

export interface ResumeEncounterCharacterRuleActionInput {
  actorUserId: string
  commandId: string
  correlationId: string | null
  encounterId: string
  expectedEncounterVersion: number
  expectedOccurrenceVersion: number
  liveSessionAuthority?: LiveSessionCommandAuthority
  occurrenceId: string
  resolution: unknown
}

export type EncounterCharacterRuleActionResult =
  | {
      status: 'PENDING'
      occurrenceId: string
      occurrenceVersion: number
      request: { requestId: string; min: number; max: number }
      rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
      controls: readonly ['SYSTEM', 'PHYSICAL']
    }
  | {
      status: 'PENDING'
      occurrenceId: string
      occurrenceVersion: number
      phase: 'OUTCOME'
      requests: readonly { requestId: string; min: number; max: number }[]
      controls: readonly ['SYSTEM_OUTCOME', 'PHYSICAL_OUTCOME']
    }
  | {
      status: 'COMPLETE'
      occurrenceId: string
      pending: PendingEncounterRuleOccurrenceSummaryDto | null
      applications: readonly (
        | {
            ordinal: number
            outcomeKind: 'HEAL' | 'TEMPORARY_HIT_POINTS' | 'DAMAGE'
            appliedAmount: number
          }
        | {
            ordinal: number
            outcomeKind: 'CONDITION_APPLY'
            conditionId: string
            applied: boolean
          }
      )[]
    }
  | {
      status: 'MANUAL'
      occurrenceId: string
      reminder: null | { kind: 'MANUAL_RULE_REVIEW' }
    }

function requireCommittedAction(
  mechanics: CharacterMechanicsProjection,
  actionId: string
): Extract<CompiledActionEntryPoint, { compilation: { kind: 'COMPILED' } }> {
  const entry = mechanics.compiledActionEntryPoints.find(
    (candidate) => candidate.actionId === actionId
  )
  if (!entry || entry.compilation.kind !== 'COMPILED') {
    throw new EncounterValidationError(
      'The selected Character action is not a committed executable rule action.'
    )
  }
  const published = initialPublishedDefinition(entry)
  if (
    entry.effectId !== published.id ||
    published.gameSystemId !== mechanics.commandState.systemId
  ) {
    throw new EncounterValidationError(
      'The committed Character action has an invalid rule identity.'
    )
  }
  return entry as Extract<CompiledActionEntryPoint, { compilation: { kind: 'COMPILED' } }>
}

function initialPublishedDefinition(
  entry: CompiledActionEntryPoint
): ServerPublishedRuleDefinitionDto {
  if (entry.compilation.kind !== 'COMPILED')
    throw new EncounterValidationError('The Character action has no compiled graph.')
  if (entry.schemaVersion !== 4) return entry.compilation.published
  return entry.compilation.executionPlan.kind === 'SINGLE_GRAPH'
    ? entry.compilation.executionPlan.published
    : entry.compilation.executionPlan.test.published
}

function actionActiveEffectPlan(
  entry: Extract<CompiledActionEntryPoint, { compilation: { kind: 'COMPILED' } }>
) {
  return entry.schemaVersion === 2 || entry.schemaVersion === 3 || entry.schemaVersion === 4
    ? (entry.compilation.activeEffectPlan ?? null)
    : null
}

function actionTestOutcomePlan(
  entry: Extract<CompiledActionEntryPoint, { compilation: { kind: 'COMPILED' } }>
) {
  return entry.schemaVersion === 4 && entry.compilation.executionPlan.kind === 'TEST_OUTCOME'
    ? entry.compilation.executionPlan
    : null
}

function targetPolicyPermitsSelectedActor(input: {
  actorId: string
  entry: Extract<CompiledActionEntryPoint, { compilation: { kind: 'COMPILED' } }>
  targetActorId: string
}): boolean {
  const policy = input.entry.targetPolicy
  if (!policy || policy.shape !== null || policy.pathOverrides.length > 0) return false
  if (policy.range.rangeKind === 'SELF' && policy.targeting?.selectionKind === 'SELF') {
    return input.targetActorId === input.actorId
  }
  return (
    policy.range.rangeKind === 'UNLIMITED' &&
    policy.targeting?.selectionKind === 'SINGLE_TARGET' &&
    policy.targeting.dispositionKind === 'ANY' &&
    !policy.targeting.excludedCreatureTypeIds?.length &&
    input.targetActorId !== input.actorId
  )
}

/**
 * Executes a committed self-target Character hit-point rule action against its
 * exact mechanics projection; no authored Effect is reread here.
 */
export async function executeEncounterCharacterRuleAction(input: {
  db: DBLike
  runtime: RulesRuntimeService
  command: ExecuteEncounterCharacterRuleActionInput
  /** Test-only deterministic d20 source. Production uses node:crypto. */
  rollD20?: () => number
  /** Test-only bounded integer source for a specialized OUTCOME graph. */
  rollInteger?: (min: number, max: number) => number
  /** Test-only deterministic active-effect identity source. */
  createActiveEffectId?: () => string
  resume?: Pick<
    ResumeEncounterCharacterRuleActionInput,
    'expectedOccurrenceVersion' | 'occurrenceId' | 'resolution'
  >
}): Promise<EncounterCharacterRuleActionResult> {
  const { db, runtime } = input
  const command = {
    ...input.command,
    actionId: input.resume ? 'pending-action' : actionIdSchema.parse(input.command.actionId),
    actorId: input.resume
      ? '00000000-0000-4000-8000-000000000000'
      : serverUuidIdentityDtoSchema.parse(input.command.actorId),
    actorUserId: serverUuidIdentityDtoSchema.parse(input.command.actorUserId),
    commandId: serverUuidIdentityDtoSchema.parse(input.command.commandId),
    correlationId: serverRuleExecutionCorrelationIdDtoSchema.parse(input.command.correlationId),
    encounterId: serverUuidIdentityDtoSchema.parse(input.command.encounterId),
    targetActorId: input.resume
      ? '00000000-0000-4000-8000-000000000000'
      : serverUuidIdentityDtoSchema.parse(input.command.targetActorId),
    sceneContext: input.command.sceneContext ?? null,
    liveSessionAuthority: input.command.liveSessionAuthority
      ? {
          ...input.command.liveSessionAuthority,
          sessionId: serverUuidIdentityDtoSchema.parse(input.command.liveSessionAuthority.sessionId)
        }
      : undefined
  }
  let locked: LockedCharacterRuleAction | null = null
  let lockedEncounterContext: Awaited<
    ReturnType<typeof lockEncounterRuleExecutionCommandContext>
  > | null = null
  const receiptSourceContext: {
    encounter: EncounterRecord | null
    sourceCharacterId: string | null
  } = { encounter: null, sourceCharacterId: null }
  let automaticD20RollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE' | null = null
  let automaticD20Audit: ReturnType<CharacterRuleActionSystemAdapter['bindFacts']>['d20Audit']
  let automaticD20RawFaces: readonly number[] | null = null
  let automaticD20RequestId: string | null = null
  let specializedOutcomeGraph:
    | import('@artificer-toolkit/shared/rules').CompiledRuleGraph
    | undefined
  let assistedConcentrationPending: PendingEncounterRuleOccurrenceSummaryDto | null = null
  let lockedCharacterAssignments: ReadonlyMap<string, string> = new Map()
  const aggregatePort: RuleExecutionAggregatePort = {
    async withLockedAuthorized(transaction, run) {
      const lockedEncounter = await lockEncounterRuleExecutionCommandContext(transaction, {
        actorUserId: command.actorUserId,
        authority: 'ACTIVE_MEMBER',
        encounterId: command.encounterId,
        liveSessionAuthority: command.liveSessionAuthority
      })
      lockedEncounterContext = lockedEncounter
      receiptSourceContext.encounter = lockedEncounter.encounter
      return run({
        aggregateKind: 'ENCOUNTER',
        aggregateId: lockedEncounter.context.encounterId,
        campaignId: lockedEncounter.context.campaignId,
        actorUserId: lockedEncounter.context.actorUserId,
        currentVersion: lockedEncounter.context.currentVersion,
        advanceVersion: (_db, expectedVersion) =>
          lockedEncounter.context.advanceVersion(expectedVersion)
      })
    }
  }
  let lockedSceneContext: LockedEncounterActionSceneContext | null = null
  const actionExecution: Parameters<
    ReturnType<typeof createRuleExecutionOccurrenceService>['executeResolved']
  >[1] = {
    commandId: command.commandId,
    correlationId: command.correlationId,
    expectedAggregateVersion: command.expectedEncounterVersion,
    intent: createEncounterActionStartIntent({
      actionId: command.actionId,
      actorId: command.actorId,
      sceneContext: command.sceneContext,
      targetActorId: command.targetActorId
    }),
    allowPaused: false,
    async resolve({ db: transaction, applicationContext }) {
      if (input.resume) {
        if (applicationContext?.kind !== 'ENCOUNTER_CHARACTER_RULE_ACTION') {
          throw new EncounterValidationError(
            'The pending rule action has an invalid application context.'
          )
        }
        command.actionId = actionIdSchema.parse(applicationContext.actionId)
        command.actorId = serverUuidIdentityDtoSchema.parse(applicationContext.sourceActorId)
        command.targetActorId = serverUuidIdentityDtoSchema.parse(applicationContext.targetActorId)
        command.sceneContext = await revalidateEncounterActionSceneDependency({
          db: transaction,
          encounterId: command.encounterId,
          actorId: command.actorId,
          targetActorId: command.targetActorId,
          dependency: applicationContext.sceneContext
        })
      }
      const contextState = lockedEncounterContext
      if (!contextState)
        throw new EncounterConflictError('Encounter command context was not locked.')
      const { encounter, context } = contextState
      if (encounter.status !== 'ACTIVE' || encounter.currentActorId !== command.actorId) {
        throw new EncounterConflictError(
          'The selected Character is not the current active Encounter actor.'
        )
      }
      lockedSceneContext = await revalidateEncounterActionSceneDependency({
        db: transaction,
        encounterId: encounter.id,
        actorId: command.actorId,
        targetActorId: command.targetActorId,
        dependency: toEncounterActionSceneDependency(command.sceneContext)
      })
      const actor = encounter.actors.find((candidate) => candidate.id === command.actorId)
      const targetActor = encounter.actors.find(
        (candidate) => candidate.id === command.targetActorId
      )
      if (
        !actor ||
        actor.kind !== 'CHARACTER' ||
        !actor.sourceId ||
        !targetActor ||
        targetActor.kind !== 'CHARACTER' ||
        !targetActor.sourceId
      ) {
        throw new EncounterValidationError(
          'This rule action requires exact Character actor and target identities.'
        )
      }
      let maintenancePreflight: MaintainedReplacementPreflight | null = null
      let concentrationPreflight: ConcentrationPreflight | null = null
      const preflightSource = await transaction
        .selectFrom('characters')
        .select(['id', 'stream_version'])
        .where('id', '=', actor.sourceId)
        .executeTakeFirst()
      if (!preflightSource)
        throw new EncounterConflictError('The Encounter Character source is stale.')
      const preflightMechanics = await createCharacterMechanicsProjectionRepository(
        transaction
      ).requireCurrent({
        characterId: actor.sourceId,
        expectedStreamVersion: preflightSource.stream_version
      })
      const preflightEntry = requireCommittedAction(preflightMechanics, command.actionId)
      const preflightPlan = actionActiveEffectPlan(preflightEntry)
      if (encounter.automationMode !== 'MANUAL' && preflightPlan?.maintenance) {
        const definition = await createReusableDefinitionRepository(transaction).requireCurrent(
          preflightPlan.maintenance.definitionId
        )
        if (
          definition.gameSystemId !== encounter.gameSystemId ||
          (preflightPlan.maintenance.definitionChecksum !== null &&
            preflightPlan.maintenance.definitionChecksum !== definition.checksum)
        )
          throw new EncounterValidationError(
            'The active-effect maintenance definition is no longer current.'
          )
        const activeEffects = createActiveRuleEffectRepository(transaction)
        const prior = await activeEffects.findMaintainedState({
          encounterId: encounter.id,
          ownerActorId: actor.id,
          maintenanceDefinitionId: preflightPlan.maintenance.definitionId
        })
        const dependents = prior
          ? await activeEffects.listDependentEffects({
              stateId: prior.id,
              encounterId: encounter.id
            })
          : []
        maintenancePreflight = {
          definitionChecksum: definition.checksum,
          definitionId: preflightPlan.maintenance.definitionId,
          dependents: dependents.map(maintainedDependentSnapshot),
          prior: prior
            ? {
                id: prior.id,
                version: prior.version,
                descriptorChecksum: prior.descriptorChecksum
              }
            : null
        }
      }
      if (encounter.automationMode === 'AUTOMATIC' || encounter.automationMode === 'ASSISTED') {
        const activeEffects = createActiveRuleEffectRepository(transaction)
        const concentrationState = await activeEffects.findMaintainedState({
          encounterId: encounter.id,
          ownerActorId: targetActor.id,
          maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
        })
        if (concentrationState) {
          const dependents = await activeEffects.listDependentEffects({
            stateId: concentrationState.id,
            encounterId: encounter.id
          })
          concentrationPreflight = {
            id: concentrationState.id,
            version: concentrationState.version,
            ownerActorId: concentrationState.ownerActorId,
            maintenanceDefinitionId: concentrationState.maintenanceDefinitionId,
            descriptorChecksum: concentrationState.descriptorChecksum,
            dependents: dependents.map(maintainedDependentSnapshot)
          }
        }
      }
      const lockedCharacterIds = [
        actor.sourceId,
        targetActor.sourceId,
        ...(lockedSceneContext
          ? encounter.actors.flatMap((candidate) =>
              candidate.kind === 'CHARACTER' && candidate.sourceId ? [candidate.sourceId] : []
            )
          : []),
        ...(maintenancePreflight?.dependents ?? []).flatMap((dependent) =>
          dependent.owner.startsWith('CHARACTER:')
            ? [dependent.owner.slice('CHARACTER:'.length)]
            : []
        ),
        ...(concentrationPreflight?.dependents ?? []).flatMap((dependent) =>
          dependent.owner.startsWith('CHARACTER:')
            ? [dependent.owner.slice('CHARACTER:'.length)]
            : []
        )
      ]
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort()
      const assignments = new Map<string, { user_id: string }>()
      for (const characterId of lockedCharacterIds) {
        const assignment = await sql<{ user_id: string }>`
          select user_id from public.campaign_character_assignments
          where campaign_id = ${context.campaignId} and character_id = ${characterId}
          for update
        `.execute(transaction)
        if (assignment.rows[0]) assignments.set(characterId, assignment.rows[0])
      }
      lockedCharacterAssignments = new Map(
        [...assignments].map(([characterId, assignment]) => [characterId, assignment.user_id])
      )
      const assignment = assignments.get(actor.sourceId)
      if (!assignment)
        throw new EncounterConflictError('The Character is no longer assigned to this Campaign.')
      const membership = await sql<{
        role: 'OWNER' | 'PLAYER'
        status: 'ACTIVE' | 'LEFT'
      }>`
        select role, status from public.campaign_memberships
        where campaign_id = ${context.campaignId} and user_id = ${command.actorUserId}
        for update
      `.execute(transaction)
      const currentMembership = membership.rows[0]
      if (!currentMembership || currentMembership.status !== 'ACTIVE') {
        throw new EncounterConflictError('The Encounter member is no longer active.')
      }
      if (currentMembership.role === 'PLAYER' && assignment.user_id !== command.actorUserId) {
        throw new EncounterConflictError('The active player no longer controls this Character.')
      }
      const targetAssignment =
        targetActor.sourceId === actor.sourceId ? assignment : assignments.get(targetActor.sourceId)
      if (!targetAssignment)
        throw new EncounterConflictError(
          'The target Character is no longer assigned to this Campaign.'
        )

      const characters = new Map<
        string,
        {
          id: string
          system_id: string
          stream_version: number
          status: string
        }
      >()
      for (const characterId of lockedCharacterIds) {
        const lockedCharacter = await transaction
          .selectFrom('characters')
          .select(['id', 'system_id', 'stream_version', 'status'])
          .where('id', '=', characterId)
          .forUpdate()
          .executeTakeFirst()
        if (lockedCharacter) characters.set(lockedCharacter.id, lockedCharacter)
      }
      const character = characters.get(actor.sourceId)
      const targetCharacter = characters.get(targetActor.sourceId)
      if (
        !character ||
        character.status !== 'ACTIVE' ||
        actor.sourceRevision !== character.stream_version
      ) {
        throw new EncounterConflictError('The Encounter Character source is stale.')
      }
      if (
        !targetCharacter ||
        targetCharacter.status !== 'ACTIVE' ||
        targetActor.sourceRevision !== targetCharacter.stream_version
      ) {
        throw new EncounterConflictError('The Encounter target Character source is stale.')
      }
      if (
        encounter.gameSystemId !== character.system_id ||
        actor.systemId !== character.system_id ||
        targetCharacter.system_id !== character.system_id ||
        targetActor.systemId !== character.system_id
      ) {
        throw new EncounterValidationError('The Character and Encounter Game Systems do not match.')
      }
      const hitPoints = await transaction
        .selectFrom('character_hitpoint_state')
        .select(['current', 'temp'])
        .where('character_id', '=', actor.sourceId)
        .forUpdate()
        .executeTakeFirst()
      const targetHitPoints =
        targetActor.sourceId === actor.sourceId
          ? hitPoints
          : await transaction
              .selectFrom('character_hitpoint_state')
              .select(['current', 'temp'])
              .where('character_id', '=', targetActor.sourceId)
              .forUpdate()
              .executeTakeFirst()
      const mechanics = await createCharacterMechanicsProjectionRepository(
        transaction
      ).requireCurrent({
        characterId: actor.sourceId,
        expectedStreamVersion: character.stream_version
      })
      const targetMechanics =
        targetActor.sourceId === actor.sourceId
          ? mechanics
          : await createCharacterMechanicsProjectionRepository(transaction).requireCurrent({
              characterId: targetActor.sourceId,
              expectedStreamVersion: targetCharacter.stream_version
            })
      if (
        !hitPoints ||
        hitPoints.current !== mechanics.commandState.state.hitpoints.current ||
        (hitPoints.temp ?? undefined) !== mechanics.commandState.state.hitpoints.temp ||
        hitPoints.current !== actor.currentHitPoints ||
        (hitPoints.temp ?? 0) !== actor.tempHitPoints
      ) {
        throw new EncounterConflictError('The Encounter Character hit-point mirror is stale.')
      }
      if (
        !targetHitPoints ||
        targetHitPoints.current !== targetMechanics.commandState.state.hitpoints.current ||
        (targetHitPoints.temp ?? undefined) !== targetMechanics.commandState.state.hitpoints.temp ||
        targetHitPoints.current !== targetActor.currentHitPoints ||
        (targetHitPoints.temp ?? 0) !== targetActor.tempHitPoints
      ) {
        throw new EncounterConflictError(
          'The Encounter target Character hit-point mirror is stale.'
        )
      }
      const lockedTargetHitPoints = targetHitPoints
      if (lockedTargetHitPoints.current === null) {
        throw new EncounterConflictError(
          'The Encounter target Character hit-point mirror is stale.'
        )
      }
      const lockedTargetCurrentHitPoints = lockedTargetHitPoints.current
      const currentProjection = await createEncounterRepository(
        transaction
      ).requireCurrentProjection({
        encounterId: encounter.id,
        expectedStreamVersion: context.currentVersion
      })
      const ruleContext = await resolveCharacterLiveSessionRuleContext(
        transaction,
        actor.sourceId,
        {
          id: context.campaignId,
          attunementSlotOverride: context.attunementSlotOverride
        }
      )
      if (!ruleContext)
        throw new EncounterConflictError('The Character Campaign rule context is stale.')
      const targetRuleContext =
        targetActor.sourceId === actor.sourceId
          ? ruleContext
          : await resolveCharacterLiveSessionRuleContext(transaction, targetActor.sourceId, {
              id: context.campaignId,
              attunementSlotOverride: context.attunementSlotOverride
            })
      if (!targetRuleContext)
        throw new EncounterConflictError('The target Character Campaign rule context is stale.')
      const overlay = await createCampaignCharacterMechanicsProjectionRepository(
        transaction
      ).requireCurrent({
        campaignId: context.campaignId,
        characterId: actor.sourceId,
        expectedBaseMechanicsProjectionChecksum: mechanics.projectionChecksum,
        expectedCharacterStreamVersion: character.stream_version,
        expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
          adjustments: ruleContext.adjustments,
          attunementSlotOverride: ruleContext.attunementSlotOverride
        }),
        expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
        baseMechanicsProjection: mechanics
      })
      const targetOverlay =
        targetActor.sourceId === actor.sourceId
          ? overlay
          : await createCampaignCharacterMechanicsProjectionRepository(transaction).requireCurrent({
              campaignId: context.campaignId,
              characterId: targetActor.sourceId,
              expectedBaseMechanicsProjectionChecksum: targetMechanics.projectionChecksum,
              expectedCharacterStreamVersion: targetCharacter.stream_version,
              expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
                adjustments: targetRuleContext.adjustments,
                attunementSlotOverride: targetRuleContext.attunementSlotOverride
              }),
              expectedProjectionSchemaVersion:
                CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
              baseMechanicsProjection: targetMechanics
            })
      const entry = requireCommittedAction(mechanics, command.actionId)
      const lockedPlan = actionActiveEffectPlan(entry)
      let lockedMaintenanceReplacement: MaintainedReplacementPreflight | null = null
      if (
        encounter.automationMode !== 'MANUAL' &&
        (maintenancePreflight || lockedPlan?.maintenance)
      ) {
        if (!maintenancePreflight || !lockedPlan?.maintenance)
          throw new EncounterConflictError(
            'The active-effect maintenance policy changed before Character locks.'
          )
        const definition = await createReusableDefinitionRepository(transaction).requireCurrent(
          lockedPlan.maintenance.definitionId
        )
        if (
          definition.gameSystemId !== encounter.gameSystemId ||
          definition.checksum !== maintenancePreflight.definitionChecksum ||
          lockedPlan.maintenance.definitionId !== maintenancePreflight.definitionId ||
          (lockedPlan.maintenance.definitionChecksum !== null &&
            lockedPlan.maintenance.definitionChecksum !== definition.checksum)
        )
          throw new EncounterConflictError(
            'The active-effect maintenance definition changed before Character locks.'
          )
        const activeEffects = createActiveRuleEffectRepository(transaction)
        const prior = await activeEffects.lockMaintainedState({
          encounterId: encounter.id,
          ownerActorId: actor.id,
          maintenanceDefinitionId: lockedPlan.maintenance.definitionId
        })
        const dependents = prior
          ? await activeEffects.lockDependentEffects({
              stateId: prior.id,
              encounterId: encounter.id
            })
          : []
        lockedMaintenanceReplacement = {
          definitionChecksum: definition.checksum,
          definitionId: lockedPlan.maintenance.definitionId,
          dependents: dependents.map(maintainedDependentSnapshot),
          prior: prior
            ? {
                id: prior.id,
                version: prior.version,
                descriptorChecksum: prior.descriptorChecksum
              }
            : null
        }
        if (!sameMaintainedReplacementPreflight(maintenancePreflight, lockedMaintenanceReplacement))
          throw new EncounterConflictError(
            'Maintained effect dependencies changed before Character locks.'
          )
      }
      let lockedConcentration: ConcentrationPreflight | null = null
      if (
        (encounter.automationMode === 'AUTOMATIC' || encounter.automationMode === 'ASSISTED') &&
        concentrationPreflight
      ) {
        const activeEffects = createActiveRuleEffectRepository(transaction)
        const state = await activeEffects.lockMaintainedStateById({
          encounterId: encounter.id,
          stateId: concentrationPreflight.id
        })
        if (
          !state ||
          state.ownerActorId !== targetActor.id ||
          state.maintenanceDefinitionId !== DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
        ) {
          throw new EncounterConflictError('Concentration state changed before Character locks.')
        }
        const dependents = await activeEffects.lockDependentEffects({
          stateId: state.id,
          encounterId: encounter.id
        })
        lockedConcentration = {
          id: state.id,
          version: state.version,
          ownerActorId: state.ownerActorId,
          maintenanceDefinitionId: state.maintenanceDefinitionId,
          descriptorChecksum: state.descriptorChecksum,
          dependents: dependents.map(maintainedDependentSnapshot)
        }
        if (!sameConcentrationPreflight(concentrationPreflight, lockedConcentration))
          throw new EncounterConflictError(
            'Concentration dependencies changed before Character locks.'
          )
      }
      if (initialPublishedDefinition(entry).gameSystemId !== encounter.gameSystemId) {
        throw new EncounterValidationError(
          'The committed action Game System does not match the Encounter.'
        )
      }
      const maximumHitPoints = resolveCharacterEffectiveMaximumHitPoints(
        overlay.rulePolicyOutput.derivedStats.maxHitPoints.effective
      )
      if (actor.maxHitPoints !== maximumHitPoints) {
        throw new EncounterConflictError(
          'The Encounter Character maximum-hit-point mirror is stale.'
        )
      }
      const targetMaximumHitPoints = resolveCharacterEffectiveMaximumHitPoints(
        targetOverlay.rulePolicyOutput.derivedStats.maxHitPoints.effective
      )
      if (targetActor.maxHitPoints !== targetMaximumHitPoints) {
        throw new EncounterConflictError(
          'The Encounter target Character maximum-hit-point mirror is stale.'
        )
      }
      if (
        !targetPolicyPermitsSelectedActor({
          actorId: actor.id,
          entry,
          targetActorId: targetActor.id
        })
      ) {
        throw new EncounterValidationError(
          'The selected Encounter target is not permitted by the committed Character action.'
        )
      }
      const adapter = characterRuleActionSystemAdapterRegistry.get(character.system_id)
      if (!adapter)
        throw new EncounterValidationError(
          'The Character Game System cannot execute this rule action.'
        )
      let phasePublished = initialPublishedDefinition(entry)
      const testOutcomePlan = actionTestOutcomePlan(entry)
      let conditionDefinitions: LockedCharacterRuleAction['conditionDefinitions'] = null
      let targetConditionDefinitions: LockedCharacterRuleAction['targetConditionDefinitions'] = null
      const targetVocabularySnapshot = await createSystemVocabularySnapshotRepository(
        transaction
      ).findById(targetMechanics.systemVocabularySnapshotId)
      if (
        !targetVocabularySnapshot ||
        targetVocabularySnapshot.systemId !== targetCharacter.system_id ||
        targetVocabularySnapshot.snapshotVersion !==
          targetMechanics.systemVocabularySnapshotVersion ||
        targetVocabularySnapshot.checksum !== targetMechanics.systemVocabularySnapshotChecksum
      ) {
        throw new EncounterConflictError(
          'The target Character System vocabulary snapshot is stale.'
        )
      }
      const loadConditionDefinitions = async (published: ServerPublishedRuleDefinitionDto) => {
        if (!adapter.requiresConditionDefinitionValidation?.({ published })) return
        const vocabularySnapshot = await createSystemVocabularySnapshotRepository(
          transaction
        ).findById(mechanics.systemVocabularySnapshotId)
        if (
          !vocabularySnapshot ||
          vocabularySnapshot.systemId !== character.system_id ||
          vocabularySnapshot.snapshotVersion !== mechanics.systemVocabularySnapshotVersion ||
          vocabularySnapshot.checksum !== mechanics.systemVocabularySnapshotChecksum
        ) {
          throw new EncounterConflictError('The Character System vocabulary snapshot is stale.')
        }
        adapter.validateConditionDefinitions?.({
          published,
          conditionDefinitionIds: vocabularySnapshot.document.conditionTypes.map(
            (condition) => condition.id
          )
        })
        adapter.validateConditionDefinitions?.({
          published,
          conditionDefinitionIds: targetVocabularySnapshot.document.conditionTypes.map(
            (condition) => condition.id
          )
        })
        conditionDefinitions = vocabularySnapshot.document.conditionTypes
        targetConditionDefinitions = targetVocabularySnapshot.document.conditionTypes
        if (locked) {
          locked.conditionDefinitions = conditionDefinitions
          locked.targetConditionDefinitions = targetConditionDefinitions
        }
      }
      await loadConditionDefinitions(phasePublished)
      const preparedActionState = await prepareEncounterCharacterActionState({
        db: transaction,
        actionId: command.actionId,
        actorUserId: command.actorUserId,
        automationMode: encounter.automationMode,
        characterId: actor.sourceId,
        entry,
        mechanics,
        overlay
      })
      const positionalCapabilityDefinitionIds =
        lockedSceneContext === null
          ? []
          : (adapter.positionalCapabilityDefinitionIds?.({
              automationMode: encounter.automationMode,
              optionalCombatSnapshot: encounter.optionalCombatSnapshot ?? null,
              optionalCombatSnapshotChecksum: encounter.optionalCombatSnapshotChecksum ?? null
            }) ?? [])
      const positionalState =
        positionalCapabilityDefinitionIds.length === 0
          ? null
          : await (async () => {
              const evaluated = await evaluateEncounterActorRuleSnapshot({
                db: transaction,
                encounter
              })
              const targets = await lockEncounterActiveEffectTargets({
                trx: transaction,
                encounter: evaluated.reconciledEncounter,
                actors: evaluated.reconciledEncounter.actors,
                attunementSlotOverride: context.attunementSlotOverride,
                getEncounterActorSnapshot: async () => ({
                  rules: evaluated.snapshot.output,
                  encounter: evaluated.reconciledEncounter
                })
              })
              return { encounter: evaluated.reconciledEncounter, targets }
            })()
      const positionalFacts =
        positionalState === null
          ? null
          : await lockEncounterActionPositionalFacts({
              trx: transaction,
              encounter: positionalState.encounter,
              sceneContext: lockedSceneContext,
              targets: positionalState.targets,
              capabilityDefinitionIds: positionalCapabilityDefinitionIds
            })
      if (
        input.resume &&
        applicationContext?.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION' &&
        (positionalFacts?.dependencyChecksum ?? null) !==
          applicationContext.positionalDependencyChecksum
      ) {
        throw new EncounterConflictError('Action positional facts changed before evidence resumed.')
      }
      const resourceConsumption = preparedActionState.resourceConsumption
      locked = {
        characterId: actor.sourceId,
        sourceActor: actor,
        encounter,
        currentProjection,
        mechanics,
        maximumHitPoints,
        overlay,
        priorProjectionChecksum: mechanics.projectionChecksum,
        adapter,
        published: phasePublished,
        activeEffectPlan: lockedPlan,
        attunementSlotOverride: context.attunementSlotOverride,
        conditionDefinitions,
        resourceConsumption,
        targetCharacterId: targetActor.sourceId,
        targetConditionDefinitions,
        targetMaximumHitPoints,
        targetMechanics,
        targetOverlay,
        targetPriorProjectionChecksum: targetMechanics.projectionChecksum,
        targetVocabularySnapshot,
        maintainedReplacement: lockedMaintenanceReplacement,
        concentration: lockedConcentration
      }
      let bound = adapter.bindFacts({
        actionMechanic: preparedActionState.actionMechanic,
        published: phasePublished,
        sourceDerivedFacts: overlay.rulePolicyOutput,
        targetActorId: command.targetActorId,
        targetDerivedFacts: targetOverlay.rulePolicyOutput,
        targetConditionIds: (targetMechanics.commandState.state.conditions ?? []).map(
          (condition) => condition.conditionTypeId
        ),
        ...(concentrationPreflight?.dependents ?? []).flatMap((dependent) =>
          dependent.owner.startsWith('CHARACTER:')
            ? [dependent.owner.slice('CHARACTER:'.length)]
            : []
        ),
        currentHitPoints: targetHitPoints.current,
        temporaryHitPoints: targetHitPoints.temp ?? 0,
        maximumHitPoints: targetMaximumHitPoints,
        defenses: targetOverlay.rulePolicyOutput.defenses,
        conditionImmunityIds: targetOverlay.rulePolicyOutput.conditionImmunityIds,
        sceneContext: lockedSceneContext,
        positionalFacts
      })
      const outcomeResumeContext =
        input.resume &&
        applicationContext?.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION' &&
        applicationContext.twoPhase?.phase === 'OUTCOME'
          ? applicationContext
          : null
      const outcomeResumeTwoPhase =
        outcomeResumeContext?.twoPhase?.phase === 'OUTCOME' ? outcomeResumeContext.twoPhase : null
      const isOutcomeResume = outcomeResumeContext !== null
      let resumedOutcomePhasePlan: {
        initialPhase: 'OUTCOME'
        phase: 'OUTCOME'
        template: {
          definitionId: string
          gameSystemId: string
          definitionFamilyKey: string
          checksum: string
        }
        specializedChecksum: string
      } | null = null
      if (outcomeResumeContext && outcomeResumeTwoPhase) {
        if (
          outcomeResumeContext.actionId !== command.actionId ||
          outcomeResumeContext.sourceActorId !== actor.id ||
          outcomeResumeContext.targetActorId !== targetActor.id ||
          outcomeResumeContext.sourceCharacterId !== actor.sourceId ||
          outcomeResumeContext.targetCharacterId !== targetActor.sourceId ||
          outcomeResumeContext.sourceCharacterStreamVersion !== mechanics.characterStreamVersion ||
          outcomeResumeContext.targetCharacterStreamVersion !==
            targetMechanics.characterStreamVersion ||
          outcomeResumeContext.sourceProjectionChecksum !== mechanics.projectionChecksum ||
          outcomeResumeContext.targetProjectionChecksum !== targetMechanics.projectionChecksum ||
          outcomeResumeContext.sourceMechanicalContextChecksum !==
            overlay.mechanicalContextChecksum ||
          outcomeResumeContext.targetMechanicalContextChecksum !==
            targetOverlay.mechanicalContextChecksum
        ) {
          throw new EncounterConflictError(
            'The pending action source changed before outcome resume.'
          )
        }
        if (!testOutcomePlan || !adapter.specializeOutcomeTemplate) {
          throw new EncounterConflictError(
            'The pending action no longer has its exact outcome plan.'
          )
        }
        const selectedPath = outcomeResumeTwoPhase.testExecution.outputs.resultPath
        if (typeof selectedPath !== 'string') {
          throw new EncounterConflictError('The pending action TEST result is invalid.')
        }
        const expectedTemplate = testOutcomePlan.outcomes.find(
          (candidate) => candidate.pathCode === selectedPath
        )
        if (!expectedTemplate) {
          throw new EncounterConflictError(
            'The pending action selected an unavailable outcome path.'
          )
        }
        if (
          outcomeResumeTwoPhase.compilerSourceChecksum !==
            testOutcomePlan.compilerSource.compilerSourceChecksum ||
          outcomeResumeTwoPhase.testTemplateChecksum !== testOutcomePlan.test.template.checksum ||
          outcomeResumeTwoPhase.boundFactsChecksum !== checksumRuleDocument(bound.facts) ||
          outcomeResumeTwoPhase.testExecutionChecksum !==
            checksumRuleDocument(outcomeResumeTwoPhase.testExecution) ||
          outcomeResumeTwoPhase.testExecution.evidence.source.definitionId !==
            testOutcomePlan.test.template.definitionId ||
          outcomeResumeTwoPhase.testExecution.evidence.source.gameSystemId !==
            testOutcomePlan.test.template.gameSystemId ||
          outcomeResumeTwoPhase.testExecution.evidence.source.definitionFamilyKey !==
            testOutcomePlan.test.template.definitionFamilyKey ||
          outcomeResumeTwoPhase.testExecution.evidence.source.checksum !== phasePublished.checksum
        ) {
          throw new EncounterConflictError(
            'The pending action phase identity changed before resume.'
          )
        }
        const specialized = adapter.specializeOutcomeTemplate({
          compilerSource: testOutcomePlan.compilerSource,
          testTemplate: {
            published: initialPublishedDefinition(entry),
            template: testOutcomePlan.test.template
          },
          selectedPath,
          facts: bound.facts
        })
        if (
          !specialized ||
          specialized.templateChecksum !== expectedTemplate.template.checksum ||
          specialized.published.id !== expectedTemplate.template.definitionId ||
          specialized.published.gameSystemId !== expectedTemplate.template.gameSystemId ||
          specialized.published.definitionFamilyKey !==
            expectedTemplate.template.definitionFamilyKey ||
          specialized.published.checksum !== outcomeResumeContext.publishedDefinitionChecksum ||
          outcomeResumeTwoPhase.outcomeTemplateChecksum !== specialized.templateChecksum
        ) {
          throw new EncounterConflictError('The pending action outcome specialization changed.')
        }
        await loadConditionDefinitions(specialized.published)
        phasePublished = specialized.published
        bound = adapter.bindFacts({
          actionMechanic: preparedActionState.actionMechanic,
          published: phasePublished,
          sourceDerivedFacts: overlay.rulePolicyOutput,
          targetActorId: command.targetActorId,
          targetDerivedFacts: targetOverlay.rulePolicyOutput,
          targetConditionIds: (targetMechanics.commandState.state.conditions ?? []).map(
            (condition) => condition.conditionTypeId
          ),
          currentHitPoints: targetHitPoints.current,
          temporaryHitPoints: targetHitPoints.temp ?? 0,
          maximumHitPoints: targetMaximumHitPoints,
          defenses: targetOverlay.rulePolicyOutput.defenses,
          conditionImmunityIds: targetOverlay.rulePolicyOutput.conditionImmunityIds,
          sceneContext: lockedSceneContext,
          positionalFacts
        })
        locked.published = phasePublished
        resumedOutcomePhasePlan = {
          initialPhase: 'OUTCOME',
          phase: 'OUTCOME',
          template: expectedTemplate.template,
          specializedChecksum: phasePublished.checksum
        }
      }
      if (encounter.automationMode === 'MANUAL') {
        return {
          published: phasePublished,
          facts: bound.facts,
          manualReceipt: {
            reminder:
              encounter.manualReminderMode === 'SUBTLE'
                ? { kind: 'MANUAL_RULE_REVIEW' as const }
                : null
          }
        }
      }
      automaticD20RollMode = bound.d20RollMode ?? null
      automaticD20Audit = bound.d20Audit
      return {
        published: phasePublished,
        facts: bound.facts,
        allowPaused: encounter.automationMode === 'ASSISTED',
        pendingApplicationContext: isOutcomeResume
          ? applicationContext
          : {
              kind: 'ENCOUNTER_CHARACTER_RULE_ACTION',
              schemaVersion: 1,
              actionId: command.actionId,
              sceneContext: toEncounterActionSceneDependency(lockedSceneContext),
              positionalDependencyChecksum: positionalFacts?.dependencyChecksum ?? null,
              sourceActorId: actor.id,
              targetActorId: targetActor.id,
              sourceCharacterId: actor.sourceId,
              targetCharacterId: targetActor.sourceId,
              sourceCharacterStreamVersion: mechanics.characterStreamVersion,
              targetCharacterStreamVersion: targetMechanics.characterStreamVersion,
              sourceProjectionChecksum: mechanics.projectionChecksum,
              targetProjectionChecksum: targetMechanics.projectionChecksum,
              sourceMechanicalContextChecksum: overlay.mechanicalContextChecksum,
              targetMechanicalContextChecksum: targetOverlay.mechanicalContextChecksum,
              publishedDefinitionId: phasePublished.id,
              publishedDefinitionChecksum: phasePublished.checksum,
              twoPhase: testOutcomePlan
                ? {
                    phase: 'TEST' as const,
                    compilerSourceChecksum: testOutcomePlan.compilerSource.compilerSourceChecksum,
                    testTemplateChecksum: testOutcomePlan.test.template.checksum,
                    boundFactsChecksum: checksumRuleDocument(bound.facts)
                  }
                : null,
              targetStateChecksum: checksumRuleDocument({
                targetActorId: targetActor.id,
                currentHitPoints: targetHitPoints.current,
                temporaryHitPoints: targetHitPoints.temp ?? 0,
                maximumHitPoints: targetMaximumHitPoints,
                conditionIds: (targetMechanics.commandState.state.conditions ?? []).map(
                  (condition) => condition.conditionTypeId
                )
              }),
              d20:
                bound.d20RollMode && bound.d20Audit
                  ? {
                      rollMode: bound.d20RollMode,
                      contributors: [...bound.d20Audit.contributors],
                      contributorChecksum: bound.d20Audit.contributorChecksum,
                      modifier: bound.d20Audit.modifier,
                      defenseOrDc: bound.d20Audit.defenseOrDc
                    }
                  : null
            },
        ...(testOutcomePlan
          ? {
              phasePlan: isOutcomeResume
                ? resumedOutcomePhasePlan!
                : {
                    initialPhase: 'TEST' as const,
                    phase: 'TEST' as const,
                    template: {
                      definitionId: phasePublished.id,
                      gameSystemId: phasePublished.gameSystemId,
                      definitionFamilyKey: phasePublished.definitionFamilyKey,
                      checksum: phasePublished.checksum
                    },
                    specializedChecksum: phasePublished.checksum
                  },
              postCompletedExecution: async ({ execution, occurrenceId, applicationContext }) => {
                if (
                  applicationContext.kind !== 'ENCOUNTER_CHARACTER_RULE_ACTION' ||
                  applicationContext.twoPhase?.phase !== 'TEST' ||
                  !locked
                ) {
                  return null
                }
                let phaseResolution
                try {
                  phaseResolution = resolveActionPhaseExecution({
                    plan: testOutcomePlan,
                    phase: 'TEST',
                    execution,
                    adapter: locked.adapter,
                    facts: bound.facts,
                    effectivePath:
                      typeof execution.outputs.resultPath === 'string'
                        ? execution.outputs.resultPath
                        : undefined
                  })
                } catch (error) {
                  throw new EncounterValidationError(
                    error instanceof Error
                      ? error.message
                      : 'The Character action selected an unsupported outcome.'
                  )
                }
                if (phaseResolution.kind === 'TEST_ONLY') {
                  return null
                }
                if (phaseResolution.kind !== 'OUTCOME') {
                  throw new EncounterValidationError(
                    'The Character action selected an unsupported outcome.'
                  )
                }
                const { outcome: specialized, template: outcomeTemplate } = phaseResolution
                await loadConditionDefinitions(specialized.published)
                const outcomeBound = locked.adapter.bindFacts({
                  actionMechanic: preparedActionState.actionMechanic,
                  published: specialized.published,
                  sourceDerivedFacts: overlay.rulePolicyOutput,
                  targetActorId: command.targetActorId,
                  targetDerivedFacts: targetOverlay.rulePolicyOutput,
                  targetConditionIds: (targetMechanics.commandState.state.conditions ?? []).map(
                    (condition) => condition.conditionTypeId
                  ),
                  currentHitPoints: lockedTargetCurrentHitPoints,
                  temporaryHitPoints: lockedTargetHitPoints.temp ?? 0,
                  maximumHitPoints: targetMaximumHitPoints,
                  defenses: targetOverlay.rulePolicyOutput.defenses,
                  conditionImmunityIds: targetOverlay.rulePolicyOutput.conditionImmunityIds,
                  sceneContext: lockedSceneContext,
                  positionalFacts
                })
                const started = runtime.executeResolvedWithGraph
                  ? await runtime.executeResolvedWithGraph({
                      command: {
                        definitionId: specialized.published.id,
                        occurrenceId,
                        facts: outcomeBound.facts
                      },
                      published: specialized.published
                    })
                  : {
                      result: await runtime.executeResolved({
                        command: {
                          definitionId: specialized.published.id,
                          occurrenceId,
                          facts: outcomeBound.facts
                        },
                        published: specialized.published
                      }),
                      graph: undefined
                    }
                const nextContext = {
                  ...applicationContext,
                  publishedDefinitionId: specialized.published.id,
                  publishedDefinitionChecksum: specialized.published.checksum,
                  twoPhase: {
                    phase: 'OUTCOME' as const,
                    legendaryResistance: null,
                    compilerSourceChecksum: testOutcomePlan.compilerSource.compilerSourceChecksum,
                    testTemplateChecksum: testOutcomePlan.test.template.checksum,
                    outcomeTemplateChecksum: specialized.templateChecksum,
                    boundFactsChecksum: checksumRuleDocument(bound.facts),
                    testExecution: execution,
                    testExecutionChecksum: checksumRuleDocument(execution),
                    testRollEvidence: (() => {
                      if (
                        !applicationContext.d20 ||
                        !automaticD20RawFaces ||
                        !automaticD20RequestId ||
                        !automaticD20RollMode ||
                        !automaticD20Audit ||
                        automaticD20RollMode !== applicationContext.d20.rollMode ||
                        automaticD20Audit.contributorChecksum !==
                          applicationContext.d20.contributorChecksum
                      ) {
                        throw new EncounterValidationError(
                          'The Character action TEST roll evidence is invalid.'
                        )
                      }
                      const trace = execution.evidence.trace.find(
                        (candidate) => candidate.evidence?.requestId === automaticD20RequestId
                      )
                      const selectedNatural =
                        automaticD20RollMode === 'ADVANTAGE'
                          ? Math.max(...automaticD20RawFaces)
                          : automaticD20RollMode === 'DISADVANTAGE'
                            ? Math.min(...automaticD20RawFaces)
                            : automaticD20RawFaces[0]
                      if (
                        !trace ||
                        trace.evidence?.value !== selectedNatural ||
                        !Number.isInteger(selectedNatural)
                      ) {
                        throw new EncounterValidationError(
                          'The Character action TEST roll trace is invalid.'
                        )
                      }
                      return {
                        requestId: automaticD20RequestId,
                        rollMode: automaticD20RollMode,
                        rawFaces: [...automaticD20RawFaces],
                        selectedNatural
                      }
                    })()
                  }
                }
                specializedOutcomeGraph = started.graph
                locked.published = specialized.published
                return {
                  ...(started.result.status === 'COMPLETE'
                    ? { execution: started.result }
                    : { continuation: started.result.continuation }),
                  ...(started.graph ? { graph: started.graph } : {}),
                  applicationContext: nextContext,
                  ...(started.result.status === 'PAUSED'
                    ? {
                        pendingResult: {
                          kind: 'INTEGER_RANGE_EVIDENCE' as const,
                          phase: 'OUTCOME' as const,
                          requests: [
                            {
                              requestId: started.result.continuation.request.requestId,
                              min: started.result.continuation.request.min,
                              max: started.result.continuation.request.max
                            }
                          ],
                          exactRequestSetChecksum: checksumRuleDocument([
                            {
                              requestId: started.result.continuation.request.requestId,
                              min: started.result.continuation.request.min,
                              max: started.result.continuation.request.max
                            }
                          ])
                        },
                        resolveAutomaticEvidence: async ({ request }) => {
                          if (request.kind !== 'INTEGER_RANGE' || request.min >= request.max) {
                            throw new EncounterValidationError(
                              'The Character action outcome roll is invalid.'
                            )
                          }
                          const value = input.rollInteger
                            ? input.rollInteger(request.min, request.max)
                            : randomInt(request.min, request.max + 1)
                          if (
                            !Number.isSafeInteger(value) ||
                            value < request.min ||
                            value > request.max
                          ) {
                            throw new EncounterValidationError(
                              'The Character action outcome roll is invalid.'
                            )
                          }
                          return { requestId: request.requestId, value }
                        }
                      }
                    : {}),
                  phase: 'OUTCOME' as const,
                  phaseReceiptPlan: {
                    phase: 'OUTCOME' as const,
                    template: outcomeTemplate,
                    specializedChecksum: specialized.published.checksum
                  }
                }
              }
            }
          : {})
      }
    },
    resolveAutomaticEvidence: async ({ occurrenceId, request }) => {
      if (
        request.kind !== 'INTEGER_RANGE' ||
        request.min !== 1 ||
        request.max !== 20 ||
        automaticD20RollMode === null
      ) {
        throw new EncounterValidationError('The Character rule action issued an unsupported roll.')
      }
      const roll = input.rollD20 ?? (() => randomInt(1, 21))
      const rolls = automaticD20RollMode === 'NORMAL' ? [roll()] : [roll(), roll()]
      if (rolls.some((value) => !Number.isSafeInteger(value) || value < 1 || value > 20)) {
        throw new EncounterValidationError('The Character rule action roll is invalid.')
      }
      const value =
        automaticD20RollMode === 'ADVANTAGE'
          ? Math.max(...rolls)
          : automaticD20RollMode === 'DISADVANTAGE'
            ? Math.min(...rolls)
            : rolls[0]!
      automaticD20RawFaces = rolls
      automaticD20RequestId = request.requestId
      void occurrenceId
      return { requestId: request.requestId, value }
    },
    completionApplicator: {
      async apply({
        db: transaction,
        occurrenceId,
        commandId,
        correlationId,
        commandFingerprint,
        pendingApplicationContext,
        execution,
        phaseReceipts,
        compiledGraph,
        proposedAggregateVersion
      }) {
        if (!locked)
          throw new EncounterValidationError('The Character rule action source was not locked.')
        const lockedAction = locked
        const applications = locked.adapter.interpret({
          execution,
          occurrenceId,
          published: locked.published,
          targetActorId: command.targetActorId,
          currentHitPoints: locked.targetMechanics.commandState.state.hitpoints.current,
          temporaryHitPoints: locked.targetMechanics.commandState.state.hitpoints.temp ?? 0,
          maximumHitPoints: locked.targetMaximumHitPoints,
          defenses: locked.targetOverlay.rulePolicyOutput.defenses,
          conditionImmunityIds: locked.targetOverlay.rulePolicyOutput.conditionImmunityIds
        })
        const activeEffectPlan = locked.activeEffectPlan
        const terminalCompiledGraph = specializedOutcomeGraph ?? compiledGraph
        if (activeEffectPlan && !terminalCompiledGraph) {
          throw new EncounterValidationError(
            'The active-effect action did not retain its exact compiled graph.'
          )
        }
        const d20 = (() => {
          const characterActionContext =
            pendingApplicationContext.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION'
              ? pendingApplicationContext
              : null
          const twoPhase =
            characterActionContext?.twoPhase?.phase === 'OUTCOME'
              ? characterActionContext.twoPhase
              : null
          if (twoPhase) {
            if (!characterActionContext) {
              throw new EncounterValidationError('The Character action context is invalid.')
            }
            if (
              !characterActionContext.d20 ||
              twoPhase.testExecutionChecksum !== checksumRuleDocument(twoPhase.testExecution)
            ) {
              throw new EncounterValidationError('The Character action TEST receipt is invalid.')
            }
            const evidence = twoPhase.testRollEvidence
            if (
              evidence.rollMode !== characterActionContext.d20.rollMode ||
              evidence.rawFaces.length !== (evidence.rollMode === 'NORMAL' ? 1 : 2) ||
              evidence.selectedNatural !==
                (evidence.rollMode === 'ADVANTAGE'
                  ? Math.max(...evidence.rawFaces)
                  : evidence.rollMode === 'DISADVANTAGE'
                    ? Math.min(...evidence.rawFaces)
                    : evidence.rawFaces[0])
            ) {
              throw new EncounterValidationError(
                'The Character action TEST roll evidence is invalid.'
              )
            }
            const trace = twoPhase.testExecution.evidence.trace.find(
              (entry) => entry.evidence?.requestId === evidence.requestId
            )
            const resultPath = twoPhase.testExecution.outputs.resultPath
            if (
              !trace ||
              trace.evidence?.value !== evidence.selectedNatural ||
              typeof resultPath !== 'string'
            ) {
              throw new EncounterValidationError('The Character action TEST trace is invalid.')
            }
            return {
              requestId: evidence.requestId,
              rollMode: evidence.rollMode,
              rawFaces: [...evidence.rawFaces],
              selectedNatural: evidence.selectedNatural,
              contributors: characterActionContext.d20.contributors,
              contributorChecksum: characterActionContext.d20.contributorChecksum,
              modifier: characterActionContext.d20.modifier,
              total: evidence.selectedNatural + characterActionContext.d20.modifier,
              defenseOrDc: characterActionContext.d20.defenseOrDc,
              resultPath
            } as const
          }
          if (
            !automaticD20RawFaces ||
            !automaticD20RequestId ||
            !automaticD20RollMode ||
            !automaticD20Audit
          )
            return null
          const trace = execution.evidence.trace.find(
            (entry) => entry.evidence?.requestId === automaticD20RequestId
          )
          const resultPath = execution.outputs.resultPath
          if (
            !trace ||
            trace.evidence?.value !==
              (automaticD20RollMode === 'ADVANTAGE'
                ? Math.max(...automaticD20RawFaces)
                : automaticD20RollMode === 'DISADVANTAGE'
                  ? Math.min(...automaticD20RawFaces)
                  : automaticD20RawFaces[0]) ||
            typeof resultPath !== 'string'
          )
            throw new EncounterValidationError('The Character rule action d20 trace is invalid.')
          return {
            requestId: automaticD20RequestId,
            rollMode: automaticD20RollMode,
            rawFaces: [...automaticD20RawFaces],
            selectedNatural: trace.evidence.value,
            contributors: automaticD20Audit.contributors,
            contributorChecksum: automaticD20Audit.contributorChecksum,
            modifier: automaticD20Audit.modifier,
            total: trace.evidence.value + automaticD20Audit.modifier,
            defenseOrDc: automaticD20Audit.defenseOrDc,
            resultPath
          } as const
        })()
        const foldedApplications = foldCharacterMechanicsApplications({
          targetActorId: command.targetActorId,
          currentHitPoints: locked.targetMechanics.commandState.state.hitpoints.current,
          temporaryHitPoints: locked.targetMechanics.commandState.state.hitpoints.temp ?? 0,
          maximumHitPoints: locked.targetMaximumHitPoints,
          conditionIds: (locked.targetMechanics.commandState.state.conditions ?? []).map(
            (condition) => condition.conditionTypeId
          ),
          applications
        })
        const after = foldedApplications.after.currentHitPoints
        const afterTemporary = foldedApplications.after.temporaryHitPoints
        const existingCharacterConditions =
          locked.targetMechanics.commandState.state.conditions ?? []
        const existingCharacterConditionIds = new Set(
          existingCharacterConditions.map((condition) => condition.conditionTypeId)
        )
        const nextConditions = [
          ...existingCharacterConditions,
          ...foldedApplications.after.conditionIds
            .filter((conditionId) => !existingCharacterConditionIds.has(conditionId))
            .map((conditionTypeId) => ({ conditionTypeId }))
        ]
        const targetTransitionBefore = foldedApplications.before
        const receiptApplications = foldedApplications.applications
        const hasPositiveDamage = receiptApplications.some(
          (application) => application.kind === 'DAMAGE' && application.appliedAmount > 0
        )
        if (
          (locked.encounter.automationMode === 'AUTOMATIC' ||
            locked.encounter.automationMode === 'ASSISTED') &&
          locked.concentration &&
          hasPositiveDamage &&
          receiptApplications.some(
            (application) => application.kind === 'CONDITION_APPLY' && application.applied
          )
        ) {
          throw new EncounterValidationError(
            'Automatic concentration cannot prospectively evaluate a condition applied by the same action.'
          )
        }
        const targetChanged = foldedApplications.stateChanged
        const createsActiveEffect = activeEffectPlan !== null
        const maintainedRemovalCharacterIds = new Set(
          (locked.maintainedReplacement?.dependents ?? []).flatMap((dependent) =>
            dependent.owner.startsWith('CHARACTER:')
              ? [dependent.owner.slice('CHARACTER:'.length)]
              : []
          )
        )
        const createdActiveEffects: Extract<
          ServerRuleExecutionApplicationOutputsDto,
          { kind: 'CHARACTER_MECHANICS_BATCH' }
        >['activeEffectTransitions'] = []
        let maintenanceTransition: Extract<
          ServerRuleExecutionApplicationOutputsDto,
          { kind: 'CHARACTER_MECHANICS_BATCH' }
        >['maintenanceTransition'] = null
        const currentActor = locked.encounter.actors.find(
          (actor) => actor.id === command.targetActorId
        )
        if (!currentActor)
          throw new EncounterConflictError('The Encounter Character actor is unavailable.')
        let currentActorConditions: z.infer<typeof encounterCharacterConditionsSchema> | null = null
        if (applications.some((outcome) => outcome.kind === 'CONDITION_APPLY')) {
          const parsedActorConditions = encounterCharacterConditionsSchema.safeParse(
            currentActor.conditions ?? []
          )
          if (!parsedActorConditions.success) {
            throw new EncounterConflictError('The Encounter Character condition mirror is stale.')
          }
          currentActorConditions = parsedActorConditions.data
        }
        const nextActorConditions = currentActorConditions ? [...currentActorConditions] : null
        if (nextActorConditions) {
          for (const application of receiptApplications) {
            if (application.kind !== 'CONDITION_APPLY' || !application.applied) continue
            if (
              nextActorConditions.some(
                (candidate) => candidate.conditionTypeId === application.conditionId
              )
            )
              continue
            const condition = nextConditions.find(
              (candidate) => candidate.conditionTypeId === application.conditionId
            )
            if (!condition)
              throw new EncounterConflictError('The Character condition state is unavailable.')
            const definition = locked!.targetConditionDefinitions?.find(
              (candidate) => candidate.id === condition.conditionTypeId
            )
            if (!definition)
              throw new EncounterConflictError('The Character condition definition is unavailable.')
            nextActorConditions.push({
              conditionTypeId: definition.id,
              label: definition.label,
              ...(definition.description ? { description: definition.description } : {})
            })
          }
        }
        let targetCharacterVersion: number | null = null
        let sourceCharacterVersion: number | null = null
        const postApplicationTarget = {
          mechanics: null as CharacterMechanicsProjection | null,
          overlay: null as {
            projectionChecksum: string
            mechanicalContextChecksum: string
          } | null,
          policyOutput: null as
            | Parameters<typeof resolveDnd5eConcentrationSaveFacts>[0]['rulePolicyOutput']
            | null
        }
        const finalCharacterActorVersions = new Map<string, number>()
        const maintainedCharacterOwnerVersions = new Map<
          string,
          { afterStreamVersion: number; beforeStreamVersion: number }
        >()
        const persistSourceResource = async (trx: DBLike, nextStreamVersion: number) => {
          if (!locked!.resourceConsumption) {
            const nextSourceMechanics = advanceCharacterMechanicsProjectionCommandState({
              characterCommandState: locked!.mechanics.commandState,
              characterStreamVersion: nextStreamVersion,
              current: locked!.mechanics
            })
            await createCharacterMechanicsProjectionRepository(trx).advanceLiveCommandState({
              expectedPriorProjectionChecksum: locked!.priorProjectionChecksum,
              expectedPriorStreamVersion: locked!.mechanics.characterStreamVersion,
              projection: nextSourceMechanics
            })
            await createCampaignCharacterMechanicsProjectionRepository(trx).publish({
              expectedPriorOverlayChecksum: locked!.overlay.projectionChecksum,
              projection: compileCampaignCharacterMechanicsProjection({
                campaignId: locked!.overlay.campaignId,
                characterId: locked!.characterId,
                characterStreamVersion: nextStreamVersion,
                baseMechanicsProjectionChecksum: nextSourceMechanics.projectionChecksum,
                mechanicalContextChecksum: locked!.overlay.mechanicalContextChecksum,
                manualMaximumModifierOwner: locked!.overlay.manualMaximumModifierOwner,
                ...(locked!.overlay.kind === 'MATERIALIZED'
                  ? {
                      rulePolicyInput: locked!.overlay.rulePolicyInput,
                      rulePolicyOutput: locked!.overlay.rulePolicyOutput
                    }
                  : {})
              })
            })
            return
          }
          await persistEncounterCharacterActionResourceConsumption({
            db: trx,
            actorUserId: command.actorUserId,
            characterId: locked!.characterId,
            consumption: locked!.resourceConsumption
          })
          const nextSourceMechanics = advanceCharacterMechanicsProjectionActionState({
            characterStreamVersion: nextStreamVersion,
            current: locked!.mechanics,
            rulePolicyInput: locked!.resourceConsumption.nextBaseState.facts,
            rulePolicyOutput: locked!.resourceConsumption.nextBaseState.output
          })
          await createCharacterMechanicsProjectionRepository(trx).advanceLiveCommandState({
            expectedPriorProjectionChecksum: locked!.priorProjectionChecksum,
            expectedPriorStreamVersion: locked!.mechanics.characterStreamVersion,
            projection: nextSourceMechanics
          })
          const nextSourceOverlay = compileCampaignCharacterMechanicsProjection({
            campaignId: locked!.overlay.campaignId,
            characterId: locked!.characterId,
            characterStreamVersion: nextStreamVersion,
            baseMechanicsProjectionChecksum: nextSourceMechanics.projectionChecksum,
            mechanicalContextChecksum: locked!.overlay.mechanicalContextChecksum,
            manualMaximumModifierOwner: locked!.overlay.manualMaximumModifierOwner,
            ...(locked!.overlay.kind === 'MATERIALIZED'
              ? {
                  rulePolicyInput:
                    locked!.resourceConsumption.nextOverlayState?.facts ??
                    locked!.overlay.rulePolicyInput,
                  rulePolicyOutput:
                    locked!.resourceConsumption.nextOverlayState?.output ??
                    locked!.overlay.rulePolicyOutput
                }
              : {})
          })
          await createCampaignCharacterMechanicsProjectionRepository(trx).publish({
            expectedPriorOverlayChecksum: locked!.overlay.projectionChecksum,
            projection: nextSourceOverlay
          })
        }
        const afterPersist = async (trx: DBLike, nextStreamVersion: number) => {
          targetCharacterVersion = nextStreamVersion
          finalCharacterActorVersions.set(locked!.targetCharacterId, nextStreamVersion)
          if (locked!.resourceConsumption && locked!.characterId === locked!.targetCharacterId) {
            await persistEncounterCharacterActionResourceConsumption({
              db: trx,
              actorUserId: command.actorUserId,
              characterId: locked!.characterId,
              consumption: locked!.resourceConsumption
            })
          }
          const nextCommandState = {
            ...locked!.targetMechanics.commandState,
            state: {
              ...locked!.targetMechanics.commandState.state,
              hitpoints: {
                ...locked!.targetMechanics.commandState.state.hitpoints,
                current: after,
                temp: afterTemporary
              },
              conditions: nextConditions
            }
          }
          const nextMechanics =
            locked!.resourceConsumption && locked!.characterId === locked!.targetCharacterId
              ? advanceCharacterMechanicsProjectionActionState({
                  characterStreamVersion: nextStreamVersion,
                  current: {
                    ...locked!.targetMechanics,
                    commandState: nextCommandState
                  },
                  rulePolicyInput: locked!.resourceConsumption.nextBaseState.facts,
                  rulePolicyOutput: locked!.resourceConsumption.nextBaseState.output
                })
              : advanceCharacterMechanicsProjectionCommandState({
                  characterCommandState: nextCommandState,
                  characterStreamVersion: nextStreamVersion,
                  current: locked!.targetMechanics
                })
          await createCharacterMechanicsProjectionRepository(trx).advanceLiveCommandState({
            expectedPriorProjectionChecksum: locked!.targetPriorProjectionChecksum,
            expectedPriorStreamVersion: locked!.targetMechanics.characterStreamVersion,
            projection: nextMechanics
          })
          const nextOverlay = compileCampaignCharacterMechanicsProjection({
            campaignId: locked!.targetOverlay.campaignId,
            characterId: locked!.targetCharacterId,
            characterStreamVersion: nextStreamVersion,
            baseMechanicsProjectionChecksum: nextMechanics.projectionChecksum,
            mechanicalContextChecksum: locked!.targetOverlay.mechanicalContextChecksum,
            manualMaximumModifierOwner: locked!.targetOverlay.manualMaximumModifierOwner,
            ...(locked!.targetOverlay.kind === 'MATERIALIZED'
              ? {
                  rulePolicyInput:
                    locked!.resourceConsumption && locked!.characterId === locked!.targetCharacterId
                      ? (locked!.resourceConsumption.nextOverlayState?.facts ??
                        locked!.targetOverlay.rulePolicyInput)
                      : locked!.targetOverlay.rulePolicyInput,
                  rulePolicyOutput:
                    locked!.resourceConsumption && locked!.characterId === locked!.targetCharacterId
                      ? (locked!.resourceConsumption.nextOverlayState?.output ??
                        locked!.targetOverlay.rulePolicyOutput)
                      : locked!.targetOverlay.rulePolicyOutput
                }
              : {})
          })
          await createCampaignCharacterMechanicsProjectionRepository(trx).publish({
            expectedPriorOverlayChecksum: locked!.targetOverlay.projectionChecksum,
            projection: nextOverlay
          })
          postApplicationTarget.mechanics = nextMechanics
          postApplicationTarget.overlay = nextOverlay
          postApplicationTarget.policyOutput =
            nextOverlay.kind === 'MATERIALIZED'
              ? nextOverlay.rulePolicyOutput
              : nextMechanics.rulePolicyOutput
          if (activeEffectPlan && terminalCompiledGraph) {
            const definition = activeRuleEffectDefinitionDtoSchema.parse({
              schemaVersion: 1,
              origin: {
                kind: 'ENCOUNTER',
                sourceAggregateId: locked!.encounter.id,
                sourceOccurrenceId: occurrenceId,
                rootCommandId: commandId,
                sourceActorId: locked!.sourceActor.id
              },
              authoredEffectId: activeEffectPlan.authoredEffectId,
              compiledEntryId: activeEffectPlan.compiledEntryId,
              frozenGraphNodeId: activeEffectPlan.frozenGraphNodeId,
              frozenGraph: terminalCompiledGraph,
              adapterFacts: activeEffectPlan.adapterFacts,
              perceptionContributions: activeEffectPlan.perceptionContributions,
              recurrence: {
                recurrenceStage: activeEffectPlan.recurrenceStage,
                consumeOnFirstEvent: null,
                endOnEvents: [],
                lifetimeScope: 'ENCOUNTER',
                expiration: {
                  kind: 'TICKS',
                  initialRemaining: activeEffectPlan.initialRemaining,
                  decrementStage: activeEffectPlan.recurrenceStage
                }
              }
            })
            const lifecycle = activeRuleEffectLifecycleDtoSchema.parse({
              schemaVersion: 1,
              remainingTicks: activeEffectPlan.initialRemaining
            })
            const activeEffects = createActiveRuleEffectRepository(trx)
            let maintainedEffectStateId: string | null = null
            if (activeEffectPlan.maintenance) {
              const plan = activeEffectPlan.maintenance
              const maintenanceDefinition = await createReusableDefinitionRepository(
                trx
              ).requireCurrent(plan.definitionId)
              if (
                maintenanceDefinition.gameSystemId !== locked!.encounter.gameSystemId ||
                (plan.definitionChecksum !== null &&
                  plan.definitionChecksum !== maintenanceDefinition.checksum)
              ) {
                throw new EncounterValidationError(
                  'The active-effect maintenance definition is no longer current.'
                )
              }
              const prior = await activeEffects.lockMaintainedState({
                encounterId: locked!.encounter.id,
                ownerActorId: locked!.sourceActor.id,
                maintenanceDefinitionId: plan.definitionId
              })
              const removed = prior
                ? await activeEffects.lockDependentEffects({
                    stateId: prior.id,
                    encounterId: locked!.encounter.id
                  })
                : []
              const lockedReplacement = locked!.maintainedReplacement
              const replacementSnapshot: MaintainedReplacementPreflight = {
                definitionChecksum: maintenanceDefinition.checksum,
                definitionId: plan.definitionId,
                dependents: removed.map(maintainedDependentSnapshot),
                prior: prior
                  ? {
                      id: prior.id,
                      version: prior.version,
                      descriptorChecksum: prior.descriptorChecksum
                    }
                  : null
              }
              if (
                !lockedReplacement ||
                !sameMaintainedReplacementPreflight(lockedReplacement, replacementSnapshot)
              )
                throw new EncounterConflictError(
                  'Maintained effect replacement changed before mutation.'
                )
              if (prior) {
                for (const effect of removed) {
                  await activeEffects.deleteCas({
                    id: effect.id,
                    owner: effect.owner,
                    expectedVersion: effect.version
                  })
                }
                await activeEffects.deleteMaintainedStateCas({
                  id: prior.id,
                  encounterId: locked!.encounter.id,
                  ownerActorId: locked!.sourceActor.id,
                  expectedVersion: prior.version
                })
              }
              const state = await activeEffects.createMaintainedState({
                id: serverUuidIdentityDtoSchema.parse(randomUUID()),
                encounterId: locked!.encounter.id,
                ownerActorId: locked!.sourceActor.id,
                descriptor: {
                  schemaVersion: 2,
                  maintenanceDefinitionId: plan.definitionId,
                  definitionChecksum: maintenanceDefinition.checksum,
                  sourceActionId: command.actionId,
                  sourceOccurrenceId: occurrenceId,
                  sourceActorId: locked!.sourceActor.id,
                  replacementPolicy: plan.replacementPolicy,
                  emptyDependentPolicy: plan.emptyDependentPolicy
                }
              })
              maintainedEffectStateId = state.id
              maintenanceTransition = {
                kind: 'REPLACE_SAME_DEFINITION',
                priorState: prior
                  ? {
                      id: prior.id,
                      version: prior.version,
                      maintenanceDefinitionId: prior.maintenanceDefinitionId,
                      descriptorChecksum: prior.descriptorChecksum,
                      sourceActionId: prior.descriptor.sourceActionId,
                      sourceOccurrenceId: prior.descriptor.sourceOccurrenceId,
                      sourceActorId: prior.descriptor.sourceActorId
                    }
                  : null,
                removedDependentEffects: removed.map((effect) => ({
                  ...(effect.owner.kind === 'CHARACTER'
                    ? {
                        kind: 'CHARACTER' as const,
                        characterId: effect.owner.characterId
                      }
                    : {
                        kind: 'ENCOUNTER_ACTOR' as const,
                        targetActorId: effect.owner.targetActorId
                      }),
                  activeEffectId: effect.id,
                  createdOrdinal: effect.createdOrdinal,
                  expectedVersion: effect.version,
                  definitionChecksum: effect.definitionChecksum,
                  lifecycleChecksum: effect.lifecycleChecksum
                })),
                createdState: {
                  id: state.id,
                  version: state.version,
                  maintenanceDefinitionId: state.maintenanceDefinitionId,
                  descriptorChecksum: state.descriptorChecksum,
                  definitionChecksum: maintenanceDefinition.checksum,
                  sourceActionId: command.actionId,
                  sourceOccurrenceId: occurrenceId,
                  sourceActorId: locked!.sourceActor.id
                },
                characterOwnerTransitions: [],
                createdDependentEffectIds: []
              }
            }
            const created = await activeEffects.create({
              id: serverUuidIdentityDtoSchema.parse((input.createActiveEffectId ?? randomUUID)()),
              owner: {
                kind: 'CHARACTER',
                characterId: locked!.targetCharacterId
              },
              definition,
              lifecycle,
              maintainedEffectStateId
            })
            if (maintenanceTransition) {
              maintenanceTransition = {
                ...maintenanceTransition,
                createdDependentEffectIds: [created.id]
              }
            }
            createdActiveEffects.push({
              kind: 'CREATE',
              activeEffectId: created.id,
              characterId: locked!.targetCharacterId,
              sourceEncounterId: locked!.encounter.id,
              createdOrdinal: created.createdOrdinal,
              afterVersion: created.version,
              authoredEffectId: created.definition.authoredEffectId,
              compiledEntryId: created.definition.compiledEntryId,
              frozenGraphNodeId: created.definition.frozenGraphNodeId,
              definitionChecksum: created.definitionChecksum,
              lifecycleChecksum: created.lifecycleChecksum,
              frozenSourceChecksum: created.definition.frozenGraph.source.checksum,
              capabilityContractVersion: created.definition.frozenGraph.capabilityContractVersion,
              recurrenceStage: activeEffectPlan.recurrenceStage,
              remainingTicks: activeEffectPlan.initialRemaining,
              maintainedEffectStateId
            })
          }
          const eventCommon = {
            type: 'CHARACTER_RULE_OUTCOME_APPLIED' as const,
            eventId: randomUUID(),
            characterId: locked!.targetCharacterId,
            occurredAt: new Date().toISOString(),
            actorId: command.actorUserId,
            commandId: occurrenceId,
            sourceCommandId: command.commandId,
            schemaVersion: 1,
            encounterId: locked!.encounter.id,
            occurrenceId,
            committedStreamVersion: nextStreamVersion,
            targetActorId: command.targetActorId
          }
          if (targetChanged) {
            const event: CharacterEvent = {
              ...eventCommon,
              applications: receiptApplications.map((application) =>
                application.kind === 'CONDITION_APPLY'
                  ? {
                      ordinal: application.ordinal,
                      outcome: application.kind,
                      conditionId: application.conditionId,
                      beforePresent: application.beforePresent,
                      afterPresent: application.afterPresent,
                      applied: application.applied
                    }
                  : application.kind === 'DAMAGE'
                    ? {
                        ordinal: application.ordinal,
                        outcome: application.kind,
                        appliedAmount: application.appliedAmount,
                        damageTypeId: application.damageTypeId
                      }
                    : {
                        ordinal: application.ordinal,
                        outcome: application.kind,
                        appliedAmount: application.appliedAmount
                      }
              )
            }
            await createCharacterEventRepository(trx).append(event)
          }
        }
        const finalizeEncounter = async (
          trx: DBLike,
          ruleReceipt: { occurrenceId: string; resultChecksum: string }
        ) => {
          const finalActors = locked!.encounter.actors.map((candidate) => {
            const actor =
              candidate.id === currentActor.id && targetCharacterVersion !== null
                ? {
                    ...candidate,
                    currentHitPoints: after,
                    tempHitPoints: afterTemporary,
                    maxHitPoints: locked!.targetMaximumHitPoints,
                    ...(nextActorConditions ? { conditions: nextActorConditions } : {})
                  }
                : candidate
            const finalCharacterVersion =
              actor.kind === 'CHARACTER' && actor.sourceId !== null
                ? finalCharacterActorVersions.get(actor.sourceId)
                : undefined
            return finalCharacterVersion === undefined
              ? actor
              : { ...actor, sourceRevision: finalCharacterVersion }
          })
          const encounterRepository = createEncounterRepository(trx)
          for (const actor of finalActors) {
            const priorActor = locked!.encounter.actors.find(
              (candidate) => candidate.id === actor.id
            )
            if (priorActor && JSON.stringify(priorActor) !== JSON.stringify(actor))
              await encounterRepository.updateActor(actor)
          }
          const nextEncounter = {
            ...locked!.encounter,
            version: proposedAggregateVersion,
            actors: finalActors
          }
          const snapshot = refreshEncounterActorRuleSnapshot(
            locked!.currentProjection.ruleSnapshot,
            nextEncounter
          )
          if (!snapshot)
            throw new EncounterConflictError('The Encounter projection rule identity is stale.')
          const nextProjection = compileEncounterCurrentProjection(
            projectGm(nextEncounter, snapshot.output),
            snapshot
          )
          await encounterRepository.publishCurrentProjection(nextProjection)
          await encounterRepository.appendEvent({
            id: randomUUID(),
            encounterId: nextEncounter.id,
            campaignId: nextEncounter.campaignId,
            version: proposedAggregateVersion,
            commandId,
            commandType: 'RESOLVE_RULE_ACTION',
            commandFingerprint,
            commandPayload: {
              actorId: command.actorId,
              actionId: command.actionId,
              targetActorId: command.targetActorId
            },
            resultPayload: encounterProjectionEventSchema.parse({
              command: {
                projection: projectGm(nextEncounter, snapshot.output),
                roll: null,
                resolution: null
              },
              currentProjection: nextProjection,
              ruleReceipt
            }) as unknown as Json,
            actorUserId: command.actorUserId,
            correlationId
          })
        }
        if (
          (locked.resourceConsumption || maintainedRemovalCharacterIds.has(locked.characterId)) &&
          locked.characterId !== locked.targetCharacterId
        ) {
          sourceCharacterVersion = await createCharacterRepository(transaction).patchSheetState(
            locked.characterId,
            [],
            {
              expectedStreamVersion: locked.mechanics.characterStreamVersion,
              afterPersist: persistSourceResource
            }
          )
          finalCharacterActorVersions.set(locked.characterId, sourceCharacterVersion)
        }
        if (
          targetChanged ||
          createsActiveEffect ||
          maintainedRemovalCharacterIds.has(locked.targetCharacterId) ||
          (locked.resourceConsumption && locked.characterId === locked.targetCharacterId)
        ) {
          await createCharacterRepository(transaction).patchSheetState(
            locked.targetCharacterId,
            [
              {
                kind: 'HITPOINTS',
                value: {
                  ...locked.targetMechanics.commandState.state.hitpoints,
                  current: after,
                  temp: afterTemporary
                }
              },
              { kind: 'CONDITIONS', value: nextConditions }
            ],
            {
              expectedStreamVersion: locked.targetMechanics.characterStreamVersion,
              afterPersist
            }
          )
        }
        for (const characterId of [...maintainedRemovalCharacterIds].sort()) {
          if (characterId === locked.characterId || characterId === locked.targetCharacterId)
            continue
          const removedOwner = await transaction
            .selectFrom('characters')
            .select(['id', 'stream_version', 'status'])
            .where('id', '=', characterId)
            .executeTakeFirst()
          if (!removedOwner || removedOwner.status !== 'ACTIVE')
            throw new EncounterConflictError('A maintained-effect Character owner is stale.')
          const removedMechanics = await createCharacterMechanicsProjectionRepository(
            transaction
          ).requireCurrent({
            characterId,
            expectedStreamVersion: removedOwner.stream_version
          })
          const removedContext = await resolveCharacterLiveSessionRuleContext(
            transaction,
            characterId,
            {
              id: locked.encounter.campaignId,
              attunementSlotOverride: locked.attunementSlotOverride
            }
          )
          if (!removedContext)
            throw new EncounterConflictError('A maintained-effect Character context is stale.')
          const removedOverlay = await createCampaignCharacterMechanicsProjectionRepository(
            transaction
          ).requireCurrent({
            campaignId: locked.encounter.campaignId,
            characterId,
            expectedBaseMechanicsProjectionChecksum: removedMechanics.projectionChecksum,
            expectedCharacterStreamVersion: removedOwner.stream_version,
            expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
              adjustments: removedContext.adjustments,
              attunementSlotOverride: removedContext.attunementSlotOverride
            }),
            expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
            baseMechanicsProjection: removedMechanics
          })
          const nextStreamVersion = await createCharacterRepository(transaction).patchSheetState(
            characterId,
            [],
            {
              expectedStreamVersion: removedOwner.stream_version,
              afterPersist: async (trx, nextStreamVersion) => {
                const nextMechanics = advanceCharacterMechanicsProjectionCommandState({
                  characterCommandState: removedMechanics.commandState,
                  characterStreamVersion: nextStreamVersion,
                  current: removedMechanics
                })
                await createCharacterMechanicsProjectionRepository(trx).advanceLiveCommandState({
                  expectedPriorProjectionChecksum: removedMechanics.projectionChecksum,
                  expectedPriorStreamVersion: removedMechanics.characterStreamVersion,
                  projection: nextMechanics
                })
                await createCampaignCharacterMechanicsProjectionRepository(trx).publish({
                  expectedPriorOverlayChecksum: removedOverlay.projectionChecksum,
                  projection: compileCampaignCharacterMechanicsProjection({
                    campaignId: removedOverlay.campaignId,
                    characterId,
                    characterStreamVersion: nextStreamVersion,
                    baseMechanicsProjectionChecksum: nextMechanics.projectionChecksum,
                    mechanicalContextChecksum: removedOverlay.mechanicalContextChecksum,
                    manualMaximumModifierOwner: removedOverlay.manualMaximumModifierOwner,
                    ...(removedOverlay.kind === 'MATERIALIZED'
                      ? {
                          rulePolicyInput: removedOverlay.rulePolicyInput,
                          rulePolicyOutput: removedOverlay.rulePolicyOutput
                        }
                      : {})
                  })
                })
              }
            }
          )
          maintainedCharacterOwnerVersions.set(characterId, {
            beforeStreamVersion: removedOwner.stream_version,
            afterStreamVersion: nextStreamVersion
          })
          const encounterActor = locked.encounter.actors.find(
            (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === characterId
          )
          if (encounterActor) finalCharacterActorVersions.set(characterId, nextStreamVersion)
        }
        for (const characterId of maintainedRemovalCharacterIds) {
          const beforeStreamVersion =
            characterId === locked.characterId
              ? locked.mechanics.characterStreamVersion
              : characterId === locked.targetCharacterId
                ? locked.targetMechanics.characterStreamVersion
                : maintainedCharacterOwnerVersions.get(characterId)?.beforeStreamVersion
          const afterStreamVersion =
            characterId === locked.characterId
              ? (sourceCharacterVersion ?? targetCharacterVersion)
              : characterId === locked.targetCharacterId
                ? targetCharacterVersion
                : maintainedCharacterOwnerVersions.get(characterId)?.afterStreamVersion
          if (!beforeStreamVersion || !afterStreamVersion)
            throw new EncounterConflictError(
              'A maintained-effect Character version is unavailable.'
            )
          maintainedCharacterOwnerVersions.set(characterId, {
            beforeStreamVersion,
            afterStreamVersion
          })
        }
        // The parent receipt records only its own base action transitions.
        // Concentration cleanup below is a separate child occurrence and may
        // subsequently advance these mutable versions for Encounter mirrors.
        const baseSourceCharacterVersion = sourceCharacterVersion
        const baseTargetCharacterVersion = targetCharacterVersion
        // Concentration is a child receipt: parent applications have already
        // committed their Character state, while child failure cleanup records
        // its own exact intermediate-to-final transitions.
        if (
          (locked.encounter.automationMode === 'AUTOMATIC' ||
            locked.encounter.automationMode === 'ASSISTED') &&
          locked.concentration
        ) {
          const damageApplications = receiptApplications
            .filter(
              (application): application is Extract<typeof application, { kind: 'DAMAGE' }> =>
                application.kind === 'DAMAGE' && application.appliedAmount > 0
            )
            .map((application) => ({
              ordinal: application.ordinal,
              sourceNodeId: application.sourceNodeId,
              sourceOperationKey: application.sourceOperationKey,
              targetActorId: command.targetActorId,
              appliedAmount: application.appliedAmount,
              damageTypeId: application.damageTypeId
            }))
          if (damageApplications.length > 0) {
            if (
              !postApplicationTarget.mechanics ||
              !postApplicationTarget.overlay ||
              !postApplicationTarget.policyOutput
            )
              throw new EncounterConflictError(
                'The post-application Character policy is unavailable for concentration.'
              )
            const damageEnvelopeChecksum = checksumRuleDocument(damageApplications)
            const activeEffects = createActiveRuleEffectRepository(transaction)
            const currentState = await activeEffects.lockMaintainedStateById({
              encounterId: locked.encounter.id,
              stateId: locked.concentration.id
            })
            const currentDependents = currentState
              ? await activeEffects.lockDependentEffects({
                  stateId: currentState.id,
                  encounterId: locked.encounter.id
                })
              : []
            const currentConcentration = currentState
              ? {
                  id: currentState.id,
                  version: currentState.version,
                  ownerActorId: currentState.ownerActorId,
                  maintenanceDefinitionId: currentState.maintenanceDefinitionId,
                  descriptorChecksum: currentState.descriptorChecksum,
                  dependents: currentDependents.map(maintainedDependentSnapshot)
                }
              : null
            if (
              !currentConcentration ||
              !sameConcentrationPreflight(locked.concentration, currentConcentration)
            )
              throw new EncounterConflictError(
                'Concentration state changed before child execution.'
              )
            const currentDefinition = await createReusableDefinitionRepository(
              transaction
            ).requireCurrent(DND5E_CONCENTRATION_CHECK_DEFINITION_ID)
            if (
              currentDefinition.gameSystemId !== locked.encounter.gameSystemId ||
              currentDefinition.gameSystemId !== locked.targetVocabularySnapshot.systemId
            )
              throw new EncounterValidationError(
                'The concentration check definition is unavailable.'
              )
            const concentrationPublished = serverPublishedRuleDefinitionDtoSchema.parse({
              id: currentDefinition.id,
              gameSystemId: currentDefinition.gameSystemId,
              definitionFamilyKey: currentDefinition.definitionFamilyKey,
              checksum: currentDefinition.checksum,
              definition: currentDefinition.document
            })
            const concentrationAbilityBindings =
              concentrationPublished.definition.vocabularyBindings ?? []
            if (
              concentrationAbilityBindings.length !== 1 ||
              concentrationAbilityBindings[0]?.kind !== 'ABILITY' ||
              concentrationAbilityBindings[0].definitionId !==
                DND5E_CONSTITUTION_ABILITY_DEFINITION_ID ||
              !('abilities' in locked.targetVocabularySnapshot.document) ||
              !locked.targetVocabularySnapshot.document.abilities.some(
                (ability) => ability.id === concentrationAbilityBindings[0]?.definitionId
              )
            ) {
              throw new EncounterValidationError(
                'The concentration check saving-throw ability is not present in the pinned System vocabulary.'
              )
            }
            const concentrationAuditPins = {
              concentrationDefinition: {
                id: concentrationPublished.id,
                checksum: concentrationPublished.checksum
              },
              savingThrowAbilityDefinitionId: concentrationAbilityBindings[0].definitionId,
              systemVocabularySnapshot: {
                id: locked.targetVocabularySnapshot.snapshotId,
                version: locked.targetVocabularySnapshot.snapshotVersion,
                checksum: locked.targetVocabularySnapshot.checksum
              },
              targetCharacter: {
                streamVersion: postApplicationTarget.mechanics.characterStreamVersion,
                baseProjectionChecksum: postApplicationTarget.mechanics.projectionChecksum,
                campaignOverlayChecksum: postApplicationTarget.overlay.projectionChecksum,
                mechanicalContextChecksum: postApplicationTarget.overlay.mechanicalContextChecksum
              }
            } as const
            let concentrationEnded = false
            for (const [index, application] of damageApplications.entries()) {
              if (concentrationEnded) continue
              const saveFacts = resolveDnd5eConcentrationSaveFacts({
                targetActorId: application.targetActorId,
                appliedDamage: application.appliedAmount,
                rulePolicyOutput: postApplicationTarget.policyOutput
              })
              const concentrationContext = {
                concentrationDefinition: concentrationAuditPins.concentrationDefinition,
                savingThrowAbilityDefinitionId:
                  concentrationAuditPins.savingThrowAbilityDefinitionId,
                systemVocabularySnapshot: concentrationAuditPins.systemVocabularySnapshot,
                targetCharacter: concentrationAuditPins.targetCharacter,
                modifier: saveFacts.modifier,
                rollMode: saveFacts.rollMode,
                contributors: [...saveFacts.contributors],
                contributorChecksum: saveFacts.contributorChecksum,
                maintainedState: {
                  id: lockedAction.concentration!.id,
                  version: lockedAction.concentration!.version,
                  maintenanceDefinitionId: lockedAction.concentration!.maintenanceDefinitionId,
                  descriptorChecksum: lockedAction.concentration!.descriptorChecksum
                },
                finalizedDamageApplication: {
                  ...application,
                  maintainedStateId: lockedAction.concentration!.id
                },
                finalizedDamageEnvelopeChecksum: damageEnvelopeChecksum
              }
              const concentrationContextChecksum = checksumRuleDocument(concentrationContext)
              const childOccurrenceId = concentrationChildIdentity({
                parentOccurrenceId: occurrenceId,
                ...application
              })
              const childCommandId = uuidv5(
                `${childOccurrenceId}:command`,
                DND5E_CONCENTRATION_OCCURRENCE_NAMESPACE
              )
              let requestId: string | null = null
              let rawFaces: number[] = []
              if (locked.encounter.automationMode === 'ASSISTED') {
                const child = await createRuleExecutionOccurrenceService({
                  db: transaction,
                  runtime,
                  createOccurrenceId: () => childOccurrenceId
                }).executeResolved(
                  lockedEncounterContext!.context.createReceiptOnlyChildOccurrencePort(),
                  {
                    commandId: childCommandId,
                    correlationId:
                      index === 0
                        ? occurrenceId
                        : concentrationChildIdentity({
                            parentOccurrenceId: occurrenceId,
                            ...damageApplications[index - 1]!
                          }),
                    expectedAggregateVersion: proposedAggregateVersion,
                    intent: {
                      parentOccurrenceId: occurrenceId,
                      applicationOrdinal: application.ordinal,
                      applicationIndex: index,
                      damageEnvelopeChecksum,
                      concentrationContextChecksum
                    },
                    allowPaused: true,
                    async resolve() {
                      return {
                        published: concentrationPublished,
                        facts: saveFacts.facts,
                        allowPaused: true,
                        pendingApplicationContext: {
                          kind: 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' as const,
                          schemaVersion: 1 as const,
                          parentOccurrenceId: occurrenceId,
                          parentCommandFingerprint: commandFingerprint,
                          finalizedDamageEnvelopeChecksum: damageEnvelopeChecksum,
                          application,
                          maintainedState: {
                            id: lockedAction.concentration!.id,
                            version: lockedAction.concentration!.version,
                            maintenanceDefinitionId:
                              lockedAction.concentration!.maintenanceDefinitionId,
                            descriptorChecksum: lockedAction.concentration!.descriptorChecksum
                          },
                          concentrationDefinition: concentrationAuditPins.concentrationDefinition,
                          save: {
                            savingThrowAbilityDefinitionId:
                              concentrationAuditPins.savingThrowAbilityDefinitionId,
                            modifier: saveFacts.modifier,
                            rollMode: saveFacts.rollMode,
                            contributors: [...saveFacts.contributors],
                            contributorChecksum: saveFacts.contributorChecksum
                          },
                          targetCharacter: concentrationAuditPins.targetCharacter,
                          systemVocabularySnapshot: concentrationAuditPins.systemVocabularySnapshot,
                          contextChecksum: concentrationContextChecksum,
                          remaining: damageApplications.slice(index + 1).map((remaining) => ({
                            ...remaining,
                            maintainedStateId: lockedAction.concentration!.id
                          }))
                        }
                      }
                    }
                  }
                )
                if (child.status !== 'PAUSED')
                  throw new EncounterConflictError(
                    'Assisted concentration did not create a pending occurrence.'
                  )
                const persistedChild = await createRuleOccurrenceRepository(
                  transaction
                ).lockOccurrence(
                  'ENCOUNTER',
                  lockedEncounterContext!.context.encounterId,
                  child.occurrenceId
                )
                if (!persistedChild) {
                  throw new EncounterConflictError(
                    'Assisted concentration child was not persisted.'
                  )
                }
                const recipientContext = lockedEncounterContext?.context
                const recipientEncounter = receiptSourceContext.encounter
                if (!recipientContext || !recipientEncounter) {
                  throw new EncounterConflictError('Encounter command context was not locked.')
                }
                assistedConcentrationPending =
                  summarizePendingEncounterConcentrationOccurrenceForRecipient({
                    actorUserId: recipientContext.actorUserId,
                    assignments: lockedCharacterAssignments,
                    encounter: recipientEncounter,
                    encounterVersion: proposedAggregateVersion,
                    occurrence: persistedChild,
                    role: recipientContext.role,
                    assignedCharacterId: recipientContext.assignedCharacterId
                  })
                concentrationEnded = true
                continue
              }
              const child = await createRuleExecutionOccurrenceService({
                db: transaction,
                runtime,
                createOccurrenceId: () => childOccurrenceId
              }).executeResolved(
                lockedEncounterContext!.context.createReceiptOnlyChildOccurrencePort(),
                {
                  commandId: childCommandId,
                  correlationId:
                    index === 0
                      ? occurrenceId
                      : concentrationChildIdentity({
                          parentOccurrenceId: occurrenceId,
                          ...damageApplications[index - 1]!
                        }),
                  expectedAggregateVersion: proposedAggregateVersion,
                  intent: {
                    parentOccurrenceId: occurrenceId,
                    applicationOrdinal: application.ordinal,
                    applicationIndex: index,
                    damageEnvelopeChecksum,
                    concentrationContextChecksum
                  },
                  allowPaused: false,
                  async resolve() {
                    return {
                      published: concentrationPublished,
                      facts: saveFacts.facts,
                      allowPaused: false
                    }
                  },
                  resolveAutomaticEvidence: async ({ request }) => {
                    if (request.kind !== 'INTEGER_RANGE' || request.min !== 1 || request.max !== 20)
                      throw new EncounterValidationError(
                        'The concentration check issued an invalid roll.'
                      )
                    const roll = input.rollD20 ?? (() => randomInt(1, 21))
                    rawFaces = saveFacts.rollMode === 'NORMAL' ? [roll()] : [roll(), roll()]
                    if (
                      rawFaces.some((value) => !Number.isInteger(value) || value < 1 || value > 20)
                    )
                      throw new EncounterValidationError('The concentration check roll is invalid.')
                    requestId = request.requestId
                    return {
                      requestId: request.requestId,
                      value:
                        saveFacts.rollMode === 'ADVANTAGE'
                          ? Math.max(...rawFaces)
                          : saveFacts.rollMode === 'DISADVANTAGE'
                            ? Math.min(...rawFaces)
                            : rawFaces[0]!
                    }
                  },
                  completionApplicator: {
                    requiresAggregateAdvance: () => false,
                    async apply({ execution: concentrationExecution, occurrenceId: childId }) {
                      const selectedNatural = rawFaces.length
                        ? saveFacts.rollMode === 'ADVANTAGE'
                          ? Math.max(...rawFaces)
                          : saveFacts.rollMode === 'DISADVANTAGE'
                            ? Math.min(...rawFaces)
                            : rawFaces[0]!
                        : null
                      const dc = concentrationExecution.outputs.dc
                      const total = concentrationExecution.outputs.total
                      const resultPath = concentrationExecution.outputs.resultPath
                      if (
                        !requestId ||
                        selectedNatural === null ||
                        typeof dc !== 'number' ||
                        !Number.isInteger(dc) ||
                        typeof total !== 'number' ||
                        !Number.isInteger(total) ||
                        total !== selectedNatural + saveFacts.modifier ||
                        (resultPath !== 'ON_SAVE_SUCCESS' && resultPath !== 'ON_SAVE_FAIL')
                      )
                        throw new EncounterValidationError(
                          'The concentration check evidence is invalid.'
                        )
                      if (
                        concentrationExecution.evidence.source.definitionId !==
                          concentrationAuditPins.concentrationDefinition.id ||
                        concentrationExecution.evidence.source.checksum !==
                          concentrationAuditPins.concentrationDefinition.checksum ||
                        checksumRuleDocument(concentrationContext) !== concentrationContextChecksum
                      )
                        throw new EncounterValidationError(
                          'The concentration check context is invalid.'
                        )
                      try {
                        validateDnd5eConcentrationContributors(
                          saveFacts.contributors,
                          saveFacts.contributorChecksum
                        )
                      } catch {
                        throw new EncounterValidationError(
                          'The concentration check contributor evidence is invalid.'
                        )
                      }
                      const validatedDc = dc
                      const validatedTotal = total
                      if (resultPath === 'ON_SAVE_SUCCESS') {
                        return {
                          kind: 'CONCENTRATION_CHECK' as const,
                          schemaVersion: 1 as const,
                          occurrenceId: childId,
                          parentOccurrenceId: occurrenceId,
                          ...concentrationAuditPins,
                          contextChecksum: concentrationContextChecksum,
                          application: {
                            ...application,
                            maintainedStateId: lockedAction.concentration!.id
                          },
                          outcome: 'SAVE_SUCCESS' as const,
                          d20: {
                            requestId,
                            rollMode: saveFacts.rollMode,
                            rawFaces,
                            selectedNatural,
                            modifier: saveFacts.modifier,
                            total: validatedTotal,
                            dc: validatedDc,
                            contributors: [...saveFacts.contributors],
                            contributorChecksum: saveFacts.contributorChecksum
                          },
                          cleanup: null,
                          nextOccurrenceId:
                            index + 1 < damageApplications.length
                              ? concentrationChildIdentity({
                                  parentOccurrenceId: occurrenceId,
                                  ...damageApplications[index + 1]!
                                })
                              : null,
                          skipped: []
                        }
                      }
                      const cleanup = await cleanupConcentrationMaintainedState({
                        db: transaction,
                        encounter: lockedAction.encounter,
                        attunementSlotOverride: lockedAction.attunementSlotOverride,
                        concentration: lockedAction.concentration!
                      })
                      for (const [
                        characterId,
                        afterStreamVersion
                      ] of cleanup.characterActorVersions) {
                        if (characterId === lockedAction.characterId)
                          sourceCharacterVersion = afterStreamVersion
                        if (characterId === lockedAction.targetCharacterId)
                          targetCharacterVersion = afterStreamVersion
                        finalCharacterActorVersions.set(characterId, afterStreamVersion)
                      }
                      return {
                        kind: 'CONCENTRATION_CHECK' as const,
                        schemaVersion: 1 as const,
                        occurrenceId: childId,
                        parentOccurrenceId: occurrenceId,
                        ...concentrationAuditPins,
                        contextChecksum: concentrationContextChecksum,
                        application: {
                          ...application,
                          maintainedStateId: cleanup.maintainedStateId
                        },
                        outcome: 'SAVE_FAILURE' as const,
                        d20: {
                          requestId,
                          rollMode: saveFacts.rollMode,
                          rawFaces,
                          selectedNatural,
                          modifier: saveFacts.modifier,
                          total: validatedTotal,
                          dc: validatedDc,
                          contributors: [...saveFacts.contributors],
                          contributorChecksum: saveFacts.contributorChecksum
                        },
                        cleanup: {
                          maintainedStateId: cleanup.maintainedStateId,
                          removedDependentEffectIds: cleanup.removedDependentEffectIds,
                          characterOwnerTransitions: cleanup.characterOwnerTransitions
                        },
                        nextOccurrenceId: null,
                        skipped: damageApplications.slice(index + 1).map((remaining) => ({
                          ...remaining,
                          maintainedStateId: cleanup.maintainedStateId,
                          reason: 'MAINTAINED_STATE_ENDED' as const
                        }))
                      }
                    }
                  }
                }
              )
              if (child.status !== 'COMPLETE')
                throw new EncounterConflictError('Automatic concentration did not complete.')
              if (child.applicationOutputs.kind !== 'CONCENTRATION_CHECK')
                throw new EncounterConflictError('Concentration child receipt is invalid.')
              if (child.applicationOutputs.outcome === 'SAVE_FAILURE') concentrationEnded = true
            }
          }
        }
        const terminalResult = requireValidCharacterRuleActionReceipt(
          {
            kind: 'CHARACTER_MECHANICS_BATCH',
            schemaVersion: 1,
            occurrenceId,
            sourceActorId: locked.sourceActor.id,
            sourceCharacterId: locked.characterId,
            targetActorId: command.targetActorId,
            sourceCharacterStreamVersion: baseSourceCharacterVersion,
            targetCharacterStreamVersion: baseTargetCharacterVersion,
            resourceConsumption: locked.resourceConsumption
              ? {
                  poolId: locked.resourceConsumption.poolId,
                  chargeId: locked.resourceConsumption.chargeId,
                  cost: locked.resourceConsumption.cost,
                  beforeUsed: locked.resourceConsumption.beforeUsed,
                  afterUsed: locked.resourceConsumption.afterUsed,
                  beforeRemaining: locked.resourceConsumption.beforeRemaining,
                  afterRemaining: locked.resourceConsumption.afterRemaining
                }
              : null,
            activeEffectTransitions: createdActiveEffects,
            maintenanceTransition: maintenanceTransition
              ? Object.assign({}, maintenanceTransition, {
                  characterOwnerTransitions: [...maintainedCharacterOwnerVersions]
                    .sort(([left], [right]) => left.localeCompare(right))
                    .map(([characterId, transition]) => ({
                      characterId,
                      beforeStreamVersion: transition.beforeStreamVersion,
                      afterStreamVersion: transition.afterStreamVersion
                    }))
                })
              : null,
            d20,
            targetTransition: {
              checksum: checksumRuleDocument({
                targetActorId: command.targetActorId,
                ...targetTransitionBefore
              }),
              before: targetTransitionBefore,
              after: {
                currentHitPoints: after,
                temporaryHitPoints: afterTemporary,
                maximumHitPoints: locked.targetMaximumHitPoints,
                conditionIds: nextConditions.map((condition) => condition.conditionTypeId)
              }
            },
            applications: receiptApplications
          },
          occurrenceId,
          pendingApplicationContext.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION'
            ? pendingApplicationContext.targetActorId
            : command.targetActorId,
          locked.characterId,
          execution,
          phaseReceipts,
          'FRESH'
        )
        receiptSourceContext.sourceCharacterId = locked.characterId
        return {
          applicationOutputs: terminalResult,
          afterResult: async (result: StoredRuleExecutionResultDto) => {
            await finalizeEncounter(transaction, {
              occurrenceId,
              resultChecksum: checksumStoredRuleExecutionResult(result)
            })
          }
        }
      }
    }
  }
  const { completionApplicator, ...executionCommand } = actionExecution
  const occurrences = createRuleExecutionOccurrenceService({
    db,
    runtime,
    completionApplicator,
    replayValidator: async ({ aggregate, commandId, db: transaction, receipt, result }) => {
      if (
        result.status !== 'COMPLETE' ||
        result.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH'
      )
        return
      const sourceCharacterId = result.applicationOutputs.sourceCharacterId
      if (!sourceCharacterId)
        throw new EncounterValidationError(
          'Stored Character rule-action source identity is invalid.'
        )
      receiptSourceContext.sourceCharacterId = sourceCharacterId
      requireValidCharacterRuleActionReceipt(
        result.applicationOutputs,
        result.occurrenceId,
        null,
        sourceCharacterId,
        result,
        result.phaseReceipts,
        'STORED'
      )
      if (!aggregate.campaignId)
        throw new EncounterConflictError('Encounter rule-action replay has no Campaign binding.')
      const event = await createEncounterRepository(transaction).findEventByCampaignCommand(
        aggregate.campaignId,
        commandId
      )
      let validEventEnvelope = false
      if (event) {
        try {
          encounterProjectionEventSchema.parse(event.resultPayload)
          validEventEnvelope = true
        } catch {
          validEventEnvelope = false
        }
      }
      if (
        !event ||
        event.encounterId !== aggregate.aggregateId ||
        event.commandType !== 'RESOLVE_RULE_ACTION' ||
        event.commandFingerprint !== receipt.commandFingerprint ||
        event.version !== receipt.aggregateVersion ||
        !validEventEnvelope ||
        (event.resultPayload as { ruleReceipt?: { occurrenceId?: string } }).ruleReceipt
          ?.occurrenceId !== result.occurrenceId ||
        (event.resultPayload as { ruleReceipt?: { resultChecksum?: string } }).ruleReceipt
          ?.resultChecksum !== checksumStoredRuleExecutionResult(result)
      )
        throw new EncounterConflictError('Encounter rule-action replay receipt is invalid.')
    }
  })
  const result = input.resume
    ? await occurrences.resume(aggregatePort, {
        commandId: command.commandId,
        correlationId: command.correlationId,
        expectedAggregateVersion: command.expectedEncounterVersion,
        occurrenceId: serverUuidIdentityDtoSchema.parse(input.resume.occurrenceId),
        expectedOccurrenceVersion: input.resume.expectedOccurrenceVersion,
        resolutionIntent: assistedCharacterRuleActionResolutionDtoSchema.parse(
          input.resume.resolution
        ),
        resolve: executionCommand.resolve,
        async deriveResponse({ applicationContext, resolutionIntent, request }) {
          const resolution = assistedCharacterRuleActionResolutionDtoSchema.parse(resolutionIntent)
          if (
            applicationContext.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION' &&
            applicationContext.twoPhase?.phase === 'OUTCOME'
          ) {
            if (request.kind !== 'INTEGER_RANGE' || request.min >= request.max) {
              throw new EncounterValidationError('The pending Character action outcome is invalid.')
            }
            if (resolution.kind === 'SYSTEM_OUTCOME') {
              if (
                resolution.requestIds.length !== 1 ||
                resolution.requestIds[0] !== request.requestId
              ) {
                throw new EncounterValidationError(
                  'The Character action outcome roll request set does not match.'
                )
              }
              const value = input.rollInteger
                ? input.rollInteger(request.min, request.max)
                : randomInt(request.min, request.max + 1)
              if (!Number.isSafeInteger(value) || value < request.min || value > request.max) {
                throw new EncounterValidationError('The Character action outcome roll is invalid.')
              }
              return { requestId: request.requestId, value }
            }
            if (resolution.kind === 'PHYSICAL_OUTCOME') {
              if (
                resolution.values.length !== 1 ||
                resolution.values[0]?.requestId !== request.requestId ||
                resolution.values[0].value < request.min ||
                resolution.values[0].value > request.max
              ) {
                throw new EncounterValidationError(
                  'The Character action outcome roll request set does not match.'
                )
              }
              return resolution.values[0]
            }
            throw new EncounterValidationError(
              'The pending Character action roll does not match its phase.'
            )
          }
          if (
            applicationContext.kind !== 'ENCOUNTER_CHARACTER_RULE_ACTION' ||
            !applicationContext.d20 ||
            request.kind !== 'INTEGER_RANGE' ||
            request.min !== 1 ||
            request.max !== 20 ||
            !automaticD20RollMode ||
            !automaticD20Audit
          ) {
            throw new EncounterValidationError(
              'The pending Character rule action issued an invalid roll.'
            )
          }
          if (resolution.kind !== 'SYSTEM' && resolution.kind !== 'PHYSICAL') {
            throw new EncounterValidationError(
              'The pending Character rule action roll does not match its phase.'
            )
          }
          if (resolution.requestId !== request.requestId) {
            throw new EncounterValidationError(
              'The pending Character rule action roll request does not match.'
            )
          }
          const expectedFaces = applicationContext.d20.rollMode === 'NORMAL' ? 1 : 2
          const roll = input.rollD20 ?? (() => randomInt(1, 21))
          const rawFaces =
            resolution.kind === 'SYSTEM'
              ? Array.from({ length: expectedFaces }, () => roll())
              : resolution.rawFaces
          if (
            rawFaces.length !== expectedFaces ||
            rawFaces.some((value) => !Number.isSafeInteger(value) || value < 1 || value > 20) ||
            automaticD20RollMode !== applicationContext.d20.rollMode ||
            automaticD20Audit.contributorChecksum !== applicationContext.d20.contributorChecksum
          ) {
            throw new EncounterValidationError('The pending Character rule action roll is invalid.')
          }
          const value =
            automaticD20RollMode === 'ADVANTAGE'
              ? Math.max(...rawFaces)
              : automaticD20RollMode === 'DISADVANTAGE'
                ? Math.min(...rawFaces)
                : rawFaces[0]!
          automaticD20RawFaces = rawFaces
          automaticD20RequestId = request.requestId
          return { requestId: request.requestId, value }
        }
      })
    : await occurrences.executeResolved(aggregatePort, executionCommand)
  if (result.status === 'PAUSED') {
    if (result.pending?.kind === 'INTEGER_RANGE_EVIDENCE' && result.pending.phase === 'OUTCOME') {
      return {
        status: 'PENDING',
        occurrenceId: result.occurrenceId,
        occurrenceVersion: result.occurrenceVersion,
        phase: 'OUTCOME',
        requests: result.pending.requests,
        controls: ['SYSTEM_OUTCOME', 'PHYSICAL_OUTCOME']
      }
    }
    if (
      !automaticD20RollMode ||
      result.request.kind !== 'INTEGER_RANGE' ||
      result.request.min !== 1 ||
      result.request.max !== 20
    ) {
      throw new EncounterValidationError('The Character rule action issued an unsupported roll.')
    }
    return {
      status: 'PENDING',
      occurrenceId: result.occurrenceId,
      occurrenceVersion: result.occurrenceVersion,
      request: {
        requestId: result.request.requestId,
        min: result.request.min,
        max: result.request.max
      },
      rollMode: automaticD20RollMode,
      controls: ['SYSTEM', 'PHYSICAL']
    }
  }
  if (result.status === 'MANUAL') {
    return {
      status: 'MANUAL',
      occurrenceId: result.occurrenceId,
      reminder: result.reminder
    }
  }
  if (result.status !== 'COMPLETE') {
    throw new EncounterValidationError(
      'A turn-effect receipt cannot be used as a Character rule-action result.'
    )
  }
  if (result.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH')
    throw new EncounterValidationError(
      'A completed Character rule action has invalid application outputs.'
    )
  const sourceCharacterId = receiptSourceContext.sourceCharacterId
  let verifiedSourceCharacterId: string
  if (sourceCharacterId) verifiedSourceCharacterId = sourceCharacterId
  else {
    if (!result.applicationOutputs.sourceCharacterId)
      throw new EncounterValidationError(
        'A completed Character rule action has no source identity.'
      )
    verifiedSourceCharacterId = result.applicationOutputs.sourceCharacterId
  }
  const outputs = requireValidCharacterRuleActionReceipt(
    result.applicationOutputs,
    result.occurrenceId,
    input.resume ? null : command.targetActorId,
    verifiedSourceCharacterId,
    result,
    result.phaseReceipts,
    'STORED'
  )
  return {
    status: 'COMPLETE',
    occurrenceId: result.occurrenceId,
    pending: assistedConcentrationPending,
    applications: outputs.applications.map((application) =>
      application.kind === 'CONDITION_APPLY'
        ? {
            ordinal: application.ordinal,
            outcomeKind: application.kind,
            conditionId: application.conditionId,
            applied: application.applied
          }
        : {
            ordinal: application.ordinal,
            outcomeKind: application.kind,
            appliedAmount: application.appliedAmount
          }
    )
  }
}

/** Resumes a sealed Assisted action without accepting client-supplied action or target identity. */
export async function resumeEncounterCharacterRuleAction(input: {
  db: DBLike
  runtime: RulesRuntimeService
  command: ResumeEncounterCharacterRuleActionInput
  /** Test-only deterministic d20 source. Production uses node:crypto. */
  rollD20?: () => number
  /** Test-only bounded integer source for a specialized OUTCOME graph. */
  rollInteger?: (min: number, max: number) => number
}): Promise<EncounterCharacterRuleActionResult> {
  const { command } = input
  return executeEncounterCharacterRuleAction({
    db: input.db,
    runtime: input.runtime,
    rollD20: input.rollD20,
    rollInteger: input.rollInteger,
    command: {
      actionId: 'pending-action',
      actorId: '00000000-0000-4000-8000-000000000000',
      actorUserId: command.actorUserId,
      commandId: command.commandId,
      correlationId: command.correlationId,
      encounterId: command.encounterId,
      expectedEncounterVersion: command.expectedEncounterVersion,
      liveSessionAuthority: command.liveSessionAuthority,
      targetActorId: '00000000-0000-4000-8000-000000000000',
      sceneContext: null
    },
    resume: {
      occurrenceId: command.occurrenceId,
      expectedOccurrenceVersion: command.expectedOccurrenceVersion,
      resolution: command.resolution
    }
  })
}

export interface ResolveEncounterConcentrationRuleOccurrenceInput {
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

export interface ResolveEncounterConcentrationRuleOccurrenceResult {
  result: StoredRuleExecutionResultDto
  projection: EncounterCurrentProjection
  role: 'OWNER' | 'PLAYER'
  pending: PendingEncounterRuleOccurrenceSummaryDto | null
  replayed: boolean
}

function summarizePendingEncounterConcentrationOccurrence(
  occurrence: RuleOccurrenceRecord,
  encounterVersion: number
): PendingEncounterRuleOccurrenceSummaryDto | null {
  const snapshot = occurrence.pendingSnapshot
  if (
    occurrence.state !== 'PENDING' ||
    !snapshot ||
    !isServerKernelRuleExecutionPendingSnapshot(snapshot) ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' ||
    snapshot.request.kind !== 'INTEGER_RANGE' ||
    snapshot.request.min !== 1 ||
    snapshot.request.max !== 20
  ) {
    return null
  }
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'D20_EVIDENCE',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion,
    request: {
      requestId: snapshot.request.requestId,
      min: snapshot.request.min,
      max: snapshot.request.max,
      rollMode: snapshot.applicationContext.save.rollMode
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
  })
}

async function lockEncounterCharacterAssignments(input: {
  db: DBLike
  campaignId: string
  encounter: EncounterRecord
}): Promise<ReadonlyMap<string, string>> {
  const characterIds = input.encounter.actors
    .flatMap((actor) => (actor.kind === 'CHARACTER' && actor.sourceId ? [actor.sourceId] : []))
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort()
  const assignments = new Map<string, string>()
  for (const characterId of characterIds) {
    const assignment = await sql<{ user_id: string }>`
      select user_id from public.campaign_character_assignments
      where campaign_id = ${input.campaignId} and character_id = ${characterId}
      for update
    `.execute(input.db)
    if (assignment.rows[0]) assignments.set(characterId, assignment.rows[0].user_id)
  }
  return assignments
}

function summarizePendingEncounterConcentrationOccurrenceForRecipient(input: {
  actorUserId: string
  assignedCharacterId: string | null
  assignments: ReadonlyMap<string, string>
  encounter: EncounterRecord
  encounterVersion: number
  occurrence: RuleOccurrenceRecord
  role: 'OWNER' | 'PLAYER'
}): PendingEncounterRuleOccurrenceSummaryDto | null {
  const summary = summarizePendingEncounterConcentrationOccurrence(
    input.occurrence,
    input.encounterVersion
  )
  if (!summary || input.role === 'OWNER') return summary
  const context = input.occurrence.pendingSnapshot?.applicationContext
  if (context?.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK') return null
  const target = input.encounter.actors.find(
    (actor) => actor.id === context.application.targetActorId
  )
  if (
    !target ||
    target.kind !== 'CHARACTER' ||
    !target.sourceId ||
    input.assignedCharacterId !== target.sourceId ||
    input.assignments.get(target.sourceId) !== input.actorUserId
  ) {
    return null
  }
  return summary
}

async function assertConcentrationOccurrenceAuthority(input: {
  actorUserId: string
  assignments: ReadonlyMap<string, string>
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence: RuleOccurrenceRecord
}): Promise<
  Extract<
    ServerRuleExecutionPendingApplicationContextDto,
    { kind: 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' }
  >
> {
  const applicationContext = input.occurrence.pendingSnapshot?.applicationContext
  if (applicationContext?.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK') {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  if (input.locked.context.role === 'OWNER') return applicationContext
  const target = input.locked.encounter.actors.find(
    (actor) => actor.id === applicationContext.application.targetActorId
  )
  if (!target || target.kind !== 'CHARACTER' || !target.sourceId) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  if (
    input.assignments.get(target.sourceId) !== input.actorUserId ||
    input.locked.context.assignedCharacterId !== target.sourceId
  ) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  return applicationContext
}

export async function getPendingEncounterConcentrationRuleOccurrence(input: {
  db: DBLike
  actorUserId: string
  encounterId: string
  liveSessionAuthority?: LiveSessionCommandAuthority
}): Promise<PendingEncounterRuleOccurrenceSummaryDto | null> {
  return withTransaction(input.db, async (db) => {
    const locked = await lockEncounterRuleExecutionCommandContext(db, {
      actorUserId: input.actorUserId,
      authority: 'ACTIVE_MEMBER',
      encounterId: input.encounterId,
      ...(input.liveSessionAuthority ? { liveSessionAuthority: input.liveSessionAuthority } : {})
    })
    const assignments = await lockEncounterCharacterAssignments({
      db,
      campaignId: locked.context.campaignId,
      encounter: locked.encounter
    })
    const occurrence = await createRuleOccurrenceRepository(db).lockPendingEncounter(
      locked.context.encounterId
    )
    if (!occurrence) return null
    if (
      occurrence.pendingSnapshot?.applicationContext.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK'
    ) {
      return null
    }
    try {
      await assertConcentrationOccurrenceAuthority({
        actorUserId: input.actorUserId,
        assignments,
        locked,
        occurrence
      })
    } catch (error) {
      if (error instanceof EncounterConflictError) return null
      throw error
    }
    return summarizePendingEncounterConcentrationOccurrenceForRecipient({
      actorUserId: input.actorUserId,
      assignedCharacterId: locked.context.assignedCharacterId,
      assignments,
      encounter: locked.encounter,
      encounterVersion: locked.context.currentVersion,
      occurrence,
      role: locked.context.role
    })
  })
}

/**
 * Settles only the sealed D&D concentration-damage occurrence. It intentionally
 * does not share the action-resume path: action identity is absent from this
 * command and must never be reconstructed from client input.
 */
export async function resolveEncounterConcentrationRuleOccurrence(input: {
  db: DBLike
  runtime: RulesRuntimeService
  command: ResolveEncounterConcentrationRuleOccurrenceInput
  rollD20?: () => number
  /** Server-only canonical Encounter context held by the dispatcher transaction. */
  lockedContext?: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  /** Server-only occurrence lock held by the dispatcher transaction. */
  lockedOccurrence?: RuleOccurrenceRecord
}): Promise<ResolveEncounterConcentrationRuleOccurrenceResult> {
  const command = input.command
  let lockedContext: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>> | null =
    null
  let sealedContext: Extract<
    ServerRuleExecutionPendingApplicationContextDto,
    { kind: 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' }
  > | null = null
  let currentProjection: EncounterCurrentProjection | null = null
  let resolved: {
    concentration: ConcentrationPreflight
    concentrationDefinition: ServerPublishedRuleDefinitionDto
    facts: ReturnType<typeof resolveDnd5eConcentrationSaveFacts>
    targetActorId: string
  } | null = null
  let rawFaces: readonly number[] = []
  let replayed = false
  let nextPending: PendingEncounterRuleOccurrenceSummaryDto | null = null
  let lockedCharacterAssignments: ReadonlyMap<string, string> = new Map()
  const aggregatePort: RuleExecutionAggregatePort = {
    async withLockedAuthorized(transaction, run) {
      const locked =
        input.lockedContext ??
        (await lockEncounterRuleExecutionCommandContext(transaction, {
          actorUserId: command.actorUserId,
          authority: 'ACTIVE_MEMBER',
          encounterId: command.encounterId,
          ...(command.liveSessionAuthority
            ? { liveSessionAuthority: command.liveSessionAuthority }
            : {})
        }))
      lockedCharacterAssignments = await lockEncounterCharacterAssignments({
        db: transaction,
        campaignId: locked.context.campaignId,
        encounter: locked.encounter
      })
      const occurrence =
        input.lockedOccurrence ??
        (await createRuleOccurrenceRepository(transaction).lockOccurrence(
          'ENCOUNTER',
          locked.context.encounterId,
          command.occurrenceId
        ))
      const applicationContext = occurrence?.pendingSnapshot?.applicationContext
      const replayReceipt = applicationContext
        ? null
        : await createRuleOccurrenceRepository(transaction).findReceipt(
            'ENCOUNTER',
            locked.context.encounterId,
            command.commandId
          )
      replayed = replayReceipt !== null
      const replayOutput = replayReceipt?.resultPayload
      const targetActorId =
        applicationContext?.kind === 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK'
          ? applicationContext.application.targetActorId
          : replayOutput?.status === 'COMPLETE' &&
              replayOutput.applicationOutputs.kind === 'CONCENTRATION_CHECK'
            ? replayOutput.applicationOutputs.application.targetActorId
            : null
      if (targetActorId === null) {
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      }
      if (applicationContext?.kind === 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK') {
        if (!occurrence) {
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        }
        await assertConcentrationOccurrenceAuthority({
          actorUserId: command.actorUserId,
          assignments: lockedCharacterAssignments,
          locked,
          occurrence
        })
      } else if (locked.context.role !== 'OWNER') {
        const target = locked.encounter.actors.find((actor) => actor.id === targetActorId)
        if (!target || target.kind !== 'CHARACTER' || !target.sourceId) {
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        }
        if (
          lockedCharacterAssignments.get(target.sourceId) !== command.actorUserId ||
          locked.context.assignedCharacterId !== target.sourceId
        ) {
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        }
      }
      if (
        replayOutput?.status === 'COMPLETE' &&
        replayOutput.applicationOutputs.kind === 'CONCENTRATION_CHECK' &&
        replayOutput.applicationOutputs.nextOccurrenceId !== null
      ) {
        const nextOccurrence = await createRuleOccurrenceRepository(transaction).lockOccurrence(
          'ENCOUNTER',
          locked.context.encounterId,
          replayOutput.applicationOutputs.nextOccurrenceId
        )
        if (nextOccurrence) {
          nextPending = summarizePendingEncounterConcentrationOccurrenceForRecipient({
            actorUserId: command.actorUserId,
            assignedCharacterId: locked.context.assignedCharacterId,
            assignments: lockedCharacterAssignments,
            encounter: locked.encounter,
            encounterVersion: locked.context.currentVersion,
            occurrence: nextOccurrence,
            role: locked.context.role
          })
        }
      }
      lockedContext = locked
      sealedContext =
        applicationContext?.kind === 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK'
          ? applicationContext
          : null
      return run({
        aggregateKind: 'ENCOUNTER',
        aggregateId: locked.context.encounterId,
        campaignId: locked.context.campaignId,
        actorUserId: locked.context.actorUserId,
        currentVersion: locked.context.currentVersion,
        advanceVersion: (_db, expectedVersion) => locked.context.advanceVersion(expectedVersion)
      })
    }
  }

  const result = await createRuleExecutionOccurrenceService({
    db: input.db,
    runtime: input.runtime
  }).resume(aggregatePort, {
    commandId: command.commandId,
    correlationId: command.correlationId,
    expectedAggregateVersion: command.expectedEncounterVersion,
    occurrenceId: command.occurrenceId,
    expectedOccurrenceVersion: command.expectedOccurrenceVersion,
    ...(input.lockedOccurrence ? { lockedOccurrence: input.lockedOccurrence } : {}),
    resolutionIntent: command.resolution,
    async resolve({ db, applicationContext }) {
      if (applicationContext.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK') {
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      }
      const locked = lockedContext
      if (!locked)
        throw new EncounterConflictError('Encounter occurrence authority is unavailable.')
      const targetActor = locked.encounter.actors.find(
        (actor) => actor.id === applicationContext.application.targetActorId
      )
      if (!targetActor || targetActor.kind !== 'CHARACTER' || !targetActor.sourceId) {
        throw new EncounterValidationError('Concentration requires a current Character target.')
      }
      const character = await db
        .selectFrom('characters')
        .select(['id', 'stream_version', 'status', 'system_id'])
        .where('id', '=', targetActor.sourceId)
        .forUpdate()
        .executeTakeFirst()
      if (
        !character ||
        character.status !== 'ACTIVE' ||
        character.stream_version !== applicationContext.targetCharacter.streamVersion ||
        targetActor.sourceRevision !== character.stream_version ||
        character.system_id !== locked.encounter.gameSystemId
      ) {
        throw new EncounterConflictError('The concentration Character is no longer current.')
      }
      const mechanics = await createCharacterMechanicsProjectionRepository(db).requireCurrent({
        characterId: character.id,
        expectedStreamVersion: character.stream_version
      })
      if (
        mechanics.projectionChecksum !== applicationContext.targetCharacter.baseProjectionChecksum
      ) {
        throw new EncounterConflictError('The concentration Character mechanics changed.')
      }
      const ruleContext = await resolveCharacterLiveSessionRuleContext(db, character.id, {
        id: locked.context.campaignId,
        attunementSlotOverride: locked.context.attunementSlotOverride
      })
      if (!ruleContext)
        throw new EncounterConflictError('The concentration Campaign context is stale.')
      const overlay = await createCampaignCharacterMechanicsProjectionRepository(db).requireCurrent(
        {
          campaignId: locked.context.campaignId,
          characterId: character.id,
          expectedBaseMechanicsProjectionChecksum: mechanics.projectionChecksum,
          expectedCharacterStreamVersion: character.stream_version,
          expectedMechanicalContextChecksum:
            applicationContext.targetCharacter.mechanicalContextChecksum,
          expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
          baseMechanicsProjection: mechanics
        }
      )
      if (
        overlay.projectionChecksum !== applicationContext.targetCharacter.campaignOverlayChecksum
      ) {
        throw new EncounterConflictError('The concentration Campaign overlay changed.')
      }
      const vocabulary = await createSystemVocabularySnapshotRepository(db).findById(
        applicationContext.systemVocabularySnapshot.id
      )
      if (
        !vocabulary ||
        vocabulary.systemId !== character.system_id ||
        vocabulary.snapshotVersion !== applicationContext.systemVocabularySnapshot.version ||
        vocabulary.checksum !== applicationContext.systemVocabularySnapshot.checksum ||
        !('abilities' in vocabulary.document) ||
        !vocabulary.document.abilities.some(
          (ability) => ability.id === applicationContext.save.savingThrowAbilityDefinitionId
        )
      ) {
        throw new EncounterConflictError('The concentration System vocabulary is unavailable.')
      }
      const currentDefinition = await createReusableDefinitionRepository(db).requireCurrent(
        applicationContext.concentrationDefinition.id
      )
      if (
        currentDefinition.gameSystemId !== character.system_id ||
        currentDefinition.checksum !== applicationContext.concentrationDefinition.checksum
      ) {
        throw new EncounterConflictError('The concentration definition changed.')
      }
      const concentrationDefinition = serverPublishedRuleDefinitionDtoSchema.parse({
        id: currentDefinition.id,
        gameSystemId: currentDefinition.gameSystemId,
        definitionFamilyKey: currentDefinition.definitionFamilyKey,
        checksum: currentDefinition.checksum,
        definition: currentDefinition.document
      })
      const bindings = concentrationDefinition.definition.vocabularyBindings ?? []
      if (
        bindings.length !== 1 ||
        bindings[0]?.kind !== 'ABILITY' ||
        bindings[0].definitionId !== applicationContext.save.savingThrowAbilityDefinitionId
      ) {
        throw new EncounterConflictError('The concentration definition ability binding changed.')
      }
      const policyOutput =
        overlay.kind === 'MATERIALIZED' ? overlay.rulePolicyOutput : mechanics.rulePolicyOutput
      const facts = resolveDnd5eConcentrationSaveFacts({
        targetActorId: applicationContext.application.targetActorId,
        appliedDamage: applicationContext.application.appliedAmount,
        rulePolicyOutput: policyOutput
      })
      try {
        validateDnd5eConcentrationContributors(
          applicationContext.save.contributors,
          applicationContext.save.contributorChecksum
        )
      } catch {
        throw new EncounterConflictError('The concentration contributor evidence changed.')
      }
      if (
        facts.modifier !== applicationContext.save.modifier ||
        facts.rollMode !== applicationContext.save.rollMode ||
        facts.contributorChecksum !== applicationContext.save.contributorChecksum ||
        JSON.stringify(facts.contributors) !== JSON.stringify(applicationContext.save.contributors)
      ) {
        throw new EncounterConflictError('The concentration save policy changed.')
      }
      const activeEffects = createActiveRuleEffectRepository(db)
      const state = await activeEffects.lockMaintainedStateById({
        encounterId: locked.encounter.id,
        stateId: applicationContext.maintainedState.id
      })
      const dependents = state
        ? await activeEffects.lockDependentEffects({
            stateId: state.id,
            encounterId: locked.encounter.id
          })
        : []
      const concentration = state
        ? {
            id: state.id,
            version: state.version,
            ownerActorId: state.ownerActorId,
            maintenanceDefinitionId: state.maintenanceDefinitionId,
            descriptorChecksum: state.descriptorChecksum,
            dependents: dependents.map(maintainedDependentSnapshot)
          }
        : null
      if (
        !concentration ||
        !sameConcentrationPreflight(
          {
            id: applicationContext.maintainedState.id,
            version: applicationContext.maintainedState.version,
            ownerActorId: applicationContext.application.targetActorId,
            maintenanceDefinitionId: applicationContext.maintainedState.maintenanceDefinitionId,
            descriptorChecksum: applicationContext.maintainedState.descriptorChecksum,
            dependents: concentration.dependents
          },
          concentration
        )
      ) {
        throw new EncounterConflictError('The concentration state changed.')
      }
      const contextChecksum = checksumRuleDocument({
        concentrationDefinition: applicationContext.concentrationDefinition,
        savingThrowAbilityDefinitionId: applicationContext.save.savingThrowAbilityDefinitionId,
        systemVocabularySnapshot: applicationContext.systemVocabularySnapshot,
        targetCharacter: applicationContext.targetCharacter,
        modifier: facts.modifier,
        rollMode: facts.rollMode,
        contributors: [...facts.contributors],
        contributorChecksum: facts.contributorChecksum,
        maintainedState: applicationContext.maintainedState,
        finalizedDamageApplication: {
          ...applicationContext.application,
          maintainedStateId: applicationContext.maintainedState.id
        },
        finalizedDamageEnvelopeChecksum: applicationContext.finalizedDamageEnvelopeChecksum
      })
      if (contextChecksum !== applicationContext.contextChecksum) {
        throw new EncounterConflictError('The concentration context changed.')
      }
      currentProjection = await createEncounterRepository(db).requireCurrentProjection({
        encounterId: locked.encounter.id,
        expectedStreamVersion: locked.context.currentVersion
      })
      resolved = {
        concentration,
        concentrationDefinition,
        facts,
        targetActorId: targetActor.id
      }
      return {
        published: concentrationDefinition,
        facts: facts.facts,
        allowPaused: true,
        pendingApplicationContext: applicationContext
      }
    },
    async deriveResponse({ request }) {
      const state = resolved
      if (!state || request.kind !== 'INTEGER_RANGE' || request.min !== 1 || request.max !== 20) {
        throw new EncounterValidationError('The concentration occurrence issued an invalid roll.')
      }
      if (command.resolution.requestId !== request.requestId) {
        throw new EncounterValidationError('The concentration roll request does not match.')
      }
      const count = state.facts.rollMode === 'NORMAL' ? 1 : 2
      if (command.resolution.kind === 'ENTER_DICE') {
        if (command.resolution.rawFaces.length !== count) {
          throw new EncounterValidationError(
            'The concentration dice count does not match its frozen roll mode.'
          )
        }
        rawFaces = [...command.resolution.rawFaces]
      } else {
        const roll = input.rollD20 ?? (() => randomInt(1, 21))
        rawFaces = Array.from({ length: count }, () => roll())
      }
      if (rawFaces.some((face) => !Number.isInteger(face) || face < 1 || face > 20)) {
        throw new EncounterValidationError('The concentration dice are invalid.')
      }
      return {
        requestId: request.requestId,
        value:
          state.facts.rollMode === 'ADVANTAGE'
            ? Math.max(...rawFaces)
            : state.facts.rollMode === 'DISADVANTAGE'
              ? Math.min(...rawFaces)
              : rawFaces[0]!
      }
    },
    completionApplicator: {
      requiresAggregateAdvance: ({ execution }) =>
        execution.status === 'COMPLETE' && execution.outputs.resultPath === 'ON_SAVE_FAIL',
      async apply({ db, execution, occurrenceId, proposedAggregateVersion }) {
        const state = resolved
        const applicationContext = sealedContext
        const locked = lockedContext
        const projection = currentProjection
        if (!state || !applicationContext || !locked || !projection) {
          throw new EncounterConflictError('The concentration occurrence context is unavailable.')
        }
        const dc = execution.outputs.dc
        const total = execution.outputs.total
        const resultPath = execution.outputs.resultPath
        const selectedNatural =
          state.facts.rollMode === 'ADVANTAGE'
            ? Math.max(...rawFaces)
            : state.facts.rollMode === 'DISADVANTAGE'
              ? Math.min(...rawFaces)
              : rawFaces[0]
        if (
          typeof dc !== 'number' ||
          !Number.isInteger(dc) ||
          typeof total !== 'number' ||
          !Number.isInteger(total) ||
          !Number.isInteger(selectedNatural) ||
          total !== selectedNatural + state.facts.modifier ||
          (resultPath !== 'ON_SAVE_SUCCESS' && resultPath !== 'ON_SAVE_FAIL') ||
          execution.evidence.source.definitionId !==
            applicationContext.concentrationDefinition.id ||
          execution.evidence.source.checksum !== applicationContext.concentrationDefinition.checksum
        ) {
          throw new EncounterValidationError('The concentration check evidence is invalid.')
        }
        const validatedDc = dc
        const validatedTotal = total
        const d20 = {
          requestId: command.resolution.requestId,
          rollMode: state.facts.rollMode,
          rawFaces: [...rawFaces],
          selectedNatural,
          modifier: state.facts.modifier,
          total: validatedTotal,
          dc: validatedDc,
          contributors: [...state.facts.contributors],
          contributorChecksum: state.facts.contributorChecksum
        }
        if (resultPath === 'ON_SAVE_SUCCESS') {
          let nextOccurrenceId: string | null = null
          if (applicationContext.remaining.length > 0) {
            const next = applicationContext.remaining[0]!
            const nextFacts = resolveDnd5eConcentrationSaveFacts({
              targetActorId: next.targetActorId,
              appliedDamage: next.appliedAmount,
              rulePolicyOutput: (
                await createCampaignCharacterMechanicsProjectionRepository(db).requireCurrent({
                  campaignId: locked.context.campaignId,
                  characterId: locked.encounter.actors.find(
                    (actor) => actor.id === next.targetActorId && actor.kind === 'CHARACTER'
                  )!.sourceId!,
                  expectedBaseMechanicsProjectionChecksum:
                    applicationContext.targetCharacter.baseProjectionChecksum,
                  expectedCharacterStreamVersion: applicationContext.targetCharacter.streamVersion,
                  expectedMechanicalContextChecksum:
                    applicationContext.targetCharacter.mechanicalContextChecksum,
                  expectedProjectionSchemaVersion:
                    CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
                  baseMechanicsProjection: await createCharacterMechanicsProjectionRepository(
                    db
                  ).requireCurrent({
                    characterId: locked.encounter.actors.find(
                      (actor) => actor.id === next.targetActorId && actor.kind === 'CHARACTER'
                    )!.sourceId!,
                    expectedStreamVersion: applicationContext.targetCharacter.streamVersion
                  })
                })
              ).rulePolicyOutput
            })
            const nextApplication = {
              ordinal: next.ordinal,
              sourceNodeId: next.sourceNodeId,
              sourceOperationKey: next.sourceOperationKey,
              targetActorId: next.targetActorId,
              appliedAmount: next.appliedAmount,
              damageTypeId: next.damageTypeId
            }
            const nextContext = {
              concentrationDefinition: applicationContext.concentrationDefinition,
              savingThrowAbilityDefinitionId:
                applicationContext.save.savingThrowAbilityDefinitionId,
              systemVocabularySnapshot: applicationContext.systemVocabularySnapshot,
              targetCharacter: applicationContext.targetCharacter,
              modifier: nextFacts.modifier,
              rollMode: nextFacts.rollMode,
              contributors: [...nextFacts.contributors],
              contributorChecksum: nextFacts.contributorChecksum,
              maintainedState: applicationContext.maintainedState,
              finalizedDamageApplication: next,
              finalizedDamageEnvelopeChecksum: applicationContext.finalizedDamageEnvelopeChecksum
            }
            const nextContextChecksum = checksumRuleDocument(nextContext)
            nextOccurrenceId = concentrationChildIdentity({
              parentOccurrenceId: applicationContext.parentOccurrenceId,
              ...nextApplication
            })
            const nextCommandId = uuidv5(
              `${nextOccurrenceId}:command`,
              DND5E_CONCENTRATION_OCCURRENCE_NAMESPACE
            )
            const nextOccurrence = await createRuleExecutionOccurrenceService({
              db,
              runtime: input.runtime,
              createOccurrenceId: () => nextOccurrenceId!
            }).executeResolved(locked.context.createReceiptOnlyChildOccurrencePort(), {
              commandId: nextCommandId,
              correlationId: occurrenceId,
              expectedAggregateVersion: proposedAggregateVersion,
              intent: {
                parentOccurrenceId: applicationContext.parentOccurrenceId,
                applicationOrdinal: next.ordinal,
                applicationIndex: next.ordinal,
                damageEnvelopeChecksum: applicationContext.finalizedDamageEnvelopeChecksum,
                concentrationContextChecksum: nextContextChecksum
              },
              allowPaused: true,
              async resolve() {
                return {
                  published: state.concentrationDefinition,
                  facts: nextFacts.facts,
                  allowPaused: true,
                  pendingApplicationContext: {
                    ...applicationContext,
                    application: nextApplication,
                    save: {
                      savingThrowAbilityDefinitionId:
                        applicationContext.save.savingThrowAbilityDefinitionId,
                      modifier: nextFacts.modifier,
                      rollMode: nextFacts.rollMode,
                      contributors: [...nextFacts.contributors],
                      contributorChecksum: nextFacts.contributorChecksum
                    },
                    contextChecksum: nextContextChecksum,
                    remaining: applicationContext.remaining.slice(1)
                  }
                }
              }
            })
            if (nextOccurrence.status !== 'PAUSED') {
              throw new EncounterConflictError('The next concentration occurrence did not pause.')
            }
            const persistedNextOccurrence = await createRuleOccurrenceRepository(db).lockOccurrence(
              'ENCOUNTER',
              locked.context.encounterId,
              nextOccurrence.occurrenceId
            )
            if (!persistedNextOccurrence) {
              throw new EncounterConflictError(
                'The next concentration occurrence was not persisted.'
              )
            }
            nextPending = summarizePendingEncounterConcentrationOccurrenceForRecipient({
              actorUserId: command.actorUserId,
              assignedCharacterId: locked.context.assignedCharacterId,
              assignments: lockedCharacterAssignments,
              encounter: locked.encounter,
              encounterVersion: locked.context.currentVersion,
              occurrence: persistedNextOccurrence,
              role: locked.context.role
            })
          }
          return {
            applicationOutputs: {
              kind: 'CONCENTRATION_CHECK' as const,
              schemaVersion: 1 as const,
              occurrenceId,
              parentOccurrenceId: applicationContext.parentOccurrenceId,
              concentrationDefinition: applicationContext.concentrationDefinition,
              savingThrowAbilityDefinitionId:
                applicationContext.save.savingThrowAbilityDefinitionId,
              systemVocabularySnapshot: applicationContext.systemVocabularySnapshot,
              targetCharacter: applicationContext.targetCharacter,
              application: {
                ...applicationContext.application,
                maintainedStateId: state.concentration.id
              },
              outcome: 'SAVE_SUCCESS' as const,
              d20,
              contextChecksum: applicationContext.contextChecksum,
              cleanup: null,
              nextOccurrenceId,
              skipped: []
            }
          }
        }
        const cleanup = await cleanupConcentrationMaintainedState({
          db,
          encounter: locked.encounter,
          attunementSlotOverride: locked.context.attunementSlotOverride,
          concentration: state.concentration
        })
        const actors = locked.encounter.actors.map((actor) => {
          const version =
            actor.kind === 'CHARACTER' && actor.sourceId
              ? cleanup.characterActorVersions.get(actor.sourceId)
              : undefined
          return version === undefined ? actor : { ...actor, sourceRevision: version }
        })
        const nextEncounter = {
          ...locked.encounter,
          version: proposedAggregateVersion,
          actors
        }
        const snapshot = refreshEncounterActorRuleSnapshot(projection.ruleSnapshot, nextEncounter)
        if (!snapshot)
          throw new EncounterConflictError('The Encounter projection rule identity is stale.')
        const nextProjection = compileEncounterCurrentProjection(
          projectGm(nextEncounter, snapshot.output),
          snapshot
        )
        await createEncounterRepository(db).publishCurrentProjection(nextProjection)
        currentProjection = nextProjection
        return {
          applicationOutputs: {
            kind: 'CONCENTRATION_CHECK' as const,
            schemaVersion: 1 as const,
            occurrenceId,
            parentOccurrenceId: applicationContext.parentOccurrenceId,
            concentrationDefinition: applicationContext.concentrationDefinition,
            savingThrowAbilityDefinitionId: applicationContext.save.savingThrowAbilityDefinitionId,
            systemVocabularySnapshot: applicationContext.systemVocabularySnapshot,
            targetCharacter: applicationContext.targetCharacter,
            application: {
              ...applicationContext.application,
              maintainedStateId: cleanup.maintainedStateId
            },
            outcome: 'SAVE_FAILURE' as const,
            d20,
            contextChecksum: applicationContext.contextChecksum,
            cleanup: {
              maintainedStateId: cleanup.maintainedStateId,
              removedDependentEffectIds: cleanup.removedDependentEffectIds,
              characterOwnerTransitions: cleanup.characterOwnerTransitions
            },
            nextOccurrenceId: null,
            skipped: applicationContext.remaining.map((remaining) => ({
              ...remaining,
              reason: 'MAINTAINED_STATE_ENDED' as const
            }))
          },
          afterResult: async (stored) => {
            await createEncounterRepository(db).appendEvent({
              id: randomUUID(),
              encounterId: nextEncounter.id,
              campaignId: nextEncounter.campaignId,
              version: proposedAggregateVersion,
              commandId: command.commandId,
              commandType: 'RESOLVE_RULE_OCCURRENCE',
              commandFingerprint: checksumRuleDocument(command),
              commandPayload: { occurrenceId },
              resultPayload: encounterProjectionEventSchema.parse({
                command: {
                  projection: projectGm(nextEncounter, snapshot.output),
                  roll: null,
                  resolution: null
                },
                currentProjection: nextProjection,
                ruleReceipt: {
                  occurrenceId,
                  resultChecksum: checksumStoredRuleExecutionResult(stored)
                }
              }) as unknown as Json,
              actorUserId: command.actorUserId,
              correlationId: command.correlationId
            })
          }
        }
      }
    }
  })
  const projection =
    (currentProjection as EncounterCurrentProjection | null) ??
    (await createEncounterRepository(input.db).requireCurrentProjection({
      encounterId: command.encounterId,
      expectedStreamVersion:
        result.status === 'COMPLETE' &&
        result.applicationOutputs.kind === 'CONCENTRATION_CHECK' &&
        result.applicationOutputs.outcome === 'SAVE_FAILURE'
          ? command.expectedEncounterVersion + 1
          : command.expectedEncounterVersion
    }))
  const locked = lockedContext as Awaited<
    ReturnType<typeof lockEncounterRuleExecutionCommandContext>
  > | null
  if (!projection || !locked)
    throw new EncounterConflictError('Concentration occurrence result is unavailable.')
  return {
    result,
    projection,
    role: locked.context.role,
    pending: nextPending,
    replayed
  }
}
