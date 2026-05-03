import { Stack, Text } from '@mantine/core'
import { AppMultiSelect } from '#ui/primitives/Select'
import {
  choiceOptions,
  type CharacterFormValues
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import type { CharacterBuilderSpellChoiceViewDto } from '@artificer-toolkit/schema/api/characters'

type CharacterSpellSelections = CharacterFormValues['intent']['spellSelections']
type CharacterSpellSelection = NonNullable<CharacterSpellSelections>[number]
type SpellSelectionSource = CharacterSpellSelection['source']

export function CharacterSpellChoices({
  choices,
  onChange,
  readOnly,
  selections
}: {
  choices: CharacterBuilderSpellChoiceViewDto[]
  onChange: (selections: CharacterSpellSelections) => void
  readOnly: boolean
  selections: CharacterSpellSelections
}) {
  if (choices.length === 0) return null

  const currentSelections = selections ?? []

  return (
    <Stack gap='md' className={styles.inlinePanel}>
      <div>
        <Text fw={700}>Spell choices</Text>
        <Text c='dimmed' size='sm'>Choose class-owned cantrips and spells from the resolver-approved list.</Text>
      </div>
      {choices.map((choice) => {
        const selectedCantripIds = getSelectedCantripIds(currentSelections, choice)
        const selectedSpellIds = getSelectedSpellIds(currentSelections, choice)

        return (
          <Stack key={choice.id} gap='sm'>
            <div>
              <Text fw={600}>{choice.label}</Text>
              <Text c='dimmed' size='sm'>{choice.sourceLabel}</Text>
            </div>
            {choice.cantripLimit > 0
              ? (
                  <AppMultiSelect
                    label={`Choose ${choice.cantripLimit} cantrip${choice.cantripLimit === 1 ? '' : 's'}`}
                    data={choiceOptions(choice.cantripOptions)}
                    value={selectedCantripIds}
                    required
                    disabled={readOnly}
                    clearable
                    maxValues={choice.cantripLimit}
                    onChange={(cantripIds) => {
                      if (readOnly) return
                      const nextSelections = setSpellChoiceValue(currentSelections, choice, cantripIds.slice(0, choice.cantripLimit), selectedSpellIds)
                      onChange(nextSelections)
                    }}
                  />
                )
              : null}
            {choice.learnedSpellLimit > 0
              ? (
                  <AppMultiSelect
                    label={`Choose ${choice.learnedSpellLimit} spell${choice.learnedSpellLimit === 1 ? '' : 's'}`}
                    data={choiceOptions(choice.spellOptions)}
                    value={selectedSpellIds}
                    required
                    disabled={readOnly}
                    clearable
                    maxValues={choice.learnedSpellLimit}
                    onChange={(spellIds) => {
                      if (readOnly) return
                      const nextSelections = setSpellChoiceValue(currentSelections, choice, selectedCantripIds, spellIds.slice(0, choice.learnedSpellLimit))
                      onChange(nextSelections)
                    }}
                  />
                )
              : null}
          </Stack>
        )
      })}
    </Stack>
  )
}

function setSpellChoiceValue(
  selections: NonNullable<CharacterSpellSelections>,
  choice: CharacterBuilderSpellChoiceViewDto,
  cantripIds: string[],
  spellIds: string[]
): CharacterSpellSelections {
  const source = choice.source
  if (!isSpellSelectionSource(source)) return selections

  const existing = selections.find((selection) => sameSource(selection.source, source))
  const selectedSpellIds = [...cantripIds, ...spellIds]
  if (selectedSpellIds.length === 0) {
    const nextSelections = selections.filter((selection) => !sameSource(selection.source, source))
    return nextSelections.length > 0 ? nextSelections : undefined
  }

  const nextSelection: CharacterSpellSelection = {
    id: existing?.id ?? crypto.randomUUID(),
    source,
    timing: getSpellChoiceTiming(source),
    spells: selectedSpellIds
  }

  return existing
    ? selections.map((selection) => sameSource(selection.source, source) ? nextSelection : selection)
    : [...selections, nextSelection]
}

function getSelectedCantripIds(
  selections: NonNullable<CharacterSpellSelections>,
  choice: CharacterBuilderSpellChoiceViewDto
): string[] {
  const cantripIds = new Set(choice.cantripOptions.map((option) => option.id))
  return getSelectedSpellIdsForChoice(selections, choice).filter((spellId) => cantripIds.has(spellId))
}

function getSelectedSpellIds(
  selections: NonNullable<CharacterSpellSelections>,
  choice: CharacterBuilderSpellChoiceViewDto
): string[] {
  const spellIds = new Set(choice.spellOptions.map((option) => option.id))
  return getSelectedSpellIdsForChoice(selections, choice).filter((spellId) => spellIds.has(spellId))
}

function getSelectedSpellIdsForChoice(
  selections: NonNullable<CharacterSpellSelections>,
  choice: CharacterBuilderSpellChoiceViewDto
): string[] {
  const source = choice.source
  if (!isSpellSelectionSource(source)) return []

  return selections.find((selection) => sameSource(selection.source, source))?.spells ?? []
}

function getSpellChoiceTiming(source: SpellSelectionSource): CharacterSpellSelection['timing'] {
  if (source.kind === 'CLASS') {
    return {
      kind: 'CLASS_LEVEL',
      classId: source.classId,
      classLevel: source.classLevel ?? 1
    }
  }

  return { kind: 'IMMEDIATE' }
}

function isSpellSelectionSource(source: CharacterBuilderSpellChoiceViewDto['source']): source is SpellSelectionSource {
  return source.kind === 'CLASS' || source.kind === 'SUBCLASS' || source.kind === 'FEATURE' || source.kind === 'OPTION'
}

function sameSource(left: SpellSelectionSource, right: SpellSelectionSource): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
