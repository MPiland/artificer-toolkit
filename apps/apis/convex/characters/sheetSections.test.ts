import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { listCampaignAdjustmentsInputSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import { characterSheetSliceSchema } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { listCharacterSheetPanelTargets } from '@artificer-toolkit/rules-runtime/character/sheetPanelTarget'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../_generated/api'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { characterSheetSection, readStoredCharacterSheetSection } from './sheetSections'

/**
 * A stored section read checks authority and the derivation's inputs (the System document is 34 KB
 * of it) and returns one stored section; it reads no authored content.
 */
const STORED_SECTION_READ_BYTES = 120_000

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const campaignSheet = makeFunctionReference<
  'query',
  z.input<typeof listCampaignAdjustmentsInputSchema>,
  CharacterSheetResponseDto
>('campaigns/characterSheet:get')

const slices = characterSheetSliceSchema.options.filter((slice) => slice !== 'NOTES')

async function setup() {
  const base = await readyCharacterFixture()
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const { owner: player, other: gm, t } = base
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'Stored Sheet sections',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: player.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: player.userId,
      characterId: character.id,
      assignedAt: campaign.createdAt
    })
  })
  const party = await createPartyPlayer(t, campaign)
  await party.join()
  const input = { campaignId: campaign.id, characterId: character.id }
  // A Sheet command is a Character write: its derivation stores the sections every viewer reads.
  const current = await player.caller.query(campaignSheet, input)
  const visibility = await player.caller.mutation(api.characters.sheetCommands.execute, {
    id: character.id,
    command: {
      type: 'SET_PARTY_VISIBILITY',
      commandId: crypto.randomUUID(),
      expectedVersion: current.meta.streamVersion,
      visibility: { sheet: true, health: 'HIDDEN' }
    }
  })
  const forgetDerivation = () =>
    t.run(async (ctx) => {
      for (const row of await ctx.db.query('characterSheetDerivations').collect())
        await ctx.db.delete(row._id)
    })
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  return { t, player, gm, party, campaign, character, input, visibility, forgetDerivation }
}

describe('Stored Character Sheet sections (ADR 0041)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('serves every viewer the sections a live derivation would, from one write', async () => {
    const { t, player, gm, party, character, input, forgetDerivation } = await setup()
    const viewers = [
      { member: player, party: false },
      { member: gm, party: false },
      { member: party, party: true }
    ]
    const readSlices = () =>
      Promise.all(
        viewers.map(({ member }) =>
          Promise.all(
            slices.map((slice) =>
              member.caller.query(api.characters.sheetSlices.get, {
                id: character.id,
                campaignId: input.campaignId,
                slice
              })
            )
          )
        )
      )
    const sheet = await player.caller.query(campaignSheet, input)
    const targets = listCharacterSheetPanelTargets(sheet)
    expect(targets.length).toBeGreaterThan(slices.length)
    const readPanels = () =>
      Promise.all([
        Promise.all(
          targets.map((target) =>
            player.caller.query(api.characters.panels.get, { id: character.id, target })
          )
        ),
        Promise.all(
          targets.map((target) =>
            gm.caller.query(api.campaigns.characterSheet.panel, { ...input, target })
          )
        ),
        player.caller.query(api.characters.preparationOptions.get, { id: character.id }),
        gm.caller.query(api.campaigns.characterSheet.preparationOptions, input)
      ])

    const storedIds = await t.run(async (ctx) => {
      const sections = await Promise.all(
        viewers.flatMap(({ member, party: partyViewer }) =>
          slices.map((slice) =>
            readStoredCharacterSheetSection(ctx, {
              userId: partyViewer ? player.userId : member.userId,
              lookupId: character.id,
              campaignId: input.campaignId,
              party: partyViewer,
              section: characterSheetSection.slice(slice)
            })
          )
        )
      )
      return sections.filter((section) => section !== undefined).length
    })
    expect(storedIds).toBe(viewers.length * slices.length)
    const stored = { slices: await readSlices(), panels: await readPanels() }

    await forgetDerivation()
    expect({ slices: await readSlices(), panels: await readPanels() }).toEqual(stored)
  }, 120_000)

  it('reads one stored section without authored content', async () => {
    const { t, player, character, input } = await setup()
    const totals = createDatabaseIoTotals()
    // Values leave `t.run` as Convex values, so a miss (undefined) arrives as null.
    const section = await t.run((ctx) =>
      readStoredCharacterSheetSection(
        { ...ctx, db: countDatabaseIo(ctx.db, totals) },
        {
          userId: player.userId,
          lookupId: character.id,
          campaignId: input.campaignId,
          section: characterSheetSection.slice('COMMON')
        }
      )
    )
    expect(section).not.toBeNull()
    expect(totals.reads.byTable.authoredRoots).toBeUndefined()
    expect(totals.reads.byTable.authoredVersionPayloadChunks).toBeUndefined()
    expect(totals.reads.byTable.characterSheetSections?.documents).toBe(1)
    expect(totals.reads.bytes).toBeLessThanOrEqual(STORED_SECTION_READ_BYTES)
  }, 60_000)

  it('derives live once an input changes outside a Character write', async () => {
    const { t, player, character, input, visibility } = await setup()
    const readCommon = () =>
      t.run((ctx) =>
        readStoredCharacterSheetSection(ctx, {
          userId: player.userId,
          lookupId: character.id,
          campaignId: input.campaignId,
          section: characterSheetSection.slice('COMMON')
        })
      )
    // A miss (undefined) leaves `t.run` as null.
    expect(await readCommon()).not.toBeNull()
    await t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', input.campaignId))
        .unique()
      await ctx.db.patch(campaign!._id, { contentMaturity: 'MATURE' })
    })
    expect(await readCommon()).toBeNull()

    // A note write evaluates nothing: it queues the derivation, and the Sheet reads live meanwhile.
    const note = await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'CREATE_NOTE',
        commandId: crypto.randomUUID(),
        expectedVersion: visibility.streamVersion,
        title: 'Session one',
        groupId: 'session-notes'
      }
    })
    const common = await player.caller.query(api.characters.sheetSlices.get, {
      id: character.id,
      campaignId: input.campaignId,
      slice: 'COMMON'
    })
    expect(common?.data.meta.streamVersion).toBe(note.streamVersion)
    expect(await readCommon()).toBeNull()
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await readCommon()).toEqual(common)
  }, 60_000)

  it('queues one derivation per Character, which a newer Sheet command replaces', async () => {
    const { t, player, character, input, visibility } = await setup()
    const [target] = listCharacterSheetPanelTargets(await player.caller.query(campaignSheet, input))
    const readStored = (section: string) =>
      t.run((ctx) =>
        readStoredCharacterSheetSection(ctx, {
          userId: player.userId,
          lookupId: character.id,
          campaignId: input.campaignId,
          section
        })
      )
    const readQueue = () =>
      t.run(async (ctx) => ({
        scheduled: (await ctx.db.system.query('_scheduled_functions').collect())
          .filter((row) => row.state.kind === 'pending')
          .map((row) => row._id),
        pending: (await ctx.db.query('characterSheetPendingStores').collect()).map(
          (row) => row.scheduledId
        )
      }))

    const adjusted = await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: visibility.streamVersion,
        adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 1 }
      }
    })
    const first = await readQueue()
    expect(first.scheduled).toHaveLength(1)
    expect(first.pending).toEqual(first.scheduled)
    const damaged = await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: adjusted.streamVersion,
        current: 1
      }
    })
    const second = await readQueue()
    expect(second.scheduled).toHaveLength(1)
    expect(second.pending).toEqual(second.scheduled)
    expect(second.scheduled).not.toEqual(first.scheduled)

    // Until the queued derivation lands, every read derives live over the written Character.
    expect(await readStored(characterSheetSection.slice('COMMON'))).toBeNull()
    const live = {
      common: await player.caller.query(api.characters.sheetSlices.get, {
        id: character.id,
        campaignId: input.campaignId,
        slice: 'COMMON'
      }),
      panel: await player.caller.query(api.characters.panels.get, {
        id: character.id,
        target: target!
      })
    }
    expect(live.common?.data.meta.streamVersion).toBe(damaged.streamVersion)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await readQueue()).toEqual({ scheduled: [], pending: [] })
    expect(await readStored(characterSheetSection.slice('COMMON'))).toEqual(live.common)
    expect(await readStored(characterSheetSection.panel(target!))).not.toBeNull()
    expect(
      await player.caller.query(api.characters.panels.get, { id: character.id, target: target! })
    ).toEqual(live.panel)
  }, 60_000)

  it('queues no derivation for a Builder draft save', async () => {
    const { t, player, character } = await setup()
    const readPending = () => t.run((ctx) => ctx.db.query('characterSheetPendingStores').collect())
    const edit = await player.caller.mutation(api.characters.drafts.create, {
      id: character.id,
      systemId: character.systemId
    })
    await player.caller.mutation(api.characters.drafts.save, {
      expectedDraftId: edit.id,
      characterId: character.id,
      mode: 'edit',
      character: { ...character, label: 'Unsaved edit', status: 'DRAFT' }
    })
    expect(await readPending()).toEqual([])
  }, 60_000)

  it('replays a Sheet command without rewriting the Character or queueing a derivation', async () => {
    const { t, player, character, visibility } = await setup()
    const command = {
      type: 'SET_HIT_POINTS' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: visibility.streamVersion,
      current: 2
    }
    const readRecords = () =>
      t.run(async (ctx) => {
        const play = await ctx.db
          .query('characterPlayStates')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique()
        const build = await ctx.db
          .query('characterBuildStates')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique()
        return { play, build }
      })
    const executed = await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const written = await readRecords()

    expect(
      await player.caller.mutation(api.characters.sheetCommands.execute, {
        id: character.id,
        command
      })
    ).toEqual(executed)
    expect(await readRecords()).toEqual(written)
    expect(await t.run((ctx) => ctx.db.query('characterSheetPendingStores').collect())).toEqual([])
  }, 60_000)

  it('leaves the Character head every Campaign read joins unchanged across Sheet commands', async () => {
    const { t, player, character, visibility } = await setup()
    const readRecords = () =>
      t.run(async (ctx) => ({
        head: await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', character.id))
          .unique(),
        build: await ctx.db
          .query('characterBuildStates')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique()
      }))
    const before = await readRecords()

    // A Sheet adjustment changes the Sheet structure, so the structure clock advances.
    const adjusted = await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: visibility.streamVersion,
        adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 1 }
      }
    })
    await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: adjusted.streamVersion,
        current: 1
      }
    })
    const after = await readRecords()

    expect(after.head).toEqual(before.head)
    expect(Date.parse(after.build!.updatedAt)).toBeGreaterThan(Date.parse(before.build!.updatedAt))
  }, 60_000)

  it('skips a queued derivation once a write has stored the same inputs', async () => {
    const { t, character } = await setup()
    // A marker a re-derivation would overwrite: any derivation rewrites the section checksums.
    const readDerivation = () =>
      t.run((ctx) =>
        ctx.db
          .query('characterSheetDerivations')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique()
      )
    const rederive = async () => {
      const { _id } = (await readDerivation())!
      await t.run((ctx) => ctx.db.patch(_id, { fingerprint: 'stale' }))
      await t.mutation(internal.characters.sheetSectionDerivation.store, {
        characterId: character.id,
        token: crypto.randomUUID()
      })
      return readDerivation()
    }
    // Snapshot builds finish without a Character write, so the setup's stored preparation manifest
    // can predate them; derive once over the settled inputs first.
    const derivation = await rederive()
    const sections = derivation!.sections.map((section, index) =>
      index === 0 ? { ...section, checksum: 'marker' } : section
    )
    await t.run((ctx) => ctx.db.patch(derivation!._id, { sections }))

    await t.mutation(internal.characters.sheetSectionDerivation.store, {
      characterId: character.id,
      token: crypto.randomUUID()
    })
    expect((await readDerivation())!.sections).toEqual(sections)

    expect((await rederive())!.sections).toEqual(derivation!.sections)
  }, 60_000)
})
