import { Button, NumberInput, Text, TextInput } from '@mantine/core'
import { useState } from 'react'

import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { findOption } from '#app/forms/utils/valueGuards'
import { AppSelect } from '#ui/primitives/Select'
import * as inputStyles from '#ui/primitives/Select/Select.css'
import * as inspectorEditorStyles from './inspectorEditor.css'
import * as inspectorShellStyles from './inspectorShell.css'

type SpellPanel = Extract<CharacterSheetPanelDto, { kind: 'SPELL' }>
type CustomizationOption = SpellPanel['customizationOptions'][number]
type CustomizationMode = CustomizationOption['supportedModes'][number]

const fieldClassNames = {
  root: inputStyles.root,
  label: inputStyles.label,
  description: inputStyles.description,
  required: inputStyles.required,
  input: inputStyles.input
}

function SpellCustomizationRow({
  option,
  pending,
  onDismiss,
  onRemove,
  onSet
}: {
  option: CustomizationOption
  pending: boolean
  onDismiss: () => void
  onRemove: (category: CustomizationOption['category']) => Promise<boolean>
  onSet: (input: {
    category: CustomizationOption['category']
    mode: CustomizationMode
    value: number
    sourceNote?: string
  }) => Promise<boolean>
}) {
  const configured = option.configured
  const [mode, setMode] = useState<CustomizationMode>(
    configured?.mode ?? option.supportedModes[0] ?? 'BONUS'
  )
  const [value, setValue] = useState<string | number>(configured?.value ?? '')
  const [sourceNote, setSourceNote] = useState(configured?.sourceNote ?? '')
  const [error, setError] = useState<string>()

  async function commit(nextMode: CustomizationMode = mode, nextValue: string | number = value) {
    if (nextValue === '' || !Number.isFinite(Number(nextValue))) {
      if (nextValue !== '') setError('Enter a valid number.')
      return
    }
    setError(undefined)
    const succeeded = await onSet({
      category: option.category,
      mode: nextMode,
      value: Number(nextValue),
      ...(sourceNote.trim() ? { sourceNote: sourceNote.trim() } : {})
    })
    if (succeeded) {
      if (!configured) onDismiss()
      return
    }
    setMode(configured?.mode ?? option.supportedModes[0] ?? 'BONUS')
    setValue(configured?.value ?? '')
    setSourceNote(configured?.sourceNote ?? '')
    setError('The customization could not be saved. The server value was restored.')
  }

  async function clear() {
    if (!configured) {
      onDismiss()
      return
    }
    if (await onRemove(option.category)) return
    setError('The customization could not be cleared.')
  }

  return (
    <div className={inspectorEditorStyles.customizationRow}>
      <div className={inspectorEditorStyles.customizationHeading}>
        <Text fw={700}>{option.label}</Text>
        <Button
          color='red'
          disabled={pending}
          size='xs'
          variant='subtle'
          onClick={() => void clear()}
        >
          Clear
        </Button>
      </div>
      <div className={inspectorEditorStyles.customizationFields}>
        {option.supportedModes.length > 1 ? (
          <AppSelect
            data={option.supportedModes.map((candidate) => ({
              value: candidate,
              label: candidate === 'BONUS' ? 'Bonus' : 'Override'
            }))}
            disabled={pending}
            label='Mode'
            searchable={false}
            value={mode}
            onChange={(nextMode) => {
              const typedMode = findOption(option.supportedModes, nextMode)
              if (!typedMode) return
              setMode(typedMode)
              if (configured) void commit(typedMode)
            }}
          />
        ) : null}
        <NumberInput
          allowDecimal={false}
          classNames={fieldClassNames}
          disabled={pending}
          error={error}
          hideControls
          label='Value'
          value={value}
          onBlur={() => void commit()}
          onChange={setValue}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </div>
      <TextInput
        classNames={fieldClassNames}
        disabled={pending}
        label='Source notes'
        maxLength={240}
        placeholder='Optional source or table ruling'
        value={sourceNote}
        onBlur={() => {
          if (value !== '') void commit()
        }}
        onChange={(event) => setSourceNote(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </div>
  )
}

export function CharacterSheetSpellCustomizationEditor({
  options,
  pending,
  onRemove,
  onSet
}: {
  options: SpellPanel['customizationOptions']
  pending: boolean
  onRemove: (category: CustomizationOption['category']) => Promise<boolean>
  onSet: (input: {
    category: CustomizationOption['category']
    mode: CustomizationMode
    value: number
    sourceNote?: string
  }) => Promise<boolean>
}) {
  const [draftCategory, setDraftCategory] = useState<CustomizationOption['category'] | null>(null)
  const configured = options.filter((option) => option.configured)
  const available = options.filter(
    (option) => !option.configured && option.category !== draftCategory
  )
  const draft = options.find((option) => option.category === draftCategory && !option.configured)

  return (
    <div className={inspectorEditorStyles.customizationList}>
      {configured.map((option) => (
        <SpellCustomizationRow
          key={[
            option.category,
            option.configured?.adjustmentId,
            option.configured?.mode,
            option.configured?.value,
            option.configured?.sourceNote
          ].join(':')}
          option={option}
          pending={pending}
          onDismiss={() => setDraftCategory(null)}
          onRemove={onRemove}
          onSet={onSet}
        />
      ))}
      {draft ? (
        <SpellCustomizationRow
          option={draft}
          pending={pending}
          onDismiss={() => setDraftCategory(null)}
          onRemove={onRemove}
          onSet={onSet}
        />
      ) : null}
      {available.length ? (
        <AppSelect
          clearable
          data={available.map((option) => ({
            value: option.category,
            label: option.label
          }))}
          disabled={pending}
          label='Add customization'
          placeholder='Choose an option'
          searchable={false}
          value={null}
          onChange={(category) =>
            setDraftCategory(
              available.find((option) => option.category === category)?.category ?? null
            )
          }
        />
      ) : null}
      {!options.length ? (
        <Text className={inspectorShellStyles.muted}>
          This spell has no mechanical customizations.
        </Text>
      ) : null}
    </div>
  )
}
