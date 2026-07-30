import { describe, expect, it } from 'vitest'
import {
  authoredRouteStorySystem,
  seedAstralTearAwakenedEquipment,
  seedDragonbornRace,
  seedFireballSpell,
  seedShortswordEquipment,
  seedShortswordPlusOneEquipment
} from '#domains/authoredRouteStory.fixtures'
import { authoredPreviewFactories } from './authoredPreviewFactories'
import { collectDamagePreviewItems, createAuthoredPreviewModel } from './authoredPreviewModel'
import type { PreviewSection } from './authoredPreview.types'

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
      label: 'Fireball',
      statusLabel: 'Draft',
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

  it('includes authored equipment prose in the live preview', () => {
    const model = createAuthoredPreviewModel({
      domain: 'equipment',
      label: 'Shortsword +1',
      statusLabel: 'Draft',
      system: authoredRouteStorySystem,
      values: seedShortswordPlusOneEquipment
    })

    expect(model.sections.map((section) => section.title)).toEqual([
      'Item Snapshot',
      'Description',
      'Properties',
      'Damage'
    ])
    expect(model).toMatchObject({
      equipmentIcon: 'sword',
      label: 'Shortsword +1',
      statusLabel: 'Draft'
    })
    expect(model.sections.find((section) => section.id === 'equipment-prose')).toMatchObject({
      html: seedShortswordPlusOneEquipment.description,
      title: 'Description',
      type: 'prose'
    })
  })

  it('formats equipment weight and value for the compact preview stats', () => {
    const model = createAuthoredPreviewModel({
      domain: 'equipment',
      label: seedShortswordEquipment.label,
      statusLabel: 'Draft',
      system: authoredRouteStorySystem,
      values: seedShortswordEquipment
    })

    expect(model.sections.find((section) => section.id === 'equipment-facts')).toMatchObject({
      facts: expect.arrayContaining([
        { label: 'Weight', value: '2 lb.' },
        { label: 'Value', value: '10 gp' }
      ])
    })
  })

  it('keeps internal feature ordering out of the reader preview', () => {
    const model = createAuthoredPreviewModel({
      domain: 'equipment',
      label: seedAstralTearAwakenedEquipment.label,
      statusLabel: 'Draft',
      system: authoredRouteStorySystem,
      values: seedAstralTearAwakenedEquipment
    })

    const features = model.sections.find(
      (section): section is Extract<PreviewSection, { type: 'list' }> =>
        section.id === 'equipment-features' && section.type === 'list'
    )
    if (!features) {
      throw new Error('Expected equipment features section to exist.')
    }

    expect(features).toMatchObject({
      items: [{ title: 'Warping Strike' }, { title: 'Spells' }],
      type: 'list'
    })
    expect(features.items.every((item) => item.meta === undefined)).toBe(true)
    expect(model.sections.find((section) => section.id === 'charges-preview')).toMatchObject({
      rows: [
        { label: 'Uses', value: '3' },
        { label: 'Resets', value: 'Dawn' }
      ],
      type: 'rows'
    })
  })

  it('renders race traits as a single step summary', () => {
    const model = createAuthoredPreviewModel({
      domain: 'race',
      label: 'Dragonborn',
      statusLabel: 'Draft',
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
      label: 'Dragonborn',
      statusLabel: 'Draft',
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
