import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import {
  attachFixtureRoom,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { describe, expect, it } from 'vitest'
import type {
  CampaignConditionDto,
  SaveCampaignConditionInput
} from '@artificer-toolkit/schema/api/campaignLiveState'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto,
  EncounterSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { encounterSummaryOf } from '../../tests/fixtures/encounterSummaries'
import { api, components, internal } from '../_generated/api'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { encounterReadTransaction } from './encounterPorts'

const get = makeFunctionReference<
  'query',
  { encounterId: string },
  EncounterGmProjectionDto | EncounterPlayerProjectionDto
>('encounters/projectionReads:get')
const active = makeFunctionReference<'query', { campaignId: string }, EncounterSessionStateDto>(
  'encounters/activeReads:active'
)
const list = makeFunctionReference<'query', { campaignId: string }, EncounterSummaryDto[]>(
  'encounters/projectionReads:list'
)
const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const saveCondition = makeFunctionReference<
  'mutation',
  SaveCampaignConditionInput,
  CampaignConditionDto
>('campaigns/gmWrites:saveCondition')

type EncounterProjection = EncounterGmProjectionDto | EncounterPlayerProjectionDto

async function addPartyMember(t: Awaited<ReturnType<typeof setupCharacterRun>>['t']) {
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Encounter party member',
          email: 'encounter-party@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Missing party member identity.')
  return { caller, userId: identity.userId }
}

async function setStatus(
  t: Awaited<ReturnType<typeof setupCharacterRun>>['t'],
  encounterId: string,
  status: 'ACTIVE' | 'COMPLETED'
) {
  await t.run(async (ctx) => {
    if (status === 'ACTIVE') {
      await activateFixtureRun(ctx, encounterId)
      return
    }
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique()
    if (!row) throw new Error('Missing Encounter Run.')
    const state = encounterRunStateSchema.parse({ ...JSON.parse(row.stateJson), status })
    await ctx.db.patch(row._id, {
      status,
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
  })
}

function characterConditions(projection: EncounterProjection, actorId: string): unknown[] {
  const actor = projection.actors.find((candidate) => candidate.id === actorId)
  if (!actor || !Array.isArray(actor.conditions))
    throw new Error('Encounter Character conditions are unavailable.')
  return actor.conditions
}

describe('native Encounter current Character conditions', () => {
  useLocalRoomWorker()

  it.each(['Character', 'Campaign overlay', 'route owner'] as const)(
    'refuses corrupt %s while reading current conditions',
    async (corruption) => {
      const { t, owner, campaign, character, run } = await setupCharacterRun()
      await setStatus(t, run.id, 'ACTIVE')
      if (corruption === 'Campaign overlay') {
        await owner.caller.mutation(saveCondition, {
          campaignId: campaign.id,
          characterId: character.id,
          conditionTypeId: SRD_CONDITION_TYPES[0]!.id,
          visibility: 'SECRET',
          expectedVersion: 0,
          notes: 'PRIVATE-CORRUPT-OVERLAY'
        })
      }
      await t.run(async (ctx) => {
        if (corruption === 'Character') {
          const row = await ctx.db
            .query('characterBuildStates')
            .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
            .unique()
          if (!row) throw new Error('Missing Character fixture.')
          await ctx.db.patch(row._id, { checksum: '0'.repeat(64) })
        } else if (corruption === 'Campaign overlay') {
          const row = await ctx.db
            .query('campaignCharacterStates')
            .withIndex('by_campaignId_characterId', (q) =>
              q.eq('campaignId', campaign.id).eq('characterId', character.id)
            )
            .unique()
          if (!row) throw new Error('Missing Campaign overlay fixture.')
          await ctx.db.patch(row._id, { checksum: '0'.repeat(64) })
        } else {
          const row = await ctx.db
            .query('authoredRouteIds')
            .withIndex('by_subjectId', (q) => q.eq('subjectId', character.id))
            .unique()
          if (!row) throw new Error('Missing Character route fixture.')
          await ctx.db.patch(row._id, { ownerUserId: owner.userId })
        }
      })
      const message =
        corruption === 'route owner'
          ? /assignment mismatch/
          : corruption === 'Character'
            ? /build integrity mismatch/
            : /checksum mismatch/
      await expect(owner.caller.query(get, { encounterId: run.id })).rejects.toThrow(message)
      await expect(owner.caller.query(active, { campaignId: campaign.id })).rejects.toThrow(message)
    },
    30_000
  )

  it('reads current Sheet and Campaign conditions without changing the stored Run', async () => {
    const { t, owner, player, campaign, character, run, actor } = await setupCharacterRun()
    await attachFixtureRoom(t, campaign.id)
    const [personalCondition, visibleCondition] = SRD_CONDITION_TYPES
    if (!personalCondition || !visibleCondition) throw new Error('Missing SRD condition fixture.')
    await setStatus(t, run.id, 'ACTIVE')
    const party = await addPartyMember(t)
    await expect(party.caller.query(get, { encounterId: run.id })).rejects.toThrow(
      'Campaign not found'
    )
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: party.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    const storedBefore = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing Encounter Run.')
      return { stateJson: row.stateJson, stateChecksum: row.stateChecksum, version: row.version }
    })
    expect(
      characterConditions(await owner.caller.query(get, { encounterId: run.id }), actor.id)
    ).toEqual([])

    await player.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADD_CONDITION',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        conditionTypeId: personalCondition.id,
        notes: 'SHEET-CONDITION-NOTE'
      }
    })
    await owner.caller.mutation(saveCondition, {
      campaignId: campaign.id,
      characterId: character.id,
      conditionTypeId: visibleCondition.id,
      visibility: 'VISIBLE',
      expectedVersion: 0,
      notes: 'VISIBLE-CONDITION-NOTE'
    })
    await owner.caller.mutation(saveCondition, {
      campaignId: campaign.id,
      characterId: character.id,
      conditionTypeId: personalCondition.id,
      visibility: 'SECRET',
      expectedVersion: 0,
      notes: 'SECRET-CONDITION-NOTE'
    })

    const [ownerGet, ownerActive, ownerList, playerGet, playerActive, playerList, partyGet] =
      await Promise.all([
        owner.caller.query(get, { encounterId: run.id }),
        owner.caller.query(active, { campaignId: campaign.id }),
        owner.caller.query(list, { campaignId: campaign.id }),
        player.caller.query(get, { encounterId: run.id }),
        player.caller.query(active, { campaignId: campaign.id }),
        player.caller.query(list, { campaignId: campaign.id }),
        party.caller.query(get, { encounterId: run.id })
      ])
    const personal = {
      conditionTypeId: personalCondition.id,
      notes: 'SHEET-CONDITION-NOTE'
    }
    const visibleOverlay = {
      conditionTypeId: visibleCondition.id,
      notes: 'VISIBLE-CONDITION-NOTE'
    }
    const secretOverlay = {
      conditionTypeId: personalCondition.id,
      notes: 'SECRET-CONDITION-NOTE'
    }
    expect(characterConditions(ownerGet, actor.id)).toEqual([
      personal,
      visibleOverlay,
      secretOverlay
    ])
    expect(ownerActive.encounter).toEqual(ownerGet)
    expect(ownerList).toEqual([encounterSummaryOf(ownerGet)])
    expect(characterConditions(playerGet, actor.id)).toEqual([personal, visibleOverlay])
    expect(playerActive.encounter).toEqual(playerGet)
    expect(playerList).toEqual([encounterSummaryOf(playerGet)])
    expect(characterConditions(partyGet, actor.id)).toEqual([personal, visibleOverlay])
    expect(JSON.stringify(playerGet)).not.toContain('SECRET-CONDITION-NOTE')
    expect(JSON.stringify(partyGet)).not.toContain('SECRET-CONDITION-NOTE')

    await player.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'REMOVE_CONDITION',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        conditionTypeId: personalCondition.id
      }
    })
    expect(
      characterConditions(await player.caller.query(get, { encounterId: run.id }), actor.id)
    ).toEqual([visibleOverlay])
    const storedAfter = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing Encounter Run.')
      return { stateJson: row.stateJson, stateChecksum: row.stateChecksum, version: row.version }
    })
    expect(storedAfter).toEqual(storedBefore)

    await player.caller.mutation(api.campaigns.assignments.unassign, {
      campaignId: campaign.id
    })
    const detachedRow = await t.run((ctx) =>
      ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
    )
    if (!detachedRow) throw new Error('Missing detached Encounter Run.')
    for (const caller of [owner.caller, player.caller, party.caller]) {
      const detached = await caller.query(get, { encounterId: run.id })
      expect(characterConditions(detached, actor.id)).toEqual([])
      expect((await caller.query(active, { campaignId: campaign.id })).encounter).toEqual(detached)
      expect(await caller.query(list, { campaignId: campaign.id })).toEqual([
        encounterSummaryOf(detached)
      ])
      expect(JSON.stringify(detached)).not.toContain('SECRET-CONDITION-NOTE')
    }
    expect(await t.run((ctx) => ctx.db.get(detachedRow._id))).toEqual(detachedRow)

    const nextCampaign = await party.caller.mutation(api.campaigns.create.create, {
      name: 'Other Character assignment',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: campaign.gameSystemId,
      primaryRulesCatalogueId: campaign.primaryRulesCatalogueId
    })
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: nextCampaign.id,
        userId: player.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: nextCampaign.createdAt,
        joinedAt: nextCampaign.createdAt,
        leftAt: null
      })
    )
    await player.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: nextCampaign.id,
      characterId: character.id
    })
    await party.caller.mutation(saveCondition, {
      campaignId: nextCampaign.id,
      characterId: character.id,
      conditionTypeId: visibleCondition.id,
      visibility: 'VISIBLE',
      expectedVersion: 0,
      notes: 'OTHER-CAMPAIGN-CONDITION'
    })
    for (const caller of [owner.caller, player.caller, party.caller]) {
      const detached = await caller.query(get, { encounterId: run.id })
      expect(characterConditions(detached, actor.id)).toEqual([])
      expect(JSON.stringify(detached)).not.toContain('OTHER-CAMPAIGN-CONDITION')
    }
    await setStatus(t, run.id, 'COMPLETED')
    const completed = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing Encounter Run.')
      return readEncounterGmProjection(encounterReadTransaction(ctx), readRunState(row))
    })
    expect(await owner.caller.query(get, { encounterId: run.id })).toEqual(completed)
    expect(await owner.caller.query(list, { campaignId: campaign.id })).toEqual([
      encounterSummaryOf(completed)
    ])
    // D87: a player reads no COMPLETED Run.
    await expect(player.caller.query(get, { encounterId: run.id })).rejects.toThrow(
      'Encounter is unavailable.'
    )
    // The room holds no finished Run, so it sends the GM no timeline for it.
    await expect(readRoomTimeline(owner.caller, campaign.id)).resolves.toEqual([])

    await expect(t.query(get, { encounterId: run.id })).rejects.toThrow('Unauthenticated')
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', party.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing party membership.')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: campaign.createdAt })
    })
    await expect(party.caller.query(get, { encounterId: run.id })).rejects.toThrow(
      'Campaign not found'
    )
  }, 30000)
})
