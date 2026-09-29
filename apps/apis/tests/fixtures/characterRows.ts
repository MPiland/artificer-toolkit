import { DEFAULT_CHARACTER_PARTY_VISIBILITY } from '@artificer-toolkit/schema/api/healthDisplay'
import { splitCharacterPlayState } from '@artificer-toolkit/schema/projections/characterPlayState'
import type { CharacterDocument } from '@artificer-toolkit/schema/projections/characterStoredState'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { MutationCtx } from '../../convex/_generated/server'

/** JSON without `undefined` members, as the canonical stored form has none. */
const encode = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

/**
 * Inserts a canonical Character row as the Character writer stores it: the Builder-owned structure
 * in the `characters` row and the play state in its `characterPlayStates` row. Returns the
 * structure row's document ID.
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
  const { structure, play } = splitCharacterPlayState({
    state: character.state,
    sheetState: {
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      partyVisibility: DEFAULT_CHARACTER_PARTY_VISIBILITY,
      resourceUsage: [],
      spellCustomizations: []
    }
  })
  const document = encode({ ...character, state: structure.state })
  const playDocument = encode(play)
  const updatedAt = options.updatedAt ?? options.createdAt
  const rowId = await ctx.db.insert('characters', {
    id: character.id,
    userId: character.userId,
    systemId: character.systemId,
    label: character.label,
    status: character.status,
    documentJson: canonicalizeRuleDocument(document),
    checksum: checksumRuleDocument(document),
    createdAt: options.createdAt,
    updatedAt
  })
  await ctx.db.insert('characterPlayStates', {
    characterId: character.id,
    userId: character.userId,
    streamVersion: options.streamVersion ?? 1,
    maximumHitPoints: options.maximumHitPoints ?? 0,
    walkingSpeed: options.walkingSpeed ?? 0,
    playJson: canonicalizeRuleDocument(playDocument),
    checksum: checksumRuleDocument(playDocument),
    updatedAt
  })
  return rowId
}
