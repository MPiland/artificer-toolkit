import { Button, Text, Title } from '@mantine/core'
import { useState } from 'react'
import RichTextEditor from '#ui/primitives/RichTextEditor'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps, SubmitSheetCommand } from './CharacterSheet.types'
import { compactText } from './characterSheet.utils'

function CharacterSheetSessionNotesEditor({
  initialNotes,
  pending,
  submitCommand,
  version
}: {
  initialNotes: string
  pending: boolean
  submitCommand: SubmitSheetCommand
  version: number
}) {
  const [notes, setNotes] = useState(initialNotes)

  return (
    <>
      <RichTextEditor
        label='Session notes'
        name='character-sheet-notes'
        value={notes}
        onChange={setNotes}
      />
      <Button
        disabled={pending}
        onClick={() => submitCommand({
          type: 'UPDATE_NOTES',
          notes,
          expectedVersion: version
        })}
      >
        Save Notes
      </Button>
    </>
  )
}

export function CharacterSheetNotes({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion

  return (
    <section className={styles.panel} aria-labelledby='character-sheet-notes'>
      <div className={styles.panelHeader}>
        <div>
          <Title id='character-sheet-notes' className={styles.panelTitle}>Background & Notes</Title>
          <Text className={styles.muted}>Personality, story context, and active table notes.</Text>
        </div>
      </div>
      <div className={styles.rowList}>
        <div className={styles.row}>
          <div>
            <Text fw={700}>Personality</Text>
            <Text className={styles.muted}>{compactText(sheet.notes.personalityTraits)}</Text>
          </div>
        </div>
        <div className={styles.row}>
          <div>
            <Text fw={700}>Ideals, Bonds, Flaws</Text>
            <Text className={styles.muted}>
              {[sheet.notes.ideals, sheet.notes.bonds, sheet.notes.flaws].filter(Boolean).join(' ') || 'Not set'}
            </Text>
          </div>
        </div>
        <div className={styles.row}>
          <div>
            <Text fw={700}>Backstory</Text>
            <Text className={styles.muted}>{compactText(sheet.notes.backstory)}</Text>
          </div>
        </div>
      </div>

      <CharacterSheetSessionNotesEditor
        initialNotes={sheet.notes.notes ?? ''}
        key={`${version}:${sheet.notes.notes ?? ''}`}
        pending={pending}
        submitCommand={submitCommand}
        version={version}
      />
    </section>
  )
}
