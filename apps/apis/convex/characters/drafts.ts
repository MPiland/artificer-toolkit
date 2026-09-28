import * as zMini from 'zod/mini'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterDraftCreateInputSchema,
  characterDraftDiscardInputSchema,
  characterDraftListInputSchema,
  characterDraftListPageSchema,
  characterDraftLookupInputSchema,
  characterDraftSaveInputSchema,
  type CharacterDraftListPage,
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
  resolveCharacterId
} from './documents'

async function saveDraft(
  ctx: MutationCtx,
  userId: string,
  input: Omit<CharacterDraftSaveInput, 'expectedDraftId'>,
  { active, draft }: Awaited<ReturnType<typeof loadCharacterState>>
): Promise<CharacterBuilderDraftDto> {
  if ((active && active.userId !== userId) || (draft && draft.userId !== userId)) {
    throw new Error('Character cannot be edited by the current user.')
  }
  const existing = draft ? await readCharacterDraft(ctx, draft, active) : null
  const current = active ? readCharacterRecord(active) : null
  for (const bound of [existing?.payload.character, current]) {
    if (bound && bound.systemId !== input.character.systemId) {
      throw new Error('Character Game System is immutable.')
    }
  }
  await requireSystem(ctx, input.character.systemId)
  const mode = active ? 'edit' : 'create'
  if (input.mode !== mode || (existing && existing.mode !== mode))
    throw new Error('Character draft mode does not match the current Character.')
  const baseActiveUpdatedAt = draft ? draft.baseActiveUpdatedAt : (active?.updatedAt ?? null)
  if (
    (active && !draft && input.baseActiveUpdatedAt !== baseActiveUpdatedAt) ||
    (input.baseActiveUpdatedAt !== undefined && input.baseActiveUpdatedAt !== baseActiveUpdatedAt)
  ) {
    throw new Error('Character draft base revision does not match; reopen the draft before saving.')
  }
  if (!active && !draft) {
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
  const payload = characterBuilderDraftPayloadDtoSchema.parse({
    character: { ...input.character, userId, status: 'DRAFT' },
    ...(input.builderIntent ? { builderIntent: input.builderIntent } : {})
  })
  const now = new Date(
    Math.max(Date.now(), draft ? Date.parse(draft.updatedAt) + 1 : 0)
  ).toISOString()
  const publicId = await ensureAuthoredRouteId(ctx, 'CHARACTER', input.characterId, false, userId)
  const payloadRecord = await insertCharacterDraftPayload(ctx, input.characterId, payload, now)
  const stored = characterStoredDraftSchema.parse({
    id: draft?.id ?? crypto.randomUUID(),
    characterId: input.characterId,
    userId,
    systemId: input.character.systemId,
    publicId,
    label: input.character.label || 'Untitled Character',
    status: 'DRAFT',
    mode,
    baseActiveUpdatedAt,
    createdAt: draft?.createdAt ?? now,
    updatedAt: now,
    payloadId: payloadRecord.payloadId,
    checksum: payloadRecord.checksum
  })
  if (draft) {
    await ctx.db.replace(draft._id, stored)
    await deleteCharacterDraftPayload(ctx, draft)
  } else await ctx.db.insert('characterDrafts', stored)
  await syncAccountUsage(ctx, 'personalCharacters', input.characterId)
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
    return saveDraft(
      ctx,
      userId,
      {
        characterId: input.id,
        character,
        mode: current ? 'edit' : 'create',
        baseActiveUpdatedAt: state.active?.updatedAt ?? null
      },
      state
    )
  }
})

export const save = mutation({
  args: zodToConvexFields(characterDraftSaveInputSchema.shape),
  returns: zodToConvex(characterBuilderDraftDtoSchema),
  handler: async (ctx, args): Promise<CharacterBuilderDraftDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = characterDraftSaveInputSchema.parse(args)
    if (input.characterId !== input.character.id)
      throw new Error('Character draft route and payload identities do not match.')
    const state = await loadCharacterState(ctx, input.characterId)
    if (
      !state.draft ||
      state.draft.userId !== userId ||
      (state.active && state.active.userId !== userId)
    )
      throw new Error(
        'Character draft is unavailable for the current user; reopen it before saving.'
      )
    if (state.draft.id !== input.expectedDraftId)
      throw new Error('Character draft generation changed; reopen it before saving.')
    return saveDraft(ctx, userId, input, state)
  }
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
