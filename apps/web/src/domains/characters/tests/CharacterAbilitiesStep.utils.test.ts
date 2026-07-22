import { describe, expect, it } from 'vitest'

import { toCharacterFormValues } from '../characterBuilder.utils'
import { characterBuilderPayloadFixture } from '../character.fixtures'
import {
  isHitpointProgressionComplete,
  syncHitpointLevels
} from '../steps/CharacterAbilitiesStep.utils'

describe('character hit point progression', () => {
  it('preserves existing multiclass acquisition order when new levels are added', () => {
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

  it('derives fixed values instead of preserving submitted totals', () => {
    const character = toCharacterFormValues(characterBuilderPayloadFixture)
    character.intent.classes = [{ classId: 'class-fighter', classLevel: 2 }]

    const rows = syncHitpointLevels({
      character,
      classReferences: characterBuilderPayloadFixture.references.classes,
      resolvedAbilityScores: { CONSTITUTION: 12 },
      rows: [
        { level: 1, classId: 'class-fighter', classLevel: 1, value: 1 },
        { level: 2, classId: 'class-fighter', classLevel: 2, value: 1 }
      ]
    })

    expect(rows.map((row) => row.value)).toEqual([11, 7])
  })
})
