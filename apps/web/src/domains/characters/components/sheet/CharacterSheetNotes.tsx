import { ActionIcon, Badge, Button, Drawer, Modal, Select, Text, TextInput, Title } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconEdit, IconFilePlus, IconFolderPlus, IconPin, IconPinnedOff, IconSearch, IconTrash } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import RichTextEditor from '#ui/primitives/RichTextEditor'
import { CharacterSheetDetailPanel } from './CharacterSheetDetailPanel'
import * as styles from './characterSheet.css'
import type { CharacterSheet, CharacterSheetSectionProps } from './CharacterSheet.types'

type SheetNote = NonNullable<CharacterSheet['notes']['items']>[number]
type SheetNoteGroup = NonNullable<CharacterSheet['notes']['groups']>[number]

function formatNoteDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function CharacterSheetNotes({ pending, sheet, submitCommand }: CharacterSheetSectionProps) {
  const version = sheet.meta.streamVersion
  const isMobile = useMediaQuery('(max-width: 760px)', false)
  const [browseOpened, browse] = useDisclosure(false)
  const [editorOpened, editor] = useDisclosure(false)
  const [deleteOpened, deleteModal] = useDisclosure(false)
  const groups = sheet.notes.groups ?? []
  const notes = sheet.notes.items ?? []
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(notes[0]?.id ?? null)
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null
  const [query, setQuery] = useState('')
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [groupId, setGroupId] = useState<string | null>(groups[0]?.id ?? null)
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupLabel, setEditingGroupLabel] = useState('')

  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return notes
      .filter((note) => !activeGroupId || note.groupId === activeGroupId)
      .filter((note) => !normalized || note.title.toLocaleLowerCase().includes(normalized))
      .sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.updatedAt.localeCompare(left.updatedAt))
  }, [activeGroupId, notes, query])

  function startNoteEditor(note?: SheetNote) {
    setEditingNoteId(note?.id ?? null)
    setTitle(note?.title ?? '')
    setBody(note?.body ?? '')
    setGroupId(note?.groupId ?? groups[0]?.id ?? null)
    editor.open()
  }

  async function submitNote() {
    if (!title.trim() || !groupId) return
    const saved = await submitCommand(editingNoteId
      ? { type: 'UPDATE_NOTE', noteId: editingNoteId, title: title.trim(), body, groupId, expectedVersion: version }
      : { type: 'CREATE_NOTE', title: title.trim(), body, groupId, expectedVersion: version })
    if (saved) editor.close()
  }

  function groupLabel(note: SheetNote) {
    return groups.find((group) => group.id === note.groupId)?.label ?? 'Notes'
  }

  return (
    <CharacterSheetDetailPanel
      ariaId='character-sheet-notes'
      description='Table notes, journal entries, and character context.'
      title='Notes'
      headerActions={(
        <div className={styles.compactActions}>
          <Button leftSection={<IconSearch size={16} />} size='xs' variant='default' onClick={browse.open}>Browse Notes</Button>
          <Button leftSection={<IconFilePlus size={16} />} size='xs' onClick={() => startNoteEditor()}>New Note</Button>
        </div>
      )}
    >
      {selectedNote
        ? (
            <article className={styles.noteViewer} aria-labelledby='selected-note-title'>
              <header className={styles.noteHeader}>
                <div>
                  <div className={styles.badgeRow}>
                    <Badge variant='light'>{groupLabel(selectedNote)}</Badge>
                    {selectedNote.pinned ? <Badge leftSection={<IconPin size={12} />} variant='default'>Pinned</Badge> : null}
                  </div>
                  <Title className={styles.noteTitle} id='selected-note-title' order={3}>{selectedNote.title}</Title>
                  <Text className={styles.muted} size='sm'>
                    Created {formatNoteDate(selectedNote.createdAt)}
                    {selectedNote.updatedAt !== selectedNote.createdAt ? ` · Edited ${formatNoteDate(selectedNote.updatedAt)}` : ''}
                  </Text>
                </div>
                <div className={styles.compactActions}>
                  <ActionIcon
                    aria-label={selectedNote.pinned ? `Unpin ${selectedNote.title}` : `Pin ${selectedNote.title}`}
                    variant='default'
                    onClick={() => submitCommand({ type: 'UPDATE_NOTE', noteId: selectedNote.id, pinned: !selectedNote.pinned, expectedVersion: version })}
                  >
                    {selectedNote.pinned ? <IconPinnedOff size={17} /> : <IconPin size={17} />}
                  </ActionIcon>
                  <ActionIcon aria-label={`Edit ${selectedNote.title}`} variant='default' onClick={() => startNoteEditor(selectedNote)}><IconEdit size={17} /></ActionIcon>
                  <ActionIcon aria-label={`Delete ${selectedNote.title}`} color='red' variant='subtle' onClick={deleteModal.open}><IconTrash size={17} /></ActionIcon>
                </div>
              </header>
              <div className={styles.noteBody}>
                <AuthoredDetailProse html={selectedNote.body} fallback='This note is empty. Edit it to add details.' />
              </div>
            </article>
          )
        : (
            <div className={styles.sheetEmptyState}>
              <IconFilePlus size={28} />
              <Title order={3}>Keep the table details close</Title>
              <Text className={styles.muted}>Add session notes, loot, characters, or places as play unfolds.</Text>
              <Button onClick={() => startNoteEditor()}>Create your first note</Button>
            </div>
          )}

      {sheet.notes.backstory
        ? (
            <details className={styles.readOnlyDetails}>
              <summary>Character backstory</summary>
              <AuthoredDetailProse html={sheet.notes.backstory} fallback='Not set' />
            </details>
          )
        : null}

      <Drawer
        opened={browseOpened}
        onClose={browse.close}
        position={isMobile ? 'bottom' : 'right'}
        size={isMobile ? '85%' : 'md'}
        title='Browse Notes'
      >
        <div className={styles.drawerStack}>
          <TextInput leftSection={<IconSearch size={16} />} label='Search notes' placeholder='Search by title' value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          <div className={styles.filterButtons} role='group' aria-label='Filter notes by group'>
            <Button size='xs' variant={activeGroupId === null ? 'filled' : 'default'} onClick={() => setActiveGroupId(null)}>All</Button>
            {groups.map((group) => (
              <Button key={group.id} size='xs' variant={activeGroupId === group.id ? 'filled' : 'default'} onClick={() => setActiveGroupId(group.id)}>{group.label}</Button>
            ))}
          </div>
          <div className={styles.noteBrowseList}>
            {filteredNotes.map((note) => (
              <button
                className={styles.noteBrowseItem}
                key={note.id}
                type='button'
                onClick={() => { setSelectedNoteId(note.id); browse.close() }}
              >
                <span><strong>{note.title}</strong><small>{groupLabel(note)} · {formatNoteDate(note.updatedAt)}</small></span>
                {note.pinned ? <IconPin aria-label='Pinned' size={16} /> : null}
              </button>
            ))}
            {!filteredNotes.length ? <Text className={styles.muted}>No notes match this view.</Text> : null}
          </div>
          <Button leftSection={<IconFilePlus size={16} />} onClick={() => startNoteEditor()}>New Note</Button>
          <div className={styles.drawerSection}>
            <Text fw={700}>Note Groups</Text>
            {groups.map((group: SheetNoteGroup) => (
              <div className={styles.groupManagementRow} key={group.id}>
                {editingGroupId === group.id
                  ? <TextInput aria-label={`Rename ${group.label}`} value={editingGroupLabel} onChange={(event) => setEditingGroupLabel(event.currentTarget.value)} />
                  : <Text>{group.label}</Text>}
                {editingGroupId === group.id
                  ? <Button disabled={pending || !editingGroupLabel.trim()} size='compact-xs' onClick={async () => {
                      const saved = await submitCommand({ type: 'UPDATE_NOTE_GROUP', groupId: group.id, label: editingGroupLabel.trim(), expectedVersion: version })
                      if (saved) setEditingGroupId(null)
                    }}>Save</Button>
                  : <Button size='compact-xs' variant='subtle' onClick={() => { setEditingGroupId(group.id); setEditingGroupLabel(group.label) }}>Rename</Button>}
                {group.kind === 'CUSTOM' && !notes.some((note) => note.groupId === group.id)
                  ? <Button color='red' size='compact-xs' variant='subtle' onClick={() => submitCommand({ type: 'DELETE_NOTE_GROUP', groupId: group.id, expectedVersion: version })}>Delete</Button>
                  : null}
              </div>
            ))}
            <div className={styles.inlineControlRow}>
              <TextInput aria-label='New note group name' placeholder='New group name' value={newGroupLabel} onChange={(event) => setNewGroupLabel(event.currentTarget.value)} />
              <Button
                disabled={pending || !newGroupLabel.trim()}
                leftSection={<IconFolderPlus size={16} />}
                variant='default'
                onClick={async () => {
                  const saved = await submitCommand({ type: 'CREATE_NOTE_GROUP', label: newGroupLabel.trim(), expectedVersion: version })
                  if (saved) setNewGroupLabel('')
                }}
              >Add</Button>
            </div>
          </div>
        </div>
      </Drawer>

      <Drawer opened={editorOpened} onClose={editor.close} position={isMobile ? 'bottom' : 'right'} size={isMobile ? '92%' : 'lg'} title={editingNoteId ? 'Edit Note' : 'New Note'}>
        <div className={styles.drawerStack}>
          <TextInput label='Title' required value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
          <Select data={groups.map((group) => ({ value: group.id, label: group.label }))} label='Group' required value={groupId} onChange={setGroupId} />
          <RichTextEditor label='Note' name='character-sheet-note-body' readOnly={pending} value={body} onChange={setBody} />
          <Button disabled={pending || !title.trim() || !groupId} onClick={submitNote}>{editingNoteId ? 'Save Note' : 'Create Note'}</Button>
        </div>
      </Drawer>

      <Modal opened={deleteOpened} onClose={deleteModal.close} title='Delete note?'>
        <Text>{`This permanently deletes “${selectedNote?.title}”.`}</Text>
        <div className={styles.modalActions}>
          <Button variant='default' onClick={deleteModal.close}>Cancel</Button>
          <Button color='red' disabled={pending || !selectedNote} onClick={async () => {
            if (!selectedNote) return
            const deleted = await submitCommand({ type: 'DELETE_NOTE', noteId: selectedNote.id, expectedVersion: version })
            if (deleted) {
              setSelectedNoteId(null)
              deleteModal.close()
            }
          }}>Delete Note</Button>
        </div>
      </Modal>
    </CharacterSheetDetailPanel>
  )
}
