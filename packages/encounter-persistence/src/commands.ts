import { insertRunCommand } from './timelineEntries.js'
import { removeCompletedRunTurnRecords } from './turnMovement.js'
import type { z } from 'zod'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { RoomLocalEncounterCommand } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { rollRecordDtoSchema, type RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { encounterCreatureEquipmentReplacementSchema } from '@artificer-toolkit/schema/projections/encounterCreatureEquipment'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import {
  snapshotFeatureDefinitions,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  findEncounterFeatureResource,
  reconcileEncounterActorRuleOutput
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { nextEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { requireEncounterActorControllerCandidates } from './actorController.js'
import { freezeEncounterCharacterStates } from './characterStates.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { readRunActors, readRunState, writeRunActor } from './documents.js'
import { createEncounterInitiativeStore } from './initiativeStore.js'
import { correctInitiativeCursor } from './initiativeCorrection.js'
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { replaceActorEquipment } from './actorEquipment.js'
import { removeEncounterActor } from './actorRemovalCommand.js'
import { reorderEncounterActors } from './actorReorderCommand.js'
import { reinforceEncounterActors } from './actorReinforcementCommand.js'
import { revertLastEncounterAction } from './actionRevert.js'
import { enemyActionRollLabel, readNativeEncounterCommandReplay } from './commandReplay.js'
import { rejectDomain } from './domainRejections.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { rollEncounterRuleEvidence } from './evidenceRolls.js'
import type { EncounterPersistenceTransaction, EncounterWriteTransaction } from './ports.js'

type RoomEncounterToolCommand = Exclude<
  RoomLocalEncounterCommand,
  { type: 'REORDER' | 'REMOVE_ACTOR' | 'REINFORCE' | 'REVERT_LAST_ACTION' }
>
type EncounterToolCommand =
  | RoomEncounterToolCommand
  | Extract<
      EncounterCommandInputDto,
      { type: 'UPDATE_ACTOR' | 'ROLL_ACTOR_INITIATIVE' | 'ROLL_ENEMY_ACTION' }
    >

/** The stored actor a GM tool edits, checked against its row and the Run. */
async function readCommandActor(
  ctx: EncounterPersistenceTransaction,
  state: EncounterRunState,
  actorId: string
) {
  if (!state.actorIds.includes(actorId)) throw new Error('Encounter actor was not found.')
  const actorRow = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id).eq('id', actorId))
    .unique()
  if (!actorRow) throw new Error('Encounter actor was not found.')
  const actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
  if (
    actor.id !== actorRow.id ||
    actor.encounterId !== state.id ||
    actor.systemId !== state.gameSystemId ||
    checksumCanonicalJson(actor) !== actorRow.stateChecksum ||
    !state.sides.some((side) => side.id === actor.sideId)
  )
    throw new Error('Stored Encounter actor mismatch.')
  return { actorRow, actor }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireFeatureChargeLedger(resources: unknown): void {
  if (!isRecord(resources)) throw new Error('Encounter feature resource state is invalid.')
  const featureCharges = resources.featureCharges
  if (featureCharges === undefined) return
  if (!isRecord(featureCharges)) throw new Error('Encounter feature resource state is invalid.')
  if (
    Object.values(featureCharges).some(
      (used) => typeof used !== 'number' || !Number.isSafeInteger(used) || used < 0
    )
  )
    throw new Error('Encounter feature resource state is invalid.')
}

/**
 * Records a GM tool command, or a dice command with the room's draws: `nextInt(size)` returns the
 * next draw in `[0, size)` (D41).
 */
export async function recordEncounterCommand(
  ctx: EncounterWriteTransaction,
  command: EncounterCommandInputDto,
  userId: string,
  nextInt: (size: number) => number
): Promise<EncounterCommandResultDto> {
  if (command.type === 'ROLL_RULE_EVIDENCE')
    return rollEncounterRuleEvidence(ctx, command, userId, nextInt)
  if (command.type === 'REMOVE_ACTOR') return removeEncounterActor(ctx, command, userId)
  if (command.type === 'REORDER') return reorderEncounterActors(ctx, command, userId)
  if (command.type === 'REINFORCE') return reinforceEncounterActors(ctx, command, userId)
  if (command.type === 'REVERT_LAST_ACTION') return revertLastEncounterAction(ctx, command, userId)
  if (
    command.type !== 'UPSERT_REMINDER' &&
    command.type !== 'REMOVE_REMINDER' &&
    command.type !== 'UPDATE_ACTOR' &&
    command.type !== 'REPLACE_CREATURE_EQUIPMENT' &&
    command.type !== 'PREVIOUS_TURN' &&
    command.type !== 'SET_CURRENT_ACTOR' &&
    command.type !== 'SET_ROUND' &&
    command.type !== 'SET_INITIATIVE' &&
    command.type !== 'ROLL_ACTOR_INITIATIVE' &&
    command.type !== 'ROLL_ENEMY_ACTION' &&
    command.type !== 'ADJUST_FEATURE_RESOURCE' &&
    command.type !== 'COMPLETE' &&
    command.type !== 'REPLACE_OPTIONAL_COMBAT_RULES' &&
    command.type !== 'SET_HEALTH_DISPLAY_DEFAULT'
  )
    throw new Error('Encounter command is not available.')
  return recordEncounterToolCommand(ctx, command, userId, nextInt)
}

/** Records a generic GM tool command using the transaction's real domain capabilities. */
export function recordEncounterToolCommand(
  ctx: EncounterPersistenceTransaction,
  command: RoomEncounterToolCommand,
  userId: string,
  nextInt: (size: number) => number
): Promise<EncounterCommandResultDto>
export function recordEncounterToolCommand(
  ctx: EncounterWriteTransaction,
  command: EncounterToolCommand,
  userId: string,
  nextInt: (size: number) => number
): Promise<EncounterCommandResultDto>
export async function recordEncounterToolCommand(
  ctx: EncounterPersistenceTransaction | EncounterWriteTransaction,
  command: EncounterToolCommand,
  userId: string,
  nextInt: (size: number) => number
): Promise<EncounterCommandResultDto> {
  const input =
    command.type === 'UPSERT_REMINDER'
      ? {
          ...command,
          encounterId: command.encounterId.toLowerCase(),
          commandId: command.commandId.toLowerCase(),
          reminder: {
            ...command.reminder,
            ...(command.reminder.id === undefined ? {} : { id: command.reminder.id.toLowerCase() }),
            actorId: command.reminder.actorId?.toLowerCase() ?? null
          }
        }
      : command.type === 'REMOVE_REMINDER'
        ? {
            ...command,
            encounterId: command.encounterId.toLowerCase(),
            commandId: command.commandId.toLowerCase(),
            reminderId: command.reminderId.toLowerCase()
          }
        : command.type === 'PREVIOUS_TURN' ||
            command.type === 'SET_ROUND' ||
            command.type === 'SET_HEALTH_DISPLAY_DEFAULT' ||
            command.type === 'COMPLETE'
          ? {
              ...command,
              encounterId: command.encounterId.toLowerCase(),
              commandId: command.commandId.toLowerCase()
            }
          : command.type === 'REPLACE_OPTIONAL_COMBAT_RULES'
            ? {
                ...command,
                encounterId: command.encounterId.toLowerCase(),
                commandId: command.commandId.toLowerCase(),
                definitionIds: command.definitionIds.map((definitionId) =>
                  definitionId.toLowerCase()
                )
              }
            : command.type === 'SET_CURRENT_ACTOR'
              ? {
                  ...command,
                  encounterId: command.encounterId.toLowerCase(),
                  commandId: command.commandId.toLowerCase(),
                  actorId: command.actorId?.toLowerCase() ?? null
                }
              : {
                  ...command,
                  encounterId: command.encounterId.toLowerCase(),
                  commandId: command.commandId.toLowerCase(),
                  actorId: command.actorId.toLowerCase(),
                  ...(command.type === 'REPLACE_CREATURE_EQUIPMENT'
                    ? {
                        loadoutEntryId: command.loadoutEntryId.toLowerCase(),
                        equipmentId: command.equipmentId.toLowerCase()
                      }
                    : {}),
                  ...(!('sideId' in command) || command.sideId === undefined
                    ? {}
                    : { sideId: command.sideId.toLowerCase() }),
                  ...(command.type === 'UPDATE_ACTOR' && command.controllerUserIds
                    ? {
                        controllerUserIds: command.controllerUserIds
                          .map((userId) => userId.toLowerCase())
                          .sort()
                      }
                    : {})
                }
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!row) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(row.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (row.gameSystemId !== campaign.gameSystemId)
    throw new Error('Encounter does not match the Campaign Game System.')
  const { fingerprint: commandFingerprint, result: replayResult } =
    await readNativeEncounterCommandReplay(ctx, { input, row, campaign, userId })
  if (replayResult)
    return presentEncounterResultForMember(ctx, { campaign, membership, result: replayResult })
  const state = readRunState(row)
  const actorIds = new Set(state.actorIds)
  const pendingOccurrences = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', row.id).eq('state', 'PENDING'))
    .take(2)
  if (pendingOccurrences.length > 1)
    throw new Error('Stored Encounter occurrence state is invalid.')
  if (pendingOccurrences[0]) rejectDomain('PENDING_DECISION')
  if (row.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  if (row.status === 'COMPLETED') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  const updatedAt = new Date().toISOString()
  let reminders = state.reminders
  let status = state.status
  let round = state.round
  let currentActorId = state.currentActorId
  let characterReceiptId: string | null = null
  let creatureEquipmentReplacement: z.infer<
    typeof encounterCreatureEquipmentReplacementSchema
  > | null = null
  let roll: RollRecordDto | null = null

  let initiativeCorrection: { stateJson: string; stateChecksum: string } | null = null
  let optionalCombatSnapshot = state.optionalCombatSnapshot
  let optionalCombatSnapshotChecksum = state.optionalCombatSnapshotChecksum
  let healthDisplayDefault = state.healthDisplayDefault
  const version = row.version + 1
  if (input.type === 'UPSERT_REMINDER') {
    if (input.reminder.actorId !== null && !actorIds.has(input.reminder.actorId))
      throw new Error('Encounter actor was not found.')
    const reminder = { ...input.reminder, id: input.reminder.id ?? crypto.randomUUID() }
    reminders = [...reminders.filter((current) => current.id !== reminder.id), reminder]
    reminders.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
  } else if (input.type === 'REMOVE_REMINDER') {
    if (!reminders.some((reminder) => reminder.id === input.reminderId))
      throw new Error('Encounter reminder was not found.')
    reminders = reminders.filter((reminder) => reminder.id !== input.reminderId)
  } else if (
    input.type === 'PREVIOUS_TURN' ||
    input.type === 'SET_CURRENT_ACTOR' ||
    input.type === 'SET_ROUND'
  ) {
    if (state.status !== 'ACTIVE')
      rejectDomain('ENCOUNTER_NOT_ACTIVE', 'Only active Encounters can correct turns.')
    const initiative = createEncounterInitiativeStore(ctx)
    const normalized = await initiative.lockInitiativeRound({
      encounterId: row.id,
      round: state.round
    })
    if (!normalized) throw new Error('The normalized initiative round is unavailable.')
    if (
      normalized.round.policySnapshotChecksum !==
      (state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum)
    )
      throw new Error('Initiative policy snapshot does not match the Encounter Run.')
    const runActors = await readRunActors(ctx, state)
    validateInitiativeCursor({
      state: normalized,
      currentActorId: state.currentActorId,
      actorIds: runActors.map((actor) => actor.id),
      allowedSideIds: state.sides.map((side) => side.id)
    })
    let targetRound = state.round
    let targetActorId = state.currentActorId
    if (input.type === 'PREVIOUS_TURN') {
      const ordered = [...normalized.participants].sort(
        (left, right) => left.turnOrderOrdinal! - right.turnOrderOrdinal!
      )
      const currentIndex =
        state.currentActorId === null
          ? 0
          : ordered.findIndex((participant) => participant.actorId === state.currentActorId)
      if (currentIndex < 0)
        throw new Error('The current Encounter actor does not match normalized initiative.')
      const previousIndex = currentIndex === 0 ? ordered.length - 1 : currentIndex - 1
      targetActorId = ordered[previousIndex]!.actorId
      if (currentIndex === 0 && state.round > 1) targetRound = state.round - 1
    } else if (input.type === 'SET_CURRENT_ACTOR') {
      if (input.actorId !== null && !actorIds.has(input.actorId))
        throw new Error('Encounter actor was not found.')
      targetActorId = input.actorId
    } else {
      targetRound = input.round
    }
    const corrected = await correctInitiativeCursor({
      ctx,
      encounterId: row.id,
      sourceRound: state.round,
      targetRound,
      sourceCurrentActorId: state.currentActorId,
      currentActorId: targetActorId
    })
    round = targetRound
    currentActorId = targetActorId
    initiativeCorrection = {
      stateJson: JSON.stringify(corrected),
      stateChecksum: checksumCanonicalJson(corrected)
    }
  } else if (
    input.type === 'SET_INITIATIVE' ||
    input.type === 'ROLL_ACTOR_INITIATIVE' ||
    input.type === 'UPDATE_ACTOR'
  ) {
    if (
      (input.type === 'SET_INITIATIVE' || input.type === 'ROLL_ACTOR_INITIATIVE') &&
      state.status !== 'PREPARED' &&
      state.status !== 'ACTIVE'
    )
      rejectDomain(
        'ENCOUNTER_NOT_ACTIVE',
        'Initiative can only be set on a prepared or active Encounter.'
      )
    const { actorRow, actor: storedActor } = await readCommandActor(ctx, state, input.actorId)
    let actor = storedActor
    if (input.sideId !== undefined && !state.sides.some((side) => side.id === input.sideId))
      throw new Error('Encounter side was not found.')
    if (input.type === 'UPDATE_ACTOR' && input.controllerUserIds !== undefined)
      await requireEncounterActorControllerCandidates(ctx, campaign, input.controllerUserIds)
    if (
      input.type === 'UPDATE_ACTOR' &&
      actor.kind === 'CHARACTER' &&
      input.healthDisplay !== undefined
    )
      throw new Error("A Character's health display is set by its player on the Sheet.")
    if (
      input.type === 'UPDATE_ACTOR' &&
      actor.kind === 'CHARACTER' &&
      (input.currentHitPoints !== undefined ||
        input.tempHitPoints !== undefined ||
        input.conditions !== undefined)
    )
      throw new Error('Character HP must be changed through its Sheet command.')
    if (input.type === 'UPDATE_ACTOR' && input.characterCommand !== undefined) {
      if (actor.kind !== 'CHARACTER')
        throw new Error('Sheet command does not target this Character actor.')
      if (!('executeCharacterCommand' in ctx.ports))
        throw new Error('Encounter Character commands are unavailable in this transaction.')
      const character = await ctx.ports.executeCharacterCommand(userId, {
        characterId: actor.sourceId,
        command: input.characterCommand,
        campaignId: campaign.id
      })
      characterReceiptId = character.historyEventId
    }
    if (input.type === 'ROLL_ACTOR_INITIATIVE') {
      const initiative = await ctx.ports.readActorInitiativeRoll(state, campaign, actor.id)
      const system = await ctx.ports.requireSystem(state.gameSystemId)
      roll = rollRecordDtoSchema.parse({
        id: crypto.randomUUID(),
        characterId: initiative.characterId,
        characterLabel: actor.label,
        source: { kind: 'INITIATIVE', label: 'Initiative' },
        ruleset: {
          systemId: system.id,
          code: system.rulesetCode,
          version: system.rulesetVersion
        },
        ...evaluateRollExpression(
          parseRollExpression(initiative.expression),
          { nextInt },
          initiative.rollMode
        ),
        createdAt: updatedAt
      })
    }
    actor = encounterRunActorStateSchema.parse(
      input.type === 'SET_INITIATIVE' || input.type === 'ROLL_ACTOR_INITIATIVE'
        ? {
            ...actor,
            initiative:
              input.type === 'ROLL_ACTOR_INITIATIVE' ? roll!.evidence.total : input.initiative,
            ...(input.type === 'SET_INITIATIVE' && input.manualOrder !== undefined
              ? { manualOrder: input.manualOrder }
              : {}),
            updatedAt
          }
        : {
            ...actor,
            // A GM hit point edit revives a defeated actor above 0 and defeats one taken to 0 (D63).
            ...(input.currentHitPoints === undefined || actor.kind === 'CHARACTER'
              ? {}
              : {
                  currentHitPoints: input.currentHitPoints,
                  defeated: nextEncounterActorDefeated(actor, input.currentHitPoints)
                }),
            ...(input.tempHitPoints === undefined ? {} : { tempHitPoints: input.tempHitPoints }),
            ...(input.conditions === undefined ? {} : { conditions: input.conditions }),
            ...(input.gmNotes === undefined ? {} : { gmNotes: input.gmNotes }),
            ...(input.public === undefined ? {} : { public: input.public }),
            ...(input.controllerUserIds === undefined
              ? {}
              : { controllerUserIds: input.controllerUserIds }),
            ...(input.disposition === undefined ? {} : { disposition: input.disposition }),
            ...(input.healthDisplay === undefined ? {} : { healthDisplay: input.healthDisplay }),
            ...(input.sideId === undefined ? {} : { sideId: input.sideId }),
            updatedAt
          }
    )
    await writeRunActor(ctx, actorRow._id, actor)
  } else if (input.type === 'ADJUST_FEATURE_RESOURCE') {
    if (state.status !== 'PREPARED' && state.status !== 'ACTIVE')
      rejectDomain(
        'ENCOUNTER_NOT_ACTIVE',
        'Feature resources can only be changed on a prepared or active Encounter.'
      )
    const { actorRow, actor: storedActor } = await readCommandActor(ctx, state, input.actorId)
    let actor = storedActor
    if (actor.kind === 'CHARACTER')
      throw new Error('Character resources must be changed through the Character Sheet.')
    const feature = snapshotFeatureDefinitions(actor).find(
      (candidate) => candidate.id === input.featureId
    )
    if (!feature) throw new Error('Encounter feature resource is unavailable.')
    requireFeatureChargeLedger(actor.resources)
    const durableActors = await readRunActors(ctx, state)
    const facts = buildEncounterActorRuleFacts({ actors: durableActors })
    const reconciled = reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
      facts
    )
    const resource = findEncounterFeatureResource(reconciled, actor.id, feature.id)
    if (!resource || resource.maximum === null)
      throw new Error('Encounter feature resource is unavailable.')
    const nextUsed = resource.used + (input.direction === 'USE' ? input.amount : -input.amount)
    if (nextUsed < 0 || nextUsed > resource.maximum)
      throw new Error('Encounter feature resource usage is outside its available range.')
    actor = encounterRunActorStateSchema.parse({
      ...actor,
      resources: withFeatureChargeUsed(actor, feature.id, nextUsed),
      updatedAt
    })
    await writeRunActor(ctx, actorRow._id, actor)
  } else if (input.type === 'REPLACE_CREATURE_EQUIPMENT') {
    const { actorRow, actor } = await readCommandActor(ctx, state, input.actorId)
    const replacement = await replaceActorEquipment(ctx, userId, actor, input, updatedAt)
    await writeRunActor(ctx, actorRow._id, replacement.actor)
    creatureEquipmentReplacement = replacement.provenance
  } else if (input.type === 'REPLACE_OPTIONAL_COMBAT_RULES') {
    if (state.status !== 'PREPARED' && state.status !== 'ACTIVE')
      rejectDomain(
        'ENCOUNTER_NOT_ACTIVE',
        'Only prepared or active Encounters can change optional combat rules.'
      )
    const snapshot = await ctx.ports.snapshotOptionalCombatPolicies(
      campaign,
      userId,
      input.definitionIds
    )
    optionalCombatSnapshot = snapshot.optionalCombatSnapshot
    optionalCombatSnapshotChecksum = snapshot.optionalCombatSnapshotChecksum
  } else if (input.type === 'SET_HEALTH_DISPLAY_DEFAULT') {
    healthDisplayDefault = input.level
  } else if (input.type === 'ROLL_ENEMY_ACTION') {
    if (state.status !== 'ACTIVE')
      rejectDomain('ENCOUNTER_NOT_ACTIVE', 'Enemy actions require an active Encounter.')
    const { actorRow, actor: storedActor } = await readCommandActor(ctx, state, input.actorId)
    let actor = storedActor
    if (actor.kind === 'CHARACTER')
      throw new Error('Character actions must be rolled through the Character Sheet.')
    const feature = snapshotFeatureDefinitions(actor).find(
      (candidate) => candidate.id === input.featureId
    )
    const definition = feature?.rollDefinitions?.find(
      (candidate) => candidate.id === input.rollDefinitionId
    )
    if (!feature || !definition) throw new Error('Encounter enemy action is unavailable.')
    requireFeatureChargeLedger(actor.resources)
    if (definition.chargeCost !== null) {
      const durableActors = await readRunActors(ctx, state)
      const facts = buildEncounterActorRuleFacts({ actors: durableActors })
      const reconciled = reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
        facts
      )
      const resource = findEncounterFeatureResource(reconciled, actor.id, feature.id)
      if (!resource || resource.maximum === null)
        throw new Error('Encounter feature resource is unavailable.')
      if (resource.used + definition.chargeCost > resource.maximum)
        throw new Error('The enemy feature does not have enough charges.')
      actor = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withFeatureChargeUsed(actor, feature.id, resource.used + definition.chargeCost),
        updatedAt
      })
      await writeRunActor(ctx, actorRow._id, actor)
    }
    const system = await ctx.ports.requireSystem(state.gameSystemId)
    const expression = `${definition.expression.count}d${definition.expression.die}${
      definition.expression.modifier === 0
        ? ''
        : ` ${definition.expression.modifier > 0 ? '+' : '-'} ${Math.abs(definition.expression.modifier)}`
    }`
    roll = rollRecordDtoSchema.parse({
      id: crypto.randomUUID(),
      characterId: null,
      characterLabel: actor.label,
      source: {
        kind: definition.kind,
        label: enemyActionRollLabel(feature.label, definition.label)
      },
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      ...evaluateRollExpression(parseRollExpression(expression), { nextInt }, definition.rollMode),
      createdAt: updatedAt
    })
    if (input.visibility === 'TABLE') {
      if (!('insertTableRoll' in ctx.ports))
        throw new Error('Encounter table rolls are unavailable in this transaction.')
      await ctx.ports.insertTableRoll({ campaign, membership }, userId, input.commandId, roll)
    }
  } else if (input.type === 'COMPLETE') {
    if (state.status !== 'ACTIVE' || state.currentActorId === null)
      rejectDomain(
        'ENCOUNTER_NOT_ACTIVE',
        'Only an active Encounter with a current actor can complete.'
      )
    const initiative = createEncounterInitiativeStore(ctx)
    const normalized = await initiative.lockInitiativeRound({
      encounterId: row.id,
      round: state.round
    })
    if (!normalized || normalized.round.status !== 'ACTIVE')
      throw new Error('The normalized initiative round is unavailable.')
    const activeParticipants = normalized.participants.filter(
      (participant) => participant.status === 'ACTIVE'
    )
    if (activeParticipants.length !== 1 || activeParticipants[0]!.actorId !== state.currentActorId)
      throw new Error('The current Encounter actor does not match normalized initiative.')
    const participant = activeParticipants[0]!
    await initiative.updateInitiativeParticipant({
      encounterId: participant.encounterId,
      round: participant.round,
      actorId: participant.actorId,
      expectedVersion: participant.version,
      status: 'ACTED',
      initiativeScore: participant.initiativeScore,
      evaluation: participant.evaluation,
      tie: participant.tie,
      declaration: participant.declaration,
      declarationChecksum: participant.declarationChecksum,
      turnOrderOrdinal: participant.turnOrderOrdinal
    })
    if (normalized.round.procedure === 'SIDE_ROLL') {
      const actor = normalized.participants.find(
        (candidate) => candidate.actorId === state.currentActorId
      )
      const side = normalized.sides.find((candidate) => candidate.sideId === actor?.sideId)
      if (!side || side.status !== 'ACTIVE')
        throw new Error('The current Encounter side does not match normalized initiative.')
      await initiative.updateInitiativeSide({
        encounterId: side.encounterId,
        round: side.round,
        sideId: side.sideId,
        expectedVersion: side.version,
        status: 'COMPLETED',
        initiativeScore: side.initiativeScore,
        evaluation: side.evaluation,
        tie: side.tie,
        sideOrderOrdinal: side.sideOrderOrdinal
      })
    }
    await initiative.updateInitiativeRound({
      encounterId: normalized.round.encounterId,
      round: normalized.round.round,
      expectedVersion: normalized.round.version,
      status: 'COMPLETED',
      nextTurnOrderOrdinal: normalized.round.nextTurnOrderOrdinal
    })
    status = 'COMPLETED'
    currentActorId = null
    await removeCompletedRunTurnRecords(ctx, row.id)
    // The completed Run keeps each Character's values as the Encounter ended.
    await freezeEncounterCharacterStates(ctx, state)
  }
  const nextState = encounterRunStateSchema.parse({
    ...state,
    status,
    round,
    currentActorId,
    turnSequence:
      currentActorId !== state.currentActorId || round !== state.round
        ? state.turnSequence + 1
        : state.turnSequence,
    reminders,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum,
    healthDisplayDefault,
    version,
    updatedAt
  })
  await ctx.db.patch(row._id, {
    status,
    version,
    updatedAt,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, nextState),
    roll,
    occurrence: null
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: row.id,
      commandId: input.commandId,
      commandType: input.type,
      ...(input.type === 'UPDATE_ACTOR' ? { characterReceiptId } : {}),
      ...(input.type === 'REPLACE_CREATURE_EQUIPMENT' ? { creatureEquipmentReplacement } : {}),
      ...(initiativeCorrection === null
        ? {}
        : {
            initiativeStateJson: initiativeCorrection.stateJson,
            initiativeStateChecksum: initiativeCorrection.stateChecksum
          }),
      commandFingerprint,
      actorUserId: userId,
      version,
      commandJson: JSON.stringify(input),
      ...encounterReplayReceipt(result),
      createdAt: updatedAt
    })
  )
  return result
}
