/**
 * D87: a private note is visible to its author and the GM; a shared note to every active member.
 * Every by-ID read and write of a notebook entry or Session note passes through here so a hidden
 * note is indistinguishable from a missing one.
 */
export function canViewNote(
  note: { visibility: 'PRIVATE' | 'SHARED'; authorUserId: string },
  viewer: { userId: string; role: 'OWNER' | 'PLAYER' }
): boolean {
  return (
    viewer.role === 'OWNER' || note.visibility === 'SHARED' || note.authorUserId === viewer.userId
  )
}
