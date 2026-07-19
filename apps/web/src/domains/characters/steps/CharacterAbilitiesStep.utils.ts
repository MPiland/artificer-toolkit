import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'
import type { CharacterBuilderReferencesDto } from '@artificer-toolkit/schema/api/characters'
import {
  abilityCodes,
  isAbilityAssignmentOption,
  standardArrayOptions,
  type CharacterAbilityFormAssignments,
  type CharacterFormValues
} from '../characterBuilder.utils'

type AbilityAssignment = CharacterAbilityFormAssignments[number]
type HitpointLevel = CharacterFormValues['intent']['hitpoints']['levels'][number]
type CharacterClassReference = CharacterBuilderReferencesDto['classes'][number]
type HitpointMoveDirection = 'up' | 'down'

export function createDefaultAbilityAssignments(): AbilityAssignment[] {
  return abilityCodes.map((ability, index) => {
    const option = standardArrayOptions[index]?.value ?? '8'

    return {
      ability,
      option: isAbilityAssignmentOption(option) ? option : '8'
    }
  })
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
  const classReferencesById = new Map(classReferences.map((classReference) => [classReference.id, classReference]))
  const classLevelsById = new Map(character.intent.classes.map((row) => [
    row.classId,
    Math.max(Math.trunc(row.classLevel), 0)
  ]))
  const acceptedClassLevels = new Map<string, number>()
  const progression: HitpointLevel[] = []

  for (const row of [...rows].sort((left, right) => left.level - right.level)) {
    const selectedClassLevel = classLevelsById.get(row.classId)
    const nextClassLevel = (acceptedClassLevels.get(row.classId) ?? 0) + 1
    if (selectedClassLevel === undefined || row.classLevel !== nextClassLevel || row.classLevel > selectedClassLevel) {
      continue
    }

    acceptedClassLevels.set(row.classId, row.classLevel)
    progression.push({ ...row, level: progression.length + 1 })
  }

  while (progression.length < requiredLevels) {
    const classRow = character.intent.classes.find((row) => (
      (acceptedClassLevels.get(row.classId) ?? 0) < Math.max(Math.trunc(row.classLevel), 0)
    ))
    if (!classRow) break

    const classLevel = (acceptedClassLevels.get(classRow.classId) ?? 0) + 1
    const characterLevel = progression.length + 1
    const classReference = classReferencesById.get(classRow.classId)
    const dieSides = parseHitDieSides(classReference)
    if (!dieSides) break

    const hitpointAbility = classReference?.hitpoint?.ability
    const abilityModifier = hitpointAbility
      ? getAbilityModifier({
          ability: hitpointAbility,
          character,
          resolvedAbilityScores
        })
      : 0

    acceptedClassLevels.set(classRow.classId, classLevel)
    progression.push({
      level: characterLevel,
      classId: classRow.classId,
      classLevel,
      value: getDefaultHitpointValue({ abilityModifier, characterLevel, dieSides })
    })
  }

  return progression
}

export function isHitpointProgressionComplete(
  classes: CharacterFormValues['intent']['classes'],
  rows: HitpointLevel[]
): boolean {
  const classLevelsById = new Map(classes.map((row) => [row.classId, Math.max(Math.trunc(row.classLevel), 0)]))
  const seenClassLevels = new Map<string, number>()
  const totalLevel = [...classLevelsById.values()].reduce((sum, level) => sum + level, 0)

  if (rows.length !== totalLevel) return false

  return [...rows]
    .sort((left, right) => left.level - right.level)
    .every((row, index) => {
      const selectedClassLevel = classLevelsById.get(row.classId)
      const nextClassLevel = (seenClassLevels.get(row.classId) ?? 0) + 1
      const valid = row.level === index + 1
        && selectedClassLevel !== undefined
        && row.classLevel === nextClassLevel
        && row.classLevel <= selectedClassLevel

      if (valid) seenClassLevels.set(row.classId, row.classLevel)
      return valid
    })
}

export function canMoveHitpointLevel(
  rows: HitpointLevel[],
  index: number,
  direction: HitpointMoveDirection
): boolean {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const row = rows[index]
  const targetRow = rows[targetIndex]

  return row !== undefined
    && targetRow !== undefined
    && row.classId !== targetRow.classId
}

export function moveHitpointLevel(
  rows: HitpointLevel[],
  index: number,
  direction: HitpointMoveDirection
): HitpointLevel[] {
  if (!canMoveHitpointLevel(rows, index, direction)) return rows

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const row = rows[index]
  const targetRow = rows[targetIndex]
  if (!row || !targetRow) return rows

  const reorderedRows = [...rows]
  reorderedRows[index] = targetRow
  reorderedRows[targetIndex] = row

  const classLevelsById = new Map<string, number>()

  return reorderedRows.map((reorderedRow, characterLevelIndex) => {
    const classLevel = (classLevelsById.get(reorderedRow.classId) ?? 0) + 1
    classLevelsById.set(reorderedRow.classId, classLevel)

    return {
      ...reorderedRow,
      level: characterLevelIndex + 1,
      classLevel
    }
  })
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
    return abilities.state.assignments.find((assignment) => assignment.ability === ability)?.score
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
