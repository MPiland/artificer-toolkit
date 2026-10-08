import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionEncounterBasicActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  encounterRunStateSchema,
  type EncounterRunState,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterBasicActionEffects,
  requireEncounterBasicActionDefinition,
  withEncounterBasicActionEffects
} from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { consumeEncounterAllyAdvantages } from './allyAdvantage.js'
import { readBasicActionAdmission } from './basicActionAdmission.js'
import { projectNativeBasicActionCheckPending } from './basicActionCheckPending.js'
import { settleEncounterBasicActionCheck } from './basicActionCheckSettlement.js'
import { readEncounterCharacterStates } from './characterStates.js'
import { readRunActors, replaceRunActor } from './documents.js'
import { readEncounterInitiativeRound } from './initiativeStore.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { recordTurnSpeedBonus } from './turnMovement.js'
import type { EncounterCharacterWriteTransaction, EncounterWriteTransaction } from './ports.js'

/**
 * Records the room's planned basic action (Q11): the allowance it spent, the effects its actor
 * gains and a movement bonus for the turn, checked against the current Run. A stabilizing action
 * also records its check, waiting on the helper's d20 or settled by an auto-roll. It evaluates no
 * rules.
 */
export async function persistEncounterBasicAction(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterBasicActionCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      actors: readonly EncounterRunActorState[],
      input: LiveSessionEncounterBasicActionCommitInput
    ): Promise<void>
    readDefinition(id: string, userId: string): Promise<ReusableDefinitionCurrentDto | null>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readBasicActionAdmission(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, command, fingerprint } = admission
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session basic action overrides were not acknowledged.')
  const actors = await readRunActors(ctx, state)
  await callbacks.validateReadFence(state, actors, input)
  // The System's catalogue is its platform-published entries (user-authored Systems are deferred).
  const currentDefinition = await callbacks.readDefinition(
    command.definitionId,
    input.expectedUserId
  )
  const { definition, document } = requireEncounterBasicActionDefinition(state, currentDefinition)
  const actor = actors.find((entry) => entry.id === command.actorId)
  const ruleActors = actors.filter((entry) => entry.kind !== 'CHARACTER')
  if (
    !actor ||
    definition.version !== input.definition.version ||
    definition.checksum !== input.definition.checksum ||
    input.speedMovementBonus !== document.mechanics.includes('SPEED_MOVEMENT_BONUS') ||
    input.effects.some(
      (effect) =>
        effect.definitionId !== definition.id ||
        effect.turnSequence !== state.turnSequence ||
        !document.mechanics.includes(effect.mechanic) ||
        effect.allyActorId !==
          (effect.mechanic === 'ALLY_ADVANTAGE' ? command.targetActorId : null) ||
        effect.suspendedWhileUnableToActOrMove !== document.suspendedWhileUnableToActOrMove ||
        checksumCanonicalJson(effect.saveAbilityIds) !==
          checksumCanonicalJson(effect.mechanic === 'SAVE_ADVANTAGE' ? document.saveAbilityIds : [])
    ) ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId))
  )
    throw new Error('Live Session basic action scope mismatch.')
  const { check } = input
  // An action with a check rolls it unless its target was not dying (an acknowledged warning).
  if (
    document.check === null
      ? check !== null
      : check === null &&
        !input.ruleOverrides.some((warning) => warning.code === 'TARGET_NOT_DYING')
  )
    throw new Error('Live Session basic action check scope mismatch.')
  if (check === null && input.allyAdvantageUses.length > 0)
    throw new Error('Live Session basic action check scope mismatch.')
  const pendingContext = check?.kind === 'PENDING' ? check.snapshot.applicationContext : null
  if (
    check?.kind === 'PENDING' &&
    (pendingContext?.kind !== 'ENCOUNTER_BASIC_ACTION_CHECK' ||
      pendingContext.commandId !== command.commandId ||
      pendingContext.commandFingerprint !== fingerprint ||
      pendingContext.definition.id !== definition.id ||
      pendingContext.definition.version !== definition.version ||
      pendingContext.definition.checksum !== definition.checksum ||
      pendingContext.helperActorId !== actor.id ||
      pendingContext.targetActorId !== command.targetActorId ||
      check.snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      check.snapshot.graph.source.gameSystemId !== state.gameSystemId)
  )
    throw new Error('Live Session pending basic action check mismatch.')
  const spent = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor,
        consumption: input.actionEconomy,
        overridden: overridesActionEconomy(input.ruleOverrides)
      })
    : actor
  const settled = withEncounterBasicActionEffects(spent, [
    ...encounterBasicActionEffects(spent),
    ...input.effects
  ])
  await replaceRunActor(ctx, actor, settled)
  if (input.speedMovementBonus) await recordTurnSpeedBonus(ctx, { state, actorId: actor.id })
  // A Help the check used is consumed with the action, so a pending check keeps its advantage.
  let nextActors = await consumeEncounterAllyAdvantages(ctx, {
    actors: actors.map((entry) => (entry.id === settled.id ? settled : entry)),
    uses: input.allyAdvantageUses,
    rollerActorIds: [actor.id]
  })
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const settlement =
    check?.kind === 'SETTLED'
      ? await settleEncounterBasicActionCheck(ctx, {
          campaign,
          state,
          actors: nextActors,
          settlement: check.settlement,
          rootCommandId: command.commandId,
          initiatorUserId: input.expectedUserId,
          occurredAt: input.occurredAt,
          occurrenceVersion: 0,
          applyMechanics: callbacks.applyMechanics
        })
      : null
  if (settlement) nextActors = settlement.actors
  const storedOccurrence = check
    ? await insertCheckOccurrence(ctx, {
        campaignId: campaign.id,
        encounterId: run.id,
        rootCommandId: command.commandId,
        expectedEncounterVersion: nextState.version,
        check,
        occurredAt: input.occurredAt
      })
    : null
  const projection = projectCurrentEncounterGm({
    state: nextState,
    actors: nextActors,
    rules: input.rules,
    initiativeRoundState: await readEncounterInitiativeRound(ctx, {
      encounterId: state.id,
      round: state.round
    }),
    characterStates: await readEncounterCharacterStates(ctx, nextState, nextActors)
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence:
      storedOccurrence && check
        ? {
            occurrenceId: storedOccurrence.id,
            occurrenceVersion: 0,
            ...(check.kind === 'PENDING'
              ? {
                  status: 'PENDING',
                  pending: projectNativeBasicActionCheckPending(storedOccurrence, check.snapshot)
                }
              : { status: 'COMPLETE', pending: null })
          }
        : null
  })
  if (check?.kind === 'SETTLED') {
    const { execution } = check.settlement
    if (execution.status !== 'COMPLETE') throw new Error('The basic action check did not settle.')
    await ctx.db.insert(
      'encounterRuleReceipts',
      encounterStoredRuleReceiptSchema.parse({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        encounterId: run.id,
        occurrenceId: execution.occurrenceId,
        commandId: command.commandId,
        commandType: 'USE_BASIC_ACTION',
        commandFingerprint: fingerprint,
        encounterVersion: nextState.version,
        commandMetadataJson: JSON.stringify(
          serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
            schemaVersion: 1,
            transition: 'START',
            definitionId: execution.evidence.source.definitionId,
            expectedAggregateVersion: state.version,
            factsChecksum: checksumRuleDocument(execution.evidence.facts),
            optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
          })
        ),
        resultJson: JSON.stringify(execution),
        resultChecksum: checksumRuleDocument(execution),
        actorUserId: input.expectedUserId,
        correlationId: null,
        createdAt: input.occurredAt
      })
    )
  }
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt: input.occurredAt
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: command.commandId,
      commandType: 'USE_BASIC_ACTION',
      label: definition.label,
      ruleOverrides: input.ruleOverrides,
      receipt: {
        actorId: actor.id,
        actionEconomy: input.actionEconomy,
        effects: input.effects,
        speedBonusTurn: input.speedMovementBonus
          ? { round: state.round, turnActorId: actor.id }
          : null,
        allyAdvantageUses: input.allyAdvantageUses,
        checkOccurrenceId: storedOccurrence?.id ?? null
      },
      commandFingerprint: fingerprint,
      actorUserId: input.expectedUserId,
      version: nextState.version,
      commandJson: JSON.stringify(command),
      ...encounterReplayReceipt(result),
      createdAt: input.occurredAt
    })
  )
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result
  })
}

/** Stores the check's occurrence: waiting on the helper's d20, or already settled by an auto-roll. */
async function insertCheckOccurrence(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    campaignId: string
    encounterId: string
    rootCommandId: string
    expectedEncounterVersion: number
    check: NonNullable<LiveSessionEncounterBasicActionCommitInput['check']>
    occurredAt: string
  }
) {
  const { check } = input
  const occurrenceId =
    check.kind === 'PENDING' ? check.snapshot.occurrenceId : check.settlement.execution.occurrenceId
  const collision = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
    .unique()
  if (collision) throw new Error('Encounter rule occurrence ID was already used.')
  const id = await ctx.db.insert(
    'encounterRuleOccurrences',
    encounterStoredRuleOccurrenceSchema.parse({
      id: occurrenceId,
      campaignId: input.campaignId,
      encounterId: input.encounterId,
      rootCommandId: input.rootCommandId,
      state: check.kind === 'PENDING' ? 'PENDING' : 'COMPLETED',
      version: 0,
      expectedEncounterVersion: input.expectedEncounterVersion,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: occurrenceId, encounterId: input.encounterId },
        check.kind === 'PENDING' ? check.snapshot : null
      ),
      completedAt: check.kind === 'PENDING' ? null : input.occurredAt,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt
    })
  )
  const stored = await ctx.db.get(id)
  if (!stored) throw new Error('The basic action check occurrence was not stored.')
  return stored
}
