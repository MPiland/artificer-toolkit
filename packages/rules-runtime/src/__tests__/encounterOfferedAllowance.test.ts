import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  SRD_FREE_REACTION_ALLOWANCE_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { describe, expect, it } from 'vitest'

import { evaluateEncounterActionEconomy } from '../encounterActionEconomy.js'
import {
  consumeEncounterActionEconomy,
  encounterActionEconomyUsed,
  withEncounterActionEconomyUsed
} from '../encounterActionEconomyConsumption.js'
import { withEncounterRuleUsageUsed } from '../encounterActorState.js'
import { srdDefinitions, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { creatureActor, creatureEncounter } from './encounterCreatureAction.js'

/**
 * QUALITY-18.T2b1: a reaction whose option was offered under an allowance of its own spends that
 * allowance, by that allowance's own maximum and refresh, whatever its activation binds to.
 */

const REACTOR_ID = testUuid(0xe40)

/** A reactor whose reaction is already spent this round. */
function spentReactor() {
  const base = creatureActor({ id: REACTOR_ID, label: 'Reactor', features: [] })
  return encounterRunActorStateSchema.parse({
    ...base,
    resources: withEncounterRuleUsageUsed(base, SRD_REACTION_ALLOWANCE_DEFINITION_ID, 1)
  })
}

async function evaluating(
  actor: ReturnType<typeof spentReactor>,
  input: { offeredAllowanceDefinitionId?: string; turnSequence?: number }
) {
  const { state, movementTargets } = creatureEncounter([actor])
  const target = movementTargets.get(actor.id)
  if (!target) throw new Error('The Encounter has no target.')
  const evaluated = await evaluateEncounterActionEconomy({
    actor,
    state: { ...state, turnSequence: input.turnSequence ?? state.turnSequence },
    activation: { code: 'REACTION', amount: 1 },
    target,
    loadTarget: async () => target,
    definitions: srdDefinitions,
    offeredAllowanceDefinitionId: input.offeredAllowanceDefinitionId
  })
  if (!evaluated) throw new Error('The Encounter tracks no action economy.')
  return evaluated
}

describe('the allowance a reaction’s option was offered under', () => {
  it('is spent in place of the reaction the activation binds to, on the turn it is spent', async () => {
    const actor = spentReactor()
    await expect(evaluating(actor, {})).resolves.toMatchObject({
      available: false,
      consumption: { definitionId: SRD_REACTION_ALLOWANCE_DEFINITION_ID, beforeUsed: 1 }
    })
    const offered = await evaluating(actor, {
      offeredAllowanceDefinitionId: SRD_FREE_REACTION_ALLOWANCE_DEFINITION_ID,
      turnSequence: 4
    })
    expect(offered).toMatchObject({
      available: true,
      consumption: {
        definitionId: SRD_FREE_REACTION_ALLOWANCE_DEFINITION_ID,
        maximum: 1,
        beforeUsed: 0,
        afterUsed: 1,
        turnSequence: 4
      }
    })
  })

  it('is used up for the turn that spent it, and unspent again on the next', async () => {
    const actor = spentReactor()
    const offer = { offeredAllowanceDefinitionId: SRD_FREE_REACTION_ALLOWANCE_DEFINITION_ID }
    const { consumption } = await evaluating(actor, { ...offer, turnSequence: 4 })
    const spent = consumeEncounterActionEconomy({ actor, consumption, overridden: false })
    // The reaction itself is untouched: the free allowance is kept with its turn.
    expect(spent.resources).toEqual({
      ...actor.resources,
      turnUsage: {
        [SRD_FREE_REACTION_ALLOWANCE_DEFINITION_ID]: { turnSequence: 4, used: 1 }
      }
    })
    await expect(evaluating(spent, { ...offer, turnSequence: 4 })).resolves.toMatchObject({
      available: false,
      consumption: { beforeUsed: 1 }
    })
    await expect(evaluating(spent, { ...offer, turnSequence: 5 })).resolves.toMatchObject({
      available: true,
      consumption: { beforeUsed: 0, turnSequence: 5 }
    })
  })

  it('reads and returns its use on the turn that spent it, leaving the prior row', async () => {
    const actor = spentReactor()
    const { consumption } = await evaluating(actor, {
      offeredAllowanceDefinitionId: SRD_FREE_REACTION_ALLOWANCE_DEFINITION_ID,
      turnSequence: 4
    })
    const spent = consumeEncounterActionEconomy({ actor, consumption, overridden: false })
    expect(encounterActionEconomyUsed(spent, consumption)).toBe(1)
    expect(withEncounterActionEconomyUsed(spent, consumption, consumption.beforeUsed)).toEqual(
      actor.resources
    )
    // A second settle of the same plan finds the allowance already used.
    expect(() =>
      consumeEncounterActionEconomy({ actor: spent, consumption, overridden: false })
    ).toThrow('The selected action allowance changed before settlement.')
  })

  it('keeps an offered allowance that refreshes at turn start in the rule usage record', async () => {
    const offered = await evaluating(spentReactor(), {
      offeredAllowanceDefinitionId: SRD_REACTION_ALLOWANCE_DEFINITION_ID,
      turnSequence: 4
    })
    expect(offered).toMatchObject({
      available: false,
      consumption: { definitionId: SRD_REACTION_ALLOWANCE_DEFINITION_ID, beforeUsed: 1 }
    })
    expect(offered.consumption).not.toHaveProperty('turnSequence')
  })
})
