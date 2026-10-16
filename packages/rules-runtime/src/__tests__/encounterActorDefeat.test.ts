import { describe, expect, it } from 'vitest'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import {
  deadCharacterIdsOfTargets,
  defeatedEncounterActorIds,
  isEncounterActorDefeated,
  skippedEncounterActorIds
} from '../encounterActorDefeat.js'
import { characterActor, creatureActor } from '../testing/dnd5eSrdEncounter.js'

const CHARACTER_ID = '00000000-0000-4000-8000-0000000d0001'
const OTHER_CHARACTER_ID = '00000000-0000-4000-8000-0000000d0002'
const dead = { successes: 0, failures: 3, stable: false }

describe('a dead Character is defeated like a Creature (D96)', () => {
  const character = characterActor({
    id: '00000000-0000-4000-8000-0000000a0001',
    characterId: CHARACTER_ID
  })
  const other = characterActor({
    id: '00000000-0000-4000-8000-0000000a0002',
    characterId: OTHER_CHARACTER_ID
  })
  const creature = creatureActor({
    id: '00000000-0000-4000-8000-0000000a0003',
    kind: 'CUSTOM',
    snapshot: {},
    currentHitPoints: 0,
    defeated: true
  })
  const actors = [character, other, creature]
  const deadSet = new Set([CHARACTER_ID])

  it('is defeated only when its Character is dead, never by hit points alone', () => {
    expect(isEncounterActorDefeated(character, new Set())).toBe(false)
    expect(isEncounterActorDefeated(character, deadSet)).toBe(true)
    expect(isEncounterActorDefeated(creature, new Set())).toBe(true)
  })

  it('joins the defeated and the skipped turns, and keeps the living Character in play', () => {
    expect([...defeatedEncounterActorIds(actors, deadSet)].sort()).toEqual(
      [character.id, creature.id].sort()
    )
    expect([...skippedEncounterActorIds(actors, deadSet)].sort()).toEqual(
      [character.id, creature.id].sort()
    )
    expect(skippedEncounterActorIds(actors, new Set()).has(other.id)).toBe(false)
  })

  it.each(['GM_REMOVED', 'DEPARTED'] as const)(
    'skips a %s actor without calling it defeated (D125)',
    (absence) => {
      const absent = { ...other, absence }
      expect(isEncounterActorDefeated(absent, new Set())).toBe(false)
      expect(skippedEncounterActorIds([absent], new Set()).has(absent.id)).toBe(true)
    }
  )

  it('reads staged target state over what was known', () => {
    const target = (sourceId: string, deathSaves: typeof dead | null) => ({
      actor: { kind: 'CHARACTER' as const, sourceId },
      state: { deathSaves }
    })
    expect(deadCharacterIdsOfTargets([target(OTHER_CHARACTER_ID, dead)], deadSet)).toEqual(
      new Set([CHARACTER_ID, OTHER_CHARACTER_ID])
    )
    // A revived Character leaves the set; a target without death saves changes nothing.
    expect(deadCharacterIdsOfTargets([target(CHARACTER_ID, NO_DEATH_SAVES)], deadSet)).toEqual(
      new Set()
    )
    expect(deadCharacterIdsOfTargets([target(CHARACTER_ID, null)], deadSet)).toEqual(deadSet)
  })
})
