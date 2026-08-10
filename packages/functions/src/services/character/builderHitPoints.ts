import {
  CLASS_CATEGORY,
  HITPOINT_CALCULATION_METHOD_CODE,
  type AbilityCode
} from '@artificer-toolkit/shared/core'
import type {
  CharacterAuthored,
  ParentClassAuthored
} from '@artificer-toolkit/shared/subjects/authored'

import type { CharacterBuilderRegistry, CharacterBuilderValidation } from './builderService.js'

export type CharacterHitpointLevelEntry = CharacterAuthored['intent']['hitpoints']['levels'][number]
export type CharacterHitDie = CharacterAuthored['state']['hitpoints']['hitDice'][number]

export function normalizeCharacterHitpointLevels(
  character: CharacterAuthored,
  authoredClasses: CharacterBuilderRegistry['classes'],
  existingCharacter: CharacterAuthored | null,
  abilityScores: Partial<Record<AbilityCode, number>>
): CharacterHitpointLevelEntry[] {
  const submittedLevels = character.intent.hitpoints.levels
  const persistedLevels = existingCharacter?.intent.hitpoints.levels ?? []
  const levelsByClass = new Map(
    submittedLevels.map((level) => [`${level.classId}:${level.classLevel}`, level])
  )
  const existingLevelsByClass = new Map(
    persistedLevels.map((level) => [`${level.classId}:${level.classLevel}`, level])
  )
  const persistedKeys = new Set(existingLevelsByClass.keys())
  const preferredLevels = existingCharacter
    ? [
        ...[...persistedLevels].sort((left, right) => left.level - right.level),
        ...[...submittedLevels]
          .sort((left, right) => left.level - right.level)
          .filter((level) => !persistedKeys.has(`${level.classId}:${level.classLevel}`))
      ]
    : [...submittedLevels].sort((left, right) => left.level - right.level)
  const orderedLevels = reconcileCharacterHitpointProgression(
    character.intent.classes,
    preferredLevels.map((level, index) => ({ ...level, level: index + 1 }))
  )
  const primaryClassId = character.intent.classes[0]?.classId
  if (primaryClassId) {
    const primaryIndex = orderedLevels.findIndex(
      (level) => level.classId === primaryClassId && level.classLevel === 1
    )
    if (primaryIndex > 0) {
      const [primaryLevel] = orderedLevels.splice(primaryIndex, 1)
      if (primaryLevel) orderedLevels.unshift(primaryLevel)
    } else if (primaryIndex === -1) {
      const primaryKey = `${primaryClassId}:1`
      orderedLevels.unshift({
        level: 1,
        classId: primaryClassId,
        classLevel: 1,
        value:
          levelsByClass.get(primaryKey)?.value ?? existingLevelsByClass.get(primaryKey)?.value ?? 1
      })
    }
  }
  const orderedKeys = new Set(orderedLevels.map((level) => `${level.classId}:${level.classLevel}`))

  for (const classSelection of character.intent.classes) {
    for (let classLevel = 1; classLevel <= classSelection.classLevel; classLevel += 1) {
      const key = `${classSelection.classId}:${classLevel}`
      if (orderedKeys.has(key)) continue
      orderedLevels.push({
        level: orderedLevels.length + 1,
        classId: classSelection.classId,
        classLevel,
        value: levelsByClass.get(key)?.value ?? existingLevelsByClass.get(key)?.value ?? 1
      })
      orderedKeys.add(key)
    }
  }

  return orderedLevels.map((orderedLevel, index) => {
    const level = index + 1
    const authoredClass = authoredClasses.find(
      (record): record is ParentClassAuthored =>
        record.category === CLASS_CATEGORY.BASE && record.id === orderedLevel.classId
    )
    const die = parseClassHitDie(authoredClass?.hitpoint?.dieConfig)
    if (!authoredClass || die === null) return { ...orderedLevel, level }

    const hitpointAbility = authoredClass.hitpoint?.ability
    const score = hitpointAbility ? abilityScores[hitpointAbility] : undefined
    const modifier = typeof score === 'number' ? Math.floor((score - 10) / 2) : 0
    const key = `${orderedLevel.classId}:${orderedLevel.classLevel}`
    const submitted = levelsByClass.get(key)
    const persisted = existingLevelsByClass.get(key)
    const fixedDieValue = level === 1 ? die : Math.floor(die / 2) + 1

    if (
      character.intent.hitpoints.method === HITPOINT_CALCULATION_METHOD_CODE.FIXED ||
      level === 1
    ) {
      return {
        level,
        classId: orderedLevel.classId,
        classLevel: orderedLevel.classLevel,
        value: Math.max(fixedDieValue + modifier, 1)
      }
    }

    const roll = submitted?.rolls?.[0]
    const persistedLegacyOverride =
      existingCharacter?.intent.hitpoints.method === HITPOINT_CALCULATION_METHOD_CODE.MANUAL &&
      persisted !== undefined &&
      !persisted.rolls?.length &&
      persisted.overridden !== false

    return {
      level,
      classId: orderedLevel.classId,
      classLevel: orderedLevel.classLevel,
      value: roll
        ? Math.max(roll.value + modifier, 1)
        : persistedLegacyOverride
          ? Math.max(submitted?.value ?? persisted.value, 1)
          : Math.max(modifier + 1, 1),
      ...(roll ? { rolls: submitted?.rolls, overridden: false } : {}),
      ...(!roll && persistedLegacyOverride ? { overridden: true } : { overridden: false })
    }
  })
}

export function reconcileCharacterHitpointProgression(
  classes: CharacterAuthored['intent']['classes'],
  levels: CharacterHitpointLevelEntry[]
): CharacterHitpointLevelEntry[] {
  const selectedLevelsByClass = new Map(classes.map((entry) => [entry.classId, entry.classLevel]))
  const acceptedLevelsByClass = new Map<string, number>()
  const reconciled: CharacterHitpointLevelEntry[] = []

  for (const entry of [...levels].sort((left, right) => left.level - right.level)) {
    const selectedClassLevel = selectedLevelsByClass.get(entry.classId)
    const nextClassLevel = (acceptedLevelsByClass.get(entry.classId) ?? 0) + 1
    if (
      selectedClassLevel === undefined ||
      entry.classLevel !== nextClassLevel ||
      entry.classLevel > selectedClassLevel
    ) {
      continue
    }

    acceptedLevelsByClass.set(entry.classId, entry.classLevel)
    reconciled.push({ ...entry, level: reconciled.length + 1 })
  }

  return reconciled
}

function parseClassHitDie(dieConfig: string | undefined): number | null {
  const match = /^(?:1)?d([1-9]\d*)$/i.exec(dieConfig?.trim() ?? '')
  if (!match?.[1]) return null

  const die = Number(match[1])
  return Number.isSafeInteger(die) ? die : null
}

export function appendManualHitpointValidationIssues(
  character: CharacterAuthored,
  authoredClasses: CharacterBuilderRegistry['classes'],
  validations: CharacterBuilderValidation[]
): void {
  if (character.intent.hitpoints.method !== HITPOINT_CALCULATION_METHOD_CODE.MANUAL) return

  for (const level of character.intent.hitpoints.levels) {
    if (level.level === 1) continue

    const authoredClass = authoredClasses.find(
      (record): record is ParentClassAuthored =>
        record.category === CLASS_CATEGORY.BASE && record.id === level.classId
    )
    const die = parseClassHitDie(authoredClass?.hitpoint?.dieConfig)
    const rolls = level.rolls ?? []
    if (rolls.length === 0 && level.overridden === true) continue

    if (rolls.length === 0) {
      validations.push({
        code: 'MISSING_MANUAL_HITPOINT_ROLL',
        severity: 'blocking',
        message: `Character level ${level.level} requires a hit-die roll.`
      })
      continue
    }

    const roll = rolls[0]
    if (
      rolls.length !== 1 ||
      die === null ||
      !roll ||
      roll.die !== die ||
      roll.value < 1 ||
      roll.value > die
    ) {
      validations.push({
        code: 'INVALID_MANUAL_HITPOINT_ROLL',
        severity: 'blocking',
        message: `Character level ${level.level} has an invalid hit-die roll.`
      })
    }
  }
}

export function reconcileCharacterHitDice(
  selectedClasses: CharacterAuthored['intent']['classes'],
  authoredClasses: CharacterBuilderRegistry['classes'],
  currentHitDice: CharacterHitDie[]
): CharacterHitDie[] {
  const totalsByDie = new Map<number, number>()

  for (const selection of selectedClasses) {
    if (!Number.isSafeInteger(selection.classLevel) || selection.classLevel <= 0) continue

    const authoredClass = authoredClasses.find((record) => record.id === selection.classId)
    if (!authoredClass || authoredClass.category !== CLASS_CATEGORY.BASE) continue

    const die = parseClassHitDie(authoredClass.hitpoint?.dieConfig)
    if (die === null) continue

    totalsByDie.set(die, (totalsByDie.get(die) ?? 0) + selection.classLevel)
  }

  const usedByDie = new Map<number, number>()
  for (const hitDie of currentHitDice) {
    if (!Number.isSafeInteger(hitDie.die) || hitDie.die <= 0) continue
    const used = Number.isSafeInteger(hitDie.used) && hitDie.used > 0 ? hitDie.used : 0
    usedByDie.set(hitDie.die, (usedByDie.get(hitDie.die) ?? 0) + used)
  }

  return [...totalsByDie].map(([die, total]) => ({
    die,
    total,
    used: Math.min(usedByDie.get(die) ?? 0, total)
  }))
}

export function isCharacterHitpointProgressionValid(
  classes: CharacterAuthored['intent']['classes'],
  levels: CharacterHitpointLevelEntry[],
  requireComplete = false
): boolean {
  const expectedTotal = classes.reduce((sum, entry) => sum + entry.classLevel, 0)
  const reconciled = reconcileCharacterHitpointProgression(classes, levels)
  const structurallyValid =
    reconciled.length === levels.length &&
    reconciled.every(
      (entry, index) =>
        entry.level === levels[index]?.level &&
        entry.classId === levels[index]?.classId &&
        entry.classLevel === levels[index]?.classLevel
    )

  return structurallyValid && (!requireComplete || levels.length === expectedTotal)
}
