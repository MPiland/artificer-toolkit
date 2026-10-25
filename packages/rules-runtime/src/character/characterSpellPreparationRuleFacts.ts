import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { abilityRecordIndex } from './characterDerivedRuleFacts.js'
import type { CharacterRuleContext, CharacterRuleRegistry } from './characterRuleContext.js'

type SpellPreparationRequest = NonNullable<CharacterRulePolicyInput['spellPreparationRequest']>
type ClassIntent = CharacterAuthored['intent']['classes'][number]

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function getSubclassAliasLabels(
  classIntent: ClassIntent,
  registry: CharacterRuleRegistry
): Set<string> {
  if (!classIntent.subclassId) return new Set()

  const labels = new Set<string>()
  const selectedSubclass = registry.classes.find(
    (classRecord) =>
      classRecord.id === classIntent.subclassId &&
      classRecord.category === 'SUBCLASS' &&
      classRecord.parentClassId === classIntent.classId
  )
  if (selectedSubclass?.label) labels.add(selectedSubclass.label)
  return labels
}

function getSpellSourceIds(classIntent: ClassIntent, registry: CharacterRuleRegistry): string[] {
  const sourceIds = new Set([classIntent.classId])
  if (!classIntent.subclassId) return [...sourceIds]

  sourceIds.add(classIntent.subclassId)
  const aliasLabels = getSubclassAliasLabels(classIntent, registry)
  for (const classRecord of registry.classes) {
    if (classRecord.category !== 'SUBCLASS' || classRecord.parentClassId !== classIntent.classId) {
      continue
    }
    if (
      classRecord.id === classIntent.subclassId ||
      classRecord.specializations?.some(
        (specialization) => specialization.id === classIntent.subclassId
      ) ||
      aliasLabels.has(classRecord.label)
    ) {
      sourceIds.add(classRecord.id)
    }
  }

  return [...sourceIds]
}

function getIntentSpellIds(character: CharacterAuthored, classIntent: ClassIntent): string[] {
  return unique(
    (character.intent.spellSelections ?? []).flatMap((selection) => {
      if (selection.source.kind === 'CLASS' && selection.source.classId === classIntent.classId) {
        return selection.spells
      }
      if (
        selection.source.kind === 'SUBCLASS' &&
        selection.source.subclassId === classIntent.subclassId
      ) {
        return selection.spells
      }
      return []
    })
  )
}

export function buildCharacterSpellPreparationRuleFacts(
  character: CharacterAuthored,
  registry: CharacterRuleRegistry,
  catalog: CharacterRuleContext['catalog'],
  snapshot: CharacterBuildSnapshot,
  request: SpellPreparationRequest | null = null
): Pick<
  CharacterRulePolicyInput,
  'spellPreparationClasses' | 'spellPreparationCatalog' | 'spellPreparationRequest'
> {
  const classById = new Map(registry.classes.map((classRecord) => [classRecord.id, classRecord]))

  return {
    spellPreparationClasses: character.intent.classes.map((classIntent) => {
      const classState = character.state.classes?.find(
        (state) => state.classId === classIntent.classId
      )
      return {
        classId: classIntent.classId,
        classLevel: classIntent.classLevel,
        sources: getSpellSourceIds(classIntent, registry).flatMap((sourceId) => {
          const spellcasting = classById.get(sourceId)?.spellcasting
          if (!spellcasting || classIntent.classLevel < (spellcasting.availableAtLevel ?? 1)) {
            return []
          }
          return [
            {
              sourceKind:
                sourceId === classIntent.classId ? ('CLASS' as const) : ('SUBCLASS' as const),
              sourceId,
              attributes: spellcasting.attributes ?? [],
              abilityIndex: spellcasting.ability
                ? abilityRecordIndex(snapshot.abilities, spellcasting.ability)
                : null,
              spellLimits: spellcasting.spellLimits.map((limit) => ({
                classLevel: limit.classLevel,
                preparedSpellsLimit: limit.preparedSpellsLimit ?? null,
                spellLevels: limit.slots.map((slot) => slot.spellLevel)
              })),
              prepareLimit: spellcasting.prepareLimit
                ? {
                    methodKinds: spellcasting.prepareLimit.methodKinds,
                    scaling: spellcasting.prepareLimit.scaling ?? null,
                    rounding: spellcasting.prepareLimit.rounding ?? null,
                    perLevel: (spellcasting.prepareLimit.perLevel ?? []).map((entry) => ({
                      classLevel: entry.classLevel,
                      amount: entry.amount
                    }))
                  }
                : null
            }
          ]
        }),
        learnedStatePresent: classState?.spells?.learned !== undefined,
        learnedStateSpellIds: unique(classState?.spells?.learned ?? []),
        intentSpellIds: getIntentSpellIds(character, classIntent),
        preparedStateSpellIds: unique(classState?.spells?.prepared ?? [])
      }
    }),
    spellPreparationCatalog: catalog.spells.map((spell) => ({
      spellId: spell.id,
      spellLevel: spell.level,
      classIds: unique(spell.classIds)
    })),
    spellPreparationRequest: request
      ? { classId: request.classId, spellIds: unique(request.spellIds) }
      : null
  }
}
