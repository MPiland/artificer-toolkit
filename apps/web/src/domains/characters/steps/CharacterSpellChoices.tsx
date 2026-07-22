import { useState } from 'react'
import { Button, Group, SegmentedControl, Stack, Text, TextInput } from '@mantine/core'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'
import {
  compareCharacterBuilderLabels,
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

  const showSourceHeadings = choices.length > 1

  return (
    <Stack gap='md'>
      {choices.map((choice) => {
        const selectedCantripIds = getSelectedCantripIds(currentSelections, choice)
        const selectedSpellIds = getSelectedSpellIds(currentSelections, choice)

        return (
          <Stack key={choice.id} gap='sm'>
            {showSourceHeadings
              ? <Text fw={600}>{formatSpellSourceHeading(choice)}</Text>
              : null}
            <div className={styles.spellChoiceLists}>
              {choice.cantripLimit > 0
                ? (
                    <SpellChoiceList
                      title='Cantrips'
                      limit={choice.cantripLimit}
                      options={choice.cantripOptions}
                      selectedIds={selectedCantripIds}
                      readOnly={readOnly}
                      onToggle={(spellId) => {
                        const nextCantripIds = toggleSpellId(selectedCantripIds, spellId, choice.cantripLimit)
                        onChange(setSpellChoiceValue(currentSelections, choice, nextCantripIds, selectedSpellIds))
                      }}
                    />
                  )
                : null}
              {choice.learnedSpellLimit > 0
                ? (
                    <SpellChoiceList
                      title={choice.spellCollectionLabel}
                      limit={choice.learnedSpellLimit}
                      options={choice.spellOptions}
                      selectedIds={selectedSpellIds}
                      readOnly={readOnly}
                      onToggle={(spellId) => {
                        const nextSpellIds = toggleSpellId(selectedSpellIds, spellId, choice.learnedSpellLimit)
                        onChange(setSpellChoiceValue(currentSelections, choice, selectedCantripIds, nextSpellIds))
                      }}
                    />
                  )
                : null}
            </div>
          </Stack>
        )
      })}
    </Stack>
  )
}

function SpellChoiceList({
  limit,
  onToggle,
  options,
  readOnly,
  selectedIds,
  title
}: {
  limit: number
  onToggle: (spellId: string) => void
  options: CharacterBuilderSpellChoiceViewDto['cantripOptions']
  readOnly: boolean
  selectedIds: string[]
  title: string
}) {
  const [filter, setFilter] = useState<'all' | 'selected'>('all')
  const [query, setQuery] = useState('')
  const selectedIdSet = new Set(selectedIds)
  const normalizedQuery = query.trim().toLocaleLowerCase('en')
  const visibleOptions = options
    .filter((option) => filter === 'all' || selectedIdSet.has(option.id))
    .filter((option) => !normalizedQuery || [
      option.label,
      option.schoolLabel ?? '',
      option.disabledReason ?? ''
    ].some((value) => value.toLocaleLowerCase('en').includes(normalizedQuery)))
    .sort((left, right) => compareCharacterBuilderLabels(left.label, right.label))
  const limitReached = selectedIds.length >= limit

  return (
    <section className={styles.spellPickerSection} aria-label={title}>
      <div className={styles.spellPickerHeader}>
        <div>
          <Text fw={700}>{title}</Text>
          <Text size='sm' className={styles.mutedText}>{`${selectedIds.length} of ${limit} selected`}</Text>
        </div>
        <SegmentedControl
          size='xs'
          value={filter}
          data={[
            { value: 'all', label: 'All' },
            { value: 'selected', label: 'Selected' }
          ]}
          onChange={(value) => setFilter(value === 'selected' ? 'selected' : 'all')}
        />
      </div>
      <TextInput
        aria-label={`Search ${title.toLocaleLowerCase('en')}`}
        placeholder={`Search ${title.toLocaleLowerCase('en')}`}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      <div className={styles.spellPickerList}>
        {visibleOptions.length
          ? visibleOptions.map((option) => {
              const selected = selectedIdSet.has(option.id)
              const metadata = formatSpellMetadata(option)

              return (
                <div key={option.id} className={styles.spellPickerRow}>
                  <div className={styles.spellPickerDetails}>
                    <Text fw={600} size='sm'>{option.label}</Text>
                    {metadata || option.disabledReason
                      ? (
                          <Text size='xs' className={styles.mutedText}>
                            {[metadata, option.disabledReason].filter(Boolean).join(' · ')}
                          </Text>
                        )
                      : null}
                  </div>
                  <Button
                    type='button'
                    size='compact-sm'
                    variant={selected ? 'default' : 'light'}
                    disabled={readOnly || (!selected && (option.disabled || limitReached))}
                    onClick={() => onToggle(option.id)}
                  >
                    {selected ? 'Remove' : 'Add'}
                  </Button>
                </div>
              )
            })
          : <Text size='sm' className={styles.mutedText}>No spells match this view.</Text>}
      </div>
    </section>
  )
}

function toggleSpellId(selectedIds: string[], spellId: string, limit: number): string[] {
  if (selectedIds.includes(spellId)) return selectedIds.filter((id) => id !== spellId)
  if (selectedIds.length >= limit) return selectedIds

  return [...selectedIds, spellId]
}

function formatSpellMetadata(
  option: CharacterBuilderSpellChoiceViewDto['cantripOptions'][number]
): string {
  return [
    option.level === 0 ? undefined : `Level ${option.level}`,
    option.schoolLabel,
    option.ritual ? 'Ritual' : undefined,
    option.concentration ? 'Concentration' : undefined
  ].filter(Boolean).join(' · ')
}

function formatSpellSourceHeading(choice: CharacterBuilderSpellChoiceViewDto): string {
  if (choice.source.kind === 'SUBCLASS') return 'Subclass spells'
  if (choice.source.kind === 'CLASS') return 'Class spells'

  return choice.sourceLabel
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
  return isSameCharacterProvenanceIdentity(left, right)
}
