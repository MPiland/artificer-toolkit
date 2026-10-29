import * as zMini from 'zod/mini'
import { ConvexError, v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterDraftCreateInputSchema,
  characterDraftDiscardInputSchema,
  characterDraftListInputSchema,
  characterDraftListPageSchema,
  characterDraftLookupInputSchema,
  characterDraftSaveInputSchema,
  type CharacterDraftListPage,
  type CharacterDraftSaveErrorData,
  type CharacterDraftSaveInput
} from '@artificer-toolkit/schema/api/characterDrafts'
import { characterStoredDraftSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  characterBuilderDraftDtoSchema,
  characterBuilderDraftPayloadDtoSchema,
  type CharacterBuilderDraftDto
} from '@artificer-toolkit/schema/api/characterBuilder'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import type { MutationCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { syncAccountUsage } from '../lib/accountUsage'
import { ensureAuthoredRouteId } from '../content/routeIds'
import { requireSystem } from '../content/systemDocuments'
import {
  deleteCharacterDraftPayload,
  insertCharacterDraftPayload,
  loadCharacterState,
  readCharacterDraft,
  readCharacterDraftSummary,
  readCharacterRecord,
  replaceCharacterDraftPayload,
  resolveCharacterId
} from './documents'
import type { CharacterRow } from './stateDocuments'

function parseDraftPayload(
  userId: string,
  input: Pick<CharacterDraftSaveInput, 'character' | 'builderIntent'>
) {
  return characterBuilderDraftPayloadDtoSchema.parse({
    character: { ...input.character, userId, status: 'DRAFT' },
    ...(input.builderIntent ? { builderIntent: input.builderIntent } : {})
  })
}

/** The autosave stops on this typed error instead of retrying, since the draft will never accept the save. */
function draftReplaced(message: string) {
  return new ConvexError({ code: 'DRAFT_REPLACED', message } satisfies CharacterDraftSaveErrorData)
}

/** Opens a new draft over the active Character, or over an empty create-mode Character. */
async function openDraft(
  ctx: MutationCtx,
  userId: string,
  characterId: string,
  character: CharacterDraftSaveInput['character'],
  active: CharacterRow | null
): Promise<CharacterBuilderDraftDto> {
  await requireSystem(ctx, character.systemId)
  const retiring = await ctx.db
    .query('characterReceiptPurgeJobs')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
  if (retiring) throw new Error('This Character identity is still being deleted.')
  if (!active) {
    const entitlement = await ctx.db
      .query('accountEntitlements')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    const limit = ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE'].personalCharacters
    if (limit !== null) {
      const [characters, drafts] = await Promise.all([
        ctx.db
          .query('characters')
          .withIndex('by_userId', (q) => q.eq('userId', userId))
          .take(limit),
        ctx.db
          .query('characterDrafts')
          .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
          .take(limit)
      ])
      if (
        new Set([
          ...characters.map((record) => record.id),
          ...drafts.map((record) => record.characterId)
        ]).size >= limit
      ) {
        throw new Error('Your account has reached its personalCharacters limit.')
      }
    }
  }
  const payload = parseDraftPayload(userId, { character })
  const now = new Date().toISOString()
  const publicId = await ensureAuthoredRouteId(ctx, 'CHARACTER', characterId, false, userId)
  const payloadRecord = await insertCharacterDraftPayload(ctx, characterId, payload, now)
  const stored = characterStoredDraftSchema.parse({
    id: crypto.randomUUID(),
    characterId,
    userId,
    systemId: character.systemId,
    publicId,
    label: character.label || 'Untitled Character',
    status: 'DRAFT',
    mode: active ? 'edit' : 'create',
    baseActiveUpdatedAt: active?.updatedAt ?? null,
    createdAt: now,
    updatedAt: now,
    payloadId: payloadRecord.payloadId,
    payloadDocumentId: payloadRecord.payloadDocumentId,
    checksum: payloadRecord.checksum
  })
  await ctx.db.insert('characterDrafts', stored)
  await syncAccountUsage(ctx, 'personalCharacters', characterId)
  return characterBuilderDraftDtoSchema.parse({
    ...stored,
    draftState: active?.status === 'ACTIVE' ? 'ACTIVE_WITH_DRAFT' : 'DRAFT_ONLY',
    payload: payloadRecord.payload
  })
}

/**
 * Autosave (ADR 0036 S8): validates structure only, the payload schema and the head's generation,
 * mode and System binding, from the draft head. The payload document is replaced in place; the old
 * payload, the System and the route are not read, and an edit draft's active row is read only for
 * the returned `draftState`. Commit revalidates everything.
 */
export async function saveCharacterDraft(
  ctx: MutationCtx,
  input: CharacterDraftSaveInput
): Promise<CharacterBuilderDraftDto> {
  const { userId } = await requireIdentity(ctx)
  if (input.characterId !== input.character.id)
    throw new Error('Character draft route and payload identities do not match.')
  const draft = await ctx.db
    .query('characterDrafts')
    .withIndex('by_characterId', (q) => q.eq('characterId', input.characterId))
    .unique()
  if (!draft) throw draftReplaced('Character draft is unavailable; it was finalized or discarded.')
  if (draft.userId !== userId)
    throw new Error('Character draft is unavailable for the current user; reopen it before saving.')
  if (draft.id !== input.expectedDraftId)
    throw draftReplaced('Character draft generation changed; reopen it before saving.')
  if (draft.systemId !== input.character.systemId)
    throw new Error('Character Game System is immutable.')
  if (input.mode !== draft.mode)
    throw new Error('Character draft mode does not match the current Character.')
  if (
    input.baseActiveUpdatedAt !== undefined &&
    input.baseActiveUpdatedAt !== draft.baseActiveUpdatedAt
  )
    throw draftReplaced(
      'Character draft base revision does not match; reopen the draft before saving.'
    )
  const payload = parseDraftPayload(userId, input)
  const now = new Date(Math.max(Date.now(), Date.parse(draft.updatedAt) + 1)).toISOString()
  const payloadRecord = await replaceCharacterDraftPayload(ctx, draft, payload, now)
  const { _id, _creationTime, ...head } = draft
  const stored = characterStoredDraftSchema.parse({
    ...head,
    label: input.character.label || 'Untitled Character',
    updatedAt: now,
    payloadId: payloadRecord.payloadId,
    checksum: payloadRecord.checksum
  })
  await ctx.db.replace(_id, stored)
  // Only an edit draft has an active row, whose status (a repair row is DRAFT) sets `draftState`.
  const active =
    draft.mode === 'edit'
      ? await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', draft.characterId))
          .unique()
      : null
  return characterBuilderDraftDtoSchema.parse({
    ...stored,
    draftState: active?.status === 'ACTIVE' ? 'ACTIVE_WITH_DRAFT' : 'DRAFT_ONLY',
    payload: payloadRecord.payload
  })
}

export const create = mutation({
  args: zodToConvexFields(characterDraftCreateInputSchema.shape),
  returns: zodToConvex(characterBuilderDraftDtoSchema),
  handler: async (ctx, args): Promise<CharacterBuilderDraftDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = characterDraftCreateInputSchema.parse(args)
    const state = await loadCharacterState(ctx, input.id)
    if (
      (state.active && state.active.userId !== userId) ||
      (state.draft && state.draft.userId !== userId)
    ) {
      throw new Error('Character cannot be edited by the current user.')
    }
    const existing = state.draft ? await readCharacterDraft(ctx, state.draft, state.active) : null
    const current = state.active ? readCharacterRecord(state.active) : null
    const character =
      existing?.payload.character ?? current ?? createEmptyCharacterAuthored({ ...input, userId })
    if (character.systemId !== input.systemId) {
      throw new Error('Character Game System is immutable.')
    }
    if (existing) {
      await requireSystem(ctx, input.systemId)
      return existing
    }
    return openDraft(ctx, userId, input.id, character, state.active)
  }
})

export const save = mutation({
  args: zodToConvexFields(characterDraftSaveInputSchema.shape),
  returns: zodToConvex(characterBuilderDraftDtoSchema),
  handler: (ctx, args) => saveCharacterDraft(ctx, characterDraftSaveInputSchema.parse(args))
})

export const get = query({
  args: zodToConvexFields(characterDraftLookupInputSchema.shape),
  returns: zodToConvex(zMini.nullable(characterBuilderDraftDtoSchema)),
  handler: async (ctx, args): Promise<CharacterBuilderDraftDto | null> => {
    const { userId } = await requireIdentity(ctx)
    const input = characterDraftLookupInputSchema.parse(args)
    const id = await resolveCharacterId(ctx, input.id)
    if (!id) return null
    const { active, draft } = await loadCharacterState(ctx, id)
    if (!draft || draft.userId !== userId || (active && active.userId !== userId)) return null
    return await readCharacterDraft(ctx, draft, active)
  }
})

export const list = query({
  args: zodToConvexFields(characterDraftListInputSchema.shape),
  returns: zodToConvex(characterDraftListPageSchema),
  handler: async (ctx, args): Promise<CharacterDraftListPage> => {
    const { userId } = await requireIdentity(ctx)
    const { paginationOpts } = characterDraftListInputSchema.parse(args)
    const result = await ctx.db
      .query('characterDrafts')
      .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
      .order('desc')
      .paginate({ ...paginationOpts, maximumRowsRead: 48, maximumBytesRead: 1024 * 1024 })
    return characterDraftListPageSchema.parse({
      ...result,
      page: await Promise.all(
        result.page.map(async (draft) => {
          const active = await ctx.db
            .query('characters')
            .withIndex('by_publicId', (q) => q.eq('id', draft.characterId))
            .unique()
          return readCharacterDraftSummary(draft, active)
        })
      )
    })
  }
})

export const discard = mutation({
  args: zodToConvexFields(characterDraftDiscardInputSchema.shape),
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const input = characterDraftDiscardInputSchema.parse(args)
    const id = await resolveCharacterId(ctx, input.id)
    if (id) {
      const { active, draft } = await loadCharacterState(ctx, id)
      if (draft?.userId === userId && (!active || active.userId === userId)) {
        if (draft.id !== input.expectedDraftId)
          throw new Error('Character draft generation changed; reopen it before discarding.')
        await deleteCharacterDraftPayload(ctx, draft)
        await ctx.db.delete(draft._id)
        await syncAccountUsage(ctx, 'personalCharacters', draft.characterId)
      }
    }
    return { ok: true as const }
  }
})
