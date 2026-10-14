import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { SRD_DARKVISION_SENSE_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { resolveCharacterRecordStats } from '../character/characterRecordStats.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  system
} from '../testing/characterContextFixtures.js'

const walk = system.speeds.find((speed) => speed.code === 'WALK')
if (!walk) throw new Error('Expected the SRD walking Speed.')

/** A race whose speed and darkvision are authored in yards and whose feature adds 30 feet to both. */
const metricHuman = {
  ...human,
  speeds: [{ speedId: walk.id, amount: 10, unit: 'YARDS' as const }],
  features: [
    {
      id: crypto.randomUUID(),
      label: 'Far Reach',
      description: 'Your speed and darkvision reach 30 feet further.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        senses: [
          {
            id: crypto.randomUUID(),
            grantKind: 'SENSE_GRANT' as const,
            selectionKind: 'GRANTED' as const,
            scalingKind: 'NONE' as const,
            authoringModeKind: 'SELECTED' as const,
            senseIds: [SRD_DARKVISION_SENSE_ID],
            range: {
              id: crypto.randomUUID(),
              rangeKind: 'DISTANCE' as const,
              amount: 18,
              unit: 'YARDS' as const
            },
            order: 0
          }
        ],
        modifiers: [
          {
            id: crypto.randomUUID(),
            grantKind: 'MODIFIER_GRANT' as const,
            valueDomainCode: 'SPEED' as const,
            domain: { speedId: walk.id },
            modifierKind: 'BONUS' as const,
            scope: 'GLOBAL' as const,
            selectionKind: 'GRANTED' as const,
            payload: { amount: 30, unit: 'FEET' as const },
            order: 0
          },
          {
            id: crypto.randomUUID(),
            grantKind: 'MODIFIER_GRANT' as const,
            valueDomainCode: 'SENSE_RANGE' as const,
            domain: { senseDefinitionId: SRD_DARKVISION_SENSE_ID },
            modifierKind: 'BONUS' as const,
            scope: 'GLOBAL' as const,
            selectionKind: 'GRANTED' as const,
            payload: { amount: 30, unit: 'FEET' as const },
            order: 1
          }
        ]
      }
    }
  ]
}

describe('a Character whose speed and sense are authored in yards gains a bonus authored in feet', () => {
  const prepare = async () => {
    const fixture = readyFighterFixture()
    const documents = { ...fixture.documents, RACE: [metricHuman] }
    const { character } = await prepareFixtureBuilder({ character: fixture.character, documents })
    return prepareFixtureSheet({ character, documents })
  }

  it('shows the converted speed and sense range on the Sheet read model', async () => {
    const { sheet } = await prepare()

    // 10 yd + 30 ft = 10 yd + 10 yd; 18 yd + 30 ft = 18 yd + 10 yd.
    expect(sheet.overview.facts.find((fact) => fact.label === 'Speed')?.value).toBe('20 yards')
    expect(sheet.reference.senses).toEqual([
      expect.objectContaining({ senseId: SRD_DARKVISION_SENSE_ID, value: '28 yards' })
    ])
  })

  it('stores the converted speed in feet for the Scene token to move by', async () => {
    const { ruleEvaluation } = await prepare()

    expect(resolveCharacterRecordStats(ruleEvaluation).speeds).toEqual([
      { speedId: walk.id, amount: 60, unit: 'FEET' }
    ])
  })
})
