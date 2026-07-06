import { describe, expect, it } from 'vitest'
import {
  authoredRouteStorySystem,
  seedDragonbornRace,
  seedFireballSpell
} from '#domains/authoredRouteStory.fixtures'
import { authoredPreviewFactories } from './authoredPreviewFactories'
import { collectDamagePreviewItems, createAuthoredPreviewModel } from './authoredPreviewModel'

describe('authored preview factories', () => {
  it('registers every non-character authored domain', () => {
    expect(Object.keys(authoredPreviewFactories).sort()).toEqual([
      'background',
      'class',
      'creature',
      'equipment',
      'feat',
      'race',
      'spell',
      'vehicle'
    ])
  })

  it('formats damage from authored effect outcomes with system labels', () => {
    expect(collectDamagePreviewItems(seedFireballSpell, authoredRouteStorySystem)).toEqual([
      {
        amount: '8d6+',
        label: 'Fire',
        tone: 'fire'
      },
      {
        amount: 'Half 8d6+',
        label: 'Fire',
        tone: 'fire'
      }
    ])
  })

  it('creates useful spell preview sections without mirroring every field', () => {
    const model = createAuthoredPreviewModel({
      domain: 'spell',
      system: authoredRouteStorySystem,
      values: seedFireballSpell
    })

    expect(model.sections.map((section) => section.title)).toEqual([
      'Spell Snapshot',
      'Damage',
      'Description',
      'Materials'
    ])
  })

  it('renders race traits as a single step summary', () => {
    const model = createAuthoredPreviewModel({
      domain: 'race',
      system: authoredRouteStorySystem,
      values: seedDragonbornRace
    })
    const traits = model.sections.find((section) => section.id === 'race-traits')

    expect(traits).toMatchObject({
      rows: [
        { label: 'Size', value: 'Medium' },
        { label: 'Speeds', value: 'Walking - 30 feet' }
      ],
      title: 'Traits',
      type: 'rows'
    })
  })

  it('omits incomplete race speed values from the traits preview', () => {
    const model = createAuthoredPreviewModel({
      domain: 'race',
      system: authoredRouteStorySystem,
      values: {
        ...seedDragonbornRace,
        speeds: [{ amount: 30, speedId: '', unit: 'FEET' }]
      }
    })
    const traits = model.sections.find((section) => section.id === 'race-traits')

    expect(traits).toMatchObject({
      rows: [{ label: 'Size', value: 'Medium' }],
      title: 'Traits',
      type: 'rows'
    })
  })
})
