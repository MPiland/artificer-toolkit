import { describe, expect, it } from 'vitest'
import type { InitiativeActorFactSource } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import { readInitiativeSourceRoll } from '../encounterInitiativeRoll.js'
import { dnd5eInitiativeFactAdapter } from '../systems/dnd5e/initiativeFactAdapter.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'
import { creatureSource, customSource } from './encounterInitiativeFixtures.js'

const CHARACTER_ID = '00000000-0000-4000-8000-00000000e001'
const ACTOR_ID = '00000000-0000-4000-8000-00000000e002'

const fighter = evaluateSrdCharacter({
  race: 'Human',
  abilities: { DEXTERITY: 14 },
  classes: [{ label: 'Fighter', level: 1 }]
})

function characterSource(
  overrides: Partial<Extract<InitiativeActorFactSource, { kind: 'CHARACTER' }>> = {}
): InitiativeActorFactSource {
  return {
    kind: 'CHARACTER',
    actor: { id: ACTOR_ID, sourceId: CHARACTER_ID, snapshot: null },
    characterId: CHARACTER_ID,
    systemId: '00000000-0000-4000-8000-00000000e003',
    streamVersion: 1,
    mechanics: {
      initiativeActorFacts: { effectiveSize: null, checkTotals: {}, equippedItems: [] }
    },
    overlay: { rulePolicyOutput: fighter.output },
    ...overrides
  }
}

describe('readInitiativeSourceRoll', () => {
  it('reads a Character from its policy output: modifier, expression and roll mode', () => {
    expect(readInitiativeSourceRoll(characterSource())).toEqual({
      characterId: CHARACTER_ID,
      modifier: fighter.output.derivedStats.initiative.effective,
      expression: '1d20+2',
      rollMode: fighter.output.rollModes.initiative
    })
  })

  it('prefers the Encounter-effective policy output over the overlay output', () => {
    const effective = {
      ...fighter.output,
      derivedStats: {
        ...fighter.output.derivedStats,
        initiative: { ...fighter.output.derivedStats.initiative, effective: -1 }
      },
      rollModes: { ...fighter.output.rollModes, initiative: 'ADVANTAGE' as const }
    }
    expect(
      readInitiativeSourceRoll(characterSource({ effectiveRulePolicyOutput: effective }))
    ).toMatchObject({ modifier: -1, expression: '1d20-1', rollMode: 'ADVANTAGE' })
  })

  it('reads a Creature from its actor rule with a normal roll and no Character', () => {
    expect(readInitiativeSourceRoll(creatureSource(ACTOR_ID, 3))).toEqual({
      characterId: null,
      modifier: 3,
      expression: '1d20+3',
      rollMode: 'NORMAL'
    })
  })

  it('reads a custom actor as a bare normal d20', () => {
    expect(readInitiativeSourceRoll(customSource(ACTOR_ID))).toEqual({
      characterId: null,
      modifier: 0,
      expression: '1d20',
      rollMode: 'NORMAL'
    })
  })

  it('is the roll the D&D adapter binds for every automatic actor', () => {
    for (const source of [characterSource(), creatureSource(ACTOR_ID, -2)]) {
      const bound = dnd5eInitiativeFactAdapter.bindActor(source)
      const read = readInitiativeSourceRoll(source)
      expect(bound.automatic).toBe(true)
      if (!bound.automatic) continue
      expect(Object.values(bound.facts)).toEqual(
        expect.arrayContaining([read.modifier, read.rollMode])
      )
    }
  })
})
