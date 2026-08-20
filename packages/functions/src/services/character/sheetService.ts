import {
  ConcurrencyError,
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterEventRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  createCharacterSheetAdjustmentRepository,
  createCharacterSheetPlayStateRepository,
  createLiveMaximumHitPointPolicyRepository,
  createRollHistoryRepository,
  withTransaction,
  type CharacterMechanicsProjectionPublicationTiming,
  type DBLike
} from '@artificer-toolkit/db'
import {
  AUTHORED_RECORD_STATUS,
  type CharacterEvent,
  type CharacterResourceUsage
} from '@artificer-toolkit/shared/core'
import {
  clampCharacterCurrentHitPoints,
  createCharacterResourceOwnerKey,
  createCharacterSpellSourceKey,
  resolveCharacterEffectiveMaximumHitPoints,
  toCharacterResourceOwnerKey,
  type CharacterMovementDisplayPreference,
  type CharacterSheetAdjustment,
  type CharacterSheetAdjustmentWrite
} from '@artificer-toolkit/shared/character'
import { maskStandardPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import type {
  CharacterAuthored,
  CreatureAuthored,
  VehicleAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import type {
  CharacterHistoryEntryDto,
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characters'
import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyInput,
  type CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import { loadCharacterBuilderContext, resolveCharacterBuilder } from './builderService.js'
import { resolveActiveCharacterEquipment } from './characterAssemblyOrchestrator.js'
import {
  loadActiveCharacterCreatures,
  loadActiveCharacterVehicles
} from './characterActiveAuthoredSources.js'
import {
  characterSheetAdjustmentMatchesPanelTarget,
  getCharacterSheetPanelAdjustmentIds
} from './sheetPanelTarget.js'
import {
  CharacterSheetCommandError,
  applyCharacterSheetCommand,
  createCharacterSheetStatePatches,
  createNamedError,
  formatCodeLabel,
  ensureResource,
  ensureResourceByOwner,
  resolveSpellCastSource,
  summarizeCharacterSheetCommand,
  type SheetResource
} from './sheetCommandReducer.js'
import { buildCharacterSheetBundle } from './sheetProjection.js'
import { assembleCharacterSheetBundleForRuleContext } from './characterSheetBundleAssembly.js'
import {
  createCharacterCommittedSheetExtras,
  createCharacterCommittedSheetResolution,
  createCharacterCommittedSheetSpells,
  extendCharacterCommittedSheetSourcesWithActiveRoots,
  loadCharacterCommittedSheetSources,
  pruneCharacterCommittedSheetSourcesRoots
} from './characterCommittedSheetSources.js'
import { createCommittedCharacterRuleEvaluation } from './characterCommittedRuleEvaluation.js'
import {
  advanceCharacterMechanicsProjectionCommandState,
  compileCharacterMechanicsProjection
} from './characterMechanicsCompiler.js'
import { deriveCharacterSceneVision } from './characterSceneVision.js'
import {
  applyCompletedCharacterRest,
  buildCharacterRestPreview,
  sortFingerprintValue,
  verifyRestRollEvidence
} from './sheetRestService.js'
import {
  assertCampaignGmSheetCommandAllowed,
  sameSpellSource,
  validatePanelTarget,
  getSpellCustomizationField,
  getSpellCustomizationFields,
  validateSheetAdjustmentTarget,
  validateSpellMechanicCustomization,
  validateSpellSource
} from './sheetCommandValidation.js'

export interface CharacterSheetCommandServiceTiming {
  ruleResponsibility: CharacterSheetCommandRuleResponsibility
  evaluationLane: 'NONE' | 'CHARACTER_POLICY' | 'CHARACTER_ACTION'
  boundedEvaluationMs: number
  boundedZenEvaluationMs: number
  recordLoadMs: number
  authorityCheckMs: number
  campaignContextMs: number
  committedSnapshotCacheHit: boolean
  campaignSnapshotCacheHit: boolean
  inputHydrationElapsedMs: number
  mechanicsProjectionLoadMs: number
  committedSourceLoadMs: number
  inputHydrationMs: number
  committedEvaluationMs: number
  idempotencyLookupMs: number
  builderResolutionMs: number
  currentProjectionMs: number
  commandPreparationMs: number
  mechanicsProjectionCompilationMs: number
  transactionMs: number
  mechanicsProjectionPublication?: CharacterMechanicsProjectionPublicationTiming
  campaignProjectionRuleContextMs: number
  campaignProjectionCompilationMs: number
  campaignProjectionPublicationMs: number
  characterEventAppendMs: number
  postCommitHydrationMs: number
  postCommitCampaignContextMs: number
  postCommitCampaignBundleMs: number
  postCommitBuilderResolutionMs: number
  postCommitProjectionMs: number
  totalMs: number
}

import {
  checksumCampaignCharacterMechanicalContext,
  getCharacterSheetDisplayAdjustments,
  getVisibleCampaignConditions,
  mergeCampaignSheetAdjustments,
  projectCharacterSheetForViewer,
  resolveCharacterLiveSessionRuleContext,
  resolveCharacterSheetCampaignContext,
  sameCharacterSheetAdjustmentSlot
} from './campaignCharacterSheet.js'
import { presentCampaignCharacterText } from './campaignCharacterPresentation.js'
import { buildCharacterSheetPanel } from './sheetPanelService.js'
import type { CharacterBuilderResolution } from './builderService.js'
import type { CharacterSheetBuildBundle } from './sheetProjection.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'
import type {
  CharacterMechanicsProjection,
  CharacterMechanicsProjectionMetadata
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  CampaignCharacterMechanicsProjection,
  ResolvedCampaignCharacterMechanicsProjection
} from '@artificer-toolkit/schema/projections/campaignCharacterMechanics'
import { evaluateCharacterActionStateChange } from './characterActionEvaluation.js'
import { resolveCharacterRuleBinding } from './characterRuleBinding.js'
import { CHARACTER_ACTION_SPELL_STATE_CONTRACT_VERSION } from '../rules/ruleModelContracts.js'
import {
  assertCharacterLiveSessionCommandAuthority,
  type LiveSessionCommandAuthority
} from '../campaign/liveSessionCommandAuthority.js'
import {
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
  compileCampaignCharacterMechanicsProjection,
  prepareCampaignCharacterMechanicsProjection
} from '../campaign/campaignCharacterMechanicsProjection.js'
import {
  canReuseCommittedCharacterRuleEvaluation,
  classifyCharacterSheetCommandRuleResponsibility,
  type CharacterSheetCommandRuleResponsibility
} from './characterSheetCommandResponsibility.js'
import { evaluatePinnedRuleRevision } from '../rules/ruleRevisionRuntime.js'

function toProspectiveSheetAdjustment(
  write: CharacterSheetAdjustmentWrite,
  existing?: CharacterSheetAdjustment
): CharacterSheetAdjustment {
  const timestamp = existing?.updatedAt ?? new Date(0).toISOString()
  const { actorId, ...value } = write
  return {
    ...value,
    createdBy: existing?.createdBy ?? actorId,
    updatedBy: actorId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  }
}

function getProspectiveSheetAdjustments(params: {
  adjustments: readonly CharacterSheetAdjustment[]
  characterId: string
  command: CharacterSheetCommandInputDto
  userId: string
}): readonly CharacterSheetAdjustment[] {
  const { adjustments, command } = params
  if (command.type === 'UPSERT_SHEET_ADJUSTMENT') {
    const existing = adjustments.find((adjustment) =>
      sameCharacterSheetAdjustmentSlot(adjustment, command.adjustment)
    )
    const next = toProspectiveSheetAdjustment(
      {
        ...command.adjustment,
        id: existing?.id ?? command.adjustment.id ?? crypto.randomUUID(),
        characterId: params.characterId,
        actorId: params.userId
      },
      existing
    )
    return [
      ...adjustments.filter(
        (adjustment) => !sameCharacterSheetAdjustmentSlot(adjustment, command.adjustment)
      ),
      next
    ]
  }
  if (command.type === 'REMOVE_SHEET_ADJUSTMENT') {
    return adjustments.filter((adjustment) => adjustment.id !== command.adjustmentId)
  }
  if (command.type === 'RESET_SHEET_PANEL_ADJUSTMENTS') {
    const removedIds = new Set(
      getCharacterSheetPanelAdjustmentIds(adjustments, command.target).map(
        (adjustment) => adjustment.id
      )
    )
    return adjustments.filter((adjustment) => !removedIds.has(adjustment.id))
  }
  if (command.type === 'SET_HIT_POINTS' && command.maxOverride !== undefined) {
    const existing = adjustments.find(
      (adjustment) => adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_OVERRIDE'
    )
    const withoutOverride = adjustments.filter(
      (adjustment) => adjustment.family !== 'HIT_POINTS' || adjustment.field !== 'MAXIMUM_OVERRIDE'
    )
    if (command.maxOverride === null) return withoutOverride
    return [
      ...withoutOverride,
      toProspectiveSheetAdjustment(
        {
          id: existing?.id ?? crypto.randomUUID(),
          characterId: params.characterId,
          actorId: params.userId,
          family: 'HIT_POINTS',
          field: 'MAXIMUM_OVERRIDE',
          value: command.maxOverride,
          ...(existing?.sourceNote ? { sourceNote: existing.sourceNote } : {})
        },
        existing
      )
    ]
  }
  if (command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION') {
    const fields = getSpellCustomizationFields(command.category)
    return [
      ...adjustments.filter(
        (adjustment) =>
          !(
            adjustment.family === 'SPELL' &&
            sameSpellSource(adjustment.source, command.source) &&
            fields.includes(adjustment.field)
          )
      ),
      toProspectiveSheetAdjustment({
        id: crypto.randomUUID(),
        characterId: params.characterId,
        actorId: params.userId,
        family: 'SPELL',
        source: command.source,
        field: getSpellCustomizationField(command),
        value: command.value,
        ...(command.sourceNote ? { sourceNote: command.sourceNote } : {})
      })
    ]
  }
  if (command.type === 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION') {
    const fields = getSpellCustomizationFields(command.category)
    return adjustments.filter(
      (adjustment) =>
        !(
          adjustment.family === 'SPELL' &&
          sameSpellSource(adjustment.source, command.source) &&
          fields.includes(adjustment.field)
        )
    )
  }
  if (command.type === 'REMOVE_SHEET_EXTRA' && command.extra.kind !== 'VEHICLE') {
    return adjustments.filter(
      (adjustment) =>
        !characterSheetAdjustmentMatchesPanelTarget(adjustment, {
          kind: 'COMPANION',
          companionInstanceId: command.extra.extraId
        })
    )
  }
  return adjustments
}

function buildRequestedPanels(params: {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  bundle: CharacterSheetBuildBundle
  characterAdjustments: readonly CharacterSheetAdjustment[]
  movementDisplayPreference: CharacterMovementDisplayPreference
  targets: readonly CharacterSheetPanelTargetDto[] | undefined
  campaignContext: Awaited<ReturnType<typeof resolveCharacterSheetCampaignContext>>
}): CharacterSheetPanelDto[] | undefined {
  if (!params.targets?.length) return undefined
  const sheet = projectCharacterSheetForViewer(params.bundle.sheet, params.campaignContext)
  return params.targets.map((target) =>
    presentCampaignCharacterText(
      buildCharacterSheetPanel({
        character: params.character,
        resolution: params.resolution,
        sheet,
        ruleProjection: params.bundle.ruleProjection,
        adjustments: getCharacterSheetDisplayAdjustments(
          params.characterAdjustments,
          params.campaignContext
        ),
        movementDisplayPreference: params.movementDisplayPreference,
        target,
        editable:
          params.campaignContext.viewer === 'CHARACTER_OWNER' ||
          (params.campaignContext.viewer === 'CAMPAIGN_OWNER' &&
            params.campaignContext.campaignStatus === 'ACTIVE' &&
            target.kind === 'SPELLS')
      }),
      params.campaignContext.contentMaturity
    )
  )
}

function validateActionResourceUse(params: {
  sheet: CharacterSheetCommandResponseDto['sheet']
  actionId: string | undefined
  resourceId: string
  amount: number
}): void {
  if (!params.actionId) return
  const action = params.sheet.actions.items.find((candidate) => candidate.id === params.actionId)
  if (!action) {
    throw new CharacterSheetCommandError(`Action "${params.actionId}" is not available.`)
  }
  if (action.availability.status === 'UNAVAILABLE') {
    throw new CharacterSheetCommandError(
      `Action "${action.label}" is unavailable: ${formatCodeLabel(action.availability.reasonCode)}.`
    )
  }
  if (action.resourceGrantId !== params.resourceId || action.resourceCost !== params.amount) {
    throw new CharacterSheetCommandError(
      `Action "${action.label}" does not use the requested resource and cost.`
    )
  }
}

export interface ExecuteCharacterSheetCommandParams {
  db: DBLike
  characterId: string
  command: CharacterSheetCommandInputDto
  userId: string
  panelTargets?: readonly CharacterSheetPanelTargetDto[]
  onTiming?: (timing: CharacterSheetCommandServiceTiming) => void
  committedRuleSnapshot?: CharacterSheetCommittedRuleSnapshot
  liveSessionAuthority?: LiveSessionCommandAuthority
}

export interface CharacterSheetCommittedRuleSnapshot {
  campaignMechanicalContextChecksum: string | null
  campaignMechanicsProjectionChecksum: string | null
  mechanicsCommandLaneChecksum: string
  mechanicsProjectionChecksum: string
  mechanicsPayload: Pick<
    CharacterMechanicsProjection,
    'ruleSnapshot' | 'rulePolicyInput' | 'rulePolicyOutput' | 'ruleRegistry'
  >
  streamVersion: number
  evaluation: CharacterRuleEvaluationResult
  resolution: CharacterBuilderResolution
}

function reconstituteCommittedSnapshotMechanics(input: {
  payload: CharacterSheetCommittedRuleSnapshot['mechanicsPayload']
  metadata: CharacterMechanicsProjectionMetadata
}): CharacterMechanicsProjection {
  // Internal live-room snapshots are created only from full verified durable
  // projections; each command still verifies metadata identity below.
  return {
    ...input.metadata,
    ...input.payload
  }
}

export interface CharacterSheetCommandExecutionResult {
  replayed: boolean
  response: CharacterSheetCommandResponseDto
  ruleSnapshot: CharacterSheetCommittedRuleSnapshot
}

export interface CompactLiveCharacterHitPointCommandExecution {
  characterVision: import('@artificer-toolkit/shared/vtt').SceneCharacterVision
  replayed: boolean
  ruleSnapshot?: CharacterSheetCommittedRuleSnapshot
  version: number
}

/**
 * Executes the one high-frequency live play-state lane without rebuilding a
 * Sheet. It still publishes both correctness projections and the command
 * receipt in the same transaction.
 */
export async function executeCompactLiveCharacterHitPointCommand(
  params: Pick<
    ExecuteCharacterSheetCommandParams,
    | 'characterId'
    | 'command'
    | 'committedRuleSnapshot'
    | 'db'
    | 'liveSessionAuthority'
    | 'userId'
  >
): Promise<CompactLiveCharacterHitPointCommandExecution> {
  const { command } = params
  if (command.type !== 'ADJUST_HIT_POINTS') {
    throw new Error('The compact live Character lane only accepts ADJUST_HIT_POINTS commands.')
  }

  const repository = createCharacterRepository(params.db)
  const row = await repository.findById(params.characterId)
  if (!row) {
    throw createNamedError('NotFoundError', `Character "${params.characterId}" was not found.`)
  }
  if (row.status !== AUTHORED_RECORD_STATUS.ACTIVE || !row.rule_pack_revision_id) {
    throw new CharacterSheetCommandError(
      `Character "${params.characterId}" is not finalized with a pinned rule revision.`
    )
  }

  const campaignContext = await resolveCharacterSheetCampaignContext(
    params.db,
    { id: row.id, userId: row.user_id },
    params.userId
  )
  if (campaignContext.viewer === 'CAMPAIGN_OWNER') {
    if (campaignContext.campaignStatus !== 'ACTIVE') {
      throw new CharacterSheetCommandError('Archived Campaigns are read-only.')
    }
    assertCampaignGmSheetCommandAllowed(command)
  }

  await assertCharacterLiveSessionCommandAuthority(
    params.db,
    params.characterId,
    params.liveSessionAuthority
  )

  const commandFingerprint = fingerprintCharacterSheetCommand(command)
  const eventRepository = createCharacterEventRepository(params.db)
  const priorEvent = await eventRepository.findByCommandId(params.characterId, command.commandId)
  if (priorEvent) {
    if (
      priorEvent.type !== 'CHARACTER_SHEET_COMMAND_APPLIED' ||
      priorEvent.commandType !== command.type ||
      priorEvent.commandFingerprint !== commandFingerprint ||
      priorEvent.committedStreamVersion === undefined
    ) {
      throw new CharacterSheetCommandError(
        `Command "${command.commandId}" was already used for different or unverifiable input.`
      )
    }
    const mechanics = await createCharacterMechanicsProjectionRepository(params.db).requireCurrent({
      characterId: params.characterId,
      expectedRuleRevisionId: row.rule_pack_revision_id,
      expectedStreamVersion: row.stream_version
    })
    return {
      characterVision: deriveCharacterSceneVision(
        params.characterId,
        mechanics.rulePolicyOutput.senses
      ),
      replayed: true,
      version: priorEvent.committedStreamVersion
    }
  }

  if (row.stream_version !== command.expectedVersion) {
    throw new ConcurrencyError(params.characterId, command.expectedVersion)
  }
  const mechanicsRepository = createCharacterMechanicsProjectionRepository(params.db)
  const mechanics = await mechanicsRepository.requireCurrent({
    characterId: params.characterId,
    expectedRuleRevisionId: row.rule_pack_revision_id,
    expectedStreamVersion: command.expectedVersion
  })
  const projectedHitPoints = mechanics.commandState.state.hitpoints
  const campaignMechanicalContextChecksum = campaignContext.campaignId
    ? checksumCampaignCharacterMechanicalContext({
        adjustments: campaignContext.adjustments,
        attunementSlotOverride: campaignContext.attunementSlotOverride
      })
    : null
  const campaignMechanics = campaignContext.campaignId
    ? await createCampaignCharacterMechanicsProjectionRepository(params.db).requireCurrent({
        campaignId: campaignContext.campaignId,
        characterId: params.characterId,
        expectedBaseMechanicsProjectionChecksum: mechanics.projectionChecksum,
        expectedCharacterStreamVersion: command.expectedVersion,
        expectedMechanicalContextChecksum: campaignMechanicalContextChecksum as string,
        expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
        baseMechanicsProjection: mechanics
      })
    : null
  const effectiveRulePolicyOutput = campaignMechanics?.rulePolicyOutput ?? mechanics.rulePolicyOutput
  const effectiveMaximum = resolveCharacterEffectiveMaximumHitPoints(
    effectiveRulePolicyOutput.derivedStats.maxHitPoints.effective
  )
  const nextHitPoints =
    command.mode === 'HEAL'
      ? {
          current: clampCharacterCurrentHitPoints(
            projectedHitPoints.current + command.amount,
            effectiveMaximum
          ),
          temp: projectedHitPoints.temp
        }
      : (() => {
          const currentTemp = projectedHitPoints.temp ?? 0
          const absorbed = Math.min(currentTemp, command.amount)
          return {
            current: clampCharacterCurrentHitPoints(
              projectedHitPoints.current - (command.amount - absorbed),
              effectiveMaximum
            ),
            temp: Math.max(currentTemp - absorbed, 0)
          }
        })()
  const nextCommandState = {
    ...mechanics.commandState,
    state: {
      ...mechanics.commandState.state,
      hitpoints: {
        ...mechanics.commandState.state.hitpoints,
        ...nextHitPoints
      }
    }
  }
  const nextMechanics = advanceCharacterMechanicsProjectionCommandState({
    current: mechanics,
    characterCommandState: nextCommandState,
    characterStreamVersion: command.expectedVersion + 1
  })
  const nextCampaignMechanics =
    campaignContext.campaignId && campaignMechanics
      ? compileCampaignCharacterMechanicsProjection({
          campaignId: campaignContext.campaignId,
          characterId: params.characterId,
          characterStreamVersion: command.expectedVersion + 1,
          baseMechanicsProjectionChecksum: nextMechanics.projectionChecksum,
          mechanicalContextChecksum: campaignMechanics.mechanicalContextChecksum,
          manualMaximumModifierOwner: campaignMechanics.manualMaximumModifierOwner,
          ...(campaignMechanics.kind === 'MATERIALIZED'
            ? {
                rulePolicyInput: campaignMechanics.rulePolicyInput,
                rulePolicyOutput: campaignMechanics.rulePolicyOutput
              }
            : {})
        })
      : null
  const matchingCommittedRuleSnapshot =
    params.committedRuleSnapshot?.streamVersion === command.expectedVersion &&
    params.committedRuleSnapshot.evaluation.snapshot.characterId === row.id &&
    params.committedRuleSnapshot.evaluation.binding.revisionId === row.rule_pack_revision_id &&
    params.committedRuleSnapshot.mechanicsProjectionChecksum === mechanics.projectionChecksum &&
    params.committedRuleSnapshot.mechanicsCommandLaneChecksum === mechanics.commandLaneChecksum &&
    params.committedRuleSnapshot.campaignMechanicalContextChecksum ===
      campaignMechanicalContextChecksum &&
    params.committedRuleSnapshot.campaignMechanicsProjectionChecksum ===
      (campaignMechanics?.projectionChecksum ?? null)
      ? params.committedRuleSnapshot
      : undefined
  const event = {
    type: 'CHARACTER_SHEET_COMMAND_APPLIED',
    eventId: crypto.randomUUID(),
    characterId: params.characterId,
    occurredAt: new Date().toISOString(),
    actorId: params.userId,
    commandId: command.commandId,
    schemaVersion: 1,
    commandType: command.type,
    commandFingerprint,
    committedStreamVersion: command.expectedVersion + 1,
    summary:
      command.mode === 'HEAL'
        ? `Healed ${command.amount} hit point${command.amount === 1 ? '' : 's'}.`
        : `Took ${command.amount} damage.`
  } satisfies CharacterEvent

  let version: number
  try {
    version = await repository.patchLiveHitPoints(params.characterId, {
      expected: { current: projectedHitPoints.current, temp: projectedHitPoints.temp },
      next: nextHitPoints,
      expectedStreamVersion: command.expectedVersion,
      ...(campaignContext.campaignId
        ? {
            beforeCharacterLock: (trx) =>
              createCampaignCharacterMechanicsProjectionRepository(trx).lockAssignment({
                campaignId: campaignContext.campaignId as string,
                characterId: params.characterId
              })
          }
        : {}),
      afterPersist: async (trx, persistedStreamVersion) => {
        if (persistedStreamVersion !== nextMechanics.characterStreamVersion) {
          throw new ConcurrencyError(params.characterId, command.expectedVersion)
        }
        await assertCharacterLiveSessionCommandAuthority(
          trx,
          params.characterId,
          params.liveSessionAuthority
        )
        await createCharacterMechanicsProjectionRepository(trx).publish(nextMechanics, {
          requireActiveAuthoredVersions: false
        })
        if (nextCampaignMechanics && campaignMechanics) {
          await createCampaignCharacterMechanicsProjectionRepository(trx).publish({
            projection: nextCampaignMechanics,
            expectedPriorOverlayChecksum: campaignMechanics.projectionChecksum
          })
        }
        await createCharacterEventRepository(trx).append(event)
      }
    })
  } catch (error) {
    if (error instanceof ConcurrencyError) {
      const concurrentEvent = await eventRepository.findByCommandId(
        params.characterId,
        command.commandId
      )
      if (concurrentEvent) return executeCompactLiveCharacterHitPointCommand(params)
    }
    throw error
  }
  return {
    characterVision: deriveCharacterSceneVision(
      params.characterId,
      effectiveRulePolicyOutput.senses
    ),
    replayed: false,
    ...(matchingCommittedRuleSnapshot
      ? {
          ruleSnapshot: {
            mechanicsProjectionChecksum: nextMechanics.projectionChecksum,
            mechanicsCommandLaneChecksum: nextMechanics.commandLaneChecksum,
            mechanicsPayload: {
              ruleSnapshot: nextMechanics.ruleSnapshot,
              rulePolicyInput: nextMechanics.rulePolicyInput,
              rulePolicyOutput: nextMechanics.rulePolicyOutput,
              ruleRegistry: nextMechanics.ruleRegistry
            },
            campaignMechanicalContextChecksum,
            campaignMechanicsProjectionChecksum: nextCampaignMechanics?.projectionChecksum ?? null,
            streamVersion: version,
            evaluation: matchingCommittedRuleSnapshot.evaluation,
            resolution: matchingCommittedRuleSnapshot.resolution
          }
        }
      : {}),
    version
  }
}

/**
 * Executes the one live policy lane whose input is completely represented by
 * the committed mechanics projection: the Character's maximum-hit-point
 * modifier. It deliberately does not build a Sheet or rehydrate authored
 * sources; a policy change still runs the pinned evaluator and republishes
 * both correctness projections in the owning transaction.
 */
type CompactLiveMaximumHitPointModifierCommandParams = Pick<
    ExecuteCharacterSheetCommandParams,
    | 'characterId'
    | 'command'
    | 'db'
    | 'liveSessionAuthority'
    | 'userId'
  > & { campaignId: string }

export async function executeCompactLiveMaximumHitPointModifierCommand(
  params: CompactLiveMaximumHitPointModifierCommandParams
): Promise<CompactLiveCharacterHitPointCommandExecution | null> {
  return withTransaction(params.db, (db) =>
    executeCompactLiveMaximumHitPointModifierCommandInTransaction({ ...params, db })
  )
}

async function executeCompactLiveMaximumHitPointModifierCommandInTransaction(
  params: CompactLiveMaximumHitPointModifierCommandParams
): Promise<CompactLiveCharacterHitPointCommandExecution | null> {
  const { command } = params
  const isUpsert =
    command.type === 'UPSERT_SHEET_ADJUSTMENT' &&
    command.adjustment.family === 'HIT_POINTS' &&
    command.adjustment.field === 'MAXIMUM_MODIFIER' &&
    typeof command.adjustment.value === 'number'
  const isRemoval = command.type === 'REMOVE_SHEET_ADJUSTMENT'
  if (!isUpsert && !isRemoval) return null

  if (!params.liveSessionAuthority) {
    throw new CharacterSheetCommandError('The live-session command authority is unavailable.')
  }
  const policyRepository = createLiveMaximumHitPointPolicyRepository(params.db)
  const context = await policyRepository.lockContext({
    authorityId: params.liveSessionAuthority.authorityId,
    characterId: params.characterId,
    commandId: command.commandId,
    expectedCampaignId: params.campaignId,
    expectedStreamVersion: command.expectedVersion,
    sessionId: params.liveSessionAuthority.sessionId,
    userId: params.userId
  })
  const existing = context.existingAdjustment
  if (
    isRemoval &&
    (!existing ||
      command.family !== 'HIT_POINTS' ||
      command.target.kind !== 'HIT_POINTS' ||
      command.adjustmentId !== existing.id)
  ) {
    return null
  }

  const commandFingerprint = fingerprintCharacterSheetCommand(command)
  const priorEvent = context.priorEvent
  if (priorEvent) {
    if (
      priorEvent.type !== 'CHARACTER_SHEET_COMMAND_APPLIED' ||
      priorEvent.commandType !== command.type ||
      priorEvent.commandFingerprint !== commandFingerprint ||
      priorEvent.committedStreamVersion === undefined
    ) {
      throw new CharacterSheetCommandError(
        `Command "${command.commandId}" was already used for different or unverifiable input.`
      )
    }
    return {
      characterVision: deriveCharacterSceneVision(
        params.characterId,
        context.mechanics.rulePolicyOutput.senses
      ),
      replayed: true,
      version: priorEvent.committedStreamVersion
    }
  }
  if (context.character.streamVersion !== command.expectedVersion) {
    throw new ConcurrencyError(params.characterId, command.expectedVersion)
  }

  const mechanics = context.mechanics
  const hitPointFacts = mechanics.rulePolicyInput.hitPointFacts
  if (!hitPointFacts) {
    throw new CharacterSheetCommandError('The committed mechanics projection has no hit-point facts.')
  }
  const priorFact = hitPointFacts.manualMaximumModifier
  if (
    (existing === null && priorFact !== null) ||
    (existing !== null &&
      (!priorFact ||
        priorFact.source.kind !== 'MANUAL_ADJUSTMENT' ||
        priorFact.source.adjustmentId !== existing.id ||
        priorFact.sourceId !== existing.id ||
        priorFact.value !== existing.value))
  ) {
    throw new CharacterSheetCommandError(
      'The committed maximum-hit-point modifier does not match canonical state.'
    )
  }

  const nextAdjustment = isUpsert
    ? {
        ...command.adjustment,
        id: existing?.id ?? command.adjustment.id ?? crypto.randomUUID(),
        characterId: params.characterId,
        actorId: params.userId
      }
    : null
  const nextManualMaximumModifier = nextAdjustment
    ? {
        sourceId: nextAdjustment.id,
        source: { kind: 'MANUAL_ADJUSTMENT' as const, adjustmentId: nextAdjustment.id },
        value: nextAdjustment.value
      }
    : null
  const nextBaseInput = characterRulePolicyInputSchema.parse({
    ...mechanics.rulePolicyInput,
    hitPointFacts: {
      ...mechanics.rulePolicyInput.hitPointFacts,
      manualMaximumModifier: nextManualMaximumModifier
    }
  })
  const evaluatedBase = await evaluatePinnedRuleRevision({
    db: params.db,
    expected: {
      revisionId: mechanics.ruleRevisionId,
      checksum: mechanics.ruleRevisionChecksum,
      evaluatorKind: 'ZEN',
      evaluatorVersion: mechanics.evaluatorVersion,
      modelContractVersion: mechanics.modelContractVersion
    },
    modelKey: 'character-policy',
    normalizedFacts: nextBaseInput
  })
  if (
    evaluatedBase.revisionId !== mechanics.ruleRevisionId ||
    evaluatedBase.checksum !== mechanics.ruleRevisionChecksum ||
    evaluatedBase.evaluatorKind !== 'ZEN' ||
    evaluatedBase.evaluatorVersion !== mechanics.evaluatorVersion ||
    evaluatedBase.modelContractVersion !== mechanics.modelContractVersion
  ) {
    throw new CharacterSheetCommandError('The pinned Character rule identity changed before evaluation.')
  }
  const nextBaseOutput = characterRulePolicyOutputSchema.parse(evaluatedBase.result)
  const campaignMechanics = context.overlay
  if (!campaignMechanics) {
    throw new CharacterSheetCommandError('The Campaign mechanics projection is unavailable.')
  }
  let nextCampaignPolicy: {
    rulePolicyInput: CharacterRulePolicyInput
    rulePolicyOutput: CharacterRulePolicyOutput
  } | null = null
  let effectiveOutput = nextBaseOutput
  if (campaignMechanics.kind === 'MATERIALIZED') {
    const overlayFact = campaignMechanics.rulePolicyInput.hitPointFacts?.manualMaximumModifier
    if (campaignMechanics.manualMaximumModifierOwner === 'CAMPAIGN') {
      if (!overlayFact || overlayFact.source.kind !== 'MANUAL_ADJUSTMENT') {
        throw new CharacterSheetCommandError(
          'The committed Campaign maximum-hit-point modifier has invalid provenance.'
        )
      }
      nextCampaignPolicy = {
        rulePolicyInput: campaignMechanics.rulePolicyInput,
        rulePolicyOutput: campaignMechanics.rulePolicyOutput
      }
      effectiveOutput = campaignMechanics.rulePolicyOutput
    } else {
      if (
        campaignMechanics.manualMaximumModifierOwner !== (existing ? 'CHARACTER' : null) ||
        (existing === null && overlayFact != null) ||
        (existing !== null &&
          (!overlayFact ||
            overlayFact.source.kind !== 'MANUAL_ADJUSTMENT' ||
            overlayFact.source.adjustmentId !== existing.id ||
            overlayFact.sourceId !== existing.id ||
            overlayFact.value !== existing.value))
      ) {
        throw new CharacterSheetCommandError(
          'The committed Campaign maximum-hit-point modifier does not match canonical state.'
        )
      }
      if (!campaignMechanics.rulePolicyInput.hitPointFacts) {
        throw new CharacterSheetCommandError('The Campaign mechanics projection has no hit-point facts.')
      }
      const nextOverlayInput = characterRulePolicyInputSchema.parse({
        ...campaignMechanics.rulePolicyInput,
        hitPointFacts: {
          ...campaignMechanics.rulePolicyInput.hitPointFacts,
          manualMaximumModifier: nextManualMaximumModifier
        }
      })
      const evaluatedOverlay = await evaluatePinnedRuleRevision({
        db: params.db,
        expected: {
          revisionId: mechanics.ruleRevisionId,
          checksum: mechanics.ruleRevisionChecksum,
          evaluatorKind: 'ZEN',
          evaluatorVersion: mechanics.evaluatorVersion,
          modelContractVersion: mechanics.modelContractVersion
        },
        modelKey: 'character-policy',
        normalizedFacts: nextOverlayInput
      })
      if (
        evaluatedOverlay.checksum !== mechanics.ruleRevisionChecksum ||
        evaluatedOverlay.evaluatorKind !== 'ZEN' ||
        evaluatedOverlay.evaluatorVersion !== mechanics.evaluatorVersion ||
        evaluatedOverlay.modelContractVersion !== mechanics.modelContractVersion
      ) {
        throw new CharacterSheetCommandError('The pinned Campaign rule identity changed before evaluation.')
      }
      const nextOverlayOutput = characterRulePolicyOutputSchema.parse(evaluatedOverlay.result)
      nextCampaignPolicy = {
        rulePolicyInput: nextOverlayInput,
        rulePolicyOutput: nextOverlayOutput
      }
      effectiveOutput = nextOverlayOutput
    }
  } else if (campaignMechanics.manualMaximumModifierOwner !== (existing ? 'CHARACTER' : null)) {
    throw new CharacterSheetCommandError(
      'The base-reference Campaign maximum-hit-point provenance is stale.'
    )
  }
  const projectedHitPoints = mechanics.commandState.state.hitpoints
  if (
    projectedHitPoints.current !== context.hitPoints.current ||
    (projectedHitPoints.temp ?? null) !== context.hitPoints.temp
  ) {
    throw new CharacterSheetCommandError(
      'The committed hit-point command state does not match canonical state.'
    )
  }
  const nextHitPoints = {
    current: clampCharacterCurrentHitPoints(
      projectedHitPoints.current,
      resolveCharacterEffectiveMaximumHitPoints(effectiveOutput.derivedStats.maxHitPoints.effective)
    ),
    temp: projectedHitPoints.temp ?? null
  }
  const nextCharacterCommandState = {
    ...mechanics.commandState,
    state: {
      ...mechanics.commandState.state,
      hitpoints: {
        ...mechanics.commandState.state.hitpoints,
        current: nextHitPoints.current,
        temp: nextHitPoints.temp ?? undefined
      }
    }
  }
  const event = {
    type: 'CHARACTER_SHEET_COMMAND_APPLIED',
    eventId: crypto.randomUUID(),
    characterId: params.characterId,
    occurredAt: new Date().toISOString(),
    actorId: params.userId,
    commandId: command.commandId,
    schemaVersion: 1,
    commandType: command.type,
    commandFingerprint,
    committedStreamVersion: command.expectedVersion + 1,
    summary: nextAdjustment
      ? 'Updated maximum hit point modifier.'
      : 'Removed maximum hit point modifier.'
  } satisfies CharacterEvent
  if (nextAdjustment && typeof nextAdjustment.value !== 'number') {
    throw new CharacterSheetCommandError('The maximum-hit-point modifier value is invalid.')
  }
  const version = await policyRepository.prepareAndCommit({
    context,
    event,
    nextAdjustment: nextAdjustment
      ? { actorId: nextAdjustment.actorId, id: nextAdjustment.id, value: nextAdjustment.value }
      : null,
    nextHitPoints,
    nextCharacterCommandState,
    nextBasePolicy: {
      rulePolicyInput: nextBaseInput,
      rulePolicyOutput: nextBaseOutput
    },
    nextCampaignPolicy,
    nextManualMaximumModifierOwner:
      campaignMechanics.manualMaximumModifierOwner === 'CAMPAIGN'
        ? 'CAMPAIGN'
        : nextManualMaximumModifier
          ? 'CHARACTER'
          : null
  })
  return {
    characterVision: deriveCharacterSceneVision(params.characterId, effectiveOutput.senses),
    replayed: false,
    version
  }
}

function preservesCommittedCharacterMechanics(
  command: CharacterSheetCommandInputDto
): boolean {
  if (canReuseCommittedCharacterRuleEvaluation(command)) return true
  switch (command.type) {
    case 'UPGRADE_RULE_PACK':
    case 'UPSERT_SHEET_ADJUSTMENT':
    case 'REMOVE_SHEET_ADJUSTMENT':
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
    case 'SET_HIT_POINTS':
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
    case 'ADD_SHEET_EXTRA':
    case 'REMOVE_SHEET_EXTRA':
    case 'UPDATE_SHEET_EXTRA':
    case 'SET_SPELL_MECHANIC_CUSTOMIZATION':
    case 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION':
    case 'COMPLETE_REST':
    case 'SET_EXHAUSTION':
    case 'ADD_CONDITION':
    case 'REMOVE_CONDITION':
    case 'SET_PREPARED_SPELLS':
    case 'SET_KNOWN_SPELLS':
    case 'ADD_INVENTORY_ITEM':
    case 'REMOVE_INVENTORY_ITEM':
    case 'UPDATE_INVENTORY_ITEM':
    case 'EQUIP_ITEM':
    case 'UNEQUIP_ITEM':
    case 'ATTUNE_ITEM':
    case 'UNATTUNE_ITEM':
      return true
    default:
      return false
  }
}

export async function executeCharacterSheetCommandWithRuleEvaluation(
  params: ExecuteCharacterSheetCommandParams
): Promise<CharacterSheetCommandExecutionResult> {
  const startedAt = performance.now()
  const command = params.command
  const ruleResponsibility = classifyCharacterSheetCommandRuleResponsibility(command)
  const commandCanReuseCommittedRuleEvaluation = canReuseCommittedCharacterRuleEvaluation(command)
  const repository = createCharacterRepository(params.db)
  const recordLoadStartedAt = performance.now()
  const row = await repository.findById(params.characterId)
  const recordLoadMs = performance.now() - recordLoadStartedAt
  if (!row) {
    throw createNamedError('NotFoundError', `Character "${params.characterId}" was not found.`)
  }
  const authorityCheckStartedAt = performance.now()
  await assertCharacterLiveSessionCommandAuthority(
    params.db,
    params.characterId,
    params.liveSessionAuthority
  )
  const authorityCheckMs = performance.now() - authorityCheckStartedAt

  const campaignContextStartedAt = performance.now()
  const campaignContext = await resolveCharacterSheetCampaignContext(
    params.db,
    { id: row.id, userId: row.user_id },
    params.userId
  )
  const campaignContextMs = performance.now() - campaignContextStartedAt
  if (campaignContext.viewer === 'CAMPAIGN_OWNER') {
    if (campaignContext.campaignStatus !== 'ACTIVE') {
      throw new CharacterSheetCommandError('Archived Campaigns are read-only.')
    }
    assertCampaignGmSheetCommandAllowed(command)
  }

  if (row.status !== AUTHORED_RECORD_STATUS.ACTIVE) {
    throw new CharacterSheetCommandError(`Character "${params.characterId}" is not finalized yet.`)
  }
  if (!row.rule_pack_revision_id) {
    throw createNamedError(
      'CharacterRuleBindingError',
      `Active Character "${row.id}" does not have a pinned rule revision.`
    )
  }
  const currentRevisionId = row.rule_pack_revision_id
  const adjustmentRepository = createCharacterSheetAdjustmentRepository(params.db)
  const playStateRepository = createCharacterSheetPlayStateRepository(params.db)
  const inputHydrationStartedAt = performance.now()
  const sheetStateInputs = Promise.all([
    adjustmentRepository.listByCharacter(params.characterId),
    adjustmentRepository.getMovementPreference(params.characterId),
    playStateRepository.listResourceUsage(params.characterId),
    playStateRepository.listSpellCustomizations(params.characterId)
  ])
  // The normal command path awaits this promise below. Keep an early replay or
  // validation failure from surfacing an unrelated unhandled rejection first.
  void sheetStateInputs.catch(() => undefined)
  const campaignMechanicalContextChecksum = campaignContext.campaignId
    ? checksumCampaignCharacterMechanicalContext({
        adjustments: campaignContext.adjustments,
        attunementSlotOverride: campaignContext.attunementSlotOverride
      })
    : null
  const matchingCommittedRuleSnapshot =
    params.committedRuleSnapshot?.streamVersion === row.stream_version &&
    params.committedRuleSnapshot.evaluation.snapshot.characterId === row.id &&
    params.committedRuleSnapshot.evaluation.binding.revisionId === currentRevisionId &&
    params.committedRuleSnapshot.campaignMechanicalContextChecksum ===
      campaignMechanicalContextChecksum
      ? params.committedRuleSnapshot
      : undefined
  const matchingCommittedRuleEvaluation = matchingCommittedRuleSnapshot?.evaluation
  const canReuseCommittedRuleSources =
    matchingCommittedRuleSnapshot != null &&
    (ruleResponsibility === 'COMMITTED_SNAPSHOT' || command.type === 'UPGRADE_RULE_PACK')
  const loadsCommittedMechanics = preservesCommittedCharacterMechanics(command)
  const mechanicsProjectionLoadStartedAt = performance.now()
  const mechanicsRepository = createCharacterMechanicsProjectionRepository(params.db)
  const canAttemptCommittedSnapshotFastPath =
    params.liveSessionAuthority != null &&
    matchingCommittedRuleSnapshot != null &&
    commandCanReuseCommittedRuleEvaluation &&
    loadsCommittedMechanics
  let mechanics: CharacterMechanicsProjection | null = null
  let usesCommittedSnapshotFastPath = false
  let committedSnapshotCacheHit = false
  if (loadsCommittedMechanics && canAttemptCommittedSnapshotFastPath) {
    let metadata: CharacterMechanicsProjectionMetadata | null = null
    try {
      metadata = await mechanicsRepository.requireCurrentMetadata({
        characterId: row.id,
        expectedProjectionChecksum: matchingCommittedRuleSnapshot.mechanicsProjectionChecksum,
        expectedCommandLaneChecksum: matchingCommittedRuleSnapshot.mechanicsCommandLaneChecksum,
        expectedRuleRevisionId: currentRevisionId,
        expectedStreamVersion: row.stream_version
      })
    } catch {
      // A stale room snapshot uses the durable full-read path, which retains its
      // established fail-closed validation and error behavior.
    }
    if (
      metadata &&
      (metadata.commandState.state.creatures?.length ?? 0) === 0 &&
      (metadata.commandState.state.vehicles?.length ?? 0) === 0
    ) {
      mechanics = reconstituteCommittedSnapshotMechanics({
        metadata,
        payload: matchingCommittedRuleSnapshot.mechanicsPayload
      })
      usesCommittedSnapshotFastPath = true
      committedSnapshotCacheHit = true
    }
  }
  if (loadsCommittedMechanics && !mechanics) {
    mechanics = await mechanicsRepository.requireCurrent({
      characterId: row.id,
      expectedRuleRevisionId: currentRevisionId,
      expectedStreamVersion: row.stream_version
    })
  }
  const mechanicsProjectionLoadMs = performance.now() - mechanicsProjectionLoadStartedAt
  const character =
    mechanics?.commandState ??
    (await repository.findAuthoredById(params.characterId))
  if (!character) {
    throw createNamedError('NotFoundError', `Character "${params.characterId}" was not found.`)
  }
  const committedMechanics = mechanics
  let campaignMechanics: ResolvedCampaignCharacterMechanicsProjection | null = null
  let campaignSnapshotCacheHit = false
  if (campaignContext.campaignId && committedMechanics && campaignMechanicalContextChecksum) {
    const campaignRepository = createCampaignCharacterMechanicsProjectionRepository(params.db)
    if (
      usesCommittedSnapshotFastPath &&
      matchingCommittedRuleSnapshot?.campaignMechanicsProjectionChecksum
    ) {
      try {
        const metadata = await campaignRepository.requireCurrentMetadata({
          campaignId: campaignContext.campaignId,
          characterId: row.id,
          expectedBaseMechanicsProjectionChecksum: committedMechanics.projectionChecksum,
          expectedCharacterStreamVersion: row.stream_version,
          expectedMechanicalContextChecksum: campaignMechanicalContextChecksum,
          expectedProjectionChecksum:
            matchingCommittedRuleSnapshot.campaignMechanicsProjectionChecksum,
          expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION
        })
        campaignMechanics = {
          campaignId: campaignContext.campaignId,
          characterId: row.id,
          ...metadata,
          kind: 'BASE_REFERENCE',
          rulePolicyInput: committedMechanics.rulePolicyInput,
          rulePolicyOutput: committedMechanics.rulePolicyOutput
        }
        campaignSnapshotCacheHit = true
      } catch {
        // Materialized or stale Campaign overlays require the complete durable
        // projection; its repository validates the policy checksum.
      }
    }
    if (!campaignMechanics) {
      campaignMechanics = await campaignRepository.requireCurrent({
        campaignId: campaignContext.campaignId,
        characterId: row.id,
        expectedBaseMechanicsProjectionChecksum: committedMechanics.projectionChecksum,
        expectedCharacterStreamVersion: row.stream_version,
        expectedMechanicalContextChecksum: campaignMechanicalContextChecksum,
        expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
        baseMechanicsProjection: committedMechanics
      })
    }
  }
  const hasMatchingCampaignMechanicsSnapshot =
    !campaignContext.campaignId
      ? matchingCommittedRuleSnapshot?.campaignMechanicsProjectionChecksum === null
      : matchingCommittedRuleSnapshot?.campaignMechanicsProjectionChecksum ===
        campaignMechanics?.projectionChecksum
  const canReuseCommittedMechanicsOutput =
    commandCanReuseCommittedRuleEvaluation && committedMechanics !== null
  const reuseCommittedRuleEvaluation = canReuseCommittedMechanicsOutput
  const canReuseCommittedSnapshotSources =
    matchingCommittedRuleSnapshot != null &&
    hasMatchingCampaignMechanicsSnapshot &&
    canReuseCommittedMechanicsOutput &&
    canReuseCommittedCharacterRuleEvaluation(command) &&
    (character.state.creatures?.length ?? 0) === 0 &&
    (character.state.vehicles?.length ?? 0) === 0
  const eventRepository = createCharacterEventRepository(params.db)
  const commandFingerprint = fingerprintCharacterSheetCommand(params.command)
  const idempotencyLookupStartedAt = performance.now()
  const priorEvent = await eventRepository.findByCommandId(
    params.characterId,
    params.command.commandId
  )
  const idempotencyLookupMs = performance.now() - idempotencyLookupStartedAt
  if (priorEvent) {
    if (priorEvent.type !== 'CHARACTER_SHEET_COMMAND_APPLIED') {
      throw new CharacterSheetCommandError(
        `Command "${params.command.commandId}" was already used for a different operation.`
      )
    }
    if (priorEvent.commandType !== params.command.type) {
      throw new CharacterSheetCommandError(
        `Command "${params.command.commandId}" was already used for a different operation.`
      )
    }
    if (priorEvent.commandFingerprint !== commandFingerprint) {
      throw new CharacterSheetCommandError(
        `Command "${params.command.commandId}" was already used with different input.`
      )
    }
    const { bundle, mechanics, resolution, characterAdjustments, movementDisplayPreference } =
      await assembleCharacterSheetBundleForRuleContext({
        db: params.db,
        character,
        campaignId: campaignContext.campaignId,
        row,
        revisionId: row.rule_pack_revision_id,
        ruleContext: {
          adjustments: campaignContext.adjustments,
          additionalConditions: getVisibleCampaignConditions(campaignContext),
          attunementSlotOverride: campaignContext.attunementSlotOverride
        }
      })
    const sheet = projectCharacterSheetForViewer(bundle.sheet, campaignContext)
    const panels = buildRequestedPanels({
      character,
      resolution,
      bundle,
      characterAdjustments,
      movementDisplayPreference,
      targets: params.panelTargets,
      campaignContext
    })
    const response: CharacterSheetCommandResponseDto = {
      characterId: params.characterId,
      streamVersion: row.stream_version,
      sheet,
      ...(panels ? { panels } : {}),
      historyEntry: {
        eventId: priorEvent.eventId,
        occurredAt: priorEvent.occurredAt,
        actorId: priorEvent.actorId,
        eventType: priorEvent.type,
        summary:
          campaignContext.contentMaturity === 'STANDARD'
            ? maskStandardPlainText(priorEvent.summary)
            : priorEvent.summary,
        ...(priorEvent.result ? { result: priorEvent.result } : {})
      },
      ...(priorEvent.result ? { result: priorEvent.result } : {})
    }
    return {
      replayed: true,
      response,
      ruleSnapshot: {
        mechanicsProjectionChecksum: mechanics.projectionChecksum,
        mechanicsCommandLaneChecksum: mechanics.commandLaneChecksum,
        mechanicsPayload: {
          ruleSnapshot: mechanics.ruleSnapshot,
          rulePolicyInput: mechanics.rulePolicyInput,
          rulePolicyOutput: mechanics.rulePolicyOutput,
          ruleRegistry: mechanics.ruleRegistry
        },
        campaignMechanicalContextChecksum,
        campaignMechanicsProjectionChecksum: campaignMechanics?.projectionChecksum ?? null,
        streamVersion: row.stream_version,
        evaluation: bundle.ruleEvaluation,
        resolution
      }
    }
  }

  const committedSourceLoadStartedAt = performance.now()
  const committedSources = committedMechanics && !canReuseCommittedSnapshotSources
    ? await loadCharacterCommittedSheetSources({ db: params.db, mechanics: committedMechanics })
    : null
  const committedSourceLoadMs = performance.now() - committedSourceLoadStartedAt
  let nextCommittedSources = committedSources
  const committedResolution = committedSources
    ? createCharacterCommittedSheetResolution({ character, sources: committedSources })
    : (canReuseCommittedSnapshotSources ? matchingCommittedRuleSnapshot.resolution : null)
  const committedExtras = committedSources
    ? createCharacterCommittedSheetExtras({ character, sources: committedSources })
    : undefined
  const pinnedSpellsById = committedSources
    ? createCharacterCommittedSheetSpells(committedSources)
    : undefined
  const inputHydrationWaitStartedAt = performance.now()
  const [
    context,
    [characterAdjustments, movementDisplayPreference, resourceUsage, spellCustomizations]
  ] = await Promise.all([
    committedResolution
      ? Promise.resolve({
          catalog: committedResolution.catalog,
          registry: committedResolution.sourceRegistry
        })
      : matchingCommittedRuleEvaluation && canReuseCommittedMechanicsOutput
        ? Promise.resolve(matchingCommittedRuleEvaluation.context)
        : loadCharacterBuilderContext(params.db, character, [], { includeEffects: true }),
    sheetStateInputs
  ])
  const inputHydrationMs = performance.now() - inputHydrationWaitStartedAt
  const inputHydrationElapsedMs = performance.now() - inputHydrationStartedAt
  const adjustments = mergeCampaignSheetAdjustments(
    characterAdjustments,
    campaignContext.adjustments
  )
  const committedEvaluationStartedAt = performance.now()
  const committedRuleEvaluation =
    canReuseCommittedMechanicsOutput && mechanics && committedResolution
      ? createCommittedCharacterRuleEvaluation({
          character,
          context,
          mechanics,
          adjustments,
          movementDisplayPreference,
          ...(campaignMechanics
            ? {
                rulePolicy: {
                  input: campaignMechanics.rulePolicyInput,
                  output: campaignMechanics.rulePolicyOutput
                }
              }
            : {})
        })
      : undefined
  const committedEvaluationMs = performance.now() - committedEvaluationStartedAt

  if (row.stream_version !== params.command.expectedVersion) {
    throw new ConcurrencyError(params.characterId, params.command.expectedVersion)
  }

  if (command.type === 'UPGRADE_RULE_PACK' && campaignContext.viewer !== 'CHARACTER_OWNER') {
    throw new CharacterSheetCommandError('Only the Character owner can upgrade its rules.')
  }
  const targetRuleBinding =
    command.type === 'UPGRADE_RULE_PACK'
      ? await resolveCharacterRuleBinding({
          db: params.db,
          systemId: character.systemId,
          existingRevisionId: null,
          expectedRevisionId: command.revisionId
        })
      : null
  if (targetRuleBinding?.revisionId === row.rule_pack_revision_id) {
    throw new CharacterSheetCommandError('This Character already uses the active rule revision.')
  }
  const nextRuleRevisionId = targetRuleBinding?.revisionId ?? currentRevisionId

  const builderResolutionStartedAt = performance.now()
  const resolution =
    committedResolution ??
    (canReuseCommittedRuleSources
      ? matchingCommittedRuleSnapshot.resolution
      : await resolveCharacterBuilder(
          params.db,
          character,
          'edit',
          context,
          null,
          row.rule_pack_revision_id
        ))
  const builderResolutionMs = performance.now() - builderResolutionStartedAt
  if (command.type === 'UPSERT_SHEET_ADJUSTMENT') {
    validateSheetAdjustmentTarget(command.adjustment, resolution, character)
  }
  if (command.type === 'REMOVE_SHEET_ADJUSTMENT') {
    validatePanelTarget(command.target, resolution, character)
    const existing = characterAdjustments.find(
      (adjustment) => adjustment.id === command.adjustmentId && adjustment.family === command.family
    )
    if (!existing || !characterSheetAdjustmentMatchesPanelTarget(existing, command.target)) {
      throw new CharacterSheetCommandError(
        `Adjustment "${command.adjustmentId}" is not available in this panel.`
      )
    }
  }
  if (command.type === 'RESET_SHEET_PANEL_ADJUSTMENTS') {
    validatePanelTarget(command.target, resolution, character)
  }
  if (
    command.type === 'SET_MOVEMENT_DISPLAY_PREFERENCE' &&
    command.preference.mode === 'EXPLICIT'
  ) {
    const speedId = command.preference.speedId
    if (!resolution.registry.system?.speeds.some((speed) => speed.id === speedId)) {
      throw new CharacterSheetCommandError(
        `Movement type "${speedId}" is not available in this rules system.`
      )
    }
  }
  if (params.command.type === 'ADD_INVENTORY_ITEM') {
    const equipmentId = params.command.equipmentId
    const equipmentAlreadyLoaded = resolution.registry.equipment.some(
      (equipment) => equipment.id === equipmentId
    )
    if (!equipmentAlreadyLoaded) {
      const equipment = (
        await resolveActiveCharacterEquipment(
          params.db,
          [equipmentId],
          character.systemId,
          character.userId
        )
      )[0]
      if (equipment) {
        resolution.registry.equipment.push(equipment)
        if (!context.registry.equipment.some((entry) => entry.id === equipment.id)) {
          context.registry.equipment.push(equipment)
        }
      }
    }
  }
  const currentProjectionStartedAt = performance.now()
  const currentBundle = await buildCharacterSheetBundle({
    db: params.db,
    character,
    resolution,
    streamVersion: row.stream_version,
    adjustments,
    movementDisplayPreference,
    resourceUsage,
    spellCustomizations,
    committedExtras,
    pinnedSpellsById,
    ruleEvaluation: {
      context,
      revisionId: row.rule_pack_revision_id,
      attunementSlotOverride: campaignContext.attunementSlotOverride
    },
    committedRuleEvaluation:
      committedRuleEvaluation ??
      (canReuseCommittedMechanicsOutput ? matchingCommittedRuleEvaluation : undefined)
  })
  const currentProjectionMs = performance.now() - currentProjectionStartedAt
  const commandPreparationStartedAt = performance.now()
  const currentSheet = currentBundle.sheet
  if (!currentBundle.ruleEvaluation) {
    throw createNamedError(
      'CharacterRuleBindingError',
      `Character "${character.id}" did not produce a rule evaluation.`
    )
  }
  const attunementSlotLimit = currentBundle.ruleEvaluation.output.rest.attunementSlotLimit
  const upgradeBundle = targetRuleBinding
    ? await buildCharacterSheetBundle({
        db: params.db,
        character,
        resolution,
        streamVersion: row.stream_version,
        adjustments,
        movementDisplayPreference,
        resourceUsage,
        spellCustomizations,
        committedExtras,
        pinnedSpellsById,
        ruleEvaluation: {
          context,
          revisionId: targetRuleBinding.revisionId,
          attunementSlotOverride: campaignContext.attunementSlotOverride
        }
      })
    : null
  if (upgradeBundle && !upgradeBundle.ruleEvaluation) {
    throw createNamedError(
      'CharacterRuleBindingError',
      `Character "${character.id}" did not produce an upgraded rule evaluation.`
    )
  }
  const rawResourceUsageByOwner = new Map(
    resourceUsage.map((usage) => [createCharacterResourceOwnerKey(usage.owner), usage.used])
  )
  const getRawResourceUsed = (resource: SheetResource) =>
    rawResourceUsageByOwner.get(
      createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(resource.owner))
    ) ?? resource.used
  if (
    command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION' ||
    command.type === 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION'
  ) {
    validateSpellMechanicCustomization(command, currentSheet)
  }
  if (command.type === 'UPDATE_SPELL_SOURCE_CUSTOMIZATION') {
    validateSpellSource(command.source, currentSheet)
  }
  if (command.type === 'USE_SHEET_RESOURCE' || command.type === 'RECOVER_SHEET_RESOURCE') {
    const resource = ensureResourceByOwner(currentSheet, command.owner)
    if (command.type === 'USE_SHEET_RESOURCE') {
      validateActionResourceUse({
        sheet: currentSheet,
        actionId: command.actionId,
        resourceId: resource.id,
        amount: command.amount ?? 1
      })
    }
    if (command.type === 'USE_SHEET_RESOURCE' && (command.amount ?? 1) > resource.remaining) {
      throw new CharacterSheetCommandError(
        `Resource "${resource.label}" only has ${resource.remaining} ${
          resource.remaining === 1 ? 'use' : 'uses'
        } remaining.`
      )
    }
    if (
      command.type === 'RECOVER_SHEET_RESOURCE' &&
      !resource.recoveries.some((recovery) => recovery.trigger === command.trigger)
    ) {
      throw new CharacterSheetCommandError(
        `Resource cannot be recovered by ${formatCodeLabel(command.trigger)}.`
      )
    }
  }
  if (command.type === 'USE_RESOURCE') {
    validateActionResourceUse({
      sheet: currentSheet,
      actionId: command.actionId,
      resourceId: command.resourceGrantId,
      amount: command.amount ?? 1
    })
  }
  const prospectiveCharacterAdjustments = getProspectiveSheetAdjustments({
    adjustments: characterAdjustments,
    characterId: params.characterId,
    command,
    userId: params.userId
  })
  const prospectiveAdjustments = mergeCampaignSheetAdjustments(
    prospectiveCharacterAdjustments,
    campaignContext.adjustments
  )
  const shouldPersistHitPointClamp =
    (command.type === 'UPSERT_SHEET_ADJUSTMENT' && command.adjustment.family === 'HIT_POINTS') ||
    (command.type === 'REMOVE_SHEET_ADJUSTMENT' && command.family === 'HIT_POINTS') ||
    (command.type === 'RESET_SHEET_PANEL_ADJUSTMENTS' && command.target.kind === 'HIT_POINTS') ||
    (command.type === 'SET_HIT_POINTS' && command.maxOverride !== undefined)
  const extraDefaults = {
    creatures: new Map<string, { hitPoints: number; hitDice?: { count: number; die: number } }>(),
    vehicles: new Map<string, { hitPoints?: number }>()
  }
  if (command.type === 'ADD_SHEET_EXTRA') {
    const extra = command.extra
    if ('vehicleId' in extra) {
      let vehicle: VehicleAuthored | undefined
      if (nextCommittedSources) {
        nextCommittedSources = await extendCharacterCommittedSheetSourcesWithActiveRoots({
          db: params.db,
          sources: nextCommittedSources,
          roots: [{ subjectKind: 'VEHICLE', subjectId: extra.vehicleId }],
          systemId: character.systemId,
          userId: character.userId
        })
        vehicle = createCharacterCommittedSheetExtras({
          character,
          sources: nextCommittedSources
        }).vehiclesById.get(extra.vehicleId)
      } else {
        vehicle = (
          await loadActiveCharacterVehicles({
            characterId: character.id,
            db: params.db,
            vehicleIds: [extra.vehicleId],
            systemId: character.systemId,
            userId: character.userId
          })
        ).get(extra.vehicleId)
      }
      if (!vehicle) {
        throw new CharacterSheetCommandError(
          `Vehicle "${extra.vehicleId}" is not available for this character.`
        )
      }
      if ((vehicle.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE) {
        throw new CharacterSheetCommandError(
          `Vehicle "${extra.vehicleId}" is not available for this character.`
        )
      }
      extraDefaults.vehicles.set(vehicle.id, { hitPoints: vehicle.hitPoints })
    } else {
      let creature: CreatureAuthored | undefined
      if (nextCommittedSources) {
        nextCommittedSources = await extendCharacterCommittedSheetSourcesWithActiveRoots({
          db: params.db,
          sources: nextCommittedSources,
          roots: [{ subjectKind: 'CREATURE', subjectId: extra.creatureId }],
          systemId: character.systemId,
          userId: character.userId
        })
        creature = createCharacterCommittedSheetExtras({
          character,
          sources: nextCommittedSources
        }).creaturesById.get(extra.creatureId)
      } else {
        creature = (
          await loadActiveCharacterCreatures({
            characterId: character.id,
            db: params.db,
            creatureIds: [extra.creatureId],
            systemId: character.systemId,
            userId: character.userId
          })
        ).get(extra.creatureId)
      }
      if (!creature) {
        throw new CharacterSheetCommandError(
          `Creature "${extra.creatureId}" is not available for this character.`
        )
      }
      if ((creature.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE) {
        throw new CharacterSheetCommandError(
          `Creature "${extra.creatureId}" is not available for this character.`
        )
      }
      extraDefaults.creatures.set(creature.id, {
        hitPoints: creature.hitPoints,
        ...(creature.hitDice ? { hitDice: creature.hitDice } : {})
      })
    }
  }
  if (command.type === 'COMPLETE_REST') {
    await verifyRestRollEvidence({
      characterId: params.characterId,
      db: params.db,
      evidence: command.rollEvidence,
      rollId: command.rollId,
      userId: params.userId
    })
  }
  const resetMaximumModifier =
    command.type === 'COMPLETE_REST' && command.resetMaximumHitPointModifier
      ? characterAdjustments.find(
          (adjustment) =>
            adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_MODIFIER'
        )
      : undefined
  const restBundle = resetMaximumModifier
    ? await buildCharacterSheetBundle({
        db: params.db,
        character,
        resolution,
        streamVersion: row.stream_version,
        adjustments: adjustments.filter((adjustment) => adjustment.id !== resetMaximumModifier.id),
        movementDisplayPreference,
        resourceUsage,
        spellCustomizations,
        committedExtras,
        pinnedSpellsById,
        additionalConditions: getVisibleCampaignConditions(campaignContext),
        ruleEvaluation: {
          context,
          revisionId: row.rule_pack_revision_id,
          attunementSlotOverride: campaignContext.attunementSlotOverride
        }
      })
    : currentBundle
  if (!restBundle.ruleEvaluation) {
    throw createNamedError(
      'CharacterRuleBindingError',
      `Character "${character.id}" did not produce a rest rule evaluation.`
    )
  }
  const restPreview =
    command.type === 'COMPLETE_REST'
      ? buildCharacterRestPreview({
          character,
          resolution,
          characterAdjustments,
          effectiveMaximum: resolveCharacterEffectiveMaximumHitPoints(
            restBundle.sheet.overview.maxHitPoints
          ),
          restPolicy: restBundle.ruleEvaluation.output.rest,
          ruleRevisionId: row.rule_pack_revision_id,
          sheet: currentSheet,
          input: {
            restKind: command.restKind,
            expectedVersion: command.expectedVersion,
            selectedHitDice: command.selectedHitDice,
            resetMaximumHitPointModifier: command.resetMaximumHitPointModifier,
            healingMode: command.healingMode,
            manualHealingAccepted: command.manualHealingAccepted,
            selectedCompanionInstanceIds: command.selectedCompanionInstanceIds,
            ...(command.rollId ? { rollId: command.rollId } : {}),
            ...(command.rollEvidence ? { rollEvidence: command.rollEvidence } : {}),
            requestRoll: false
          }
        })
      : undefined
  if (
    command.type === 'COMPLETE_REST' &&
    restPreview &&
    restPreview.previewFingerprint !== command.previewFingerprint
  ) {
    throw new ConcurrencyError(params.characterId, command.expectedVersion)
  }
  if (restPreview && !restPreview.canApply) {
    throw new CharacterSheetCommandError('This rest has no completed recovery to apply.')
  }
  const completedRest =
    command.type === 'COMPLETE_REST' && restPreview
      ? applyCompletedCharacterRest({
          character,
          command,
          preview: restPreview,
          restPolicy: restBundle.ruleEvaluation.output.rest,
          sheet: currentSheet
        })
      : undefined
  const shouldResetMaximumHitPointModifier =
    resetMaximumModifier !== undefined &&
    restPreview?.hitPoints.canResetMaximumHitPointModifier === true
  const nextCharacterProjectionAdjustments = shouldResetMaximumHitPointModifier
    ? prospectiveCharacterAdjustments.filter(
        (adjustment) => adjustment.id !== resetMaximumModifier?.id
      )
    : prospectiveCharacterAdjustments
  const nextProjectionAdjustments = mergeCampaignSheetAdjustments(
    nextCharacterProjectionAdjustments,
    campaignContext.adjustments
  )
  const removedVehicle =
    command.type === 'REMOVE_SHEET_EXTRA' && command.extra.kind === 'VEHICLE'
      ? character.state.vehicles?.find((vehicle) => vehicle.id === command.extra.extraId)
      : undefined
  const removedCreature =
    command.type === 'REMOVE_SHEET_EXTRA' && command.extra.kind !== 'VEHICLE'
      ? character.state.creatures?.find((creature) => creature.id === command.extra.extraId)
      : undefined
  const removedAuthoredRoot = removedVehicle
    ? { subjectKind: 'VEHICLE' as const, subjectId: removedVehicle.vehicleId }
    : removedCreature
      ? { subjectKind: 'CREATURE' as const, subjectId: removedCreature.creatureId }
      : undefined
  let nextCharacter =
    completedRest?.character ??
    applyCharacterSheetCommand(character, params.command, currentSheet, {
      adjustments,
      attunementSlotLimit,
      extraDefaults
    })
  if (nextCommittedSources && removedAuthoredRoot) {
    const stillReferenced =
      removedAuthoredRoot.subjectKind === 'CREATURE'
        ? nextCharacter.state.creatures?.some(
            (creature) => creature.creatureId === removedAuthoredRoot.subjectId
          )
        : nextCharacter.state.vehicles?.some(
            (vehicle) => vehicle.vehicleId === removedAuthoredRoot.subjectId
          )
    if (!stillReferenced) {
      nextCommittedSources = pruneCharacterCommittedSheetSourcesRoots({
        sources: nextCommittedSources,
        roots: [removedAuthoredRoot]
      })
    }
  }
  if (upgradeBundle) {
    nextCharacter = {
      ...nextCharacter,
      state: {
        ...nextCharacter.state,
        hitpoints: {
          ...nextCharacter.state.hitpoints,
          current: clampCharacterCurrentHitPoints(
            nextCharacter.state.hitpoints.current,
            resolveCharacterEffectiveMaximumHitPoints(
              upgradeBundle.ruleProjection.derivedStats.maxHitPoints
            )
          )
        }
      }
    }
  }
  if (shouldPersistHitPointClamp) {
    const prospectiveContext =
      committedResolution
        ? context
        : await loadCharacterBuilderContext(params.db, nextCharacter, [], { includeEffects: true })
    const prospectiveResolution =
      committedResolution ??
      (await resolveCharacterBuilder(
        params.db,
        nextCharacter,
        'edit',
        prospectiveContext,
        null,
        row.rule_pack_revision_id
      ))
    const prospectiveBundle = await buildCharacterSheetBundle({
      db: params.db,
      character: nextCharacter,
      resolution: prospectiveResolution,
      streamVersion: row.stream_version,
      adjustments: prospectiveAdjustments,
      movementDisplayPreference,
      resourceUsage,
      spellCustomizations,
      committedExtras,
      pinnedSpellsById,
      ruleEvaluation: {
        context: prospectiveContext,
        revisionId: row.rule_pack_revision_id,
        attunementSlotOverride: campaignContext.attunementSlotOverride
      }
    })
    const maximumHitPoints = resolveCharacterEffectiveMaximumHitPoints(
      prospectiveBundle.ruleProjection.derivedStats.maxHitPoints
    )
    if (!prospectiveBundle.ruleEvaluation) {
      throw createNamedError(
        'CharacterRuleBindingError',
        `Character "${character.id}" did not produce a prospective rule evaluation.`
      )
    }
    nextCharacter = {
      ...nextCharacter,
      state: {
        ...nextCharacter.state,
        hitpoints: {
          ...nextCharacter.state.hitpoints,
          current: clampCharacterCurrentHitPoints(
            nextCharacter.state.hitpoints.current,
            maximumHitPoints
          )
        }
      }
    }
  }
  const nextCommittedResolution = nextCommittedSources
    ? createCharacterCommittedSheetResolution({
        character: nextCharacter,
        sources: nextCommittedSources
      })
    : (canReuseCommittedSnapshotSources ? matchingCommittedRuleSnapshot.resolution : null)
  const nextCommittedExtras = nextCommittedSources
    ? createCharacterCommittedSheetExtras({
        character: nextCharacter,
        sources: nextCommittedSources
      })
    : undefined
  const nextPinnedSpellsById = nextCommittedSources
    ? createCharacterCommittedSheetSpells(nextCommittedSources)
    : undefined
  const nextExactContext = nextCommittedResolution
    ? {
        catalog: nextCommittedResolution.catalog,
        registry: nextCommittedResolution.sourceRegistry
      }
    : context
  let resourceUsageUpdate: { resource: SheetResource; used: number } | undefined
  switch (command.type) {
    case 'USE_RESOURCE': {
      const resource = ensureResource(currentSheet, command.resourceGrantId)
      resourceUsageUpdate = {
        resource,
        used: getRawResourceUsed(resource) + (command.amount ?? 1)
      }
      break
    }
    case 'RESTORE_RESOURCE': {
      const resource = ensureResource(currentSheet, command.resourceGrantId)
      resourceUsageUpdate = {
        resource,
        used: command.all ? 0 : Math.max(getRawResourceUsed(resource) - (command.amount ?? 1), 0)
      }
      break
    }
    case 'USE_SHEET_RESOURCE': {
      const resource = ensureResourceByOwner(currentSheet, command.owner)
      resourceUsageUpdate = {
        resource,
        used: getRawResourceUsed(resource) + (command.amount ?? 1)
      }
      break
    }
    case 'RECOVER_SHEET_RESOURCE':
      resourceUsageUpdate = {
        resource: ensureResourceByOwner(currentSheet, command.owner),
        used: 0
      }
      break
    case 'CAST_SPELL': {
      const { source, spell } = resolveSpellCastSource(currentSheet, command)
      const castMode = source?.castMode ?? 'SPELL_SLOT'
      if (
        spell.level > 0 &&
        (castMode === 'LIMITED_USE' || castMode === 'FIXED_LEVEL') &&
        source?.resourceOwner
      ) {
        const resource = ensureResourceByOwner(currentSheet, source.resourceOwner)
        resourceUsageUpdate = {
          resource,
          used: getRawResourceUsed(resource) + 1
        }
      }
      break
    }
  }
  const changedPoolId = resourceUsageUpdate
    ? createCharacterResourceOwnerKey(
        toCharacterResourceOwnerKey(resourceUsageUpdate.resource.owner)
      )
    : undefined
  const changedSpellSlotKey =
    command.type === 'USE_SPELL_SLOT' || command.type === 'RESTORE_SPELL_SLOT'
      ? command.slotKey
      : command.type === 'CAST_SPELL' && resourceUsageUpdate === undefined
        ? (command.slotKey ?? undefined)
        : undefined
  const recoveredResourceOwnerKeys = new Set(
    completedRest
      ? currentSheet.resources.items
          .filter((resource) => completedRest.allRecoveredResourceIds.includes(resource.id))
          .map((resource) =>
            createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(resource.owner))
          )
      : []
  )
  const resourceUsageAfterRest = recoveredResourceOwnerKeys.size
    ? resourceUsage.map((usage) =>
        recoveredResourceOwnerKeys.has(createCharacterResourceOwnerKey(usage.owner))
          ? { ...usage, used: 0 }
          : usage
      )
    : resourceUsage
  const prospectiveResourceUsage: readonly CharacterResourceUsage[] = resourceUsageUpdate
    ? [
        ...resourceUsageAfterRest.filter(
          (usage) => createCharacterResourceOwnerKey(usage.owner) !== changedPoolId
        ),
        ...(resourceUsageUpdate.used === 0
          ? []
          : [
              (() => {
                const owner = toCharacterResourceOwnerKey(resourceUsageUpdate.resource.owner)
                const existing = resourceUsageAfterRest.find(
                  (usage) => createCharacterResourceOwnerKey(usage.owner) === changedPoolId
                )
                if (existing) return { ...existing, used: resourceUsageUpdate.used }
                const occurredAt = new Date().toISOString()
                return {
                  id: crypto.randomUUID(),
                  characterId: params.characterId,
                  owner,
                  used: resourceUsageUpdate.used,
                  createdBy: params.userId,
                  updatedBy: params.userId,
                  createdAt: occurredAt,
                  updatedAt: occurredAt
                }
              })()
            ])
      ]
    : resourceUsageAfterRest
  let boundedActionEvaluation: CharacterRuleEvaluationResult | undefined
  let boundedEvaluationMs = 0
  let boundedZenEvaluationMs = 0
  const actionStateChanged = changedPoolId !== undefined || changedSpellSlotKey !== undefined
  const prospectiveMovementDisplayPreference =
    command.type === 'SET_MOVEMENT_DISPLAY_PREFERENCE'
      ? command.preference
      : movementDisplayPreference
  if (
    actionStateChanged &&
    currentBundle.ruleEvaluation.binding.modelContractVersion >=
      CHARACTER_ACTION_SPELL_STATE_CONTRACT_VERSION
  ) {
    const boundedEvaluationStartedAt = performance.now()
    const bounded = await evaluateCharacterActionStateChange({
      db: params.db,
      committed: currentBundle.ruleEvaluation,
      ...(changedPoolId === undefined ? {} : { changedPoolId }),
      ...(changedSpellSlotKey === undefined ? {} : { changedSpellSlotKey }),
      resourceUsage: prospectiveResourceUsage,
      spellSlotUsage: nextCharacter.state.spellSlots ?? []
    })
    boundedActionEvaluation = bounded.ruleEvaluation
    boundedZenEvaluationMs = bounded.zenEvaluationMs
    boundedEvaluationMs = performance.now() - boundedEvaluationStartedAt
  }
  const statePatches = createCharacterSheetStatePatches(character, nextCharacter)
  const summary = summarizeCharacterSheetCommand(params.command, currentSheet)
  const commandResult = completedRest
    ? ({ type: 'COMPLETE_REST', rest: completedRest.result } as const)
    : undefined
  const event = {
    type: 'CHARACTER_SHEET_COMMAND_APPLIED',
    eventId: crypto.randomUUID(),
    characterId: params.characterId,
    occurredAt: new Date().toISOString(),
    actorId: params.userId,
    commandId: params.command.commandId,
    schemaVersion: 1,
    commandType: params.command.type,
    commandFingerprint,
    summary:
      campaignContext.contentMaturity === 'STANDARD' ? maskStandardPlainText(summary) : summary,
    ...(commandResult ? { result: commandResult } : {})
  } satisfies CharacterEvent
  const commandPreparationMs = performance.now() - commandPreparationStartedAt
  const canReuseNextBaseRuleEvaluation =
    canReuseCommittedCharacterRuleEvaluation(command) &&
    (!actionStateChanged ||
      currentBundle.ruleEvaluation.binding.modelContractVersion >=
        CHARACTER_ACTION_SPELL_STATE_CONTRACT_VERSION)
  const nextBaseCommittedRuleEvaluation =
    !campaignContext.campaignId && boundedActionEvaluation
      ? boundedActionEvaluation
      : canReuseNextBaseRuleEvaluation && mechanics
        ? createCommittedCharacterRuleEvaluation({
            character: nextCharacter,
            context: nextExactContext,
            mechanics,
            adjustments: nextCharacterProjectionAdjustments,
            movementDisplayPreference: prospectiveMovementDisplayPreference
          })
        : undefined
  const nextBaseBundle =
    nextBaseCommittedRuleEvaluation && campaignContext.campaignId
      ? null
      : await buildCharacterSheetBundle({
      db: params.db,
      character: nextCharacter,
      resolution: nextCommittedResolution ?? resolution,
      streamVersion: row.stream_version + 1,
      adjustments: nextCharacterProjectionAdjustments,
      movementDisplayPreference: prospectiveMovementDisplayPreference,
      resourceUsage: prospectiveResourceUsage,
      spellCustomizations,
      committedExtras: nextCommittedExtras,
      pinnedSpellsById: nextPinnedSpellsById,
      ruleEvaluation: {
        context: nextExactContext,
        revisionId: nextRuleRevisionId,
        attunementSlotOverride: null
      },
      ...(nextBaseCommittedRuleEvaluation
        ? { committedRuleEvaluation: nextBaseCommittedRuleEvaluation }
        : {})
        })
  const nextBaseRuleEvaluation = nextBaseCommittedRuleEvaluation ?? nextBaseBundle?.ruleEvaluation
  const mechanicsProjectionCompilationStartedAt = performance.now()
  const nextMechanicsProjection =
    committedMechanics && nextBaseRuleEvaluation
      ? compileCharacterMechanicsProjection({
          characterId: character.id,
          characterCommandState: nextCharacter,
          characterStreamVersion: row.stream_version + 1,
          vocabularySnapshot: nextCommittedSources?.vocabularySnapshot ?? {
            snapshotId: committedMechanics.systemVocabularySnapshotId,
            snapshotVersion: committedMechanics.systemVocabularySnapshotVersion,
            checksum: committedMechanics.systemVocabularySnapshotChecksum
          },
          ruleBinding: nextBaseRuleEvaluation.binding,
          rulePolicyInput: nextBaseRuleEvaluation.facts,
          rulePolicyOutput: nextBaseRuleEvaluation.output,
          ruleRegistry: nextBaseRuleEvaluation.registry,
          ruleSnapshot: nextBaseRuleEvaluation.snapshot,
          authoredVersionVector:
            nextCommittedSources?.mechanics.authoredVersionVector ??
            committedMechanics.authoredVersionVector,
        })
      : null
  const mechanicsProjectionCompilationMs =
    performance.now() - mechanicsProjectionCompilationStartedAt
  if (!nextMechanicsProjection) {
    throw createNamedError(
      'CharacterMechanicsProjectionMismatchError',
      `Character "${character.id}" did not produce its next committed mechanics projection.`
    )
  }
  let nextStreamVersion: number
  const campaignPublication: { mechanics: CampaignCharacterMechanicsProjection | null } = {
    mechanics: null
  }
  let mechanicsProjectionPublication: CharacterMechanicsProjectionPublicationTiming | undefined
  let campaignProjectionRuleContextMs = 0
  let campaignProjectionCompilationMs = 0
  let campaignProjectionPublicationMs = 0
  let characterEventAppendMs = 0
  const transactionStartedAt = performance.now()
  try {
    nextStreamVersion = await repository.patchSheetState(params.characterId, statePatches, {
      expectedStreamVersion: params.command.expectedVersion,
      ...(campaignContext.campaignId
        ? {
            beforeCharacterLock: (trx) =>
              createCampaignCharacterMechanicsProjectionRepository(trx).lockAssignment({
                campaignId: campaignContext.campaignId as string,
                characterId: params.characterId
              })
          }
        : {}),
      afterPersist: async (trx, persistedStreamVersion) => {
        await assertCharacterLiveSessionCommandAuthority(
          trx,
          params.characterId,
          params.liveSessionAuthority
        )
        if (targetRuleBinding) {
          await resolveCharacterRuleBinding({
            db: trx,
            systemId: character.systemId,
            existingRevisionId: null,
            expectedRevisionId: targetRuleBinding.revisionId
          })
          if (
            !(await createCharacterRepository(trx).setRulePackRevision(
              params.characterId,
              currentRevisionId,
              targetRuleBinding.revisionId
            ))
          ) {
            throw new ConcurrencyError(params.characterId, params.command.expectedVersion)
          }
        }
        const typedAdjustmentRepository = createCharacterSheetAdjustmentRepository(trx)
        const typedPlayStateRepository = createCharacterSheetPlayStateRepository(trx)
        if (command.type === 'UPSERT_SHEET_ADJUSTMENT') {
          const prospective = prospectiveAdjustments.find((adjustment) =>
            sameCharacterSheetAdjustmentSlot(adjustment, command.adjustment)
          )
          if (!prospective) {
            throw createNamedError(
              'CharacterRuleBindingError',
              `Character "${character.id}" did not produce a prospective adjustment.`
            )
          }
          await typedAdjustmentRepository.upsert({
            ...command.adjustment,
            id: prospective.id,
            characterId: params.characterId,
            actorId: params.userId
          })
        }
        if (command.type === 'REMOVE_SHEET_ADJUSTMENT') {
          await typedAdjustmentRepository.remove({
            characterId: params.characterId,
            adjustmentId: command.adjustmentId,
            family: command.family
          })
        }
        if (command.type === 'RESET_SHEET_PANEL_ADJUSTMENTS') {
          for (const adjustment of getCharacterSheetPanelAdjustmentIds(
            characterAdjustments,
            command.target
          )) {
            await typedAdjustmentRepository.remove({
              characterId: params.characterId,
              adjustmentId: adjustment.id,
              family: adjustment.family
            })
          }
        }
        if (command.type === 'REMOVE_SHEET_EXTRA' && command.extra.kind !== 'VEHICLE') {
          const target = {
            kind: 'COMPANION' as const,
            companionInstanceId: command.extra.extraId
          }
          for (const adjustment of characterAdjustments) {
            if (!characterSheetAdjustmentMatchesPanelTarget(adjustment, target)) continue
            await typedAdjustmentRepository.remove({
              characterId: params.characterId,
              adjustmentId: adjustment.id,
              family: adjustment.family
            })
          }
          for (const usage of resourceUsage) {
            if (
              usage.owner.kind !== 'COMPANION_FEATURE' ||
              usage.owner.companionInstanceId !== command.extra.extraId
            ) {
              continue
            }
            await typedPlayStateRepository.setResourceUsage({
              id: usage.id,
              characterId: params.characterId,
              actorId: params.userId,
              owner: usage.owner,
              used: 0
            })
          }
        }
        if (command.type === 'SET_MOVEMENT_DISPLAY_PREFERENCE') {
          await typedAdjustmentRepository.setMovementPreference({
            characterId: params.characterId,
            actorId: params.userId,
            preference: command.preference
          })
        }
        if (command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION') {
          const fields = getSpellCustomizationFields(command.category)
          for (const adjustment of characterAdjustments) {
            if (
              adjustment.family === 'SPELL' &&
              sameSpellSource(adjustment.source, command.source) &&
              fields.includes(adjustment.field)
            ) {
              await typedAdjustmentRepository.remove({
                characterId: params.characterId,
                adjustmentId: adjustment.id,
                family: 'SPELL'
              })
            }
          }
          const prospective = nextProjectionAdjustments.find(
            (adjustment) =>
              adjustment.family === 'SPELL' &&
              sameSpellSource(adjustment.source, command.source) &&
              adjustment.field === getSpellCustomizationField(command)
          )
          if (!prospective) {
            throw createNamedError(
              'CharacterRuleBindingError',
              `Character "${character.id}" did not produce a prospective spell adjustment.`
            )
          }
          await typedAdjustmentRepository.upsert({
            id: prospective.id,
            characterId: params.characterId,
            actorId: params.userId,
            family: 'SPELL',
            source: command.source,
            field: getSpellCustomizationField(command),
            value: command.value,
            ...(command.sourceNote ? { sourceNote: command.sourceNote } : {})
          })
        }
        if (command.type === 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION') {
          const fields = getSpellCustomizationFields(command.category)
          for (const adjustment of characterAdjustments) {
            if (
              adjustment.family === 'SPELL' &&
              sameSpellSource(adjustment.source, command.source) &&
              fields.includes(adjustment.field)
            ) {
              await typedAdjustmentRepository.remove({
                characterId: params.characterId,
                adjustmentId: adjustment.id,
                family: 'SPELL'
              })
            }
          }
        }
        if (command.type === 'UPDATE_SPELL_SOURCE_CUSTOMIZATION') {
          const existing = spellCustomizations.find(
            (customization) =>
              createCharacterSpellSourceKey(customization.source) ===
              createCharacterSpellSourceKey(command.source)
          )
          await typedPlayStateRepository.setSpellCustomization({
            id: existing?.id ?? crypto.randomUUID(),
            characterId: params.characterId,
            actorId: params.userId,
            source: command.source,
            customName:
              command.customName === undefined
                ? existing?.customName
                : (command.customName ?? undefined),
            notes: command.notes === undefined ? existing?.notes : (command.notes ?? undefined),
            displayAsAttack: command.displayAsAttack ?? existing?.displayAsAttack ?? false
          })
        }
        if (resourceUsageUpdate) {
          const owner = toCharacterResourceOwnerKey(resourceUsageUpdate.resource.owner)
          const resourceOwnerKey = createCharacterResourceOwnerKey(owner)
          const existing = resourceUsage.find(
            (usage) => createCharacterResourceOwnerKey(usage.owner) === resourceOwnerKey
          )
          await typedPlayStateRepository.setResourceUsage({
            id: existing?.id ?? crypto.randomUUID(),
            characterId: params.characterId,
            actorId: params.userId,
            owner,
            used: resourceUsageUpdate.used
          })
        }
        if (params.command.type === 'SET_HIT_POINTS' && params.command.maxOverride !== undefined) {
          const existing = characterAdjustments.find(
            (adjustment) =>
              adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_OVERRIDE'
          )
          if (params.command.maxOverride === null) {
            if (existing) {
              await typedAdjustmentRepository.remove({
                characterId: params.characterId,
                adjustmentId: existing.id,
                family: 'HIT_POINTS'
              })
            }
          } else {
            const prospective = nextProjectionAdjustments.find(
              (adjustment) =>
                adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_OVERRIDE'
            )
            if (!prospective) {
              throw createNamedError(
                'CharacterRuleBindingError',
                `Character "${character.id}" did not produce a prospective hit-point override.`
              )
            }
            await typedAdjustmentRepository.upsert({
              id: prospective.id,
              characterId: params.characterId,
              actorId: params.userId,
              family: 'HIT_POINTS',
              field: 'MAXIMUM_OVERRIDE',
              value: params.command.maxOverride,
              ...(existing?.sourceNote == null ? {} : { sourceNote: existing.sourceNote })
            })
          }
        }
        if (command.type === 'COMPLETE_REST' && completedRest) {
          if (
            command.rollId &&
            !(await createRollHistoryRepository(trx).consumeForUser(command.rollId, params.userId))
          ) {
            throw new CharacterSheetCommandError(
              'This hit-die roll has already been used or is no longer available.'
            )
          }
          if (
            command.resetMaximumHitPointModifier &&
            restPreview?.hitPoints.canResetMaximumHitPointModifier
          ) {
            const modifier = characterAdjustments.find(
              (adjustment) =>
                adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_MODIFIER'
            )
            if (modifier) {
              await typedAdjustmentRepository.remove({
                characterId: params.characterId,
                adjustmentId: modifier.id,
                family: 'HIT_POINTS'
              })
            }
          }
          const recoveredResourceIds = new Set(completedRest.allRecoveredResourceIds)
          for (const resource of currentSheet.resources.items) {
            if (!recoveredResourceIds.has(resource.id)) continue
            const owner = toCharacterResourceOwnerKey(resource.owner)
            const ownerKey = createCharacterResourceOwnerKey(owner)
            const existing = resourceUsage.find(
              (usage) => createCharacterResourceOwnerKey(usage.owner) === ownerKey
            )
            await typedPlayStateRepository.setResourceUsage({
              id: existing?.id ?? crypto.randomUUID(),
              characterId: params.characterId,
              actorId: params.userId,
              owner,
              used: 0
            })
          }
        }
        if (nextMechanicsProjection) {
          await createCharacterMechanicsProjectionRepository(trx).publish(
            nextMechanicsProjection,
            {
              requireActiveAuthoredVersions: false,
              ...(params.onTiming
                ? {
                    onTiming: (timing: CharacterMechanicsProjectionPublicationTiming) => {
                      mechanicsProjectionPublication = timing
                    }
                  }
                : {})
            }
          )
        }
        if (campaignContext.campaignId) {
          const campaignRuleContextStartedAt = performance.now()
          const ruleContext = await resolveCharacterLiveSessionRuleContext(
            trx,
            params.characterId,
            {
              id: campaignContext.campaignId,
              attunementSlotOverride: campaignContext.attunementSlotOverride
            }
          )
          if (!ruleContext) {
            throw createNamedError(
              'CampaignCharacterMechanicsProjectionMismatchError',
              `Campaign "${campaignContext.campaignId}" no longer assigns Character "${params.characterId}".`
            )
          }
          campaignProjectionRuleContextMs = performance.now() - campaignRuleContextStartedAt
          const campaignProjectionCompilationStartedAt = performance.now()
          campaignPublication.mechanics =
            canReuseNextBaseRuleEvaluation && campaignMechanics
              ? compileCampaignCharacterMechanicsProjection({
                  campaignId: campaignContext.campaignId,
                  characterId: nextCharacter.id,
                  characterStreamVersion: persistedStreamVersion,
                  baseMechanicsProjectionChecksum: nextMechanicsProjection.projectionChecksum,
                  mechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
                    adjustments: ruleContext.adjustments,
                    attunementSlotOverride: ruleContext.attunementSlotOverride
                  }),
                  manualMaximumModifierOwner: campaignMechanics.manualMaximumModifierOwner,
                  ...(campaignMechanics.kind === 'MATERIALIZED'
                    ? {
                        rulePolicyInput:
                          boundedActionEvaluation?.facts ?? campaignMechanics.rulePolicyInput,
                        rulePolicyOutput:
                          boundedActionEvaluation?.output ?? campaignMechanics.rulePolicyOutput
                      }
                    : {})
                })
              : await prepareCampaignCharacterMechanicsProjection({
                  db: trx,
                  campaignId: campaignContext.campaignId,
                  character: nextCharacter,
                  characterStreamVersion: persistedStreamVersion,
                  mechanics: nextMechanicsProjection,
                  campaignAdjustments: ruleContext.adjustments,
                  attunementSlotOverride: ruleContext.attunementSlotOverride
                })
          campaignProjectionCompilationMs = performance.now() - campaignProjectionCompilationStartedAt
          const mechanics = campaignPublication.mechanics
          if (!mechanics) {
            throw createNamedError(
              'CampaignCharacterMechanicsProjectionMismatchError',
              `Campaign "${campaignContext.campaignId}" did not produce a mechanics projection.`
            )
          }
          const campaignProjectionPublicationStartedAt = performance.now()
          await createCampaignCharacterMechanicsProjectionRepository(trx).publish({
            projection: mechanics,
            expectedPriorOverlayChecksum: campaignMechanics?.projectionChecksum ?? null
          })
          campaignProjectionPublicationMs = performance.now() - campaignProjectionPublicationStartedAt
        }
        const eventAppendStartedAt = performance.now()
        await createCharacterEventRepository(trx).append(event)
        characterEventAppendMs = performance.now() - eventAppendStartedAt
      }
    })
  } catch (error) {
    if (error instanceof ConcurrencyError) {
      const concurrentEvent = await eventRepository.findByCommandId(
        params.characterId,
        params.command.commandId
      )
      if (concurrentEvent) {
        return executeCharacterSheetCommandWithRuleEvaluation(params)
      }
    }
    throw error
  }
  const transactionMs = performance.now() - transactionStartedAt

  const postCommitHydrationStartedAt = performance.now()
  const postCommitCampaignContextStartedAt = performance.now()
  const nextCampaignContext = await resolveCharacterSheetCampaignContext(
    params.db,
    nextCharacter,
    params.userId
  )
  const postCommitCampaignContextMs = performance.now() - postCommitCampaignContextStartedAt
  const nextCampaignMechanics = campaignPublication.mechanics
  const nextResolution = nextCommittedResolution ?? resolution
  const preparedCampaignMatchesContext =
    nextCampaignMechanics !== null &&
    nextCampaignContext.campaignId === nextCampaignMechanics.campaignId &&
    nextCampaignMechanics.characterStreamVersion === nextStreamVersion &&
    nextCampaignMechanics.baseMechanicsProjectionChecksum === nextMechanicsProjection.projectionChecksum &&
    nextCampaignMechanics.mechanicalContextChecksum ===
      checksumCampaignCharacterMechanicalContext({
        adjustments: nextCampaignContext.adjustments,
        attunementSlotOverride: nextCampaignContext.attunementSlotOverride
      })
  const nextPreparedCampaignRuleEvaluation = preparedCampaignMatchesContext
    ? createCommittedCharacterRuleEvaluation({
        character: nextCharacter,
        context: nextExactContext,
        mechanics: nextMechanicsProjection,
        adjustments: nextProjectionAdjustments,
        movementDisplayPreference: prospectiveMovementDisplayPreference,
        rulePolicy: {
          input:
            nextCampaignMechanics.kind === 'BASE_REFERENCE'
              ? nextMechanicsProjection.rulePolicyInput
              : nextCampaignMechanics.rulePolicyInput,
          output:
            nextCampaignMechanics.kind === 'BASE_REFERENCE'
              ? nextMechanicsProjection.rulePolicyOutput
              : nextCampaignMechanics.rulePolicyOutput
        }
      })
    : undefined
  const postCommitCampaignBundleStartedAt = performance.now()
  const nextPreparedCampaignBundle = nextPreparedCampaignRuleEvaluation
    ? await buildCharacterSheetBundle({
        db: params.db,
        character: nextCharacter,
        resolution: nextResolution,
        streamVersion: nextStreamVersion,
        adjustments: nextProjectionAdjustments,
        movementDisplayPreference: prospectiveMovementDisplayPreference,
        resourceUsage: prospectiveResourceUsage,
        spellCustomizations,
        committedExtras: nextCommittedExtras,
        pinnedSpellsById: nextPinnedSpellsById,
        additionalConditions: getVisibleCampaignConditions(nextCampaignContext),
        ruleEvaluation: {
          context: nextExactContext,
          revisionId: nextRuleRevisionId,
          attunementSlotOverride: nextCampaignContext.attunementSlotOverride
        },
        committedRuleEvaluation: nextPreparedCampaignRuleEvaluation
      })
    : null
  const assembledNextBundle =
    nextCampaignContext.campaignId && !nextPreparedCampaignBundle
      ? await (async () => {
        const persistedRow = await createCharacterRepository(params.db).findById(params.characterId)
        if (!persistedRow || !persistedRow.rule_pack_revision_id) {
          throw createNamedError(
            'CharacterMechanicsProjectionMismatchError',
            `Character "${params.characterId}" did not retain its committed mechanics state.`
          )
        }
        return assembleCharacterSheetBundleForRuleContext({
          db: params.db,
          character: nextCharacter,
          campaignId: nextCampaignContext.campaignId,
          row: persistedRow,
          revisionId: persistedRow.rule_pack_revision_id,
          ruleContext: {
            adjustments: nextCampaignContext.adjustments,
            additionalConditions: getVisibleCampaignConditions(nextCampaignContext),
            attunementSlotOverride: nextCampaignContext.attunementSlotOverride
          }
        })
      })()
      : null
  const postCommitCampaignBundleMs = performance.now() - postCommitCampaignBundleStartedAt
  const postCommitHydrationMs = performance.now() - postCommitHydrationStartedAt
  const postCommitBuilderResolutionMs = 0
  const postCommitProjectionMs = 0
  const nextUnassignedBundle =
    !nextCampaignContext.campaignId && !nextBaseBundle
      ? await buildCharacterSheetBundle({
          db: params.db,
          character: nextCharacter,
          resolution: nextResolution,
          streamVersion: nextStreamVersion,
          adjustments: nextCharacterProjectionAdjustments,
          movementDisplayPreference: prospectiveMovementDisplayPreference,
          resourceUsage: prospectiveResourceUsage,
          spellCustomizations,
          committedExtras: nextCommittedExtras,
          pinnedSpellsById: nextPinnedSpellsById,
          ruleEvaluation: {
            context: nextExactContext,
            revisionId: nextRuleRevisionId,
            attunementSlotOverride: null
          },
          ...(nextBaseCommittedRuleEvaluation
            ? { committedRuleEvaluation: nextBaseCommittedRuleEvaluation }
            : {})
        })
      : null
  const nextBundle =
    assembledNextBundle?.bundle ?? nextPreparedCampaignBundle ?? nextBaseBundle ?? nextUnassignedBundle
  if (!nextBundle) {
    throw createNamedError(
      'CharacterMechanicsProjectionMismatchError',
      `Character "${params.characterId}" did not produce a post-command Sheet bundle.`
    )
  }
  const responseResolution = assembledNextBundle?.resolution ?? nextResolution
  const sheet = projectCharacterSheetForViewer(nextBundle.sheet, nextCampaignContext)
  const panels = buildRequestedPanels({
    character: nextCharacter,
    resolution: responseResolution,
    bundle: nextBundle,
    characterAdjustments: assembledNextBundle?.characterAdjustments ?? nextCharacterProjectionAdjustments,
    movementDisplayPreference:
      assembledNextBundle?.movementDisplayPreference ?? prospectiveMovementDisplayPreference,
    targets: params.panelTargets,
    campaignContext: nextCampaignContext
  })
  const historyEntry: CharacterHistoryEntryDto = {
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    actorId: event.actorId,
    eventType: event.type,
    summary,
    ...(commandResult ? { result: commandResult } : {})
  }

  params.onTiming?.({
    ruleResponsibility,
    evaluationLane: boundedActionEvaluation
      ? 'CHARACTER_ACTION'
      : (committedRuleEvaluation ?? matchingCommittedRuleEvaluation) && reuseCommittedRuleEvaluation
        ? 'NONE'
        : 'CHARACTER_POLICY',
    boundedEvaluationMs,
    boundedZenEvaluationMs,
    recordLoadMs,
    authorityCheckMs,
    campaignContextMs,
    committedSnapshotCacheHit,
    campaignSnapshotCacheHit,
    mechanicsProjectionLoadMs,
    committedSourceLoadMs,
    inputHydrationMs,
    inputHydrationElapsedMs,
    committedEvaluationMs,
    idempotencyLookupMs,
    builderResolutionMs,
    currentProjectionMs,
    commandPreparationMs,
    mechanicsProjectionCompilationMs,
    transactionMs,
    mechanicsProjectionPublication,
    campaignProjectionRuleContextMs,
    campaignProjectionCompilationMs,
    campaignProjectionPublicationMs,
    characterEventAppendMs,
    postCommitHydrationMs,
    postCommitCampaignContextMs,
    postCommitCampaignBundleMs,
    postCommitBuilderResolutionMs,
    postCommitProjectionMs,
    totalMs: performance.now() - startedAt
  })

  const response: CharacterSheetCommandResponseDto = {
    characterId: params.characterId,
    streamVersion: nextStreamVersion,
    sheet,
    ...(panels ? { panels } : {}),
    historyEntry,
    ...(commandResult ? { result: commandResult } : {})
  }
  return {
    replayed: false,
    response,
    ruleSnapshot: {
      mechanicsProjectionChecksum:
        assembledNextBundle?.mechanics.projectionChecksum ?? nextMechanicsProjection.projectionChecksum,
      mechanicsCommandLaneChecksum:
        assembledNextBundle?.mechanics.commandLaneChecksum ?? nextMechanicsProjection.commandLaneChecksum,
      mechanicsPayload: {
        ruleSnapshot: nextMechanicsProjection.ruleSnapshot,
        rulePolicyInput: nextMechanicsProjection.rulePolicyInput,
        rulePolicyOutput: nextMechanicsProjection.rulePolicyOutput,
        ruleRegistry: nextMechanicsProjection.ruleRegistry
      },
      campaignMechanicalContextChecksum: nextCampaignContext.campaignId
        ? checksumCampaignCharacterMechanicalContext({
            adjustments: nextCampaignContext.adjustments,
            attunementSlotOverride: nextCampaignContext.attunementSlotOverride
          })
        : null,
      campaignMechanicsProjectionChecksum:
        assembledNextBundle?.campaignMechanics?.projectionChecksum ??
        (preparedCampaignMatchesContext ? nextCampaignMechanics.projectionChecksum : null),
      streamVersion: nextStreamVersion,
      evaluation: nextBundle.ruleEvaluation,
      resolution: responseResolution
    }
  }
}

export async function executeCharacterSheetCommand(
  params: ExecuteCharacterSheetCommandParams
): Promise<CharacterSheetCommandResponseDto> {
  return (await executeCharacterSheetCommandWithRuleEvaluation(params)).response
}

function fingerprintCharacterSheetCommand(command: CharacterSheetCommandInputDto): string {
  return createHash('sha256')
    .update(JSON.stringify(sortFingerprintValue(command)))
    .digest('hex')
}
