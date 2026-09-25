import type { EncounterResponseAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { projectEncounterInitiativePendingSummary } from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import { applyEncounterInitiativeAdvance } from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { readRunActors } from './documents'
import { projectNativeGm } from './nativeProjection'
import { correctInitiativeCursor } from './initiativeCorrection'
import { completeNativeInitiativeOccurrence } from './initiativeTerminalCompletion'
import { prepareNativeTurn } from './turnPreparation'
import { readNativeTurnSettlement } from './turnSettlement'
import { persistNativeTurnEffects } from './turnEffects'
import { projectNativeTurnPending } from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import { startNativeConcentrationChecks } from './concentration'
import {
  labelTurnEffectDamage,
  nativeConcentrationDamageApplications,
  nativeConcentrationDamageSourceLabels
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { readDefinitionRoot } from '../content/definitionStore'
import { readAutoRollDice } from '../lib/rollPreferences'
import { readEncounterAutoRollByActorId } from './actorController'

type CompletionInput = Parameters<typeof completeNativeInitiativeOccurrence>[0]

/** A settled initiative phase may still pause for turn-owned Recharge before any mechanics commit. */
export function settleNativeInitiativeTurn(
  input: Omit<CompletionInput, 'occurrence'> & {
    occurrence?: Doc<'encounterRuleOccurrences'>
    occurrenceId: string
    campaign: Doc<'campaigns'>
    stagedInitiative?: TurnCoordinatorRootDto['stagedInitiative']
    priorTurn?: Pick<TurnCoordinatorRootDto, 'outgoingTurn' | 'completedLegendaryActions'>
  }
) {
  return completeTurn({
    ctx: input.ctx,
    encounter: input.encounter,
    occurrence: input.occurrence,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    state: input.state,
    projection: input.nextProjection,
    campaign: input.campaign,
    updatedAt: input.updatedAt,
    root: {
      rootCommandId: input.rootCommandId,
      commandFingerprint: input.rootCommandFingerprint,
      commandType: input.rootCommand.type,
      initiatorUserId: input.rootInitiatorUserId,
      requestedByUserId: input.rootRequestedByUserId,
      correlationId: input.rootCorrelationId,
      expectedEncounterVersion: input.rootExpectedEncounterVersion,
      startSystemId:
        input.rootCommand.type === 'START' ? (input.rootCommand.systemId ?? null) : null,
      frozenActorRuleRevisionId: null,
      frozenActorRuleRevisionChecksum: null,
      frozenActorRuleSnapshotChecksum: null,
      initiative: input.initiative,
      initiativeAdvance: input.initiativeAdvance,
      ...(input.stagedInitiative ? { stagedInitiative: input.stagedInitiative } : {}),
      proposedTerminalTransition: {
        status: 'ACTIVE',
        round: input.nextState.round,
        currentActorId: input.nextState.currentActorId
      },
      resolutionCommands: [...input.resolutionCommands],
      ...input.priorTurn
    }
  })
}

export function resumeNativeTurn(input: {
  ctx: MutationCtx
  encounter: Doc<'encounterRuns'>
  occurrence: Doc<'encounterRuleOccurrences'>
  occurrenceVersion: number
  state: EncounterRunState
  projection: EncounterGmProjectionDto
  campaign: Doc<'campaigns'>
  root: TurnCoordinatorRootDto
  pending: ServerRuleExecutionPendingSnapshotDto
  rawDie?: number
  resolution?: EncounterResponseAnswer
  updatedAt: string
}) {
  return completeTurn({ ...input, occurrenceId: input.occurrence.id })
}

async function completeTurn(input: {
  ctx: MutationCtx
  encounter: Doc<'encounterRuns'>
  occurrence?: Doc<'encounterRuleOccurrences'>
  occurrenceId: string
  occurrenceVersion: number
  state: EncounterRunState
  projection: EncounterGmProjectionDto
  campaign: Doc<'campaigns'>
  root: TurnCoordinatorRootDto
  pending?: ServerRuleExecutionPendingSnapshotDto
  rawDie?: number
  resolution?: EncounterResponseAnswer
  updatedAt: string
}) {
  const { ctx, state, campaign, encounter } = input
  let root = input.root
  const {
    rootCommand,
    initiative,
    original,
    durableActors,
    advance,
    staged: initialStaged
  } = await readNativeTurnSettlement(input)
  let staged = initialStaged
  // The GM initiates every turn: its own steps take the GM's preference, and each actor's saves
  // (turn effects, Concentration) go to that actor's controllers.
  const autoRollByActorId = await readEncounterAutoRollByActorId(ctx, {
    campaign,
    initiatorUserId: campaign.ownerUserId,
    actors: await readRunActors(ctx, state)
  })
  const prepared = await prepareNativeTurn({
    ctx,
    state,
    campaign,
    autoRoll: await readAutoRollDice(ctx, campaign.ownerUserId),
    autoRollByActorId,
    root,
    occurrenceId: input.occurrenceId,
    actors: durableActors,
    pending: input.pending,
    resolution: input.resolution,
    rawDie: input.rawDie,
    updatedAt: input.updatedAt
  })
  if (prepared.kind === 'COMPLETE') {
    root = prepared.root
    staged = root.stagedInitiative
  }
  // Pending responses show only the committed projection, including before initial START.
  const committedProjection = encounterGmProjectionDtoSchema.parse(
    JSON.parse(encounter.projectionJson)
  )
  const record = encounterStoredRuleOccurrenceSchema.parse({
    id: input.occurrenceId,
    campaignId: campaign.id,
    encounterId: state.id,
    rootCommandId: root.rootCommandId,
    state: prepared.kind === 'PENDING' ? 'PENDING' : 'COMPLETED',
    version: input.occurrenceVersion,
    expectedEncounterVersion: prepared.kind === 'PENDING' ? state.version : state.version + 1,
    pendingSnapshotJson: prepared.kind === 'PENDING' ? JSON.stringify(prepared.snapshot) : null,
    pendingSnapshotChecksum:
      prepared.kind === 'PENDING' ? checksumCanonicalJson(prepared.snapshot) : null,
    completedAt: prepared.kind === 'PENDING' ? null : input.updatedAt,
    createdAt: input.occurrence?.createdAt ?? input.updatedAt,
    updatedAt: input.updatedAt
  })
  let occurrence = input.occurrence
  if (occurrence) await ctx.db.patch(occurrence._id, record)
  else {
    const id = await ctx.db.insert('encounterRuleOccurrences', record)
    occurrence = (await ctx.db.get(id)) ?? undefined
  }
  if (!occurrence) throw new Error('Encounter occurrence was not retained.')
  if (prepared.kind === 'PENDING')
    return encounterCommandResultDtoSchema.parse({
      projection: committedProjection,
      roll: null,
      occurrence: {
        occurrenceId: input.occurrenceId,
        occurrenceVersion: input.occurrenceVersion,
        status: 'PENDING',
        outcome: null,
        pending:
          prepared.snapshot.applicationContext.kind === 'ENCOUNTER_INITIATIVE' ||
          prepared.snapshot.applicationContext.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
            ? projectEncounterInitiativePendingSummary({
                pendingSnapshot: prepared.snapshot,
                occurrenceVersion: input.occurrenceVersion,
                encounterVersion: state.version
              })
            : projectNativeTurnPending({
                snapshot: prepared.snapshot,
                occurrenceId: input.occurrenceId,
                occurrenceVersion: input.occurrenceVersion,
                encounterVersion: state.version
              })
      }
    })

  if (staged)
    await initiative.persistStagedInitiativeRound(
      staged.stagedRoundState,
      root.commandType === 'ADVANCE_TURN' ? { replaceExistingRound: true } : undefined
    )
  if (advance && original) {
    if (advance.kind === 'ROUND_WRAP' && advance.cadence === 'ENCOUNTER_START')
      await correctInitiativeCursor({
        ctx,
        encounterId: state.id,
        sourceRound: state.round,
        targetRound: advance.nextRound,
        sourceCurrentActorId: state.currentActorId!,
        currentActorId: advance.firstActorId
      })
    await applyEncounterInitiativeAdvance({
      repository: initiative,
      state: original,
      plan: advance
    })
  }
  const effectCommit = {
    state,
    userId: campaign.ownerUserId,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    rootCommandId: root.rootCommandId,
    occurredAt: input.updatedAt
  }
  const outgoingEffects = prepared.outgoing?.plan
    ? await persistNativeTurnEffects(ctx, { ...effectCommit, plan: prepared.outgoing.plan })
    : null
  {
    for (const actor of prepared.incomingActors) {
      const before = prepared.outgoingActors.find((current) => current.id === actor.id)
      if (checksumCanonicalJson(before) === checksumCanonicalJson(actor)) continue
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id).eq('id', actor.id))
        .unique()
      if (!row) throw new Error('Encounter turn actor is unavailable.')
      const next = { ...actor, updatedAt: input.updatedAt }
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(next),
        stateChecksum: checksumCanonicalJson(next)
      })
    }
  }
  const incomingEffects = prepared.incoming.plan
    ? await persistNativeTurnEffects(ctx, { ...effectCommit, plan: prepared.incoming.plan })
    : null
  const nextState = encounterRunStateSchema.parse({
    ...state,
    ...root.proposedTerminalTransition,
    version: state.version + 1,
    updatedAt: input.updatedAt
  })
  const damage = await labelTurnEffectDamage(
    [outgoingEffects?.result, incomingEffects?.result].flatMap((result) =>
      result?.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
        ? result.executions
        : []
    ),
    async (definitionId) =>
      (await readDefinitionRoot(ctx, definitionId, campaign.ownerUserId))?.current?.label ?? null
  )
  const concentration = await startNativeConcentrationChecks(ctx, {
    state: nextState,
    readVersion: state.version,
    actors: await readRunActors(ctx, state),
    parentOccurrenceId: input.occurrenceId,
    parentCommandFingerprint: root.commandFingerprint,
    applications: nativeConcentrationDamageApplications(damage),
    sourceLabels: nativeConcentrationDamageSourceLabels(damage),
    userId: campaign.ownerUserId,
    autoRollByActorId,
    occurredAt: input.updatedAt
  })
  const terminalActors = concentration.actors
  const facts = buildEncounterActorRuleFacts({ actors: terminalActors })
  const actorRules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
    facts
  )
  const nextProjection = await projectNativeGm(ctx, nextState, terminalActors, actorRules)
  return completeNativeInitiativeOccurrence({
    ctx,
    encounter,
    occurrence,
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
    initiative: root.initiative,
    initiativeAdvance: root.initiativeAdvance,
    rechargePlan: prepared.rechargePlan,
    outgoingEffects: {
      phase: prepared.outgoing?.phase ?? { kind: 'NONE' },
      result: outgoingEffects?.result ?? null
    },
    incomingEffects: {
      phase: prepared.incoming.phase,
      result: incomingEffects?.result ?? null
    },
    legendaryActions: root.completedLegendaryActions,
    legendaryActionRefreshes: root.stagedLegendaryActionRefreshes,
    actionEconomyRefreshes: root.stagedActionEconomyRefreshes,
    includeOccurrence:
      input.occurrence !== undefined ||
      prepared.rechargePlan !== null ||
      prepared.outgoing?.phase.kind === 'STAGED' ||
      prepared.outgoing?.phase.kind === 'MANUAL' ||
      prepared.incoming.phase.kind !== 'NONE' ||
      !!root.completedLegendaryActions?.length ||
      !!root.stagedLegendaryActionRefreshes?.length ||
      !!root.stagedActionEconomyRefreshes?.length,
    resolutionCommands: root.resolutionCommands,
    occurrenceVersion: input.occurrenceVersion,
    encounterVersion: state.version + 1,
    updatedAt: input.updatedAt
  })
}
