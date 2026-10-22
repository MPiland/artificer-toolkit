import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  LiveSessionEncounterBasicActionCommitInput,
  LiveSessionEncounterEscapeCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
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
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { actionTargetActorId } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { settleActionSourceSpend } from './actionSourceSpend.js'
import { admitCheckActionSource } from './checkActionSourceAdmission.js'
import { deleteGrants, receiptConsumedGrants } from './consumedGrantPersistence.js'
import { readBasicActionAdmission } from './basicActionAdmission.js'
import { projectNativeBasicActionCheckPending } from './basicActionCheckPending.js'
import { settleEncounterBasicActionCheck } from './basicActionCheckSettlement.js'
import type { ApplyEncounterForcedMovements } from './actionCommitRecords.js'
import { isCheckActionSettlement, settleEncounterCheckAction } from './checkActionSettlement.js'
import {
  isConcealmentCheckSettlement,
  settleEncounterConcealmentCheck
} from './concealmentCheckSettlement.js'
import { readRunActors } from './documents.js'
import { projectNativeGm } from './nativeProjection.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import type { EncounterCharacterWriteTransaction, EncounterWriteTransaction } from './ports.js'

/**
 * Records the room's planned check action (Q11), made by a basic action or a Creature feature
 * (D173): the allowance and feature charges it spent, checked against the current Run. It also
 * records its check, waiting on the roller's d20 or settled by an auto-roll, and deletes the
 * one-roll grants that check used up; a settled success re-applies its planned outcome and lands
 * its pushes on the Scene. It evaluates no rules.
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
    applyForcedMovements: ApplyEncounterForcedMovements
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
  const targetActorId = actionTargetActorId(command.target)
  const actor = actors.find((candidate) => candidate.id === command.actorId)
  const ruleActors = actors.filter((candidate) => candidate.kind !== 'CHARACTER')
  if (
    !actor ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId))
  )
    throw new Error('Live Session basic action scope mismatch.')
  const admitted = await admitCheckActionSource(ctx, {
    state,
    actor,
    commit: input,
    readDefinition: callbacks.readDefinition
  })
  const { source } = admitted
  const { check } = input
  // A check action rolls its check unless its target was not dying (an acknowledged warning).
  if (check === null && !input.ruleOverrides.some((warning) => warning.code === 'TARGET_NOT_DYING'))
    throw new Error('Live Session basic action check scope mismatch.')
  if (check === null && input.consumedGrants.length > 0)
    throw new Error('Live Session basic action check scope mismatch.')
  const pendingContext = check?.kind === 'PENDING' ? check.snapshot.applicationContext : null
  const authoredCheck = admitted.check
  // Only a check action's outcome runs from a Creature feature; stabilizing and concealment do not.
  if (
    source.kind !== 'BASIC_ACTION' &&
    (check?.kind === 'PENDING'
      ? pendingContext?.kind !== 'ENCOUNTER_CHECK_ACTION'
      : check === null || !isCheckActionSettlement(check.settlement))
  )
    throw new Error('Live Session check action source mismatch.')
  if (
    check?.kind === 'PENDING' &&
    ((pendingContext?.kind !== 'ENCOUNTER_BASIC_ACTION_CHECK' &&
      pendingContext?.kind !== 'ENCOUNTER_CONCEALMENT_CHECK' &&
      pendingContext?.kind !== 'ENCOUNTER_CHECK_ACTION') ||
      pendingContext.commandId !== command.commandId ||
      pendingContext.commandFingerprint !== fingerprint ||
      (pendingContext.kind === 'ENCOUNTER_CHECK_ACTION'
        ? checksumCanonicalJson(pendingContext.source) !== checksumCanonicalJson(source)
        : source.kind !== 'BASIC_ACTION' ||
          pendingContext.definition.id !== source.definition.id ||
          pendingContext.definition.version !== source.definition.version ||
          pendingContext.definition.checksum !== source.definition.checksum) ||
      (pendingContext.kind === 'ENCOUNTER_BASIC_ACTION_CHECK'
        ? pendingContext.helperActorId !== actor.id ||
          pendingContext.targetActorId !== targetActorId
        : pendingContext.kind === 'ENCOUNTER_CHECK_ACTION'
          ? // The check action resumes from this command, so its pending copy must be this command.
            pendingContext.actorId !== actor.id ||
            pendingContext.targetActorId !== targetActorId ||
            pendingContext.phase.kind !== 'CHECK' ||
            checksumCanonicalJson(JSON.parse(pendingContext.commandJson)) !== fingerprint ||
            pendingContext.check.dc !==
              (authoredCheck.dc.kind === 'FIXED' ? authoredCheck.dc.value : null) ||
            ![
              ...authoredCheck.checks.skillIds,
              ...authoredCheck.checks.abilityDefinitionIds
            ].includes(pendingContext.check.checkDefinitionId)
          : pendingContext.actorId !== actor.id ||
            pendingContext.actionId !== command.actionId ||
            targetActorId !== actor.id) ||
      check.snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      check.snapshot.graph.source.gameSystemId !== state.gameSystemId)
  )
    throw new Error('Live Session pending basic action check mismatch.')
  const spent = await settleActionSourceSpend(ctx, {
    encounterId: state.id,
    source: actor,
    spend: {
      featureResourceConsumption: input.featureResourceConsumption,
      actionEconomyTransition: input.actionEconomy,
      attackActionTransition: undefined
    },
    economyOverridden: overridesActionEconomy(input.ruleOverrides)
  })
  // A Help the check used is consumed with the action, so a pending check keeps its advantage.
  await deleteGrants(ctx, input.consumedGrants)
  let nextActors = actors.map((entry) => (entry.id === spent.id ? spent : entry))
  let endedEffects: ActiveRuleEffectRecord[] = []
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  if (check?.kind === 'SETTLED') {
    const settleInput = {
      campaign,
      state,
      actors: nextActors,
      rootCommandId: command.commandId,
      initiatorUserId: input.expectedUserId,
      occurredAt: input.occurredAt,
      occurrenceVersion: 0
    }
    const { settlement } = check
    if (isCheckActionSettlement(settlement)) {
      const { dc, checks } = authoredCheck
      const settled = await settleEncounterCheckAction(ctx, {
        ...settleInput,
        settlement,
        admitted: {
          commandFingerprint: fingerprint,
          actorId: actor.id,
          targetActorId,
          source,
          checkDefinitionIds: [...checks.skillIds, ...checks.abilityDefinitionIds],
          dc: dc.kind === 'FIXED' ? dc.value : null
        },
        applyMechanics: callbacks.applyMechanics
      })
      nextActors = settled.actors
    } else if (isConcealmentCheckSettlement(settlement)) {
      const settled = await settleEncounterConcealmentCheck(ctx, { ...settleInput, settlement })
      nextActors = settled.actors
      endedEffects = settled.endedEffects
    } else {
      const settled = await settleEncounterBasicActionCheck(ctx, {
        ...settleInput,
        settlement,
        applyMechanics: callbacks.applyMechanics
      })
      nextActors = settled.actors
    }
  }
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
  // A won check's push moves its target's token on the Scene in this commit (D157), settling the
  // zones it passes through (D170).
  const won =
    check?.kind === 'SETTLED' && isCheckActionSettlement(check.settlement) ? check.settlement : null
  const settledMovements = won?.forcedMovements.length
    ? await callbacks.applyForcedMovements({
        state,
        sourceActorId: actor.id,
        commandId: command.commandId,
        movements: won.forcedMovements,
        occurrenceId: won.execution.occurrenceId,
        occurredAt: input.occurredAt,
        authorizedCharacterIds: new Set(
          actors.flatMap((entry) => (entry.kind === 'CHARACTER' ? [entry.sourceId] : []))
        ),
        actors: nextActors,
        rules: input.rules
      })
    : { moves: [], landings: [], actors: nextActors, rules: input.rules }
  const projection = await projectNativeGm(
    ctx,
    nextState,
    settledMovements.actors,
    settledMovements.rules
  )
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
  if (check?.kind === 'SETTLED')
    await insertSettledCheckReceipt(ctx, {
      campaignId: campaign.id,
      state,
      nextVersion: nextState.version,
      commandType: 'RESOLVE_ACTION',
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
      commandType: 'RESOLVE_ACTION',
      label: admitted.label,
      root: {
        kind: 'CHECK',
        checkReceipt: {
          actorId: actor.id,
          actionEconomy: input.actionEconomy,
          featureResourceConsumption: input.featureResourceConsumption,
          checkOccurrenceId: storedOccurrence?.id ?? null
        }
      },
      ruleOverrides: input.ruleOverrides,
      consumedGrants: receiptConsumedGrants({
        consumedGrants: input.consumedGrants,
        endedGrants: endedEffects
      }),
      endedMaintainedStates: [],
      addedConcentrationCasterId: null,
      speedBonusTurn: null,
      teleportAllowanceTurn: null,
      forcedMovements: settledMovements.moves,
      forcedMovementLandings: settledMovements.landings,
      turnUses: null,
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

/** Stores the START receipt of a check an auto-roll settled in its root command's commit. */
export async function insertSettledCheckReceipt(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    campaignId: string
    state: Pick<EncounterRunState, 'id' | 'version' | 'optionalCombatSnapshotChecksum'>
    nextVersion: number
    commandType: 'RESOLVE_ACTION' | 'ESCAPE'
    commandId: string
    commandFingerprint: string
    execution: StoredRuleExecutionResultDto
    actorUserId: string
    occurredAt: string
  }
) {
  const { execution, state } = input
  if (execution.status !== 'COMPLETE') throw new Error('The check did not settle.')
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: input.campaignId,
      encounterId: state.id,
      occurrenceId: execution.occurrenceId,
      commandId: input.commandId,
      commandType: input.commandType,
      commandFingerprint: input.commandFingerprint,
      encounterVersion: input.nextVersion,
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
      actorUserId: input.actorUserId,
      correlationId: null,
      createdAt: input.occurredAt
    })
  )
}

/** Stores the check's occurrence: waiting on the roller's d20, or already settled by an auto-roll. */
export async function insertCheckOccurrence(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    campaignId: string
    encounterId: string
    rootCommandId: string
    expectedEncounterVersion: number
    check:
      | NonNullable<LiveSessionEncounterBasicActionCommitInput['check']>
      | LiveSessionEncounterEscapeCommitInput['check']
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
  if (!stored) throw new Error('The check occurrence was not stored.')
  return stored
}
