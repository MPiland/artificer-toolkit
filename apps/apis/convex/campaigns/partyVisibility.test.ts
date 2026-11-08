import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { listCampaignAdjustmentsInputSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import type { campaignCharacterSheetExecuteInputSchema } from '@artificer-toolkit/schema/api/campaignCharacterSheet'
import type { CampaignCharacterBasicsDto } from '@artificer-toolkit/schema/api/campaignCharacterBasics'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { CharacterPartyVisibilityDto } from '@artificer-toolkit/schema/api/healthDisplay'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { handlerOf, inOwnTransaction } from '../../tests/fixtures/queryTransaction'
import { get as basicsQuery } from './characterBasics'
import { createPartyPlayer, createPartyUser } from '../../tests/fixtures/partyPlayer'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const get = makeFunctionReference<
  'query',
  z.input<typeof listCampaignAdjustmentsInputSchema>,
  CharacterSheetResponseDto
>('campaigns/characterSheet:get')
const basics = makeFunctionReference<
  'query',
  z.input<typeof listCampaignAdjustmentsInputSchema>,
  CampaignCharacterBasicsDto
>('campaigns/characterBasics:get')
const execute = makeFunctionReference<
  'mutation',
  z.input<typeof campaignCharacterSheetExecuteInputSchema>,
  CharacterSheetCommandResponseDto
>('campaigns/characterSheet:execute')
const personalExecute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')

async function setup() {
  const base = await readyCharacterFixture()
  const { draft, character } = await base.createCharacter()
  character.profile = {
    ...character.profile,
    personalityTraits: 'Laughs at danger.',
    ideals: 'Freedom.',
    bonds: 'My old crew.',
    flaws: 'Too curious.',
    allies: 'The harbour guild.',
    backstory: 'Raised on the docks.',
    height: 'Tall'
  }
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const { owner: player, other: gm, t } = base
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'Party visibility',
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
  async function setVisibility(visibility: CharacterPartyVisibilityDto) {
    const current = await player.caller.query(get, input)
    return player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'SET_PARTY_VISIBILITY',
        commandId: crypto.randomUUID(),
        expectedVersion: current.meta.streamVersion,
        visibility
      }
    })
  }
  return { t, player, gm, party, campaign, character, input, setVisibility }
}

describe('Party can view (ADR 0034 decision 5)', () => {
  it('keeps another player’s Sheet GM-only until its player turns Party can view on', async () => {
    const { player, gm, party, input, setVisibility } = await setup()

    const own = await player.caller.query(get, input)
    expect(own.meta).toMatchObject({
      viewer: 'CHARACTER_OWNER',
      partyVisibility: { sheet: false, health: 'HIDDEN' }
    })
    expect(own.notes.personalityTraits).toBe('Laughs at danger.')

    const gmView = await gm.caller.query(get, input)
    expect(gmView.meta.viewer).toBe('CAMPAIGN_OWNER')
    expect(gmView.meta.partyVisibility).toBeUndefined()
    expect(gmView.notes.backstory).toBe('Raised on the docks.')

    await expect(party.caller.query(get, input)).rejects.toThrow('Assigned Character not found.')

    await setVisibility({ sheet: true, health: 'HIDDEN' })
    const partyView = await party.caller.query(get, input)
    expect(partyView.meta).toMatchObject({
      viewer: 'PARTY_MEMBER',
      hasBuilderDraft: false,
      capabilities: {
        managePlayState: false,
        managePrivateNotes: false,
        manageInventory: false,
        openBuilder: false
      }
    })
    expect(partyView.meta.partyVisibility).toBeUndefined()
    expect(partyView.identity.label).toBe(own.identity.label)
    expect(partyView.overview.maxHitPoints).toBe(own.overview.maxHitPoints)
    // Personality and background never reach another player, even with the option on.
    for (const field of [
      'personalityTraits',
      'ideals',
      'bonds',
      'flaws',
      'allies',
      'backstory',
      'notes',
      'items',
      'groups'
    ] as const)
      expect(partyView.notes[field]).toBeUndefined()
    expect(partyView.identity.concept).toBeUndefined()
    expect(partyView.notes.appearance).toBe('Tall')
    const serialized = JSON.stringify(partyView)
    for (const secret of ['Laughs at danger', 'Raised on the docks', 'My old crew'])
      expect(serialized).not.toContain(secret)

    await setVisibility({ sheet: false, health: 'HIDDEN' })
    await expect(party.caller.query(get, input)).rejects.toThrow('Assigned Character not found.')
  }, 60_000)

  it('lets only the Character’s player set it, and never lets another player act', async () => {
    const { player, gm, party, input, setVisibility } = await setup()
    const current = await gm.caller.query(get, input)
    await expect(
      gm.caller.mutation(execute, {
        ...input,
        command: {
          type: 'SET_PARTY_VISIBILITY',
          commandId: crypto.randomUUID(),
          expectedVersion: current.meta.streamVersion,
          visibility: { sheet: true, health: 'EXACT' }
        }
      })
    ).rejects.toThrow()

    const updated = await setVisibility({ sheet: true, health: 'BAR' })
    expect(updated).not.toHaveProperty('sheet')
    const updatedSheet = await player.caller.query(get, input)
    expect(updatedSheet.meta.partyVisibility).toEqual({ sheet: true, health: 'BAR' })
    await expect(
      party.caller.mutation(execute, {
        ...input,
        command: {
          type: 'SET_INSPIRATION',
          commandId: crypto.randomUUID(),
          expectedVersion: updated.streamVersion,
          inspired: true
        }
      })
    ).rejects.toThrow('Assigned Character not found.')
  }, 60_000)

  it('shows every member only the public roster basics', async () => {
    const { t, gm, party, player, input, character, setVisibility } = await setup()
    const expected = {
      characterId: character.id,
      label: 'Aria',
      classSummary: expect.stringContaining('Fighter'),
      totalLevel: 1,
      sheetVisible: false
    }
    for (const member of [gm, player, party]) {
      const roster = await member.caller.query(basics, input)
      expect(Object.keys(roster).sort()).toEqual(
        ['characterId', 'classSummary', 'label', 'sheetVisible', 'totalLevel'].sort()
      )
      expect(roster).toEqual(expected)
    }
    // The stored roster fields are the Sheet identity's own derivation, written at Builder commit.
    const { identity } = await player.caller.query(get, input)
    expect(await gm.caller.query(basics, input)).toMatchObject({
      label: identity.label,
      classSummary: identity.classSummary,
      totalLevel: identity.totalLevel
    })
    await setVisibility({ sheet: true, health: 'HIDDEN' })
    expect(await party.caller.query(basics, input)).toEqual({ ...expected, sheetVisible: true })

    const outsider = await t.run(async (ctx) =>
      ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', input.campaignId).eq('userId', party.userId)
        )
        .unique()
    )
    await t.run((ctx) =>
      ctx.db.patch(outsider!._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    await expect(party.caller.query(basics, input)).rejects.toThrow()
  }, 60_000)

  it('refuses the roster basics to a non-member and for a Character not assigned here', async () => {
    const { t, gm, player, input } = await setup()
    const stranger = await createPartyUser(t, {
      username: 'Stranger',
      email: 'stranger-roster@example.invalid'
    })
    await expect(stranger.caller.query(basics, input)).rejects.toThrow('Campaign not found')

    const assignment = await t.run(async (ctx) =>
      ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', input.characterId))
        .unique()
    )
    await t.run((ctx) => ctx.db.delete(assignment!._id))
    for (const member of [gm, player])
      await expect(member.caller.query(basics, input)).rejects.toThrow(
        'Assigned Character not found.'
      )
  }, 60_000)

  // PERF-6.T2: the roster subscribes one basics query per assigned Character. It derived the whole
  // Sheet (System, sources, effects) for four fields, so every write reran each subscription at the
  // Sheet's cost. It reads the caller's profile, the Campaign's authority, the assignment, the
  // Character head and its play record, and nothing else.
  it('reads only authority, the assignment, the head and the play record', async () => {
    const { party, input } = await setup()
    const handler = handlerOf<CampaignCharacterBasicsDto>(basicsQuery)
    const totals = createDatabaseIoTotals()
    const roster = await party.caller.run((ctx) =>
      handler(
        inOwnTransaction(
          ctx as unknown as QueryCtx,
          countDatabaseIo(ctx.db, totals) as QueryCtx['db']
        ),
        input
      )
    )
    expect(roster.characterId).toBe(input.characterId)
    expect(
      Object.fromEntries(
        Object.entries(totals.reads.byTable).map(([table, entry]) => [table, entry.documents])
      )
    ).toEqual({
      userProfiles: 1,
      authoredRouteIds: 1,
      campaigns: 1,
      campaignMemberships: 1,
      campaignCharacterAssignments: 1,
      characters: 1,
      characterPlayStates: 1
    })
    // Six for the query's own read set plus the caller's profile, which every authenticated query reads.
    expect(totals.reads.documents).toBeLessThanOrEqual(7)
    expect(totals.reads.bytes).toBeLessThanOrEqual(10 * 1024)
  }, 60_000)
})
