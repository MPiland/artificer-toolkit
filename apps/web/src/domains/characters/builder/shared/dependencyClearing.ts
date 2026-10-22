import { isRecord } from '#app/forms/utils/valueGuards'
import type { CharacterFormValues } from '../core/characterBuilder.types'
import { omitEmptyStartingEquipment } from '../steps/equipment/startingEquipment'

type CharacterClassRow = CharacterFormValues['intent']['classes'][number]
type CharacterFeatureAcquisition = CharacterFormValues['intent']['featureAcquisitions'][number]

export function clearRaceDependents(character: CharacterFormValues): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      race: {
        raceId: character.intent.race.raceId
      },
      ancestrySelections: undefined,
      featureAcquisitions: character.intent.featureAcquisitions.filter(
        (acquisition) => !isRaceOwnedFeatureSource(acquisition.source)
      ),
      chosenGrantSelections: filterOptionalIntentRows(
        character.intent.chosenGrantSelections,
        (selection) => !isRaceOwnedFeatureSource(selection.source)
      )
    }
  }
}

export function clearClassDependents(row: CharacterClassRow): CharacterClassRow {
  return {
    classId: row.classId,
    classLevel: row.classLevel
  }
}

export function clearSubclassDependents(row: CharacterClassRow): CharacterClassRow {
  return {
    ...row,
    specializationId: undefined
  }
}

export function clearBackgroundDependents(character: CharacterFormValues): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      featureAcquisitions: character.intent.featureAcquisitions.filter(
        (acquisition) => getSourceKind(acquisition.source) !== 'BACKGROUND'
      ),
      chosenGrantSelections: filterOptionalIntentRows(
        character.intent.chosenGrantSelections,
        (selection) => getSourceKind(selection.source) !== 'BACKGROUND'
      ),
      startingEquipment: omitEmptyStartingEquipment({
        ...character.intent.startingEquipment,
        background: undefined
      })
    }
  }
}

export function clearClassOwnedChoices(
  character: CharacterFormValues,
  previousRow: CharacterClassRow
): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      featureAcquisitions: character.intent.featureAcquisitions.filter(
        (acquisition) => !isClassOwnedFeatureSource(acquisition.source, previousRow)
      ),
      chosenGrantSelections: filterOptionalIntentRows(
        character.intent.chosenGrantSelections,
        (selection) => !isClassOwnedSource(selection.source, previousRow)
      ),
      spellSelections: filterOptionalIntentRows(
        character.intent.spellSelections,
        (selection) => !isClassOwnedSource(selection.source, previousRow)
      ),
      resourceGrants: filterOptionalIntentRows(
        character.intent.resourceGrants,
        (grant) => !isClassOwnedSource(grant.source, previousRow)
      )
    }
  }
}

export function clearSubclassOwnedChoices(
  character: CharacterFormValues,
  previousRow: CharacterClassRow
): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      featureAcquisitions: character.intent.featureAcquisitions.filter(
        (acquisition) => !isSubclassOwnedSource(acquisition.source, previousRow)
      ),
      chosenGrantSelections: filterOptionalIntentRows(
        character.intent.chosenGrantSelections,
        (selection) => !isSubclassOwnedSource(selection.source, previousRow)
      ),
      spellSelections: filterOptionalIntentRows(
        character.intent.spellSelections,
        (selection) => !isSubclassOwnedSource(selection.source, previousRow)
      ),
      resourceGrants: filterOptionalIntentRows(
        character.intent.resourceGrants,
        (grant) => !isSubclassOwnedSource(grant.source, previousRow)
      )
    }
  }
}

export function clearPrimaryClassDependents(character: CharacterFormValues): CharacterFormValues {
  return {
    ...character,
    intent: {
      ...character.intent,
      startingEquipment: omitEmptyStartingEquipment({
        ...character.intent.startingEquipment,
        class: undefined
      })
    }
  }
}

function isRaceOwnedFeatureSource(source: CharacterFeatureAcquisition['source']): boolean {
  const kind = getSourceKind(source)

  return kind === 'RACE' || kind === 'SUBRACE' || kind === 'ANCESTRY'
}

function isClassOwnedFeatureSource(
  source: CharacterFeatureAcquisition['source'],
  previousRow: CharacterClassRow
): boolean {
  return isClassOwnedSource(source, previousRow)
}

function isClassOwnedSource(source: unknown, previousRow: CharacterClassRow): boolean {
  const kind = getSourceKind(source)
  if (kind === 'CLASS') return getSourceString(source, 'classId') === previousRow.classId
  if (kind === 'SUBCLASS') return isSubclassOwnedSource(source, previousRow)

  return false
}

function isSubclassOwnedSource(source: unknown, previousRow: CharacterClassRow): boolean {
  if (!previousRow.subclassId) return false
  if (getSourceKind(source) !== 'SUBCLASS') return false

  return getSourceString(source, 'subclassId') === previousRow.subclassId
}

function filterOptionalIntentRows<T>(
  rows: T[] | undefined,
  predicate: (row: T) => boolean
): T[] | undefined {
  const filteredRows = rows?.filter(predicate) ?? []

  return filteredRows.length > 0 ? filteredRows : undefined
}

function getSourceKind(source: unknown): string | undefined {
  if (!source || typeof source !== 'object' || !('kind' in source)) return undefined
  const kind = source.kind

  return typeof kind === 'string' ? kind : undefined
}

function getSourceString(source: unknown, key: string): string | undefined {
  if (!isRecord(source)) return undefined
  const value = source[key]

  return typeof value === 'string' ? value : undefined
}
