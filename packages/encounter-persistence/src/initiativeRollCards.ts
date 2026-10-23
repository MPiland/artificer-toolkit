import {
  initiativeRollExpression,
  initiativeRollRecord,
  ruleCheckRollId
} from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import { initiativeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import { rollModeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { keepOneOfTwoRuleOperation } from '@artificer-toolkit/shared/rules'
import { readAppCardedDice, turnSystemRollAnswers } from './appCardedDice.js'
import { LOGGED_DICE } from './evidenceRolls.js'
import type { CampaignAuthority, EncounterReadTransaction, EncounterWritePorts } from './ports.js'
import { recordRuleRollCard } from './ruleRollCards.js'

/**
 * Posts one Initiative card per declared actor that settled dice, as a GM-rolled initiative does,
 * in declaration order. Advantage or disadvantage settled two `1d20` faces and the graph's
 * keep-one-of-two node chose the kept one, so the card replays both faces under that mode. A die
 * the app rolled for its member already has its "Rolled by the app" attempt card, so an actor whose
 * every die the app carded is skipped. A flat score rolled no die and has no card; a result that
 * settled more than two dice, two dice that are not one mode's pair, or a die that is not a logged
 * `1dN` throws rather than posting nothing.
 */
export async function persistEncounterInitiativeRollCards(
  ctx: EncounterReadTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
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
  const initiative = initiativeCapabilityRegistry.require(state.gameSystemId)
  const rolls = settlement.evidence.primaryResults.flatMap(({ entity, result }) => {
    if (entity.kind !== 'ACTOR' || result.kind !== 'GRAPH_COMPLETE' || !result.execution.automatic)
      return []
    const { trace, facts } = result.execution.execution.evidence
    const dice = trace.flatMap((entry) =>
      entry.evidence ? [{ entry, evidence: entry.evidence }] : []
    )
    // A flat score rolled no die, so there is no card to post.
    if (dice.length === 0) return []
    if (dice.length > 2)
      throw new Error('A declared initiative that settled more than two dice has no roll card.')
    const sides = dice[0]?.entry.inputs.max
    if (
      typeof sides !== 'number' ||
      !LOGGED_DICE.has(sides) ||
      dice.some(({ entry }) => entry.inputs.min !== 1 || entry.inputs.max !== sides)
    )
      throw new Error('A declared initiative die must be a logged 1dN to post its roll card.')
    const rollMode =
      dice.length === 2 ? (initiative.declaredRollMode(facts) ?? undefined) : undefined
    if (dice.length === 2) {
      if (!rollMode)
        throw new Error(
          'A declared initiative roll mode must keep the first, higher or lower face.'
        )
      if (
        rollModeCapabilityRegistry.rollModeKeep({
          gameSystemId: state.gameSystemId,
          rollMode
        }) === 'FIRST'
      )
        throw new Error(
          'A declared initiative that settled two dice needs a roll mode that keeps the higher or lower face.'
        )
    }
    const keptValue =
      dice.length === 1
        ? dice[0]?.evidence.value
        : trace.find((entry) => entry.operation.key === keepOneOfTwoRuleOperation.key)?.outputs
            .value
    if (typeof keptValue !== 'number')
      throw new Error('A declared initiative with two dice must record the face it kept.')
    return [
      {
        actorId: entity.id,
        sides,
        rollMode,
        modifier: result.execution.score - keptValue,
        settled: dice.map(({ evidence }) => ({
          requestId: evidence.requestId,
          value: evidence.value
        }))
      }
    ]
  })
  const appCarded = await readAppCardedDice(ctx, {
    occurrenceId,
    answers: turnSystemRollAnswers(root.resolutionCommands, 'INITIATIVE_SYSTEM_ROLL'),
    dice: rolls.flatMap(({ settled }) => settled)
  })
  const system = await ctx.ports.requireSystem(state.gameSystemId)
  let firstDie = 0
  for (const { actorId, sides, rollMode, modifier, settled } of rolls) {
    const cardedDice = settled.filter((_, offset) => appCarded.has(firstDie + offset)).length
    firstDie += settled.length
    if (cardedDice === settled.length) continue
    const actor = input.actors.find((candidate) => candidate.id === actorId)
    if (!actor) throw new Error('Live Session initiative roller is unavailable.')
    const faces = settled.map(({ value }) => value)
    const roll = initiativeRollRecord({
      id: ruleCheckRollId(`${occurrenceId}:initiative:${actorId}`, 0),
      expression: initiativeRollExpression(sides, modifier),
      rollMode,
      nextInt: () => {
        const face = faces.shift()
        if (face === undefined)
          throw new Error('Initiative card asked for more faces than settled.')
        return face - 1
      },
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
