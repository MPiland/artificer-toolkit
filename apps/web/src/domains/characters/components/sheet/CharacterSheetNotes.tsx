import { Button, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import RichTextEditor from '#ui/primitives/RichTextEditor'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps, SubmitSheetCommand } from './CharacterSheet.types'

function CharacterSheetNoteBlock({
  html,
  title
}: {
  html?: string
  title: string
}) {
  return (
    <div className={styles.row}>
      <div>
        <Text fw={700}>{title}</Text>
        <AuthoredDetailProse html={html} fallback='Not set' />
      </div>
    </div>
  )
}

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
        <CharacterSheetNoteBlock html={sheet.notes.personalityTraits} title='Personality' />
        <CharacterSheetNoteBlock html={sheet.notes.ideals} title='Ideals' />
        <CharacterSheetNoteBlock html={sheet.notes.bonds} title='Bonds' />
        <CharacterSheetNoteBlock html={sheet.notes.flaws} title='Flaws' />
        <CharacterSheetNoteBlock html={sheet.notes.backstory} title='Backstory' />
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
