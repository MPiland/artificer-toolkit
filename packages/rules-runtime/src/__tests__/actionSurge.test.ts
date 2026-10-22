import { describe, expect, it } from 'vitest'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/ruleState.js'

import { evaluateEncounterActionEconomy } from '../encounterActionEconomy.js'
import { withEncounterRuleUsageUsed } from '../encounterActorState.js'
import { srdDefinitions, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { actionSurgeEffect } from './antitoxinEffectFixture.js'
import { creatureActor, creatureEncounter } from './encounterCreatureAction.js'

/**
 * ATTACK-9.3: Action Surge is an Action-count grant the Fighter's own Feature applies. The action
 * economy reads it as a higher Action maximum, so the second Action is an ordinary spend.
 */

const FIGHTER_ID = testUuid(0xa51)

function fighterEvaluating(input: {
  activation: 'ACTION' | 'BONUS_ACTION'
  actionsUsed: number
  surges: number
}) {
  const base = creatureActor({ id: FIGHTER_ID, label: 'Fighter', features: [] })
  const actor = encounterRunActorStateSchema.parse({
    ...base,
    resources: withEncounterRuleUsageUsed(
      base,
      SRD_ACTION_ALLOWANCE_DEFINITION_ID,
      input.actionsUsed
    )
  })
  const { state, movementTargets } = creatureEncounter([actor])
  const target = movementTargets.get(actor.id)
  if (!target) throw new Error('The Encounter has no target.')
  const activeEffects = Array.from({ length: input.surges }, (_, index) =>
    actionSurgeEffect({ id: testUuid(0xa60 + index), holderActorId: actor.id })
  )
  return evaluateEncounterActionEconomy({
    actor,
    state,
    activation: { code: input.activation, amount: 1 },
    target: { ...target, activeEffects },
    loadTarget: async () => target,
    definitions: srdDefinitions
  })
}

describe('Action Surge on the Action allowance (ATTACK-9.3)', () => {
  it('offers no second Action without a Surge', async () => {
    await expect(
      fighterEvaluating({ activation: 'ACTION', actionsUsed: 1, surges: 0 })
    ).resolves.toMatchObject({ available: false, consumption: { maximum: 1 } })
  })

  it('offers a second Action under a Surge, and records the raised maximum on the spend', async () => {
    await expect(
      fighterEvaluating({ activation: 'ACTION', actionsUsed: 1, surges: 1 })
    ).resolves.toMatchObject({
      available: true,
      consumption: {
        definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
        maximum: 2,
        beforeUsed: 1,
        afterUsed: 2
      }
    })
  })

  it('offers no third Action under a Surge', async () => {
    await expect(
      fighterEvaluating({ activation: 'ACTION', actionsUsed: 2, surges: 1 })
    ).resolves.toMatchObject({ available: false, consumption: { maximum: 2 } })
  })

  it('gives one extra Action however many Surges are active (a second Surge on one turn adds none)', async () => {
    await expect(
      fighterEvaluating({ activation: 'ACTION', actionsUsed: 2, surges: 2 })
    ).resolves.toMatchObject({ available: false, consumption: { maximum: 2 } })
  })

  it('leaves the bonus action allowance alone', async () => {
    await expect(
      fighterEvaluating({ activation: 'BONUS_ACTION', actionsUsed: 0, surges: 1 })
    ).resolves.toMatchObject({
      available: true,
      consumption: { definitionId: SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID, maximum: 1 }
    })
  })
})
