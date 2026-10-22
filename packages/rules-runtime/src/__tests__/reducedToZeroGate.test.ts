import { describe, expect, it } from 'vitest'

import { EFFECT_KIND } from '@artificer-toolkit/shared/core'
import type { OutcomeAuthored } from '@artificer-toolkit/shared/authored'

import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction,
  srdConditionId,
  srdDamageTypeId,
  type CreatureFeature
} from './encounterCreatureAction.js'

/**
 * SPELLS-33 T4i3a: a homebrew +5 ranged attack of 3 piercing damage, with a follow-up outcome in the
 * same result block that the REDUCED_TO_ZERO_BY gate holds back unless that damage took the target
 * to 0 hit points. Nothing here is specific to a feature: the gate is authored from core options.
 */

const ATTACKER_ID = testUuid(0xf1)
const TARGET_ID = testUuid(0xf2)
const QUILL_DAMAGE_OUTCOME_ID = '00000000-0000-4000-8000-00000000c007'
const FOLLOW_UP_OUTCOME_ID = '00000000-0000-4000-8000-00000000c0a1'
const PIERCING = srdDamageTypeId('PIERCING')

function gatedVolley(followUp: OutcomeAuthored, damageOutcomeId: string): CreatureFeature {
  const volley = structuredClone(quillVolley({ charges: 1, cost: 1, rangeFeet: 80 }))
  for (const effect of volley.effects ?? [])
    for (const path of 'paths' in effect ? effect.paths : [])
      if (path.selectionKind === 'FIXED') {
        path.resultBlock.gate = { kind: 'REDUCED_TO_ZERO_BY', damageOutcomeId }
        path.resultBlock.outcomes.push(followUp)
      }
  return volley
}

/** Fires the volley (a hit on a natural 15 against the Wolf's AC 13) at a Wolf with `hitPoints`. */
async function shoot(input: {
  followUp: OutcomeAuthored
  hitPoints: number
  resistant?: boolean
  damageOutcomeId?: string
}) {
  const prepared = await prepareCreatureAction({
    actor: creatureActor({
      id: ATTACKER_ID,
      label: 'Quill Beast',
      features: [gatedVolley(input.followUp, input.damageOutcomeId ?? QUILL_DAMAGE_OUTCOME_ID)]
    }),
    target: creatureActor({
      id: TARGET_ID,
      label: 'Target Wolf',
      features: [],
      hitPoints: input.hitPoints,
      ...(input.resistant ? { damageResistanceIds: [PIERCING] } : {})
    }),
    featureId: QUILL_VOLLEY_ID,
    overridable: true
  })
  return settleCreatureAction({ prepared, rolls: [14] })
}

const KILL: OutcomeAuthored = { id: FOLLOW_UP_OUTCOME_ID, effectKind: EFFECT_KIND.KILL }
const STUN: OutcomeAuthored = {
  id: FOLLOW_UP_OUTCOME_ID,
  effectKind: EFFECT_KIND.CONDITION,
  conditionId: srdConditionId('STUNNED')
}

describe.each([
  ['kill', KILL, 'KILL'],
  ['condition', STUN, 'CONDITION_APPLY']
])('REDUCED_TO_ZERO_BY gate on a %s (SPELLS-33 T4i3a)', (_label, followUp, applied) => {
  it('applies the outcome after damage that took the target to 0 hit points', async () => {
    const { execution } = await shoot({ followUp, hitPoints: 3 })
    expect(execution.applications.map(({ kind }) => kind)).toEqual(['DAMAGE', applied])
  })

  it('leaves the outcome out when the damage left the target standing', async () => {
    const { execution } = await shoot({ followUp, hitPoints: 10 })
    expect(execution.applications.map(({ kind }) => kind)).toEqual(['DAMAGE'])
  })

  it('judges the damage the target actually took, so a resistance can keep it standing', async () => {
    const { execution } = await shoot({ followUp, hitPoints: 3, resistant: true })
    expect(execution.applications).toMatchObject([
      { kind: 'DAMAGE', beforeCurrentHitPoints: 3, afterCurrentHitPoints: 2 }
    ])
    expect(execution.applications).toHaveLength(1)
  })

  it('publishes the outcome as a gated proposal naming the damage proposal, and gates nothing else', async () => {
    const { execution } = await shoot({ followUp, hitPoints: 3 })
    const nodes = execution.published.definition.nodes
    expect(nodes).toMatchObject([
      { id: 'outcome1-proposal-on_hit', operation: { contractVersion: 1 } },
      {
        id: 'outcome2-proposal-on_hit',
        operation: { contractVersion: 2 },
        inputs: { reducedToZeroByNodeId: { kind: 'LITERAL', value: 'outcome1-proposal-on_hit' } }
      }
    ])
    expect(nodes[0]?.inputs.reducedToZeroByNodeId).toBeUndefined()
  })
})

describe('REDUCED_TO_ZERO_BY gate refusals (SPELLS-33 T4i3a)', () => {
  it('refuses a gate whose damage outcome the path does not author', async () => {
    await expect(
      shoot({
        followUp: KILL,
        hitPoints: 3,
        damageOutcomeId: '00000000-0000-4000-8000-00000000c0ff'
      })
    ).rejects.toThrow(/reduced-to-0 gate/)
  })
})
