import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'

export function getPreparedAndKnownSpellIds(character: CharacterAuthored): {
  learned: Set<string>
  prepared: Set<string>
} {
  const learned = new Set<string>()
  const prepared = new Set<string>()

  for (const classState of character.state.classes ?? []) {
    const classIntent = character.intent.classes.find((row) => row.classId === classState.classId)
    const knownSpellIds = classIntent
      ? getKnownSpellIdsForClassIntent(character, classIntent.classId)
      : new Set(classState.spells?.learned ?? [])
    for (const spellId of knownSpellIds) learned.add(spellId)
    for (const spellId of classState.spells?.prepared ?? []) prepared.add(spellId)
  }

  for (const selection of character.intent.spellSelections ?? []) {
    const source = selection.source
    if (source.kind === 'CLASS' || source.kind === 'SUBCLASS') {
      const classId =
        source.kind === 'CLASS'
          ? source.classId
          : character.intent.classes.find(
              (classIntent) => classIntent.subclassId === source.subclassId
            )?.classId
      if (
        classId &&
        character.state.classes?.some(
          (classState) => classState.classId === classId && classState.spells?.learned !== undefined
        )
      ) {
        continue
      }
    }
    for (const spellId of selection.spells) learned.add(spellId)
  }

  return { learned, prepared }
}

function getClassSpellSelectionIdsForClass(
  character: CharacterAuthored,
  classId: string
): Set<string> {
  const classIntent = character.intent.classes.find((entry) => entry.classId === classId)
  if (!classIntent) return new Set<string>()

  const spellIds = new Set<string>()
  for (const selection of character.intent.spellSelections ?? []) {
    if (selection.source.kind === 'CLASS' && selection.source.classId === classId) {
      for (const spellId of selection.spells) spellIds.add(spellId)
    }
    if (
      selection.source.kind === 'SUBCLASS' &&
      selection.source.subclassId === classIntent.subclassId
    ) {
      for (const spellId of selection.spells) spellIds.add(spellId)
    }
  }
  return spellIds
}

export function getKnownSpellIdsForClassIntent(
  character: CharacterAuthored,
  classId: string
): Set<string> {
  const classState = character.state.classes?.find((row) => row.classId === classId)
  if (classState?.spells?.learned !== undefined) {
    return new Set(classState.spells.learned)
  }
  return getClassSpellSelectionIdsForClass(character, classId)
}

export function getSheetSpellIdsByClass(
  output: CharacterRuleEvaluationResult['output'],
  facts: CharacterRuleEvaluationResult['facts']
): Map<string, Set<string>> {
  const spellIdsByClassId = new Map<string, Set<string>>()

  function addSpell(classId: string, spellId: string): void {
    const spellIds = spellIdsByClassId.get(classId) ?? new Set<string>()
    spellIds.add(spellId)
    spellIdsByClassId.set(classId, spellIds)
  }

  for (const classState of output.classSpellStates) {
    for (const spellId of classState.learnedSpellIds) addSpell(classState.classId, spellId)
    for (const spellId of classState.preparedSpellIds) addSpell(classState.classId, spellId)
  }
  for (const source of output.spellPreparation.sources) {
    for (const spellId of source.availableSpellIds) addSpell(source.classId, spellId)
  }
  for (const classState of facts.spellPreparationClasses) {
    for (const spellId of classState.intentSpellIds) addSpell(classState.classId, spellId)
  }

  return spellIdsByClassId
}
