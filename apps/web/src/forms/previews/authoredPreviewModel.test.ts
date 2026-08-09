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
    expect(model.sections.find((section) => section.id === 'spell-facts')).toMatchObject({
      facts: expect.arrayContaining([{ label: 'Casting', value: '1 action' }])
    })
  })

  it('summarizes non-damage spell outcomes in one facts section', () => {
    const model = createAuthoredPreviewModel({
      domain: 'spell',
      label: 'Control and Mend',
      statusLabel: 'Draft',
      system: authoredRouteStorySystem,
      values: {
        effects: [
          {
            effectKind: 'CONDITION',
            conditionId: authoredRouteStorySystem.conditionTypes[0]?.id ?? 'condition-poisoned'
          },
          { effectKind: 'HEAL', valueKind: 'DICE', diceConfig: '2d8', temporary: true },
          {
            effectKind: 'FORCED_MOVEMENT',
            direction: 'TOWARD_SOURCE',
            amount: 10,
            unit: 'FEET'
          }
        ]
      }
    })

    expect(model.sections.find((section) => section.id === 'spell-outcomes')).toMatchObject({
      facts: [
        { label: 'Condition', value: 'Poisoned' },
        { label: 'Healing', value: '2d8 temporary hit points' },
        { label: 'Movement', value: 'Pull 10 feet' }
      ],
      title: 'Outcomes',
      type: 'facts'
    })
  })

  it('includes authored equipment prose in the live preview', () => {
    const model = createAuthoredPreviewModel({
      domain: 'equipment',
      label: 'Shortsword +1',
      statusLabel: 'Draft',
      system: authoredRouteStorySystem,
      values: {
        ...seedShortswordPlusOneEquipment,
        quote: '<p>A clean edge, <em>humming</em> faintly.</p>'
      }
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
      quote: 'A clean edge, humming faintly.',
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

  it('uses the correct plural for proficiencies', () => {
    const model = createAuthoredPreviewModel({
      domain: 'class',
      label: 'Inventor',
      statusLabel: 'Draft',
      system: authoredRouteStorySystem,
      values: {
        category: 'BASE',
        proficiencies: [{ id: 'one' }, { id: 'two' }]
      }
    })

    expect(model.sections.find((section) => section.id === 'class-facts')).toMatchObject({
      facts: expect.arrayContaining([{ label: 'Proficiencies', value: '2 proficiencies' }])
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
        { label: 'Type', value: 'Base' },
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
      rows: [
        { label: 'Type', value: 'Base' },
        { label: 'Size', value: 'Medium' }
      ],
      title: 'Traits',
      type: 'rows'
    })
  })
})
