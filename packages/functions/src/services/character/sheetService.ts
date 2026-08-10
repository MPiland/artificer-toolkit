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
import {
  AUTHORED_RECORD_STATUS,
  resolveRulesSystem,
  type CharacterEvent
} from '@artificer-toolkit/shared/core'
import {
  clampCharacterCurrentHitPoints,
  createCharacterResourceOwnerKey,
  createCharacterSpellSourceKey,
  resolveCharacterEffectiveMaximumHitPoints,
  toCharacterResourceOwnerKey,
  type CharacterSheetAdjustment,
  type CharacterSheetAdjustmentWrite
} from '@artificer-toolkit/shared/character'
import { createHash } from 'node:crypto'
import type {
  CharacterHistoryEntryDto,
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characters'
import { resolveCharacterBuilder } from './builderService.js'
import {
  characterSheetAdjustmentMatchesPanelTarget,
  getCharacterSheetPanelAdjustmentIds
} from './sheetPanelTarget.js'
import { resolveCharacterSheetEngine } from './characterEngine.js'
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
import { buildCharacterSheetResponse } from './sheetProjection.js'
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

import {
  getVisibleCampaignConditions,
  mergeCampaignSheetAdjustments,
  projectCharacterSheetForViewer,
  resolveCharacterSheetCampaignContext,
  sameCharacterSheetAdjustmentSlot
} from './campaignCharacterSheet.js'

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

export async function executeCharacterSheetCommand(params: {
  db: DBLike
  characterId: string
  command: CharacterSheetCommandInputDto
  userId: string
}): Promise<CharacterSheetCommandResponseDto> {
  const command = params.command
  const repository = createCharacterRepository(params.db)
  const [row, character] = await Promise.all([
    repository.findById(params.characterId),
    repository.findAuthoredById(params.characterId)
  ])
  if (!character || !row) {
    throw createNamedError('NotFoundError', `Character "${params.characterId}" was not found.`)
  }

  const campaignContext = await resolveCharacterSheetCampaignContext(
    params.db,
    character,
    params.userId
  )
  if (campaignContext.viewer === 'CAMPAIGN_OWNER') {
    if (campaignContext.campaignStatus !== 'ACTIVE') {
      throw new CharacterSheetCommandError('Archived Campaigns are read-only.')
    }
    assertCampaignGmSheetCommandAllowed(command)
  }

  if ((character.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE) {
    throw new CharacterSheetCommandError(`Character "${params.characterId}" is not finalized yet.`)
  }

  const adjustmentRepository = createCharacterSheetAdjustmentRepository(params.db)
  const playStateRepository = createCharacterSheetPlayStateRepository(params.db)
  const [characterAdjustments, movementDisplayPreference, resourceUsage, spellCustomizations] =
    await Promise.all([
      adjustmentRepository.listByCharacter(params.characterId),
      adjustmentRepository.getMovementPreference(params.characterId),
      playStateRepository.listResourceUsage(params.characterId),
      playStateRepository.listSpellCustomizations(params.characterId)
    ])
  const adjustments = mergeCampaignSheetAdjustments(
    characterAdjustments,
    campaignContext.adjustments
  )
  const eventRepository = createCharacterEventRepository(params.db)
  const commandFingerprint = fingerprintCharacterSheetCommand(params.command)
  const priorEvent = await eventRepository.findByCommandId(
    params.characterId,
    params.command.commandId
  )
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
    const resolution = await resolveCharacterBuilder(params.db, character, 'edit')
    return {
      characterId: params.characterId,
      streamVersion: row.stream_version,
      sheet: projectCharacterSheetForViewer(
        await buildCharacterSheetResponse({
          db: params.db,
          character,
          resolution,
          streamVersion: row.stream_version,
          adjustments,
          movementDisplayPreference,
          resourceUsage,
          spellCustomizations,
          additionalConditions: getVisibleCampaignConditions(campaignContext)
        }),
        campaignContext
      ),
      historyEntry: {
        eventId: priorEvent.eventId,
        occurredAt: priorEvent.occurredAt,
        actorId: priorEvent.actorId,
        eventType: priorEvent.type,
        summary: priorEvent.summary,
        ...(priorEvent.result ? { result: priorEvent.result } : {})
      },
      ...(priorEvent.result ? { result: priorEvent.result } : {})
    }
  }

  if (row.stream_version !== params.command.expectedVersion) {
    throw new ConcurrencyError(params.characterId, params.command.expectedVersion)
  }

  const resolution = await resolveCharacterBuilder(params.db, character, 'edit')
  const rulesSystem = resolveRulesSystem({
    code: resolution.registry.system?.rulesetCode ?? '',
    version: resolution.registry.system?.rulesetVersion ?? ''
  })
  const attunementSlotLimit =
    campaignContext.attunementSlotOverride ?? rulesSystem.attunementSlotLimit
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
        includeEffects: false
      })
      if (equipment) resolution.registry.equipment.push(equipment)
    }
  }
  const currentSheet = await buildCharacterSheetResponse({
    db: params.db,
    character,
    resolution,
    streamVersion: row.stream_version,
    adjustments,
    movementDisplayPreference,
    resourceUsage,
    spellCustomizations
  })
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
    if (
      command.type === 'RECOVER_SHEET_RESOURCE' &&
      !resource.recoveries.some((recovery) => recovery.trigger === command.trigger)
    ) {
      throw new CharacterSheetCommandError(
        `Resource cannot be recovered by ${formatCodeLabel(command.trigger)}.`
      )
    }
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
  const restPreview =
    command.type === 'COMPLETE_REST'
      ? buildCharacterRestPreview({
          character,
          resolution,
          characterAdjustments,
          adjustments,
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
          resolution,
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
  if (shouldPersistHitPointClamp) {
    const maximumHitPoints = resolveCharacterEffectiveMaximumHitPoints(
      resolveCharacterSheetEngine({
        character: nextCharacter,
        resolution,
        adjustments: prospectiveAdjustments
      }).derivedStats.maxHitPoints
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
        used: resource.used + (command.amount ?? 1)
      }
      break
    }
    case 'RESTORE_RESOURCE': {
      const resource = ensureResource(currentSheet, command.resourceGrantId)
      resourceUsageUpdate = {
        resource,
        used: command.all ? 0 : Math.max(resource.used - (command.amount ?? 1), 0)
      }
      break
    }
    case 'USE_SHEET_RESOURCE': {
      const resource = ensureResourceByOwner(currentSheet, command.owner)
      resourceUsageUpdate = {
        resource,
        used: Math.min(resource.used + (command.amount ?? 1), resource.max)
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
          used: Math.min(resource.used + 1, resource.max)
        }
      }
      break
    }
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
    summary,
    ...(commandResult ? { result: commandResult } : {})
  } satisfies CharacterEvent
  let nextStreamVersion: number
  try {
    nextStreamVersion = await repository.patchSheetState(params.characterId, statePatches, {
      expectedStreamVersion: params.command.expectedVersion,
      afterPersist: async (trx) => {
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
        return executeCharacterSheetCommand(params)
      }
    }
    throw error
  }

  const [
    persistedAdjustments,
    persistedMovementDisplayPreference,
    persistedResourceUsage,
    persistedSpellCustomizations
  ] = await Promise.all([
    adjustmentRepository.listByCharacter(params.characterId),
    adjustmentRepository.getMovementPreference(params.characterId),
    playStateRepository.listResourceUsage(params.characterId),
    playStateRepository.listSpellCustomizations(params.characterId)
  ])
  const sheet = projectCharacterSheetForViewer(
    await buildCharacterSheetResponse({
      db: params.db,
      character: nextCharacter,
      resolution,
      streamVersion: nextStreamVersion,
      adjustments: mergeCampaignSheetAdjustments(persistedAdjustments, campaignContext.adjustments),
      movementDisplayPreference: persistedMovementDisplayPreference,
      resourceUsage: persistedResourceUsage,
      spellCustomizations: persistedSpellCustomizations,
      additionalConditions: getVisibleCampaignConditions(campaignContext)
    }),
    campaignContext
  )
  const historyEntry: CharacterHistoryEntryDto = {
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    actorId: event.actorId,
    eventType: event.type,
    summary,
    ...(commandResult ? { result: commandResult } : {})
  }

  return {
    characterId: params.characterId,
    streamVersion: nextStreamVersion,
    sheet,
    historyEntry,
    ...(commandResult ? { result: commandResult } : {})
  }
}

function fingerprintCharacterSheetCommand(command: CharacterSheetCommandInputDto): string {
  return createHash('sha256')
    .update(JSON.stringify(sortFingerprintValue(command)))
    .digest('hex')
}
