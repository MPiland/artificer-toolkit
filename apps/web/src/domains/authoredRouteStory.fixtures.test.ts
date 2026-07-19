import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { describe, expect, it } from 'vitest'
import { seedDragonbornRace, seedFireballSpell } from './authoredRouteStory.fixtures'

describe('dense authored route story fixtures', () => {
  it('preserves the Dragonborn ancestry, option, and feature hierarchy', () => {
    const race = raceAuthoredDtoSchema.parse(seedDragonbornRace)

    expect(race).toMatchObject({
      label: 'Dragonborn',
      ancestry: {
        label: 'Draconic Ancestry',
        options: [
          {
            label: 'Red Dragon',
            features: [{ label: 'Breath Weapon' }]
          }
        ]
      }
    })
  })

  it('preserves Fireball save paths and their nested damage outcomes', () => {
    const spell = spellAuthoredDtoSchema.parse(seedFireballSpell)
    const effect = spell.effects?.[0]

    expect(spell.label).toBe('Fireball')
    expect(effect).toMatchObject({
      invocation: { triggerCode: 'SAVING_THROW' }
    })
    expect(effect?.paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathCode: 'ON_SAVE_FAIL',
          resultBlock: expect.objectContaining({
            outcomes: expect.arrayContaining([
              expect.objectContaining({
                effectKind: 'DAMAGE',
                levels: expect.arrayContaining([
                  expect.objectContaining({ level: 3, diceConfig: '8d6' })
                ])
              })
            ])
          })
        }),
        expect.objectContaining({
          pathCode: 'ON_SAVE_SUCCESS',
          resultBlock: expect.objectContaining({
            outcomes: expect.arrayContaining([
              expect.objectContaining({ effectKind: 'DAMAGE', amountKind: 'HALF' })
            ])
          })
        })
      ])
    )
  })
})
