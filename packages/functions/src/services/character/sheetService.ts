import {
  ConcurrencyError,
  createCharacterEventRepository,
  createCharacterRepository,
  createCharacterSheetAdjustmentRepository,
  createCharacterSheetPlayStateRepository,
  createRollHistoryRepository,
  createCreatureRepository,
  createEquipmentRepository,
  createVehicleRepository,
  type DBLike
} from '@artificer-toolkit/db'
import { AUTHORED_RECORD_STATUS, type CharacterEvent } from '@artificer-toolkit/shared/core'
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
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import type {
  CharacterHistoryEntryDto,
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characters'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import { loadCharacterBuilderContext, resolveCharacterBuilder } from './builderService.js'
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
  campaignContextMs: number
  inputHydrationMs: number
  idempotencyLookupMs: number
  builderResolutionMs: number
  currentProjectionMs: number
  commandPreparationMs: number
  transactionMs: number
  postCommitHydrationMs: number
  postCommitBuilderResolutionMs: number
  postCommitProjectionMs: number
  totalMs: number
}

import {
  getCharacterSheetDisplayAdjustments,
  getVisibleCampaignConditions,
  mergeCampaignSheetAdjustments,
  projectCharacterSheetForViewer,
  resolveCharacterSheetCampaignContext,
  sameCharacterSheetAdjustmentSlot
} from './campaignCharacterSheet.js'
import { presentCampaignCharacterText } from './campaignCharacterPresentation.js'
import { buildCharacterSheetPanel } from './sheetPanelService.js'
import type { CharacterBuilderResolution } from './builderService.js'
import type { CharacterSheetBuildBundle } from './sheetProjection.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'
import { evaluateCharacterActionStateChange } from './characterActionEvaluation.js'
import { resolveCharacterRuleBinding } from './characterRuleBinding.js'
import { CHARACTER_ACTION_SPELL_STATE_CONTRACT_VERSION } from '../rules/ruleModelContracts.js'
import {
  assertCharacterLiveSessionCommandAuthority,
  type LiveSessionCommandAuthority
} from '../campaign/liveSessionCommandAuthority.js'
import {
  canReuseCommittedCharacterRuleEvaluation,
  classifyCharacterSheetCommandRuleResponsibility,
  type CharacterSheetCommandRuleResponsibility
} from './characterSheetCommandResponsibility.js'

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
  streamVersion: number
  evaluation: CharacterRuleEvaluationResult
  resolution: CharacterBuilderResolution
}

export interface CharacterSheetCommandExecutionResult {
  response: CharacterSheetCommandResponseDto
  ruleSnapshot: CharacterSheetCommittedRuleSnapshot
}

export async function executeCharacterSheetCommandWithRuleEvaluation(
  params: ExecuteCharacterSheetCommandParams
): Promise<CharacterSheetCommandExecutionResult> {
  const startedAt = performance.now()
  const command = params.command
  const ruleResponsibility = classifyCharacterSheetCommandRuleResponsibility(command)
  const reuseCommittedRuleEvaluation = canReuseCommittedCharacterRuleEvaluation(command)
  const repository = createCharacterRepository(params.db)
  const recordLoadStartedAt = performance.now()
  const [row, character] = await Promise.all([
    repository.findById(params.characterId),
    repository.findAuthoredById(params.characterId)
  ])
  const recordLoadMs = performance.now() - recordLoadStartedAt
  if (!character || !row) {
    throw createNamedError('NotFoundError', `Character "${params.characterId}" was not found.`)
  }
  await assertCharacterLiveSessionCommandAuthority(
    params.db,
    params.characterId,
    params.liveSessionAuthority
  )

  const campaignContextStartedAt = performance.now()
  const campaignContext = await resolveCharacterSheetCampaignContext(
    params.db,
    character,
    params.userId
  )
  const campaignContextMs = performance.now() - campaignContextStartedAt
  if (campaignContext.viewer === 'CAMPAIGN_OWNER') {
    if (campaignContext.campaignStatus !== 'ACTIVE') {
      throw new CharacterSheetCommandError('Archived Campaigns are read-only.')
    }
    assertCampaignGmSheetCommandAllowed(command)
  }

  if ((character.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE) {
    throw new CharacterSheetCommandError(`Character "${params.characterId}" is not finalized yet.`)
  }
  if (!row.rule_pack_revision_id) {
    throw createNamedError(
      'CharacterRuleBindingError',
      `Active Character "${character.id}" does not have a pinned rule revision.`
    )
  }
  const currentRevisionId = row.rule_pack_revision_id
  const matchingCommittedRuleSnapshot =
    params.committedRuleSnapshot?.streamVersion === row.stream_version &&
    params.committedRuleSnapshot.evaluation.snapshot.characterId === character.id &&
    params.committedRuleSnapshot.evaluation.binding.revisionId === currentRevisionId
      ? params.committedRuleSnapshot
      : undefined
  const matchingCommittedRuleEvaluation = matchingCommittedRuleSnapshot?.evaluation
  const adjustmentRepository = createCharacterSheetAdjustmentRepository(params.db)
  const playStateRepository = createCharacterSheetPlayStateRepository(params.db)
  const inputHydrationStartedAt = performance.now()
  const [
    context,
    characterAdjustments,
    movementDisplayPreference,
    resourceUsage,
    spellCustomizations
  ] = await Promise.all([
    matchingCommittedRuleEvaluation
      ? Promise.resolve(matchingCommittedRuleEvaluation.context)
      : loadCharacterBuilderContext(params.db, character, [], { includeEffects: true }),
    adjustmentRepository.listByCharacter(params.characterId),
    adjustmentRepository.getMovementPreference(params.characterId),
    playStateRepository.listResourceUsage(params.characterId),
    playStateRepository.listSpellCustomizations(params.characterId)
  ])
  const inputHydrationMs = performance.now() - inputHydrationStartedAt
  const adjustments = mergeCampaignSheetAdjustments(
    characterAdjustments,
    campaignContext.adjustments
  )
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
    const resolution =
      ruleResponsibility === 'COMMITTED_SNAPSHOT' && matchingCommittedRuleSnapshot
        ? matchingCommittedRuleSnapshot.resolution
        : await resolveCharacterBuilder(
            params.db,
            character,
            'edit',
            context,
            null,
            row.rule_pack_revision_id
          )
    const bundle = await buildCharacterSheetBundle({
      db: params.db,
      character,
      resolution,
      streamVersion: row.stream_version,
      adjustments,
      movementDisplayPreference,
      resourceUsage,
      spellCustomizations,
      additionalConditions: getVisibleCampaignConditions(campaignContext),
      ruleEvaluation: {
        context,
        revisionId: row.rule_pack_revision_id,
        attunementSlotOverride: campaignContext.attunementSlotOverride
      },
      committedRuleEvaluation: matchingCommittedRuleEvaluation
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
      response,
      ruleSnapshot: {
        streamVersion: row.stream_version,
        evaluation: bundle.ruleEvaluation,
        resolution
      }
    }
  }

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

  const builderResolutionStartedAt = performance.now()
  const resolution =
    ruleResponsibility === 'COMMITTED_SNAPSHOT' && matchingCommittedRuleSnapshot
      ? matchingCommittedRuleSnapshot.resolution
      : await resolveCharacterBuilder(
          params.db,
          character,
          'edit',
          context,
          null,
          row.rule_pack_revision_id
        )
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
      const equipment = await createEquipmentRepository(params.db).findResolvedById(equipmentId, {
        systemId: character.systemId,
        includeEffects: true
      })
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
    ruleEvaluation: {
      context,
      revisionId: row.rule_pack_revision_id,
      attunementSlotOverride: campaignContext.attunementSlotOverride
    },
    committedRuleEvaluation: matchingCommittedRuleEvaluation
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
        ruleEvaluation: {
          context,
          revisionId: targetRuleBinding.revisionId,
          attunementSlotOverride: campaignContext.attunementSlotOverride
        }
      })
    : null
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
  const prospectiveAdjustments = mergeCampaignSheetAdjustments(
    getProspectiveSheetAdjustments({
      adjustments: characterAdjustments,
      characterId: params.characterId,
      command,
      userId: params.userId
    }),
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
      if (!currentSheet.extras.vehicleOptions.some((vehicle) => vehicle.id === extra.vehicleId)) {
        throw new CharacterSheetCommandError(
          `Vehicle "${extra.vehicleId}" is not available for this character.`
        )
      }
      const vehicle = await createVehicleRepository(params.db).findById(extra.vehicleId, {
        systemId: character.systemId,
        userId: character.userId,
        includeMaster: true
      })
      if (!vehicle) {
        throw new CharacterSheetCommandError(`Vehicle "${extra.vehicleId}" was not found.`)
      }
      if ((vehicle.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE) {
        throw new CharacterSheetCommandError(
          `Vehicle "${extra.vehicleId}" is not available for this character.`
        )
      }
      extraDefaults.vehicles.set(vehicle.id, { hitPoints: vehicle.hitPoints })
    } else {
      if (
        !currentSheet.extras.creatureOptions.some((creature) => creature.id === extra.creatureId)
      ) {
        throw new CharacterSheetCommandError(
          `Creature "${extra.creatureId}" is not available for this character.`
        )
      }
      const creature = await createCreatureRepository(params.db).findById(extra.creatureId, {
        systemId: character.systemId,
        userId: character.userId,
        includeMaster: true
      })
      if (!creature) {
        throw new CharacterSheetCommandError(`Creature "${extra.creatureId}" was not found.`)
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
  let nextCharacter =
    completedRest?.character ??
    applyCharacterSheetCommand(character, params.command, currentSheet, {
      adjustments,
      attunementSlotLimit,
      extraDefaults
    })
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
    const prospectiveContext = await loadCharacterBuilderContext(params.db, nextCharacter, [], {
      includeEffects: true
    })
    const prospectiveResolution = await resolveCharacterBuilder(
      params.db,
      nextCharacter,
      'edit',
      prospectiveContext,
      null,
      row.rule_pack_revision_id
    )
    const prospectiveBundle = await buildCharacterSheetBundle({
      db: params.db,
      character: nextCharacter,
      resolution: prospectiveResolution,
      streamVersion: row.stream_version,
      adjustments: prospectiveAdjustments,
      movementDisplayPreference,
      resourceUsage,
      spellCustomizations,
      ruleEvaluation: {
        context: prospectiveContext,
        revisionId: row.rule_pack_revision_id,
        attunementSlotOverride: campaignContext.attunementSlotOverride
      }
    })
    const maximumHitPoints = resolveCharacterEffectiveMaximumHitPoints(
      prospectiveBundle.ruleProjection.derivedStats.maxHitPoints
    )
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
  const prospectiveResourceUsage = resourceUsageUpdate
    ? [
        ...resourceUsage.filter(
          (usage) => createCharacterResourceOwnerKey(usage.owner) !== changedPoolId
        ),
        ...(resourceUsageUpdate.used === 0
          ? []
          : [
              {
                owner: toCharacterResourceOwnerKey(resourceUsageUpdate.resource.owner),
                used: resourceUsageUpdate.used
              }
            ])
      ]
    : resourceUsage
  let boundedActionEvaluation: CharacterRuleEvaluationResult | undefined
  let boundedEvaluationMs = 0
  let boundedZenEvaluationMs = 0
  const actionStateChanged = changedPoolId !== undefined || changedSpellSlotKey !== undefined
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
  let nextStreamVersion: number
  const transactionStartedAt = performance.now()
  try {
    nextStreamVersion = await repository.patchSheetState(params.characterId, statePatches, {
      expectedStreamVersion: params.command.expectedVersion,
      afterPersist: async (trx) => {
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
          const existing = characterAdjustments.find((adjustment) =>
            sameCharacterSheetAdjustmentSlot(adjustment, command.adjustment)
          )
          await typedAdjustmentRepository.upsert({
            ...command.adjustment,
            id: existing?.id ?? command.adjustment.id ?? crypto.randomUUID(),
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
          await typedAdjustmentRepository.upsert({
            id: crypto.randomUUID(),
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
            await typedAdjustmentRepository.upsert({
              id: existing?.id ?? crypto.randomUUID(),
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
        await createCharacterEventRepository(trx).append(event)
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
  const [
    nextContext,
    persistedAdjustments,
    persistedMovementDisplayPreference,
    persistedResourceUsage,
    persistedSpellCustomizations
  ] = await Promise.all([
    ruleResponsibility === 'COMMITTED_SNAPSHOT'
      ? Promise.resolve(context)
      : loadCharacterBuilderContext(params.db, nextCharacter, [], { includeEffects: true }),
    adjustmentRepository.listByCharacter(params.characterId),
    adjustmentRepository.getMovementPreference(params.characterId),
    playStateRepository.listResourceUsage(params.characterId),
    playStateRepository.listSpellCustomizations(params.characterId)
  ])
  const postCommitHydrationMs = performance.now() - postCommitHydrationStartedAt
  const nextRevisionId = targetRuleBinding?.revisionId ?? row.rule_pack_revision_id
  const postCommitBuilderResolutionStartedAt = performance.now()
  const nextResolution =
    ruleResponsibility === 'COMMITTED_SNAPSHOT'
      ? resolution
      : await resolveCharacterBuilder(
          params.db,
          nextCharacter,
          'edit',
          nextContext,
          null,
          nextRevisionId
        )
  const postCommitBuilderResolutionMs = performance.now() - postCommitBuilderResolutionStartedAt
  const postCommitProjectionStartedAt = performance.now()
  const nextBundle = await buildCharacterSheetBundle({
    db: params.db,
    character: nextCharacter,
    resolution: nextResolution,
    streamVersion: nextStreamVersion,
    adjustments: mergeCampaignSheetAdjustments(persistedAdjustments, campaignContext.adjustments),
    movementDisplayPreference: persistedMovementDisplayPreference,
    resourceUsage: persistedResourceUsage,
    spellCustomizations: persistedSpellCustomizations,
    additionalConditions: getVisibleCampaignConditions(campaignContext),
    ruleEvaluation: {
      context: nextContext,
      revisionId: nextRevisionId,
      attunementSlotOverride: campaignContext.attunementSlotOverride
    },
    committedRuleEvaluation:
      boundedActionEvaluation ??
      (reuseCommittedRuleEvaluation && !actionStateChanged
        ? currentBundle.ruleEvaluation
        : undefined)
  })
  const postCommitProjectionMs = performance.now() - postCommitProjectionStartedAt
  const sheet = projectCharacterSheetForViewer(nextBundle.sheet, campaignContext)
  const panels = buildRequestedPanels({
    character: nextCharacter,
    resolution: nextResolution,
    bundle: nextBundle,
    characterAdjustments: persistedAdjustments,
    movementDisplayPreference: persistedMovementDisplayPreference,
    targets: params.panelTargets,
    campaignContext
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
      : matchingCommittedRuleEvaluation && reuseCommittedRuleEvaluation
        ? 'NONE'
        : 'CHARACTER_POLICY',
    boundedEvaluationMs,
    boundedZenEvaluationMs,
    recordLoadMs,
    campaignContextMs,
    inputHydrationMs,
    idempotencyLookupMs,
    builderResolutionMs,
    currentProjectionMs,
    commandPreparationMs,
    transactionMs,
    postCommitHydrationMs,
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
    response,
    ruleSnapshot: {
      streamVersion: nextStreamVersion,
      evaluation: nextBundle.ruleEvaluation,
      resolution: nextResolution
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
