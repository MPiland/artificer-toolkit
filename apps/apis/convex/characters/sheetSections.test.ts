import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { listCampaignAdjustmentsInputSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import {
  characterSheetSliceResponseDtoSchema,
  characterSheetSliceSchema,
  type CharacterSheetSliceResponseDto
} from '@artificer-toolkit/schema/api/characterSheetSlices'
import { listCharacterSheetPanelTargets } from '@artificer-toolkit/rules-runtime/character/sheetPanelTarget'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { get as campaignSheetQuery } from '../campaigns/characterSheet'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { createPartyPlayer, createPartyUser } from '../../tests/fixtures/partyPlayer'
import {
  importedSubject,
  importSeededSubjects,
  makePublishedRootOwned
} from '../../tests/fixtures/publication'
import { handlerOf, inOwnTransaction } from '../../tests/fixtures/queryTransaction'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import {
  characterSheetSection,
  readCharacterSheetStoreState,
  readStoredCharacterSheetSections
} from './sheetSections'
import {
  CAMPAIGN_BACKGROUND_SETTLE_MS,
  CHARACTER_SHEET_STORE_CHECK_MS,
  scheduleCharacterSheetSections
} from './sheetSectionStores'
import { withSceneVisionTracking } from '../lib/mutations'
import { deriveAndStoreCharacterSheet, storeCharacterSheetSections } from './sheetSectionDerivation'
import { loadCharacterSheetFacts } from './sheetFacts'
import { removePrivateCharacter } from './accountDeletion'
import { loadCharacterState } from './documents'
import { get as sheetSlicesQuery } from './sheetSlices'

/**
 * A stored section read checks authority and the derivation's inputs, whose System is a checksum
 * row, and returns one stored section; it reads no authored content (PERF-6.T4).
 */
const STORED_SECTION_READ_BYTES = 40_000
/** A slice read while a store is queued checks authority and serves the stored section (PERF-6.T4). */
const QUEUED_SLICE_READ_DOCUMENTS = 20

/** The viewer's current stored section; undefined while a store is queued or the inputs moved. */
async function readCurrentSection(
  ctx: Parameters<typeof readStoredCharacterSheetSections>[0],
  {
    section,
    ...input
  }: Omit<Parameters<typeof readStoredCharacterSheetSections>[1], 'sections' | 'whileQueued'> & {
    section: string
  }
) {
  const [stored] =
    (await readStoredCharacterSheetSections(ctx, {
      ...input,
      sections: [section],
      whileQueued: false
    })) ?? []
  return stored
}

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
  let members = 0
  /** Another player's Character, assigned to the Campaign with its Sheet stored. */
  const assignAnotherCharacter = async () => {
    members += 1
    const member = await createPartyUser(t, {
      username: `PartyMember${members}`,
      email: `party-member-${members}@example.invalid`
    })
    const another = await base.createCharacter(undefined, member.caller)
    await member.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: another.draft.id,
      mode: 'create',
      character: another.character
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: member.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: campaign.id,
        userId: member.userId,
        characterId: another.character.id,
        assignedAt: campaign.createdAt
      })
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    return { ...another.character, userId: member.userId }
  }
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  return {
    t,
    player,
    gm,
    party,
    campaign,
    character,
    input,
    visibility,
    forgetDerivation,
    assignAnotherCharacter
  }
}

const SHEET_STORE = 'characters/sheetSectionDerivation:store'

/** A Campaign-scope change: it moves every assigned Character's fingerprint (D215). */
function saveCampaignCurrency(
  gm: Awaited<ReturnType<typeof setup>>['gm'],
  campaignId: string,
  label: string
) {
  return gm.caller.mutation(api.campaigns.currencySystems.save, {
    campaignId,
    label,
    isReference: true,
    denominations: [{ label: 'Token', abbreviation: 'tk', scaleInReference: 1 }]
  })
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
            readCurrentSection(ctx, {
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
      readCurrentSection(
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

  it('serves every viewer a stored or queued slice within its read budget, deriving nothing', async () => {
    const { t, player, gm, party, character, input, visibility, forgetDerivation } = await setup()
    const getSlice = handlerOf<CharacterSheetSliceResponseDto | null>(sheetSlicesQuery)
    const measure = async (caller: typeof player.caller) => {
      const totals = createDatabaseIoTotals()
      const slice = await caller.run((ctx) =>
        getSlice(
          inOwnTransaction(
            ctx as unknown as QueryCtx,
            countDatabaseIo(ctx.db, totals) as QueryCtx['db']
          ),
          { id: character.id, campaignId: input.campaignId, slice: 'COMMON' }
        )
      )
      return { streamVersion: slice?.data.meta.streamVersion, totals }
    }
    const expectStored = async (
      streamVersion: number,
      budget: (totals: ReturnType<typeof createDatabaseIoTotals>) => void
    ) => {
      for (const viewer of [player, gm, party]) {
        const read = await measure(viewer.caller)
        expect(read.streamVersion).toBe(streamVersion)
        expect(read.totals.reads.byTable.authoredRoots).toBeUndefined()
        expect(read.totals.reads.byTable.authoredVersionPayloadChunks).toBeUndefined()
        expect(read.totals.reads.byTable.characterSheetSections?.documents).toBe(1)
        budget(read.totals)
      }
    }

    // A hit: the stored section is current.
    await expectStored(visibility.streamVersion, (totals) =>
      expect(totals.reads.bytes).toBeLessThanOrEqual(STORED_SECTION_READ_BYTES)
    )
    // A miss with a store queued serves the stored section at the written stream version.
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
    await expectStored(note.streamVersion, (totals) =>
      expect(totals.reads.documents).toBeLessThanOrEqual(QUEUED_SLICE_READ_DOCUMENTS)
    )

    // Never stored, with no store queued: the read derives live. Recorded, not budgeted here.
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    await forgetDerivation()
    const live = await measure(player.caller)
    expect(live.streamVersion).toBe(note.streamVersion)
    expect(live.totals.reads.byTable.authoredVersionPayloadChunks?.documents).toBeGreaterThan(0)
    console.info(
      `Never-stored COMMON slice read: ${live.totals.reads.documents} documents, ` +
        `${Math.round(live.totals.reads.bytes / 1000)} KB`
    )
  }, 120_000)

  it('refuses a party member a hidden Sheet from its stored sections, deriving nothing', async () => {
    const { t, player, party, character, input, visibility } = await setup()
    await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'SET_PARTY_VISIBILITY',
        commandId: crypto.randomUUID(),
        expectedVersion: visibility.streamVersion,
        visibility: { sheet: false, health: 'HIDDEN' }
      }
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const reads: ((
      ctx: QueryCtx
    ) => Promise<CharacterSheetSliceResponseDto | CharacterSheetResponseDto | null>)[] = [
      (ctx) =>
        handlerOf<CharacterSheetSliceResponseDto | null>(sheetSlicesQuery)(ctx, {
          id: character.id,
          campaignId: input.campaignId,
          slice: 'COMMON'
        }),
      (ctx) => handlerOf<CharacterSheetResponseDto>(campaignSheetQuery)(ctx, input)
    ]
    for (const read of reads) {
      const totals = createDatabaseIoTotals()
      await expect(
        party.caller.run((ctx) =>
          read(
            inOwnTransaction(
              ctx as unknown as QueryCtx,
              countDatabaseIo(ctx.db, totals) as QueryCtx['db']
            )
          )
        )
      ).rejects.toThrow('Assigned Character not found.')
      expect(totals.reads.byTable.authoredVersionPayloadChunks).toBeUndefined()
      expect(totals.reads.bytes).toBeLessThanOrEqual(STORED_SECTION_READ_BYTES)
    }
  }, 120_000)

  it('serves the whole Sheet from its stored slices to every viewer, as a live derivation does', async () => {
    const { player, gm, party, character, input, forgetDerivation } = await setup()
    const getSheet = handlerOf<CharacterSheetResponseDto>(campaignSheetQuery)
    const readSheets = () =>
      Promise.all([
        player.caller.query(api.characters.sheet.get, { id: character.id }),
        ...[player, gm, party].map((viewer) => viewer.caller.query(campaignSheet, input))
      ])
    const totals = createDatabaseIoTotals()
    await party.caller.run((ctx) =>
      getSheet(
        inOwnTransaction(
          ctx as unknown as QueryCtx,
          countDatabaseIo(ctx.db, totals) as QueryCtx['db']
        ),
        input
      )
    )
    expect(totals.reads.byTable.authoredRoots).toBeUndefined()
    expect(totals.reads.byTable.authoredVersionPayloadChunks).toBeUndefined()
    // The six slices and the viewer's notes.
    expect(totals.reads.byTable.characterSheetSections?.documents).toBe(slices.length + 1)
    console.info(
      `Stored whole Sheet read: ${totals.reads.documents} documents, ` +
        `${Math.round(totals.reads.bytes / 1000)} KB`
    )
    const stored = await readSheets()

    await forgetDerivation()
    expect(await readSheets()).toEqual(stored)
  }, 120_000)

  it('derives the whole Sheet live while a store is queued', async () => {
    const { player, character, visibility } = await setup()
    const read = () => player.caller.query(api.characters.sheet.get, { id: character.id })
    const before = await read()
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
    // Proofs read the whole Sheet once right after a write, so it never serves a queued store.
    const after = await read()
    expect(after?.meta.streamVersion).toBe(note.streamVersion)
    expect(after?.notes).not.toEqual(before?.notes)
  }, 60_000)

  it('runs a Sheet command sent while a store is queued against the written Character', async () => {
    const { t, player, character, input } = await setup()
    const readCommon = async () => {
      const common = await player.caller.query(api.characters.sheetSlices.get, {
        id: character.id,
        campaignId: input.campaignId,
        slice: 'COMMON'
      })
      if (common?.slice !== 'COMMON') throw new Error('Expected the COMMON slice.')
      return common.data
    }
    const before = await readCommon()
    // Swap Strength 15 and Constitution 13: the Builder commit raises the maximum by one and queues
    // the Character's store.
    const draft = await player.caller.mutation(api.characters.drafts.create, {
      id: character.id,
      systemId: character.systemId
    })
    const current = draft.payload.character
    const abilities = current.intent.abilities
    if (abilities?.method !== 'STANDARD_ARRAY') throw new Error('Expected a standard array.')
    await player.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'edit',
      character: {
        ...current,
        intent: {
          ...current.intent,
          abilities: {
            ...abilities,
            assignments: abilities.assignments.map((assignment) =>
              assignment.ability === 'STRENGTH'
                ? { ...assignment, option: '13' as const }
                : assignment.ability === 'CONSTITUTION'
                  ? { ...assignment, option: '15' as const }
                  : assignment
            )
          }
        }
      }
    })
    expect(
      await t.run((ctx) => ctx.db.query('characterSheetPendingStores').collect())
    ).toHaveLength(1)
    const served = await readCommon()
    expect(served.overview.maxHitPoints).toBe(before.overview.maxHitPoints)

    // The command clamps to the written maximum, not the one the queued read served.
    const healed = await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: served.meta.streamVersion,
        current: before.overview.maxHitPoints + 1
      }
    })
    const after = await readCommon()
    expect(after.meta.streamVersion).toBe(healed.streamVersion)
    expect(after.overview).toMatchObject({
      maxHitPoints: before.overview.maxHitPoints + 1,
      currentHitPoints: before.overview.maxHitPoints + 1
    })
  }, 60_000)

  it('drops a superseded store and never writes over a newer one', async () => {
    const { t, player, character, visibility } = await setup()
    const createNote = (expectedVersion: number, title: string) =>
      player.caller.mutation(api.characters.sheetCommands.execute, {
        id: character.id,
        command: {
          type: 'CREATE_NOTE',
          commandId: crypto.randomUUID(),
          expectedVersion,
          title,
          groupId: 'session-notes'
        }
      })
    const readStore = () =>
      t.run(async (ctx) => ({
        derivation: await ctx.db
          .query('characterSheetDerivations')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique(),
        sections: await ctx.db
          .query('characterSheetSections')
          .withIndex('by_characterId_viewer_section', (q) => q.eq('characterId', character.id))
          .collect(),
        pending: await ctx.db.query('characterSheetPendingStores').collect()
      }))
    const runStore = (token: string) =>
      t.mutation(internal.characters.sheetSectionDerivation.store, {
        characterId: character.id,
        token
      })

    const first = await createNote(visibility.streamVersion, 'Session one')
    const [firstPending] = (await readStore()).pending
    if (!firstPending) throw new Error('A note write queues its store.')
    await createNote(first.streamVersion, 'Session two')
    const queued = await readStore()
    expect(queued.pending.map(({ token }) => token)).not.toContain(firstPending.token)
    // The first write's store started before the second could cancel it: it finds a newer token.
    await runStore(firstPending.token)
    expect(await readStore()).toEqual(queued)

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const landed = await readStore()
    expect(landed.pending).toEqual([])
    expect(landed.derivation?.fingerprint).not.toBe(queued.derivation?.fingerprint)
    // Run again after the newer store landed, it finds the stored Sheet current.
    await runStore(firstPending.token)
    expect(await readStore()).toEqual(landed)
  }, 60_000)

  it("queues a new Character's store at its commit, which lands as current sections", async () => {
    const { t, owner, createCharacter } = await readyCharacterFixture()
    const { draft, character } = await createCharacter()
    await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const sectionsState = () =>
      t.query(internal.characters.development.sheetSectionsState, { characterId: character.id })
    expect(await sectionsState()).toBe('QUEUED')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await sectionsState()).toBe('CURRENT')
  }, 60_000)

  it('derives live after a content seed moves a stored Sheet, since a seed queues no store', async () => {
    const { t, player, character, input } = await setup()
    const sectionsState = () =>
      t.query(internal.characters.development.sheetSectionsState, { characterId: character.id })
    expect(await sectionsState()).toBe('CURRENT')
    // A platform seed moves every Character in its System, so it queues none (ADR 0041).
    const [spell] = srdSpells
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'SPELL', ...spell!, document: spell! })]
    })
    expect(await sectionsState()).toBe('MISSING')
    // With no store queued, a slice read serves nothing stored: it derives live.
    expect(
      await t.run((ctx) =>
        readStoredCharacterSheetSections(ctx, {
          userId: player.userId,
          lookupId: character.id,
          campaignId: input.campaignId,
          sections: [characterSheetSection.slice('COMMON')],
          whileQueued: true
        })
      )
    ).toBeNull()
  }, 60_000)

  it('stores no Sheet for a Character that a content replacement left needing Builder repair', async () => {
    const { t, owner, createCharacter } = await readyCharacterFixture()
    const { draft, character } = await createCharacter()
    await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    // The commit queued its derivation. Before it runs, the SRD replaces the fixture's Fighter with
    // the canonical one, whose Fighting Style is a required choice the Character never made.
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'CLASS', ...fighter, document: fighter })]
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const stores = await t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect()).filter(
        (job) => job.name === 'characters/sheetSectionDerivation:store'
      )
    )
    expect(stores.map((job) => job.state.kind)).toEqual(['success'])
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('characterSheetDerivations')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique()
      )
    ).toBeNull()
    // The Sheet itself still reports the repair.
    await expect(
      owner.caller.query(api.characters.sheet.get, { id: character.id })
    ).rejects.toThrow('Character requires Builder repair before the Sheet can be read.')
  })

  it('derives live once an input moves with no store queued, and serves the stored slice while one is', async () => {
    const { t, player, character, input, visibility, forgetDerivation } = await setup()
    const readCommon = () =>
      t.run((ctx) =>
        readCurrentSection(ctx, {
          userId: player.userId,
          lookupId: character.id,
          campaignId: input.campaignId,
          section: characterSheetSection.slice('COMMON')
        })
      )
    const queryCommon = () =>
      player.caller.query(api.characters.sheetSlices.get, {
        id: character.id,
        campaignId: input.campaignId,
        slice: 'COMMON'
      })
    const stored = characterSheetSliceResponseDtoSchema.parse(await readCommon())
    if (stored.slice !== 'COMMON') throw new Error('Expected the stored COMMON slice.')
    // A raw patch queues no store, so nothing marks the stored section as pending: it derives live.
    await t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', input.campaignId))
        .unique()
      await ctx.db.patch(campaign!._id, { contentMaturity: 'MATURE' })
    })
    expect(await readCommon()).toBeNull()
    expect(await t.run((ctx) => ctx.db.query('characterSheetPendingStores').collect())).toEqual([])
    const live = await queryCommon()
    expect(live?.data.meta.streamVersion).toBe(visibility.streamVersion)

    // A note write evaluates nothing: it queues the derivation, and the slice read serves the stored
    // section at the written stream version meanwhile (ADR 0041 Amendment 2).
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
    // A miss (undefined) leaves `t.run` as null.
    expect(await readCommon()).toBeNull()
    expect(await queryCommon()).toEqual({
      ...stored,
      data: { ...stored.data, meta: { ...stored.data.meta, streamVersion: note.streamVersion } }
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await readCommon()).not.toBeNull()
    const landed = await queryCommon()
    expect(landed?.data.meta.streamVersion).toBe(note.streamVersion)
    // The landed store serves what a live derivation over the same inputs serves.
    await forgetDerivation()
    expect(await queryCommon()).toEqual(landed)
  }, 60_000)

  it('queues one derivation per Character, which a newer queued write replaces', async () => {
    const { t, player, character, input, visibility } = await setup()
    const [target] = listCharacterSheetPanelTargets(await player.caller.query(campaignSheet, input))
    const readStored = (section: string) =>
      t.run((ctx) =>
        readCurrentSection(ctx, {
          userId: player.userId,
          lookupId: character.id,
          campaignId: input.campaignId,
          section
        })
      )
    // Each queued store also schedules the check that queues it again if it fails (D215).
    const readQueue = () =>
      t.run(async (ctx) => ({
        scheduled: (await ctx.db.system.query('_scheduled_functions').collect())
          .filter((row) => row.state.kind === 'pending' && row.name === SHEET_STORE)
          .map((row) => row._id),
        pending: (await ctx.db.query('characterSheetPendingStores').collect()).map(
          (row) => row.scheduledId
        )
      }))
    // A note write evaluates nothing, so it queues the derivation.
    const createNote = (expectedVersion: number, title: string) =>
      player.caller.mutation(api.characters.sheetCommands.execute, {
        id: character.id,
        command: {
          type: 'CREATE_NOTE',
          commandId: crypto.randomUUID(),
          expectedVersion,
          title,
          groupId: 'session-notes'
        }
      })

    const first = await createNote(visibility.streamVersion, 'Session one')
    const firstQueue = await readQueue()
    expect(firstQueue.scheduled).toHaveLength(1)
    expect(firstQueue.pending).toEqual(firstQueue.scheduled)
    const second = await createNote(first.streamVersion, 'Session two')
    const secondQueue = await readQueue()
    expect(secondQueue.scheduled).toHaveLength(1)
    expect(secondQueue.pending).toEqual(secondQueue.scheduled)
    expect(secondQueue.scheduled).not.toEqual(firstQueue.scheduled)

    // Until the queued derivation lands, reads serve the stored sections at the written stream
    // version (ADR 0041 Amendment 2). A note changes no stored section, so they are what it stores.
    expect(await readStored(characterSheetSection.slice('COMMON'))).toBeNull()
    const served = {
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
    expect(served.common?.data.meta.streamVersion).toBe(second.streamVersion)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await readQueue()).toEqual({ scheduled: [], pending: [] })
    expect(await readStored(characterSheetSection.slice('COMMON'))).toEqual(served.common)
    expect(await readStored(characterSheetSection.panel(target!))).not.toBeNull()
    expect(
      await player.caller.query(api.characters.panels.get, { id: character.id, target: target! })
    ).toEqual(served.panel)
  }, 60_000)

  it('cancels only a queued derivation that has not started, as Convex does', async () => {
    const { t, player, character, visibility } = await setup()
    const createNote = (expectedVersion: number, title: string) =>
      player.caller.mutation(api.characters.sheetCommands.execute, {
        id: character.id,
        command: {
          type: 'CREATE_NOTE',
          commandId: crypto.randomUUID(),
          expectedVersion,
          title,
          groupId: 'session-notes'
        }
      })
    const first = await createNote(visibility.streamVersion, 'Session one')
    const queued = await t.run(async (ctx) => {
      const [row] = await ctx.db.query('characterSheetPendingStores').take(1)
      return row!
    })
    const scheduledId = queued.scheduledId
    if (!scheduledId) throw new Error('A Character write schedules its store.')
    // The derivation runs, so the job is no longer pending. Point the Character's pending row at it
    // again, as a write racing the running job sees it.
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const finished = await t.run((ctx) => ctx.db.system.get(scheduledId))
    expect(finished?.state.kind).toBe('success')
    await t.run((ctx) =>
      ctx.db.insert('characterSheetPendingStores', {
        characterId: queued.characterId,
        scheduledId,
        token: queued.token,
        retried: false
      })
    )
    await createNote(first.streamVersion, 'Session two')
    // convex-test, like Convex, cancels only a pending job; cancelling a started one trips its
    // "Unexpected scheduled function state" invariant.
    expect((await t.run((ctx) => ctx.db.system.get(scheduledId)))?.state.kind).toBe('success')
  }, 60_000)

  it("stores a Sheet command's sections in its own transaction, leaving no gap", async () => {
    const { t, player, character, input, visibility } = await setup()
    const [target] = listCharacterSheetPanelTargets(await player.caller.query(campaignSheet, input))
    const readStored = (section: string) =>
      t.run((ctx) =>
        readCurrentSection(ctx, {
          userId: player.userId,
          lookupId: character.id,
          campaignId: input.campaignId,
          section
        })
      )
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
    expect(
      await t.run((ctx) => ctx.db.query('characterSheetPendingStores').collect())
    ).toHaveLength(1)

    const adjusted = await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: note.streamVersion,
        adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 1 }
      }
    })
    // The command's store supersedes the note's queued derivation, which would find it current.
    const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    expect(scheduled.filter((row) => row.state.kind === 'pending')).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('characterSheetPendingStores').collect())).toEqual([])
    const common = await player.caller.query(api.characters.sheetSlices.get, {
      id: character.id,
      campaignId: input.campaignId,
      slice: 'COMMON'
    })
    expect(common?.data.meta.streamVersion).toBe(adjusted.streamVersion)
    expect(await readStored(characterSheetSection.slice('COMMON'))).toEqual(common)
    expect(await readStored(characterSheetSection.panel(target!))).not.toBeNull()
  }, 60_000)

  it('queues a derivation when an edit draft opens or is discarded, and none for its saves', async () => {
    const { t, player, character } = await setup()
    const readPending = () => t.run((ctx) => ctx.db.query('characterSheetPendingStores').collect())
    const readCurrent = async () =>
      (await t.run((ctx) => readCharacterSheetStoreState(ctx, player.userId, character.id)))
        ?.current
    // The Sheet shows whether a Builder draft is open, so opening one changes its sections.
    const edit = await player.caller.mutation(api.characters.drafts.create, {
      id: character.id,
      systemId: character.systemId
    })
    expect(await readPending()).toHaveLength(1)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await readCurrent()).toBe(true)
    await player.caller.mutation(api.characters.drafts.save, {
      expectedDraftId: edit.id,
      characterId: character.id,
      mode: 'edit',
      character: { ...character, label: 'Unsaved edit', status: 'DRAFT' }
    })
    expect(await readPending()).toEqual([])
    expect(await readCurrent()).toBe(true)
    await player.caller.mutation(api.characters.drafts.discard, {
      id: character.id,
      expectedDraftId: edit.id
    })
    expect(await readPending()).toHaveLength(1)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await readCurrent()).toBe(true)
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
    const readChecksums = () =>
      t.run((ctx) =>
        ctx.db
          .query('characterSheetSectionChecksums')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique()
      )
    const rederive = async () => {
      await t.run(async (ctx) => {
        const derivation = await ctx.db
          .query('characterSheetDerivations')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique()
        await ctx.db.patch(derivation!._id, { fingerprint: 'stale' })
      })
      await t.mutation(internal.characters.sheetSectionDerivation.store, {
        characterId: character.id,
        token: crypto.randomUUID()
      })
      return readChecksums()
    }
    // Snapshot builds finish without a Character write, so the setup's stored preparation manifest
    // can predate them; derive once over the settled inputs first.
    const checksums = await rederive()
    const sections = checksums!.sections.map((section, index) =>
      index === 0 ? { ...section, checksum: 'marker' } : section
    )
    await t.run((ctx) => ctx.db.patch(checksums!._id, { sections }))

    await t.mutation(internal.characters.sheetSectionDerivation.store, {
      characterId: character.id,
      token: crypto.randomUUID()
    })
    expect((await readChecksums())!.sections).toEqual(sections)

    expect((await rederive())!.sections).toEqual(checksums!.sections)
  }, 60_000)

  it('reads each store input once and stores what a fresh derivation stores', async () => {
    const { t, player, character, forgetDerivation } = await setup()
    const readStored = () =>
      t.run(async (ctx) => {
        const derivation = await ctx.db
          .query('characterSheetDerivations')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique()
        const checksums = await ctx.db
          .query('characterSheetSectionChecksums')
          .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
          .unique()
        const sections = await ctx.db
          .query('characterSheetSections')
          .withIndex('by_characterId_viewer_section', (q) => q.eq('characterId', character.id))
          .collect()
        return {
          fingerprint: derivation?.fingerprint,
          sections: checksums?.sections,
          rows: sections.map(({ viewer, section, checksum, json }) => ({
            viewer,
            section,
            checksum,
            json
          }))
        }
      })
    // A fresh derivation loads every input itself and fingerprints them on its own.
    await forgetDerivation()
    await t.run(async (ctx) => {
      const facts = await loadCharacterSheetFacts(ctx, player.userId, character.id)
      await storeCharacterSheetSections(ctx, facts!)
    })
    const fresh = await readStored()
    expect(fresh.fingerprint).toBeDefined()

    // A stale derivation, so the store reads an existing row and rewrites it.
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query('characterSheetDerivations').collect())
        await ctx.db.patch(row._id, { fingerprint: 'stale' })
    })
    const totals = createDatabaseIoTotals()
    await t.run((ctx) =>
      deriveAndStoreCharacterSheet(
        { ...ctx, db: countDatabaseIo(ctx.db, totals) },
        character.id,
        crypto.randomUUID()
      )
    )
    expect(await readStored()).toEqual(fresh)
    const repeated = Object.entries(totals.reads.byTable)
      .filter(([, table]) => table.documents > table.distinct)
      .map(([name, table]) => [name, table.documents, table.distinct])
      .sort()
    // The store reads each of its own inputs once. These repeats belong to code shared with the
    // Builder and Sheet read paths, outside the store: the source-access read checks the Campaign
    // assignment, route and Character again, and the preparation manifest reads the content head.
    expect(repeated).toEqual([
      ['authoredRouteIds', 3, 2],
      ['campaignCharacterAssignments', 3, 1],
      ['characters', 2, 1],
      ['contentSnapshotHeads', 2, 1]
    ])
  }, 60_000)

  it('queues every assigned Character after a share, a membership change or a currency change', async () => {
    const { t, player, gm, party, campaign, character } = await setup()
    const readCommon = () =>
      t.run((ctx) =>
        readCurrentSection(ctx, {
          userId: player.userId,
          lookupId: character.id,
          campaignId: campaign.id,
          section: characterSheetSection.slice('COMMON')
        })
      )
    const readPending = () =>
      t.run(async (ctx) =>
        (await ctx.db.query('characterSheetPendingStores').collect()).map((row) => row.characterId)
      )
    // Each change moves the Character's fingerprint outside a Character write; the same mutation
    // queues its derivation, which lands and serves stored sections again (ADR 0041, D215).
    const expectQueuedThenCurrent = async (change: () => Promise<unknown>) => {
      expect(await readCommon()).not.toBeNull()
      await change()
      expect(await readPending()).toEqual([character.id])
      expect(await readCommon()).toBeNull()
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      expect(await readPending()).toEqual([])
      expect(await readCommon()).not.toBeNull()
    }

    await t.run((ctx) => makePublishedRootOwned(ctx, acolyte.id, gm.userId))
    await expectQueuedThenCurrent(() =>
      gm.caller.mutation(api.campaigns.contentShares.share, {
        campaignId: campaign.id,
        subjectKind: 'BACKGROUND',
        subjectId: acolyte.id
      })
    )
    // A membership change queues the Campaign only when that member shared content (D216): the
    // Sheet reads the sharer's membership. The party member shared nothing and owns no assigned
    // Character here, so their departure queues no Sheet store.
    expect(await readCommon()).not.toBeNull()
    {
      const { version, accessStartedAt } = await t.run(async (ctx) => ({
        version: (await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
          .unique())!.version,
        accessStartedAt: (await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', campaign.id).eq('userId', party.userId)
          )
          .unique())!.accessStartedAt
      }))
      await party.caller.mutation(api.campaigns.membershipDeparture.leave, {
        campaignId: campaign.id,
        expectedCampaignVersion: version,
        expectedMembershipAccessStartedAt: accessStartedAt,
        commandId: crypto.randomUUID()
      })
    }
    expect(await readPending()).toEqual([])
    expect(await readCommon()).not.toBeNull()
    await expectQueuedThenCurrent(() =>
      gm.caller.mutation(api.campaigns.currencySystems.save, {
        campaignId: campaign.id,
        label: 'Campaign tokens',
        isReference: true,
        denominations: [{ label: 'Token', abbreviation: 'tk', scaleInReference: 1 }]
      })
    )
    // The sharer's membership is a Sheet input: the GM shared the Background, so their membership
    // change queues the party's Sheets. Shared content stops being valid, so the Sheet need not
    // serve afterwards; only the queueing is asserted.
    await t.run(async (ctx) => {
      const tracked = withSceneVisionTracking(ctx)
      const membership = await tracked.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', gm.userId)
        )
        .unique()
      await tracked.db.patch(membership!._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    expect(await readPending()).toEqual([character.id])
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await readPending()).toEqual([])
  }, 60_000)

  it("runs a Campaign change's stores one at a time, and every assigned Character ends current", async () => {
    const { t, player, gm, campaign, character, assignAnotherCharacter } = await setup()
    const members = [
      { id: character.id, userId: player.userId },
      await assignAnotherCharacter(),
      await assignAnotherCharacter()
    ]
    const party = members.map(({ id }) => id)
    const queuedStores = () =>
      t.run(async (ctx) =>
        (await ctx.db.system.query('_scheduled_functions').collect())
          .filter(
            (job) =>
              job.name === SHEET_STORE &&
              (job.state.kind === 'pending' || job.state.kind === 'inProgress')
          )
          .map((job) => (job.args[0] as { characterId: string }).characterId)
      )
    const readPending = () =>
      t.run(async (ctx) => (await ctx.db.query('characterSheetPendingStores').collect()).length)

    await saveCampaignCurrency(gm, campaign.id, 'Campaign tokens')
    expect(await readPending()).toBe(party.length)
    const started: string[] = []
    for (let step = 0; step < 50 && (await readPending()) > 0; step += 1) {
      const queued = await queuedStores()
      expect(queued.length).toBeLessThanOrEqual(1)
      for (const characterId of queued)
        if (!started.includes(characterId)) started.push(characterId)
      vi.advanceTimersByTime(CAMPAIGN_BACKGROUND_SETTLE_MS)
      await t.finishInProgressScheduledFunctions()
    }
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await readPending()).toBe(0)
    expect(started.toSorted()).toEqual(party.toSorted())
    const current = await t.run((ctx) =>
      Promise.all(
        members.map(
          async ({ id, userId }) => (await readCharacterSheetStoreState(ctx, userId, id))?.current
        )
      )
    )
    expect(current).toEqual(party.map(() => true))
  }, 120_000)

  it("keeps a Campaign change's stores moving when a Character write requeues the running one", async () => {
    const { t, player, gm, campaign, character, assignAnotherCharacter } = await setup()
    const members = [
      { id: character.id, userId: player.userId },
      await assignAnotherCharacter(),
      await assignAnotherCharacter()
    ]
    await saveCampaignCurrency(gm, campaign.id, 'Campaign tokens')
    // A Character write lands while the first store of the chain is scheduled.
    await t.run(async (ctx) => {
      const head = (await ctx.db.query('characterSheetPendingStores').collect()).find(
        (row) => row.scheduledId !== undefined
      )
      await scheduleCharacterSheetSections(ctx, head!.characterId)
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query('characterSheetPendingStores').collect()).length
      )
    ).toBe(0)
    const current = await t.run((ctx) =>
      Promise.all(
        members.map(
          async ({ id, userId }) => (await readCharacterSheetStoreState(ctx, userId, id))?.current
        )
      )
    )
    expect(current).toEqual(members.map(() => true))
  }, 120_000)

  it("keeps a Campaign change's stores moving when the Character of the running one is deleted", async () => {
    const { t, player, gm, campaign, character, assignAnotherCharacter } = await setup()
    const members = [
      { id: character.id, userId: player.userId },
      await assignAnotherCharacter(),
      await assignAnotherCharacter()
    ]
    await saveCampaignCurrency(gm, campaign.id, 'Campaign tokens')
    // The first store's Character leaves the Campaign and is deleted before its store runs.
    const deletedId = await t.run(async (ctx) => {
      const head = (await ctx.db.query('characterSheetPendingStores').collect()).find(
        (row) => row.scheduledId !== undefined
      )
      if (!head) throw new Error('A Campaign change schedules its first store.')
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', head.characterId))
        .unique()
      await ctx.db.delete(assignment!._id)
      const { active, draft } = await loadCharacterState(ctx, head.characterId)
      const owner = members.find(({ id }) => id === head.characterId)!
      await removePrivateCharacter(ctx, owner.userId, head.characterId, active, draft)
      return head.characterId
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(
      await t.run(
        async (ctx) => (await ctx.db.query('characterSheetPendingStores').collect()).length
      )
    ).toBe(0)
    const remaining = members.filter(({ id }) => id !== deletedId)
    const current = await t.run((ctx) =>
      Promise.all(
        remaining.map(
          async ({ id, userId }) => (await readCharacterSheetStoreState(ctx, userId, id))?.current
        )
      )
    )
    expect(current).toEqual(remaining.map(() => true))
  }, 120_000)

  /** Removes the Character's route, so its store fails; restoring it lets the store succeed. */
  const breakStores = async (t: Awaited<ReturnType<typeof setup>>['t'], characterId: string) => {
    const route = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', characterId))
        .unique()
      await ctx.db.delete(row!._id)
      return row!
    })
    return () =>
      t.run(async (ctx) => {
        const { _id, _creationTime, ...fields } = route
        await ctx.db.insert('authoredRouteIds', fields)
      })
  }
  /** The states of the Character's store jobs scheduled since `earlier` listed every job. */
  const storeStates = (
    t: Awaited<ReturnType<typeof setup>>['t'],
    characterId: string,
    earlier: ReadonlySet<string>
  ) =>
    t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect())
        .filter(
          (job) =>
            job.name === SHEET_STORE &&
            !earlier.has(job._id) &&
            (job.args[0] as { characterId: string }).characterId === characterId
        )
        .map((job) => job.state.kind)
    )
  const listJobs = async (
    t: Awaited<ReturnType<typeof setup>>['t']
  ): Promise<ReadonlySet<string>> =>
    new Set(
      await t.run(async (ctx) =>
        (await ctx.db.system.query('_scheduled_functions').collect()).map((job) => job._id)
      )
    )

  it('queues a failed store once more, and the Character ends current', async () => {
    const { t, player, gm, campaign, character } = await setup()
    const before = await listJobs(t)
    await saveCampaignCurrency(gm, campaign.id, 'Campaign tokens')
    const restore = await breakStores(t, character.id)
    // The store is due; its check runs CHARACTER_SHEET_STORE_CHECK_MS after it was due.
    await vi.advanceTimersByTimeAsync(CHARACTER_SHEET_STORE_CHECK_MS)
    await t.finishInProgressScheduledFunctions()
    expect(await storeStates(t, character.id, before)).toEqual(['failed'])
    await restore()
    // Its check will queue it again, so proofs waiting on the Sheet keep waiting (D214).
    expect(
      await t.query(internal.characters.development.sheetSectionsState, {
        characterId: character.id
      })
    ).toBe('QUEUED')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await storeStates(t, character.id, before)).toEqual(['failed', 'success'])
    const state = await t.run((ctx) =>
      readCharacterSheetStoreState(ctx, player.userId, character.id)
    )
    expect(state?.current).toBe(true)
  }, 60_000)

  it('leaves a store that fails twice stale and recorded, without queueing it again', async () => {
    const { t, player, gm, campaign, character } = await setup()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const before = await listJobs(t)
    await saveCampaignCurrency(gm, campaign.id, 'Campaign tokens')
    const restore = await breakStores(t, character.id)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await storeStates(t, character.id, before)).toEqual(['failed', 'failed'])
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(character.id))
    logged.mockRestore()
    await restore()
    const pending = await t.run((ctx) => ctx.db.query('characterSheetPendingStores').collect())
    expect(pending).toEqual([])
    const state = await t.run((ctx) =>
      readCharacterSheetStoreState(ctx, player.userId, character.id)
    )
    expect(state?.current).toBe(false)
    expect(
      await t.query(internal.characters.development.sheetSectionsState, {
        characterId: character.id
      })
    ).toBe('MISSING')
  }, 60_000)
})
