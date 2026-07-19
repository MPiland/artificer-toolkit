import { describe, expect, it } from 'vitest'

import { toCharacterFormValues } from '../characterBuilder.utils'
import { characterBuilderPayloadFixture } from '../character.fixtures'
import {
  canMoveHitpointLevel,
  isHitpointProgressionComplete,
  moveHitpointLevel,
  syncHitpointLevels
} from '../steps/CharacterAbilitiesStep.utils'

describe('character hit point progression', () => {
  it('preserves Fighter 1 -> Wizard 1 -> Fighter 2 acquisition order', () => {
    const character = toCharacterFormValues(characterBuilderPayloadFixture)
    character.intent.classes = [{ classId: 'class-fighter', classLevel: 1 }]
    character.intent.hitpoints.levels = []

    let rows = syncHitpointLevels({
      character,
      classReferences: characterBuilderPayloadFixture.references.classes,
      requiredLevels: 1,
      resolvedAbilityScores: characterBuilderPayloadFixture.resolution.summary.abilities,
      rows: []
    })

    character.intent.classes.push({ classId: 'class-wizard', classLevel: 1 })
    rows = syncHitpointLevels({
      character,
      classReferences: characterBuilderPayloadFixture.references.classes,
      requiredLevels: 2,
      resolvedAbilityScores: characterBuilderPayloadFixture.resolution.summary.abilities,
      rows
    })

    character.intent.classes[0] = { classId: 'class-fighter', classLevel: 2 }
    rows = syncHitpointLevels({
      character,
      classReferences: characterBuilderPayloadFixture.references.classes,
      requiredLevels: 3,
      resolvedAbilityScores: characterBuilderPayloadFixture.resolution.summary.abilities,
      rows
    })

    expect(rows.map(({ level, classId, classLevel }) => ({ level, classId, classLevel }))).toEqual([
      { level: 1, classId: 'class-fighter', classLevel: 1 },
      { level: 2, classId: 'class-wizard', classLevel: 1 },
      { level: 3, classId: 'class-fighter', classLevel: 2 }
    ])
    expect(isHitpointProgressionComplete(character.intent.classes, rows)).toBe(true)
  })

  it('drops stale class levels before filling the selected progression', () => {
    const character = toCharacterFormValues(characterBuilderPayloadFixture)
    character.intent.classes = [{ classId: 'class-fighter', classLevel: 1 }]

    const rows = syncHitpointLevels({
      character,
      classReferences: characterBuilderPayloadFixture.references.classes,
      requiredLevels: 1,
      resolvedAbilityScores: characterBuilderPayloadFixture.resolution.summary.abilities,
      rows: [{ level: 1, classId: 'class-wizard', classLevel: 2, value: 5 }]
    })

    expect(rows).toMatchObject([
      { level: 1, classId: 'class-fighter', classLevel: 1 }
    ])
  })

  it('moves Wizard 1 above Fighter 2 without detaching either hit point value', () => {
    const rows = [
      { level: 1, classId: 'class-fighter', classLevel: 1, value: 12 },
      { level: 2, classId: 'class-fighter', classLevel: 2, value: 8 },
      { level: 3, classId: 'class-wizard', classLevel: 1, value: 6 }
    ]

    expect(moveHitpointLevel(rows, 2, 'up')).toEqual([
      { level: 1, classId: 'class-fighter', classLevel: 1, value: 12 },
      { level: 2, classId: 'class-wizard', classLevel: 1, value: 6 },
      { level: 3, classId: 'class-fighter', classLevel: 2, value: 8 }
    ])
  })

  it('rejects boundary moves and moves that would reverse levels of the same class', () => {
    const rows = [
      { level: 1, classId: 'class-fighter', classLevel: 1, value: 12 },
      { level: 2, classId: 'class-fighter', classLevel: 2, value: 8 },
      { level: 3, classId: 'class-wizard', classLevel: 1, value: 6 }
    ]

    expect(canMoveHitpointLevel(rows, 0, 'up')).toBe(false)
    expect(canMoveHitpointLevel(rows, 2, 'down')).toBe(false)
    expect(canMoveHitpointLevel(rows, 1, 'up')).toBe(false)
    expect(canMoveHitpointLevel(rows, 0, 'down')).toBe(false)
    expect(moveHitpointLevel(rows, 1, 'up')).toBe(rows)
  })
})
