import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionEncounterEscapeCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { ESCAPE_ACTION_LABEL } from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { deleteGrants } from './consumedGrantPersistence.js'
import { readEscapeAdmission } from './basicActionAdmission.js'
import { projectNativeBasicActionCheckPending } from './basicActionCheckPending.js'
import { insertCheckOccurrence, insertSettledCheckReceipt } from './basicActionPersistence.js'
import { readRunActors, replaceRunActor } from './documents.js'
import { settleEncounterEscapeCheck } from './escapeCheckSettlement.js'
import {
  ESCAPE_EFFECT_MISMATCH,
  findStoredEscape,
  requireEscapeAllowance
} from './escapeEffectVerification.js'
import { projectNativeGm } from './nativeProjection.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import type { EncounterWriteTransaction } from './ports.js'

/**
 * Records the room's planned Escape (D105): the activation it spent, checked against the current
 * Run, and its d20 check, waiting on the holder's roll or settled by an auto-roll that also ends
 * the relationship. It evaluates no rules.
 */
export async function persistEncounterEscape(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterEscapeCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      actors: readonly EncounterRunActorState[],
      input: LiveSessionEncounterEscapeCommitInput
    ): Promise<void>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readEscapeAdmission(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, command, fingerprint } = admission
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session escape overrides were not acknowledged.')
  const actors = await readRunActors(ctx, state)
  await callbacks.validateReadFence(state, actors, input)
  const actor = actors.find((entry) => entry.id === command.actorId)
  // A rescuer rolls; the effect lives on the creature it frees.
  const holder = command.heldActorId
    ? actors.find((entry) => entry.id === command.heldActorId)
    : actor
  const ruleActors = actors.filter((entry) => entry.kind !== 'CHARACTER')
  const { check } = input
  const context =
    check.kind === 'PENDING' ? check.snapshot.applicationContext : check.settlement.context
  if (
    !actor ||
    !holder ||
    context.kind !== 'ENCOUNTER_ESCAPE_CHECK' ||
    context.commandId !== command.commandId ||
    context.commandFingerprint !== fingerprint ||
    context.actorId !== actor.id ||
    context.heldActorId !== command.heldActorId ||
    context.activeEffectId !== command.activeEffectId ||
    context.check.checkDefinitionId !== command.checkDefinitionId ||
    // A d20 the attempt rolls itself never answered a window, so it spends no held die.
    (check.kind === 'SETTLED' && check.settlement.window) ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId))
  )
    throw new Error('Live Session escape scope mismatch.')
  if (
    check.kind === 'PENDING' &&
    (check.snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      check.snapshot.graph.source.gameSystemId !== state.gameSystemId)
  )
    throw new Error('Live Session pending escape check mismatch.')
  // The relationship effect, not the room's plan, owns the DC, the allowed checks and the activation.
  const escape = await findStoredEscape(ctx, {
    encounterId: state.id,
    holder,
    context
  })
  if (!escape) throw new Error(ESCAPE_EFFECT_MISMATCH)
  requireEscapeAllowance(state, escape, input.actionEconomy)
  const spent = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor,
        consumption: input.actionEconomy,
        overridden: overridesActionEconomy(input.ruleOverrides)
      })
    : actor
  await replaceRunActor(ctx, actor, spent)
  // A Help the check used is consumed with the attempt, so a pending check keeps its advantage.
  await deleteGrants(ctx, input.consumedGrants)
  let nextActors = actors.map((entry) => (entry.id === spent.id ? spent : entry))
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  if (check.kind === 'SETTLED')
    nextActors = (
      await settleEncounterEscapeCheck(ctx, {
        campaign,
        state,
        actors: nextActors,
        settlement: check.settlement,
        rootCommandId: command.commandId,
        initiatorUserId: input.expectedUserId,
        occurredAt: input.occurredAt,
        occurrenceVersion: 0
      })
    ).actors
  const storedOccurrence = await insertCheckOccurrence(ctx, {
    campaignId: campaign.id,
    encounterId: run.id,
    rootCommandId: command.commandId,
    expectedEncounterVersion: nextState.version,
    check,
    occurredAt: input.occurredAt
  })
  const projection = await projectNativeGm(ctx, nextState, nextActors, input.rules)
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: storedOccurrence.id,
      occurrenceVersion: 0,
      ...(check.kind === 'PENDING'
        ? {
            status: 'PENDING',
            pending: projectNativeBasicActionCheckPending(storedOccurrence, check.snapshot)
          }
        : { status: 'COMPLETE', pending: null })
    }
  })
  if (check.kind === 'SETTLED')
    await insertSettledCheckReceipt(ctx, {
      campaignId: campaign.id,
      state,
      nextVersion: nextState.version,
      commandType: 'ESCAPE',
      commandId: command.commandId,
      commandFingerprint: fingerprint,
      execution: check.settlement.execution,
      actorUserId: input.expectedUserId,
      occurredAt: input.occurredAt
    })
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
      commandType: 'ESCAPE',
      label: ESCAPE_ACTION_LABEL,
      ruleOverrides: input.ruleOverrides,
      receipt: {
        actorId: actor.id,
        actionEconomy: input.actionEconomy,
        consumedGrants: input.consumedGrants,
        checkOccurrenceId: storedOccurrence.id
      },
      commandFingerprint: fingerprint,
      actorUserId: input.expectedUserId,
      version: nextState.version,
      commandJson: JSON.stringify(command),
      ...encounterReplayReceipt(result),
      createdAt: input.occurredAt
    })
  )
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
