import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Button, Text, TextInput } from '@mantine/core'
import { useRef, useState } from 'react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import { AppSelect } from '#ui/primitives/Select'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import { sheetFieldClassNames } from '../shared/characterSheetFieldStyles'
import * as rowStyles from '../shared/rows.css'
import * as proficiencyStyles from '../overview/proficiencies.css'
import * as statusEditorStyles from './statusEditor.css'

export function ConditionsEditor({
  pending,
  sheet,
  submitCommand
}: {
  pending: boolean
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  submitCommand: SubmitSheetCommand
}) {
  const [conditionTypeId, setConditionTypeId] = useState<string | null>(null)
  const [conditionNotes, setConditionNotes] = useState('')
  const [conditionError, setConditionError] = useState<string | null>(null)
  const conditionSubmitRef = useRef<HTMLButtonElement>(null)
  const activeCondition = sheet.overview.conditions.find(
    (condition) => condition.conditionTypeId === conditionTypeId
  )
  const selectedCondition = sheet.reference.conditionOptions.find(
    (option) => option.id === conditionTypeId
  )

  async function submitCondition() {
    if (!conditionTypeId) return

    setConditionError(null)
    const succeeded = await submitCommand({
      type: 'ADD_CONDITION',
      conditionTypeId,
      notes: conditionNotes.trim() || undefined,
      expectedVersion: sheet.meta.streamVersion
    })

    if (!succeeded) {
      setConditionError('Condition could not be saved. Review the current Sheet and try again.')
      return
    }

    setConditionTypeId(null)
    setConditionNotes('')
  }

  async function removeCondition(targetConditionTypeId: string) {
    setConditionError(null)
    const succeeded = await submitCommand({
      type: 'REMOVE_CONDITION',
      conditionTypeId: targetConditionTypeId,
      expectedVersion: sheet.meta.streamVersion
    })

    if (!succeeded) {
      setConditionError('Condition could not be removed. The Sheet was refreshed; try again.')
    }
  }

  return (
    <div className={statusEditorStyles.statusEditorSection}>
      <div className={statusEditorStyles.statusEditorHeading}>
        <div>
          <Text className={statusEditorStyles.statusEditorTitle}>Conditions</Text>
          <Text className={statusEditorStyles.statusEditorMeta}>
            Add a condition or update its note.
          </Text>
        </div>
      </div>
      <div className={statusEditorStyles.statusControlGrid}>
        <AppSelect
          aria-label='Add condition'
          data={sheet.reference.conditionOptions
            .filter((option) => !option.levelled)
            .map((option) => ({
              value: option.id,
              label: option.label
            }))}
          disabled={pending}
          label='Condition'
          placeholder='Add condition'
          searchable
          value={conditionTypeId}
          onChange={(value) => {
            const existing = sheet.overview.conditions.find(
              (condition) => condition.conditionTypeId === value
            )
            setConditionTypeId(value)
            setConditionNotes(existing?.notes ?? '')
          }}
        />
        <TextInput
          aria-label='Condition notes'
          classNames={sheetFieldClassNames}
          disabled={pending}
          label='Condition notes (optional)'
          placeholder='Cause or context'
          value={conditionNotes}
          onBlur={(event) => {
            if (
              activeCondition &&
              conditionNotes.trim() !== (activeCondition.notes ?? '') &&
              event.relatedTarget !== conditionSubmitRef.current
            ) {
              void submitCondition()
            }
          }}
          onChange={(event) => setConditionNotes(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <Button
          className={rowStyles.compactActionControl}
          disabled={pending || !conditionTypeId}
          ref={conditionSubmitRef}
          size='xs'
          onClick={() => void submitCondition()}
        >
          {activeCondition ? 'Save' : 'Add'}
        </Button>
      </div>
      {selectedCondition?.description ? (
        <AuthoredDetailProse html={selectedCondition.description} fallback='' />
      ) : null}
      {sheet.overview.conditions.length ? (
        <div className={statusEditorStyles.statusConditionList}>
          {sheet.overview.conditions.map((condition) => (
            <div
              className={statusEditorStyles.statusConditionRow}
              key={`${condition.conditionTypeId}:${condition.notes ?? ''}`}
            >
              <div>
                <Text className={proficiencyStyles.proficiencyName}>{condition.label}</Text>
                {condition.notes ? (
                  <Text className={proficiencyStyles.proficiencyMeta}>{condition.notes}</Text>
                ) : null}
                {condition.description ? (
                  <AuthoredDetailProse html={condition.description} fallback='' />
                ) : null}
              </div>
              <div className={rowStyles.compactActions}>
                <Button
                  aria-label={`Edit ${condition.label} notes`}
                  className={rowStyles.compactActionControl}
                  disabled={pending}
                  size='xs'
                  variant='default'
                  onClick={() => {
                    setConditionTypeId(condition.conditionTypeId)
                    setConditionNotes(condition.notes ?? '')
                  }}
                >
                  Notes
                </Button>
                <Button
                  aria-label={`Remove ${condition.label} condition`}
                  className={rowStyles.compactActionControl}
                  disabled={pending}
                  size='xs'
                  variant='default'
                  onClick={() => void removeCondition(condition.conditionTypeId)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {conditionError ? (
        <Text className={rowStyles.commandInlineError} role='alert'>
          {conditionError}
        </Text>
      ) : null}
    </div>
  )
}
