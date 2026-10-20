import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { describe, expect, it } from 'vitest'

import { buildCharacterSheetPanel } from '../character/sheetPanel.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture
} from '../testing/characterContextFixtures.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

/**
 * SPELLS-33 T6i: the Sheet shows the penalty corrosion put on an item, in its own panel, and
 * nothing for an item that is unharmed.
 */

const CORRODED_ID = testUuid(0x7a1)
const UNHARMED_ID = testUuid(0x7a2)

async function itemFacts(itemInstanceId: string) {
  const fixture = readyFighterFixture({ resourceLabel: 'Second Wind' })
  const { character: built } = await prepareFixtureBuilder(fixture)
  const played = await prepareFixtureSheet({
    character: {
      ...built,
      state: {
        ...built.state,
        equipment: {
          ...built.state.equipment,
          inventory: [
            { id: CORRODED_ID, equipmentId: longsword.id, quantity: 1, degradation: 2 },
            { id: UNHARMED_ID, equipmentId: longsword.id, quantity: 1 }
          ]
        }
      }
    },
    documents: { ...fixture.documents, EQUIPMENT: [longsword] }
  })
  const panel = buildCharacterSheetPanel({
    character: played.prepared.character,
    resolution: played.prepared.resolution,
    presentation: played.prepared.context.presentation,
    sheet: played.sheet,
    ruleProjection: played.ruleProjection,
    knownSpellEligibleIdsByClass: new Map(),
    adjustments: played.adjustments,
    movementDisplayPreference: played.sheetState.movementDisplayPreference,
    target: { kind: 'ITEM', itemInstanceId },
    editable: true
  })
  if (panel.kind !== 'ITEM') throw new Error('Expected an item panel.')
  return panel.facts
}

describe('the Sheet item panel shows corrosion (SPELLS-33 T6i)', () => {
  it('names the penalty on the damage rolls of a corroded weapon', async () => {
    expect(await itemFacts(CORRODED_ID)).toContainEqual({
      label: 'Corrosion',
      value: '-2 damage rolls'
    })
  })

  it('shows nothing for an item corrosion has not touched', async () => {
    expect((await itemFacts(UNHARMED_ID)).some(({ label }) => label === 'Corrosion')).toBe(false)
  })
})
