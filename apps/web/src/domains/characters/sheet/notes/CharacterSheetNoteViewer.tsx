import { ActionIcon, Badge, Button, Text, Title } from '@mantine/core'
import { IconEdit, IconFilePlus, IconPin, IconPinnedOff, IconTrash } from '@tabler/icons-react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import type { CharacterSheet, SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as detailStyles from '../shared/detail.css'
import * as panelStyles from '../shared/panel.css'
import * as rowStyles from '../shared/rows.css'

type SheetNote = NonNullable<CharacterSheet['notes']['items']>[number]

function formatNoteDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function CharacterSheetNoteViewer({
  groupLabel,
  note,
  submitCommand,
  version,
  onCreate,
  onDelete,
  onEdit
}: {
  groupLabel: string
  note: SheetNote | null
  submitCommand: SubmitSheetCommand
  version: number
  onCreate: () => void
  onDelete: () => void
  onEdit: (note: SheetNote) => void
}) {
  if (!note) {
    return (
      <div className={detailStyles.sheetEmptyState}>
        <IconFilePlus size={28} />
        <Title order={3}>Keep the table details close</Title>
        <Text className={panelStyles.muted}>
          Add session notes, loot, characters, or places as play unfolds.
        </Text>
        <Button onClick={onCreate}>Create your first note</Button>
      </div>
    )
  }

  return (
    <article className={detailStyles.noteViewer} aria-labelledby='selected-note-title'>
      <header className={detailStyles.noteHeader}>
        <div>
          <div className={detailStyles.badgeRow}>
            <Badge variant='light'>{groupLabel}</Badge>
            {note.pinned ? (
              <Badge leftSection={<IconPin size={12} />} variant='default'>
                Pinned
              </Badge>
            ) : null}
          </div>
          <Title className={detailStyles.noteTitle} id='selected-note-title' order={3}>
            {note.title}
          </Title>
          <Text className={panelStyles.muted} size='sm'>
            Created {formatNoteDate(note.createdAt)}
            {note.updatedAt !== note.createdAt ? ` · Edited ${formatNoteDate(note.updatedAt)}` : ''}
          </Text>
        </div>
        <div className={rowStyles.compactActions}>
          <ActionIcon
            aria-label={note.pinned ? `Unpin ${note.title}` : `Pin ${note.title}`}
            variant='default'
            onClick={() =>
              submitCommand({
                type: 'UPDATE_NOTE',
                noteId: note.id,
                pinned: !note.pinned,
                expectedVersion: version
              })
            }
          >
            {note.pinned ? <IconPinnedOff size={17} /> : <IconPin size={17} />}
          </ActionIcon>
          <ActionIcon
            aria-label={`Edit ${note.title}`}
            variant='default'
            onClick={() => onEdit(note)}
          >
            <IconEdit size={17} />
          </ActionIcon>
          <ActionIcon
            aria-label={`Delete ${note.title}`}
            color='red'
            variant='subtle'
            onClick={onDelete}
          >
            <IconTrash size={17} />
          </ActionIcon>
        </div>
      </header>
      <div className={detailStyles.noteBody}>
        <AuthoredDetailProse
          html={note.body}
          fallback='This note is empty. Edit it to add details.'
        />
      </div>
    </article>
  )
}
