import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { requireCampaignAuthority } from '../campaigns/authority'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { requireIdentity } from '../lib/identity'
import { listActiveRuleEffects } from '../rules/effectStore'
import { readRunActor, readRunActors, readRunState } from './documents'
import {
  buildMovementTarget,
  type MovementTarget as RuntimeMovementTarget
} from '@artificer-toolkit/rules-runtime/encounterMovementTargets'

export {
  buildMovementTarget,
  nativeCharacterMaximumHitPoints
} from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
export type MovementTarget = RuntimeMovementTarget<
  NonNullable<Awaited<ReturnType<typeof loadCharacterSheetFacts>>>
>

/** Loads current, authorized movement targets without advancing any Encounter state. */
export async function loadMovementTargets(
  ctx: QueryCtx,
  input: {
    encounterId: string
    expectedEncounterVersion: number
    targetActorIds: readonly string[]
    includeReactionSources?: boolean
  },
  /** Freshly validated by the caller in this transaction, before any writes. */
  currentRead?: {
    ctx: QueryCtx
    state: ReturnType<typeof readRunState>
    campaign: Doc<'campaigns'>
  }
): Promise<ReadonlyMap<string, MovementTarget>> {
  const encounterId = serverUuidIdentityDtoSchema.parse(input.encounterId)
  const targetActorIds = input.targetActorIds.map((id) => serverUuidIdentityDtoSchema.parse(id))
  if (
    !Number.isSafeInteger(input.expectedEncounterVersion) ||
    input.expectedEncounterVersion < 0 ||
    new Set(targetActorIds).size !== targetActorIds.length
  )
    throw new Error('Movement target input is invalid.')
  let state: ReturnType<typeof readRunState>
  let campaign: Doc<'campaigns'>
  if (currentRead) {
    if (currentRead.ctx !== ctx)
      throw new Error('Movement target read context belongs to another transaction.')
    state = currentRead.state
    campaign = currentRead.campaign
    if (state.id !== encounterId || campaign.id !== state.campaignId)
      throw new Error('Movement target read context scope differs.')
  } else {
    const { userId } = await requireIdentity(ctx)
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', encounterId))
      .unique()
    if (!run) throw new Error('Encounter Run was not found.')
    state = readRunState(run)
    const authority = await requireCampaignAuthority(ctx, state.campaignId, userId)
    campaign = authority.campaign
  }
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign is stale.')
  if (state.version !== input.expectedEncounterVersion)
    throw new Error('Encounter version is stale.')
  if (targetActorIds.some((id) => !state.actorIds.includes(id)))
    throw new Error('Encounter actor was not found.')
  const currentActors =
    targetActorIds.length === state.actorIds.length
      ? await readRunActors(ctx, state)
      : await Promise.all(targetActorIds.map((id) => readRunActor(ctx, state, id)))
  const actorsById = new Map(currentActors.map((actor) => [actor.id, actor]))
  const actors = targetActorIds.map((id) => actorsById.get(id)!)
  const result = new Map<string, MovementTarget>()
  const characterIds = new Set<string>()
  for (const actor of actors) {
    if (actor.kind === 'CHARACTER') {
      if (!actor.sourceId || actor.sourceRevision === null || characterIds.has(actor.sourceId))
        throw new Error('Encounter Character target is stale.')
      characterIds.add(actor.sourceId)
      const loaded = await loadCharacterSheetFacts(
        ctx,
        campaign.ownerUserId,
        actor.sourceId,
        campaign.id
      )
      if (!loaded) throw new Error('Encounter Character state mirror is stale.')
      const activeEffects = await listActiveRuleEffects(ctx, {
        kind: 'CHARACTER',
        characterId: actor.sourceId
      })
      const target = buildMovementTarget<
        NonNullable<Awaited<ReturnType<typeof loadCharacterSheetFacts>>>
      >({
        actor,
        activeEffects,
        gameSystemId: state.gameSystemId,
        campaignId: campaign.id,
        characterFacts: loaded,
        includeReactionSources: input.includeReactionSources
      })
      result.set(actor.id, target)
      continue
    }
    const activeEffects = await listActiveRuleEffects(ctx, {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: state.id,
      targetActorId: actor.id
    })
    result.set(
      actor.id,
      buildMovementTarget<NonNullable<Awaited<ReturnType<typeof loadCharacterSheetFacts>>>>({
        actor,
        activeEffects,
        gameSystemId: state.gameSystemId,
        campaignId: campaign.id,
        characterFacts: null
      })
    )
  }
  return result
}
