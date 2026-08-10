import { GRANT_KIND } from '@artificer-toolkit/shared/core'
import {
  isSameCharacterProvenanceIdentity,
  type CharacterAuthored,
  type ClassAuthored,
  type CharacterProvenance,
  type CharacterSpellSelectionRecord
} from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderChosenGrantChoice } from './chosenGrantChoiceResolver.js'
import type { CharacterBuilderCatalog } from './builderCatalog.js'
import type { ResolvedClassSelection } from './builderEligibility.js'
import type { CharacterBuilderValidation } from './builderService.js'

export interface CharacterSpellChoiceRequirement {
  label: string
  sourceLabel: string
  source: CharacterSpellSelectionRecord['source']
  cantripLimit: number
  learnedSpellLimit: number
  maxSpellLevel: number
  allowedClassIds: string[]
  allowedSpellIds?: string[]
}

function getActiveSpellLimit(
  spellcasting: ClassAuthored['spellcasting'],
  classLevel: number
): NonNullable<ClassAuthored['spellcasting']>['spellLimits'][number] | undefined {
  return spellcasting?.spellLimits
    .filter((limit) => limit.classLevel <= classLevel)
    .sort((left, right) => right.classLevel - left.classLevel)[0]
}

export function getSpellSelectionCounts(
  selection: CharacterSpellSelectionRecord | undefined,
  catalog: CharacterBuilderCatalog
): { cantrips: number; spells: number } {
  const spellIds = selection?.spells ?? []

  return {
    cantrips: spellIds.filter(
      (spellId) => catalog.spells.find((spell) => spell.id === spellId)?.level === 0
    ).length,
    spells: spellIds.filter((spellId) => {
      const spell = catalog.spells.find((record) => record.id === spellId)
      return spell && spell.level > 0
    }).length
  }
}

function isSpellAllowedForClassRequirement(
  spell: CharacterBuilderCatalog['spells'][number],
  requirement: CharacterSpellChoiceRequirement
): boolean {
  const matchesClass =
    spell.classIds.some((classId) => requirement.allowedClassIds.includes(classId)) ||
    requirement.allowedSpellIds?.includes(spell.id)
  if (!matchesClass) return false
  if (spell.level === 0) return true

  return spell.level <= requirement.maxSpellLevel
}

export function getInvalidSpellSelectionIds(
  selection: CharacterSpellSelectionRecord | undefined,
  requirement: CharacterSpellChoiceRequirement,
  catalog: CharacterBuilderCatalog
): string[] {
  if (!selection) return []

  return selection.spells.filter((spellId) => {
    const spell = catalog.spells.find((record) => record.id === spellId)

    return !spell || !isSpellAllowedForClassRequirement(spell, requirement)
  })
}

export function getClassSpellChoiceRequirements(
  classSelections: ResolvedClassSelection[]
): CharacterSpellChoiceRequirement[] {
  return classSelections.flatMap((selection) => {
    const requirements: CharacterSpellChoiceRequirement[] = []

    if (selection.baseClass?.spellcasting) {
      const activeLimit = getActiveSpellLimit(
        selection.baseClass.spellcasting,
        selection.row.classLevel
      )
      if (
        activeLimit &&
        ((activeLimit.cantripsLimit ?? 0) > 0 || (activeLimit.learnedSpellsLimit ?? 0) > 0)
      ) {
        const spellSlotLevels = activeLimit.slots.map((slot) => slot.spellLevel)

        requirements.push({
          label: selection.baseClass.spellcasting.magicName ?? 'Spellcasting',
          sourceLabel: selection.baseClass.label,
          source: {
            kind: 'CLASS',
            classId: selection.baseClass.id,
            classLevel: selection.row.classLevel
          },
          cantripLimit: activeLimit.cantripsLimit ?? 0,
          learnedSpellLimit: activeLimit.learnedSpellsLimit ?? 0,
          maxSpellLevel:
            Math.max(...spellSlotLevels, 0) || selection.baseClass.spellcasting.maxSpellLevel,
          allowedClassIds: [selection.baseClass.id],
          allowedSpellIds: selection.baseClass.spellcasting.availableSpellIds
        })
      }
    }

    if (selection.subclass?.spellcasting) {
      const activeLimit = getActiveSpellLimit(
        selection.subclass.spellcasting,
        selection.row.classLevel
      )
      if (
        activeLimit &&
        ((activeLimit.cantripsLimit ?? 0) > 0 || (activeLimit.learnedSpellsLimit ?? 0) > 0)
      ) {
        const spellSlotLevels = activeLimit.slots.map((slot) => slot.spellLevel)

        requirements.push({
          label: selection.subclass.spellcasting.magicName ?? 'Spellcasting',
          sourceLabel: selection.subclass.label,
          source: {
            kind: 'SUBCLASS',
            subclassId: selection.subclass.id,
            classLevel: selection.row.classLevel
          },
          cantripLimit: activeLimit.cantripsLimit ?? 0,
          learnedSpellLimit: activeLimit.learnedSpellsLimit ?? 0,
          maxSpellLevel:
            Math.max(...spellSlotLevels, 0) || selection.subclass.spellcasting.maxSpellLevel,
          allowedClassIds: [...new Set([selection.row.classId, selection.subclass.id])],
          allowedSpellIds: selection.subclass.spellcasting.availableSpellIds
        })
      }
    }

    return requirements
  })
}

export function appendDuplicateSpellSelectionIssues(
  character: CharacterAuthored,
  choices: CharacterBuilderChosenGrantChoice[],
  catalog: CharacterBuilderCatalog,
  validations: CharacterBuilderValidation[]
): void {
  const sourcesBySpellId = new Map<string, CharacterProvenance[]>()
  const addSelections = (spellIds: readonly string[], source: CharacterProvenance): void => {
    for (const spellId of spellIds) {
      const sources = sourcesBySpellId.get(spellId) ?? []
      sources.push(source)
      sourcesBySpellId.set(spellId, sources)
    }
  }

  for (const choice of choices) {
    if (choice.grantKind === GRANT_KIND.SPELL_GRANT) {
      addSelections(choice.selectedTargetIds, choice.source)
    }
  }
  for (const selection of character.intent.spellSelections ?? []) {
    addSelections(selection.spells, selection.source)
  }

  for (const [spellId, sources] of sourcesBySpellId) {
    const hasDifferentSources = sources.some((source, index) =>
      sources
        .slice(index + 1)
        .some((otherSource) => !isSameCharacterProvenanceIdentity(source, otherSource))
    )
    if (!hasDifferentSources) continue

    const spellLabel = catalog.spells.find((spell) => spell.id === spellId)?.label
    validations.push({
      code: 'DUPLICATE_SPELL_SELECTION',
      severity: 'blocking',
      message: spellLabel
        ? `Spell selection "${spellLabel}" is selected by multiple sources.`
        : `Spell selection "${spellId}" is selected by multiple sources.`
    })
  }
}
