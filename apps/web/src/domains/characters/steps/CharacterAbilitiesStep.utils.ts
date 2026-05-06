import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'
import type { CharacterBuilderReferencesDto } from '@artificer-toolkit/schema/api/characters'
import {
  abilityCodes,
  standardArrayOptions,
  type CharacterFormValues
} from '../characterBuilder.utils'

type AbilityAssignment = CharacterFormValues['intent']['abilities']['assignments'][number]
type HitpointLevel = CharacterFormValues['intent']['hitpoints']['levels'][number]
type CharacterClassReference = CharacterBuilderReferencesDto['classes'][number]

export function createDefaultAbilityAssignments(): AbilityAssignment[] {
  return abilityCodes.map((ability, index) => ({
    ability,
    option: standardArrayOptions[index]?.value ?? '8'
  }))
}

export function syncHitpointLevels({
  character,
  classReferences,
  requiredLevels,
  resolvedAbilityScores,
  rows
}: {
  character: CharacterFormValues
  classReferences: CharacterBuilderReferencesDto['classes']
  requiredLevels: number
  resolvedAbilityScores: Record<string, number>
  rows: HitpointLevel[]
}): HitpointLevel[] {
  const existingRowsByLevel = new Map(rows.map((row) => [row.level, row]))
  const defaultsByLevel = createHitpointDefaults({
    character,
    classReferences,
    requiredLevels,
    resolvedAbilityScores
  })

  return Array.from({ length: requiredLevels }, (_, index) => {
    const level = index + 1
    const existingRow = existingRowsByLevel.get(level)
    if (existingRow) return existingRow

    const defaultValue = defaultsByLevel.get(level)
    if (defaultValue) {
      return {
        level,
        value: defaultValue
      }
    }

    return null
  }).filter((row): row is HitpointLevel => row !== null)
}

function createHitpointDefaults({
  character,
  classReferences,
  requiredLevels,
  resolvedAbilityScores
}: {
  character: CharacterFormValues
  classReferences: CharacterBuilderReferencesDto['classes']
  requiredLevels: number
  resolvedAbilityScores: Record<string, number>
}): Map<number, number> {
  const classReferencesById = new Map(classReferences.map((classReference) => [classReference.id, classReference]))
  const defaultsByLevel = new Map<number, number>()
  let characterLevel = 0

  for (const classRow of character.intent.classes) {
    const classLevelCount = Math.max(Math.trunc(classRow.classLevel), 0)
    const classReference = classReferencesById.get(classRow.classId)
    const dieSides = parseHitDieSides(classReference)
    const hitpointAbility = classReference?.hitpoint?.ability
    const abilityModifier = hitpointAbility
      ? getAbilityModifier({
          ability: hitpointAbility,
          character,
          resolvedAbilityScores
        })
      : 0

    for (let classLevel = 0; classLevel < classLevelCount; classLevel += 1) {
      characterLevel += 1
      if (characterLevel > requiredLevels) break
      if (!dieSides) continue

      defaultsByLevel.set(characterLevel, getDefaultHitpointValue({
        abilityModifier,
        characterLevel,
        dieSides
      }))
    }
  }

  return defaultsByLevel
}

function getDefaultHitpointValue({
  abilityModifier,
  characterLevel,
  dieSides
}: {
  abilityModifier: number
  characterLevel: number
  dieSides: number
}): number {
  const dieValue = characterLevel === 1
    ? dieSides
    : Math.floor(dieSides / 2) + 1

  return Math.max(dieValue + abilityModifier, 1)
}

function getAbilityModifier({
  ability,
  character,
  resolvedAbilityScores
}: {
  ability: string
  character: CharacterFormValues
  resolvedAbilityScores: Record<string, number>
}): number {
  const score = resolvedAbilityScores[ability] ?? getIntentAbilityScore(character, ability)

  return typeof score === 'number' && Number.isFinite(score)
    ? Math.floor((score - 10) / 2)
    : 0
}

function getIntentAbilityScore(
  character: CharacterFormValues,
  ability: string
): number | undefined {
  const abilities = character.intent.abilities
  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
    return abilities.state?.assignments.find((assignment) => assignment.ability === ability)?.score
  }

  const option = abilities.assignments.find((assignment) => assignment.ability === ability)?.option
  if (!option) return undefined

  const score = Number(option)
  return Number.isFinite(score) ? score : undefined
}

function parseHitDieSides(classReference: CharacterClassReference | undefined): number | null {
  const match = /d(?<sides>\d+)/iu.exec(classReference?.hitpoint?.dieConfig ?? '')
  const sides = match?.groups?.sides ? Number(match.groups.sides) : Number.NaN

  return Number.isInteger(sides) && sides > 0 ? sides : null
}
