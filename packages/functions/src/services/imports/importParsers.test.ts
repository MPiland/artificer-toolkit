import { describe, expect, it } from 'vitest'

import {
  parseDndBeyondCharacterPayload,
  parseDndBeyondCharacterUrl,
  parseFoundryActorPayload,
  sanitizeImportedRichText
} from './importParsers.js'

describe('import parsers', () => {
  it('accepts only normal HTTPS D&D Beyond character-sheet links', () => {
    expect(parseDndBeyondCharacterUrl('https://www.dndbeyond.com/characters/74476867')).toBe(
      '74476867'
    )
    expect(
      parseDndBeyondCharacterUrl(
        'https://character-service.dndbeyond.com/character/v5/character/74476867'
      )
    ).toBeNull()
    expect(parseDndBeyondCharacterUrl('https://example.com/characters/74476867')).toBeNull()
    expect(parseDndBeyondCharacterUrl('http://www.dndbeyond.com/characters/74476867')).toBeNull()
  })

  it('maps safe D&D Beyond fields and retains external identifiers for exact matching', () => {
    const parsed = parseDndBeyondCharacterPayload(
      {
        data: {
          id: 74476867,
          name: 'Aria',
          stats: [1, 2, 3, 4, 5, 6].map((id) => ({ id, value: 10 + id })),
          race: { baseRaceId: 3, entityRaceId: 31, fullName: 'High Elf' },
          background: { definition: { id: 4, name: 'Sage' } },
          classes: [{ level: 2, definition: { id: 5, name: 'Wizard' } }],
          inventory: [
            {
              quantity: 2,
              equipped: true,
              definition: {
                id: 6,
                name: 'Dagger',
                isHomebrew: true,
                description: '<p>Custom blade</p>'
              }
            }
          ],
          feats: [
            {
              definition: {
                id: 10,
                name: 'Roadwise',
                isHomebrew: true,
                description: '<p>Never lost</p>'
              }
            }
          ],
          modifiers: { race: [{ type: 'bonus', subType: 'speed', value: 5 }] },
          spells: {
            race: [{ definition: { id: 8, name: 'Light' } }],
            class: null
          },
          classSpells: [
            {
              spells: [
                { definition: { id: 8, name: 'Light' } },
                {
                  definition: {
                    id: 9,
                    name: 'Shield',
                    isHomebrew: true,
                    description: '<p>Custom ward</p>'
                  }
                }
              ]
            }
          ],
          customItems: [
            { id: 6, name: 'Duplicate dagger', description: '<p>Duplicate</p>' },
            { id: 7, name: 'Keepsake', description: '<p>Old coin</p>' }
          ]
        }
      },
      '74476867'
    )

    expect(parsed).toMatchObject({
      externalId: '74476867',
      label: 'Aria',
      abilities: { STRENGTH: 11, CHARISMA: 16 }
    })
    expect(parsed?.references.map((reference) => reference.externalId)).toEqual([
      '3',
      '4',
      '5',
      '6',
      '10',
      '8',
      '9'
    ])
    expect(
      parsed?.customContent.map((content) => `${content.subjectKind}:${content.externalId}`)
    ).toEqual(['EQUIPMENT:6', 'EQUIPMENT:7', 'FEAT:10', 'SPELL:9'])
    expect(parsed?.issues).toContainEqual(
      expect.objectContaining({
        code: 'DND_BEYOND_MECHANICS_NOT_IMPORTED',
        path: ['modifiers'],
        severity: 'INFO',
        correctionRequired: false
      })
    )
    expect(
      parsed?.references
        .filter((reference) => reference.role === 'SPELL')
        .map((reference) => reference.externalId)
    ).toEqual(['8', '9'])
  })

  it('accepts dnd5e character Actors and reports ignored Foundry presentation data', () => {
    const parsed = parseFoundryActorPayload({
      _id: 'actor-1',
      name: 'Aria',
      type: 'character',
      _stats: { systemId: 'dnd5e' },
      prototypeToken: { name: 'Do not import' },
      system: {
        abilities: Object.fromEntries(
          ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((key) => [key, { value: 12 }])
        ),
        attributes: { hp: { value: 8 } },
        details: { biography: { value: '<p>Story</p><script>alert(1)</script>' } }
      },
      items: [
        {
          _id: 'class-1',
          name: 'Wizard',
          type: 'class',
          system: { levels: 2 },
          flags: { core: { sourceId: 'Compendium.dnd5e.classes.Item.wizard' } }
        },
        {
          _id: 'blade-1',
          name: 'Moon Blade',
          type: 'weapon',
          system: {
            quantity: 2,
            equipped: true,
            attunement: 2,
            description: { value: '<p>Forged under starlight.</p>' }
          }
        }
      ]
    })

    expect(parsed?.issues).toContainEqual(
      expect.objectContaining({ code: 'IGNORED_FOUNDRY_PRESENTATION' })
    )
    expect(parsed?.issues).toContainEqual(
      expect.objectContaining({ code: 'FOUNDRY_MECHANICS_REQUIRE_REVIEW' })
    )
    expect(parsed?.description).not.toContain('<script')
    expect(parsed?.references[0]).toMatchObject({
      externalId: 'class-1',
      role: 'CLASS',
      level: 2
    })
    expect(parsed?.references[1]).toMatchObject({
      externalId: 'blade-1',
      role: 'EQUIPMENT',
      quantity: 2,
      equipped: true,
      attuned: true
    })
    expect(parsed?.customContent[0]).toMatchObject({
      externalId: 'blade-1',
      label: 'Moon Blade',
      subjectKind: 'EQUIPMENT'
    })
    expect(
      parseFoundryActorPayload({
        _id: 'actor-2',
        name: 'Wrong system',
        type: 'character',
        _stats: { systemId: 'pf2e' },
        system: {},
        items: []
      })
    ).toBeNull()
    expect(
      parseFoundryActorPayload({
        _id: 'actor-3',
        name: 'Missing system',
        type: 'character',
        system: {},
        items: []
      })
    ).toBeNull()
  })

  it('removes executable markup and attributes from imported rich text', () => {
    const result = sanitizeImportedRichText(
      '<p onclick="steal()" style="color:red">Safe</p><script>alert(1)</script><a href=jav&#x61;script:steal()>link</a><img src=x onerror=steal()>'
    )
    expect(result).toBe('<p>Safe</p><a>link</a>')
  })
})
