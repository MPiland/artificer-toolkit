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
  resolvedAbilityScores,
  rows
}: {
  character: CharacterFormValues
  classReferences: CharacterBuilderReferencesDto['classes']
  requiredLevels?: number
  resolvedAbilityScores: Record<string, number>
  rows: HitpointLevel[]
}): HitpointLevel[] {
  const classReferencesById = new Map(classReferences.map((classReference) => [classReference.id, classReference]))
  const orderedRows = getOrderedHitpointRows(character.intent.classes, rows)

  return orderedRows.map((orderedRow, index) => {
    const characterLevel = index + 1
    const classReference = classReferencesById.get(orderedRow.classId)
    const dieSides = getHitpointDieSides(classReference)
    if (!dieSides) {
      return {
        level: characterLevel,
        classId: orderedRow.classId,
        classLevel: orderedRow.classLevel,
        value: orderedRow.value,
        ...(orderedRow.rolls ? { rolls: orderedRow.rolls } : {}),
        ...(orderedRow.overridden !== undefined ? { overridden: orderedRow.overridden } : {})
      }
    }

    const hitpointAbility = classReference?.hitpoint?.ability
    const abilityModifier = hitpointAbility
      ? getHitpointAbilityModifier({
          ability: hitpointAbility,
          character,
          resolvedAbilityScores
        })
      : 0

    if (character.intent.hitpoints.method === 'FIXED' || characterLevel === 1) {
      return {
        level: characterLevel,
        classId: orderedRow.classId,
        classLevel: orderedRow.classLevel,
        value: getDefaultHitpointValue({ abilityModifier, characterLevel, dieSides })
      }
    }

    const roll = orderedRow.rolls?.[0]?.value
    const hasRoll = typeof roll === 'number' && Number.isInteger(roll)
    const legacyOverride = !hasRoll && orderedRow.existing && orderedRow.overridden !== false
    return {
      level: characterLevel,
      classId: orderedRow.classId,
      classLevel: orderedRow.classLevel,
      value: hasRoll
        ? Math.max(roll + abilityModifier, 1)
        : legacyOverride
          ? orderedRow.value
          : Math.max(abilityModifier + 1, 1),
      ...(hasRoll ? { rolls: orderedRow.rolls } : {}),
      ...(legacyOverride ? { overridden: true } : { overridden: false })
    }
  })
}

function getOrderedHitpointRows(
  classes: CharacterFormValues['intent']['classes'],
  rows: HitpointLevel[]
): Array<HitpointLevel & { existing: boolean }> {
  const selectedLevelsByClass = new Map(
    classes.map((entry) => [entry.classId, Math.max(Math.trunc(entry.classLevel), 0)])
  )
  const acceptedLevelsByClass = new Map<string, number>()
  const orderedRows: Array<HitpointLevel & { existing: boolean }> = []

  for (const row of [...rows].sort((left, right) => left.level - right.level)) {
    const selectedClassLevel = selectedLevelsByClass.get(row.classId)
    const nextClassLevel = (acceptedLevelsByClass.get(row.classId) ?? 0) + 1
    if (
      selectedClassLevel === undefined
      || row.classLevel !== nextClassLevel
      || row.classLevel > selectedClassLevel
    ) continue

    acceptedLevelsByClass.set(row.classId, row.classLevel)
    orderedRows.push({ ...row, level: orderedRows.length + 1, existing: true })
  }

  const primaryClassId = classes[0]?.classId
  if (primaryClassId) {
    const primaryIndex = orderedRows.findIndex(
      (row) => row.classId === primaryClassId && row.classLevel === 1
    )
    if (primaryIndex > 0) {
      const [primaryRow] = orderedRows.splice(primaryIndex, 1)
      if (primaryRow) orderedRows.unshift(primaryRow)
    } else if (primaryIndex === -1 && (selectedLevelsByClass.get(primaryClassId) ?? 0) >= 1) {
      orderedRows.unshift({
        level: 1,
        classId: primaryClassId,
        classLevel: 1,
        value: 1,
        overridden: false,
        existing: false
      })
      acceptedLevelsByClass.set(primaryClassId, 1)
    }
  }

  for (const classRow of classes) {
    const selectedClassLevel = selectedLevelsByClass.get(classRow.classId) ?? 0
    const acceptedClassLevel = acceptedLevelsByClass.get(classRow.classId) ?? 0
    for (let classLevel = acceptedClassLevel + 1; classLevel <= selectedClassLevel; classLevel += 1) {
      orderedRows.push({
        level: orderedRows.length + 1,
        classId: classRow.classId,
        classLevel,
        value: 1,
        overridden: false,
        existing: false
      })
    }
  }

  return orderedRows
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

export function getHitpointAbilityModifier({
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

export function getHitpointDieSides(classReference: CharacterClassReference | undefined): number | null {
  const match = /d(?<sides>\d+)/iu.exec(classReference?.hitpoint?.dieConfig ?? '')
  const sides = match?.groups?.sides ? Number(match.groups.sides) : Number.NaN

  return Number.isInteger(sides) && sides > 0 ? sides : null
}
