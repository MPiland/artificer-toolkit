import { describe, expect, it } from 'vitest'
import { wish } from '@artificer-toolkit/source-data/srd/spells/wish.js'

import { DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY } from '../systems/dnd5e/effectActionContracts.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureActor,
  prepareCreatureAction,
  settleCreatureAction
} from './encounterCreatureAction.js'

const CASTER_ID = testUuid(0x6e301)
const FEATURE_ID = testUuid(0x6e302)

describe('a single target on a Self range is its user', () => {
  it('the SRD Wish resolves a GM ruling on its caster', async () => {
    const [effect] = wish.effects ?? []
    if (!effect) throw new Error('The SRD Wish has no effect.')
    const caster = creatureActor({
      id: CASTER_ID,
      label: 'Caster',
      features: [
        {
          id: FEATURE_ID,
          label: wish.label,
          description: wish.description,
          order: 1,
          effects: [effect]
        }
      ]
    })
    const prepared = await prepareCreatureAction({
      actor: caster,
      target: caster,
      featureId: FEATURE_ID,
      overridable: false
    })
    const { execution } = await settleCreatureAction({ prepared, rolls: [] })
    expect(execution.applications).toEqual([])
    expect(
      execution.execution.evidence.trace.some(
        ({ operation }) => operation.key === DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY
      )
    ).toBe(true)
  })
})
