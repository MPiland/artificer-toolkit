import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api, components } from '../_generated/api'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { removePersonalFixtureCharacter } from './development'

const remove = makeFunctionReference<'mutation', { userId: string; characterId: string }, null>(
  'characters/development:removePersonalFixtureCharacter'
)

async function fixture() {
  const base = await readySheetFixture()
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_012345abcde${index}@example.invalid` }
        }
      })
    }
  })
  return base
}

it('removes only the exact personal fixture and its private descendants, with idempotent replay', async () => {
  const base = await fixture()
  const input = { userId: base.owner.userId, characterId: base.character.id }
  expect(removePersonalFixtureCharacter.isInternal).toBe(true)
  await base.owner.caller.mutation(api.characters.sheetCommands.execute, {
    id: base.character.id,
    command: {
      type: 'SET_INSPIRATION',
      commandId: crypto.randomUUID(),
      expectedVersion: 1,
      inspired: true
    }
  })
  await base.owner.caller.mutation(api.rolls.execute, {
    characterId: base.character.id,
    expression: '1d6',
    source: { kind: 'MANUAL', label: 'Fixture roll' }
  })
  await base.owner.caller.mutation(api.characters.drafts.create, {
    id: base.character.id,
    systemId: base.character.systemId
  })
  const sibling = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: sibling.draft.id,
    mode: 'create',
    character: sibling.character
  })
  const siblingRoll = await base.owner.caller.mutation(api.rolls.execute, {
    characterId: sibling.character.id,
    expression: '1d6',
    source: { kind: 'MANUAL', label: 'Sibling roll' }
  })
  const before = await base.readState()
  vi.stubEnv('SITE_URL', 'https://example.com')
  try {
    await expect(base.t.mutation(remove, input)).rejects.toThrow('development application origin')
  } finally {
    vi.unstubAllEnvs()
  }
  await expect(base.t.mutation(remove, { ...input, userId: base.other.userId })).rejects.toThrow(
    'ownership'
  )
  expect(await base.readState()).toEqual(before)
  await base.t.mutation(remove, input)
  await base.t.mutation(remove, input)
  await base.t.run(async (ctx) => {
    expect(
      await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', input.characterId))
        .unique()
    ).toBeNull()
    expect(await ctx.db.query('characterDrafts').collect()).toHaveLength(0)
    expect(await ctx.db.query('characterCommandReceipts').collect()).toHaveLength(0)
    expect(
      await ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', input.characterId))
        .unique()
    ).toBeNull()
    expect(
      await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', sibling.character.id))
        .unique()
    ).not.toBeNull()
    expect(await ctx.db.query('userRollHistory').collect()).toMatchObject([{ id: siblingRoll.id }])
  })
})

it('rejects current or retained Campaign membership and assignments without deleting anything', async () => {
  const base = await fixture()
  const input = { userId: base.owner.userId, characterId: base.character.id }
  const campaign = await base.other.caller.mutation(api.campaigns.create.create, {
    name: 'Fixture exclusion',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: base.character.systemId,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const now = new Date().toISOString()
  const membershipId = await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: now,
      joinedAt: now,
      leftAt: null
    })
  )
  const before = await base.readState()
  await expect(base.t.mutation(remove, input)).rejects.toThrow('Campaign-linked')
  await base.t.run((ctx) => ctx.db.patch(membershipId, { status: 'LEFT', leftAt: now }))
  await expect(base.t.mutation(remove, input)).rejects.toThrow('Campaign-linked')
  await base.t.run(async (ctx) => {
    await ctx.db.delete(membershipId)
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      characterId: base.character.id,
      assignedAt: now
    })
  })
  await expect(base.t.mutation(remove, input)).rejects.toThrow('Campaign-linked')
  expect(await base.readState()).toEqual(before)
})

it('schedules the bound portrait for cleanup when removing its fixture Character', async () => {
  const base = await fixture()
  const assetId = crypto.randomUUID()
  const rowId = await base.t.run(async (ctx) => {
    const character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique()
    if (!character) throw new Error('Missing fixture Character')
    const rowId = await ctx.db.insert('mediaAssets', {
      id: assetId,
      ownerUserId: base.owner.userId,
      profile: 'CHARACTER_PORTRAIT',
      characterTarget: { type: 'CHARACTER_PORTRAIT', characterId: base.character.id },
      upload: {
        originalFileName: 'portrait.png',
        declaredMimeType: 'image/png',
        declaredBytes: 1,
        idempotencyKey: crypto.randomUUID()
      },
      status: 'READY',
      rawObjectKey: null,
      uploadExpiresAt: 0,
      chargedBytes: 1,
      variants: [],
      crop: null,
      operation: null,
      cleanupAt: null
    })
    await ctx.db.patch(character._id, { portraitAssetId: assetId, portraitRevision: 1 })
    return rowId
  })
  const before = Date.now()
  await base.t.mutation(remove, { userId: base.owner.userId, characterId: base.character.id })
  await base.t.run(async (ctx) => {
    const asset = await ctx.db.get(rowId)
    expect(asset?.cleanupAt).toBeGreaterThanOrEqual(before + 86_400_000)
    const jobs = await ctx.db.system.query('_scheduled_functions').collect()
    expect(jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ args: [{ assetId }], scheduledTime: asset?.cleanupAt })
      ])
    )
  })
})

it('rejects oversized or foreign-actor private history before any fixture deletion', async () => {
  const base = await fixture()
  const input = { userId: base.owner.userId, characterId: base.character.id }
  await base.owner.caller.mutation(api.characters.sheetCommands.execute, {
    id: base.character.id,
    command: {
      type: 'SET_INSPIRATION',
      commandId: crypto.randomUUID(),
      expectedVersion: 1,
      inspired: true
    }
  })
  await base.t.run(async (ctx) => {
    const receipt = await ctx.db.query('characterCommandReceipts').unique()
    if (!receipt) throw new Error('Missing receipt')
    const fields = characterStoredCommandReceiptSchema.parse(
      Object.fromEntries(Object.entries(receipt).filter(([key]) => !key.startsWith('_')))
    )
    for (let index = 0; index < 100; index++)
      await ctx.db.insert('characterCommandReceipts', {
        ...fields,
        id: crypto.randomUUID(),
        commandId: crypto.randomUUID()
      })
  })
  const before = await base.readState()
  await expect(base.t.mutation(remove, input)).rejects.toThrow('private-history bounds')
  expect(await base.readState()).toEqual(before)
  await base.t.run(async (ctx) => {
    const receipts = await ctx.db.query('characterCommandReceipts').collect()
    for (const receipt of receipts.slice(1)) await ctx.db.delete(receipt._id)
    await ctx.db.patch(receipts[0]!._id, { actorId: base.other.userId })
  })
  const foreign = await base.readState()
  await expect(base.t.mutation(remove, input)).rejects.toThrow('ownership mismatch')
  expect(await base.readState()).toEqual(foreign)
})
