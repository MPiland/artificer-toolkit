import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CharacterSheetSliceReadInput,
  CharacterSheetSliceResponseDto
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import { campaignCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { api } from '../_generated/api'
import { loadCharacterSheetNotes } from './sheetSlices'
import * as sheetFacts from './sheetFacts'

const get = makeFunctionReference<
  'query',
  CharacterSheetSliceReadInput,
  CharacterSheetSliceResponseDto | null
>('characters/sheetSlices:get')

async function populateNotes(base: Awaited<ReturnType<typeof readySheetFixture>>) {
  await base.t.run((ctx) =>
    editCharacterRecord(ctx, base.character.id, (document, row) => ({
      ...document,
      profile: { ...document.profile, backstory: 'PRIVATE-BACKSTORY', notes: 'PRIVATE-PROFILE' },
      state: {
        ...document.state,
        noteGroups: [{ id: crypto.randomUUID(), kind: 'CUSTOM', label: 'Travel', sortOrder: -1 }],
        notes: ['First note', 'Second note'].map((title) => ({
          id: crypto.randomUUID(),
          title,
          body: 'PRIVATE-NOTE',
          groupId: 'session-notes',
          pinned: title === 'Second note',
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        }))
      }
    }))
  )
}

describe('focused Character Sheet slices', () => {
  it('reads the complete private notebook without rules, sources or other feature collections', async () => {
    const base = await readySheetFixture()
    await populateNotes(base)
    const full = await base.owner.caller.query(api.characters.sheet.get, { id: base.character.id })
    if (!full) throw new Error('Missing owner Sheet.')
    const totals = createDatabaseIoTotals()
    const evaluate = vi.spyOn(sheetFacts, 'loadCharacterSheetFacts')
    try {
      const notes = await base.owner.caller.run((ctx) =>
        loadCharacterSheetNotes(
          { ...ctx, db: countDatabaseIo(ctx.db, totals) },
          base.owner.userId,
          base.character.id
        )
      )
      expect(notes).toEqual({
        meta: { characterId: base.character.id, streamVersion: full.meta.streamVersion },
        notes: full.notes
      })
      expect(notes?.notes.backstory).toBe('PRIVATE-BACKSTORY')
      expect(notes?.notes.groups?.map((group) => group.label)).toEqual([
        'Travel',
        'Session Notes',
        'Loot',
        'Characters',
        'Places'
      ])
      expect(notes?.notes.items?.map((note) => note.title)).toEqual(['First note', 'Second note'])
      expect(evaluate).not.toHaveBeenCalled()
      for (const table of [
        'authoredRoots',
        'authoredVersions',
        'systems',
        'characterInventoryItems',
        'characterCurrencyGroups',
        'characterClassSpellStates',
        'characterSpellCustomizations',
        'characterCreatureInstances',
        'characterVehicleInstances',
        'characterExtraEquipment',
        'campaignLiveSlots'
      ])
        expect(totals.reads.byTable[table]).toBeUndefined()
      expect(totals.reads.byTable.characterNotes?.documents).toBe(2)
      expect(totals.writes.documents).toBe(0)
      expect(await base.owner.caller.query(get, { id: base.character.id, slice: 'NOTES' })).toEqual(
        { slice: 'NOTES', data: notes }
      )
    } finally {
      evaluate.mockRestore()
    }
    expect(await base.other.caller.query(get, { id: base.character.id, slice: 'NOTES' })).toBeNull()
    expect(
      await base.other.caller.query(get, { id: base.character.id, slice: 'COMMON' })
    ).toBeNull()
  })

  it('preserves Campaign and party projection while keeping notebooks owner-only', async () => {
    const base = await setupCharacterRun()
    await populateNotes(base)
    const party = await createPartyPlayer(base.t, base.campaign)
    await party.join()
    const input = { id: base.character.id, campaignId: base.campaign.id }
    expect(await base.owner.caller.query(get, { ...input, slice: 'NOTES' })).toBeNull()
    await expect(party.caller.query(get, { ...input, slice: 'NOTES' })).rejects.toThrow(
      'Assigned Character not found.'
    )
    await expect(party.caller.query(get, { ...input, slice: 'COMMON' })).rejects.toThrow(
      'Assigned Character not found.'
    )
    const overlay = campaignCharacterStateSchema.parse({
      adjustments: [
        {
          id: crypto.randomUUID(),
          campaignId: base.campaign.id,
          characterId: base.character.id,
          createdBy: base.owner.userId,
          version: 0,
          createdAt: base.campaign.createdAt,
          updatedAt: base.campaign.createdAt,
          visibility: 'SECRET',
          adjustment: {
            family: 'HIT_POINTS',
            field: 'MAXIMUM_OVERRIDE',
            value: 30,
            sourceNote: 'SECRET-HP-CAUSE'
          }
        }
      ],
      conditions: []
    })
    await base.t.run(async (ctx) => {
      const state = await ctx.db
        .query('campaignCharacterStates')
        .withIndex('by_campaignId_characterId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('characterId', base.character.id)
        )
        .unique()
      if (!state) throw new Error('Missing Campaign Character state.')
      await ctx.db.patch(state._id, {
        documentJson: JSON.stringify(overlay),
        checksum: checksumRuleDocument(overlay)
      })
    })
    const current = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    if (!current) throw new Error('Missing owner Sheet.')
    await base.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: {
        type: 'SET_PARTY_VISIBILITY',
        commandId: crypto.randomUUID(),
        expectedVersion: current.meta.streamVersion,
        visibility: { sheet: true, health: 'HIDDEN' }
      }
    })
    for (const viewer of [base.owner, base.player, party]) {
      const common = await viewer.caller.query(get, { ...input, slice: 'COMMON' })
      if (common?.slice !== 'COMMON') throw new Error('Missing common slice.')
      expect(common.data.overview.maxHitPoints).toBe(30)
      expect(common.data.overview.maxHitPointsOverride).toBe(viewer === base.owner ? 30 : null)
      for (const field of ['notes', 'inventory', 'extras', 'spells'])
        expect(common.data).not.toHaveProperty(field)
      expect(common.data.hasSpellcasting).toBe(false)
      const inventory = await viewer.caller.query(get, { ...input, slice: 'INVENTORY' })
      expect(inventory?.slice).toBe('INVENTORY')
      const actions = await viewer.caller.query(get, { ...input, slice: 'ACTIONS' })
      expect(actions?.slice).toBe('ACTIONS')
      const secrets =
        viewer === party
          ? [
              'PRIVATE-BACKSTORY',
              'PRIVATE-PROFILE',
              'PRIVATE-NOTE',
              'SECRET-HP-CAUSE',
              overlay.adjustments[0]!.id
            ]
          : viewer === base.player
            ? ['PRIVATE-PROFILE', 'PRIVATE-NOTE', 'SECRET-HP-CAUSE', overlay.adjustments[0]!.id]
            : ['PRIVATE-PROFILE', 'PRIVATE-NOTE']
      for (const secret of secrets)
        expect(JSON.stringify([common, inventory, actions])).not.toContain(secret)
    }
    expect((await base.player.caller.query(get, { ...input, slice: 'NOTES' }))?.slice).toBe('NOTES')
    await expect(party.caller.query(get, { ...input, slice: 'NOTES' })).rejects.toThrow(
      'Assigned Character not found.'
    )
  }, 60_000)

  it.each([
    'checksum',
    'gap',
    'owner',
    'note-tail',
    'note-all',
    'group-tail',
    'group-all'
  ] as const)('fails closed for notebook %s corruption', async (corruption) => {
    const base = await readySheetFixture()
    await populateNotes(base)
    await base.t.run(async (ctx) => {
      if (corruption === 'owner') {
        const play = await ctx.db
          .query('characterPlayStates')
          .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
          .unique()
        if (!play) throw new Error('Missing play state.')
        await ctx.db.patch(play._id, { userId: base.other.userId })
      } else {
        const notes = await ctx.db
          .query(corruption.startsWith('group-') ? 'characterNoteGroups' : 'characterNotes')
          .withIndex('by_characterId_position', (q) => q.eq('characterId', base.character.id))
          .collect()
        const first = notes.find((note) => note.position === 0)
        if (!first) throw new Error('Missing note.')
        if (corruption.endsWith('-all')) {
          for (const row of notes) await ctx.db.delete(row._id)
        } else if (corruption.endsWith('-tail')) {
          const last = notes.reduce((left, right) =>
            left.position > right.position ? left : right
          )
          await ctx.db.delete(last._id)
        } else if (corruption === 'gap') await ctx.db.delete(first._id)
        else await ctx.db.patch(first._id, { checksum: 'corrupt' })
      }
    })
    await expect(
      base.owner.caller.query(get, { id: base.character.id, slice: 'NOTES' })
    ).rejects.toThrow(
      corruption === 'owner'
        ? 'Stored Character identity mismatch.'
        : 'Stored Character collection integrity mismatch.'
    )
  })

  it('fences explicit and implicit assigned notebook reads during Campaign deletion', async () => {
    const base = await setupCharacterRun()
    await populateNotes(base)
    expect(
      (await base.player.caller.query(get, { id: base.character.id, slice: 'NOTES' }))?.slice
    ).toBe('NOTES')
    await base.owner.caller.mutation(api.campaigns.deletion.remove, {
      campaignId: base.campaign.id,
      expectedVersion: base.campaign.version,
      confirmation: 'DELETE'
    })
    for (const campaignId of [undefined, base.campaign.id])
      await expect(
        base.player.caller.query(get, { id: base.character.id, campaignId, slice: 'NOTES' })
      ).rejects.toThrow('Campaign not found.')
  }, 60_000)
})
