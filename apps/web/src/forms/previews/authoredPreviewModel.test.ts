import { describe, expect, it } from 'vitest'
import { authoredRouteStorySystem, seedFireballSpell } from '#domains/authoredRouteStory.fixtures'
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
      'Spell Text',
      'Materials'
    ])
  })
})
