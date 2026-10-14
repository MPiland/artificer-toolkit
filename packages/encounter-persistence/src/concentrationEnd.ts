import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { isEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { encounterConcentrationEndReason } from '@artificer-toolkit/rules-runtime/encounterConcentrationEnd'
import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { readEncounterCharacterPlay } from './characterPlay.js'
import { isDepartedCharacterActor, readDeadCharacterIds } from './characterStates.js'
import { listActiveRuleEffects } from './effectStore.js'
import type { EncounterPersistenceTransaction, EncounterWritePorts } from './ports.js'
import { readRuleRollRouting } from './ruleRollCards.js'

/** Why a Concentration ended: involuntarily (D95) or by its holder's choice (SPELLS-5.11). */
export type ConcentrationEndReason = 'INCAPACITATED' | 'DEFEATED' | 'SPELLCASTING_LOCKED' | 'CHOSEN'

/**
 * Why the committed state ends the actor's Concentration without a check (D95): a defeated
 * Creature or custom actor, one whose System actor-action capability is unavailable, or one under a
 * `SPELLCASTING_LOCK` grant. Null when none holds, so a stale or invented end is rejected by
 * comparison.
 */
export async function readConcentrationEndReason(
  ctx: EncounterPersistenceTransaction,
  input: { state: EncounterRunState; actor: EncounterRunActorState; userId: string }
): ReturnType<typeof encounterConcentrationEndReason> {
  const { state, actor } = input
  const deadCharacterIds = await readDeadCharacterIds(ctx, [actor])
  if (isEncounterActorDefeated(actor, deadCharacterIds)) return 'DEFEATED'
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
  return encounterConcentrationEndReason({
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
 * Tells the table a Concentration ended without a check. The entry routes like the actor's
 * Concentration check card: a hidden or private GM actor's end posts nothing (there are no dice
 * to retain). The end occurrence keys the entry, so a replay adds nothing.
 */
export async function postConcentrationEndMessage(
  ctx: EncounterPersistenceTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'postRulesChatMessage'>
  },
  input: {
    state: EncounterRunState
    actor: EncounterRunActorState
    reason: ConcentrationEndReason
    occurrenceId: string
    userId: string
  }
) {
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
  await ctx.ports.postRulesChatMessage(
    await ctx.ports.requireCampaignAuthority(campaign.id, authorUserId),
    {
      authorUserId,
      clientNonce: input.occurrenceId,
      body: concentrationEndMessage(input.actor.label, input.reason)
    }
  )
}
