import { describe, expect, it } from 'vitest'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api } from '../_generated/api'
import { fixture, input } from '../../tests/fixtures/characters'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { readActiveCharacter } from './builder'

describe('Builder active Character query', () => {
  it('returns only the caller’s active Character, by UUID or alias, and never a draft', async () => {
    const { t, owner, other } = await fixture()
    const draft = await owner.caller.mutation(api.characters.drafts.create, input())
    // A draft-only Character has no active Character.
    expect(
      await owner.caller.query(api.characters.builder.activeCharacter, { id: draft.characterId })
    ).toBeNull()
    const active = {
      ...draft.payload.character,
      label: 'Active character',
      status: 'ACTIVE' as const
    }
    active.state.hitpoints.current = 4
    await t.run((ctx) =>
      ctx.db.insert('characters', {
        id: active.id,
        userId: active.userId,
        systemId: active.systemId,
        status: 'ACTIVE',
        streamVersion: 1,
        label: active.label,
        documentJson: canonicalizeRuleDocument(active),
        checksum: checksumRuleDocument(active),
        maximumHitPoints: 0,
        walkingSpeed: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    )
    await owner.caller.mutation(api.characters.drafts.save, {
      characterId: draft.characterId,
      expectedDraftId: draft.id,
      mode: 'create',
      character: { ...draft.payload.character, label: 'Unsaved edit' }
    })
    for (const id of [draft.characterId, draft.publicId])
      expect(await owner.caller.query(api.characters.builder.activeCharacter, { id })).toEqual(
        active
      )
    expect(
      await other.caller.query(api.characters.builder.activeCharacter, { id: draft.characterId })
    ).toBeNull()
    await expect(
      t.query(api.characters.builder.activeCharacter, { id: draft.characterId })
    ).rejects.toThrow('Unauthenticated')

    // It never reads the draft, so an autosave does not re-run its subscription (ADR 0036 S8).
    const totals = createDatabaseIoTotals()
    await owner.caller.run((ctx) =>
      readActiveCharacter(
        { ...ctx, db: countDatabaseIo(ctx.db, totals) },
        { id: draft.characterId }
      )
    )
    expect(Object.keys(totals.reads.byTable)).not.toContain('characterDrafts')
    expect(Object.keys(totals.reads.byTable)).not.toContain('characterDraftPayloads')
  })
})
