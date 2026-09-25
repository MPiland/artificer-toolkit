import { buildEncounterMovementReactionFacts } from '@artificer-toolkit/rules-runtime/encounterMovementReactionFacts'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readDefinitionRoot } from '../content/definitionStore'
import { requireSystem } from '../content/systemDocuments'
import { requireIdentity } from '../lib/identity'
import { readRunProjection, readRunState } from './documents'
import { loadMovementTargets, type MovementTarget } from './movementTargets'
import { rejectDomain } from '../lib/domainRejections'

export async function loadNativeMovementReactionSources(
  ctx: MutationCtx,
  input: { encounterId: string; expectedEncounterVersion: number },
  movementTargets?: ReadonlyMap<string, MovementTarget>
) {
  const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
  const { userId } = await requireIdentity(ctx)
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', encounterId))
    .unique()
  if (!row) throw new Error('Encounter Run was not found.')
  const state = readRunState(row)
  readRunProjection(row)
  const { campaign } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign is stale.')
  if (state.version !== input.expectedEncounterVersion) rejectDomain('VERSION_STALE')
  if (state.status !== 'ACTIVE' || state.automationMode === 'MANUAL')
    throw new Error('Movement reactions require an active Assisted Encounter.')
  const targets =
    movementTargets ??
    (await loadMovementTargets(
      ctx,
      {
        encounterId,
        expectedEncounterVersion: state.version,
        targetActorIds: state.actorIds,
        includeReactionSources: true
      },
      { ctx, state, campaign }
    ))
  const system = await requireSystem(ctx, state.gameSystemId)
  const facts = buildEncounterMovementReactionFacts({
    userId,
    campaignOwnerUserId: campaign.ownerUserId,
    targets,
    state,
    system,
    definitions: {
      requireCurrent: async (definitionId: string) => {
        const definition = await readDefinitionRoot(ctx, definitionId, userId)
        if (!definition?.current) throw new Error('Movement reaction definition is unavailable.')
        return definition.current
      }
    }
  })
  if (!process.env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not configured.')
  return facts
}
