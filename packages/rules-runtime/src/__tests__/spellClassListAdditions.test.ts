import { describe, expect, it } from 'vitest'
import { theFiend } from '@artificer-toolkit/source-data/srd/classes/the-fiend.js'
import { SPELL_IDS } from '@artificer-toolkit/source-data/srd/ids.js'

import {
  buildCharacterSpellClassListAdditions,
  collectSpellClassListAdditions,
  withClassListAdditions
} from '../character/spellClassListAdditions.js'
import { SRD, evaluateSrdCharacter, srdByLabel, srdRegistry } from '../testing/dnd5eSrdCharacter.js'

/**
 * SPELLS-31.T5p (D175): The Fiend's Expanded Spell List is an authored class-list-only spell
 * grant. One merge puts its spells on the Warlock list for a Fiend Warlock and for nobody else.
 */

const FIEND_SPELL_IDS = [
  SPELL_IDS.BURNING_HANDS,
  SPELL_IDS.COMMAND,
  SPELL_IDS.BLINDNESS_DEAFNESS,
  SPELL_IDS.SCORCHING_RAY,
  SPELL_IDS.FIREBALL,
  SPELL_IDS.STINKING_CLOUD,
  SPELL_IDS.FIRE_SHIELD,
  SPELL_IDS.WALL_OF_FIRE,
  SPELL_IDS.FLAME_STRIKE,
  SPELL_IDS.HALLOW
]
const warlockId = srdByLabel(SRD.classes, 'Warlock').id
const catalog = FIEND_SPELL_IDS.map((id) => ({ id, classIds: [] as string[] }))
const inCatalog = (spells: { id: string; classIds: readonly string[] }[]) =>
  spells.filter(({ classIds }) => classIds.includes(warlockId)).map(({ id }) => id)

describe('Class spell list additions', () => {
  it('authors Expanded Spell List as a class-list-only grant with no closed rule', () => {
    const feature = theFiend.features!.find(({ label }) => label === 'Expanded Spell List')!
    expect(feature.effects).toBeUndefined()
    expect(feature.grants!.spells).toHaveLength(1)
    expect(feature.grants!.spells![0]).toMatchObject({
      access: 'CLASS_LIST_ONLY',
      classListIds: [warlockId],
      spellIds: FIEND_SPELL_IDS
    })
  })

  it('adds the Fiend spells to the Warlock list for a Fiend Warlock only', () => {
    const fiend = evaluateSrdCharacter({
      classes: [{ label: 'Warlock', level: 1, subclass: 'The Fiend' }]
    })
    const additions = buildCharacterSpellClassListAdditions(fiend.snapshot, srdRegistry)
    expect(inCatalog(withClassListAdditions(catalog, additions))).toEqual(FIEND_SPELL_IDS)

    const plain = evaluateSrdCharacter({ classes: [{ label: 'Warlock', level: 1 }] })
    expect(buildCharacterSpellClassListAdditions(plain.snapshot, srdRegistry)).toEqual([])
    expect(inCatalog(withClassListAdditions(catalog, []))).toEqual([])
  })

  it('keeps a spell already on the list once and leaves other spells untouched', () => {
    const fiend = evaluateSrdCharacter({
      classes: [{ label: 'Warlock', level: 1, subclass: 'The Fiend' }]
    })
    const additions = buildCharacterSpellClassListAdditions(fiend.snapshot, srdRegistry)
    const merged = withClassListAdditions(
      [
        { id: SPELL_IDS.FIREBALL, classIds: [warlockId, 'other'] },
        { id: 'unrelated', classIds: ['other'] }
      ],
      additions
    )
    expect(merged).toEqual([
      { id: SPELL_IDS.FIREBALL, classIds: [warlockId, 'other'] },
      { id: 'unrelated', classIds: ['other'] }
    ])
  })

  it('stays inactive below the feature level', () => {
    expect(
      collectSpellClassListAdditions(
        [
          {
            availableAtLevel: 5,
            spells: [
              {
                id: 'g',
                grantKind: 'SPELL_GRANT',
                selectionKind: 'GRANTED',
                scalingKind: 'NONE',
                authoringModeKind: 'SELECTED',
                spellIds: [SPELL_IDS.FIREBALL],
                access: 'CLASS_LIST_ONLY',
                classListIds: [warlockId],
                order: 0
              }
            ]
          }
        ],
        4
      )
    ).toEqual([])
  })
})
