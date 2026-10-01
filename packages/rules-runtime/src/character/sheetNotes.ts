import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSheetNoteCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import { CharacterSheetCommandError } from './sheetCommandError.js'

type CharacterSheetNoteCommand = CharacterSheetNoteCommandInputDto extends infer Command
  ? Command extends CharacterSheetNoteCommandInputDto
    ? Omit<Command, 'commandId'>
    : never
  : never

const DEFAULT_NOTE_GROUPS = [
  { id: 'session-notes', label: 'Session Notes', sortOrder: 0, kind: 'SESSION' as const },
  { id: 'loot', label: 'Loot', sortOrder: 1, kind: 'LOOT' as const },
  { id: 'characters', label: 'Characters', sortOrder: 2, kind: 'CHARACTERS' as const },
  { id: 'places', label: 'Places', sortOrder: 3, kind: 'PLACES' as const }
]

export function getNoteGroups(character: {
  state: Pick<CharacterAuthored['state'], 'noteGroups'>
}) {
  const persistedGroups = character.state.noteGroups ?? []
  const builtInByKind = new Map(
    persistedGroups
      .filter(
        (group) =>
          group.kind !== 'CUSTOM' && !DEFAULT_NOTE_GROUPS.some((builtIn) => builtIn.id === group.id)
      )
      .map((group) => [group.kind, group])
  )

  return DEFAULT_NOTE_GROUPS.map((group) => builtInByKind.get(group.kind) ?? group)
    .concat(persistedGroups.filter((group) => group.kind === 'CUSTOM'))
    .sort(
      (left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
    )
}

function setOptionalText(value: string | null | undefined): string | undefined {
  return value == null || value.trim().length === 0 ? undefined : value
}

export function applyCharacterNoteCommand<
  T extends { state: Pick<CharacterAuthored['state'], 'notes' | 'noteGroups'> }
>(
  character: T,
  command: CharacterSheetNoteCommand,
  context: { createId?: () => string; now?: () => string } = {}
): T {
  const next = structuredClone(character)
  const createId = context.createId ?? (() => crypto.randomUUID())
  const now = context.now ?? (() => new Date().toISOString())

  const ensureNoteGroup = (groupId: string) => {
    const persistedGroup = next.state.noteGroups?.find((candidate) => candidate.id === groupId)
    if (
      persistedGroup &&
      !DEFAULT_NOTE_GROUPS.some((builtIn) => builtIn.id === persistedGroup.id)
    ) {
      return persistedGroup
    }

    const builtIn = DEFAULT_NOTE_GROUPS.find((candidate) => candidate.id === groupId)
    if (!builtIn) throw new CharacterSheetCommandError(`Note group "${groupId}" was not found.`)

    const existingBuiltIn = next.state.noteGroups?.find(
      (candidate) =>
        candidate.kind === builtIn.kind &&
        !DEFAULT_NOTE_GROUPS.some((definition) => definition.id === candidate.id)
    )
    if (existingBuiltIn) return existingBuiltIn

    const materialized = { ...builtIn, id: createId() }
    const replacedPseudoIds = new Set(
      (next.state.noteGroups ?? [])
        .filter((candidate) => candidate.kind === builtIn.kind)
        .map((candidate) => candidate.id)
    )
    next.state.noteGroups = [
      ...(next.state.noteGroups ?? []).filter((candidate) => candidate.kind !== builtIn.kind),
      materialized
    ]
    if (replacedPseudoIds.size > 0) {
      next.state.notes = next.state.notes?.map((note) =>
        replacedPseudoIds.has(note.groupId) ? { ...note, groupId: materialized.id } : note
      )
    }
    return materialized
  }

  switch (command.type) {
    case 'CREATE_NOTE': {
      const group = ensureNoteGroup(command.groupId)
      const timestamp = now()
      next.state.notes = [
        ...(next.state.notes ?? []),
        {
          id: createId(),
          title: command.title.trim(),
          body: setOptionalText(command.body),
          groupId: group.id,
          pinned: command.pinned || undefined,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ]
      return next
    }

    case 'UPDATE_NOTE': {
      const existing = next.state.notes?.find((note) => note.id === command.noteId)
      if (!existing) throw new CharacterSheetCommandError('Note was not found.')
      const group = ensureNoteGroup(command.groupId ?? existing.groupId)
      next.state.notes = next.state.notes?.map((note) =>
        note.id === command.noteId
          ? {
              ...note,
              title: command.title?.trim() ?? note.title,
              body: command.body === null ? undefined : (command.body ?? note.body),
              groupId: group.id,
              pinned: command.pinned ?? note.pinned,
              updatedAt: now()
            }
          : note
      )
      return next
    }

    case 'DELETE_NOTE':
      if (!next.state.notes?.some((note) => note.id === command.noteId))
        throw new CharacterSheetCommandError('Note was not found.')
      next.state.notes = next.state.notes.filter((note) => note.id !== command.noteId)
      return next

    case 'CREATE_NOTE_GROUP':
      next.state.noteGroups = [
        ...(next.state.noteGroups ?? []),
        {
          id: createId(),
          label: command.label.trim(),
          sortOrder: Math.max(-1, ...getNoteGroups(next).map((group) => group.sortOrder)) + 1,
          kind: 'CUSTOM'
        }
      ]
      return next

    case 'UPDATE_NOTE_GROUP': {
      const group = ensureNoteGroup(command.groupId)
      const updated = {
        ...group,
        label: command.label?.trim() ?? group.label,
        sortOrder: command.sortOrder ?? group.sortOrder
      }
      next.state.noteGroups = [
        ...(next.state.noteGroups ?? []).filter((candidate) => candidate.id !== group.id),
        updated
      ]
      return next
    }

    case 'DELETE_NOTE_GROUP': {
      const group = ensureNoteGroup(command.groupId)
      if (group.kind !== 'CUSTOM')
        throw new CharacterSheetCommandError('Built-in note groups cannot be deleted.')
      if (next.state.notes?.some((note) => note.groupId === group.id))
        throw new CharacterSheetCommandError('Move or delete the notes in this group first.')
      next.state.noteGroups = next.state.noteGroups?.filter(
        (candidate) => candidate.id !== group.id
      )
      return next
    }

    default:
      return command satisfies never
  }
}

export function projectCharacterSheetNotes(
  character: Pick<CharacterAuthored, 'profile'> & {
    state: Pick<CharacterAuthored['state'], 'notes' | 'noteGroups'>
  }
): CharacterSheetResponseDto['notes'] {
  const noteGroups = getNoteGroups(character)
  const noteItems: NonNullable<CharacterSheetResponseDto['notes']['items']> = (
    character.state.notes ?? []
  ).map((note) => ({ ...note, pinned: note.pinned ?? false }))
  return {
    alignment: character.profile.alignmentId,
    lifestyle: character.profile.lifestyleId,
    faith: character.profile.faith,
    gender: character.profile.gender,
    age: character.profile.age,
    appearance:
      [
        character.profile.height,
        character.profile.weight,
        character.profile.eyes,
        character.profile.hair,
        character.profile.skin,
        character.profile.physicalCharacteristics
      ]
        .filter(Boolean)
        .join(', ') || undefined,
    personalityTraits: character.profile.personalityTraits,
    ideals: character.profile.ideals,
    bonds: character.profile.bonds,
    flaws: character.profile.flaws,
    organizations: character.profile.organizations,
    allies: character.profile.allies,
    enemies: character.profile.enemies,
    backstory: character.profile.backstory,
    notes: character.profile.notes,
    groups: noteGroups,
    items: noteItems
  }
}
