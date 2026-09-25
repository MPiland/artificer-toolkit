import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterHistoryEntryDtoSchema,
  characterSheetCommandResponseDtoSchema,
  characterSheetExecuteInputSchema,
  type CharacterSheetCommandInputDto,
  type CharacterSheetCommandResponseDto,
  type CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import type {
  CharacterAuthored,
  CreatureAuthored,
  VehicleAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import {
  clampCharacterCurrentHitPoints,
  createCharacterResourceOwnerKey,
  createCharacterSpellSourceKey,
  toCharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  applyCharacterSheetCommand,
  CharacterSheetCommandError,
  ensureResource,
  ensureResourceByOwner,
  resolveSpellCastSource,
  summarizeCharacterSheetCommand,
  type SheetResource
} from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import { getProspectiveSheetAdjustments } from '@artificer-toolkit/rules-runtime/character/sheetAdjustmentCommands'
import { getProspectiveSheetResourceUsage } from '@artificer-toolkit/rules-runtime/character/sheetResourceUsage'
import { applyCompletedCharacterRest } from '@artificer-toolkit/rules-runtime/character/sheetRest'
import {
  getCharacterSpellKnownEligibleIdsByClass,
  getCharacterSpellPreparationEligibleIdsByClass
} from '@artificer-toolkit/rules-runtime/character/characterSpellPreparationEligibility'
import {
  validatePanelTarget,
  validateActionResourceUse,
  validateSheetAdjustmentTarget,
  validateSpellMechanicCustomization,
  validateSpellSource,
  assertCampaignGmSheetCommandAllowed
} from '@artificer-toolkit/rules-runtime/character/sheetCommandValidation'
import { characterSheetAdjustmentMatchesPanelTarget } from '@artificer-toolkit/rules-runtime/character/sheetPanelTarget'
import { presentCampaignCharacterHistory } from '@artificer-toolkit/rules-runtime/character/campaignCharacterPresentation'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import type { Doc } from '../_generated/dataModel'
import { type MutationCtx } from '../_generated/server'
import { retainCharacterEquipmentRules } from './acquiredEquipment'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet, projectCharacterSheetFacts } from './sheetPreparation'
import { writeCharacterRecord } from './characterWrites'
import type { CharacterSheetSourceContext } from './sheetFacts'
import { readCharacterPublication, readCharacterSources } from './context'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import { prepareCharacterRest } from './rest'
import { readCharacterReceiptHistory } from './documents'
function applySupportedCommand(
  character: CharacterAuthored,
  sheet: CharacterSheetCommandResponseDto['sheet'],
  command: CharacterSheetCommandInputDto,
  now: string,
  attunementSlotLimit: number,
  preparationEligibleSpellIdsByClassId?: ReadonlyMap<string, ReadonlySet<string>>,
  extraDefaults?: NonNullable<Parameters<typeof applyCharacterSheetCommand>[3]>['extraDefaults']
): CharacterAuthored {
  switch (command.type) {
    case 'ADD_SHEET_EXTRA':
    case 'UPDATE_SHEET_EXTRA':
    case 'REMOVE_SHEET_EXTRA':
    case 'ADD_INVENTORY_ITEM':
    case 'REMOVE_INVENTORY_ITEM':
    case 'UPDATE_INVENTORY_ITEM':
    case 'EQUIP_ITEM':
    case 'UNEQUIP_ITEM':
    case 'ATTUNE_ITEM':
    case 'UNATTUNE_ITEM':
    case 'ADJUST_CURRENCY':
    case 'MOVE_CURRENCY':
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
    case 'SET_SPELL_MECHANIC_CUSTOMIZATION':
    case 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION':
    case 'CAST_SPELL':
    case 'SET_KNOWN_SPELLS':
    case 'SET_PREPARED_SPELLS':
    case 'USE_SPELL_SLOT':
    case 'RESTORE_SPELL_SLOT':
    case 'USE_RESOURCE':
    case 'RESTORE_RESOURCE':
    case 'USE_SHEET_RESOURCE':
    case 'RECOVER_SHEET_RESOURCE':
    case 'UPSERT_SHEET_ADJUSTMENT':
    case 'REMOVE_SHEET_ADJUSTMENT':
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
    case 'SET_HIT_POINTS':
    case 'SET_INSPIRATION':
    case 'ADJUST_HIT_POINTS':
    case 'USE_HIT_DIE':
    case 'SET_EXHAUSTION':
    case 'ADD_CONDITION':
    case 'REMOVE_CONDITION':
    case 'CREATE_NOTE':
    case 'UPDATE_NOTE':
    case 'DELETE_NOTE':
    case 'CREATE_NOTE_GROUP':
    case 'UPDATE_NOTE_GROUP':
    case 'DELETE_NOTE_GROUP':
      return applyCharacterSheetCommand(character, command, sheet, {
        now: () => now,
        attunementSlotLimit,
        extraDefaults,
        preparationEligibleSpellIdsByClassId
      })
    default:
      throw new Error(`Sheet command ${command.type} is not available yet.`)
  }
}

/** Both public endpoints supply authenticated identity; only the Campaign endpoint supplies scope. */
export async function executeCharacterSheetCommand(
  ctx: MutationCtx,
  userId: string,
  input: CharacterSheetExecuteInput,
  campaignId?: string,
  sourceContext?: CharacterSheetSourceContext
): Promise<CharacterSheetCommandResponseDto> {
  if (sourceContext && input.command.type !== 'RECOVER_SHEET_RESOURCE')
    throw new Error('Only Clock resource recovery accepts an existing source context.')
  const catalogScope =
    input.command.type === 'ADD_INVENTORY_ITEM' ||
    (input.command.type === 'UPSERT_SHEET_ADJUSTMENT' &&
      input.command.adjustment.family === 'PROFICIENCY')
      ? 'resolution'
      : 'active'
  const initial = await loadCharacterSheet(
    ctx,
    userId,
    input.id,
    campaignId,
    sourceContext,
    catalogScope
  )
  if (!initial) throw new Error('Character Sheet is unavailable for the current user.')
  if (initial.campaignContext.viewer === 'CAMPAIGN_OWNER') {
    if (initial.campaignContext.campaignStatus !== 'ACTIVE')
      throw new Error('Archived Campaigns are read-only.')
    assertCampaignGmSheetCommandAllowed(input.command)
  }

  const commandJson: unknown = JSON.parse(JSON.stringify(input.command))
  const commandFingerprint = checksumRuleDocument(commandJson)
  const commandId = input.command.commandId.toLowerCase()
  const receipt = await ctx.db
    .query('characterCommandReceipts')
    .withIndex('by_characterId_commandId', (q) =>
      q.eq('characterId', initial.active.id).eq('commandId', commandId)
    )
    .unique()

  if (receipt) {
    if (
      receipt.characterId !== initial.active.id ||
      receipt.commandId !== commandId ||
      receipt.actorId !== userId
    ) {
      throw new Error('Stored Sheet command receipt identity mismatch.')
    }
    const historyEntry = readCharacterReceiptHistory(receipt)
    if (receipt.commandFingerprint !== commandFingerprint)
      throw new Error('Sheet command replay does not match the original command.')
    const replaySheet = projectCharacterSheetForViewer(initial.sheet, initial.campaignContext)
    if (catalogScope === 'resolution') {
      const activeEquipmentIds = new Set(
        initial.resolution.registry.equipment.map((equipment) => equipment.id)
      )
      replaySheet.reference.equipmentOptions = replaySheet.reference.equipmentOptions.filter(
        (option) => activeEquipmentIds.has(option.id)
      )
    }
    return characterSheetCommandResponseDtoSchema.parse({
      characterId: initial.active.id,
      streamVersion: initial.sheet.meta.streamVersion,
      sheet: replaySheet,
      historyEntry: presentCampaignCharacterHistory(
        { characterId: initial.active.id, entries: [historyEntry] },
        initial.contentMaturity,
        initial.campaignContext.viewer
      ).entries[0],
      ...(historyEntry.result ? { result: historyEntry.result } : {})
    })
  }

  if (input.command.expectedVersion !== initial.active.streamVersion)
    throw new Error('Character Sheet changed; refresh before applying this command.')

  const command = input.command
  const extraDefaults = {
    creatures: new Map<string, Pick<CreatureAuthored, 'hitPoints' | 'hitDice'>>(),
    vehicles: new Map<string, Pick<VehicleAuthored, 'hitPoints'>>()
  }
  if (command.type === 'ADD_SHEET_EXTRA') {
    const extra = command.extra
    const sourceId = extra.kind === 'VEHICLE' ? extra.vehicleId : extra.creatureId
    const sources = await readCharacterSources(ctx, initial.character, initial.character.userId)
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', sourceId))
      .unique()
    const published = root
      ? await readCharacterPublication(
          ctx,
          root,
          initial.character.systemId,
          initial.character.userId,
          sources
        )
      : null
    if (
      extra.kind === 'VEHICLE' &&
      published?.subjectKind === 'VEHICLE' &&
      (published.document.status ?? 'ACTIVE') === 'ACTIVE'
    ) {
      extraDefaults.vehicles.set(sourceId, { hitPoints: published.document.hitPoints })
    } else if (
      extra.kind !== 'VEHICLE' &&
      published?.subjectKind === 'CREATURE' &&
      (published.document.status ?? 'ACTIVE') === 'ACTIVE'
    ) {
      extraDefaults.creatures.set(sourceId, {
        hitPoints: published.document.hitPoints,
        hitDice: published.document.hitDice
      })
    } else {
      throw new CharacterSheetCommandError('Extra source is not available for this character.')
    }
  }
  if (command.type === 'UPDATE_SPELL_SOURCE_CUSTOMIZATION')
    validateSpellSource(command.source, initial.sheet)
  if (
    command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION' ||
    command.type === 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION'
  )
    validateSpellMechanicCustomization(command, initial.sheet)
  const spellEligibilityInput = {
    rulePolicyInput: initial.ruleEvaluation.facts,
    rulePolicyOutput: initial.ruleEvaluation.output
  }
  if (command.type === 'SET_KNOWN_SPELLS') {
    const eligible = getCharacterSpellKnownEligibleIdsByClass(spellEligibilityInput).get(
      command.classId
    )
    const unavailable = command.spellIds.find((id) => !eligible?.has(id))
    if (unavailable)
      throw new CharacterSheetCommandError(
        `Spell "${unavailable}" is not available for class "${command.classId}".`
      )
  }
  if (command.type === 'UPSERT_SHEET_ADJUSTMENT')
    validateSheetAdjustmentTarget(command.adjustment, initial.resolution, initial.character)
  if (command.type === 'REMOVE_SHEET_ADJUSTMENT') {
    validatePanelTarget(command.target, initial.resolution, initial.character)
    const existing = initial.sheetState.adjustments.find(
      (adjustment) => adjustment.id === command.adjustmentId && adjustment.family === command.family
    )
    if (!existing || !characterSheetAdjustmentMatchesPanelTarget(existing, command.target))
      throw new Error('The adjustment is unavailable in this Sheet panel.')
  }
  if (command.type === 'RESET_SHEET_PANEL_ADJUSTMENTS')
    validatePanelTarget(command.target, initial.resolution, initial.character)
  if (
    command.type === 'SET_MOVEMENT_DISPLAY_PREFERENCE' &&
    command.preference.mode === 'EXPLICIT'
  ) {
    const speedId = command.preference.speedId
    if (!initial.resolution.registry.system?.speeds.some((speed) => speed.id === speedId))
      throw new Error('Movement type is unavailable in this Game System.')
  }
  let resourceUsageUpdate:
    | {
        resource: CharacterSheetCommandResponseDto['sheet']['resources']['items'][number]
        used: number
      }
    | undefined
  const getRawResourceUsed = (resource: SheetResource) => {
    const ownerKey = createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(resource.owner))
    return (
      initial.sheetState.resourceUsage.find(
        (usage) => createCharacterResourceOwnerKey(usage.owner) === ownerKey
      )?.used ?? resource.used
    )
  }
  if (
    command.type === 'USE_RESOURCE' ||
    command.type === 'RESTORE_RESOURCE' ||
    command.type === 'USE_SHEET_RESOURCE' ||
    command.type === 'RECOVER_SHEET_RESOURCE'
  ) {
    const resource =
      'owner' in command
        ? ensureResourceByOwner(initial.sheet, command.owner)
        : ensureResource(initial.sheet, command.resourceGrantId)
    const used = getRawResourceUsed(resource)
    if (command.type === 'USE_RESOURCE' || command.type === 'USE_SHEET_RESOURCE') {
      const amount = command.amount ?? 1
      validateActionResourceUse({
        sheet: initial.sheet,
        actionId: command.actionId,
        resourceId: resource.id,
        amount
      })
      if (amount > resource.remaining)
        throw new CharacterSheetCommandError(
          `Resource "${resource.label}" only has ${resource.remaining} uses remaining.`
        )
      resourceUsageUpdate = { resource, used: used + amount }
    } else if (command.type === 'RECOVER_SHEET_RESOURCE') {
      if (!resource.recoveries.some((recovery) => recovery.trigger === command.trigger))
        throw new CharacterSheetCommandError(`Resource cannot be recovered by ${command.trigger}.`)
      resourceUsageUpdate = { resource, used: 0 }
    } else {
      resourceUsageUpdate = {
        resource,
        used: command.all ? 0 : Math.max(used - (command.amount ?? 1), 0)
      }
    }
  }
  if (command.type === 'CAST_SPELL') {
    const { source, spell } = resolveSpellCastSource(initial.sheet, command)
    if (
      spell.level > 0 &&
      (source?.castMode === 'LIMITED_USE' || source?.castMode === 'FIXED_LEVEL') &&
      source.resourceOwner
    ) {
      const resource = ensureResourceByOwner(initial.sheet, source.resourceOwner)
      resourceUsageUpdate = { resource, used: getRawResourceUsed(resource) + 1 }
    }
  }
  const occurredAt = new Date(
    Math.max(Date.now(), Date.parse(initial.active.updatedAt) + 1)
  ).toISOString()
  const rest =
    command.type === 'COMPLETE_REST'
      ? await prepareCharacterRest(ctx, userId, initial, {
          restKind: command.restKind,
          expectedVersion: command.expectedVersion,
          selectedHitDice: command.selectedHitDice,
          resetMaximumHitPointModifier: command.resetMaximumHitPointModifier,
          healingMode: command.healingMode,
          manualHealingAccepted: command.manualHealingAccepted,
          selectedCompanionInstanceIds: command.selectedCompanionInstanceIds,
          rollId: command.rollId,
          rollEvidence: command.rollEvidence,
          requestRoll: false
        })
      : undefined
  if (
    command.type === 'COMPLETE_REST' &&
    rest?.preview.previewFingerprint !== command.previewFingerprint
  )
    throw new CharacterSheetCommandError(
      'Rest preview changed; preview the rest again before applying it.'
    )
  if (rest && !rest.preview.canApply)
    throw new CharacterSheetCommandError('This rest has no completed recovery to apply.')
  const completedRest =
    command.type === 'COMPLETE_REST' && rest
      ? applyCompletedCharacterRest({
          character: initial.character,
          command,
          preview: rest.preview,
          restPolicy: rest.restPolicy,
          sheet: initial.sheet
        })
      : undefined
  const recoveredResourceIds = new Set(completedRest?.allRecoveredResourceIds)
  const recoveredResourceOwnerKeys = new Set(
    initial.sheet.resources.items
      .filter((resource) => recoveredResourceIds.has(resource.id))
      .map((resource) =>
        createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(resource.owner))
      )
  )
  if (command.type === 'UPDATE_INVENTORY_ITEM' && command.quantity !== undefined) {
    const held = initial.character.state.equipment.inventory.find(
      (item) => item.id === command.itemId
    )
    if (
      held &&
      command.quantity > held.quantity &&
      initial.sourceContext.context.publications.get(held.equipmentId)?.subjectKind !== 'EQUIPMENT'
    )
      throw new CharacterSheetCommandError('New Equipment copies require current source access.')
  }
  const updated = characterAuthoredDtoSchema.parse(
    completedRest?.character ??
      applySupportedCommand(
        initial.character,
        initial.sheet,
        input.command,
        occurredAt,
        initial.ruleEvaluation.output.rest.attunementSlotLimit,
        command.type === 'SET_PREPARED_SPELLS'
          ? getCharacterSpellPreparationEligibleIdsByClass(spellEligibilityInput)
          : undefined,
        extraDefaults
      )
  )
  if (command.type === 'ADD_INVENTORY_ITEM')
    updated.state = await retainCharacterEquipmentRules(ctx, updated as CharacterAuthored)
  const removedItemId =
    (command.type === 'REMOVE_INVENTORY_ITEM' || command.type === 'UPDATE_INVENTORY_ITEM') &&
    !updated.state.equipment.inventory.some((item) => item.id === command.itemId)
      ? command.itemId
      : undefined
  const removedCompanionId =
    command.type === 'REMOVE_SHEET_EXTRA' && command.extra.kind !== 'VEHICLE'
      ? command.extra.extraId
      : undefined
  let spellCustomizations = initial.sheetState.spellCustomizations
  if (command.type === 'UPDATE_SPELL_SOURCE_CUSTOMIZATION') {
    const sourceKey = createCharacterSpellSourceKey(command.source)
    const existing = spellCustomizations.find(
      (customization) => createCharacterSpellSourceKey(customization.source) === sourceKey
    )
    const customization = {
      id: existing?.id ?? crypto.randomUUID(),
      characterId: initial.active.id,
      source: command.source,
      customName:
        command.customName === undefined ? existing?.customName : (command.customName ?? undefined),
      notes: command.notes === undefined ? existing?.notes : (command.notes ?? undefined),
      displayAsAttack: command.displayAsAttack ?? existing?.displayAsAttack ?? false,
      createdBy: existing?.createdBy ?? userId,
      createdAt: existing?.createdAt ?? occurredAt,
      updatedBy: userId,
      updatedAt: occurredAt
    }
    spellCustomizations = spellCustomizations.filter(
      (entry) => createCharacterSpellSourceKey(entry.source) !== sourceKey
    )
    if (customization.customName || customization.notes || customization.displayAsAttack)
      spellCustomizations.push(customization)
  }
  const nextSheetState = characterSheetStateSchema.parse({
    spellCustomizations,
    adjustments: getProspectiveSheetAdjustments({
      adjustments: initial.sheetState.adjustments,
      characterId: initial.active.id,
      command,
      userId,
      now: occurredAt
    }).filter(
      (adjustment) =>
        adjustment.id !== rest?.resetMaximumModifierId &&
        (adjustment.family !== 'ITEM' || adjustment.itemInstanceId !== removedItemId)
    ),
    movementDisplayPreference:
      command.type === 'SET_MOVEMENT_DISPLAY_PREFERENCE'
        ? command.preference
        : initial.sheetState.movementDisplayPreference,
    resourceUsage: getProspectiveSheetResourceUsage({
      resourceUsage: initial.sheetState.resourceUsage,
      resourceUsageUpdate,
      characterId: initial.active.id,
      userId,
      now: occurredAt
    }).filter(
      (usage) =>
        !recoveredResourceOwnerKeys.has(createCharacterResourceOwnerKey(usage.owner)) &&
        (usage.owner.kind !== 'ITEM_INSTANCE' || usage.owner.itemInstanceId !== removedItemId) &&
        (usage.owner.kind !== 'COMPANION_FEATURE' ||
          usage.owner.companionInstanceId !== removedCompanionId)
    )
  })
  const sheetStateChanged =
    canonicalizeRuleDocument(JSON.parse(JSON.stringify(nextSheetState))) !==
    canonicalizeRuleDocument(initial.sheetState)
  const streamVersion = initial.active.streamVersion + 1
  // One rest spends its roll once, wherever the roll is stored.
  if (rest?.roll) await ctx.db.patch(rest.roll._id, { consumedAt: occurredAt })

  if (command.type === 'COMPLETE_REST' && completedRest) {
    const restTriggers =
      command.restKind === 'LONG'
        ? new Set(['SHORT_REST', 'LONG_REST'] as const)
        : new Set(['SHORT_REST'] as const)
    const owner = { kind: 'CHARACTER' as const, characterId: initial.active.id }
    const effectStore = createActiveRuleEffectStore(ctx)
    const activeEffects = await effectStore.list(owner)
    for (const effect of activeEffects) {
      if (effect.definition.schemaVersion !== 2) continue
      if (
        !effect.definition.stateContributions.some(
          (contribution) =>
            contribution.kind === 'SCALAR_REDUCTION' &&
            contribution.recoveryTriggers.some((trigger) => restTriggers.has(trigger))
        )
      )
        continue
      await effectStore.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })
    }
  }

  // The validated authored sources cannot change within this transaction. Reload only when the
  // command changes which source-backed records belong to the Character.
  const changesSourceRecords =
    command.type === 'ADD_INVENTORY_ITEM' ||
    command.type === 'REMOVE_INVENTORY_ITEM' ||
    removedItemId !== undefined ||
    command.type === 'ADD_SHEET_EXTRA' ||
    command.type === 'REMOVE_SHEET_EXTRA'
  const unchangedSources =
    changesSourceRecords || catalogScope === 'resolution' ? undefined : initial.sourceContext
  const write = (document: typeof updated, row: Doc<'characters'>) =>
    writeCharacterRecord(ctx, {
      current: row,
      fields: { streamVersion, updatedAt: occurredAt },
      document: JSON.parse(JSON.stringify(document)),
      ...(sheetStateChanged ? { sheetState: nextSheetState } : {}),
      sourceContext: unchangedSources,
      evaluateAs: { userId, campaignId }
    })
  let written = await write(updated, initial.active)
  if (!written.facts) throw new Error('Character Sheet is unavailable after applying this command.')
  let current = projectCharacterSheetFacts(written.facts)

  const shouldClampHitPoints =
    (command.type === 'UPSERT_SHEET_ADJUSTMENT' && command.adjustment.family === 'HIT_POINTS') ||
    (command.type === 'REMOVE_SHEET_ADJUSTMENT' && command.family === 'HIT_POINTS') ||
    (command.type === 'RESET_SHEET_PANEL_ADJUSTMENTS' && command.target.kind === 'HIT_POINTS') ||
    (command.type === 'SET_HIT_POINTS' && command.maxOverride !== undefined)
  const clampedHitPoints = clampCharacterCurrentHitPoints(
    updated.state.hitpoints.current,
    current.sheet.overview.maxHitPoints
  )
  if (shouldClampHitPoints && clampedHitPoints !== updated.state.hitpoints.current) {
    updated.state.hitpoints.current = clampedHitPoints
    // ponytail: HP overrides may need a third projection; reuse loaded facts if managed profiling requires it.
    written = await write(updated, written.row)
    if (!written.facts) throw new Error('Character Sheet is unavailable after clamping hit points.')
    current = projectCharacterSheetFacts(written.facts)
  }

  const receiptId = crypto.randomUUID()
  const result = completedRest
    ? { type: 'COMPLETE_REST' as const, rest: completedRest.result }
    : undefined
  const historyEntry = characterHistoryEntryDtoSchema.parse({
    eventId: receiptId,
    occurredAt,
    actorId: userId,
    eventType: input.command.type,
    summary: summarizeCharacterSheetCommand(input.command, initial.sheet),
    ...(result ? { result } : {})
  })
  const historyJson = canonicalizeRuleDocument(historyEntry)
  const storedReceipt = characterStoredCommandReceiptSchema.parse({
    id: receiptId,
    characterId: current.active.id,
    commandId,
    actorId: userId,
    commandFingerprint,
    occurredAt,
    historyJson,
    historyChecksum: checksumRuleDocument(historyEntry)
  })
  await ctx.db.insert('characterCommandReceipts', storedReceipt)

  return characterSheetCommandResponseDtoSchema.parse({
    characterId: current.active.id,
    streamVersion: current.sheet.meta.streamVersion,
    sheet: projectCharacterSheetForViewer(current.sheet, current.campaignContext),
    historyEntry: presentCampaignCharacterHistory(
      { characterId: current.active.id, entries: [historyEntry] },
      current.contentMaturity,
      current.campaignContext.viewer
    ).entries[0],
    ...(result ? { result } : {})
  })
}

export const execute = mutation({
  args: zodToConvexFields(characterSheetExecuteInputSchema.shape),
  returns: zodToConvex(characterSheetCommandResponseDtoSchema),
  handler: async (ctx, args): Promise<CharacterSheetCommandResponseDto> => {
    const { userId } = await requireIdentity(ctx)
    return executeCharacterSheetCommand(ctx, userId, characterSheetExecuteInputSchema.parse(args))
  }
})
