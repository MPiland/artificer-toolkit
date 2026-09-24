import { describe, expect, it } from 'vitest'
import { characterBuilderPayloadDtoSchema } from '@artificer-toolkit/schema/api/characterBuilder'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api } from '../_generated/api'
import { fixture, input } from '../../tests/fixtures/characters'

describe('native Character Builder queries', () => {
  it('resolves an owned empty draft by UUID and alias without publishing it', async () => {
    const { t, owner, other } = await fixture()
    const draft = await owner.caller.mutation(api.characters.drafts.create, input())
    const payload = await owner.caller.query(api.characters.builder.get, { id: draft.characterId })
    expect(characterBuilderPayloadDtoSchema.safeParse(payload).success).toBe(true)
    expect(payload?.character.id).toBe(draft.characterId)
    expect(payload?.character.userId).toBe(owner.userId)
    expect(payload?.character.status).toBe('DRAFT')
    expect(payload?.resolution.mode).toBe('create')
    expect(payload?.resolution.readiness.ready).toBe(false)
    expect(payload?.resolution.recommendedSectionId).toBe('BASICS')
    expect(payload?.references.races).toEqual([])
    expect(await owner.caller.query(api.characters.builder.get, { id: draft.publicId })).toEqual(
      payload
    )
    expect(
      await other.caller.query(api.characters.builder.get, { id: draft.characterId })
    ).toBeNull()
    await expect(t.query(api.characters.builder.get, { id: draft.characterId })).rejects.toThrow()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', draft.characterId))
          .unique()
      )
    ).toBeNull()
  }, 15_000)

  it.each(['resolve', 'preview'] as const)(
    'keeps %s read-only and binds it to the owned draft generation',
    async (operation) => {
      const { t, owner, other } = await fixture()
      const query = api.characters.builder[operation]
      const draft = await owner.caller.mutation(api.characters.drafts.create, input())
      const candidate = {
        expectedDraftId: draft.id,
        mode: 'create' as const,
        character: {
          ...draft.payload.character,
          label: 'Unsaved name',
          userId: other.userId,
          status: 'ACTIVE' as const
        }
      }
      const payload = await owner.caller.query(query, candidate)
      expect(payload.character.label).toBe('Unsaved name')
      expect(payload.character.userId).toBe(owner.userId)
      expect(payload.character.status).toBe('DRAFT')
      expect(
        await owner.caller.query(api.characters.drafts.get, { id: draft.characterId })
      ).toEqual(draft)
      await expect(t.query(query, candidate)).rejects.toThrow()
      await expect(other.caller.query(query, candidate)).rejects.toThrow('current user')
      await expect(owner.caller.query(query, { ...candidate, mode: 'edit' })).rejects.toThrow(
        'mode'
      )
      await expect(
        owner.caller.query(query, {
          ...candidate,
          character: { ...candidate.character, systemId: crypto.randomUUID() }
        })
      ).rejects.toThrow('immutable')
      await owner.caller.mutation(api.characters.drafts.discard, {
        id: draft.characterId,
        expectedDraftId: draft.id
      })
      await owner.caller.mutation(api.characters.drafts.create, {
        ...input(),
        id: draft.characterId
      })
      await expect(owner.caller.query(query, candidate)).rejects.toThrow('generation changed')
    }
  )

  it('reads active Characters and prefers an edit draft without rebasing it on later Sheet changes', async () => {
    const { t, owner } = await fixture()
    const draft = await owner.caller.mutation(api.characters.drafts.create, input())
    const active = {
      ...draft.payload.character,
      label: 'Active character',
      status: 'ACTIVE' as const
    }
    active.state.hitpoints.current = 4
    active.state.hitpoints.temp = 2
    const baseline = '2026-01-01T00:00:00.000Z'
    const activeId = await t.run((ctx) =>
      ctx.db.insert('characters', {
        id: active.id,
        userId: active.userId,
        systemId: active.systemId,
        status: 'ACTIVE',
        streamVersion: 1,
        label: active.label,
        documentJson: canonicalizeRuleDocument(active),
        checksum: checksumRuleDocument(active),
        createdAt: baseline,
        updatedAt: baseline
      })
    )
    await owner.caller.mutation(api.characters.drafts.discard, {
      id: draft.characterId,
      expectedDraftId: draft.id
    })
    const current = await owner.caller.query(api.characters.builder.get, { id: draft.publicId })
    expect(current?.character.status).toBe('ACTIVE')
    expect(current?.resolution.mode).toBe('edit')
    expect(current?.baseActiveUpdatedAt).toBe(baseline)
    const edit = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: draft.characterId
    })
    active.state.hitpoints.current = 3
    await t.run((ctx) =>
      ctx.db.patch(activeId, {
        documentJson: canonicalizeRuleDocument(active),
        checksum: checksumRuleDocument(active),
        updatedAt: '2026-01-02T00:00:00.000Z'
      })
    )
    const stored = await t.run((ctx) => ctx.db.get(activeId))
    const working = await owner.caller.query(api.characters.builder.get, { id: draft.publicId })
    expect(working?.character.status).toBe('DRAFT')
    expect(working?.character.state).toEqual(active.state)
    expect(working?.baseActiveUpdatedAt).toBe(baseline)
    const candidate = await owner.caller.query(api.characters.builder.resolve, {
      expectedDraftId: edit.id,
      mode: 'edit',
      character: { ...edit.payload.character, label: 'Unsaved edit' }
    })
    expect(candidate.character.label).toBe('Unsaved edit')
    expect(candidate.baseActiveUpdatedAt).toBe(baseline)
    const forged = structuredClone(edit.payload.character)
    forged.state.hitpoints.current = 999
    forged.state.hitpoints.temp = 999
    const resolved = await owner.caller.query(api.characters.builder.resolve, {
      expectedDraftId: edit.id,
      mode: 'edit',
      character: forged
    })
    expect(resolved.character.state).toEqual(active.state)
    const preview = await owner.caller.query(api.characters.builder.preview, {
      expectedDraftId: edit.id,
      mode: 'edit',
      character: forged
    })
    expect(preview.character.state).toEqual(active.state)
    expect(preview).not.toHaveProperty('authoredContentUpgrade')
    expect(await t.run((ctx) => ctx.db.get(activeId))).toEqual(stored)
    expect(await owner.caller.query(api.characters.drafts.get, { id: draft.characterId })).toEqual(
      edit
    )
  })
})
