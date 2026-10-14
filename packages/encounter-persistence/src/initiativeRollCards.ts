import {
  initiativeRollExpression,
  initiativeRollRecord,
  ruleCheckRollId
} from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { readAppCardedDice, turnSystemRollAnswers } from './appCardedDice.js'
import { LOGGED_DICE } from './evidenceRolls.js'
import type { CampaignAuthority, EncounterReadTransaction, EncounterWritePorts } from './ports.js'
import { recordRuleRollCard } from './ruleRollCards.js'

/**
 * Posts the Initiative card of every die a declared-action initiative settled, as a GM-rolled
 * initiative does, in declaration order. A die the app rolled for its member already has its
 * "Rolled by the app" attempt card, so only an auto-rolled or entered die is carded here. A flat
 * score rolled no die and has no card; a result that settled several dice, or a die that is not a
 * logged `1dN`, throws rather than posting nothing.
 */
export async function persistEncounterInitiativeRollCards(
  ctx: EncounterReadTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainGmRoll'>
  },
  input: {
    state: EncounterRunState
    campaign: CampaignAuthority['campaign']
    actors: readonly EncounterRunActorState[]
    root: TurnCoordinatorRootDto
    occurrenceId: string
    occurredAt: string
  }
): Promise<void> {
  const { state, root, occurrenceId } = input
  const settlement = root.initiative
  if (settlement?.procedure !== 'DECLARED_ACTION_ROLL') return
  const rolls = settlement.evidence.primaryResults.flatMap(({ entity, result }) => {
    if (entity.kind !== 'ACTOR' || result.kind !== 'GRAPH_COMPLETE' || !result.execution.automatic)
      return []
    const dice = result.execution.execution.evidence.trace.flatMap((entry) =>
      entry.evidence ? [{ entry, evidence: entry.evidence }] : []
    )
    const [die, ...others] = dice
    // A flat score rolled no die, so there is no card to post.
    if (!die) return []
    // The settlement records neither a roll mode nor how several dice combined into the score
    // (ENCOUNTER-10 adds advantage and disadvantage to the declared graph), so a card for more
    // than one die would show a total the dice do not explain.
    if (others.length > 0)
      throw new Error('A declared initiative that settled more than one die has no roll card.')
    const sides = die.entry.inputs.max
    if (die.entry.inputs.min !== 1 || typeof sides !== 'number' || !LOGGED_DICE.has(sides))
      throw new Error('A declared initiative die must be a logged 1dN to post its roll card.')
    return [
      {
        actorId: entity.id,
        sides,
        modifier: result.execution.score - die.evidence.value,
        settled: { requestId: die.evidence.requestId, value: die.evidence.value }
      }
    ]
  })
  const appCarded = await readAppCardedDice(ctx, {
    occurrenceId,
    answers: turnSystemRollAnswers(root.resolutionCommands, 'INITIATIVE_SYSTEM_ROLL'),
    dice: rolls.map(({ settled }) => settled)
  })
  const system = await ctx.ports.requireSystem(state.gameSystemId)
  for (const [index, { actorId, sides, modifier, settled }] of rolls.entries()) {
    if (appCarded.has(index)) continue
    const actor = input.actors.find((candidate) => candidate.id === actorId)
    if (!actor) throw new Error('Live Session initiative roller is unavailable.')
    const roll = initiativeRollRecord({
      id: ruleCheckRollId(`${occurrenceId}:initiative:${actorId}`, 0),
      expression: initiativeRollExpression(sides, modifier),
      rollMode: 'NORMAL',
      nextInt: () => settled.value - 1,
      characterId: actor.kind === 'CHARACTER' ? actor.sourceId : null,
      rollerLabel: actor.label,
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      createdAt: input.occurredAt
    })
    await recordRuleRollCard(ctx, {
      campaign: input.campaign,
      encounterId: state.id,
      roller: actor,
      initiatorUserId: root.initiatorUserId,
      visibility: undefined,
      clientNonce: roll.id,
      roll
    })
  }
}
