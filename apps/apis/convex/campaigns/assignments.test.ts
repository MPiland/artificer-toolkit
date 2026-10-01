import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignAssignmentResult,
  CampaignDetailDto,
  CreateCampaignInput,
  assignCampaignCharacterInputSchema,
  unassignCampaignCharacterInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import type {
  CampaignAdjustmentInput,
  CampaignAdjustmentDto
} from '@artificer-toolkit/schema/api/campaignLiveState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { editCharacterRecord, writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { makePublishedRootOwned } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import * as preparation from '../characters/builderPreparation'
import { readCharacterDraft } from '../characters/documents'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const assign = makeFunctionReference<
  'mutation',
  z.input<typeof assignCampaignCharacterInputSchema>,
  CampaignAssignmentResult
>('campaigns/assignments:assign')
const unassign = makeFunctionReference<
  'mutation',
  z.input<typeof unassignCampaignCharacterInputSchema>,
  CampaignAssignmentResult
>('campaigns/assignments:unassign')
const saveCurrency = makeFunctionReference<
  'mutation',
  SaveCampaignCurrencySystemInput,
  CurrencySystemDto
>('campaigns/currencySystems:save')
const saveAdjustment = makeFunctionReference<
  'mutation',
  CampaignAdjustmentInput,
  CampaignAdjustmentDto
>('campaigns/gmWrites:saveAdjustment')

type ReadySheet = Awaited<ReturnType<typeof readySheetFixture>>

const campaignInput: CreateCampaignInput = {
  name: 'Assignment table',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

async function addPlayer(base: ReadySheet, campaign: CampaignDetailDto) {
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
}

async function setup() {
  const base = await readySheetFixture()
  await base.t.run((ctx) =>
    ctx.db.insert('accountEntitlements', { userId: base.other.userId, tier: 'PRO_GM' })
  )
  const campaign = await base.other.caller.mutation(createCampaign, campaignInput)
  await addPlayer(base, campaign)
  const assignmentRows = () =>
    base.t.run((ctx) =>
      ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
        .collect()
    )
  return { ...base, campaign, assignmentRows }
}

async function departureCurrency(base: Awaited<ReturnType<typeof setup>>) {
  const system = await base.other.caller.mutation(saveCurrency, {
    campaignId: base.campaign.id,
    label: 'Campaign tokens',
    isReference: true,
    denominations: [{ label: 'Token', abbreviation: 'tk', scaleInReference: 1 }]
  })
  return {
    denominationId: system.denominations[0]!.id,
    campaignCurrencySystemId: system.id
  }
}

async function makeRootOwned(base: ReadySheet, subjectId: string, ownerUserId: string) {
  await base.t.run((ctx) => makePublishedRootOwned(ctx, subjectId, ownerUserId))
}

describe('native Campaign Character assignments', () => {
  it('allows the active player and owner to bind the player Character, and is idempotent', async () => {
    const { owner: player, other: gm, campaign, character, assignmentRows } = await setup()

    await expect(
      player.caller.mutation(assign, {
        campaignId: campaign.id,
        characterId: character.id
      })
    ).resolves.toEqual({ ok: true })
    await expect(
      player.caller.mutation(assign, {
        campaignId: campaign.id,
        characterId: character.id
      })
    ).resolves.toEqual({ ok: true })
    await expect(
      gm.caller.mutation(assign, {
        campaignId: campaign.id,
        characterId: character.id
      })
    ).resolves.toEqual({ ok: true })
    expect(await assignmentRows()).toHaveLength(1)
    expect(await assignmentRows()).toMatchObject([
      {
        campaignId: campaign.id,
        userId: player.userId,
        characterId: character.id
      }
    ])
  })

  it('rejects corrupt Character route, System and checksum bindings without writes, including idempotent requests', async () => {
    const base = await setup()
    const [record, route] = await base.t.run(async (ctx) =>
      Promise.all([
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
          .unique(),
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', base.character.id))
          .unique()
      ])
    )
    if (!record || !route) throw new Error('Character binding fixture is unavailable.')
    const { _id: recordId, _creationTime: _recordTime, ...recordDocument } = record
    const { _id: routeId, _creationTime: _routeTime, ...routeDocument } = route
    const [build, play] = await base.t.run((ctx) => Promise.all([
      ctx.db.query('characterBuildStates').withIndex('by_characterId', (q) => q.eq('characterId', base.character.id)).unique(),
      ctx.db.query('characterPlayStates').withIndex('by_characterId', (q) => q.eq('characterId', base.character.id)).unique()
    ]))
    if (!build || !play) throw new Error('Character operational binding fixture is unavailable.')
    const { _id: buildId, _creationTime: _buildTime, ...buildDocument } = build
    const { _id: playId, _creationTime: _playTime, ...playDocument } = play
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        campaigns: await ctx.db.query('campaigns').collect(),
        memberships: await ctx.db.query('campaignMemberships').collect(),
        assignments: await ctx.db.query('campaignCharacterAssignments').collect(),
        overlays: await ctx.db.query('campaignCharacterStates').collect(),
        inventories: await ctx.db.query('campaignPartyInventories').collect(),
        items: await ctx.db.query('campaignPartyItems').collect(),
        currencyGroups: await ctx.db.query('campaignPartyCurrencyGroups').collect(),
        balances: await ctx.db.query('campaignPartyCurrencies').collect(),
        events: await ctx.db.query('campaignEvents').collect(),
        characters: await ctx.db.query('characters').collect(),
        builds: await ctx.db.query('characterBuildStates').collect(),
        plays: await ctx.db.query('characterPlayStates').collect(),
        drafts: await ctx.db.query('characterDrafts').collect(),
        routes: await ctx.db.query('authoredRouteIds').collect()
      }))
    const corruptions = [
      {
        label: 'foreign route owner',
        apply: () => base.t.run((ctx) => ctx.db.patch(routeId, { ownerUserId: base.other.userId }))
      },
      {
        label: 'wrong route subject',
        apply: () => base.t.run((ctx) => ctx.db.patch(routeId, { subjectKind: 'BACKGROUND' }))
      },
      {
        label: 'wrong stored System',
        apply: () => base.t.run((ctx) => ctx.db.patch(recordId, { systemId: crypto.randomUUID() }))
      },
      {
        label: 'wrong build checksum',
        apply: () => base.t.run((ctx) => ctx.db.patch(buildId, { checksum: '0'.repeat(64) }))
      },
      {
        label: 'mismatched play owner',
        apply: () => base.t.run((ctx) => ctx.db.patch(playId, { userId: base.other.userId }))
      },
      {
        label: 'changed build value without checksum',
        apply: () => base.t.run((ctx) => ctx.db.patch(buildId, { description: 'Corrupt build' }))
      }
    ]
    for (const stage of ['new binding', 'idempotent binding']) {
      if (stage === 'idempotent binding') {
        await base.owner.caller.mutation(assign, {
          campaignId: base.campaign.id,
          characterId: base.character.id
        })
      }
      for (const corruption of corruptions) {
        await corruption.apply()
        const before = await snapshot()
        for (const caller of [base.owner.caller, base.other.caller]) {
          await expect(
            caller.mutation(assign, {
              campaignId: base.campaign.id,
              characterId: base.character.id
            }),
            `${stage}: ${corruption.label}`
          ).rejects.toThrow(/mismatch|checksum|System|required/i)
          expect(await snapshot()).toEqual(before)
        }
        await base.t.run(async (ctx) => {
          await ctx.db.replace(recordId, recordDocument)
          await ctx.db.replace(buildId, buildDocument)
          await ctx.db.replace(playId, playDocument)
          await ctx.db.replace(routeId, routeDocument)
        })
      }
    }
  })
  it('enforces authority and rejects archived, departed, foreign, and owner-self bindings', async () => {
    const { t, owner: player, other: gm, campaign, character } = await setup()
    await expect(
      t.mutation(assign, {
        campaignId: campaign.id,
        characterId: character.id
      })
    ).rejects.toThrow()

    const foreignCampaign = await gm.caller.mutation(createCampaign, {
      ...campaignInput,
      name: 'Foreign campaign'
    })
    await expect(
      player.caller.mutation(assign, {
        campaignId: foreignCampaign.id,
        characterId: character.id
      })
    ).rejects.toThrow()

    await t.run(async (ctx) => {
      const storedCampaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', player.userId)
        )
        .unique()
      const storedCharacter = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique()
      if (!storedCampaign || !membership || !storedCharacter)
        throw new Error('Missing assignment fixture.')
      await ctx.db.patch(membership._id, {
        status: 'LEFT',
        leftAt: new Date().toISOString()
      })
    })
    await expect(
      player.caller.mutation(assign, {
        campaignId: campaign.id,
        characterId: character.id
      })
    ).rejects.toThrow()

    await t.run(async (ctx) => {
      const storedCampaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!storedCampaign) throw new Error('Missing Campaign.')
      await ctx.db.patch(storedCampaign._id, { status: 'ARCHIVED' })
    })
    await expect(
      player.caller.mutation(assign, {
        campaignId: campaign.id,
        characterId: character.id
      })
    ).rejects.toThrow()

    const ownerCampaign = await gm.caller.mutation(createCampaign, {
      ...campaignInput,
      name: 'Owner character campaign'
    })
    await t.run(async (ctx) => {
      const storedCharacter = await readCharacterRow(ctx, character.id)
      if (!storedCharacter) throw new Error('Missing Character.')
      await writeCharacterRecord(ctx, storedCharacter, {
        document: readCharacterRecord(storedCharacter),
        userId: gm.userId
      })
    })
    await expect(
      gm.caller.mutation(assign, {
        campaignId: ownerCampaign.id,
        characterId: character.id
      })
    ).rejects.toThrow()
  })

  it('keeps a Character bound to one Campaign under concurrent assignment attempts', async () => {
    const base = await setup()
    const { other: gm, owner: player, campaign, character, assignmentRows } = base
    const secondCampaign = await gm.caller.mutation(createCampaign, {
      ...campaignInput,
      name: 'Second assignment table'
    })
    await addPlayer(base, secondCampaign)

    const results = await Promise.allSettled([
      player.caller.mutation(assign, {
        campaignId: campaign.id,
        characterId: character.id
      }),
      player.caller.mutation(assign, {
        campaignId: secondCampaign.id,
        characterId: character.id
      })
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await assignmentRows()).toHaveLength(1)
  })

  it('unassigns shared-source Characters atomically, preserving private state and moving Campaign currency', async () => {
    const base = await setup()
    await makeRootOwned(base, acolyte.id, base.other.userId)
    await base.other.caller.mutation(api.campaigns.contentShares.share, {
      campaignId: base.campaign.id,
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    await base.owner.caller.mutation(assign, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    const { denominationId, campaignCurrencySystemId } = await departureCurrency(base)
    const before = await base.t.run(async (ctx) => {
      const character = await readCharacterRow(ctx, base.character.id)
      if (!character) throw new Error('Missing Character.')
      const document = readCharacterRecord(character)
      await writeCharacterRecord(ctx, character, {
        document: {
          ...document,
          state: {
            ...document.state,
            currency: [
              {
                id: crypto.randomUUID(),
                currencies: [{ currencyId: denominationId, amount: 2 }]
              },
              {
                id: crypto.randomUUID(),
                currencies: [{ currencyId: denominationId, amount: 3 }]
              }
            ]
          }
        }
      })
      await ctx.db.insert('campaignPartyInventories', {
        campaignId: base.campaign.id,
        version: 0
      })
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: base.campaign.id,
        id: crypto.randomUUID(),
        denominationId,
        campaignCurrencySystemId,
        amount: 7,
        containerId: null
      })
      return {
        sheetState: character.sheetState,
        streamVersion: character.play.streamVersion
      }
    })
    const opened = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: base.character.id,
      systemId: base.character.systemId
    })
    const saved = await base.owner.caller.mutation(api.characters.drafts.save, {
      characterId: base.character.id,
      expectedDraftId: opened.id,
      mode: 'edit',
      character: { ...opened.payload.character, label: 'Keep private draft' }
    })

    await expect(
      base.owner.caller.mutation(unassign, { campaignId: base.campaign.id })
    ).resolves.toEqual({ ok: true })
    const after = await base.t.run(async (ctx) => ({
      character: await readCharacterRow(ctx, base.character.id),
      draft: await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
        .unique(),
      overlay: await ctx.db
        .query('campaignCharacterStates')
        .withIndex('by_campaignId_characterId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('characterId', base.character.id)
        )
        .unique(),
      assignment: await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
        .unique(),
      balances: await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
        .collect(),
      events: await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    }))
    expect(after.assignment).toBeNull()
    expect(after.overlay).toBeNull()
    expect(after.character).toMatchObject({
      status: 'DRAFT',
      play: { streamVersion: before.streamVersion + 1 }
    })
    expect(after.character?.sheetState).toEqual(before.sheetState)
    expect(after.character).not.toHaveProperty('primaryRulesCatalogueId')
    expect(after.draft).toMatchObject({
      id: saved.id,
      label: 'Keep private draft'
    })
    expect(after.balances).toMatchObject([{ denominationId, amount: 12, containerId: null }])
    expect(after.balances[0]).not.toHaveProperty('groupId')
    const repairedPayload = await base.t.run(async (ctx) => {
      if (!after.draft || !after.character) throw new Error('Missing repaired Character draft.')
      return (await readCharacterDraft(ctx, after.draft, after.character)).payload
    })
    const repairedDraft = characterAuthoredDtoSchema.parse(repairedPayload.character)
    expect(repairedDraft.intent.background.backgroundId).toBe('')
    expect(repairedDraft.state.currency.flatMap((group) => group.currencies)).toEqual([])
    await expect(
      base.owner.caller.query(api.characters.sheet.get, { id: base.character.id })
    ).rejects.toThrow('Builder repair')
    expect(after.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'CUSTODY_TRANSFER',
          visibility: 'OWNER'
        }),
        expect.objectContaining({
          type: 'CAMPAIGN_CHARACTER_RECONCILED',
          visibility: 'SUBJECT'
        })
      ])
    )
    const reconciliation = after.events.find(
      (event) => event.type === 'CAMPAIGN_CHARACTER_RECONCILED'
    )
    if (!reconciliation) throw new Error('Missing Character reconciliation event.')
    expect(reconciliation.payloadJson).toContain('CHARACTER_UNASSIGNED')
  })

  it('removes GM hit-point adjustments without losing personal state or requiring source loss', async () => {
    const base = await setup()
    const personal = await base.owner.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    if (!personal) throw new Error('Missing personal Sheet.')
    await base.owner.caller.mutation(assign, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    await base.other.caller.mutation(saveAdjustment, {
      campaignId: base.campaign.id,
      characterId: base.character.id,
      visibility: 'SECRET',
      expectedVersion: 0,
      adjustment: {
        family: 'HIT_POINTS',
        field: 'MAXIMUM_MODIFIER',
        value: 4,
        sourceNote: 'GM-only HP'
      }
    })
    await base.owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: base.committed.streamVersion,
        current: personal.overview.maxHitPoints + 4
      }
    })
    const before = await base.readState()
    await expect(
      base.other.caller.mutation(unassign, { campaignId: base.campaign.id })
    ).rejects.toThrow('Character is required')
    await base.other.caller.mutation(unassign, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    const after = await base.readState()
    const character = readCharacterRecord(after.character!)
    expect(character.status).toBe('ACTIVE')
    expect(character.state.hitpoints.current).toBe(personal.overview.maxHitPoints)
    expect(after.character?.play.streamVersion).toBe(before.character!.play.streamVersion + 1)
    expect(after.character?.sheetState).toEqual(before.character?.sheetState)
    expect(after.receipts).toEqual(before.receipts)
    expect(await base.assignmentRows()).toEqual([])
    await base.owner.caller.mutation(unassign, { campaignId: base.campaign.id })
    expect(await base.readState()).toEqual(after)
  })

  it('replaces the player Character atomically and preserves the old ready Character', async () => {
    const base = await setup()
    const second = await base.createCharacter()
    const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: second.draft.id,
      mode: 'create',
      character: second.character
    })
    await base.owner.caller.mutation(assign, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    const before = await base.readState()
    await base.other.caller.mutation(assign, {
      campaignId: base.campaign.id,
      characterId: committed.character.id
    })
    expect(await base.assignmentRows()).toEqual([])
    const rows = await base.t.run((ctx) =>
      ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
        )
        .collect()
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.characterId).toBe(committed.character.id)
    expect(await base.readState()).toEqual(before)
    await expect(
      base.owner.caller.mutation(unassign, {
        campaignId: base.campaign.id,
        characterId: base.character.id
      })
    ).rejects.toThrow('Assigned Character not found')
  })

  it('rolls back replacement currency, Character repair, overlays and audit if the candidate fails', async () => {
    const base = await setup()
    const second = await base.createCharacter()
    const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: second.draft.id,
      mode: 'create',
      character: second.character
    })
    await base.owner.caller.mutation(assign, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    const { denominationId } = await departureCurrency(base)
    await base.t.run(async (ctx) => {
      await editCharacterRecord(ctx, base.character.id, (character) => ({
        ...character,
        state: {
          ...character.state,
          currency: [
            ...character.state.currency,
            { id: crypto.randomUUID(), currencies: [{ currencyId: denominationId, amount: 5 }] }
          ]
        }
      }))
    })
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        current: await readCharacterRow(ctx, base.character.id),
        candidate: await readCharacterRow(ctx, committed.character.id),
        assignments: await ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
          .collect(),
        overlay: await ctx.db
          .query('campaignCharacterStates')
          .withIndex('by_campaignId_characterId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('characterId', base.character.id)
          )
          .unique(),
        inventory: await ctx.db
          .query('campaignPartyInventories')
          .withIndex('by_campaignId_vehicleId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('vehicleId', undefined)
          )
          .unique(),
        balances: await ctx.db
          .query('campaignPartyCurrencies')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
          .collect(),
        events: await ctx.db
          .query('campaignEvents')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
          .collect()
      }))
    const before = await snapshot()
    const original = preparation.prepareCharacterBuilder
    const failure = vi
      .spyOn(preparation, 'prepareCharacterBuilder')
      .mockImplementation(async (ctx, input) => {
        if (input.character.id === committed.character.id)
          throw new Error('Candidate preparation failed.')
        return original(ctx, input)
      })
    try {
      await expect(
        base.owner.caller.mutation(assign, {
          campaignId: base.campaign.id,
          characterId: committed.character.id
        })
      ).rejects.toThrow('Candidate preparation failed')
      expect(await snapshot()).toEqual(before)
    } finally {
      failure.mockRestore()
    }
  })

  it('completes departure into a separate purse when the loose balance is full', async () => {
    const base = await setup()
    await base.owner.caller.mutation(assign, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    const { denominationId, campaignCurrencySystemId } = await departureCurrency(base)
    await base.t.run(async (ctx) => {
      await editCharacterRecord(ctx, base.character.id, (document) => ({
        ...document,
        state: {
          ...document.state,
          currency: [
            {
              id: crypto.randomUUID(),
              currencies: [{ currencyId: denominationId, amount: 1 }]
            }
          ]
        }
      }))
      await ctx.db.insert('campaignPartyInventories', {
        campaignId: base.campaign.id,
        version: 0
      })
      await ctx.db.insert('campaignPartyCurrencies', {
        campaignId: base.campaign.id,
        id: crypto.randomUUID(),
        denominationId,
        campaignCurrencySystemId,
        amount: Number.MAX_SAFE_INTEGER,
        containerId: null
      })
    })
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        character: await readCharacterRow(ctx, base.character.id),
        assignments: await ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
          .collect(),
        balances: await ctx.db
          .query('campaignPartyCurrencies')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
          .collect(),
        groups: await ctx.db
          .query('campaignPartyCurrencyGroups')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
          .collect()
      }))
    await expect(
      base.owner.caller.mutation(unassign, { campaignId: base.campaign.id })
    ).resolves.toEqual({ ok: true })
    const after = await snapshot()
    expect(after.assignments).toEqual([])
    expect(after.groups).toHaveLength(1)
    expect(after.balances).toHaveLength(2)
    expect(after.balances.find((balance) => balance.groupId === undefined)?.amount).toBe(
      Number.MAX_SAFE_INTEGER
    )
    expect(after.balances.find((balance) => balance.groupId === after.groups[0]?.id)?.amount).toBe(
      1
    )
    const character = readCharacterRecord(after.character!)
    expect(character.state.currency[0]?.currencies).toEqual([])
  })
})
