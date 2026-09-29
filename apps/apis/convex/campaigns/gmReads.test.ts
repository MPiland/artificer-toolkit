import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignAdjustmentDto,
  CampaignConditionDto,
  listCampaignAdjustmentsInputSchema
} from '@artificer-toolkit/schema/api/campaignLiveState'
import {
  campaignCharacterStateSchema,
  type CampaignCharacterState
} from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const adjustments = makeFunctionReference<
  'query',
  z.input<typeof listCampaignAdjustmentsInputSchema>,
  CampaignAdjustmentDto[]
>('campaigns/gmReads:adjustments')
const conditions = makeFunctionReference<
  'query',
  z.input<typeof listCampaignAdjustmentsInputSchema>,
  CampaignConditionDto[]
>('campaigns/gmReads:conditions')

async function setup() {
  const { owner: player, other: gm, ...base } = await readySheetFixture()
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'GM state',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const memberId = await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: player.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const assignmentId = await base.t.run((ctx) =>
    ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: player.userId,
      characterId: base.character.id,
      assignedAt: campaign.createdAt
    })
  )
  const input = { campaignId: campaign.id, characterId: base.character.id }
  const metadata = {
    ...input,
    createdBy: gm.userId,
    version: 2,
    createdAt: campaign.createdAt,
    updatedAt: campaign.createdAt
  }
  const state: CampaignCharacterState = {
    adjustments: [
      {
        ...metadata,
        id: crypto.randomUUID(),
        visibility: 'SECRET',
        adjustment: {
          family: 'HIT_POINTS',
          field: 'MAXIMUM_OVERRIDE',
          value: 30,
          sourceNote: 'Hidden cause'
        }
      },
      {
        ...metadata,
        id: crypto.randomUUID(),
        visibility: 'VISIBLE',
        adjustment: { family: 'ABILITY', ability: 'STRENGTH', field: 'SCORE_OVERRIDE', value: 19 }
      }
    ],
    conditions: [
      {
        ...metadata,
        id: crypto.randomUUID(),
        visibility: 'SECRET',
        conditionTypeId: '20000000-0000-4000-8000-000000000002',
        notes: 'Hidden condition'
      },
      {
        ...metadata,
        id: crypto.randomUUID(),
        visibility: 'VISIBLE',
        conditionTypeId: '10000000-0000-4000-8000-000000000001',
        notes: 'Visible condition'
      }
    ]
  }
  const stateId = await base.t.run((ctx) =>
    ctx.db.insert('campaignCharacterStates', {
      ...input,
      documentJson: JSON.stringify(campaignCharacterStateSchema.parse(state)),
      checksum: checksumRuleDocument(state)
    })
  )
  return { ...base, player, gm, campaign, memberId, assignmentId, stateId, state, input }
}

describe('native Campaign GM state reads', () => {
  it('keeps raw Campaign settings owner-only under current membership authority', async () => {
    const { t, gm, player, campaign, memberId } = await setup()
    const route = { id: campaign.id }
    const before = await t.run((ctx) => ctx.db.get(memberId))
    expect(await gm.caller.query(api.campaigns.queries.settings, route)).toMatchObject({
      id: campaign.id,
      role: 'OWNER'
    })
    expect(await player.caller.query(api.campaigns.queries.get, route)).toMatchObject({
      id: campaign.id,
      role: 'PLAYER'
    })
    await expect(player.caller.query(api.campaigns.queries.settings, route)).rejects.toThrow(
      'Campaign not found'
    )
    await expect(t.query(api.campaigns.queries.settings, route)).rejects.toThrow('Unauthenticated')
    expect(await t.run((ctx) => ctx.db.get(memberId))).toEqual(before)

    await t.run((ctx) => ctx.db.patch(memberId, { role: 'OWNER' }))
    for (const read of [api.campaigns.queries.get, api.campaigns.queries.settings]) {
      await expect(player.caller.query(read, route)).rejects.toThrow(
        'Stored Campaign authority mismatch'
      )
    }
    await t.run((ctx) =>
      ctx.db.patch(memberId, { role: 'PLAYER', status: 'LEFT', leftAt: new Date().toISOString() })
    )
    for (const read of [api.campaigns.queries.get, api.campaigns.queries.settings]) {
      await expect(player.caller.query(read, route)).rejects.toThrow('Campaign not found')
    }
    await t.run((ctx) => ctx.db.delete(memberId))
    for (const read of [api.campaigns.queries.get, api.campaigns.queries.settings]) {
      await expect(player.caller.query(read, route)).rejects.toThrow('Campaign not found')
    }
  })

  it('returns deterministic private/visible DTOs without granting GM global Sheet access or mutating state', async () => {
    const { t, gm, player, state, stateId, input, campaign, character } = await setup()
    const before = await t.run((ctx) => ctx.db.get(stateId))
    const ownerAdjustments = await gm.caller.query(adjustments, {
      campaignId: input.campaignId.toUpperCase(),
      characterId: input.characterId.toUpperCase()
    })
    expect(ownerAdjustments.map((row) => row.adjustment.family)).toEqual(['ABILITY', 'HIT_POINTS'])
    expect(ownerAdjustments.map((row) => row.id)).toEqual([
      state.adjustments[1]!.id,
      state.adjustments[0]!.id
    ])
    expect(ownerAdjustments[1]?.adjustment).toMatchObject({ sourceNote: 'Hidden cause' })
    expect(ownerAdjustments[0]).not.toHaveProperty('createdBy')
    const visibleAdjustments = await player.caller.query(adjustments, input)
    expect(visibleAdjustments).toEqual([ownerAdjustments[0]])
    const ownerConditions = await gm.caller.query(conditions, input)
    expect(ownerConditions.map((row) => row.conditionTypeId)).toEqual([
      state.conditions[1]!.conditionTypeId,
      state.conditions[0]!.conditionTypeId
    ])
    expect(await player.caller.query(conditions, input)).toEqual([ownerConditions[0]])
    expect(JSON.stringify(visibleAdjustments)).not.toContain('Hidden')
    expect(await t.run((ctx) => ctx.db.get(stateId))).toEqual(before)
    expect(await gm.caller.query(api.characters.sheet.get, { id: character.id })).toBeNull()
    await gm.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: 0
    })
    expect(await gm.caller.query(adjustments, input)).toEqual(ownerAdjustments)
    expect(await player.caller.query(conditions, input)).toEqual([ownerConditions[0]])
    await t.run((ctx) => ctx.db.delete(stateId))
    expect(await gm.caller.query(adjustments, input)).toEqual([])
    expect(await player.caller.query(conditions, input)).toEqual([])
  })

  it('rechecks active membership, exact Campaign and assignment ownership before reading data', async () => {
    const { t, gm, player, input, memberId, assignmentId, character } = await setup()
    const otherCharacterId = await t.run(async (ctx) => {
      const current = await readCharacterRow(ctx, character.id)
      if (!current) throw new Error('Missing Character fixture.')
      const { _id, _creationTime, play, ...structure } = current
      const { _id: _playId, _creationTime: _playCreationTime, ...playRecord } = play
      const id = crypto.randomUUID()
      const userId = crypto.randomUUID()
      await ctx.db.insert('characters', { ...structure, id, userId })
      await ctx.db.insert('characterPlayStates', { ...playRecord, characterId: id, userId })
      const clone = await readCharacterRow(ctx, id)
      if (!clone) throw new Error('Missing cloned Character.')
      await writeCharacterRecord(ctx, clone, {
        document: { ...readCharacterRecord(current), id, status: 'ACTIVE' },
        userId
      })
      await ctx.db.insert('authoredRouteIds', {
        subjectKind: 'CHARACTER',
        subjectId: id,
        publicId: id,
        routeNumber: 1000,
        ownerUserId: userId
      })
      await ctx.db.insert('campaignMemberships', {
        campaignId: input.campaignId,
        userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: current.createdAt,
        joinedAt: current.createdAt,
        leftAt: null
      })
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: input.campaignId,
        userId,
        characterId: id,
        assignedAt: current.createdAt
      })
      return id
    })
    const otherInput = { ...input, characterId: otherCharacterId }
    expect(await gm.caller.query(adjustments, otherInput)).toEqual([])
    await expect(player.caller.query(adjustments, otherInput)).rejects.toThrow(
      'Assigned Character not found'
    )
    await expect(player.caller.query(conditions, otherInput)).rejects.toThrow(
      'Assigned Character not found'
    )
    for (const read of [adjustments, conditions]) {
      await expect(t.query(read, input)).rejects.toThrow('Unauthenticated')
      await expect(
        gm.caller.query(read, { ...input, campaignId: crypto.randomUUID() })
      ).rejects.toThrow('Campaign not found')
      await expect(
        player.caller.query(read, { ...input, characterId: crypto.randomUUID() })
      ).rejects.toThrow('Assigned Character not found')
    }
    await t.run((ctx) =>
      ctx.db.patch(memberId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    await expect(player.caller.query(adjustments, input)).rejects.toThrow('Campaign not found')
    await expect(gm.caller.query(conditions, input)).rejects.toThrow('Assigned Character not found')
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'ACTIVE', leftAt: null }))
    const duplicate = await t.run((ctx) =>
      ctx.db.insert('campaignCharacterAssignments', {
        campaignId: crypto.randomUUID(),
        userId: player.userId,
        characterId: character.id,
        assignedAt: new Date().toISOString()
      })
    )
    await expect(gm.caller.query(adjustments, input)).rejects.toThrow()
    await t.run((ctx) => ctx.db.delete(duplicate))
    const recordId = await t.run(async (ctx) => {
      const record = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique()
      if (!record) throw new Error('Missing Character fixture.')
      await ctx.db.patch(record._id, { userId: gm.userId })
      return record._id
    })
    await expect(gm.caller.query(conditions, input)).rejects.toThrow('assignment mismatch')
    await t.run((ctx) => ctx.db.patch(recordId, { userId: player.userId }))
    await t.run((ctx) => ctx.db.delete(assignmentId))
    await expect(gm.caller.query(adjustments, input)).rejects.toThrow(
      'Assigned Character not found'
    )
  })

  it('rejects corrupt, cross-Character and duplicate-slot state, including hidden records', async () => {
    const { t, gm, player, state, stateId, input } = await setup()
    await t.run((ctx) => ctx.db.patch(stateId, { checksum: '0'.repeat(64) }))
    await expect(gm.caller.query(adjustments, input)).rejects.toThrow('checksum mismatch')
    const crossCharacter = {
      ...state,
      conditions: state.conditions.map((row) => ({ ...row, characterId: crypto.randomUUID() }))
    }
    const duplicateAdjustment = {
      ...state,
      adjustments: [...state.adjustments, { ...state.adjustments[0]!, id: crypto.randomUUID() }]
    }
    const duplicateCondition = {
      ...state,
      conditions: [...state.conditions, { ...state.conditions[0]!, id: crypto.randomUUID() }]
    }
    const duplicateIdentity = {
      ...state,
      conditions: state.conditions.map((row, i) =>
        i === 0 ? { ...row, id: state.adjustments[0]!.id } : row
      )
    }
    for (const candidate of [
      crossCharacter,
      duplicateAdjustment,
      duplicateCondition,
      duplicateIdentity
    ]) {
      await t.run((ctx) =>
        ctx.db.patch(stateId, {
          documentJson: JSON.stringify(candidate),
          checksum: checksumRuleDocument(candidate)
        })
      )
      await expect(player.caller.query(adjustments, input)).rejects.toThrow()
      await expect(gm.caller.query(conditions, input)).rejects.toThrow()
    }
    const malformed = {
      ...state,
      conditions: [{ ...state.conditions[0], notes: 'x'.repeat(2001) }]
    }
    await t.run((ctx) =>
      ctx.db.patch(stateId, {
        documentJson: JSON.stringify(malformed),
        checksum: checksumRuleDocument(malformed)
      })
    )
    await expect(player.caller.query(conditions, input)).rejects.toThrow()
  })
})
