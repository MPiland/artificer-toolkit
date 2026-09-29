import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  CampaignAssignmentResult
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignVehicleDto,
  CreateCampaignVehicleInput,
  CampaignVehicleLifecycleInput,
  CampaignVehicleLifecycleResult
} from '@artificer-toolkit/schema/api/campaignVehicles'
import type {
  CampaignInventoryOwnerVersionDto,
  CampaignInventoryTransferVersionsDto,
  InventoryOwnerRefDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { importedSubject } from '../../tests/fixtures/publication'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { api, components, internal } from '../_generated/api'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const assign = makeFunctionReference<
  'mutation',
  { campaignId: string; characterId: string },
  CampaignAssignmentResult
>('campaigns/assignments:assign')
const createVehicle = makeFunctionReference<
  'mutation',
  CreateCampaignVehicleInput,
  CampaignVehicleDto
>('campaigns/vehicles:create')
const lifecycle = makeFunctionReference<
  'mutation',
  { input: CampaignVehicleLifecycleInput },
  CampaignVehicleLifecycleResult
>('campaigns/vehicles:lifecycle')
const archive = makeFunctionReference<
  'mutation',
  { campaignId: string; expectedVersion: number },
  CampaignDetailDto
>('campaigns/archive:archive')
const version = makeFunctionReference<
  'query',
  { input: { campaignId: string; owner: InventoryOwnerRefDto } },
  CampaignInventoryOwnerVersionDto
>('campaigns/inventoryOwners:version')
const transferVersions = makeFunctionReference<
  'query',
  {
    input: { campaignId: string; source: InventoryOwnerRefDto; destination: InventoryOwnerRefDto }
  },
  CampaignInventoryTransferVersionsDto
>('campaigns/inventoryOwners:transferVersions')

async function setup() {
  const base = await readySheetFixture()
  const campaign = await base.other.caller.mutation(create, {
    name: 'Inventory owners',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
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
  await base.other.caller.mutation(assign, {
    campaignId: campaign.id,
    characterId: base.character.id
  })
  return { ...base, campaign }
}

async function addThirdAssignedPlayer(base: Awaited<ReturnType<typeof setup>>) {
  const user = await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Third',
          email: 'third@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = base.t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Missing third-player identity')
  const draft = await base.createCharacter()
  const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.draft.id,
    mode: 'create',
    character: draft.character
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: base.campaign.id,
      userId: identity.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: base.campaign.createdAt,
      joinedAt: base.campaign.createdAt,
      leftAt: null
    })
    const record = await readCharacterRow(ctx, committed.character.id)
    const route = await ctx.db
      .query('authoredRouteIds')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', committed.character.id))
      .unique()
    if (!record || !route) throw new Error('Missing third-player Character')
    await writeCharacterRecord(ctx, record, {
      document: readCharacterRecord(record),
      userId: identity.userId
    })
    await ctx.db.patch(route._id, { ownerUserId: identity.userId })
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: base.campaign.id,
      characterId: committed.character.id,
      userId: identity.userId,
      assignedAt: new Date().toISOString()
    })
  })
  return {
    caller,
    userId: identity.userId,
    characterId: committed.character.id,
    version: committed.streamVersion
  }
}
describe('native Campaign inventory owner versions', () => {
  it('returns only versions while enforcing assigned Character and party access', async () => {
    const base = await setup()
    const character = { kind: 'CHARACTER' as const, characterId: base.character.id }
    const party = { kind: 'CAMPAIGN' as const, campaignId: base.campaign.id }
    await expect(
      base.owner.caller.query(version, {
        input: { campaignId: base.campaign.id, owner: character }
      })
    ).resolves.toEqual({ owner: character, version: base.committed.streamVersion })
    await expect(
      base.other.caller.query(version, {
        input: { campaignId: base.campaign.id, owner: character }
      })
    ).resolves.toEqual({ owner: character, version: base.committed.streamVersion })
    await expect(
      base.owner.caller.query(transferVersions, {
        input: { campaignId: base.campaign.id, source: character, destination: party }
      })
    ).resolves.toEqual({ sourceVersion: base.committed.streamVersion, destinationVersion: 0 })
    await expect(
      base.owner.caller.query(transferVersions, {
        input: { campaignId: base.campaign.id, source: party, destination: party }
      })
    ).rejects.toThrow('different')
    await base.t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
        )
        .unique()
      if (!member) throw new Error('Missing member')
      await ctx.db.patch(member._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    await expect(
      base.owner.caller.query(version, {
        input: { campaignId: base.campaign.id, owner: character }
      })
    ).rejects.toThrow('not found')
  })

  it('denies another player inventory metadata while permitting a destination version fence', async () => {
    const base = await setup()
    const third = await addThirdAssignedPlayer(base)
    const own = { kind: 'CHARACTER' as const, characterId: base.character.id }
    const theirs = { kind: 'CHARACTER' as const, characterId: third.characterId }
    await expect(
      base.owner.caller.query(version, { input: { campaignId: base.campaign.id, owner: theirs } })
    ).rejects.toThrow('assigned player')
    await expect(
      base.owner.caller.query(transferVersions, {
        input: { campaignId: base.campaign.id, source: theirs, destination: own }
      })
    ).rejects.toThrow('assigned player')
    await expect(
      base.owner.caller.query(transferVersions, {
        input: { campaignId: base.campaign.id, source: own, destination: theirs }
      })
    ).resolves.toEqual({
      sourceVersion: base.committed.streamVersion,
      destinationVersion: third.version
    })
    await base.t.run(async (ctx) => {
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', third.characterId))
        .unique()
      if (!assignment) throw new Error('Missing third assignment')
      await ctx.db.patch(assignment._id, { userId: base.owner.userId })
    })
    await expect(
      base.other.caller.query(version, { input: { campaignId: base.campaign.id, owner: theirs } })
    ).rejects.toThrow()
  })
  it('keeps metadata readable but fences transfers for unavailable cargo, archived Campaigns, and corrupt Characters', async () => {
    const base = await setup()
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
    })
    const vehicle = await base.other.caller.mutation(createVehicle, {
      campaignId: base.campaign.id,
      vehicleDefinitionId: cart.id
    })
    const own = { kind: 'CHARACTER' as const, characterId: base.character.id }
    const cargo = { kind: 'VEHICLE' as const, vehicleId: vehicle.id }
    const party = { kind: 'CAMPAIGN' as const, campaignId: base.campaign.id }
    await base.other.caller.mutation(lifecycle, {
      input: {
        action: 'MAKE_UNAVAILABLE',
        campaignId: base.campaign.id,
        vehicleId: vehicle.id,
        expectedVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    await expect(
      base.owner.caller.query(version, { input: { campaignId: base.campaign.id, owner: cargo } })
    ).rejects.toThrow('unavailable')
    await expect(
      base.owner.caller.query(transferVersions, {
        input: { campaignId: base.campaign.id, source: own, destination: cargo }
      })
    ).rejects.toThrow('unavailable')
    await expect(
      base.other.caller.query(version, { input: { campaignId: base.campaign.id, owner: cargo } })
    ).resolves.toEqual({ owner: cargo, version: 0 })
    await base.other.caller.mutation(lifecycle, {
      input: {
        action: 'RESTORE',
        campaignId: base.campaign.id,
        vehicleId: vehicle.id,
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID()
      }
    })
    await expect(
      base.owner.caller.query(version, { input: { campaignId: base.campaign.id, owner: cargo } })
    ).resolves.toEqual({ owner: cargo, version: 0 })
    await base.other.caller.mutation(archive, { campaignId: base.campaign.id, expectedVersion: 0 })
    await expect(
      base.owner.caller.query(version, { input: { campaignId: base.campaign.id, owner: own } })
    ).resolves.toEqual({ owner: own, version: base.committed.streamVersion })
    await expect(
      base.owner.caller.query(version, { input: { campaignId: base.campaign.id, owner: party } })
    ).resolves.toEqual({ owner: party, version: 0 })
    await expect(
      base.owner.caller.query(transferVersions, {
        input: { campaignId: base.campaign.id, source: own, destination: party }
      })
    ).rejects.toThrow('read-only')
    await base.t.run(async (ctx) => {
      const record = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
        .unique()
      if (!record) throw new Error('Missing Character')
      await ctx.db.patch(record._id, { checksum: 'corrupt' })
    })
    await expect(
      base.other.caller.query(version, { input: { campaignId: base.campaign.id, owner: own } })
    ).rejects.toThrow('checksum mismatch')
  })
})
