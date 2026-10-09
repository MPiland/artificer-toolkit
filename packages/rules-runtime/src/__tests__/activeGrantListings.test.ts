import { describe, expect, it } from 'vitest'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import { hideActiveGrantSources, listActiveGrantListings } from '../activeGrantListings.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

type ListedEffect = Pick<
  ActiveRuleEffectRecord,
  'id' | 'createdOrdinal' | 'definition' | 'lifecycle'
>

function grantEffect(input: {
  id: number
  createdOrdinal: number
  sourceHidden?: boolean
  sourceLabel?: string
  lifecycle: ActiveRuleEffectRecord['lifecycle']
}): ListedEffect {
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: testUuid(0xd001),
    holderActorId: testUuid(0xd002),
    lifecycle: {},
    ...(input.sourceLabel ? { sourceLabel: input.sourceLabel } : {})
  })
  if (planned.definition.schemaVersion !== 2)
    throw new Error('A grant stores a version 2 definition.')
  return {
    id: testUuid(input.id),
    createdOrdinal: input.createdOrdinal,
    lifecycle: input.lifecycle,
    definition: {
      ...planned.definition,
      stateContributions: planned.definition.stateContributions.map((contribution) =>
        contribution.kind === 'MODIFIER_GRANT'
          ? { ...contribution, sourceHidden: input.sourceHidden ?? false }
          : contribution
      )
    }
  }
}

const nonGrant = (effect: ListedEffect): ListedEffect =>
  effect.definition.schemaVersion === 2
    ? {
        ...effect,
        definition: {
          ...effect.definition,
          stateContributions: effect.definition.stateContributions.filter(
            ({ kind }) => kind !== 'MODIFIER_GRANT'
          )
        }
      }
    : effect

describe('listActiveGrantListings', () => {
  it('lists grants oldest first with their source label and what is left of them', () => {
    const run = grantEffect({
      id: 0xd011,
      createdOrdinal: 2,
      sourceLabel: 'Antitoxin (vial)',
      lifecycle: { schemaVersion: 1, remainingTicks: 7 }
    })
    const carried = grantEffect({
      id: 0xd012,
      createdOrdinal: 1,
      sourceLabel: 'Aid',
      lifecycle: { schemaVersion: 1, remainingTicks: null, expiresAtCampaignMinute: 2001 }
    })
    const untimed = grantEffect({
      id: 0xd013,
      createdOrdinal: 3,
      lifecycle: { schemaVersion: 1, remainingTicks: null }
    })
    expect(listActiveGrantListings([run, untimed, carried])).toEqual([
      {
        effectId: carried.id,
        label: 'Aid',
        sourceHidden: false,
        remainingTicks: null,
        expiresAtCampaignMinute: 2001
      },
      {
        effectId: run.id,
        label: 'Antitoxin (vial)',
        sourceHidden: false,
        remainingTicks: 7,
        expiresAtCampaignMinute: null
      },
      {
        effectId: untimed.id,
        label: expect.any(String),
        sourceHidden: false,
        remainingTicks: null,
        expiresAtCampaignMinute: null
      }
    ])
  })

  it('leaves out effects that are not grants', () => {
    const grant = grantEffect({
      id: 0xd021,
      createdOrdinal: 1,
      lifecycle: { schemaVersion: 1, remainingTicks: 3 }
    })
    expect(listActiveGrantListings([nonGrant(grant)])).toEqual([])
  })
})

describe('hideActiveGrantSources', () => {
  it('clears only the label of a grant whose source was hidden', () => {
    const [shown, hidden] = listActiveGrantListings([
      grantEffect({
        id: 0xd031,
        createdOrdinal: 1,
        sourceLabel: 'Aid',
        lifecycle: { schemaVersion: 1, remainingTicks: 3 }
      }),
      grantEffect({
        id: 0xd032,
        createdOrdinal: 2,
        sourceLabel: 'Hidden trap blessing',
        sourceHidden: true,
        lifecycle: { schemaVersion: 1, remainingTicks: 3 }
      })
    ])
    expect(hideActiveGrantSources([shown!, hidden!])).toEqual([
      shown,
      { ...hidden, label: null, sourceHidden: true }
    ])
  })
})
