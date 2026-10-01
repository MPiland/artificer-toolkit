import {
  liveSessionMovementCommitInputSchema,
  type LiveSessionMovementCommitResponse
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import type { MutationCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { readGeometrySave } from '../scenes/geometryDocuments'
import {
  readMovementResolution,
  readSpatialPreparation
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { publishSceneGeometry } from '../scenes/geometryPublication'
import { stageSceneGeometryFog } from '../scenes/geometryStaging'
import { persistSpatialPreparation } from '../scenes/spatialPreparationPersistence'
import {
  publishSpatialTerminal,
  type SpatialTerminalPublicationCallbacks
} from '../scenes/spatialTerminalPublication'
import { publishSpatialPending } from '../scenes/spatialPendingPublication'
import { publishMovementResponse } from '../scenes/movementResolutionPublication'
import {
  postMovementDecisionSkipped,
  recordRuleOccurrenceVoid,
  voidDeclineCommandId
} from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import { readMovementResponseResult } from '../scenes/movementResolutionReads'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { readLiveMovementWriteAdmission } from './encounterMovementWriteAdmission'
import { persistLiveMovementSpatial } from './encounterMovementSpatialCommit'
import { persistLiveMovementReaction } from './encounterMovementReactionCommit'
import { persistLiveMovementConcentration } from './encounterMovementConcentrationCommit'
import { publishWithAuthorityAdvance } from './externalCommit'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { persistMovementSettlements } from '@artificer-toolkit/encounter-persistence/movementSettlementPersistence'

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
  const prepared = admission
    ? await persistSpatialPreparation(ctx, saveId, input.preparation)
    : null
  if (admission)
    for (const layer of input.fogLayers) await stageSceneGeometryFog(ctx, { saveId, layer })
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
    save.spatialPreparationChecksum !==
      (prepared?.checksum ?? checksumCanonicalJson(input.preparation))
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
    return persistMovementSettlements(
      encounterWriteTransaction(ctx),
      {
        state: admission.state,
        actors: admission.actors,
        authorizedCharacterIds: admission.characterIds,
        save,
        preparation,
        settlements: input.settlements,
        userId
      },
      {
        persistSpatial: (step) => persistLiveMovementSpatial(ctx, step),
        persistReaction: (step) => persistLiveMovementReaction(ctx, step),
        persistConcentration: (step) => persistLiveMovementConcentration(ctx, step)
      }
    )
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
  await postMovementDecisionSkipped(encounterWriteTransaction(ctx), {
    campaignId: input.campaignId,
    gmUserId: userId,
    voidCommand: input.voidCommand
  })
  return {
    scene,
    encounter: await recordRuleOccurrenceVoid(encounterWriteTransaction(ctx), input.voidCommand)
  }
}
