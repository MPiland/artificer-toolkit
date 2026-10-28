import type { z } from 'zod'
import { DEFAULT_CHARACTER_PARTY_VISIBILITY } from '@artificer-toolkit/schema/api/healthDisplay'
import {
  characterStoredPlayStateSchema,
  characterStoredRecordSchema,
  characterStoredHeadSchema
} from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  characterPlayStateSchema,
  splitCharacterPlayState
} from '@artificer-toolkit/schema/projections/characterPlayState'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import { readCharacterInventoryBase } from '@artificer-toolkit/schema/projections/characterStoredState'
import { encodeCharacterNoteRecords } from '@artificer-toolkit/schema/projections/characterOperationalState'
import type {
  CharacterCollectionRecords,
  CharacterStoredBuildState
} from '@artificer-toolkit/schema/projections/characterOperationalRecords'
import { resolveCharacterRecordStats } from '@artificer-toolkit/rules-runtime/character/characterRecordStats'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import type { CampaignInternalScope } from '../campaigns/authority'
import { readCharacterLiveHold } from '../liveSessions/authorityGuard'
import { loadCharacterSheetFacts, type CharacterSheetSourceContext } from './sheetFacts'
import { readCharacterSheetState } from './sheetStateDocuments'
import {
  scheduleCharacterSheetSections,
  storeCharacterSheetSections
} from './sheetSectionDerivation'
import {
  writeCharacterOperationalRecords,
  writeCharacterOperationalStructure
} from './operationalWrites'
import {
  readCharacterRecord,
  type CharacterDocument,
  type CharacterRecordRow
} from './stateDocuments'

type CharacterStoredRecord = z.infer<typeof characterStoredRecordSchema>
type CharacterRecordStats = ReturnType<typeof resolveCharacterRecordStats>
type CharacterRecordFields = Omit<
  CharacterStoredRecord,
  'documentJson' | 'checksum' | 'sheetState' | 'sheetStateChecksum' | 'updatedAt'
>

/** JSON without `undefined` members, as the canonical stored form has none. */
const encode = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

/**
 * The single writer of a Character. It splits complete inputs into typed operational records and
 * replaces only changed rows in the caller's transaction. The play record takes the caller's stream version; the head's
 * `updatedAt`, the Builder's concurrency clock, advances only when the structure changes. It then
 * evaluates the written Character and stores its effective maximum hit points (before active-effect
 * reductions) and typed speeds in the play record in the same transaction. A caller that already
 * evaluated the written Character passes those `stats` instead; `evaluateAs` lets a caller reuse the
 * returned facts for its own Sheet response. From the same facts it stores the derived Sheet
 * sections that Sheet queries serve (ADR 0040). Callers own authority, replay, receipts and advancing
 * the stream once per transaction.
 */
export async function writeCharacterRecord(
  ctx: MutationCtx,
  input: {
    current: CharacterRecordRow | null
    fields: Partial<CharacterRecordFields> & { streamVersion: number; updatedAt: string }
    document?: CharacterDocument
    sheetState?: CharacterSheetState
    stats?: CharacterRecordStats
    sourceContext?: CharacterSheetSourceContext
    evaluateAs?: {
      userId: string
      campaignId?: string
      catalogScope?: 'active' | 'resolution'
      authorityScope?: CampaignInternalScope
    }
  }
): Promise<{
  row: CharacterRecordRow
  facts: Awaited<ReturnType<typeof loadCharacterSheetFacts<CharacterRecordRow>>>
}> {
  const { current } = input
  const { streamVersion, updatedAt, ...structureFields } = input.fields
  const { _id: _rowId, play: _currentPlay, ...fields } = current ?? { _id: null, play: null }
  // A row read from the database also carries its system creation time.
  const { _creationTime: _created, ...stored } = { _creationTime: undefined, ...fields }
  const {
    _id: _playId,
    _creationTime: _playCreated,
    ...storedPlay
  } = {
    _creationTime: undefined,
    ...(current?.play ?? { _id: null })
  }
  if (!current && !input.document) throw new Error('A new Character needs its document.')
  const split =
    input.document || input.sheetState
      ? splitCharacterPlayState(
          {
            state: (input.document ?? readCharacterRecord(current!)).state,
            sheetState:
              input.sheetState ??
              (current
                ? readCharacterSheetState(current)
                : {
                    adjustments: [],
                    movementDisplayPreference: { mode: 'AUTO' },
                    partyVisibility: DEFAULT_CHARACTER_PARTY_VISIBILITY,
                    resourceUsage: [],
                    itemUsage: [],
                    itemDegradation: [],
                    spellCustomizations: []
                  })
          },
          // The document's inventory is the effective one; translate edits against what is stored.
          current ? readCharacterInventoryBase(current) : null
        )
      : null
  const encodedDocument: unknown =
    input.document && split
      ? encode({ ...input.document, state: split.structure.state })
      : undefined
  const encodedSheetStructure: unknown =
    input.sheetState && split ? encode(split.structure.sheetState) : undefined
  const parsedRecord = characterStoredRecordSchema.parse({
    ...stored,
    ...structureFields,
    ...(encodedDocument === undefined
      ? {}
      : {
          documentJson: canonicalizeRuleDocument(encodedDocument),
          checksum: checksumRuleDocument(encodedDocument)
        }),
    ...(encodedSheetStructure === undefined
      ? {}
      : {
          sheetState: {
            documentJson: canonicalizeRuleDocument(encodedSheetStructure),
            checksum: checksumRuleDocument(encodedSheetStructure)
          }
        }),
    // The structure clock moves only with the structure, below.
    updatedAt: current?.updatedAt ?? updatedAt
  })
  const record = {
    ...parsedRecord,
    sheetStateChecksum:
      parsedRecord.sheetState?.checksum ??
      checksumRuleDocument({
        adjustments: [],
        movementDisplayPreference: { mode: 'AUTO' },
        spellCustomizations: []
      })
  }
  const structureChanged =
    !current || checksumCanonicalJson(stored) !== checksumCanonicalJson(record)
  const held = current ? await readCharacterLiveHold(ctx, current.id) : null
  const nextRecord = structureChanged ? { ...record, updatedAt } : record
  const encodedPlay: unknown = split ? encode(split.play) : undefined
  const playRecord = characterStoredPlayStateSchema.parse({
    characterId: record.id,
    userId: record.userId,
    streamVersion,
    maximumHitPoints: input.stats?.maximumHitPoints ?? current?.play.maximumHitPoints ?? 0,
    speeds: input.stats?.speeds ?? current?.play.speeds ?? [],
    ...(encodedPlay === undefined
      ? { state: current!.play.state, checksum: current!.play.checksum }
      : {
          state: characterPlayStateSchema.parse(encodedPlay),
          checksum: checksumRuleDocument(encodedPlay)
        }),
    updatedAt: current?.play.updatedAt ?? updatedAt
  })
  const playChanged =
    !current || checksumCanonicalJson(storedPlay) !== checksumCanonicalJson(playRecord)
  if (held && current && !structureChanged && playRecord.checksum !== current.play.checksum)
    throw new Error('This Character is held by its live table; use the room for play commands.')
  // Outside structural edits invalidate the Builder inputs. The room reconciles them at its next
  // command boundary; its acknowledged checkpoint base and play fields stay intact meanwhile.
  const nextPlayRecord = held
    ? characterStoredPlayStateSchema.parse(storedPlay)
    : playChanged
      ? { ...playRecord, updatedAt }
      : playRecord
  const {
    documentJson: _documentJson,
    sheetState: _sheetState,
    checksum: _checksum,
    sheetStateChecksum: _sheetStateChecksum,
    ...headFields
  } = nextRecord
  const head = characterStoredHeadSchema.parse(headFields)
  // A refresh after a Campaign-owned change rewrites nothing unless a stored value moves.
  if (structureChanged) await writeCharacterOperationalStructure(ctx, current, nextRecord)
  if (current && structureChanged) await ctx.db.replace(current._id, head)
  const rowId = current ? current._id : await ctx.db.insert('characters', head)
  if (current && playChanged && !held) await ctx.db.replace(current.play._id, nextPlayRecord)
  const playId = current
    ? current.play._id
    : await ctx.db.insert('characterPlayStates', nextPlayRecord)
  // A DRAFT Character needs Builder repair and has no readable Sheet; it keeps its last stats.
  if (record.status !== 'ACTIVE' || input.stats !== undefined) {
    if (record.status === 'ACTIVE') await scheduleCharacterSheetSections(ctx, record.id)
    return {
      row: { ...(await ctx.db.get(rowId))!, ...nextRecord, play: (await ctx.db.get(playId))! },
      facts: null
    }
  }
  const reader = input.evaluateAs ?? { userId: record.userId }
  // Evaluate the row as written; reading it back would only return these values.
  const facts = await loadCharacterSheetFacts(
    ctx,
    reader.userId,
    record.id,
    reader.campaignId,
    input.sourceContext,
    reader.catalogScope,
    reader.authorityScope,
    { ...nextRecord, _id: rowId, play: { ...nextPlayRecord, _id: playId } }
  )
  if (!facts) throw new Error('Written Character is unavailable for evaluation.')
  const stats = resolveCharacterRecordStats(facts.ruleEvaluation)
  const unchanged =
    held ||
    (stats.maximumHitPoints === nextPlayRecord.maximumHitPoints &&
      checksumCanonicalJson(stats.speeds) === checksumCanonicalJson(nextPlayRecord.speeds))
  if (!unchanged) await ctx.db.patch(playId, stats)
  const row = unchanged
    ? facts.active
    : { ...facts.active, play: { ...facts.active.play, ...stats } }
  const written = { row, facts: { ...facts, active: row } }
  // Stored sections project the Sheet's own evaluation: active sources with their prose. A
  // resolution-scope or commit's referenced-only evaluation queues that derivation instead.
  if ((reader.catalogScope ?? 'active') === 'active' && facts.prepared.context.presentation)
    await storeCharacterSheetSections(ctx, written.facts, reader.authorityScope)
  else await scheduleCharacterSheetSections(ctx, record.id)
  return written
}

/**
 * A note edit's focused write: changed note and group records, the build's counts, the head's
 * structure clock and, unless the live table holds the Character, the play version and clock. No
 * other record is read or rewritten and nothing is evaluated, as notes change no mechanical fact.
 */
export async function writeCharacterNoteRecords(
  ctx: MutationCtx,
  input: {
    head: Doc<'characters'>
    play: Doc<'characterPlayStates'>
    build: CharacterStoredBuildState
    records: Pick<CharacterCollectionRecords, 'characterNotes' | 'characterNoteGroups'>
    next: Parameters<typeof encodeCharacterNoteRecords>[1]
    streamVersion: number
    updatedAt: string
  }
) {
  const { head, play, streamVersion, updatedAt } = input
  const after = encodeCharacterNoteRecords(input.build, input.next)
  await writeCharacterOperationalRecords(
    ctx,
    { build: input.build, collections: input.records },
    after
  )
  await ctx.db.patch(head._id, { updatedAt })
  if (await readCharacterLiveHold(ctx, head.id)) return
  const { _id, _creationTime, ...fields } = play
  await ctx.db.replace(
    _id,
    characterStoredPlayStateSchema.parse({ ...fields, streamVersion, updatedAt })
  )
  // Stored slices carry the stream version.
  await scheduleCharacterSheetSections(ctx, head.id)
}
