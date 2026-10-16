import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { describe, expect, it } from 'vitest'

import { evaluateEncounterActionEconomy } from '../encounterActionEconomy.js'
import { withEncounterRuleUsageUsed } from '../encounterActorState.js'
import { srdDefinitions, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { copperSlowingEffect } from './antitoxinEffectFixture.js'
import { creatureActor, creatureEncounter } from './encounterCreatureAction.js'

/**
 * SPELLS-19.T3d: a grant that makes the Action and Bonus Action exclusive (Slowing Breath: "can
 * take either an action or a bonus action on its turn, not both") is read by the action economy
 * for any holder.
 */

const HOLDER_ID = testUuid(0xd30)

function holderEvaluating(input: {
  activation: 'ACTION' | 'BONUS_ACTION'
  actionsUsed: number
  bonusActionsUsed: number
  slowed: boolean
}) {
  const base = creatureActor({ id: HOLDER_ID, label: 'Holder', features: [] })
  const actor = encounterRunActorStateSchema.parse({
    ...base,
    resources: withEncounterRuleUsageUsed(
      { ...base, resources: withEncounterRuleUsageUsed(base, SRD_ACTION_ALLOWANCE_DEFINITION_ID, input.actionsUsed) },
      SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
      input.bonusActionsUsed
    )
  })
  const { state, movementTargets } = creatureEncounter([actor])
  const target = movementTargets.get(actor.id)
  if (!target) throw new Error('The Encounter has no target.')
  const activeEffects = input.slowed
    ? [copperSlowingEffect({ id: testUuid(0xd31), holderActorId: actor.id })]
    : []
  return evaluateEncounterActionEconomy({
    actor,
    state,
    activation: { code: input.activation, amount: 1 },
    target: { ...target, activeEffects },
    loadTarget: async () => target,
    definitions: srdDefinitions
  })
}

describe('Action and Bonus Action exclusivity grant', () => {
  it('allows the Bonus Action after an Action without the grant', async () => {
    await expect(
      holderEvaluating({ activation: 'BONUS_ACTION', actionsUsed: 1, bonusActionsUsed: 0, slowed: false })
    ).resolves.toMatchObject({ available: true })
  })

  it('refuses the Bonus Action once the Action is spent', async () => {
    await expect(
      holderEvaluating({ activation: 'BONUS_ACTION', actionsUsed: 1, bonusActionsUsed: 0, slowed: true })
    ).resolves.toMatchObject({ available: false })
  })

  it('refuses the Action once the Bonus Action is spent', async () => {
    await expect(
      holderEvaluating({ activation: 'ACTION', actionsUsed: 0, bonusActionsUsed: 1, slowed: true })
    ).resolves.toMatchObject({ available: false })
  })

  it('still allows the first of either', async () => {
    for (const activation of ['ACTION', 'BONUS_ACTION'] as const)
      await expect(
        holderEvaluating({ activation, actionsUsed: 0, bonusActionsUsed: 0, slowed: true })
      ).resolves.toMatchObject({ available: true })
  })
})
