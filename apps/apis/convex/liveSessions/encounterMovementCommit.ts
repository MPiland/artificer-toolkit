import {
  liveSessionMovementCommitInputSchema,
  type LiveSessionMovementCommitResponse
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { MovementConcentrationExecutionDto } from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  retainedMovementSpatialExecutions,
  retainedMovementReactionExecutions
} from '@artificer-toolkit/rules-runtime/encounterSpatialMovementResult'
import { projectGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { spatialMovementEffectBeforeTransition } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementEffects'
import {
  movementCommandCharacterAggregateVersions,
  type MovementCommandTransition
} from '@artificer-toolkit/rules-runtime/encounterMovementChangedAggregates'
import type { MutationCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { createSpatialRuleEffectStore } from '../rules/spatialEffectStore'
import {
  readGeometrySave,
  readMovementResolution,
  readSpatialPreparation
} from '../scenes/geometryDocuments'
import { publishSceneGeometry } from '../scenes/geometryPublication'
import { stageSceneGeometryFog } from '../scenes/geometryStaging'
import { persistSpatialPreparation } from '../scenes/spatialPreparationPersistence'
import {
  publishSpatialTerminal,
  type SpatialTerminalPublicationCallbacks
} from '../scenes/spatialTerminalPublication'
import { publishSpatialPending } from '../scenes/spatialPendingPublication'
import { publishMovementResponse } from '../scenes/movementResolutionPublication'
import { consumeNativeActionEconomy } from '../encounters/actionEconomyPersistence'
import {
  postMovementDecisionSkipped,
  recordRuleOccurrenceVoid,
  voidDeclineCommandId
} from '../encounters/occurrenceVoid'
import { readMovementResponseResult } from '../scenes/movementResolutionReads'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { readLiveMovementWriteAdmission } from './encounterMovementWriteAdmission'
import { persistLiveMovementSpatial } from './encounterMovementSpatialCommit'
import { persistLiveMovementReaction } from './encounterMovementReactionCommit'
import { consumeEncounterAllyAdvantages } from '../encounters/allyAdvantage'
import { persistLiveMovementConcentration } from './encounterMovementConcentrationCommit'
import { publishWithAuthorityAdvance } from './externalCommit'

function contactEvidence<T extends { concentrationChecks?: MovementConcentrationExecutionDto[] }>(
  value: T
) {
  const { concentrationChecks: _checks, ...contact } = value
  return contact
}

/** Checksums of values a commit never mutates, each computed once per object. */
const checksums = new WeakMap<object, string>()
function checksumOnce(value: object): string {
  let checksum = checksums.get(value)
  if (checksum === undefined) {
    checksum = checksumCanonicalJson(value)
    checksums.set(value, checksum)
  }
  return checksum
}

/** A retained contact's evidence, without its Concentration checks, checksummed once. */
const evidenceChecksums = new WeakMap<object, string>()
function evidenceChecksum(
  value: object & { concentrationChecks?: MovementConcentrationExecutionDto[] }
): string {
  let checksum = evidenceChecksums.get(value)
  if (checksum === undefined) {
    checksum = checksumCanonicalJson(contactEvidence(value))
    evidenceChecksums.set(value, checksum)
  }
  return checksum
}

/** Element-wise equality of two checksummed lists, which is canonical equality of the lists. */
function sameChecksums<T extends object>(
  left: readonly T[],
  right: readonly T[],
  checksum: (value: T) => string
) {
  return (
    left.length === right.length &&
    left.every((value, index) => checksum(value) === checksum(right[index]!))
  )
}

type MovementOutcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>

function appliedSpatialPrefix(outcome: MovementOutcome) {
  if (outcome.kind === 'TERMINAL')
    return outcome.result.status === 'BATCH_COMPLETE' ? outcome.result : null
  const { context } = readEncounterMovementPendingContext(outcome.pendingSnapshot)
  const prefix =
    context.kind === 'ENCOUNTER_MOVEMENT_REACTION'
      ? context.appliedSpatialPrefix
      : context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
        ? context.movement.appliedSpatialPrefix
        : context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST'
          ? context.movementContinuation.appliedSpatialPrefix
          : null
  if (
    prefix &&
    (prefix.status !== 'BATCH_COMPLETE' || prefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
    throw new Error('Movement spatial history is unavailable.')
  return prefix
}

/** A response may append child checks to its latest damage, but never rewrite committed contacts. */
function retainedContactChecks<
  T extends object & { concentrationChecks?: MovementConcentrationExecutionDto[] }
>(prior: readonly T[], next: readonly T[]) {
  if (
    next.length < prior.length ||
    !sameChecksums(prior, next.slice(0, prior.length), evidenceChecksum)
  )
    throw new Error('Movement response changed its retained contact history.')
  return prior.flatMap((entry, index) => {
    const previousChecks = entry.concentrationChecks ?? []
    const nextChecks = next[index]!.concentrationChecks ?? []
    if (
      nextChecks.length < previousChecks.length ||
      !sameChecksums(previousChecks, nextChecks.slice(0, previousChecks.length), checksumOnce)
    )
      throw new Error('Movement response changed its retained Concentration history.')
    return nextChecks.slice(previousChecks.length)
  })
}

/**
 * Called inside the private movement mutation's single Convex transaction. It also advances the
 * room's authority sequence (D27); a decision answer or GM void returns its member Encounter result.
 */
export async function commitLiveMovement(
  ctx: MutationCtx,
  args: unknown
): Promise<LiveSessionMovementCommitResponse> {
  const input = liveSessionMovementCommitInputSchema.parse(args)
  const { userId } = await requireIdentity(ctx)
  if (
    userId !== input.expectedUserId ||
    input.finish.saveId !== input.movement.saveId ||
    input.finish.baseOrdinal !== input.movement.baseTokenOrdinal
  )
    throw new Error('Live movement commit identity or save mismatch.')
  await requireActiveCampaignLiveAuthority(ctx, {
    campaignId: input.campaignId,
    epoch: input.authorityEpoch
  })
  const { saveId } = input.movement
  const staged = await readGeometrySave(ctx, saveId)
  // The room's frozen plan and fog layers stage in this transaction, after every captured owner is
  // checked (D52); a completed publication validates its receipt before the revisions it consumed.
  const admission =
    staged.save.status === 'PUBLISHED' ? null : await readLiveMovementWriteAdmission(ctx, input)
  if (admission) {
    await persistSpatialPreparation(ctx, saveId, input.preparation)
    for (const layer of input.fogLayers) await stageSceneGeometryFog(ctx, { saveId, layer })
  }
  const current = admission ? await readGeometrySave(ctx, saveId) : staged
  const { save, campaign, membership } = current
  const preparation = readSpatialPreparation(save)
  if (
    campaign.id !== input.campaignId ||
    campaign.status !== 'ACTIVE' ||
    membership.role !== input.expectedRole ||
    save.actorUserId !== userId ||
    save.sessionVision?.campaignId !== input.campaignId ||
    preparation?.encounterId !== input.movement.encounterId ||
    // Reading the stored preparation verified its stored checksum.
    save.spatialPreparationChecksum !== checksumCanonicalJson(input.preparation)
  )
    throw new Error('Live movement commit scope mismatch.')
  const resolution = readMovementResolution(save)
  if (
    input.voidCommand &&
    (!resolution ||
      resolution.command.commandId !== voidDeclineCommandId(input.voidCommand.commandId) ||
      resolution.command.occurrenceId !== input.voidCommand.occurrenceId.toLowerCase())
  )
    throw new Error('Live movement void does not match its declined decision.')
  let settled = false
  const settle = async () => {
    if (!admission || settled || preparation.outcome.kind === 'UNINTERRUPTED')
      throw new Error('Live movement settlement is unavailable.')
    settled = true
    const priorOutcome: MovementOutcome | null = resolution
      ? { kind: 'PENDING', pendingSnapshot: resolution.snapshot, movementIntent: null }
      : null
    const priorPrefix = priorOutcome ? appliedSpatialPrefix(priorOutcome) : null
    const appliedPrefix = appliedSpatialPrefix(preparation.outcome)
    // A dice pause may retain evaluated contacts that have not changed gameplay state yet.
    const nextSpatial = retainedMovementSpatialExecutions(preparation.outcome)
    const nextReactions = retainedMovementReactionExecutions(preparation.outcome)
    const priorSpatial = priorOutcome ? retainedMovementSpatialExecutions(priorOutcome) : []
    const priorReactions = priorOutcome ? retainedMovementReactionExecutions(priorOutcome) : []
    const priorSpatialCount = priorPrefix?.executions.length ?? 0
    retainedContactChecks(priorSpatial, nextSpatial)
    const checks = [
      ...retainedContactChecks(priorPrefix?.executions ?? [], nextSpatial),
      ...retainedContactChecks(priorReactions, nextReactions)
    ]
    if ((appliedPrefix?.executions.length ?? 0) < priorSpatialCount)
      throw new Error('Movement response lost its applied spatial prefix.')
    const spatial = (appliedPrefix?.executions ?? []).slice(priorSpatialCount)
    const reactions = nextReactions.slice(priorReactions.length)
    const resolutionCommands =
      preparation.outcome.kind === 'PENDING'
        ? readEncounterMovementPendingContext(preparation.outcome.pendingSnapshot).root
            .resolutionCommands
        : preparation.outcome.resolutionCommands
    if (
      resolution &&
      (!resolutionCommands ||
        resolutionCommands.length !== resolution.root.resolutionCommands.length + 1 ||
        checksumCanonicalJson(resolutionCommands.slice(0, -1)) !==
          checksumCanonicalJson(resolution.root.resolutionCommands))
    )
      throw new Error('Movement response history does not extend its issued decision.')
    const responseCommand = resolutionCommands?.at(-1)
    if (
      resolution &&
      (!responseCommand ||
        responseCommand.commandId !== save.commandId ||
        responseCommand.commandFingerprint !== checksumCanonicalJson(resolution.command) ||
        responseCommand.actorUserId !== userId ||
        responseCommand.expectedOccurrenceVersion !==
          resolution.command.expectedOccurrenceVersion ||
        responseCommand.correlationId !== resolution.command.correlationId)
    )
      throw new Error('Movement response command identity is inconsistent.')
    const passage =
      responseCommand && 'passageContest' in responseCommand
        ? responseCommand.passageContest
        : undefined
    let passageSettled = false
    const mechanicsChanged = input.settlements.some(
      (step) =>
        step.kind !== 'CONCENTRATION' || step.execution.result.applicationOutputs.cleanup !== null
    )
    const effectOriginals = new Map<string, EncounterSpatialRuleEffectRecord>()
    if (spatial.length) {
      const effects = await createSpatialRuleEffectStore(ctx).scope({
        encounterId: admission.state.id,
        sceneId: save.sceneId
      })
      if (!effects) throw new Error('Movement spatial scope changed.')
      for (const entry of spatial) {
        const effectId = entry.candidate.effect.effectId
        if (effectOriginals.has(effectId)) continue
        const transition = priorPrefix?.spatialEffectTransitions.find(
          (entry) => entry.effectId === effectId
        )
        const currentEffect = await effects.get(effectId)
        const effect = transition
          ? spatialMovementEffectBeforeTransition({
              current: currentEffect,
              consumed: priorPrefix?.consumedSpatialEffects?.find((entry) => entry.id === effectId),
              effectId,
              transition: transition.transition,
              encounterId: admission.state.id,
              sceneId: save.sceneId,
              allowUnapplied: false
            })
          : currentEffect
        if (!effect) throw new Error('Movement spatial effect changed.')
        effectOriginals.set(effectId, effect)
      }
    }
    const transitions: MovementCommandTransition[] = []
    let actors = admission.actors
    let spatialIndex = 0
    let reactionIndex = 0
    let distance = -1
    const appliedEffectIds = new Set(
      priorPrefix?.spatialEffectTransitions.map((entry) => entry.effectId) ?? []
    )
    const common = {
      state: admission.state,
      occurrenceId: preparation.occurrenceId,
      sourceCommandId: save.commandId,
      occurredAt: preparation.occurredAt
    }
    for (const step of input.settlements) {
      if (step.kind !== 'CONCENTRATION' && checks.length)
        throw new Error('Movement Concentration must settle before the next contact.')
      if (step.kind === 'SPATIAL') {
        const expected = spatial.slice(spatialIndex, spatialIndex + step.executions.length)
        if (
          expected.length !== step.executions.length ||
          expected.some(
            (execution, index) =>
              evidenceChecksum(execution) !== checksumCanonicalJson(step.executions[index])
          )
        )
          throw new Error('Movement spatial settlement differs from its retained receipt.')
        for (const execution of expected) {
          const nextDistance = execution.candidate.candidate.pathDistance
          if (nextDistance + 1e-8 < distance) throw new Error('Movement contacts are out of order.')
          distance = nextDistance
        }
        const committed = await persistLiveMovementSpatial(ctx, {
          ...common,
          actors,
          step,
          sceneId: save.sceneId,
          effectOriginals,
          appliedEffectIds
        })
        actors = committed.actors
        transitions.push({ kind: 'SPATIAL_PREFIX', result: committed })
        spatialIndex += expected.length
        checks.push(...expected.flatMap((entry) => entry.concentrationChecks ?? []))
      } else if (step.kind === 'REACTION') {
        const expected = reactions[reactionIndex]
        if (!expected || evidenceChecksum(expected) !== checksumCanonicalJson(step.execution))
          throw new Error('Movement reaction settlement differs from its retained receipt.')
        const nextDistance = expected.option.candidate.pathDistance
        if (nextDistance + 1e-8 < distance) throw new Error('Movement contacts are out of order.')
        distance = nextDistance
        actors = await persistLiveMovementReaction(ctx, {
          ...common,
          actors,
          step,
          authorizedCharacterIds: admission.characterIds
        })
        transitions.push({ kind: 'REACTION', execution: expected })
        reactionIndex++
        checks.push(...(expected.concentrationChecks ?? []))
      } else if (step.kind === 'PASSAGE') {
        if (
          !resolution ||
          !passage ||
          passageSettled ||
          spatialIndex ||
          reactionIndex ||
          step.actorId !== passage.audit.sourceActorId ||
          checksumCanonicalJson(step.consumption) !== checksumCanonicalJson(passage.actionEconomy)
        )
          throw new Error('Movement passage allowance differs from its retained contest.')
        const actor = actors.find((entry) => entry.id === step.actorId)
        if (!actor) throw new Error('Movement passage actor is unavailable.')
        const next = await consumeNativeActionEconomy(ctx, {
          actor,
          consumption: step.consumption,
          overridden: false
        })
        actors = await consumeEncounterAllyAdvantages(ctx, {
          actors: actors.map((entry) => (entry.id === next.id ? next : entry)),
          uses: step.allyAdvantageUses,
          rollerActorIds: [passage.audit.sourceActorId, passage.audit.blockerActorId]
        })
        passageSettled = true
      } else {
        const expected = checks.shift()
        if (!expected || checksumOnce(expected) !== checksumCanonicalJson(step.execution))
          throw new Error('Movement Concentration differs from its retained contact.')
        actors = await persistLiveMovementConcentration(ctx, {
          ...common,
          state: {
            ...admission.state,
            version:
              admission.state.version +
              (preparation.outcome.kind === 'TERMINAL' || mechanicsChanged ? 1 : 0)
          },
          actors,
          execution: step.execution,
          parentOccurrenceId: preparation.occurrenceId,
          userId,
          authorizedCharacterIds: admission.characterIds
        })
        transitions.push({ kind: 'CONCENTRATION', execution: step.execution })
      }
    }
    if (
      spatialIndex !== spatial.length ||
      reactionIndex !== reactions.length ||
      checks.length ||
      Boolean(passage) !== passageSettled
    )
      throw new Error('Movement settlement is incomplete.')
    return {
      mechanicsChanged,
      characterTransitions: movementCommandCharacterAggregateVersions(transitions).map((span) => ({
        characterId: span.aggregateId,
        beforeStreamVersion: span.beforeVersion,
        afterStreamVersion: span.version
      }))
    }
  }
  const project: SpatialTerminalPublicationCallbacks['project'] = (
    state,
    actors,
    characterStates
  ) => {
    const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
    const rules = input.rules
    if (
      !rules ||
      rules.actors.length !== ruleActors.length ||
      new Set(rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
      rules.actors.some(
        (actor) => !ruleActors.some((currentActor) => currentActor.id === actor.actorId)
      )
    )
      throw new Error('Movement actor rule output scope mismatch.')
    return projectGm({ ...state, actors }, rules, characterStates)
  }
  const scene = await publishWithAuthorityAdvance(ctx, input, () =>
    publishSceneGeometry(
      ctx,
      input.finish,
      {
        publishPreparedMovementResponse: (transaction, request, geometry) =>
          publishMovementResponse(transaction, request, geometry, {
            commit: async () => {
              if (!resolution || preparation.outcome.kind === 'UNINTERRUPTED')
                throw new Error('Live movement response is unavailable.')
              const resolutionCommands =
                preparation.outcome.kind === 'PENDING'
                  ? readEncounterMovementPendingContext(preparation.outcome.pendingSnapshot).root
                      .resolutionCommands
                  : preparation.outcome.resolutionCommands
              if (!resolutionCommands) throw new Error('Movement response history is unavailable.')
              const committed = await settle()
              return {
                outcome: preparation.outcome,
                resolutionCommands,
                ...committed,
                commandCharacterTransitions: committed.characterTransitions
              }
            },
            project
          }),
        publishPreparedSpatialPending: (transaction, request, geometry) =>
          publishSpatialPending(transaction, request, geometry, {
            evaluateInitial: async () => {
              if (!admission || preparation.outcome.kind !== 'PENDING')
                throw new Error('Live pending movement is unavailable.')
              return { outcome: preparation.outcome, settlements: input.settlements }
            },
            settle,
            project
          }),
        verifyPreparedUninterruptedMovement: async () => {
          if (
            !admission ||
            preparation.outcome.kind !== 'UNINTERRUPTED' ||
            input.settlements.length ||
            input.rules
          )
            throw new Error('Uninterrupted movement cannot settle mechanics.')
        },
        publishPreparedSpatialTerminal: (transaction, saveId, geometry, request) =>
          publishSpatialTerminal(transaction, saveId, geometry, request, {
            settle: async () => {
              if (preparation.outcome.kind !== 'TERMINAL')
                throw new Error('Live terminal movement is unavailable.')
              return { result: preparation.outcome.result, ...(await settle()) }
            },
            project
          })
      },
      current
    )
  )
  if (!resolution) return { scene, encounter: null }
  if (!input.voidCommand)
    return { scene, encounter: await readMovementResponseResult(ctx, resolution.command) }
  await postMovementDecisionSkipped(ctx, {
    campaignId: input.campaignId,
    gmUserId: userId,
    voidCommand: input.voidCommand
  })
  return { scene, encounter: await recordRuleOccurrenceVoid(ctx, input.voidCommand) }
}
