import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  characterSheetSliceResponseDtoSchema,
  characterSheetSliceSchema,
  type CharacterSheetSlice
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import { characterSheetNotesDtoSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import { composeCharacterSheet } from '@artificer-toolkit/rules-runtime/character/sheetSlices'
import type { CharacterSheetSectionViewer } from '@artificer-toolkit/schema/projections/characterSheetSections'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import {
  listActiveRuleEffects,
  listCarriedActiveRuleEffects
} from '@artificer-toolkit/encounter-persistence/effectReads'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { CampaignInternalScope } from '../campaigns/authority'
import { readCampaignCharacterState } from '../campaigns/characterState'
import { readCampaignCurrencyOptions } from '../campaigns/currencySystemDocuments'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { resolveCharacterId } from './documents'
import {
  readAuthorizedCharacterSheetHead,
  readAuthorizedCharacterSheetState,
  type AuthorizedCharacterSheetState
} from './sheetInputs'
import { readCharacterSheetPendingStore } from './sheetSectionStores'
import { readCharacterSources } from './sourceReads'
import { characterSheetCampaignFields } from './sheetFingerprintInputs'
import type { Doc } from '../_generated/dataModel'
import { readCharacterPlay, type CharacterRecordRow, type CharacterRow } from './stateDocuments'

// ADR 0041: a Character write stores its derived Sheet per viewer and section; reads serve a stored
// section only while every input it was derived from is unchanged, and derive it otherwise.

export const characterSheetSection = {
  slice: (slice: Exclude<CharacterSheetSlice, 'NOTES'>) => `SLICE:${slice}`,
  panel: (target: CharacterSheetPanelTargetDto) => `PANEL:${canonicalizeJson(target)}`,
  preparation: 'PREPARATION',
  /** The viewer projection's notes, which the whole Sheet adds to its six slices. */
  notes: 'NOTES'
} as const

/** The slices a derivation stores for every viewer; NOTES is owner-only and read live. */
export const storedCharacterSheetSlices = characterSheetSliceSchema.options.filter(
  (slice): slice is Exclude<CharacterSheetSlice, 'NOTES'> => slice !== 'NOTES'
)

export type CharacterSheetSectionValue = {
  viewer: CharacterSheetSectionViewer
  section: string
  value: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The object carrying a section's stream version: a slice's `data.meta`, the preparation root.
 * Every play write bumps the version, so rows store the section without it and reads add it back:
 * a write that changes nothing else rewrites no section.
 */
function streamVersionHolder(section: string, value: unknown) {
  if (section === characterSheetSection.preparation) return isRecord(value) ? value : undefined
  if (!section.startsWith('SLICE:') || !isRecord(value) || !isRecord(value.data)) return undefined
  return isRecord(value.data.meta) ? value.data.meta : undefined
}

/** The section without its stream version, copying only the objects on the way to it. */
function withoutStreamVersion(section: string, value: unknown): unknown {
  if (!streamVersionHolder(section, value) || !isRecord(value)) return value
  if (section === characterSheetSection.preparation) {
    const { streamVersion: _version, ...rest } = value
    return rest
  }
  const data = value.data as Record<string, unknown>
  const { streamVersion: _version, ...meta } = data.meta as Record<string, unknown>
  return { ...value, data: { ...data, meta } }
}

/** Inputs the fingerprint read that a derivation in the same transaction reuses instead of re-reading. */
export type CharacterSheetFingerprintReads = {
  sources: Awaited<ReturnType<typeof readCharacterSources>>
  activeEffects: Awaited<ReturnType<typeof listActiveRuleEffects>>
  carriedEffects: Awaited<ReturnType<typeof listCarriedActiveRuleEffects>>
  /** The owner's authorized Character, draft and route, read by the store-state check. */
  authorized: AuthorizedCharacterSheetState
}

/**
 * A checksum of every stored input a Character's Sheet derivation reads: the Character, its draft
 * and route, its effects and carried Concentration, its Campaign state and the System, sources and
 * Campaign content it resolves against (content-head revisions stand for authored content). Every
 * table it reads is declared in `characterSheetInputs`, whose triggers queue a store on each write.
 */
export async function readCharacterSheetFingerprint(
  ctx: QueryCtx,
  state: { active: CharacterRecordRow; hasDraft: boolean; publicId: string },
  authorityScope?: CampaignInternalScope,
  /**
   * Inputs this transaction already read, reused instead of read again; receives the ones this
   * read loads, for a derivation in the same transaction to reuse.
   */
  reads?: Partial<CharacterSheetFingerprintReads>
) {
  const { active } = state
  const reader = { db: createConvexEncounterStoreReader(ctx) }
  const [systemChecksum, access, effects, carried] = await Promise.all([
    // The checksum row, not the 34 KB System document it stands for.
    ctx.db
      .query('systemChecksums')
      .withIndex('by_systemId', (q) => q.eq('systemId', active.systemId))
      .unique(),
    reads?.sources ?? readCharacterSources(ctx, active, active.userId, authorityScope),
    reads?.activeEffects ??
      listActiveRuleEffects(
        reader,
        { kind: 'CHARACTER', characterId: active.id },
        { ownerVerified: true }
      ),
    reads?.carriedEffects ?? listCarriedActiveRuleEffects(reader, active.id)
  ])
  if (reads)
    Object.assign(reads, {
      sources: access,
      activeEffects: effects,
      carriedEffects: carried
    })
  const { campaign } = access
  const scopes = [
    ...access.sources.map((source) => ({ scope: 'SOURCE' as const, scopeId: source.id })),
    ...(campaign ? [{ scope: 'CAMPAIGN' as const, scopeId: campaign.id }] : [])
  ]
  const [heads, campaignState, currencyOptions] = await Promise.all([
    Promise.all(
      scopes.map(({ scope, scopeId }) =>
        ctx.db
          .query('contentSnapshotHeads')
          .withIndex('by_scope_scopeId', (q) => q.eq('scope', scope).eq('scopeId', scopeId))
          .unique()
      )
    ),
    campaign ? readCampaignCharacterState(ctx, campaign.id, active.id) : null,
    campaign ? readCampaignCurrencyOptions(ctx, campaign) : []
  ])
  return checksumCanonicalJson({
    character: {
      checksum: active.checksum,
      sheetStateChecksum: active.sheetStateChecksum,
      // Not the stream version: stored sections leave it out and reads add it back.
      playChecksum: active.play.checksum
    },
    hasDraft: state.hasDraft,
    publicId: state.publicId,
    systemChecksum: systemChecksum?.checksum ?? null,
    campaign: campaign ? characterSheetCampaignFields(campaign) : null,
    contentRevisions: scopes.map((scope, index) => [
      scope.scope,
      scope.scopeId,
      heads[index]?.revision ?? null
    ]),
    campaignState: campaignState?.state ?? null,
    currencyOptions,
    effects,
    carried
  })
}

function readSectionRow(
  ctx: QueryCtx,
  characterId: string,
  viewer: CharacterSheetSectionViewer,
  section: string
) {
  return ctx.db
    .query('characterSheetSections')
    .withIndex('by_characterId_viewer_section', (q) =>
      q.eq('characterId', characterId).eq('viewer', viewer).eq('section', section)
    )
    .unique()
}

function readDerivationRow(ctx: QueryCtx, characterId: string) {
  return ctx.db
    .query('characterSheetDerivations')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
}

function readSectionChecksumsRow(ctx: QueryCtx, characterId: string) {
  return ctx.db
    .query('characterSheetSectionChecksums')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
}

/** The authorized Character while its stored sections match its current inputs. */
async function readCurrentStoredReader(
  ctx: QueryCtx,
  userId: string,
  id: string,
  campaignId?: string
) {
  const [authorized, derivation] = await Promise.all([
    readAuthorizedCharacterSheetState(ctx, userId, id, campaignId),
    readDerivationRow(ctx, id)
  ])
  if (!authorized || !derivation) return null
  const { active, draft, route } = authorized
  const fingerprint = await readCharacterSheetFingerprint(ctx, {
    active,
    hasDraft: draft !== null,
    publicId: route.publicId
  })
  return derivation.fingerprint === fingerprint ? { head: active, play: active.play } : null
}

/**
 * The sections as stored for this reader, after the same authority the derived read applies, while
 * they are current or, for `whileQueued` reads, while a queued store will replace them (ADR 0041
 * Amendment 2). Undefined on any miss, and the caller derives them (which also reports access and
 * Builder repair errors: a store that finds repair settles its queue and stores nothing).
 */
export async function readStoredCharacterSheetSections(
  ctx: QueryCtx,
  input: {
    userId: string
    lookupId: string
    campaignId?: string
    /** Another member reading through "Party can view"; `userId` is then the Character owner. */
    party?: boolean
    sections: readonly string[]
    /**
     * Serve the last stored sections, with the current stream version, while the Character's store
     * is queued: the Sheet keeps showing a value instead of deriving live in the write-to-store gap,
     * and the queued store replaces it reactively. One-shot reads that must see the write leave it off.
     */
    whileQueued: boolean
  }
): Promise<unknown[] | undefined> {
  const id = await resolveCharacterId(ctx, input.lookupId)
  if (!id) return undefined
  const pending = input.whileQueued ? await readCharacterSheetPendingStore(ctx, id) : null
  // Every write that moves the fingerprint queues the store in its own transaction, so a queued
  // store means the rows are at most that store behind and the read needs only the head's
  // authority; without one the rows must match the current inputs.
  const reader = pending
    ? await readAuthorizedCharacterSheetHead(ctx, input.userId, id, input.campaignId)
    : await readCurrentStoredReader(ctx, input.userId, id, input.campaignId)
  if (!reader) return undefined
  const { head, play } = reader
  const { partyVisibility } = readCharacterPlay(play)
  if (input.party && !partyVisibility.sheet) return undefined
  const viewer: CharacterSheetSectionViewer = input.party
    ? 'PARTY_MEMBER'
    : head.userId === input.userId
      ? 'CHARACTER_OWNER'
      : 'CAMPAIGN_OWNER'
  const rows = await Promise.all(
    input.sections.map((section) => readSectionRow(ctx, id, viewer, section))
  )
  const values: unknown[] = []
  // A store writes the rows and the derivation in one transaction and deletes the rows it no
  // longer derives, so every stored row belongs to the stored derivation.
  for (const [index, section] of input.sections.entries()) {
    const row = rows[index]
    if (!row) return undefined
    const value: unknown = JSON.parse(row.json)
    const holder = streamVersionHolder(section, value)
    if (holder) holder.streamVersion = play.streamVersion
    values.push(value)
  }
  return values
}

/**
 * The reader's whole Sheet composed from its stored slices and notes while they are current. Never
 * while a store is queued: its readers are one-shot reads that must see the write before it.
 */
export async function readStoredCharacterSheet(
  ctx: QueryCtx,
  input: Omit<Parameters<typeof readStoredCharacterSheetSections>[1], 'sections' | 'whileQueued'>
) {
  const stored = await readStoredCharacterSheetSections(ctx, {
    ...input,
    sections: [
      ...storedCharacterSheetSlices.map(characterSheetSection.slice),
      characterSheetSection.notes
    ],
    whileQueued: false
  })
  if (!stored) return undefined
  const notes = characterSheetNotesDtoSchema.parse(stored.pop())
  return composeCharacterSheet(
    stored.map((slice) => characterSheetSliceResponseDtoSchema.parse(slice)),
    notes
  )
}

/**
 * Whether the stored derivation was made from the Character's current inputs, with the
 * fingerprint of those inputs for a store in the same transaction to reuse.
 */
export async function readCharacterSheetStoreState(
  ctx: QueryCtx,
  userId: string,
  characterId: string,
  reads?: Partial<CharacterSheetFingerprintReads>,
  /** The active row this transaction already read, used instead of reading it again. */
  active?: CharacterRow
) {
  const authorized = await readAuthorizedCharacterSheetState(
    ctx,
    userId,
    characterId,
    undefined,
    undefined,
    active
  )
  if (!authorized) return null
  if (reads) reads.authorized = authorized
  const [derivation, fingerprint] = await Promise.all([
    readDerivationRow(ctx, characterId),
    readCharacterSheetFingerprint(
      ctx,
      {
        active: authorized.active,
        hasDraft: authorized.draft !== null,
        publicId: authorized.route.publicId
      },
      undefined,
      reads
    )
  ])
  return { current: derivation?.fingerprint === fingerprint, fingerprint, derivation }
}

/** Replaces the Character's stored sections, writing only those whose checksum changed. */
export async function writeCharacterSheetSections(
  ctx: MutationCtx,
  characterId: string,
  fingerprint: string,
  values: readonly CharacterSheetSectionValue[],
  /** The derivation row this transaction already read, null when there is none. */
  read?: Doc<'characterSheetDerivations'> | null
) {
  const key = (section: { viewer: string; section: string }) =>
    `${section.viewer} ${section.section}`
  const [stored, checksums] = await Promise.all([
    read !== undefined ? read : readDerivationRow(ctx, characterId),
    readSectionChecksumsRow(ctx, characterId)
  ])
  const storedChecksums = new Map(
    (checksums?.sections ?? []).map((section) => [key(section), section.checksum])
  )
  const sections = values.map(({ viewer, section, value }) => {
    // Projection builds each section in a fixed key order, so plain serialisation is as stable
    // as canonical JSON at a fraction of its cost; a checksum only compares derivations.
    const json = JSON.stringify(withoutStreamVersion(section, value))
    return { viewer, section, checksum: sha256Hex(json), json }
  })
  for (const { json, ...identity } of sections) {
    if (storedChecksums.get(key(identity)) === identity.checksum) continue
    const existing = await readSectionRow(ctx, characterId, identity.viewer, identity.section)
    const row = { characterId, ...identity, json }
    if (existing) await ctx.db.replace('characterSheetSections', existing._id, row)
    else await ctx.db.insert('characterSheetSections', row)
  }
  const kept = new Set(sections.map(key))
  for (const section of checksums?.sections ?? []) {
    if (kept.has(key(section))) continue
    const existing = await readSectionRow(ctx, characterId, section.viewer, section.section)
    if (existing) await ctx.db.delete('characterSheetSections', existing._id)
  }
  const identities = sections.map(({ viewer, section, checksum }) => ({
    viewer,
    section,
    checksum
  }))
  if (!checksums)
    await ctx.db.insert('characterSheetSectionChecksums', { characterId, sections: identities })
  else if (checksumCanonicalJson(checksums.sections) !== checksumCanonicalJson(identities))
    await ctx.db.replace('characterSheetSectionChecksums', checksums._id, {
      characterId,
      sections: identities
    })
  if (!stored) await ctx.db.insert('characterSheetDerivations', { characterId, fingerprint })
  else if (stored.fingerprint !== fingerprint)
    await ctx.db.replace('characterSheetDerivations', stored._id, { characterId, fingerprint })
}
