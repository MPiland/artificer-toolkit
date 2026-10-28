import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { CharacterSheetSlice } from '@artificer-toolkit/schema/api/characterSheetSlices'
import type { CharacterSheetSectionViewer } from '@artificer-toolkit/schema/projections/characterSheetSections'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { makeFunctionReference } from 'convex/server'
import {
  listActiveRuleEffects,
  listCarriedActiveRuleEffects
} from '@artificer-toolkit/encounter-persistence/effectStore'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { CampaignInternalScope } from '../campaigns/authority'
import { readCampaignCharacterState } from '../campaigns/characterState'
import { readCampaignCurrencyOptions } from '../campaigns/currencySystemDocuments'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { readCharacterSheetState } from './documents'
import { readAuthorizedCharacterSheetState } from './sheetInputs'
import { readCharacterSources } from './sourceReads'
import type { CharacterRecordRow } from './stateDocuments'

// ADR 0040: a Character write stores its derived Sheet per viewer and section; reads serve a stored
// section only while every input it was derived from is unchanged, and derive it otherwise.

export const characterSheetSection = {
  slice: (slice: Exclude<CharacterSheetSlice, 'NOTES'>) => `SLICE:${slice}`,
  panel: (target: CharacterSheetPanelTargetDto) => `PANEL:${canonicalizeJson(target)}`,
  preparation: 'PREPARATION'
} as const

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

/**
 * A checksum of every stored input a Character's Sheet derivation reads: the Character, its draft
 * and route, its effects and carried Concentration, its Campaign state and the System, sources and
 * Campaign content it resolves against (content-head revisions stand for authored content).
 */
export async function readCharacterSheetFingerprint(
  ctx: QueryCtx,
  state: { active: CharacterRecordRow; hasDraft: boolean; publicId: string },
  authorityScope?: CampaignInternalScope
) {
  const { active } = state
  const reader = { db: createConvexEncounterStoreReader(ctx) }
  const [system, access, effects, carried] = await Promise.all([
    ctx.db
      .query('systems')
      .withIndex('by_publicId', (q) => q.eq('id', active.systemId))
      .unique(),
    readCharacterSources(ctx, active, active.userId, authorityScope),
    listActiveRuleEffects(
      reader,
      { kind: 'CHARACTER', characterId: active.id },
      { ownerVerified: true }
    ),
    listCarriedActiveRuleEffects(reader, active.id)
  ])
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
    systemChecksum: system?.checksum ?? null,
    // Only the Campaign fields Sheet derivation reads: notebook and counter patches must not miss.
    campaign: campaign
      ? {
          id: campaign.id,
          ownerUserId: campaign.ownerUserId,
          gameSystemId: campaign.gameSystemId,
          status: campaign.status,
          contentMaturity: campaign.contentMaturity ?? null,
          attunementSlotOverride: campaign.attunementSlotOverride ?? null,
          primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
          additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
        }
      : null,
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

/**
 * The section as stored for this reader while it is current, after the same authority the derived
 * read applies; undefined on any miss, and the caller derives it (which also reports access errors).
 */
export async function readStoredCharacterSheetSection(
  ctx: QueryCtx,
  input: {
    userId: string
    lookupId: string
    campaignId?: string
    /** Another member reading through "Party can view"; `userId` is then the Character owner. */
    party?: boolean
    section: string
  }
): Promise<unknown> {
  const authorized = await readAuthorizedCharacterSheetState(
    ctx,
    input.userId,
    input.lookupId,
    input.campaignId
  )
  if (!authorized) return undefined
  const { active } = authorized
  if (input.party && !readCharacterSheetState(active).partyVisibility.sheet) return undefined
  const viewer: CharacterSheetSectionViewer = input.party
    ? 'PARTY_MEMBER'
    : active.userId === input.userId
      ? 'CHARACTER_OWNER'
      : 'CAMPAIGN_OWNER'
  const [derivation, row, fingerprint] = await Promise.all([
    readDerivationRow(ctx, active.id),
    readSectionRow(ctx, active.id, viewer, input.section),
    readCharacterSheetFingerprint(ctx, {
      active,
      hasDraft: authorized.draft !== null,
      publicId: authorized.route.publicId
    })
  ])
  if (!derivation || !row || derivation.fingerprint !== fingerprint) return undefined
  const entry = derivation.sections.find(
    (section) => section.viewer === viewer && section.section === input.section
  )
  if (entry?.checksum !== row.checksum) return undefined
  const value: unknown = JSON.parse(row.json)
  const holder = streamVersionHolder(input.section, value)
  if (holder) holder.streamVersion = active.play.streamVersion
  return value
}

/** Replaces the Character's stored sections, writing only those whose checksum changed. */
export async function writeCharacterSheetSections(
  ctx: MutationCtx,
  characterId: string,
  fingerprint: string,
  values: readonly CharacterSheetSectionValue[]
) {
  const key = (section: { viewer: string; section: string }) =>
    `${section.viewer} ${section.section}`
  const stored = await readDerivationRow(ctx, characterId)
  const storedChecksums = new Map(
    (stored?.sections ?? []).map((section) => [key(section), section.checksum])
  )
  const sections = values.map(({ viewer, section, value }) => {
    const json = canonicalizeJson(withoutStreamVersion(section, value))
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
  for (const section of stored?.sections ?? []) {
    if (kept.has(key(section))) continue
    const existing = await readSectionRow(ctx, characterId, section.viewer, section.section)
    if (existing) await ctx.db.delete('characterSheetSections', existing._id)
  }
  const derivation = {
    characterId,
    fingerprint,
    sections: sections.map(({ viewer, section, checksum }) => ({ viewer, section, checksum }))
  }
  if (!stored) await ctx.db.insert('characterSheetDerivations', derivation)
  else if (
    stored.fingerprint !== fingerprint ||
    checksumCanonicalJson(stored.sections) !== checksumCanonicalJson(derivation.sections)
  )
    await ctx.db.replace('characterSheetDerivations', stored._id, derivation)
}

const storeReference = makeFunctionReference<'mutation', { characterId: string }, null>(
  'characters/sheetSectionDerivation:store'
)

/**
 * Queues the Sheet's derivation after a write that did not store it: Builder commit (referenced
 * content only), a resolution-scope command, a writer outside the Sheet's own commands and the
 * focused preference write.
 */
export async function scheduleCharacterSheetSections(ctx: MutationCtx, characterId: string) {
  await ctx.scheduler.runAfter(0, storeReference, { characterId })
}
