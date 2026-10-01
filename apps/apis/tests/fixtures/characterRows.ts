import type { CharacterDocument } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { MutationCtx } from '../../convex/_generated/server'
import { writeCharacterRecord } from '../../convex/characters/characterWrites'

/**
 * Inserts the Character head, typed Builder structure and play state through the canonical writer.
 * Returns the Character head's document ID.
 */
export async function insertActiveCharacterRecord(
  ctx: MutationCtx,
  character: CharacterDocument & { status: 'ACTIVE' | 'DRAFT' },
  options: {
    createdAt: string
    updatedAt?: string
    streamVersion?: number
    maximumHitPoints?: number
    walkingSpeed?: number
  }
) {
  const { row } = await writeCharacterRecord(ctx, {
    current: null,
    fields: {
      id: character.id,
      userId: character.userId,
      systemId: character.systemId,
      label: character.label,
      status: character.status,
      createdAt: options.createdAt,
      updatedAt: options.updatedAt ?? options.createdAt,
      streamVersion: options.streamVersion ?? 1
    },
    document: character,
    stats: {
      maximumHitPoints: options.maximumHitPoints ?? 0,
      walkingSpeed: options.walkingSpeed ?? 0
    }
  })
  return row._id
}
