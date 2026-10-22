import { modifierRollInfluence } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { describe, expect, it } from 'vitest'

import { foldDnd5eCreatureFeatureGrants } from '../systems/dnd5e/creatureFeatureGrantFold.js'
import { resolveDnd5eRollMode } from '../systems/dnd5e/rollModePolicy.js'
import {
  srdCondition,
  srdCreatureActor,
  srdCreatureTarget,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'

type SaveRow = {
  abilityDefinitionId: string
  conditionTypeId?: string
  contributors: { influence: 'ADVANTAGE' | 'DISADVANTAGE' }[]
}

const ABILITY_COUNT = 6

function srdCreature(label: string): CreatureAuthored {
  const creature = srdBaselineContent.subjects.creatures.find((entry) => entry.label === label)
  if (!creature) throw new Error(`SRD Creature "${label}" is missing.`)
  return creature
}

function saveRows(creature: CreatureAuthored): SaveRow[] {
  const { savingThrowDefinitions } = srdCreatureTarget(
    srdCreatureActor({ id: testUuid(0x4000), creature })
  ).targetDerivedFacts
  return savingThrowDefinitions as SaveRow[]
}

/** The roll mode of a save against one condition, or of a save against none when it is omitted. */
function saveMode(rows: readonly SaveRow[], conditionTypeId?: string) {
  const scoped = rows.filter((row) => row.conditionTypeId === conditionTypeId)
  return scoped.map((row) => resolveDnd5eRollMode(row.contributors).rollMode)
}

const CONDITIONS = {
  Cultist: ['Charmed', 'Frightened'],
  'Cult Fanatic': ['Charmed', 'Frightened'],
  Knight: ['Frightened'],
  'Death Dog': ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Stunned', 'Unconscious']
}

describe('passive saving-throw grants on SRD Creatures (SPELLS-33.T3a2)', () => {
  it.each(Object.entries(CONDITIONS))(
    "%s's feature gives advantage on saves against exactly its conditions, for every ability",
    (label, conditions) => {
      const rows = saveRows(srdCreature(label))
      for (const condition of conditions) {
        expect(saveMode(rows, srdCondition(condition))).toEqual(
          Array(ABILITY_COUNT).fill('ADVANTAGE')
        )
      }
      expect(rows.filter((row) => row.conditionTypeId !== undefined)).toHaveLength(
        conditions.length * ABILITY_COUNT
      )
      expect(saveMode(rows)).toEqual(Array(ABILITY_COUNT).fill('NORMAL'))
    }
  )

  it('folds the Death Dog Perception advantage as a skill modifier grant', () => {
    expect(
      foldDnd5eCreatureFeatureGrants(srdCreature('Death Dog')).filter(
        (modifier) =>
          modifier.valueDomainCode === 'SKILL_MODIFIER' &&
          modifierRollInfluence(modifier) === 'ADVANTAGE'
      )
    ).toHaveLength(1)
  })

  it('gives a Creature without such a feature no condition-scoped save rows', () => {
    expect(saveRows(srdCreature('Goblin')).every((row) => row.conditionTypeId === undefined)).toBe(
      true
    )
  })
})

describe('a homebrew Creature authored from the same core options', () => {
  it('saves exactly like the Cultist', () => {
    const cultist = srdCreature('Cultist')
    const darkDevotion = cultist.features.find((entry) => entry.label === 'Dark Devotion')
    if (!darkDevotion?.grants?.modifiers) throw new Error('Dark Devotion grants nothing.')
    const goblin = srdCreature('Goblin')
    const homebrew: CreatureAuthored = {
      ...goblin,
      id: testUuid(0x4100),
      features: [
        ...goblin.features,
        {
          id: testUuid(0x4101),
          label: 'Homebrew Resolve',
          description: 'Resolute.',
          order: 99,
          grants: {
            modifiers: darkDevotion.grants.modifiers.map((grant, order) => ({
              ...grant,
              id: testUuid(0x4200 + order)
            }))
          }
        }
      ]
    }
    const shape = (rows: SaveRow[]) =>
      rows
        .filter((row) => row.conditionTypeId !== undefined)
        .map((row) => [row.abilityDefinitionId, row.conditionTypeId, row.contributors.length])
        .sort()
    expect(shape(saveRows(homebrew))).toEqual(shape(saveRows(cultist)))
  })
})
