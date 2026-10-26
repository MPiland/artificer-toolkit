import { CLASS_CATEGORY, HITPOINT_CALCULATION_METHOD_CODE } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CompiledClass } from '@artificer-toolkit/shared/subjects/compilers'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { parseHitDie } from '../systems/dnd5e/hitPointRules.js'
import type { CharacterBuilderRegistry, CharacterBuilderValidation } from './builderTypes.js'

type CharacterHitpointLevelEntry = CharacterAuthored['intent']['hitpoints']['levels'][number]
type CharacterHitDie = CharacterAuthored['state']['hitpoints']['hitDice'][number]
type CharacterHitpointProgressionFacts = NonNullable<
  NonNullable<CharacterRulePolicyInput['hitPointFacts']>['progression']
>

interface CharacterHitpointProgressionPreparation {
  facts: CharacterHitpointProgressionFacts
  entries: CharacterHitpointLevelEntry[]
}

export function prepareCharacterHitpointProgression(
  character: CharacterAuthored,
  authoredClasses: CharacterBuilderRegistry['classes'],
  existingCharacter: CharacterAuthored | null
): CharacterHitpointProgressionPreparation {
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

  const entries: CharacterHitpointLevelEntry[] = []
  const rows = orderedLevels.map((orderedLevel, index) => {
    const level = index + 1
    const authoredClass = authoredClasses.find(
      (record): record is Extract<CompiledClass, { category: typeof CLASS_CATEGORY.BASE }> =>
        record.category === CLASS_CATEGORY.BASE && record.id === orderedLevel.classId
    )
    const die = parseHitDie(authoredClass?.hitpoint?.dieConfig)
    const key = `${orderedLevel.classId}:${orderedLevel.classLevel}`
    const submitted = levelsByClass.get(key)
    const roll = submitted?.rolls?.[0]

    if (!authoredClass || die === null) {
      entries.push({ ...orderedLevel, level })
    } else if (
      character.intent.hitpoints.method === HITPOINT_CALCULATION_METHOD_CODE.FIXED ||
      level === 1
    ) {
      entries.push({
        level,
        classId: orderedLevel.classId,
        classLevel: orderedLevel.classLevel,
        value: orderedLevel.value
      })
    } else {
      entries.push({
        level,
        classId: orderedLevel.classId,
        classLevel: orderedLevel.classLevel,
        value: orderedLevel.value,
        ...(roll ? { rolls: submitted?.rolls } : {})
      })
    }

    return {
      sequence: index,
      level,
      classId: orderedLevel.classId,
      classLevel: orderedLevel.classLevel,
      die,
      fallbackValue: orderedLevel.value,
      rollValue: roll?.value ?? null
    }
  })

  return {
    facts: {
      method: character.intent.hitpoints.method,
      rows
    },
    entries
  }
}

export function applyCharacterHitpointProgression(
  preparation: CharacterHitpointProgressionPreparation,
  resolved: CharacterRulePolicyOutput['hitPointProgression']
): CharacterHitpointLevelEntry[] {
  if (resolved.length !== preparation.entries.length) {
    throw new Error('Character rule output did not resolve every hit point progression row.')
  }

  return resolved.map((row, index) => {
    const entry = preparation.entries[index]
    if (
      !entry ||
      row.sequence !== index ||
      row.level !== entry.level ||
      row.classId !== entry.classId ||
      row.classLevel !== entry.classLevel
    ) {
      throw new Error('Character rule output changed hit point progression identity or order.')
    }
    return { ...entry, value: row.value }
  })
}

function reconcileCharacterHitpointProgression(
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

export function appendManualHitpointValidationIssues(
  character: CharacterAuthored,
  authoredClasses: CharacterBuilderRegistry['classes'],
  validations: CharacterBuilderValidation[]
): void {
  if (character.intent.hitpoints.method !== HITPOINT_CALCULATION_METHOD_CODE.MANUAL) return

  for (const level of character.intent.hitpoints.levels) {
    if (level.level === 1) continue

    const authoredClass = authoredClasses.find(
      (record): record is Extract<CompiledClass, { category: typeof CLASS_CATEGORY.BASE }> =>
        record.category === CLASS_CATEGORY.BASE && record.id === level.classId
    )
    const die = parseHitDie(authoredClass?.hitpoint?.dieConfig)
    const rolls = level.rolls ?? []

    if (rolls.length === 0) {
      validations.push({
        code: 'MISSING_MANUAL_HITPOINT_ROLL',
        severity: 'blocking',
        sectionId: 'ABILITIES',
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
        sectionId: 'ABILITIES',
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

    const die = parseHitDie(authoredClass.hitpoint?.dieConfig)
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
