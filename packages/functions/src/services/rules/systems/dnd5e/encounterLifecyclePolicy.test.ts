import { describe, expect, it } from 'vitest'
import {
  DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
  DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID
} from '@artificer-toolkit/schema/shared/encounterLifecycle'

import { createDnd5eCharacterActionRuntime } from './characterActionRuntime.js'
import {
  createDnd5eLegendaryActionEligibilityDefinition,
  createDnd5eLegendaryActionLifecycleDefinition,
  createDnd5eLegendaryResistanceChoiceDefinition,
  createDnd5eLegendaryResistanceLifecycleDefinition,
  createDnd5eRechargeDefinition,
  createDnd5eRechargeLifecycleDefinition,
  DND5E_LEGENDARY_OUTGOING_ACTOR_DIFFERS_FACT_KEY,
  DND5E_LEGENDARY_OWNER_CAN_ACT_FACT_KEY,
  DND5E_LEGENDARY_REMAINING_POOL_FACT_KEY,
  DND5E_LEGENDARY_WINDOW_USED_FACT_KEY
} from './encounterLifecyclePolicy.js'

const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000000f1'

function runtime(
  ...definitions: ReturnType<typeof createDnd5eLegendaryActionEligibilityDefinition>[]
) {
  const currents = new Map(definitions.map((definition) => [definition.id, definition]))
  return createDnd5eCharacterActionRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(7),
    definitions: {
      async requireCurrent(definitionId) {
        const current = currents.get(definitionId)
        if (!current) throw new Error('Definition not found.')
        return current
      }
    }
  })
}

async function resumeBoolean(input: {
  runtime: ReturnType<typeof runtime>
  definition: ReturnType<typeof createDnd5eLegendaryResistanceChoiceDefinition>
  occurrenceId: string
  response: number
  output: 'use' | 'recharged'
}) {
  const pending = await input.runtime.execute({
    definitionId: input.definition.id,
    occurrenceId: input.occurrenceId,
    facts: {}
  })
  if (pending.status !== 'PAUSED') throw new Error('Expected bounded evidence request.')
  const settled = await input.runtime.resume({
    continuation: pending.continuation,
    response: { requestId: pending.continuation.request.requestId, value: input.response }
  })
  if (settled.status !== 'COMPLETE') throw new Error('Expected settled evidence request.')
  return settled.outputs[input.output]
}

describe('D&D encounter lifecycle policy', () => {
  it('uses only Feature-owned resource facts for legendary-action eligibility', async () => {
    const definition = createDnd5eLegendaryActionEligibilityDefinition()
    const actionRuntime = runtime(definition)
    const facts = {
      [DND5E_LEGENDARY_OUTGOING_ACTOR_DIFFERS_FACT_KEY]: true,
      [DND5E_LEGENDARY_OWNER_CAN_ACT_FACT_KEY]: true,
      [DND5E_LEGENDARY_REMAINING_POOL_FACT_KEY]: 1,
      [DND5E_LEGENDARY_WINDOW_USED_FACT_KEY]: false
    }
    await expect(
      actionRuntime.execute({ definitionId: definition.id, occurrenceId: OCCURRENCE_ID, facts })
    ).resolves.toMatchObject({ status: 'COMPLETE', outputs: { eligible: true } })

    for (const override of [
      { [DND5E_LEGENDARY_OUTGOING_ACTOR_DIFFERS_FACT_KEY]: false },
      { [DND5E_LEGENDARY_OWNER_CAN_ACT_FACT_KEY]: false },
      { [DND5E_LEGENDARY_REMAINING_POOL_FACT_KEY]: 0 },
      { [DND5E_LEGENDARY_WINDOW_USED_FACT_KEY]: true }
    ]) {
      await expect(
        actionRuntime.execute({
          definitionId: definition.id,
          occurrenceId: `${OCCURRENCE_ID.slice(0, -1)}${Object.values(override)[0] ? '2' : '3'}`,
          facts: { ...facts, ...override }
        })
      ).resolves.toMatchObject({ status: 'COMPLETE', outputs: { eligible: false } })
    }
    expect(createDnd5eLegendaryActionLifecycleDefinition()).toMatchObject({
      id: DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
      kind: 'LEGENDARY_ACTION',
      eligibilityGraph: { definitionId: definition.id, eligibleOutput: 'eligible' },
      resourceRecovery: 'FULL'
    })
  })

  it('makes legendary resistance a bounded decline-or-use decision', async () => {
    const definition = createDnd5eLegendaryResistanceChoiceDefinition()
    const actionRuntime = runtime(definition)
    await expect(
      resumeBoolean({
        runtime: actionRuntime,
        definition,
        occurrenceId: OCCURRENCE_ID,
        response: 0,
        output: 'use'
      })
    ).resolves.toBe(false)
    await expect(
      resumeBoolean({
        runtime: actionRuntime,
        definition,
        occurrenceId: '00000000-0000-4000-8000-0000000000f2',
        response: 1,
        output: 'use'
      })
    ).resolves.toBe(true)
    expect(createDnd5eLegendaryResistanceLifecycleDefinition()).toMatchObject({
      id: DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
      kind: 'LEGENDARY_RESISTANCE',
      choiceGraph: { definitionId: definition.id, useOutput: 'use' }
    })
  })

  it.each([4, 5, 6] as const)(
    'uses the exact %i recharge threshold boundary',
    async (threshold) => {
      const definition = createDnd5eRechargeDefinition(threshold)
      const actionRuntime = runtime(definition)
      await expect(
        resumeBoolean({
          runtime: actionRuntime,
          definition,
          occurrenceId: OCCURRENCE_ID,
          response: threshold - 1,
          output: 'recharged'
        })
      ).resolves.toBe(false)
      await expect(
        resumeBoolean({
          runtime: actionRuntime,
          definition,
          occurrenceId: `00000000-0000-4000-8000-0000000000f${threshold}`,
          response: threshold,
          output: 'recharged'
        })
      ).resolves.toBe(true)
      expect(createDnd5eRechargeLifecycleDefinition(threshold)).toMatchObject({
        id:
          threshold === 4
            ? DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID
            : threshold === 5
              ? DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID
              : DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID,
        kind: 'RECHARGE',
        rechargeGraph: { definitionId: definition.id, rechargedOutput: 'recharged' }
      })
    }
  )
})
