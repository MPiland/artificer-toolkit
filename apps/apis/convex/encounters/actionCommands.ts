import {
  evaluateEncounterActionRuleWarnings,
  overridesActionEconomy
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  dnd5eAttackKind,
  isDnd5eMeleeAttackKind
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/attackKind'
import { encounterActionCurrentnessChecksum } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { readNativeActionSceneContext } from './actionSceneContext'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { settleNativeEncounterActionMechanics } from './actionMechanics'
import { discoverEncounterLegendaryResistanceCandidate } from '@artificer-toolkit/rules-runtime/encounterLegendaryResistanceDiscovery'
import { readDefinitionRoot } from '../content/definitionStore'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import type {
  EncounterCommandResultDto,
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readEncounterAutoRollByActorId } from './actorController'
import { presentEncounterResultForMember } from './resultPresentation'
import { createRulesRuntime } from '../rules/runtime'
import { readRunActor, readRunActors } from './documents'
import { projectNativeGm } from './nativeProjection'
import { evaluateNativeActionEconomy } from './actionEconomy'
import { consumeNativeActionEconomy } from './actionEconomyPersistence'
import { insertRunCommand } from './timelineEntries'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { buildEncounterActionStoredExecution } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import { persistNativeCleavingAfterAction } from './cleaving'
import {
  nativeConcentrationDamageApplications,
  nativeConcentrationDamageSourceLabels
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { startNativeConcentrationChecks } from './concentration'
import { persistNativeActionEffects, prepareNativeActionEffects } from './actionEffects'
import {
  prepareNativeActionMaintenance,
  replaceNativeActionMaintenance,
  finishNativeActionMaintenance
} from './actionMaintenance'
import { nextRollInt } from '../lib/rollRandom'
import { rejectRuleWarnings } from '../lib/domainRejections'
import { readNativeEncounterActionAdmission } from './actionAdmission'
import { nativeActionPendingResult, readNativeActionPending } from './actionPending'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { prepareNativeEncounterActionMechanics } from './actionMechanicsPreparation'

type ActionResume = {
  occurrence: Doc<'encounterRuleOccurrences'>
  response: ResolveRuleOccurrenceInputDto
  resolution: EncounterEvidenceAnswer
}

/** Executes or resumes one sealed action; only its terminal transaction spends resources. */
export async function executeNativeEncounterAction(
  ctx: MutationCtx,
  command: ResolveEncounterActionInputDto,
  userId: string,
  resume?: ActionResume
): Promise<EncounterCommandResultDto> {
  const admission = await readNativeEncounterActionAdmission(
    ctx,
    command,
    userId,
    resume && {
      occurrence: resume.occurrence,
      initiatorUserId: readNativeActionPending(resume.occurrence).context.initiatorUserId
    }
  )
  const { campaign, membership } = admission
  if (admission.kind === 'REPLAY')
    return presentEncounterResultForMember(ctx, { campaign, membership, result: admission.result })
  const { input, run, state, fingerprint, initiatorUserId } = admission
  // Rules read as the Campaign owner, so GM homebrew resolves for a player's action too.
  const readerUserId = campaign.ownerUserId
  const [actor, target, actors] = await Promise.all([
    readRunActor(ctx, state, input.actorId),
    readRunActor(ctx, state, input.targetActorId),
    readRunActors(ctx, state)
  ])
  const prepared = await prepareNativeEncounterActionMechanics(ctx, {
    state,
    actor,
    target,
    actors,
    actionId: input.actionId,
    wieldConflictAcceptance: { kind: 'PROMPTED', accepted: input.acceptedWieldConflict },
    overridable: true,
    campaignOwnerUserId: campaign.ownerUserId
  })
  const { source, adapter, targetPolicy: policy, plan, actorRules, binding } = prepared
  const sceneContext = await readNativeActionSceneContext(
    ctx,
    state,
    input,
    membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
  )
  if (input.optionalCombatIntent != null)
    throw new Error('Native action execution requires the complete contextual action coordinator.')
  const activation =
    source.kind === 'CHARACTER_ACTION'
      ? source.candidate.mechanicFacts.invocation.activation
      : source.capability.mechanicFacts.invocation.activation
  if (!activation || activation.amount === null)
    throw new Error('The selected action activation is not normalized.')
  const economy = await evaluateNativeActionEconomy(ctx, {
    actor,
    state,
    userId: readerUserId,
    activation: { code: activation.code, amount: activation.amount },
    target: prepared.movementTargets.get(actor.id)
  })
  const ruleWarnings = evaluateEncounterActionRuleWarnings({
    preparedWarnings: prepared.ruleWarnings,
    target: { actor, target, targetPolicy: policy, sceneContext },
    actionEconomy: economy,
    activationCode: activation.code,
    acknowledged: input.acknowledgedWarnings
  })
  if (ruleWarnings.kind === 'UNSUPPORTED_TARGET')
    throw new Error('The selected action does not permit this target.')
  if (ruleWarnings.kind === 'UNACKNOWLEDGED') rejectRuleWarnings(ruleWarnings.warnings)
  const actionEconomy = economy?.consumption ?? null

  const maintenance = await prepareNativeActionMaintenance(ctx, prepared, readerUserId)
  const currentnessChecksum = encounterActionCurrentnessChecksum({
    prepared,
    actionEconomy,
    maintenance,
    sceneContext
  })
  const priorPending = resume ? readNativeActionPending(resume.occurrence) : null
  if (priorPending && priorPending.context.currentnessChecksum !== currentnessChecksum)
    throw new Error('The pending action source or target changed.')
  const occurrenceId = resume?.occurrence.id ?? crypto.randomUUID()
  const occurrenceVersion = resume ? resume.occurrence.version + 1 : 0
  const runtime = await createRulesRuntime(ctx, readerUserId)
  const autoRollByActorId = await readEncounterAutoRollByActorId(ctx, {
    campaign,
    initiatorUserId,
    actors
  })
  const execution = await advanceNativeActionGraphs({
    runtime,
    random: nextRollInt,
    adapter,
    plan,
    occurrenceId,
    autoRoll: {
      SOURCE: autoRollByActorId[actor.id] ?? false,
      TARGET: autoRollByActorId[target.id] ?? false
    },
    binding,
    ...(resume && priorPending
      ? {
          resume: {
            pending: {
              kind: 'PENDING' as const,
              continuation: priorPending.continuation,
              d20Policy: priorPending.context.d20Policy,
              twoPhase: priorPending.context.twoPhase,
              ...(priorPending.snapshot.phaseReceipts
                ? { phaseReceipts: priorPending.snapshot.phaseReceipts }
                : {})
            },
            resolution: resume.resolution
          }
        }
      : {}),
    afterTest: async (test) => {
      if (test.outputs.resultPath !== 'ON_SAVE_FAIL' || target.kind !== 'CREATURE') return
      const candidate = await discoverEncounterLegendaryResistanceCandidate({
        encounter: state,
        targetActor: target,
        actorRules,
        definitions: {
          requireCurrent: async (definitionId) => {
            const root = await readDefinitionRoot(ctx, definitionId, readerUserId)
            if (!root?.current) throw new Error('Legendary Resistance definition is unavailable.')
            return root.current
          }
        }
      })
      if (candidate) throw new Error('The action requires a Legendary Resistance decision.')
    }
  })
  if (execution.kind === 'PENDING') {
    const updatedAt = new Date().toISOString()
    const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse({
      ...execution.continuation,
      snapshotKind: 'KERNEL_EVIDENCE',
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      applicationContext: {
        kind: 'ENCOUNTER_ACTION',
        schemaVersion: 1,
        commandJson: JSON.stringify(input),
        commandFingerprint: fingerprint,
        initiatorUserId,
        rollerActorId: execution.roller === 'SOURCE' ? actor.id : target.id,
        currentnessChecksum,
        d20Policy: execution.d20Policy,
        twoPhase: execution.twoPhase
      },
      ...(execution.phaseReceipts ? { phaseReceipts: execution.phaseReceipts } : {})
    })
    const value = encounterStoredRuleOccurrenceSchema.parse({
      id: occurrenceId,
      campaignId: campaign.id,
      encounterId: run.id,
      rootCommandId: input.commandId,
      state: 'PENDING',
      version: occurrenceVersion,
      expectedEncounterVersion: state.version,
      pendingSnapshotJson: JSON.stringify(snapshot),
      pendingSnapshotChecksum: checksumCanonicalJson(snapshot),
      completedAt: null,
      createdAt: resume?.occurrence.createdAt ?? updatedAt,
      updatedAt
    })
    const id = resume?.occurrence._id ?? (await ctx.db.insert('encounterRuleOccurrences', value))
    if (resume) await ctx.db.patch(id, value)
    const occurrence = await ctx.db.get(id)
    if (!occurrence) throw new Error('The pending action was not stored.')
    if (resume)
      await insertActionEvidenceReceipt(ctx, {
        occurrence,
        response: resume.response,
        rootCommand: input,
        rootFingerprint: fingerprint,
        userId,
        rootInitiatorUserId: initiatorUserId,
        result: storedRuleExecutionResultDtoSchema.parse({
          status: 'PAUSED',
          occurrenceId,
          occurrenceVersion,
          request: execution.continuation.request,
          ...(execution.d20Policy
            ? {
                pending: {
                  kind: 'D20_EVIDENCE',
                  rollMode: execution.d20Policy.rollMode
                }
              }
            : {})
        })
      })
    return presentEncounterResultForMember(ctx, {
      campaign,
      membership,
      result: nativeActionPendingResult(run, occurrence)
    })
  }
  const preparedEffects = await prepareNativeActionEffects(ctx, {
    prepared,
    execution,
    occurrenceId,
    commandId: input.commandId
  })
  const applications = [
    ...execution.applications,
    ...preparedEffects.relationshipConditionApplications
  ]
  if (
    adapter.interpretSpatial?.({
      execution: execution.execution,
      occurrenceId,
      published: execution.published,
      targetActorId: target.id
    }).length
  )
    throw new Error('Native action execution requires the complete contextual action coordinator.')
  const updatedAt = new Date().toISOString()
  const settled = await settleNativeEncounterActionMechanics(ctx, {
    prepared,
    encounterId: run.id,
    expectedEncounterVersion: state.version,
    occurrenceId,
    sourceCommandId: input.commandId,
    commandId: input.commandId,
    occurredAt: updatedAt,
    applications,
    forceTargetVersionAdvance:
      target.kind === 'CHARACTER' &&
      (preparedEffects.stateEffect !== null || preparedEffects.recurringEffect !== null)
  })
  const maintainedState = preparedEffects.maintenance
    ? await replaceNativeActionMaintenance(ctx, {
        prepared,
        maintenance:
          maintenance ??
          (() => {
            throw new Error('The action maintenance preflight is unavailable.')
          })(),
        policy: preparedEffects.maintenance,
        actionId: input.actionId,
        occurrenceId
      })
    : null
  const { stateEffectTransitions, activeEffectTransitions } = await persistNativeActionEffects(
    ctx,
    { prepared, preparedEffects, maintainedEffectStateId: maintainedState?.id }
  )
  const { mechanics, settledSource, sourceResourceMechanics } = settled
  const economyActor = actionEconomy
    ? await consumeNativeActionEconomy(ctx, {
        actor: settledSource,
        consumption: actionEconomy,
        overridden: overridesActionEconomy(ruleWarnings.overrides)
      })
    : prepared.resourceUse || sourceResourceMechanics
      ? settledSource
      : null
  let nextActors = actors.map((candidate) =>
    candidate.id === mechanics.updatedActor.id
      ? economyActor?.id === candidate.id
        ? economyActor
        : mechanics.updatedActor
      : economyActor?.id === candidate.id
        ? economyActor
        : candidate
  )
  const maintained =
    maintainedState && maintenance
      ? await finishNativeActionMaintenance(ctx, {
          prepared,
          maintenance,
          createdState: maintainedState,
          createdDependentEffectIds: activeEffectTransitions.map((effect) => effect.activeEffectId),
          actors: nextActors,
          occurredAt: updatedAt
        })
      : null
  if (maintained) nextActors = maintained.actors
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt
  })
  const damage = [
    {
      targetActorId: target.id,
      applications: mechanics.receiptApplications,
      sourceLabel: encounterActionSourceLabel(prepared.source)
    }
  ]
  const concentration = await startNativeConcentrationChecks(ctx, {
    state: nextState,
    readVersion: state.version,
    actors: nextActors,
    parentOccurrenceId: occurrenceId,
    parentCommandFingerprint: fingerprint,
    applications: nativeConcentrationDamageApplications(damage, true),
    sourceLabels: nativeConcentrationDamageSourceLabels(damage, true),
    userId: readerUserId,
    autoRollByActorId,
    occurredAt: updatedAt
  })
  nextActors = concentration.actors
  const nextFacts = buildEncounterActorRuleFacts({ actors: nextActors })
  const nextRules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({
      gameSystemId: state.gameSystemId,
      facts: nextFacts
    }),
    nextFacts,
    { output: actorRules }
  )
  const nextProjection = await projectNativeGm(ctx, nextState, nextActors, nextRules)
  const result = encounterCommandResultDtoSchema.parse({
    projection: nextProjection,
    roll: null,
    occurrence: {
      occurrenceId,
      occurrenceVersion,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  })
  const resultChecksum = checksumCanonicalJson(result)
  const storedExecution = buildEncounterActionStoredExecution({
    prepared,
    execution,
    occurrenceId,
    occurrenceVersion,
    settled,
    effects: { stateEffectTransitions, activeEffectTransitions },
    maintainedState,
    maintenanceTransition: maintained?.transition ?? null,
    actionEconomy
  })
  const ruleResultChecksum = checksumRuleDocument(storedExecution)
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    projectionJson: JSON.stringify(nextProjection),
    projectionChecksum: checksumCanonicalJson(nextProjection),
    updatedAt
  })
  const completedOccurrence = encounterStoredRuleOccurrenceSchema.parse({
    id: occurrenceId,
    campaignId: campaign.id,
    encounterId: run.id,
    rootCommandId: input.commandId,
    state: 'COMPLETED',
    version: occurrenceVersion,
    expectedEncounterVersion: nextState.version,
    pendingSnapshotJson: null,
    pendingSnapshotChecksum: null,
    completedAt: updatedAt,
    createdAt: resume?.occurrence.createdAt ?? updatedAt,
    updatedAt
  })
  if (resume) await ctx.db.patch(resume.occurrence._id, completedOccurrence)
  else await ctx.db.insert('encounterRuleOccurrences', completedOccurrence)
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      occurrenceId,
      commandId: input.commandId,
      commandType: 'RESOLVE_ACTION',
      commandFingerprint: fingerprint,
      encounterVersion: nextState.version,
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'START',
          definitionId: execution.initialPublished.id,
          expectedAggregateVersion: state.version,
          factsChecksum: execution.initialFactsChecksum,
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      ),
      resultJson: JSON.stringify(storedExecution),
      resultChecksum: ruleResultChecksum,
      actorUserId: initiatorUserId,
      correlationId: null,
      createdAt: updatedAt
    })
  )
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.commandId,
      commandType: 'RESOLVE_ACTION',
      ruleOccurrenceId: occurrenceId,
      ruleResultChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      ruleOverrides: ruleWarnings.overrides,
      commandFingerprint: fingerprint,
      actorUserId: initiatorUserId,
      version: nextState.version,
      commandJson: JSON.stringify(input),
      resultJson: JSON.stringify(result),
      resultChecksum,
      createdAt: updatedAt
    })
  )
  if (resume)
    await insertActionEvidenceReceipt(ctx, {
      occurrence: { ...resume.occurrence, ...completedOccurrence },
      response: resume.response,
      rootCommand: input,
      rootFingerprint: fingerprint,
      userId,
      rootInitiatorUserId: initiatorUserId,
      result: storedExecution
    })
  const cleavingRange = rangeDtoSchema.safeParse(policy.range)
  if (storedExecution.status === 'COMPLETE' && cleavingRange.success && sceneContext)
    await persistNativeCleavingAfterAction(ctx, {
      state: nextState,
      result: storedExecution,
      source,
      action: {
        actionId: input.actionId,
        publishedDefinitionId: execution.published.id,
        publishedDefinitionChecksum: execution.published.checksum,
        attackKind: isDnd5eMeleeAttackKind(
          dnd5eAttackKind(
            source.kind === 'CREATURE'
              ? source.capability.mechanicFacts.invocation.triggerCode
              : source.candidate.mechanicFacts.invocation.triggerCode
          )
        )
          ? 'MELEE'
          : 'OTHER',
        range: cleavingRange.data
      },
      scene: {
        sceneId: sceneContext.sceneId,
        sceneVersion: sceneContext.sceneVersion,
        effectiveGridChecksum: checksumRuleDocument(sceneContext.grid),
        sourceTokenId: sceneContext.sourceToken.tokenId
      },
      occurredAt: updatedAt
    })
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
