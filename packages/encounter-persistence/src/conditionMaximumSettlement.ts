import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import {
  characterHitPointMaximumFraction,
  creatureHitPointMaximumFraction
} from '@artificer-toolkit/rules-runtime/conditionHitPointMaximum'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { HitPointMaximumFractionDto } from '@artificer-toolkit/schema/shared/hitPointMaximumFraction'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterState } from '@artificer-toolkit/shared/subjects/authored'
import { readRunState } from './documents.js'
import { listActiveRuleEffects } from './effectStore.js'
import type { EncounterReadPorts } from './ports.js'
import type { EncounterReadContext } from './store.js'

type SettlementContext = EncounterReadContext & {
  readonly ports: Pick<EncounterReadPorts, 'readCurrentDefinition'>
}

const sameFraction = (
  left: HitPointMaximumFractionDto | null | undefined,
  right: HitPointMaximumFractionDto | null | undefined
) =>
  (left?.numerator ?? 0) === (right?.numerator ?? 0) &&
  (left?.denominator ?? 0) === (right?.denominator ?? 0)

/** Conditions compare by content; an absent list is an empty one. */
const sameConditions = (left: unknown, right: unknown) =>
  JSON.stringify(left ?? []) === JSON.stringify(right ?? [])

/**
 * The one resolve-and-clamp every writer of a holder's conditions goes through (SPELLS-10.T1b): it
 * stores the share of its maximum the conditions leave and holds current hit points within it. A
 * holder whose conditions did not change is returned as it was, so the common write reads nothing.
 * `conditionMaximumWriters.test.ts` fails a writer that skips it.
 */
export async function settleCreatureConditionMaximum(
  ctx: SettlementContext,
  input: {
    before: EncounterRunActorState
    actor: EncounterRunActorState
    ownerUserId: string
    gameSystemId: string
  }
): Promise<EncounterRunActorState> {
  const { before, actor } = input
  if (actor.kind === 'CHARACTER' || before.kind === 'CHARACTER') return actor
  if (sameConditions(before.conditions, actor.conditions)) return actor
  const fraction = await creatureHitPointMaximumFraction({
    conditionRows: actor.conditions ?? [],
    gameSystemId: input.gameSystemId,
    readCurrentDefinition: (definitionId) =>
      ctx.ports.readCurrentDefinition(definitionId, input.ownerUserId)
  })
  const maximum = effectiveHitPointMaximum(
    actor.maxHitPoints,
    await listActiveRuleEffects(ctx, turnEffectOwner(actor, actor.encounterId), {
      ownerVerified: true
    }),
    fraction
  )
  const currentHitPoints = Math.min(actor.currentHitPoints, maximum)
  if (currentHitPoints === actor.currentHitPoints && sameFraction(fraction, actor.maximumFraction))
    return actor
  return { ...actor, maximumFraction: fraction ?? undefined, currentHitPoints }
}

/** The Character-state counterpart of `settleCreatureConditionMaximum`, over the Sheet's own state. */
export async function settleCharacterConditionMaximum(
  ctx: SettlementContext,
  input: {
    characterId: string
    systemId: string
    before: CharacterState
    state: CharacterState
    /** The stored maximum before active effects and the fraction. */
    maximumHitPoints: number
    ownerUserId: string
  }
): Promise<CharacterState> {
  const { before, state } = input
  if (
    sameConditions(before.conditions, state.conditions) &&
    (before.exhaustion?.level ?? 0) === (state.exhaustion?.level ?? 0)
  )
    return state
  const fraction = await characterHitPointMaximumFraction({
    character: { systemId: input.systemId, state },
    readCurrentDefinition: (definitionId) =>
      ctx.ports.readCurrentDefinition(definitionId, input.ownerUserId)
  })
  const maximum = effectiveHitPointMaximum(
    input.maximumHitPoints,
    await listActiveRuleEffects(
      ctx,
      { kind: 'CHARACTER', characterId: input.characterId },
      { ownerVerified: true }
    ),
    fraction
  )
  const current = Math.min(state.hitpoints.current, maximum)
  if (
    current === state.hitpoints.current &&
    sameFraction(fraction, state.hitpoints.maximumFraction)
  )
    return state
  return {
    ...state,
    hitpoints: { ...state.hitpoints, maximumFraction: fraction ?? undefined, current }
  }
}

/** The Campaign owner whose reading of a condition's definition a Run's settlement uses. */
export async function readRunCampaignOwnerUserId(ctx: EncounterReadContext, encounterId: string) {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', readRunState(run).campaignId))
    .unique()
  if (!campaign) throw new Error('Campaign is unavailable.')
  return campaign.ownerUserId
}
