import { characterPreparationOptionsResponseDtoSchema } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import { describe, expect, it } from 'vitest'

import { presentCampaignCharacterText } from '../character/campaignCharacterPresentation.js'
import { buildCharacterPreparationOptions } from '../character/characterSpellPreparationEligibility.js'

describe('Character preparation options', () => {
  it('filters eligible IDs against authorized summaries and retains every prepared ID', () => {
    const visibleSpellId = crypto.randomUUID()
    const unavailableSpellId = crypto.randomUUID()
    const classId = crypto.randomUUID()
    const catalogue = {
      kind: 'INLINE' as const,
      spells: [{ spellId: visibleSpellId, label: 'Visible Spell', level: 1 }]
    }
    const response = buildCharacterPreparationOptions({
      characterId: crypto.randomUUID(),
      streamVersion: 12,
      classes: [{ id: classId, label: 'Wizard' }],
      summaries: [{ id: visibleSpellId, label: 'Visible Spell', level: 1 }],
      eligibility: [
        {
          classId,
          preparedSpellLimit: 2,
          eligibleSpellIds: [visibleSpellId, unavailableSpellId],
          preparedSpellIds: [visibleSpellId, unavailableSpellId]
        }
      ],
      catalogue
    })
    expect(characterPreparationOptionsResponseDtoSchema.parse(response)).toEqual(response)
    expect(response.classes).toEqual([
      {
        classId,
        label: 'Wizard',
        preparedSpellLimit: 2,
        eligibleSpellIds: [visibleSpellId],
        preparedSpellIds: [visibleSpellId, unavailableSpellId]
      }
    ])
    expect(response.catalogue).toBe(catalogue)
  })

  it('rejects unavailable Classes rather than fabricating their labels', () => {
    const classId = crypto.randomUUID()
    expect(() =>
      buildCharacterPreparationOptions({
        characterId: crypto.randomUUID(),
        streamVersion: 0,
        classes: [],
        summaries: [],
        eligibility: [
          {
            classId,
            preparedSpellLimit: 1,
            eligibleSpellIds: [],
            preparedSpellIds: []
          }
        ],
        catalogue: { kind: 'INLINE', spells: [] }
      })
    ).toThrow(`Preparation source class "${classId}" is unavailable.`)
  })

  it('applies Campaign presentation to inline catalogue labels while preserving IDs', () => {
    const classId = crypto.randomUUID()
    const spellId = crypto.randomUUID()
    const response = buildCharacterPreparationOptions({
      characterId: crypto.randomUUID(),
      streamVersion: 0,
      classes: [{ id: classId, label: 'Fuck wizard' }],
      summaries: [{ id: spellId, label: 'Fuck spell', level: 1 }],
      eligibility: [
        {
          classId,
          preparedSpellLimit: 1,
          eligibleSpellIds: [spellId],
          preparedSpellIds: [spellId]
        }
      ],
      catalogue: { kind: 'INLINE', spells: [{ spellId, label: 'Fuck spell', level: 1 }] }
    })
    const presented = presentCampaignCharacterText(response, 'STANDARD')
    expect(presented.classes[0]!.label).not.toBe(response.classes[0]!.label)
    expect(presented.classes[0]!.eligibleSpellIds).toEqual([spellId])
    expect(presented.classes[0]!.preparedSpellIds).toEqual([spellId])
    expect(presented.catalogue).toMatchObject({
      kind: 'INLINE',
      spells: [{ spellId, level: 1 }]
    })
    if (presented.catalogue.kind !== 'INLINE' || response.catalogue.kind !== 'INLINE')
      throw new Error('Expected the inline catalogue.')
    expect(presented.catalogue.spells[0]!.label).not.toBe(response.catalogue.spells[0]!.label)
  })
})
