import { useState } from 'react'

export type DraftFields = Record<string, string | number | boolean>

type Edits<T extends DraftFields> = {
  [K in keyof T]?: { value: T[K]; seen: T[K]; committed?: true }
}

export interface ServerDraft<T extends DraftFields> {
  /** The edited value for each field being edited, the server value for every other field. */
  values: T
  /** The fields being edited whose server value changed since the user last looked. */
  conflicts: (keyof T & string)[]
  /** The server's current values, for showing what a conflict would apply. */
  server: T
  setValue: <K extends keyof T & string>(key: K, value: T[K]) => void
  /** Drops the edit so the field shows the server value again. */
  acceptLatest: (key: keyof T & string) => void
  /** Acknowledges the server change and keeps the edit. */
  keepMine: (key: keyof T & string) => void
  /**
   * Call after the owner's own save of this field succeeded. The edit stays on screen until the
   * server's next value replaces it, so a value the server stored differently (trimmed, clamped)
   * is neither a conflict nor a flash of the pre-edit value.
   */
  markCommitted: (key: keyof T & string) => void
}

function editedKeysOf<T extends DraftFields>(edits: Edits<T>, server: T) {
  return Object.keys(edits).filter((key): key is keyof T & string => key in server)
}

function keepEdits<T extends DraftFields>(edits: Edits<T>, keys: (keyof T & string)[]): Edits<T> {
  const kept: Edits<T> = {}
  for (const key of keys) kept[key] = edits[key]
  return kept
}

/**
 * Local edits over server-seeded fields. An edited field keeps the user's value across server
 * refreshes and reports a conflict when the server changed it underneath the edit; an edit the
 * server has caught up with is dropped. Key the editor by record identity so a different record
 * starts from its own server values.
 */
export function useServerDraft<T extends DraftFields>(server: T): ServerDraft<T> {
  const [edits, setEdits] = useState<Edits<T>>({})

  const editedKeys = editedKeysOf(edits, server)
  const liveKeys = editedKeys.filter((key) => {
    const edit = edits[key]
    if (!edit || Object.is(edit.value, server[key])) return false
    return !(edit.committed && !Object.is(edit.seen, server[key]))
  })
  if (liveKeys.length !== editedKeys.length) {
    setEdits(keepEdits(edits, liveKeys))
  }

  const values = { ...server }
  const conflicts: (keyof T & string)[] = []
  for (const key of liveKeys) {
    const edit = edits[key]
    if (!edit) continue
    values[key] = edit.value
    if (!edit.committed && !Object.is(edit.seen, server[key])) conflicts.push(key)
  }

  return {
    values,
    conflicts,
    server,
    setValue: (key, value) =>
      setEdits((current) => ({
        ...current,
        [key]: { value, seen: current[key]?.seen ?? server[key] }
      })),
    acceptLatest: (key) =>
      setEdits((current) =>
        keepEdits(
          current,
          editedKeysOf(current, server).filter((edited) => edited !== key)
        )
      ),
    keepMine: (key) =>
      setEdits((current) => {
        const edit = current[key]
        return edit ? { ...current, [key]: { ...edit, seen: server[key] } } : current
      }),
    markCommitted: (key) =>
      setEdits((current) => {
        const edit = current[key]
        return edit ? { ...current, [key]: { ...edit, committed: true } } : current
      })
  }
}
