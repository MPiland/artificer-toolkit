import { insertRunCommand } from './timelineEntries'
import { zodToConvex } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import type {
  CharacterEncounterCommandInput,
  CharacterEncounterCommandResult
} from '@artificer-toolkit/schema/api/characterEncounter'
import type { z } from 'zod'
import {
  encounterCommandResultDtoSchema,
  encounterExecuteInputSchema,
  encounterGmActorDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  type EncounterGmActorDto
} from '@artificer-toolkit/schema/api/encounters'
import { rollRecordDtoSchema, type RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  encounterInitiativeSettlementDtoSchema,
  type EncounterInitiativeAdvancePlanDto
} from '@artificer-toolkit/schema/shared/ruleExecutionInitiative'
import { encounterCreatureEquipmentReplacementSchema } from '@artificer-toolkit/schema/projections/encounterCreatureEquipment'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  serverRuleExecutionPendingSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { TurnResolutionCommandDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnCommands'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import {
  snapshotFeatureDefinitions,
  snapshotFeatures,
  stableActors,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  bindEncounterActorRuleOutputToFacts,
  findEncounterFeatureResource,
  reconcileEncounterActorRuleOutput,
  requireEncounterActorRuleResult
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  resumeEncounterInitiativeLifecycle,
  startEncounterInitiativeLifecycle
} from '@artificer-toolkit/rules-runtime/encounterInitiativeLifecycle'
import { createEncounterInitiativeScoreEntities } from '@artificer-toolkit/rules-runtime/encounterInitiativeEntities'
import {
  createEncounterInitiativePendingSnapshot,
  createEncounterInitiativeDeclarationPendingSnapshot,
  projectEncounterInitiativePendingSummary,
  restoreEncounterInitiativePending
} from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import {
  createStagedInitiativeRoundState,
  hydrateStagedState,
  inMemoryInitiativeRepository,
  serializeStagedInitiativeRoundState
} from '@artificer-toolkit/rules-runtime/encounterInitiativeStaging'
import { healthBand } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { planEncounterInitiativeAdvance } from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import { matchesNativeTurnResponse } from '@artificer-toolkit/rules-runtime/encounterTurnResponse'
import { dnd5eInitiativeFactAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/initiativeFactAdapter'
import type { Doc } from '../_generated/dataModel'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireTurnResponseController } from './turnResponseAuthority'
import {
  requireEncounterActorControl,
  requireEncounterActorControllerCandidates
} from './actorController'
import { requireCampaignAuthority } from '../campaigns/authority'
import { insertPreEvaluatedCampaignTableRoll } from '../campaigns/tableRoll'
import { requireSystem } from '../content/systemDocuments'

import { nextRollInt } from '../lib/rollRandom'
import { readEncounterActorCore, readRunActor, readRunActors, readRunProjection } from './documents'
import { loadEncounterInitiativeSources } from './initiativeSources'
import { loadInitiativeDeclarationSources } from './initiativeDeclarationSources'
import { createEncounterInitiativeStore } from './initiativeStore'
import { correctInitiativeCursor } from './initiativeCorrection'
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { snapshotEncounterOptionalCombatPolicies } from './policySnapshots'
import { replaceActorEquipment } from './actorEquipment'
import { createRulesRuntime } from '../rules/runtime'
import { readAutoRollDice } from '../lib/rollPreferences'
import { encounterEvidenceMode } from '@artificer-toolkit/rules-runtime/encounterEvidenceMode'
import { removeEncounterActor } from './actorRemovalCommand'
import { reorderEncounterActors } from './actorReorderCommand'
import { reinforceEncounterActors } from './actorReinforcementCommand'
import { revertLastEncounterAction } from './actionRevert'
import { executeNativeEncounterAction } from './actionCommands'
import { resumeNativeEncounterAction } from './actionResume'
import { executeNativeDisarm, resumeNativeDisarm } from './actionDisarm.helper'
import { settleNativeInitiativeTurn } from './turnCompletion'
import { resolveNativeTurnResponse } from './turnResponses'
import { projectNativeTurnPending } from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import {
  enemyActionRollLabel,
  readNativeEncounterCommandReplay,
  readNativeEncounterCommandState,
  requireInitiativeTransition
} from './commandReplay'
import { restoreNativeInitiativeTurnActors } from './turnInitiative'
import { readNativeTurnCommandPending } from './turnCommandPending'
import { readNativeTurnResponseReplay } from './turnResponseReplay'
import { resumeNativeCleaving } from './cleaving'
import { resumeNativeConcentration } from './concentrationResponses'
import { readNativeEncounterOccurrenceOwner } from './occurrenceOwner'
import {
  createEncounterInitiativeDeclarationRequest,
  compileEncounterInitiativeDeclaration
} from '@artificer-toolkit/rules-runtime/encounterInitiativeDeclarationCompiler'
import { rejectDomain } from '../lib/domainRejections'
import { presentEncounterResultForMember } from './resultPresentation'
import { readEncounterSettledAppRoll, rollEncounterRuleEvidence } from './evidenceRolls'
import {
  resolveEncounterIntegerAnswer,
  withEncounterAppRoll
} from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'

const executeEncounterCharacterCommand = makeFunctionReference<
  'mutation',
  CharacterEncounterCommandInput,
  CharacterEncounterCommandResult
>('characters/encounterCommands:execute')

const resultValidator: Validator<EncounterCommandResultDto, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterCommandResultDto>
>(encounterCommandResultDtoSchema)
const inputValidator: Validator<EncounterExecuteInput, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterExecuteInput>
>(encounterExecuteInputSchema)

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

export const execute = internalMutation({
  args: inputValidator,
  returns: resultValidator,
  handler: async (ctx, args): Promise<EncounterCommandResultDto> => {
    const { userId } = await requireIdentity(ctx)
    const { command } = encounterExecuteInputSchema.parse(args)
    if (command.type === 'RESOLVE_ACTION') {
      if (command.optionalCombatIntent) {
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', command.encounterId.toLowerCase()))
          .unique()
        if (!run) throw new Error('Encounter Run was not found.')
        await requireCampaignAuthority(ctx, run.campaignId, userId)
        const receipt = await ctx.db
          .query('encounterRunCommands')
          .withIndex('by_campaignId_commandId', (q) =>
            q.eq('campaignId', run.campaignId).eq('commandId', command.commandId.toLowerCase())
          )
          .unique()
        // A completed retry uses its original rule selection even if the Run's rules later change.
        const projection =
          receipt?.commandType === 'RESOLVE_ACTION'
            ? encounterGmProjectionDtoSchema.parse(
                encounterCommandResultDtoSchema.parse(JSON.parse(receipt.resultJson)).projection
              )
            : readRunProjection(run)
        if (
          projection.optionalCombatRules.some(
            (definition) =>
              definition.kind === 'DISARM' &&
              definition.definitionId === command.optionalCombatIntent?.definitionId
          )
        )
          return executeNativeDisarm(ctx, command, userId)
      }
      return executeNativeEncounterAction(ctx, command, userId)
    }
    if (command.type === 'ROLL_RULE_EVIDENCE')
      return rollEncounterRuleEvidence(ctx, command, userId)
    if (command.type === 'REMOVE_ACTOR') return removeEncounterActor(ctx, command, userId)
    if (command.type === 'REORDER') return reorderEncounterActors(ctx, command, userId)
    if (command.type === 'REINFORCE') return reinforceEncounterActors(ctx, command, userId)
    if (command.type === 'REVERT_LAST_ACTION')
      return revertLastEncounterAction(ctx, command, userId)
    if (
      command.type !== 'UPSERT_REMINDER' &&
      command.type !== 'REMOVE_REMINDER' &&
      command.type !== 'UPDATE_ACTOR' &&
      command.type !== 'REPLACE_CREATURE_EQUIPMENT' &&
      command.type !== 'START' &&
      command.type !== 'ADVANCE_TURN' &&
      command.type !== 'PREVIOUS_TURN' &&
      command.type !== 'SET_CURRENT_ACTOR' &&
      command.type !== 'SET_ROUND' &&
      command.type !== 'SET_INITIATIVE' &&
      command.type !== 'ROLL_ACTOR_INITIATIVE' &&
      command.type !== 'ROLL_ENEMY_ACTION' &&
      command.type !== 'ADJUST_FEATURE_RESOURCE' &&
      command.type !== 'COMPLETE' &&
      command.type !== 'REPLACE_OPTIONAL_COMBAT_RULES' &&
      command.type !== 'RESOLVE_RULE_OCCURRENCE'
    )
      throw new Error('Encounter command is not available.')
    const input =
      command.type === 'UPSERT_REMINDER'
        ? {
            ...command,
            encounterId: command.encounterId.toLowerCase(),
            commandId: command.commandId.toLowerCase(),
            reminder: {
              ...command.reminder,
              ...(command.reminder.id === undefined
                ? {}
                : { id: command.reminder.id.toLowerCase() }),
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
          : command.type === 'START' ||
              command.type === 'ADVANCE_TURN' ||
              command.type === 'PREVIOUS_TURN' ||
              command.type === 'SET_ROUND' ||
              command.type === 'COMPLETE'
            ? {
                ...command,
                encounterId: command.encounterId.toLowerCase(),
                commandId: command.commandId.toLowerCase(),
                ...(command.type === 'START' && command.systemId !== undefined
                  ? { systemId: command.systemId.toLowerCase() }
                  : {})
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
              : command.type === 'RESOLVE_RULE_OCCURRENCE'
                ? {
                    ...command,
                    encounterId: command.encounterId.toLowerCase(),
                    commandId: command.commandId.toLowerCase(),
                    occurrenceId: command.occurrenceId.toLowerCase(),
                    correlationId: command.correlationId?.toLowerCase() ?? null,
                    resolution:
                      command.resolution.kind === 'INITIATIVE_ENTITY'
                        ? {
                            ...command.resolution,
                            entityId: command.resolution.entityId.toLowerCase()
                          }
                        : command.resolution
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
    const { campaign, membership } = await requireCampaignAuthority(ctx, row.campaignId, userId)
    const occurrenceOwner =
      input.type === 'RESOLVE_RULE_OCCURRENCE'
        ? await readNativeEncounterOccurrenceOwner(ctx, row, input.occurrenceId)
        : null
    if (input.type === 'RESOLVE_RULE_OCCURRENCE') {
      if (occurrenceOwner === 'DISARM') return resumeNativeDisarm(ctx, input, row, userId)
      if (occurrenceOwner === 'CONCENTRATION') return resumeNativeConcentration(ctx, input, userId)
      if (occurrenceOwner === 'CLEAVING') return resumeNativeCleaving(ctx, input, userId)
    }
    // Action evidence resumes authorize the member against the evidence's roller themselves.
    if (input.type === 'RESOLVE_RULE_OCCURRENCE' && occurrenceOwner === 'ACTION') {
      if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
      return resumeNativeEncounterAction(ctx, input, row, userId)
    }
    // Players may end their own actor's turn and answer its turn decisions (initiative
    // declaration, turn-effect saves; a completed occurrence classifies as OTHER), checked by
    // `requireTurnResponseController` below; the rest is the GM's.
    if (
      membership.role !== 'OWNER' &&
      input.type !== 'ADVANCE_TURN' &&
      (input.type !== 'RESOLVE_RULE_OCCURRENCE' || occurrenceOwner === 'MOVEMENT')
    )
      throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
    if (row.gameSystemId !== campaign.gameSystemId)
      throw new Error('Encounter does not match the Campaign Game System.')
    const { fingerprint: commandFingerprint, result: replayResult } =
      await readNativeEncounterCommandReplay(ctx, { input, row, campaign, userId })
    if (replayResult)
      return presentEncounterResultForMember(ctx, { campaign, membership, result: replayResult })
    const { state, projection, actorIds } = readNativeEncounterCommandState(row)
    const pendingRoot = await readNativeTurnCommandPending(ctx, {
      input,
      row,
      campaign,
      userId,
      commandFingerprint,
      projection
    })
    if (pendingRoot) {
      const context = pendingRoot.snapshot.applicationContext
      if (
        context.kind === 'ENCOUNTER_INITIATIVE' ||
        context.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
      )
        await restoreNativeInitiativeTurnActors({
          ctx,
          state,
          campaign,
          root: context.root,
          occurrenceId: pendingRoot.occurrence.id,
          updatedAt: new Date().toISOString()
        })
      return presentEncounterResultForMember(ctx, {
        campaign,
        membership,
        result: pendingRoot.result
      })
    }
    const pendingOccurrences = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', row.id).eq('state', 'PENDING'))
      .take(2)
    if (pendingOccurrences.length > 1)
      throw new Error('Stored Encounter occurrence state is invalid.')
    const pendingOccurrence = pendingOccurrences[0] ?? null
    let resolvedOccurrence: Doc<'encounterRuleOccurrences'> | null = pendingOccurrence
    if (input.type === 'RESOLVE_RULE_OCCURRENCE') {
      resolvedOccurrence = await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (q) => q.eq('id', input.occurrenceId))
        .unique()
      if (
        !resolvedOccurrence ||
        resolvedOccurrence.campaignId !== campaign.id ||
        resolvedOccurrence.encounterId !== row.id
      )
        throw new Error('Rule occurrence is unavailable.')
      const completedReceipt =
        resolvedOccurrence.state === 'COMPLETED'
          ? await ctx.db
              .query('encounterRuleReceipts')
              .withIndex('by_encounterId_commandId', (q) =>
                q.eq('encounterId', row.id).eq('commandId', resolvedOccurrence!.rootCommandId)
              )
              .unique()
          : null
      await requireTurnResponseController(ctx, {
        campaign,
        membership,
        state,
        occurrence: resolvedOccurrence,
        receipt: completedReceipt,
        command: input,
        fingerprint: commandFingerprint
      })
      const completedReplay = await readNativeTurnResponseReplay(ctx, {
        occurrence: resolvedOccurrence,
        row,
        campaign,
        command: input,
        userId,
        projection,
        receipt: completedReceipt
      })
      if (completedReplay)
        return presentEncounterResultForMember(ctx, {
          campaign,
          membership,
          result: completedReplay
        })
      // A non-replayed answer to an occurrence that is no longer pending is stale.
      if (pendingOccurrence?._id !== resolvedOccurrence._id)
        rejectDomain('VERSION_STALE', 'Rule occurrence is unavailable.')
    } else if (pendingOccurrence) {
      rejectDomain('PENDING_DECISION')
    }
    if (row.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
    if (row.status === 'COMPLETED') rejectDomain('ENCOUNTER_NOT_ACTIVE')
    // Initiative prompts go to the GM in this slice, so the GM's auto-roll preference applies.
    const initiativeEvidenceMode = async () =>
      encounterEvidenceMode(state.automationMode, await readAutoRollDice(ctx, campaign.ownerUserId))
    const updatedAt = new Date().toISOString()
    let reminders = state.reminders
    let actors = projection.actors
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
    let optionalCombatRules = projection.optionalCombatRules
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
    } else if (input.type === 'START') {
      if (state.status !== 'PREPARED')
        rejectDomain('ENCOUNTER_NOT_ACTIVE', 'Only prepared Encounters can start.')
      if (input.systemId !== undefined && input.systemId !== state.gameSystemId)
        throw new Error('Encounter does not match the requested Game System.')
      if (actors.length === 0) throw new Error('Add an actor before starting.')
      const snapshot = state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshot
      const snapshotChecksum =
        state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum
      if (state.automationMode !== 'MANUAL' && (!snapshot || !snapshotChecksum))
        throw new Error('Policy Encounter initiative requires a frozen initiative policy.')
      const adapter = snapshot
        ? dnd5eInitiativeFactAdapter.gameSystemId === state.gameSystemId
          ? dnd5eInitiativeFactAdapter
          : null
        : null
      if (snapshot && !adapter)
        throw new Error(
          'The Encounter Game System does not support the selected initiative policy.'
        )
      const sources = snapshot
        ? await loadEncounterInitiativeSources(ctx, state, campaign)
        : { characterIds: [], actors: [] }
      const runtime = snapshot ? await createRulesRuntime(ctx, userId) : null
      const occurrenceId = crypto.randomUUID()
      const actorStates = await readRunActors(ctx, state)
      const staged = inMemoryInitiativeRepository(
        hydrateStagedState(
          createStagedInitiativeRoundState({
            encounter: {
              ...state,
              actors: actorStates.map((actor) => ({ id: actor.id, sideId: actor.sideId }))
            },
            round: 1
          })
        )
      )
      if (snapshot?.policy.document.procedure === 'DECLARED_ACTION_ROLL') {
        const declarations = await loadInitiativeDeclarationSources(ctx, state, campaign)
        const participant = staged
          .read()
          .participants.find((candidate) => candidate.declaration === null)
        const source = participant
          ? declarations.sources.find((candidate) => candidate.actor.id === participant.actorId)
          : null
        if (!participant || !source)
          throw new Error('Initiative declaration source is unavailable.')
        const request = createEncounterInitiativeDeclarationRequest({
          requestId: crypto.randomUUID(),
          encounterId: row.id,
          round: 1,
          actorId: participant.actorId,
          participantExpectedVersion: participant.version,
          controllerUserId: source.controllerUserId,
          source
        })
        const pendingSnapshot = createEncounterInitiativeDeclarationPendingSnapshot({
          occurrenceId,
          root: {
            rootCommandId: input.commandId,
            commandFingerprint,
            commandType: 'START',
            initiatorUserId: userId,
            requestedByUserId: userId,
            correlationId: null,
            expectedEncounterVersion: row.version,
            round: 1,
            policySnapshotChecksum: snapshotChecksum!,
            initiativeBeforePin: {
              kind: 'INITIAL_START',
              actorIds: actors.map((actor) => actor.id).sort()
            },
            stagedInitiativeRoundState: serializeStagedInitiativeRoundState(staged.read()),
            startSystemId: input.systemId ?? null,
            resolutionCommands: []
          },
          request
        })
        await ctx.db.insert(
          'encounterRuleOccurrences',
          encounterStoredRuleOccurrenceSchema.parse({
            id: occurrenceId,
            campaignId: campaign.id,
            encounterId: row.id,
            rootCommandId: input.commandId,
            state: 'PENDING',
            version: 0,
            expectedEncounterVersion: row.version,
            pendingSnapshotJson: JSON.stringify(pendingSnapshot),
            pendingSnapshotChecksum: checksumCanonicalJson(pendingSnapshot),
            completedAt: null,
            createdAt: updatedAt,
            updatedAt
          })
        )
        return encounterCommandResultDtoSchema.parse({
          projection,
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId,
            occurrenceVersion: 0,
            status: 'PENDING',
            outcome: null,
            pending: projectEncounterInitiativePendingSummary({
              pendingSnapshot,
              occurrenceVersion: 0,
              encounterVersion: row.version
            })
          }
        })
      }
      const initiativeResult = await startEncounterInitiativeLifecycle({
        repository: staged.repository,
        runtime,
        occurrenceId,
        gameSystemId: state.gameSystemId,
        state: staged.read(),
        snapshot,
        snapshotChecksum,
        sources,
        adapter,
        mode: await initiativeEvidenceMode(),
        legacyOrderedActorIds: stableActors({ actors }).map((actor) => actor.id),
        integerSource: ({ min, max }) => min + nextRollInt(max - min + 1)
      })
      if (initiativeResult.kind === 'PENDING') {
        if (!snapshotChecksum)
          throw new Error('Pending initiative lacks its frozen initiative policy.')
        const pendingSnapshot = createEncounterInitiativePendingSnapshot({
          root: {
            rootCommandId: input.commandId,
            commandFingerprint,
            commandType: 'START',
            initiatorUserId: userId,
            requestedByUserId: userId,
            correlationId: null,
            expectedEncounterVersion: row.version,
            round: 1,
            policySnapshotChecksum: snapshotChecksum,
            initiativeBeforePin: {
              kind: 'INITIAL_START',
              actorIds: actors.map((actor) => actor.id).sort()
            },
            stagedInitiativeRoundState: serializeStagedInitiativeRoundState(initiativeResult.state),
            startSystemId: input.systemId ?? null,
            resolutionCommands: []
          },
          pending: initiativeResult.pending
        })
        await ctx.db.insert(
          'encounterRuleOccurrences',
          encounterStoredRuleOccurrenceSchema.parse({
            id: occurrenceId,
            campaignId: campaign.id,
            encounterId: row.id,
            rootCommandId: input.commandId,
            state: 'PENDING',
            version: 0,
            expectedEncounterVersion: row.version,
            pendingSnapshotJson: JSON.stringify(pendingSnapshot),
            pendingSnapshotChecksum: checksumCanonicalJson(pendingSnapshot),
            completedAt: null,
            createdAt: updatedAt,
            updatedAt
          })
        )
        return encounterCommandResultDtoSchema.parse({
          projection,
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId,
            occurrenceVersion: 0,
            status: 'PENDING',
            outcome: null,
            pending: projectEncounterInitiativePendingSummary({
              pendingSnapshot,
              occurrenceVersion: 0,
              encounterVersion: row.version
            })
          }
        })
      }
      if (initiativeResult.orderedActorIds.length === 0)
        throw new Error('Encounter initiative did not settle.')
      const initiativeSettlement = encounterInitiativeSettlementDtoSchema.parse({
        round: initiativeResult.state.round.round,
        cadence: initiativeResult.state.round.cadence,
        procedure: initiativeResult.state.round.procedure,
        policySnapshotChecksum: initiativeResult.state.round.policySnapshotChecksum,
        orderedActorIds: initiativeResult.orderedActorIds,
        orderedSideIds: initiativeResult.orderedSideIds,
        evidence: initiativeResult.evidence
      })
      const nextState = encounterRunStateSchema.parse({
        ...state,
        status: 'ACTIVE',
        round: 1,
        currentActorId: initiativeResult.orderedActorIds[0]!,
        version,
        updatedAt
      })
      return settleNativeInitiativeTurn({
        ctx,
        encounter: row,
        occurrenceId,
        campaign,
        state,
        nextState,
        nextProjection: encounterGmProjectionDtoSchema.parse({
          ...projection,
          status: nextState.status,
          round: nextState.round,
          currentActorId: nextState.currentActorId,
          version,
          updatedAt
        }),
        rootCommand: input,
        rootCommandId: input.commandId,
        rootCommandFingerprint: commandFingerprint,
        rootInitiatorUserId: userId,
        rootRequestedByUserId: userId,
        rootCorrelationId: null,
        rootExpectedEncounterVersion: row.version,
        initiative: initiativeSettlement,
        initiativeAdvance: null,
        resolutionCommands: [],
        occurrenceVersion: 0,
        encounterVersion: version,
        updatedAt,
        stagedInitiative: {
          beforePin: { kind: 'INITIAL_START', actorIds: [...state.actorIds].sort() },
          stagedRoundState: serializeStagedInitiativeRoundState(initiativeResult.state)
        }
      })
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
    } else if (input.type === 'ADVANCE_TURN') {
      if (state.status !== 'ACTIVE' || state.currentActorId === null)
        rejectDomain(
          'ENCOUNTER_NOT_ACTIVE',
          'Only active Encounters with a current actor can advance.'
        )
      await requireEncounterActorControl(ctx, {
        campaign,
        membership,
        actor: await readRunActor(ctx, state, state.currentActorId)
      })
      const initiative = createEncounterInitiativeStore(ctx)
      const normalized = await initiative.lockInitiativeRound({
        encounterId: row.id,
        round: state.round
      })
      if (!normalized) throw new Error('The normalized initiative round is unavailable.')
      const occurrenceId = crypto.randomUUID()
      if (
        normalized.round.policySnapshotChecksum !==
        (state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum)
      )
        throw new Error('Initiative policy snapshot does not match the Encounter Run.')
      validateInitiativeCursor({
        state: normalized,
        currentActorId: state.currentActorId,
        actorIds: state.actorIds,
        allowedSideIds: state.sides.map((side) => side.id)
      })
      const initiativeAdvance = planEncounterInitiativeAdvance({
        state: normalized,
        currentActorId: state.currentActorId
      })
      round = initiativeAdvance.kind === 'SAME_ROUND' ? state.round : initiativeAdvance.nextRound
      currentActorId =
        initiativeAdvance.kind === 'SAME_ROUND'
          ? initiativeAdvance.nextActorId
          : initiativeAdvance.firstActorId
      const nextState = encounterRunStateSchema.parse({
        ...state,
        status: 'ACTIVE',
        round,
        currentActorId,
        version,
        updatedAt
      })
      return presentEncounterResultForMember(ctx, {
        campaign,
        membership,
        result: await settleNativeInitiativeTurn({
          ctx,
          encounter: row,
          occurrenceId,
          campaign,
          state,
          nextState,
          nextProjection: encounterGmProjectionDtoSchema.parse({
            ...projection,
            status: nextState.status,
            round,
            currentActorId,
            version,
            updatedAt
          }),
          rootCommand: input,
          rootCommandId: input.commandId,
          rootCommandFingerprint: commandFingerprint,
          // Turn decisions go to the GM; the receipt records the player who ended the turn.
          rootInitiatorUserId: campaign.ownerUserId,
          rootRequestedByUserId: userId,
          rootCorrelationId: null,
          rootExpectedEncounterVersion: row.version,
          initiative: null,
          initiativeAdvance,
          resolutionCommands: [],
          occurrenceVersion: 0,
          encounterVersion: version,
          updatedAt
        })
      })
    } else if (input.type === 'RESOLVE_RULE_OCCURRENCE') {
      if (
        !resolvedOccurrence ||
        resolvedOccurrence.state !== 'PENDING' ||
        resolvedOccurrence.pendingSnapshotJson === null ||
        resolvedOccurrence.pendingSnapshotChecksum === null ||
        resolvedOccurrence.completedAt !== null
      )
        throw new Error('Rule occurrence is unavailable.')
      const storedPendingSnapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
        JSON.parse(resolvedOccurrence.pendingSnapshotJson)
      )
      if (
        checksumCanonicalJson(storedPendingSnapshot) !==
          resolvedOccurrence.pendingSnapshotChecksum ||
        storedPendingSnapshot.occurrenceId !== resolvedOccurrence.id
      )
        throw new Error('Rule occurrence is unavailable.')
      const pendingContext = storedPendingSnapshot.applicationContext
      if (
        pendingContext.kind === 'ENCOUNTER_INITIATIVE' ||
        pendingContext.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
      ) {
        const history = pendingContext.root.resolutionCommands.find(
          (entry) => entry.commandId === input.commandId
        )
        if (
          history &&
          (history.kind === 'LEGENDARY_DECLINE' ||
            history.kind === 'LEGENDARY_OPTION' ||
            history.kind === 'LEGENDARY_ENTER_DICE' ||
            history.kind === 'LEGENDARY_SYSTEM_ROLL' ||
            history.kind === 'ENTER_DICE' ||
            history.kind === 'SYSTEM_ROLL')
        ) {
          if (
            !matchesNativeTurnResponse(history, input.resolution) ||
            history.commandFingerprint !== commandFingerprint ||
            history.actorUserId !== userId ||
            history.correlationId !== input.correlationId ||
            history.expectedOccurrenceVersion !== input.expectedOccurrenceVersion ||
            pendingContext.root.rootCommandId !== resolvedOccurrence.rootCommandId
          )
            throw new Error('Rule occurrence is unavailable.')
          await restoreNativeInitiativeTurnActors({
            ctx,
            state,
            campaign,
            root: pendingContext.root,
            occurrenceId: resolvedOccurrence.id,
            updatedAt
          })
          return presentEncounterResultForMember(ctx, {
            campaign,
            membership,
            result: encounterCommandResultDtoSchema.parse({
              projection,
              roll: null,
              resolution: null,
              occurrence: {
                occurrenceId: resolvedOccurrence.id,
                occurrenceVersion: resolvedOccurrence.version,
                status: 'PENDING',
                outcome: null,
                pending: projectEncounterInitiativePendingSummary({
                  pendingSnapshot: storedPendingSnapshot,
                  occurrenceVersion: resolvedOccurrence.version,
                  encounterVersion: row.version
                })
              }
            })
          })
        }
      }
      if (
        (pendingContext.kind === 'ENCOUNTER_TURN_RECHARGE' ||
          pendingContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
          pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
          pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE') &&
        input.resolution.kind !== 'INITIATIVE_DECLARATION'
      ) {
        return presentEncounterResultForMember(ctx, {
          campaign,
          membership,
          result: await resolveNativeTurnResponse({
            ctx,
            campaign,
            membership,
            encounter: row,
            occurrence: resolvedOccurrence,
            pending: storedPendingSnapshot,
            command: input,
            userId,
            updatedAt
          })
        })
      }
      if (
        input.resolution.kind === 'INITIATIVE_DECLARATION' &&
        (pendingContext.kind === 'ENCOUNTER_INITIATIVE_DECLARATION' ||
          pendingContext.kind === 'ENCOUNTER_INITIATIVE' ||
          pendingContext.kind === 'ENCOUNTER_TURN_RECHARGE' ||
          pendingContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
          pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
          pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE')
      ) {
        const history = pendingContext.root.resolutionCommands.find(
          (entry) => entry.commandId === input.commandId
        )
        if (history) {
          if (
            history.kind !== 'INITIATIVE_DECLARATION' ||
            history.commandFingerprint !== commandFingerprint ||
            history.actorUserId !== userId ||
            history.correlationId !== input.correlationId ||
            history.expectedOccurrenceVersion !== input.expectedOccurrenceVersion ||
            history.requestId !== input.resolution.requestId ||
            pendingContext.root.rootCommandId !== resolvedOccurrence.rootCommandId ||
            pendingContext.root.expectedEncounterVersion !== row.version ||
            (pendingContext.kind === 'ENCOUNTER_TURN_RECHARGE' ||
            pendingContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
            pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
            pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
              ? pendingContext.root.stagedInitiative?.stagedRoundState.round.encounterId !== row.id
              : pendingContext.root.stagedInitiativeRoundState.round.encounterId !== row.id)
          )
            throw new Error('Rule occurrence is unavailable.')
          if (
            pendingContext.kind === 'ENCOUNTER_INITIATIVE' ||
            pendingContext.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
          )
            await restoreNativeInitiativeTurnActors({
              ctx,
              state,
              campaign,
              root: pendingContext.root,
              occurrenceId: resolvedOccurrence.id,
              updatedAt
            })
          return presentEncounterResultForMember(ctx, {
            campaign,
            membership,
            result: encounterCommandResultDtoSchema.parse({
              projection,
              roll: null,
              resolution: null,
              occurrence: {
                occurrenceId: resolvedOccurrence.id,
                occurrenceVersion: resolvedOccurrence.version,
                status: 'PENDING',
                outcome: null,
                pending:
                  pendingContext.kind === 'ENCOUNTER_TURN_RECHARGE' ||
                  pendingContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
                  pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
                  pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
                    ? projectNativeTurnPending({
                        snapshot: storedPendingSnapshot,
                        occurrenceId: resolvedOccurrence.id,
                        occurrenceVersion: resolvedOccurrence.version,
                        encounterVersion: row.version
                      })
                    : projectEncounterInitiativePendingSummary({
                        pendingSnapshot: storedPendingSnapshot,
                        occurrenceVersion: resolvedOccurrence.version,
                        encounterVersion: row.version
                      })
              }
            })
          })
        }
      }
      if (
        storedPendingSnapshot.snapshotKind === 'AGGREGATE_CHOICE' &&
        storedPendingSnapshot.applicationContext.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
      ) {
        if (input.resolution.kind !== 'INITIATIVE_DECLARATION')
          throw new Error('Rule occurrence is unavailable.')
        const { root, request } = storedPendingSnapshot.applicationContext
        const declarationRootCommand =
          root.commandType === 'START'
            ? {
                type: 'START' as const,
                encounterId: row.id,
                commandId: root.rootCommandId,
                expectedVersion: root.expectedEncounterVersion,
                ...(root.startSystemId ? { systemId: root.startSystemId } : {})
              }
            : {
                type: 'ADVANCE_TURN' as const,
                encounterId: row.id,
                commandId: root.rootCommandId,
                expectedVersion: root.expectedEncounterVersion
              }
        const eachRound = root.commandType === 'ADVANCE_TURN'
        const actorStates = await readRunActors(ctx, state)
        if (
          checksumCanonicalJson(storedPendingSnapshot) !==
            resolvedOccurrence.pendingSnapshotChecksum ||
          input.resolution.requestId !== request.requestId ||
          input.expectedOccurrenceVersion !== resolvedOccurrence.version ||
          root.rootCommandId !== resolvedOccurrence.rootCommandId ||
          root.commandFingerprint !== checksumCanonicalJson(declarationRootCommand) ||
          root.initiatorUserId !== campaign.ownerUserId ||
          root.expectedEncounterVersion !== row.version ||
          resolvedOccurrence.expectedEncounterVersion !== row.version ||
          state.automationMode === 'MANUAL' ||
          state.status !== (eachRound ? 'ACTIVE' : 'PREPARED') ||
          root.round !== (eachRound ? state.round + 1 : 1) ||
          root.policySnapshotChecksum !== state.initiativePolicySnapshotChecksum ||
          state.initiativePolicySnapshot?.policy.document.procedure !== 'DECLARED_ACTION_ROLL' ||
          root.stagedInitiativeRoundState.round.encounterId !== row.id ||
          root.stagedInitiativeRoundState.round.round !== root.round ||
          root.stagedInitiativeRoundState.round.procedure !== 'DECLARED_ACTION_ROLL' ||
          root.stagedInitiativeRoundState.round.policySnapshotChecksum !==
            root.policySnapshotChecksum ||
          root.stagedInitiativeRoundState.participants.length !== state.actorIds.length ||
          root.stagedInitiativeRoundState.participants.some(
            (participant) =>
              !actorStates.some(
                (actor) => actor.id === participant.actorId && actor.sideId === participant.sideId
              )
          ) ||
          root.initiativeBeforePin.actorIds.length !== state.actorIds.length ||
          root.initiativeBeforePin.actorIds.some(
            (id, index) => id !== [...state.actorIds].sort()[index]
          ) ||
          (eachRound
            ? root.startSystemId !== null ||
              root.initiativeBeforePin.kind !== 'EACH_ROUND' ||
              root.initiativeBeforePin.round !== state.round ||
              root.initiativeBeforePin.version !== row.version
            : root.initiativeBeforePin.kind !== 'INITIAL_START' ||
              (root.startSystemId !== null && root.startSystemId !== state.gameSystemId)) ||
          (!eachRound &&
            (root.initiativeAdvance !== undefined ||
              root.outgoingTurn !== undefined ||
              root.completedLegendaryActions !== undefined)) ||
          root.legendaryActionQueue !== undefined ||
          root.stagedLegendaryActionRefreshes !== undefined ||
          root.stagedActionEconomyRefreshes !== undefined ||
          root.completedRechargePlan !== undefined
        )
          throw new Error('Rule occurrence is unavailable.')
        if (eachRound) {
          const before = await createEncounterInitiativeStore(ctx).lockInitiativeRound({
            encounterId: row.id,
            round: state.round
          })
          if (
            !before ||
            state.currentActorId === null ||
            root.initiativeBeforePin.kind !== 'EACH_ROUND'
          )
            throw new Error('Rule occurrence is unavailable.')
          const advance = planEncounterInitiativeAdvance({
            state: before,
            currentActorId: state.currentActorId
          })
          if (
            advance.kind !== 'ROUND_WRAP' ||
            advance.cadence !== 'EACH_ROUND' ||
            advance.stateChecksum !== root.initiativeBeforePin.checksum ||
            advance.nextRound !== root.round ||
            (root.initiativeAdvance !== undefined &&
              checksumCanonicalJson(advance) !== checksumCanonicalJson(root.initiativeAdvance))
          )
            throw new Error('Rule occurrence is unavailable.')
        }
        const { actors: stagedActors, movementTargets: stagedMovementTargets } =
          await restoreNativeInitiativeTurnActors({
            ctx,
            state,
            campaign,
            root,
            occurrenceId: resolvedOccurrence.id,
            updatedAt
          })
        const declarations = await loadInitiativeDeclarationSources(
          ctx,
          state,
          campaign,
          stagedActors,
          stagedMovementTargets
        )
        const staged = inMemoryInitiativeRepository(
          hydrateStagedState(root.stagedInitiativeRoundState)
        )
        const participant = staged
          .read()
          .participants.find((candidate) => candidate.actorId === request.actorId)
        const source = declarations.sources.find(
          (candidate) => candidate.actor.id === request.actorId
        )
        if (
          !participant ||
          !source ||
          participant.declaration !== null ||
          participant.version !== request.participantExpectedVersion
        )
          throw new Error('Initiative declaration is stale.')
        const current = createEncounterInitiativeDeclarationRequest({
          ...request,
          participantExpectedVersion: participant.version,
          controllerUserId: source.controllerUserId,
          source
        })
        if (checksumCanonicalJson(current) !== checksumCanonicalJson(request))
          throw new Error('Initiative declaration options are stale.')
        const { primary, bonus } = input.resolution
        if (
          !current.primaryOptions.some(
            (option) => option.kind === primary.kind && option.optionId === primary.optionId
          ) ||
          (bonus !== null &&
            !current.bonusOptions.some(
              (option) => option.kind === bonus.kind && option.optionId === bonus.optionId
            ))
        )
          throw new Error('Initiative declaration selection is unavailable.')
        const compiled = compileEncounterInitiativeDeclaration({
          source,
          primary: input.resolution.primary,
          bonus: input.resolution.bonus
        })
        await staged.repository.updateInitiativeParticipant({
          encounterId: participant.encounterId,
          round: participant.round,
          actorId: participant.actorId,
          expectedVersion: participant.version,
          status: participant.status,
          initiativeScore: participant.initiativeScore,
          evaluation: participant.evaluation,
          tie: participant.tie,
          declaration: compiled.declaration,
          declarationChecksum: compiled.checksum,
          turnOrderOrdinal: participant.turnOrderOrdinal
        })
        const nextParticipant = staged
          .read()
          .participants.find((candidate) => candidate.declaration === null)
        const occurrenceVersion = resolvedOccurrence.version + 1
        if (nextParticipant) {
          const nextSource = declarations.sources.find(
            (candidate) => candidate.actor.id === nextParticipant.actorId
          )
          if (!nextSource) throw new Error('Initiative declaration source is unavailable.')
          const nextSnapshot = createEncounterInitiativeDeclarationPendingSnapshot({
            occurrenceId: resolvedOccurrence.id,
            root: {
              ...root,
              stagedInitiativeRoundState: serializeStagedInitiativeRoundState(staged.read()),
              resolutionCommands: [
                ...root.resolutionCommands,
                {
                  commandId: input.commandId,
                  commandFingerprint,
                  actorUserId: userId,
                  correlationId: input.correlationId,
                  expectedOccurrenceVersion: input.expectedOccurrenceVersion,
                  requestId: request.requestId,
                  kind: 'INITIATIVE_DECLARATION',
                  initiativeActorId: request.actorId
                }
              ]
            },
            request: createEncounterInitiativeDeclarationRequest({
              requestId: crypto.randomUUID(),
              encounterId: row.id,
              round: root.round,
              actorId: nextParticipant.actorId,
              participantExpectedVersion: nextParticipant.version,
              controllerUserId: nextSource.controllerUserId,
              source: nextSource
            })
          })
          await ctx.db.patch(resolvedOccurrence._id, {
            version: occurrenceVersion,
            pendingSnapshotJson: JSON.stringify(nextSnapshot),
            pendingSnapshotChecksum: checksumCanonicalJson(nextSnapshot),
            updatedAt
          })
          return presentEncounterResultForMember(ctx, {
            campaign,
            membership,
            result: encounterCommandResultDtoSchema.parse({
              projection,
              roll: null,
              resolution: null,
              occurrence: {
                occurrenceId: resolvedOccurrence.id,
                occurrenceVersion,
                status: 'PENDING',
                outcome: null,
                pending: projectEncounterInitiativePendingSummary({
                  pendingSnapshot: nextSnapshot,
                  occurrenceVersion,
                  encounterVersion: row.version
                })
              }
            })
          })
        }
        const snapshot = state.initiativePolicySnapshot
        const snapshotChecksum = state.initiativePolicySnapshotChecksum
        if (
          !snapshot ||
          !snapshotChecksum ||
          dnd5eInitiativeFactAdapter.gameSystemId !== state.gameSystemId
        )
          throw new Error('Rule occurrence is unavailable.')
        const initiativeResult = await startEncounterInitiativeLifecycle({
          repository: staged.repository,
          runtime: await createRulesRuntime(ctx, userId),
          occurrenceId: resolvedOccurrence.id,
          gameSystemId: state.gameSystemId,
          state: staged.read(),
          snapshot,
          snapshotChecksum,
          sources: await loadEncounterInitiativeSources(
            ctx,
            state,
            campaign,
            stagedActors,
            stagedMovementTargets
          ),
          adapter: dnd5eInitiativeFactAdapter,
          mode: await initiativeEvidenceMode(),
          legacyOrderedActorIds: state.actorIds,
          integerSource: ({ min, max }) => min + nextRollInt(max - min + 1)
        })
        if (initiativeResult.kind !== 'PENDING') {
          if (initiativeResult.orderedActorIds.length === 0)
            throw new Error('Encounter initiative did not settle.')
          const initiative = createEncounterInitiativeStore(ctx)

          let advance: EncounterInitiativeAdvancePlanDto | null = null
          if (root.commandType === 'ADVANCE_TURN') {
            const sourceState = await initiative.lockInitiativeRound({
              encounterId: row.id,
              round: state.round
            })
            if (
              !sourceState ||
              state.currentActorId === null ||
              root.initiativeBeforePin.kind !== 'EACH_ROUND'
            )
              throw new Error('Rule occurrence is unavailable.')
            advance = planEncounterInitiativeAdvance({
              state: sourceState,
              currentActorId: state.currentActorId
            })
            if (
              advance.kind !== 'ROUND_WRAP' ||
              advance.cadence !== 'EACH_ROUND' ||
              advance.stateChecksum !== root.initiativeBeforePin.checksum ||
              advance.nextRound !== root.round
            )
              throw new Error('Rule occurrence is unavailable.')
          }
          const initiativeSettlement = encounterInitiativeSettlementDtoSchema.parse({
            round: initiativeResult.state.round.round,
            cadence: initiativeResult.state.round.cadence,
            procedure: initiativeResult.state.round.procedure,
            policySnapshotChecksum: initiativeResult.state.round.policySnapshotChecksum,
            orderedActorIds: initiativeResult.orderedActorIds,
            orderedSideIds: initiativeResult.orderedSideIds,
            evidence: initiativeResult.evidence
          })
          const rootCommand =
            root.commandType === 'START'
              ? {
                  type: 'START' as const,
                  encounterId: row.id,
                  commandId: root.rootCommandId,
                  expectedVersion: root.expectedEncounterVersion,
                  ...(root.startSystemId ? { systemId: root.startSystemId } : {})
                }
              : {
                  type: 'ADVANCE_TURN' as const,
                  encounterId: row.id,
                  commandId: root.rootCommandId,
                  expectedVersion: root.expectedEncounterVersion
                }
          const resolutionCommands: TurnResolutionCommandDto[] = [
            ...root.resolutionCommands,
            {
              commandId: input.commandId,
              commandFingerprint,
              actorUserId: userId,
              correlationId: input.correlationId,
              expectedOccurrenceVersion: input.expectedOccurrenceVersion,
              requestId: request.requestId,
              kind: 'INITIATIVE_DECLARATION',
              initiativeActorId: request.actorId
            }
          ]
          const nextState = encounterRunStateSchema.parse({
            ...state,
            status: 'ACTIVE',
            round: root.round,
            currentActorId: initiativeResult.orderedActorIds[0]!,
            version,
            updatedAt
          })
          const nextProjection = encounterGmProjectionDtoSchema.parse({
            ...projection,
            status: 'ACTIVE',
            round: root.round,
            currentActorId: initiativeResult.orderedActorIds[0]!,
            version,
            updatedAt
          })
          return presentEncounterResultForMember(ctx, {
            campaign,
            membership,
            result: await settleNativeInitiativeTurn({
              priorTurn: {
                outgoingTurn: root.outgoingTurn,
                completedLegendaryActions: root.completedLegendaryActions
              },
              campaign,
              occurrenceId: resolvedOccurrence.id,
              stagedInitiative: {
                beforePin: root.initiativeBeforePin,
                stagedRoundState: serializeStagedInitiativeRoundState(initiativeResult.state)
              },
              ctx,
              encounter: row,
              occurrence: resolvedOccurrence,
              state,
              nextState,
              nextProjection,
              rootCommand,
              rootCommandId: root.rootCommandId,
              rootCommandFingerprint: root.commandFingerprint,
              rootInitiatorUserId: root.initiatorUserId,
              rootRequestedByUserId: root.requestedByUserId,
              rootCorrelationId: root.correlationId,
              rootExpectedEncounterVersion: root.expectedEncounterVersion,
              initiative: initiativeSettlement,
              initiativeAdvance: advance,
              resolutionCommands,
              occurrenceVersion,
              encounterVersion: version,
              updatedAt
            })
          })
        }
        const resolutionCommands: TurnResolutionCommandDto[] = [
          ...root.resolutionCommands,
          {
            commandId: input.commandId,
            commandFingerprint,
            actorUserId: userId,
            correlationId: input.correlationId,
            expectedOccurrenceVersion: input.expectedOccurrenceVersion,
            requestId: request.requestId,
            kind: 'INITIATIVE_DECLARATION',
            initiativeActorId: request.actorId
          }
        ]
        const nextSnapshot = createEncounterInitiativePendingSnapshot({
          root: {
            ...root,
            stagedInitiativeRoundState: serializeStagedInitiativeRoundState(initiativeResult.state),
            resolutionCommands
          },
          pending: initiativeResult.pending
        })
        await ctx.db.patch(resolvedOccurrence._id, {
          version: occurrenceVersion,
          pendingSnapshotJson: JSON.stringify(nextSnapshot),
          pendingSnapshotChecksum: checksumCanonicalJson(nextSnapshot),
          updatedAt
        })
        return presentEncounterResultForMember(ctx, {
          campaign,
          membership,
          result: encounterCommandResultDtoSchema.parse({
            projection,
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: resolvedOccurrence.id,
              occurrenceVersion,
              status: 'PENDING',
              outcome: null,
              pending: projectEncounterInitiativePendingSummary({
                pendingSnapshot: nextSnapshot,
                occurrenceVersion,
                encounterVersion: row.version
              })
            }
          })
        })
      }
      const pendingSnapshot =
        serverKernelRuleExecutionPendingSnapshotDtoSchema.parse(storedPendingSnapshot)
      const context = pendingSnapshot.applicationContext
      if (
        checksumCanonicalJson(pendingSnapshot) !== resolvedOccurrence.pendingSnapshotChecksum ||
        context.kind !== 'ENCOUNTER_INITIATIVE'
      )
        throw new Error('Rule occurrence is unavailable.')
      const root = context.root
      const isEachRound = root.commandType === 'ADVANCE_TURN'
      const rootCommand = isEachRound
        ? {
            type: 'ADVANCE_TURN' as const,
            encounterId: row.id,
            commandId: root.rootCommandId,
            expectedVersion: root.expectedEncounterVersion
          }
        : {
            type: 'START' as const,
            encounterId: row.id,
            commandId: root.rootCommandId,
            expectedVersion: root.expectedEncounterVersion,
            ...(root.startSystemId ? { systemId: root.startSystemId } : {})
          }
      if (
        input.resolution.kind !== 'ENTER_INTEGER' &&
        input.resolution.kind !== 'SYSTEM_ROLL' &&
        input.resolution.kind !== 'INITIATIVE_ENTITY'
      )
        throw new Error('Rule occurrence is unavailable.')
      const resolution = input.resolution
      const historyKind =
        resolution.kind === 'ENTER_INTEGER'
          ? 'ENTER_INTEGER'
          : resolution.kind === 'SYSTEM_ROLL'
            ? 'INITIATIVE_SYSTEM_ROLL'
            : 'INITIATIVE_ENTITY'
      if (
        (isEachRound ? state.status !== 'ACTIVE' : state.status !== 'PREPARED') ||
        state.automationMode === 'MANUAL' ||
        root.rootCommandId !== resolvedOccurrence.rootCommandId ||
        root.commandFingerprint !== checksumCanonicalJson(rootCommand) ||
        (isEachRound
          ? root.startSystemId !== null
          : root.startSystemId !== null && root.startSystemId !== state.gameSystemId) ||
        root.round !== (isEachRound ? state.round + 1 : 1) ||
        (!isEachRound &&
          (root.initiativeAdvance !== undefined ||
            root.outgoingTurn !== undefined ||
            root.completedLegendaryActions !== undefined)) ||
        root.legendaryActionQueue !== undefined ||
        root.stagedLegendaryActionRefreshes !== undefined ||
        root.stagedActionEconomyRefreshes !== undefined ||
        root.completedRechargePlan !== undefined ||
        root.expectedEncounterVersion !== row.version ||
        resolvedOccurrence.expectedEncounterVersion !== row.version ||
        root.policySnapshotChecksum !== state.initiativePolicySnapshotChecksum ||
        root.stagedInitiativeRoundState.round.encounterId !== row.id ||
        root.stagedInitiativeRoundState.round.round !== root.round ||
        (isEachRound
          ? root.initiativeBeforePin.kind !== 'EACH_ROUND' ||
            root.initiativeBeforePin.round !== state.round ||
            root.initiativeBeforePin.version !== row.version
          : root.initiativeBeforePin.kind !== 'INITIAL_START') ||
        root.initiativeBeforePin.actorIds.length !== state.actorIds.length ||
        root.initiativeBeforePin.actorIds.some(
          (actorId, index) => actorId !== [...state.actorIds].sort()[index]
        )
      )
        throw new Error('Rule occurrence is unavailable.')
      let pinnedAdvance: ReturnType<typeof planEncounterInitiativeAdvance> | null = null
      if (isEachRound) {
        const pinnedState = await createEncounterInitiativeStore(ctx).lockInitiativeRound({
          encounterId: row.id,
          round: state.round
        })
        if (!pinnedState || state.currentActorId === null)
          throw new Error('The normalized initiative round is unavailable.')
        pinnedAdvance = planEncounterInitiativeAdvance({
          state: pinnedState,
          currentActorId: state.currentActorId
        })
      }
      if (
        isEachRound &&
        (root.initiativeBeforePin.kind !== 'EACH_ROUND' ||
          pinnedAdvance?.kind !== 'ROUND_WRAP' ||
          pinnedAdvance.cadence !== 'EACH_ROUND' ||
          pinnedAdvance.round !== root.initiativeBeforePin.round ||
          pinnedAdvance.stateChecksum !== root.initiativeBeforePin.checksum ||
          pinnedAdvance.nextRound !== root.round ||
          (root.initiativeAdvance !== undefined &&
            checksumCanonicalJson(pinnedAdvance) !== checksumCanonicalJson(root.initiativeAdvance)))
      )
        throw new Error('Rule occurrence is unavailable.')
      const { actors: stagedActors, movementTargets: stagedMovementTargets } =
        await restoreNativeInitiativeTurnActors({
          ctx,
          state,
          campaign,
          root,
          occurrenceId: resolvedOccurrence.id,
          updatedAt
        })
      const existingResolution = root.resolutionCommands.find(
        (entry) => entry.commandId === input.commandId
      )
      if (existingResolution) {
        if (
          existingResolution.kind !== historyKind ||
          existingResolution.commandFingerprint !== commandFingerprint ||
          existingResolution.actorUserId !== userId ||
          existingResolution.correlationId !== input.correlationId
        )
          throw new Error('Rule occurrence is unavailable.')
        return encounterCommandResultDtoSchema.parse({
          projection,
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId: resolvedOccurrence.id,
            occurrenceVersion: resolvedOccurrence.version,
            status: 'PENDING',
            outcome: null,
            pending: projectEncounterInitiativePendingSummary({
              pendingSnapshot,
              occurrenceVersion: resolvedOccurrence.version,
              encounterVersion: row.version
            })
          }
        })
      }
      if (
        resolvedOccurrence.version !== input.expectedOccurrenceVersion ||
        root.resolutionCommands.some((entry) => entry.commandId === input.commandId)
      )
        throw new Error('Rule occurrence is unavailable.')
      const request = pendingSnapshot.request
      if (request.kind !== 'INTEGER_RANGE') throw new Error('Rule occurrence is unavailable.')
      const scorePhase =
        context.phase.kind === 'PRIMARY_SCORE' || context.phase.kind === 'TIE_RESOLUTION'
      if (
        resolution.requestId !== request.requestId ||
        (scorePhase && resolution.kind === 'INITIATIVE_ENTITY') ||
        (!scorePhase && resolution.kind !== 'INITIATIVE_ENTITY')
      )
        throw new Error('Rule occurrence is unavailable.')
      const snapshot = state.initiativePolicySnapshot
      const snapshotChecksum = state.initiativePolicySnapshotChecksum
      if (!snapshot || !snapshotChecksum) throw new Error('Rule occurrence is unavailable.')
      if (dnd5eInitiativeFactAdapter.gameSystemId !== state.gameSystemId)
        throw new Error('Rule occurrence is unavailable.')
      const sources = await loadEncounterInitiativeSources(
        ctx,
        state,
        campaign,
        stagedActors,
        stagedMovementTargets
      )
      const staged = inMemoryInitiativeRepository(
        hydrateStagedState(root.stagedInitiativeRoundState)
      )
      const restored = restoreEncounterInitiativePending({
        pendingSnapshot,
        entities: createEncounterInitiativeScoreEntities({
          state: staged.read(),
          sources,
          adapter: dnd5eInitiativeFactAdapter
        }),
        actorIds: state.actorIds
      })
      const runtime = await createRulesRuntime(ctx, userId)
      const value =
        resolution.kind === 'INITIATIVE_ENTITY'
          ? { selectedEntityId: resolution.entityId }
          : resolveEncounterIntegerAnswer({
              min: request.min,
              max: request.max,
              answer: withEncounterAppRoll(
                resolution,
                await readEncounterSettledAppRoll(ctx, {
                  occurrence: resolvedOccurrence,
                  response: input,
                  userId
                })
              ),
              random: nextRollInt
            })
      const initiativeResult = await resumeEncounterInitiativeLifecycle({
        repository: staged.repository,
        runtime,
        gameSystemId: state.gameSystemId,
        state: staged.read(),
        snapshot,
        snapshotChecksum,
        sources,
        adapter: dnd5eInitiativeFactAdapter,
        mode: await initiativeEvidenceMode(),
        pending: restored.pending,
        requestId: resolution.requestId,
        value,
        integerSource: ({ min, max }) => min + nextRollInt(max - min + 1)
      })
      const resolutionCommand: TurnResolutionCommandDto = {
        commandId: input.commandId,
        commandFingerprint,
        actorUserId: userId,
        correlationId: input.correlationId,
        expectedOccurrenceVersion: input.expectedOccurrenceVersion,
        requestId: resolution.requestId,
        kind: historyKind
      }
      const resolutionCommands = [...root.resolutionCommands, resolutionCommand]
      const occurrenceVersion = resolvedOccurrence.version + 1
      if (initiativeResult.kind === 'PENDING') {
        const nextPendingSnapshot = createEncounterInitiativePendingSnapshot({
          root: {
            ...root,
            stagedInitiativeRoundState: serializeStagedInitiativeRoundState(initiativeResult.state),
            resolutionCommands
          },
          pending: initiativeResult.pending
        })
        const nextOccurrence = encounterStoredRuleOccurrenceSchema.parse({
          id: resolvedOccurrence.id,
          campaignId: resolvedOccurrence.campaignId,
          encounterId: resolvedOccurrence.encounterId,
          rootCommandId: resolvedOccurrence.rootCommandId,
          state: 'PENDING',
          version: occurrenceVersion,
          expectedEncounterVersion: row.version,
          pendingSnapshotJson: JSON.stringify(nextPendingSnapshot),
          pendingSnapshotChecksum: checksumCanonicalJson(nextPendingSnapshot),
          completedAt: null,
          createdAt: resolvedOccurrence.createdAt,
          updatedAt
        })
        await ctx.db.patch(resolvedOccurrence._id, {
          version: nextOccurrence.version,
          pendingSnapshotJson: nextOccurrence.pendingSnapshotJson,
          pendingSnapshotChecksum: nextOccurrence.pendingSnapshotChecksum,
          updatedAt
        })
        return encounterCommandResultDtoSchema.parse({
          projection,
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId: resolvedOccurrence.id,
            occurrenceVersion,
            status: 'PENDING',
            outcome: null,
            pending: projectEncounterInitiativePendingSummary({
              pendingSnapshot: nextPendingSnapshot,
              occurrenceVersion,
              encounterVersion: row.version
            })
          }
        })
      }
      if (initiativeResult.orderedActorIds.length === 0)
        throw new Error('Encounter initiative did not settle.')
      const initiativeSettlement = encounterInitiativeSettlementDtoSchema.parse({
        round: initiativeResult.state.round.round,
        cadence: initiativeResult.state.round.cadence,
        procedure: initiativeResult.state.round.procedure,
        policySnapshotChecksum: initiativeResult.state.round.policySnapshotChecksum,
        orderedActorIds: initiativeResult.orderedActorIds,
        orderedSideIds: initiativeResult.orderedSideIds,
        evidence: initiativeResult.evidence
      })
      requireInitiativeTransition(root.commandType, initiativeSettlement, pinnedAdvance)
      const nextState = encounterRunStateSchema.parse({
        ...state,
        status: 'ACTIVE',
        round: isEachRound ? root.round : 1,
        currentActorId: initiativeResult.orderedActorIds[0]!,
        version,
        updatedAt
      })
      const nextProjection = encounterGmProjectionDtoSchema.parse({
        ...projection,
        status: 'ACTIVE',
        round: isEachRound ? root.round : 1,
        currentActorId: initiativeResult.orderedActorIds[0]!,
        version,
        updatedAt
      })
      return settleNativeInitiativeTurn({
        campaign,
        priorTurn: {
          outgoingTurn: root.outgoingTurn,
          completedLegendaryActions: root.completedLegendaryActions
        },
        occurrenceId: resolvedOccurrence.id,
        stagedInitiative: {
          beforePin: root.initiativeBeforePin,
          stagedRoundState: serializeStagedInitiativeRoundState(initiativeResult.state)
        },
        ctx,
        encounter: row,
        occurrence: resolvedOccurrence,
        state,
        nextState,
        nextProjection,
        rootCommand,
        rootCommandId: root.rootCommandId,
        rootCommandFingerprint: root.commandFingerprint,
        rootInitiatorUserId: root.initiatorUserId,
        rootRequestedByUserId: root.requestedByUserId,
        rootCorrelationId: root.correlationId,
        rootExpectedEncounterVersion: root.expectedEncounterVersion,
        initiative: initiativeSettlement,
        initiativeAdvance: isEachRound ? pinnedAdvance : null,
        resolutionCommands,
        occurrenceVersion,
        encounterVersion: version,
        updatedAt
      })
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
      const projectedActor = actors.find((actor) => actor.id === input.actorId)
      if (!projectedActor) throw new Error('Encounter actor was not found.')
      const actorRow = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', row.id).eq('id', input.actorId))
        .unique()
      if (!actorRow) throw new Error('Encounter actor was not found.')
      let actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
      if (
        actor.id !== actorRow.id ||
        actor.encounterId !== row.id ||
        actor.systemId !== row.gameSystemId ||
        checksumCanonicalJson(actor) !== actorRow.stateChecksum ||
        checksumCanonicalJson(readEncounterActorCore(actor)) !==
          checksumCanonicalJson(readEncounterActorCore(projectedActor)) ||
        !state.sides.some((side) => side.id === actor.sideId)
      )
        throw new Error('Stored Encounter actor mismatch.')
      if (input.sideId !== undefined && !state.sides.some((side) => side.id === input.sideId))
        throw new Error('Encounter side was not found.')
      if (input.type === 'UPDATE_ACTOR' && input.controllerUserIds !== undefined)
        await requireEncounterActorControllerCandidates(ctx, campaign, input.controllerUserIds)
      if (
        input.type === 'UPDATE_ACTOR' &&
        actor.kind === 'CHARACTER' &&
        (input.currentHitPoints !== undefined ||
          input.tempHitPoints !== undefined ||
          input.conditions !== undefined)
      )
        throw new Error('Character HP must be changed through its Sheet command.')
      let sheetState: Pick<
        EncounterGmActorDto,
        'currentHitPoints' | 'maxHitPoints' | 'tempHitPoints' | 'conditions'
      > | null = null
      if (input.type === 'UPDATE_ACTOR' && input.characterCommand !== undefined) {
        if (actor.kind !== 'CHARACTER')
          throw new Error('Sheet command does not target this Character actor.')
        const character = await ctx.runMutation(executeEncounterCharacterCommand, {
          characterId: actor.sourceId,
          command: input.characterCommand,
          campaignId: campaign.id
        })
        characterReceiptId = character.historyEventId
        sheetState = {
          currentHitPoints: Math.max(character.currentHitPoints, 0),
          maxHitPoints: Math.max(character.maxHitPoints, 0),
          tempHitPoints: Math.max(character.tempHitPoints, 0),
          conditions: character.conditions
        }
      }
      let initiativeModifier = 0
      if (input.type === 'ROLL_ACTOR_INITIATIVE') {
        const source = (await loadEncounterInitiativeSources(ctx, state, campaign)).actors.find(
          (candidate) => candidate.actor.id === actor.id
        )
        if (!source) throw new Error('Encounter initiative source was not found.')
        const system = await requireSystem(ctx, state.gameSystemId)
        initiativeModifier =
          source.kind === 'CHARACTER'
            ? (source.effectiveRulePolicyOutput ?? source.overlay.rulePolicyOutput).derivedStats
                .initiative.effective
            : source.kind === 'CREATURE'
              ? source.actorRule.initiativeModifier
              : 0
        roll = rollRecordDtoSchema.parse({
          id: crypto.randomUUID(),
          characterId: source.kind === 'CHARACTER' ? source.characterId : null,
          characterLabel: actor.label,
          source: { kind: 'INITIATIVE', label: 'Initiative' },
          ruleset: {
            systemId: system.id,
            code: system.rulesetCode,
            version: system.rulesetVersion
          },
          ...evaluateRollExpression(parseRollExpression('1d20'), {
            nextInt: nextRollInt
          }),
          createdAt: updatedAt
        })
      }
      actor = encounterRunActorStateSchema.parse(
        input.type === 'SET_INITIATIVE' || input.type === 'ROLL_ACTOR_INITIATIVE'
          ? {
              ...actor,
              initiative:
                input.type === 'ROLL_ACTOR_INITIATIVE'
                  ? roll!.evidence.total + initiativeModifier
                  : input.initiative,
              ...(input.type === 'SET_INITIATIVE' && input.manualOrder !== undefined
                ? { manualOrder: input.manualOrder }
                : {}),
              updatedAt
            }
          : {
              ...actor,
              ...(input.currentHitPoints === undefined
                ? {}
                : { currentHitPoints: input.currentHitPoints }),
              ...(input.tempHitPoints === undefined ? {} : { tempHitPoints: input.tempHitPoints }),
              ...(input.conditions === undefined ? {} : { conditions: input.conditions }),
              ...(input.gmNotes === undefined ? {} : { gmNotes: input.gmNotes }),
              ...(input.public === undefined ? {} : { public: input.public }),
              ...(input.controllerUserIds === undefined
                ? {}
                : { controllerUserIds: input.controllerUserIds }),
              ...(input.disposition === undefined ? {} : { disposition: input.disposition }),
              ...(input.sideId === undefined ? {} : { sideId: input.sideId }),
              updatedAt
            }
      )
      // These edits leave actor rule facts and initiative ordering unchanged.
      const nextCore = { ...projectedActor, ...readEncounterActorCore(actor), ...sheetState }
      const nextActor = encounterGmActorDtoSchema.parse({
        ...nextCore,
        healthBand: healthBand(nextCore.currentHitPoints, nextCore.maxHitPoints)
      })
      actors = actors.map((current) => (current.id === actor.id ? nextActor : current))
      await ctx.db.patch(actorRow._id, {
        stateJson: JSON.stringify(actor),
        stateChecksum: checksumCanonicalJson(actor)
      })
    } else if (input.type === 'ADJUST_FEATURE_RESOURCE') {
      if (state.status !== 'PREPARED' && state.status !== 'ACTIVE')
        rejectDomain(
          'ENCOUNTER_NOT_ACTIVE',
          'Feature resources can only be changed on a prepared or active Encounter.'
        )
      const projectedActor = actors.find((actor) => actor.id === input.actorId)
      if (!projectedActor) throw new Error('Encounter actor was not found.')
      const actorRow = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', row.id).eq('id', input.actorId))
        .unique()
      if (!actorRow) throw new Error('Encounter actor was not found.')
      let actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
      if (
        actor.id !== actorRow.id ||
        actor.encounterId !== row.id ||
        actor.systemId !== row.gameSystemId ||
        checksumCanonicalJson(actor) !== actorRow.stateChecksum ||
        checksumCanonicalJson(readEncounterActorCore(actor)) !==
          checksumCanonicalJson(readEncounterActorCore(projectedActor)) ||
        !state.sides.some((side) => side.id === actor.sideId)
      )
        throw new Error('Stored Encounter actor mismatch.')
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
      const nextFacts = buildEncounterActorRuleFacts({
        actors: durableActors.map((current) => (current.id === actor.id ? actor : current))
      })
      const bound = bindEncounterActorRuleOutputToFacts(reconciled, nextFacts)
      const nextActor = encounterGmActorDtoSchema.parse({
        ...projectedActor,
        ...readEncounterActorCore(actor),
        features: snapshotFeatures(actor, requireEncounterActorRuleResult(bound, actor.id))
      })
      actors = actors.map((current) => (current.id === actor.id ? nextActor : current))
      await ctx.db.patch(actorRow._id, {
        stateJson: JSON.stringify(actor),
        stateChecksum: checksumCanonicalJson(actor)
      })
    } else if (input.type === 'REPLACE_CREATURE_EQUIPMENT') {
      const durableActors = await readRunActors(ctx, state)
      const actor = durableActors.find((candidate) => candidate.id === input.actorId)
      const projectedActor = actors.find((candidate) => candidate.id === input.actorId)
      if (!actor || !projectedActor) throw new Error('Encounter actor was not found.')
      if (
        checksumCanonicalJson(readEncounterActorCore(actor)) !==
        checksumCanonicalJson(readEncounterActorCore(projectedActor))
      )
        throw new Error('Stored Encounter actor mismatch.')
      const replacement = await replaceActorEquipment(ctx, userId, actor, input, updatedAt)
      const facts = buildEncounterActorRuleFacts({
        actors: durableActors.map((current) =>
          current.id === actor.id ? replacement.actor : current
        )
      })
      const reconciled = reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
        facts
      )
      const nextActor = encounterGmActorDtoSchema.parse({
        ...projectedActor,
        features: snapshotFeatures(
          replacement.actor,
          requireEncounterActorRuleResult(reconciled, actor.id)
        )
      })
      const actorRow = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', row.id).eq('id', actor.id))
        .unique()
      if (!actorRow) throw new Error('Encounter actor was not found.')
      await ctx.db.patch(actorRow._id, {
        stateJson: JSON.stringify(replacement.actor),
        stateChecksum: checksumCanonicalJson(replacement.actor)
      })
      actors = actors.map((current) => (current.id === actor.id ? nextActor : current))
      creatureEquipmentReplacement = replacement.provenance
    } else if (input.type === 'REPLACE_OPTIONAL_COMBAT_RULES') {
      if (state.status !== 'PREPARED' && state.status !== 'ACTIVE')
        rejectDomain(
          'ENCOUNTER_NOT_ACTIVE',
          'Only prepared or active Encounters can change optional combat rules.'
        )
      const snapshot = await snapshotEncounterOptionalCombatPolicies(
        ctx,
        campaign,
        userId,
        input.definitionIds
      )
      optionalCombatSnapshot = snapshot.optionalCombatSnapshot
      optionalCombatSnapshotChecksum = snapshot.optionalCombatSnapshotChecksum
      optionalCombatRules = optionalCombatSnapshot.definitions.map(
        ({ definitionId, label, document }) => ({
          definitionId,
          label,
          kind: document.kind
        })
      )
    } else if (input.type === 'ROLL_ENEMY_ACTION') {
      if (state.status !== 'ACTIVE')
        rejectDomain('ENCOUNTER_NOT_ACTIVE', 'Enemy actions require an active Encounter.')
      const projectedActor = actors.find((actor) => actor.id === input.actorId)
      if (!projectedActor) throw new Error('Encounter actor was not found.')
      const actorRow = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', row.id).eq('id', input.actorId))
        .unique()
      if (!actorRow) throw new Error('Encounter actor was not found.')
      let actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
      if (
        actor.id !== actorRow.id ||
        actor.encounterId !== row.id ||
        actor.systemId !== row.gameSystemId ||
        checksumCanonicalJson(actor) !== actorRow.stateChecksum ||
        checksumCanonicalJson(readEncounterActorCore(actor)) !==
          checksumCanonicalJson(readEncounterActorCore(projectedActor)) ||
        !state.sides.some((side) => side.id === actor.sideId)
      )
        throw new Error('Stored Encounter actor mismatch.')
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
          resources: withFeatureChargeUsed(
            actor,
            feature.id,
            resource.used + definition.chargeCost
          ),
          updatedAt
        })
        const nextFacts = buildEncounterActorRuleFacts({
          actors: durableActors.map((current) => (current.id === actor.id ? actor : current))
        })
        const bound = bindEncounterActorRuleOutputToFacts(reconciled, nextFacts)
        const nextActor = encounterGmActorDtoSchema.parse({
          ...projectedActor,
          ...readEncounterActorCore(actor),
          features: snapshotFeatures(actor, requireEncounterActorRuleResult(bound, actor.id))
        })
        actors = actors.map((current) => (current.id === actor.id ? nextActor : current))
        await ctx.db.patch(actorRow._id, {
          stateJson: JSON.stringify(actor),
          stateChecksum: checksumCanonicalJson(actor)
        })
      }
      const system = await requireSystem(ctx, state.gameSystemId)
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
        ...evaluateRollExpression(
          parseRollExpression(expression),
          { nextInt: nextRollInt },
          definition.rollMode
        ),
        createdAt: updatedAt
      })
      if (input.visibility === 'TABLE')
        await insertPreEvaluatedCampaignTableRoll(
          ctx,
          { campaign, membership },
          userId,
          input.commandId,
          roll
        )
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
      if (
        activeParticipants.length !== 1 ||
        activeParticipants[0]!.actorId !== state.currentActorId
      )
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
    }
    const nextState = encounterRunStateSchema.parse({
      ...state,
      status,
      round,
      currentActorId,
      reminders,
      optionalCombatSnapshot,
      optionalCombatSnapshotChecksum,
      version,
      updatedAt
    })
    const nextProjection = encounterGmProjectionDtoSchema.parse({
      ...projection,
      status,
      round,
      currentActorId,
      actors,
      reminders,
      optionalCombatRules,
      version,
      updatedAt
    })
    const result = encounterCommandResultDtoSchema.parse({
      projection: nextProjection,
      roll,
      resolution: null,
      occurrence: null
    })
    await ctx.db.patch(row._id, {
      status,
      version,
      updatedAt,
      stateJson: JSON.stringify(nextState),
      stateChecksum: checksumCanonicalJson(nextState),
      projectionJson: JSON.stringify(nextProjection),
      projectionChecksum: checksumCanonicalJson(nextProjection)
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
        resultJson: JSON.stringify(result),
        resultChecksum: checksumCanonicalJson(result),
        createdAt: updatedAt
      })
    )
    return result
  }
})
