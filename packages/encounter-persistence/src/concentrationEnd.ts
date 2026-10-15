import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ConcentrationEndReason } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { listActiveGrantListings } from '@artificer-toolkit/rules-runtime/activeGrantListings'
import { isEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { grantEndNoticeId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { encounterConcentrationEndReason } from '@artificer-toolkit/rules-runtime/encounterConcentrationEnd'
import {
  grantsEndedByHolderState,
  stateBoundGrants
} from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { readEncounterCharacterPlay } from './characterPlay.js'
import { isDepartedCharacterActor, readDeadCharacterIds } from './characterStates.js'
import { deleteGrants } from './consumedGrantPersistence.js'
import { createActiveRuleEffectStore, listActiveRuleEffects } from './effectStore.js'
import type { EncounterPersistenceTransaction, EncounterWritePorts } from './ports.js'
import { readRuleRollRouting } from './ruleRollCards.js'

/**
 * What the committed state says about the actor's involuntary ends, so a stale or invented end is
 * rejected by comparison. `reason` is why its Concentration ends without a check (D95): a defeated
 * Creature or custom actor, one whose System actor-action capability is unavailable, or one under a
 * `SPELLCASTING_LOCK` grant; null when none holds. `conditionIds` are the condition types it has,
 * which end the grants that name them; a defeated actor's are not read.
 */
export async function readHolderEndState(
  ctx: EncounterPersistenceTransaction,
  input: { state: EncounterRunState; actor: EncounterRunActorState; userId: string }
): Promise<{
  reason: Awaited<ReturnType<typeof encounterConcentrationEndReason>>
  conditionIds: string[]
}> {
  const { state, actor } = input
  const deadCharacterIds = await readDeadCharacterIds(ctx, [actor])
  if (isEncounterActorDefeated(actor, deadCharacterIds))
    return { reason: 'DEFEATED', conditionIds: [] }
  const { campaign } = await ctx.ports.requireCampaignAuthority(state.campaignId, input.userId)
  let conditionIds: string[]
  let activeEffects
  if (actor.kind === 'CHARACTER') {
    const play = await readEncounterCharacterPlay(ctx, actor.sourceId)
    if (!play) throw new Error('Encounter Character source is unavailable.')
    const campaignConditions = (await isDepartedCharacterActor(ctx, state.campaignId, actor))
      ? []
      : await ctx.ports.readCampaignCharacterConditions(campaign, actor.sourceId)
    conditionIds = [
      ...new Set(
        [...(ctx.ports.readCharacterPlay(play).conditions ?? []), ...campaignConditions].map(
          (condition) => condition.conditionTypeId
        )
      )
    ]
    activeEffects = await listActiveRuleEffects(
      ctx,
      { kind: 'CHARACTER', characterId: actor.sourceId },
      { ownerVerified: true }
    )
  } else {
    conditionIds = readEncounterActorConditionState(actor.conditions ?? []).ids
    activeEffects = await listActiveRuleEffects(ctx, {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: state.id,
      targetActorId: actor.id
    })
  }
  const reason = await encounterConcentrationEndReason({
    actor,
    deadCharacterIds,
    conditionIds,
    activeEffects,
    gameSystemId: state.gameSystemId,
    definitions: {
      requireCurrent: async (definitionId) => {
        const current = await ctx.ports.readCurrentDefinition(definitionId, campaign.ownerUserId)
        if (!current) throw new Error('Concentration capability definition is unavailable.')
        return current
      }
    }
  })
  return { reason, conditionIds }
}

function concentrationEndMessage(label: string, reason: ConcentrationEndReason) {
  switch (reason) {
    case 'CHOSEN':
      return `${label} ends Concentration.`
    case 'DEFEATED':
      return `${label} is defeated and loses Concentration.`
    case 'INCAPACITATED':
      return `${label} can't act and loses Concentration.`
    case 'SPELLCASTING_LOCKED':
      return `${label} can't cast spells and loses Concentration.`
  }
}

/**
 * Tells the table what ended without a check or a roll. The entries route like the actor's
 * Concentration check card: a hidden or private GM actor's end posts nothing (there are no dice
 * to retain). Each entry's nonce is keyed by the occurrence that ended it, so a replay adds nothing.
 */
async function postEndMessages(
  ctx: EncounterPersistenceTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'postRulesChatMessage'>
  },
  input: {
    state: EncounterRunState
    actor: EncounterRunActorState
    userId: string
    messages: readonly { clientNonce: string; body: string }[]
  }
) {
  if (!input.messages.length) return
  const { campaign } = await ctx.ports.requireCampaignAuthority(
    input.state.campaignId,
    input.userId
  )
  const { audience, authorUserId } = await readRuleRollRouting(ctx, {
    campaign,
    roller: input.actor,
    initiatorUserId: input.userId,
    visibility: undefined
  })
  if (audience === 'PRIVATE') return
  const authority = await ctx.ports.requireCampaignAuthority(campaign.id, authorUserId)
  for (const message of input.messages)
    await ctx.ports.postRulesChatMessage(authority, { authorUserId, ...message })
}

/** Tells the table a Concentration ended without a check. The end occurrence keys the entry. */
export function postConcentrationEndMessage(
  ctx: Parameters<typeof postEndMessages>[0],
  input: {
    state: EncounterRunState
    actor: EncounterRunActorState
    reason: ConcentrationEndReason
    occurrenceId: string
    userId: string
  }
) {
  return postEndMessages(ctx, {
    state: input.state,
    actor: input.actor,
    userId: input.userId,
    messages: [
      {
        clientNonce: input.occurrenceId,
        body: concentrationEndMessage(input.actor.label, input.reason)
      }
    ]
  })
}

/**
 * Tells the table which grants a holder's state ended (Rage ends when its holder is knocked
 * unconscious), one entry per grant keyed by the occurrence that ended it. A grant whose source is
 * hidden from players is not named.
 */
export function postGrantEndMessages(
  ctx: Parameters<typeof postEndMessages>[0],
  input: {
    state: EncounterRunState
    actor: EncounterRunActorState
    grants: readonly ActiveRuleEffectRecord[]
    occurrenceId: string
    userId: string
  }
) {
  return postEndMessages(ctx, {
    state: input.state,
    actor: input.actor,
    userId: input.userId,
    messages: input.grants.flatMap((grant) =>
      listActiveGrantListings([grant]).flatMap(({ label, sourceHidden }) =>
        sourceHidden
          ? []
          : [
              {
                clientNonce: grantEndNoticeId(input.occurrenceId, grant.id),
                body: `${label} ends for ${input.actor.label}.`
              }
            ]
      )
    )
  })
}

/**
 * Ends the holder's grants its committed state ends (D95) and tells the table, for a commit that
 * can damage a holder without planning the end (a movement pass). A holder bound to no such grant
 * costs no read of its state.
 */
export async function endHolderStateGrants(
  ctx: Parameters<typeof postEndMessages>[0],
  input: {
    state: EncounterRunState
    actor: EncounterRunActorState
    occurrenceId: string
    userId: string
  }
) {
  const stateBound = stateBoundGrants(
    await createActiveRuleEffectStore(ctx).list(turnEffectOwner(input.actor, input.state.id))
  )
  if (!stateBound.length) return
  const grants = grantsEndedByHolderState(stateBound, await readHolderEndState(ctx, input))
  await deleteGrants(ctx, grants)
  await postGrantEndMessages(ctx, { ...input, grants })
}
