import { describe, expect, it } from 'vitest'
import { characterDocumentSchema } from '@artificer-toolkit/schema/projections/characterStoredState'
import { api } from '../_generated/api'
import { insertActiveCharacterRecord } from '../../tests/fixtures/characterRows'
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
      insertActiveCharacterRecord(
        ctx,
        { ...characterDocumentSchema.parse(active), status: 'ACTIVE' },
        { createdAt: '2026-01-01T00:00:00.000Z' }
      )
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
