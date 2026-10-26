import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterSheetCommandExecutionDtoSchema,
  characterSheetCommandResponseDtoSchema,
  characterSheetExecuteInputSchema,
  type CharacterSheetCommandInputDto,
  type CharacterSheetCommandExecutionDto,
  type CharacterSheetCommandResponseDto,
  type CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { characterSheetReadInputSchema } from '@artificer-toolkit/schema/api/characterSheet'
import { characterSheetCommandValidator } from './sheetCommandValidator'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import type {
  CharacterAuthored,
  CreatureAuthored,
  VehicleAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import {
  clampCharacterCurrentHitPoints,
  createCharacterSpellSourceKey
} from '@artificer-toolkit/shared/character'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  applyCharacterSheetCommand,
  CharacterSheetCommandError,
  summarizeCharacterSheetCommand
} from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import {
  getProspectiveSheetAdjustments,
  pruneSheetAdjustments
} from '@artificer-toolkit/rules-runtime/character/sheetAdjustmentCommands'
import {
  getProspectiveSheetResourceUsage,
  getSheetCommandResourceUsageUpdate,
  pruneSheetResourceUsage
} from '@artificer-toolkit/rules-runtime/character/sheetResourceUsage'
import {
  activeEffectEndsOnRest,
  applyCompletedCharacterRest
} from '@artificer-toolkit/rules-runtime/character/sheetRest'
import {
  getCharacterSpellKnownEligibleIdsByClass,
  getCharacterSpellPreparationEligibleIdsByClass
} from '@artificer-toolkit/rules-runtime/character/characterSpellPreparationEligibility'
import {
  validatePanelTarget,
  validateSheetAdjustmentTarget,
  validateSpellMechanicCustomization,
  validateSpellSource,
  assertCampaignGmSheetCommandAllowed,
  assertGmOnlySheetCommandAllowed
} from '@artificer-toolkit/rules-runtime/character/sheetCommandValidation'
import { characterSheetAdjustmentMatchesPanelTarget } from '@artificer-toolkit/rules-runtime/character/sheetPanelTarget'
import { settleCharacterEndedEffects } from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import {
  characterStandingEffects,
  prepareRestStandingEffects
} from '@artificer-toolkit/rules-runtime/standingEffectPlans'
import { compileCharacterSpellCasts } from '@artificer-toolkit/rules-runtime/character/characterSpellCastActions'
import { sheetSpellCastSummonPlacement } from '@artificer-toolkit/rules-runtime/character/sheetSpellSummon'
import { characterTotalLevel } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { type MutationCtx } from '../_generated/server'
import { retainCharacterEquipmentRules } from './acquiredEquipment'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet, projectCharacterSheetFacts } from './sheetPreparation'
import { writeCharacterRecord } from './characterWrites'
import type { CharacterSheetSourceContext } from './sheetFacts'
import { readCharacterPublication, readCharacterSources } from './context'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { endCharacterActiveEffect } from '@artificer-toolkit/encounter-persistence/characterActiveEffects'
import { endGrantsOnHitPointsRegained } from '@artificer-toolkit/encounter-persistence/consumedGrantPersistence'
import { endCarriedConcentration } from './sheetConcentration'
import { prepareCharacterRest } from './rest'
import { readCharacterCommandReplay, writeCharacterCommandReceipt } from './sheetCommandReceipts'
import { recordSheetDeathSaveRoll } from './sheetDeathSaveRoll'
import { nextRollInt } from '../lib/rollRandom'
import { executeCharacterNoteCommand } from './sheetNoteCommands'
import { executeCharacterPlayPreferenceCommand } from './sheetPlayPreferences'
import type { CharacterRecordRow } from './stateDocuments'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { isCharacterSheetLivePlayCommand } from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { assertConvexOwnsCharacterPlay } from '../liveSessions/authorityGuard'
function applySupportedCommand(
  character: CharacterAuthored,
  sheet: CharacterSheetCommandExecutionDto['sheet'],
  command: CharacterSheetCommandInputDto,
  context: NonNullable<Parameters<typeof applyCharacterSheetCommand>[3]>
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
    case 'SWAP_HELD_ITEMS':
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
    case 'END_ACTIVE_EFFECT':
    case 'END_CONCENTRATION':
    case 'UPSERT_SHEET_ADJUSTMENT':
    case 'REMOVE_SHEET_ADJUSTMENT':
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
    case 'SET_PARTY_VISIBILITY':
    case 'SET_HIT_POINTS':
    case 'SET_INSPIRATION':
    case 'ADJUST_HIT_POINTS':
    case 'USE_HIT_DIE':
    case 'SET_DEATH_SAVES':
    case 'ROLL_DEATH_SAVE':
    case 'SET_EXHAUSTION':
    case 'ADD_CONDITION':
    case 'REMOVE_CONDITION':
    case 'REMOVE_CONSEQUENCE':
    case 'CREATE_NOTE':
    case 'UPDATE_NOTE':
    case 'DELETE_NOTE':
    case 'CREATE_NOTE_GROUP':
    case 'UPDATE_NOTE_GROUP':
    case 'DELETE_NOTE_GROUP':
      return applyCharacterSheetCommand(character, command, sheet, context)
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
): Promise<CharacterSheetCommandExecutionDto> {
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
    catalogScope,
    undefined,
    input.command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION' ||
      input.command.type === 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION'
      ? [input.command.source.spellId]
      : []
  )
  if (!initial) throw new Error('Character Sheet is unavailable for the current user.')
  if (initial.campaignContext.viewer === 'CAMPAIGN_OWNER') {
    if (initial.campaignContext.campaignStatus !== 'ACTIVE')
      throw new Error('Archived Campaigns are read-only.')
    assertCampaignGmSheetCommandAllowed(input.command)
  }
  assertGmOnlySheetCommandAllowed(input.command, initial.campaignContext.isCampaignOwner)
  if (
    (input.command.type === 'SET_HIT_POINTS' &&
      (input.command.current !== undefined || input.command.temp !== undefined)) ||
    isCharacterSheetLivePlayCommand(input.command) ||
    input.command.type === 'COMPLETE_REST'
  )
    await assertConvexOwnsCharacterPlay(ctx, initial.active.id)

  const replay = await readCharacterCommandReplay(ctx, {
    characterId: initial.active.id,
    userId,
    command: input.command,
    streamVersion: initial.active.play.streamVersion,
    contentMaturity: initial.contentMaturity,
    viewer: initial.campaignContext.viewer
  })
  if (replay) {
    const replaySheet = projectCharacterSheetForViewer(initial.sheet, initial.campaignContext)
    if (catalogScope === 'resolution') {
      const activeEquipmentIds = new Set(
        initial.resolution.registry.equipment.map((equipment) => equipment.id)
      )
      replaySheet.reference.equipmentOptions = replaySheet.reference.equipmentOptions.filter(
        (option) => activeEquipmentIds.has(option.id)
      )
    }
    return characterSheetCommandExecutionDtoSchema.parse({
      ...replay,
      sheet: replaySheet
    })
  }

  if (input.command.expectedVersion !== initial.active.play.streamVersion)
    throw new Error('Character Sheet changed; refresh before applying this command.')

  const command = input.command
  const deathSaveDie = command.type === 'ROLL_DEATH_SAVE' ? nextRollInt(20) + 1 : undefined
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
  const resourceUsageUpdate = getSheetCommandResourceUsageUpdate({
    sheet: initial.sheet,
    resourceUsage: initial.sheetState.resourceUsage,
    command
  })
  const occurredAt = new Date(
    Math.max(
      Date.now(),
      Date.parse(initial.active.updatedAt) + 1,
      Date.parse(initial.active.play.updatedAt) + 1
    )
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
      applySupportedCommand(initial.character, initial.sheet, input.command, {
        now: () => occurredAt,
        attunementSlotLimit: initial.ruleEvaluation.output.rest.attunementSlotLimit,
        preparationEligibleSpellIdsByClassId:
          command.type === 'SET_PREPARED_SPELLS'
            ? getCharacterSpellPreparationEligibleIdsByClass(spellEligibilityInput)
            : undefined,
        spellSummonPlacement: (cast) =>
          sheetSpellCastSummonPlacement({
            casts: compileCharacterSpellCasts({
              gameSystemId: initial.character.systemId,
              character: initial.character,
              ruleEvaluation: initial.ruleEvaluation,
              policyOutput: initial.ruleEvaluation.output,
              spellsById: initial.spellsById,
              characterLevel: characterTotalLevel(initial),
              conditionDefinitionIds: (
                initial.resolution.registry.system?.conditionTypes ?? []
              ).map((condition) => condition.id),
              firstSequence: initial.ruleEvaluation.facts.actionCandidates.length
            }),
            spellCastCandidates: initial.ruleEvaluation.facts.spellCastCandidates,
            ...cast
          }),
        extraDefaults,
        deathSaveDie
      })
  )
  if (command.type === 'ADD_INVENTORY_ITEM')
    updated.state = await retainCharacterEquipmentRules(ctx, updated as CharacterAuthored)
  const removedItemId =
    (command.type === 'REMOVE_INVENTORY_ITEM' || command.type === 'UPDATE_INVENTORY_ITEM') &&
    !updated.state.equipment.inventory.some((item) => item.id === command.itemId)
      ? command.itemId
      : undefined
  const removedCompanionId =
    command.type === 'REMOVE_SHEET_EXTRA' &&
    command.extra.kind !== 'VEHICLE' &&
    command.extra.kind !== 'SPELL_SUMMON'
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
    // Play-owned single-use item usage passes through; a Sheet command never changes it.
    itemUsage: initial.sheetState.itemUsage,
    itemDegradation: initial.sheetState.itemDegradation,
    spellCustomizations,
    adjustments: pruneSheetAdjustments({
      adjustments: getProspectiveSheetAdjustments({
        adjustments: initial.sheetState.adjustments,
        characterId: initial.active.id,
        command,
        userId,
        now: occurredAt
      }),
      resetMaximumModifierId: rest?.resetMaximumModifierId,
      removedItemId
    }),
    movementDisplayPreference:
      command.type === 'SET_MOVEMENT_DISPLAY_PREFERENCE'
        ? command.preference
        : initial.sheetState.movementDisplayPreference,
    partyVisibility:
      command.type === 'SET_PARTY_VISIBILITY'
        ? command.visibility
        : initial.sheetState.partyVisibility,
    resourceUsage: pruneSheetResourceUsage({
      resourceUsage: getProspectiveSheetResourceUsage({
        resourceUsage: initial.sheetState.resourceUsage,
        resourceUsageUpdate,
        characterId: initial.active.id,
        userId,
        now: occurredAt
      }),
      resources: initial.sheet.resources.items,
      recoveredResourceIds: new Set(completedRest?.allRecoveredResourceIds),
      removedItemId,
      removedCompanionId
    })
  })
  const sheetStateChanged =
    canonicalizeRuleDocument(JSON.parse(JSON.stringify(nextSheetState))) !==
    canonicalizeRuleDocument(initial.sheetState)
  const streamVersion = initial.active.play.streamVersion + 1
  // One rest spends its roll once, wherever the roll is stored.
  if (rest?.roll) await ctx.db.patch(rest.roll._id, { consumedAt: occurredAt })

  if (command.type === 'END_ACTIVE_EFFECT')
    await endCharacterActiveEffect(
      { db: createConvexEncounterStore(ctx) },
      {
        characterId: initial.active.id,
        effectId: command.effectId,
        isCampaignOwner:
          initial.sourceContext.context.sourceAccess.campaign?.ownerUserId === userId,
        economyEnforced: false
      }
    )

  if (command.type === 'END_CONCENTRATION')
    await endCarriedConcentration(ctx, {
      characterId: initial.active.id,
      campaignId: initial.campaignContext.campaignId,
      occurredAt,
      endsSpellSummon: (initial.character.state.spellSummons ?? []).some(
        (summon) => summon.concentration
      )
    })

  if (command.type === 'COMPLETE_REST' && completedRest) {
    const owner = { kind: 'CHARACTER' as const, characterId: initial.active.id }
    const effectStore = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    for (const effect of initial.activeEffects)
      if (activeEffectEndsOnRest(effect, command.restKind))
        await effectStore.deleteCas({
          id: effect.id,
          owner,
          expectedVersion: effect.version,
          // A rest happens outside a Run: no turn counts down a follow-on grant.
          removal: 'REMOVED'
        })
    // The rest turns each ended standing effect that returns on it back on (SPELLS-31.2).
    const armed = prepareRestStandingEffects({
      standing: characterStandingEffects({
        sources: initial.ruleEvaluation.standingEffectSources,
        gameSystemId: initial.character.systemId,
        conditionDefinitionIds: (initial.resolution.registry.system?.conditionTypes ?? []).map(
          (condition) => condition.id
        ),
        abilityDefinitions: initial.ruleEvaluation.facts.abilityDefinitions
      }),
      restKind: command.restKind,
      holder: {
        actorId: initial.active.id,
        conditionIds: (updated.state.conditions ?? []).map(
          ({ conditionTypeId }) => conditionTypeId
        ),
        effectiveSize: null,
        lifetimeScope: 'OWNER',
        hidden: false,
        held: await effectStore.list(owner)
      },
      origin: {
        characterId: initial.active.id,
        // Effect provenance holds canonical lowercase ids.
        occurrenceId: command.commandId.toLowerCase(),
        commandId: command.commandId.toLowerCase()
      }
    })
    for (const effect of armed)
      await effectStore.create({
        id: effect.id,
        owner,
        definition: effect.definition,
        lifecycle: effect.lifecycle,
        occurredAt
      })
  }

  if (
    command.type === 'END_ACTIVE_EFFECT' ||
    command.type === 'END_CONCENTRATION' ||
    (command.type === 'COMPLETE_REST' && completedRest)
  ) {
    const remaining = await createActiveRuleEffectStore({
      db: createConvexEncounterStore(ctx)
    }).list({ kind: 'CHARACTER', characterId: initial.active.id })
    // The ended effects settle the Character as every effect end does (SPELLS-5.14, QUALITY-1.T1).
    const settled = settleCharacterEndedEffects({
      state: updated.state,
      maximumHitPoints: initial.active.play.maximumHitPoints,
      removed: initial.activeEffects.filter(
        ({ id }) => !remaining.some((effect) => effect.id === id)
      ),
      remaining
    })
    if (settled.changed) {
      updated.state.conditions = settled.conditions
      // A rest has already set hit points against the maximum it rests to (a Campaign's secret one).
      if (command.type !== 'COMPLETE_REST') updated.state.hitpoints = settled.hitpoints
    }
  }

  if (updated.state.hitpoints.current > initial.character.state.hitpoints.current)
    await endGrantsOnHitPointsRegained(
      { db: createConvexEncounterStore(ctx) },
      { kind: 'CHARACTER', characterId: initial.active.id }
    )

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
  const write = (document: typeof updated, row: CharacterRecordRow) =>
    writeCharacterRecord(ctx, {
      current: row,
      fields: { streamVersion, updatedAt: occurredAt },
      document,
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

  if (deathSaveDie !== undefined)
    await recordSheetDeathSaveRoll(ctx, {
      userId,
      campaignId: initial.campaignContext.campaignId,
      character: {
        id: initial.active.id,
        label: initial.character.label,
        systemId: initial.character.systemId
      },
      commandId: command.commandId,
      rawDie: deathSaveDie,
      createdAt: occurredAt
    })

  const result = completedRest
    ? { type: 'COMPLETE_REST' as const, rest: completedRest.result }
    : undefined
  const acknowledgement = await writeCharacterCommandReceipt(ctx, {
    characterId: current.active.id,
    streamVersion: current.active.play.streamVersion,
    userId,
    command: input.command,
    occurredAt,
    summary: summarizeCharacterSheetCommand(input.command, initial.sheet),
    contentMaturity: current.contentMaturity,
    viewer: current.campaignContext.viewer,
    ...(result ? { result } : {})
  })
  return characterSheetCommandExecutionDtoSchema.parse({
    ...acknowledgement,
    sheet: projectCharacterSheetForViewer(current.sheet, current.campaignContext)
  })
}

/** Public command responses are receipts; subscribed state owns the resulting presentation. */
export async function executeCharacterSheetCommandAcknowledgement(
  ctx: MutationCtx,
  userId: string,
  input: CharacterSheetExecuteInput,
  campaignId?: string
): Promise<CharacterSheetCommandResponseDto> {
  switch (input.command.type) {
    case 'SET_INSPIRATION':
    case 'SET_PARTY_VISIBILITY':
      return executeCharacterPlayPreferenceCommand(ctx, userId, input.id, input.command, campaignId)
    case 'CREATE_NOTE':
    case 'UPDATE_NOTE':
    case 'DELETE_NOTE':
    case 'CREATE_NOTE_GROUP':
    case 'UPDATE_NOTE_GROUP':
    case 'DELETE_NOTE_GROUP':
      return executeCharacterNoteCommand(ctx, userId, input.id, input.command, campaignId)
  }
  const { sheet, ...acknowledgement } = await executeCharacterSheetCommand(
    ctx,
    userId,
    input,
    campaignId
  )
  void sheet
  return acknowledgement
}

export const execute = mutation({
  args: {
    ...zodToConvexFields(characterSheetReadInputSchema.shape),
    command: characterSheetCommandValidator
  },
  returns: zodToConvex(characterSheetCommandResponseDtoSchema),
  handler: async (ctx, args): Promise<CharacterSheetCommandResponseDto> => {
    const { userId } = await requireIdentity(ctx)
    return executeCharacterSheetCommandAcknowledgement(
      ctx,
      userId,
      characterSheetExecuteInputSchema.parse(args)
    )
  }
})
