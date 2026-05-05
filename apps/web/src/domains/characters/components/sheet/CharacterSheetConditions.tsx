import { Button, Collapse, Select, Text, Textarea, TextInput } from '@mantine/core'
import { useState } from 'react'
import * as styles from './characterSheet.css'
import type { CharacterSheet, CharacterSheetSectionProps, SubmitSheetCommand } from './CharacterSheet.types'

function CharacterSheetConditionRow({
  condition,
  pending,
  submitCommand,
  version
}: {
  condition: CharacterSheet['overview']['conditions'][number]
  pending: boolean
  submitCommand: SubmitSheetCommand
  version: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(condition.notes ?? '')

  return (
    <div className={styles.row}>
      <div>
        <Text>{condition.label}</Text>
        {condition.description ? <Text className={styles.muted}>{condition.description}</Text> : null}
        {condition.notes ? <Text className={styles.muted}>{condition.notes}</Text> : null}
      </div>
      <div className={styles.compactActions}>
        <Button
          disabled={pending}
          size='xs'
          variant='default'
          onClick={() => setExpanded((current) => !current)}
        >
          Notes
        </Button>
        <Button
          disabled={pending}
          size='xs'
          variant='default'
          onClick={() => submitCommand({
            type: 'REMOVE_CONDITION',
            conditionTypeId: condition.conditionTypeId,
            expectedVersion: version
          })}
        >
          Remove
        </Button>
      </div>
      <Collapse className={styles.inlineEditorShell} in={expanded}>
        <div className={styles.inlineEditor}>
          <Textarea
            autosize
            label={`${condition.label} notes`}
            minRows={2}
            placeholder='Track duration, source, save timing, or table rulings.'
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
          />
          <div className={styles.compactActions}>
            <Button
              disabled={pending}
              size='xs'
              onClick={() => submitCommand({
                type: 'ADD_CONDITION',
                conditionTypeId: condition.conditionTypeId,
                notes: notes.trim() || undefined,
                expectedVersion: version
              })}
            >
              Save Notes
            </Button>
          </div>
        </div>
      </Collapse>
    </div>
  )
}

export function CharacterSheetConditions({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion
  const [conditionTypeId, setConditionTypeId] = useState<string | null>(null)
  const [conditionNotes, setConditionNotes] = useState('')
  const selectedCondition = sheet.reference.conditionOptions.find((option) => option.id === conditionTypeId)

  return (
    <>
      <div className={styles.row}>
        <div>
          <Text fw={700}>Conditions</Text>
          <Text className={styles.muted}>
            {sheet.overview.conditions.length ? sheet.overview.conditions.map((condition) => condition.label).join(', ') : 'No active conditions'}
          </Text>
          {selectedCondition?.description ? <Text className={styles.muted}>{selectedCondition.description}</Text> : null}
        </div>
        <div className={styles.compactActions}>
          <Select
            data={sheet.reference.conditionOptions.map((option) => ({
              value: option.id,
              label: option.label
            }))}
            placeholder='Add condition'
            value={conditionTypeId}
            onChange={setConditionTypeId}
            searchable
          />
          <TextInput
            aria-label='Condition notes'
            placeholder='Notes'
            value={conditionNotes}
            onChange={(event) => setConditionNotes(event.currentTarget.value)}
          />
          <Button
            disabled={pending || !conditionTypeId}
            size='xs'
            onClick={() => {
              if (!conditionTypeId) return
              submitCommand({
                type: 'ADD_CONDITION',
                conditionTypeId,
                notes: conditionNotes.trim() || undefined,
                expectedVersion: version
              })
              setConditionTypeId(null)
              setConditionNotes('')
            }}
          >
            Add
          </Button>
        </div>
      </div>

      {sheet.overview.conditions.map((condition) => (
        <CharacterSheetConditionRow
          condition={condition}
          key={`${version}:${condition.conditionTypeId}:${condition.notes ?? ''}`}
          pending={pending}
          submitCommand={submitCommand}
          version={version}
        />
      ))}
    </>
  )
}
