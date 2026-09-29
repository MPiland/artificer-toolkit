import { describe, expect, it } from 'vitest'
import {
  encodeCharacterRecord,
  type CharacterDocument
} from '@artificer-toolkit/schema/projections/characterStoredState'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { reconcileCharacterAuthoredSourceLoss } from '@artificer-toolkit/rules-runtime/character/characterSourceLoss'
import { api } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord, type CharacterRow } from './stateDocuments'

/** Stores `document` as the Character's repair state: status DRAFT, clocks and stream untouched. */
async function storeRepairState(ctx: MutationCtx, row: CharacterRow, document: CharacterDocument) {
  const stored = encodeCharacterRecord(row, {
    document,
    streamVersion: row.play.streamVersion,
    updatedAt: row.updatedAt
  })
  await ctx.db.patch(row._id, {
    status: 'DRAFT',
    documentJson: stored.documentJson,
    checksum: stored.checksum
  })
  await ctx.db.patch(row.play._id, {
    playJson: stored.play.playJson,
    checksum: stored.play.checksum,
    updatedAt: stored.play.updatedAt
  })
}

describe('native canonical Character repair state', () => {
  it('retains identity, history and Sheet state while repair drafts are saved, discarded and committed', async () => {
    const { t, owner, other, character, committed, readState } = await readySheetFixture()
    const command = {
      type: 'UPSERT_SHEET_ADJUSTMENT' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 1,
      adjustment: {
        id: crypto.randomUUID(),
        family: 'ABILITY' as const,
        ability: 'STRENGTH' as const,
        field: 'SCORE_OVERRIDE' as const,
        value: 20,
        sourceNote: 'Personal override'
      }
    }
    await owner.caller.mutation(api.characters.sheetCommands.execute, { id: character.id, command })
    const before = await readState()
    if (!before.character) throw new Error('Missing canonical Character.')
    expect(before.character.sheetState).toBeDefined()
    const repair = { ...readCharacterRecord(before.character), status: 'DRAFT' as const }
    repair.state.hitpoints.current = 3
    repair.state.hitpoints.temp = 2
    await t.run((ctx) => storeRepairState(ctx, before.character!, repair))
    const retained = await readState()
    const paginationOpts = { cursor: null, numItems: 48 }
    const open = () =>
      owner.caller.mutation(api.characters.drafts.create, {
        id: character.id,
        systemId: character.systemId
      })
    const draft = await open()
    expect(draft).toMatchObject({
      mode: 'edit',
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: before.character.updatedAt
    })
    const saved = await owner.caller.mutation(api.characters.drafts.save, {
      characterId: character.id,
      expectedDraftId: draft.id,
      mode: 'edit',
      character: { ...draft.payload.character, label: 'Repair in progress' }
    })
    expect(saved.draftState).toBe('DRAFT_ONLY')
    expect(
      (await owner.caller.query(api.characters.drafts.list, { paginationOpts })).page[0]?.draftState
    ).toBe('DRAFT_ONLY')
    expect(
      (await owner.caller.query(api.characters.list.list, { paginationOpts })).page[0]
    ).toMatchObject({
      id: character.id,
      publicId: committed.publicId,
      status: 'DRAFT',
      streamVersion: 2,
      draft: { draftState: 'DRAFT_ONLY' }
    })
    expect(
      (await owner.caller.query(api.characters.drafts.get, { id: committed.publicId }))?.payload
        .character.label
    ).toBe('Repair in progress')
    expect(
      (await owner.caller.query(api.characters.history.list, { id: character.id, paginationOpts }))
        .page
    ).toHaveLength(1)
    expect(
      await other.caller.query(api.characters.builder.activeCharacter, { id: character.id })
    ).toBeNull()
    expect((await other.caller.query(api.characters.list.list, { paginationOpts })).page).toEqual(
      []
    )
    await expect(
      owner.caller.query(api.characters.sheet.get, { id: character.id })
    ).rejects.toThrow('Builder repair')
    await expect(
      owner.caller.mutation(api.characters.sheetCommands.execute, { id: character.id, command })
    ).rejects.toThrow('Builder repair')
    await expect(
      owner.caller.mutation(api.rolls.execute, {
        characterId: character.id,
        expression: '1d20',
        source: { kind: 'MANUAL', label: 'Manual roll' }
      })
    ).rejects.toThrow('Builder repair')
    expect(await readState()).toEqual(retained)
    await owner.caller.mutation(api.characters.drafts.discard, {
      id: character.id,
      expectedDraftId: draft.id
    })
    expect(await readState()).toEqual(retained)
    expect(
      (await owner.caller.query(api.characters.list.list, { paginationOpts })).page[0]
    ).toMatchObject({ status: 'DRAFT' })
    const reopened = await open()
    expect(reopened.id).not.toBe(draft.id)
    const result = await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: reopened.id,
      mode: 'edit',
      character: reopened.payload.character
    })
    // Committing the repair leaves play state as stored, so the play stream does not advance.
    expect(result).toMatchObject({
      publicId: committed.publicId,
      streamVersion: retained.character!.play.streamVersion,
      character: { status: 'ACTIVE' }
    })
    const after = await readState()
    expect(after.character?._id).toBe(before.character._id)
    expect(after.character?.createdAt).toBe(before.character.createdAt)
    expect(after.character?.sheetState).toEqual(before.character.sheetState)
    expect(after.receipts).toEqual(before.receipts)
    expect(result.character.state).toEqual(repair.state)
    expect(await owner.caller.query(api.characters.sheet.get, { id: character.id })).not.toBeNull()
  })

  it('keeps a source-pruned Character editable but rejects activation until required structure is repaired', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    const before = await readState()
    if (!before.character) throw new Error('Missing canonical Character.')
    const current = readCharacterRecord(before.character)
    const pruned = reconcileCharacterAuthoredSourceLoss(
      current as CharacterAuthored,
      {
        subjectKind: 'RACE',
        subjectId: current.intent.race.raceId
      },
      new Map()
    )
    const repair = { ...pruned, status: 'DRAFT' as const }
    await t.run((ctx) => storeRepairState(ctx, before.character!, repair))
    const draft = await owner.caller.mutation(api.characters.drafts.create, {
      id: character.id,
      systemId: character.systemId
    })
    const active = await owner.caller.query(api.characters.builder.activeCharacter, {
      id: character.id
    })
    expect(active?.intent.race.raceId).toBe('')
    const retained = await readState()
    await expect(
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: draft.id,
        mode: 'edit',
        character: draft.payload.character
      })
    ).rejects.toThrow('not ready to activate')
    expect(await readState()).toEqual(retained)
    const fixed = await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'edit',
      character: {
        ...draft.payload.character,
        intent: { ...draft.payload.character.intent, race: current.intent.race }
      }
    })
    expect(fixed.character.status).toBe('ACTIVE')
  })

  it('rejects a canonical status that disagrees with the checksummed document', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    const stored = await readState()
    if (!stored.character) throw new Error('Missing canonical Character.')
    await t.run((ctx) => ctx.db.patch(stored.character!._id, { status: 'DRAFT' }))
    await expect(
      owner.caller.query(api.characters.builder.activeCharacter, { id: character.id })
    ).rejects.toThrow('identity mismatch')
  })
})
