import { initiativeRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
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
 * "Rolled by the app" attempt card, so only an auto-rolled or entered die is carded here. A result
 * that did not settle on exactly one loggable die has none to show.
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
    const sides = die?.entry.inputs.max
    if (
      !die ||
      others.length > 0 ||
      die.entry.inputs.min !== 1 ||
      typeof sides !== 'number' ||
      !LOGGED_DICE.has(sides)
    )
      return []
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
      occurrenceId: `${occurrenceId}:initiative:${actorId}`,
      sides,
      rawDie: settled.value,
      modifier,
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
