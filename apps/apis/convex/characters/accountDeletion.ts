import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { syncAccountUsage } from '../lib/accountUsage'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import {
  deleteCharacterDraftPayload,
  readCharacterDraft,
  readCharacterReceiptHistory,
  readCharacterRecord,
  readCharacterSheetState
} from './documents'
import { joinCharacterPlay, type CharacterRow } from './stateDocuments'

type OwnedCharacterState = {
  active: CharacterRow | null
  draft: Doc<'characterDrafts'> | null
}

/** Trusted account lifecycle helper; Campaign departure has already removed every assignment. */
export async function removeAccountPrivateCharacters(ctx: MutationCtx, userId: string) {
  const [activeRows, draftRows, rolls] = await Promise.all([
    ctx.db
      .query('characters')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
      .then((rows) => Promise.all(rows.map((row) => joinCharacterPlay(ctx, row)))),
    ctx.db
      .query('characterDrafts')
      .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
      .collect(),
    ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', userId))
      .collect()
  ])
  const states = new Map<string, OwnedCharacterState>()

  for (const active of activeRows) {
    if (states.has(active.id)) throw new Error('Stored Character state is duplicated.')
    states.set(active.id, { active, draft: null })
  }
  for (const draft of draftRows) {
    const state = states.get(draft.characterId) ?? { active: null, draft: null }
    if (state.draft) throw new Error('Stored Character state is duplicated.')
    state.draft = draft
    states.set(draft.characterId, state)
  }

  const effects = createActiveRuleEffectStore(ctx)
  for (const [characterId, state] of [...states].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const { active, draft } = state
    if ((active && active.userId !== userId) || (draft && draft.userId !== userId))
      throw new Error('Stored Character ownership mismatch.')
    if (active) {
      readCharacterRecord(active)
      readCharacterSheetState(active)
    }
    if (draft) await readCharacterDraft(ctx, draft, active)
    if (
      active &&
      draft &&
      (active.id !== draft.characterId ||
        active.userId !== draft.userId ||
        active.systemId !== draft.systemId)
    )
      throw new Error('Stored Character state ownership mismatch.')

    const [route, assignment, receipts] = await Promise.all([
      ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', characterId))
        .unique(),
      ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .unique(),
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
        .collect()
    ])
    if (
      !route ||
      route.subjectKind !== 'CHARACTER' ||
      route.subjectId !== characterId ||
      route.ownerUserId !== userId ||
      (draft && route.publicId !== draft.publicId)
    )
      throw new Error('Stored Character route identity mismatch.')
    if (assignment) throw new Error('Stored Campaign Character assignment remains after departure.')
    for (const receipt of receipts) {
      if (receipt.characterId !== characterId)
        throw new Error('Stored Sheet command receipt Character mismatch.')
      readCharacterReceiptHistory(receipt)
    }

    if (active) {
      for (const effect of await effects.list({ kind: 'CHARACTER', characterId })) {
        if (effect.owner.kind !== 'CHARACTER' || effect.owner.characterId !== characterId)
          throw new Error('Stored Character active rule effect ownership mismatch.')
        await effects.deleteCas({
          id: effect.id,
          owner: effect.owner,
          expectedVersion: effect.version
        })
      }
    } else {
      const activeEffects = await ctx.db
        .query('characterActiveRuleEffects')
        .withIndex('by_characterId_createdOrdinal_id', (q) => q.eq('characterId', characterId))
        .collect()
      if (activeEffects.length) throw new Error('Draft-only Character has active rule effects.')
    }

    for (const receipt of receipts) await ctx.db.delete(receipt._id)
    if (draft) {
      await deleteCharacterDraftPayload(ctx, draft)
      await ctx.db.delete(draft._id)
    }
    if (active) {
      await ctx.db.delete(active.play._id)
      await ctx.db.delete(active._id)
    }
    await ctx.db.delete(route._id)
    await syncAccountUsage(ctx, 'personalCharacters', characterId)
  }

  for (const roll of rolls) await ctx.db.delete(roll._id)
}
