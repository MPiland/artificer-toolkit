import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignAdjustmentDto,
  CampaignAdjustmentInput,
  CampaignConditionDto,
  SaveCampaignConditionInput,
  DeleteCampaignConditionInput,
  deleteCampaignAdjustmentInputSchema,
  listCampaignAdjustmentsInputSchema
} from '@artificer-toolkit/schema/api/campaignLiveState'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { campaignCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { getCharacterSheetAdjustmentSlotKey } from '@artificer-toolkit/rules-runtime/character/sheetAdjustmentIdentity'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const saveAdjustment = makeFunctionReference<
  'mutation',
  CampaignAdjustmentInput,
  CampaignAdjustmentDto
>('campaigns/gmWrites:saveAdjustment')
const deleteAdjustment = makeFunctionReference<
  'mutation',
  z.input<typeof deleteCampaignAdjustmentInputSchema>,
  { ok: true }
>('campaigns/gmWrites:deleteAdjustment')
const saveCondition = makeFunctionReference<
  'mutation',
  SaveCampaignConditionInput,
  CampaignConditionDto
>('campaigns/gmWrites:saveCondition')
const deleteCondition = makeFunctionReference<
  'mutation',
  DeleteCampaignConditionInput,
  { ok: true }
>('campaigns/gmWrites:deleteCondition')
const getSheet = makeFunctionReference<
  'query',
  z.input<typeof listCampaignAdjustmentsInputSchema>,
  CharacterSheetResponseDto
>('campaigns/characterSheet:get')
const personalExecute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')

afterEach(() => vi.restoreAllMocks())

async function setup() {
  const { owner: player, other: gm, ...base } = await readySheetFixture()
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'GM writes',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  // Admission/assignment fixtures only; these tests exercise the native GM state writers.
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
  const adjustment: CampaignAdjustmentInput = {
    ...input,
    visibility: 'SECRET',
    expectedVersion: 0,
    adjustment: {
      family: 'HIT_POINTS',
      field: 'MAXIMUM_MODIFIER',
      value: 4,
      sourceNote: 'SECRET-HP'
    }
  }
  const condition: SaveCampaignConditionInput = {
    ...input,
    visibility: 'VISIBLE',
    expectedVersion: 0,
    conditionTypeId: SRD_CONDITION_TYPES[0].id,
    notes: '  Shared condition  '
  }
  const readCampaignState = () =>
    base.t.run(async (ctx) => ({
      state: await ctx.db
        .query('campaignCharacterStates')
        .withIndex('by_campaignId_characterId', (q) =>
          q.eq('campaignId', campaign.id).eq('characterId', base.character.id)
        )
        .unique(),
      events: await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(100)
    }))
  return {
    ...base,
    gm,
    player,
    campaign,
    input,
    adjustment,
    condition,
    memberId,
    assignmentId,
    readCampaignState
  }
}

describe('native Campaign GM state writes', () => {
  it('uses unique versioned slots, preserves siblings and personal state, and audits the authenticated GM', async () => {
    const { gm, player, character, input, adjustment, condition, readState, readCampaignState } =
      await setup()
    await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        adjustment: {
          family: 'HIT_POINTS',
          field: 'MAXIMUM_MODIFIER',
          value: 2,
          sourceNote: 'Personal HP'
        }
      }
    })
    const personal = await player.caller.query(getSheet, input)
    const before = await readState()
    const suppliedId = crypto.randomUUID()
    const hp = await gm.caller.mutation(saveAdjustment, {
      ...adjustment,
      adjustment: { ...adjustment.adjustment, id: suppliedId }
    })
    expect(hp).toMatchObject({ version: 0, visibility: 'SECRET' })
    expect(hp.id).not.toBe(suppliedId)
    expect(hp.adjustment).not.toHaveProperty('id')
    expect(hp).not.toHaveProperty('createdBy')
    const ability = await gm.caller.mutation(saveAdjustment, {
      ...adjustment,
      adjustment: {
        family: 'ABILITY',
        ability: 'STRENGTH',
        field: 'SCORE_OVERRIDE',
        value: 21,
        sourceNote: 'SECRET-ABILITY'
      }
    })
    const status = await gm.caller.mutation(saveCondition, condition)
    const updated = await gm.caller.mutation(saveAdjustment, adjustment)
    expect(updated).toMatchObject({ id: hp.id, version: 1, createdAt: hp.createdAt })
    const afterUpdate = await readCampaignState()
    const state = campaignCharacterStateSchema.parse(JSON.parse(afterUpdate.state!.documentJson))
    expect(afterUpdate.state?.checksum).toBe(checksumRuleDocument(state))
    expect(state.adjustments).toHaveLength(2)
    expect(state.adjustments.find((row) => row.id === hp.id)).toMatchObject({
      createdBy: gm.userId,
      version: 1
    })
    expect(state.adjustments.find((row) => row.id === ability.id)).toMatchObject(ability)
    expect(state.conditions).toEqual([{ ...status, createdBy: gm.userId }])
    await expect(gm.caller.mutation(saveAdjustment, adjustment)).rejects.toThrow(
      'changed before this save'
    )
    await expect(
      gm.caller.mutation(deleteAdjustment, { ...input, adjustmentId: hp.id, expectedVersion: 0 })
    ).rejects.toThrow('changed before this delete')
    await expect(
      gm.caller.mutation(deleteAdjustment, {
        ...input,
        adjustmentId: status.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('changed before this delete')
    await expect(
      gm.caller.mutation(deleteCondition, { ...input, conditionId: hp.id, expectedVersion: 1 })
    ).rejects.toThrow('changed before this delete')
    expect(await readCampaignState()).toEqual(afterUpdate)
    const sheet = await player.caller.query(getSheet, input)
    expect(sheet.overview.maxHitPoints).toBe(personal.overview.maxHitPoints + 2)
    expect(sheet.overview.abilities.find((row) => row.ability === 'STRENGTH')?.score).toBe(21)
    for (const secret of [hp.id, ability.id, 'SECRET-HP', 'SECRET-ABILITY'])
      expect(JSON.stringify(sheet)).not.toContain(secret)
    expect(await readState()).toEqual(before)
    expect(
      await gm.caller.mutation(deleteAdjustment, {
        ...input,
        adjustmentId: hp.id,
        expectedVersion: 1
      })
    ).toEqual({ ok: true })
    expect((await player.caller.query(getSheet, input)).overview.maxHitPoints).toBe(
      personal.overview.maxHitPoints
    )
    await gm.caller.mutation(deleteAdjustment, {
      ...input,
      adjustmentId: ability.id,
      expectedVersion: 0
    })
    await gm.caller.mutation(deleteCondition, {
      ...input,
      conditionId: status.id,
      expectedVersion: 0
    })
    expect(await player.caller.query(getSheet, input)).toEqual(personal)
    const final = await readCampaignState()
    expect(final.state).toBeNull()
    expect(final.events).toHaveLength(7)
    expect(
      final.events.every((event) => event.actorUserId === gm.userId && event.visibleInHistory)
    ).toBe(true)
    expect(final.events.map((event) => JSON.parse(event.payloadJson))).toEqual(
      expect.arrayContaining([
        {
          action: 'SAVED',
          adjustmentId: hp.id,
          family: 'HIT_POINTS',
          slotKey: getCharacterSheetAdjustmentSlotKey(adjustment.adjustment),
          version: 0
        },
        {
          action: 'DELETED',
          adjustmentId: hp.id,
          family: 'HIT_POINTS',
          slotKey: getCharacterSheetAdjustmentSlotKey(adjustment.adjustment),
          version: 1
        },
        {
          action: 'SAVED',
          conditionId: status.id,
          conditionTypeId: status.conditionTypeId,
          version: 0
        }
      ])
    )
    expect(
      final.events
        .filter((event) => event.type.startsWith('CAMPAIGN_ADJUSTMENT'))
        .every((event) => event.visibility === 'OWNER')
    ).toBe(true)
    expect(
      final.events
        .filter((event) => event.type.startsWith('CAMPAIGN_CONDITION'))
        .every((event) => event.visibility === 'SUBJECT')
    ).toBe(true)
    expect(JSON.stringify(final.events)).not.toMatch(
      /SECRET-HP|SECRET-ABILITY|Shared condition|sourceNote|commandId/
    )
    await expect(
      gm.caller.mutation(deleteCondition, { ...input, conditionId: status.id, expectedVersion: 0 })
    ).rejects.toThrow('changed before this delete')
    await expect(
      gm.caller.mutation(deleteAdjustment, { ...input, adjustmentId: hp.id, expectedVersion: 1 })
    ).rejects.toThrow('changed before this delete')
    expect(await readCampaignState()).toEqual(final)
    expect(await readState()).toEqual(before)
  })

  it('validates current condition vocabulary, trims and clears notes, and applies no automatic mechanics', async () => {
    const { t, gm, player, input, condition, adjustment, readCampaignState, readState } =
      await setup()
    const before = await readState()
    const sheet = await player.caller.query(getSheet, input)
    const hp = await gm.caller.mutation(saveAdjustment, { ...adjustment, visibility: 'VISIBLE' })
    const first = await gm.caller.mutation(saveCondition, condition)
    expect(first.notes).toBe('Shared condition')
    const second = await gm.caller.mutation(saveCondition, {
      ...condition,
      notes: '   ',
      visibility: 'SECRET'
    })
    expect(second).toMatchObject({
      id: first.id,
      createdAt: first.createdAt,
      version: 1,
      visibility: 'SECRET'
    })
    expect(second).not.toHaveProperty('notes')
    const saved = await readCampaignState()
    await expect(gm.caller.mutation(saveCondition, condition)).rejects.toThrow(
      'changed before this save'
    )
    await expect(
      gm.caller.mutation(deleteCondition, { ...input, conditionId: first.id, expectedVersion: 0 })
    ).rejects.toThrow('changed before this delete')
    await expect(
      gm.caller.mutation(saveCondition, { ...condition, conditionTypeId: crypto.randomUUID() })
    ).rejects.toThrow('not available in this rules system')
    await expect(
      gm.caller.mutation(saveCondition, {
        ...condition,
        conditionTypeId: SRD_CONDITION_TYPES[1].id,
        expectedVersion: 2
      })
    ).rejects.toThrow('changed before this save')
    expect(await readCampaignState()).toEqual(saved)
    const withCondition = await player.caller.query(getSheet, input)
    expect(withCondition.overview.abilities).toEqual(sheet.overview.abilities)
    expect(withCondition.overview.conditions).toEqual(sheet.overview.conditions)
    // A removed vocabulary entry prevents saving, but deleting needs no System hydration.
    await t.run(async (ctx) => {
      const system = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
        .unique()
      if (!system) throw new Error('Missing System fixture.')
      await ctx.db.delete(system._id)
    })
    await expect(
      gm.caller.mutation(saveCondition, { ...condition, expectedVersion: 1 })
    ).rejects.toThrow('Game System is unavailable')
    await gm.caller.mutation(deleteCondition, {
      ...input,
      conditionId: second.id,
      expectedVersion: 1
    })
    const final = await readCampaignState()
    expect(campaignCharacterStateSchema.parse(JSON.parse(final.state!.documentJson))).toMatchObject(
      { adjustments: [hp], conditions: [] }
    )
    const deletedEvent = final.events.find((event) => event.type === 'CAMPAIGN_CONDITION_DELETED')
    expect(deletedEvent?.visibility).toBe('OWNER')
    expect(JSON.parse(deletedEvent!.payloadJson)).toEqual({
      action: 'DELETED',
      conditionId: first.id,
      conditionTypeId: first.conditionTypeId,
      version: 1
    })
    expect(await readState()).toEqual(before)
  })

  it('rejects unavailable scoped adjustment targets without writing state or audit', async () => {
    const { gm, adjustment, readCampaignState, readState } = await setup()
    const before = await readCampaignState()
    const characterBefore = await readState()
    const unavailable: CampaignAdjustmentInput['adjustment'][] = [
      { family: 'SKILL', skillId: crypto.randomUUID(), field: 'MISC_BONUS', value: 1 },
      { family: 'ITEM', itemInstanceId: crypto.randomUUID(), field: 'ATTACK_BONUS', value: 1 },
      {
        family: 'SPELL',
        field: 'ATTACK_BONUS',
        value: 1,
        source: {
          spellId: crypto.randomUUID(),
          sourceKind: 'CLASS',
          sourceInstanceId: crypto.randomUUID()
        }
      }
    ]
    for (const candidate of unavailable) {
      await expect(
        gm.caller.mutation(saveAdjustment, { ...adjustment, adjustment: candidate })
      ).rejects.toThrow('not available')
    }
    await expect(
      gm.caller.mutation(saveAdjustment, { ...adjustment, expectedVersion: 1 })
    ).rejects.toThrow('changed before this save')
    expect(await readCampaignState()).toEqual(before)
    expect(await readState()).toEqual(characterBefore)
  })

  it('rolls back state and audit when real post-write Sheet projection fails on save or delete', async () => {
    const { gm, input, adjustment, readState, readCampaignState } = await setup()
    const before = await readCampaignState()
    const characterBefore = await readState()
    const original = projection.projectCharacterSheetBundle
    const spy = vi
      .spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected post-write projection failure')
      })
    await expect(gm.caller.mutation(saveAdjustment, adjustment)).rejects.toThrow(
      'Injected post-write projection failure'
    )
    expect(spy).toHaveBeenCalledTimes(2)
    expect(await readCampaignState()).toEqual(before)
    expect(await readState()).toEqual(characterBefore)
    spy.mockRestore()
    const saved = await gm.caller.mutation(saveAdjustment, adjustment)
    const afterSave = await readCampaignState()
    vi.spyOn(projection, 'projectCharacterSheetBundle').mockImplementationOnce(() => {
      throw new Error('Injected delete projection failure')
    })
    await expect(
      gm.caller.mutation(deleteAdjustment, { ...input, adjustmentId: saved.id, expectedVersion: 0 })
    ).rejects.toThrow('Injected delete projection failure')
    expect(await readCampaignState()).toEqual(afterSave)
    expect(await readState()).toEqual(characterBefore)
  })

  it('denies every writer to non-owners and revoked, mismatched or archived assignments without side effects', async () => {
    const {
      t,
      gm,
      player,
      campaign,
      character,
      input,
      adjustment,
      condition,
      memberId,
      assignmentId,
      readCampaignState,
      readState
    } = await setup()
    const hp = await gm.caller.mutation(saveAdjustment, adjustment)
    const status = await gm.caller.mutation(saveCondition, condition)
    const before = await readCampaignState()
    const characterBefore = await readState()
    async function denied(caller: typeof gm.caller, scope = input) {
      await expect(caller.mutation(saveAdjustment, { ...adjustment, ...scope })).rejects.toThrow()
      await expect(caller.mutation(saveCondition, { ...condition, ...scope })).rejects.toThrow()
      await expect(
        caller.mutation(deleteAdjustment, { ...scope, adjustmentId: hp.id, expectedVersion: 0 })
      ).rejects.toThrow()
      await expect(
        caller.mutation(deleteCondition, { ...scope, conditionId: status.id, expectedVersion: 0 })
      ).rejects.toThrow()
      expect(await readCampaignState()).toEqual(before)
    }
    await denied(t)
    await denied(player.caller)
    await t.run((ctx) => ctx.db.patch(memberId, { userId: crypto.randomUUID() }))
    await denied(player.caller)
    await denied(gm.caller)
    await t.run((ctx) => ctx.db.patch(memberId, { userId: player.userId }))
    await denied(gm.caller, { ...input, campaignId: crypto.randomUUID() })
    await denied(gm.caller, { ...input, characterId: crypto.randomUUID() })
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'LEFT', leftAt: campaign.createdAt }))
    await denied(player.caller)
    await denied(gm.caller)
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'ACTIVE', leftAt: null, role: 'OWNER' }))
    await denied(gm.caller)
    await t.run((ctx) => ctx.db.patch(memberId, { role: 'PLAYER' }))
    await t.run((ctx) => ctx.db.patch(assignmentId, { campaignId: crypto.randomUUID() }))
    await denied(gm.caller)
    await t.run((ctx) => ctx.db.patch(assignmentId, { campaignId: campaign.id }))
    const route = await t.run((ctx) =>
      ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', character.id))
        .unique()
    )
    if (!route || !characterBefore.character) throw new Error('Missing Character fixture.')
    await t.run((ctx) => ctx.db.patch(route._id, { ownerUserId: gm.userId }))
    await denied(gm.caller)
    await t.run((ctx) => ctx.db.patch(route._id, { ownerUserId: player.userId }))
    await t.run((ctx) => ctx.db.patch(characterBefore.character!._id, { userId: gm.userId }))
    await denied(gm.caller)
    await t.run((ctx) =>
      ctx.db.patch(characterBefore.character!._id, {
        userId: player.userId,
        systemId: crypto.randomUUID()
      })
    )
    await denied(gm.caller)
    await t.run((ctx) =>
      ctx.db.patch(characterBefore.character!._id, { systemId: character.systemId })
    )
    await gm.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: 0
    })
    await denied(gm.caller)
    expect(await readState()).toEqual(characterBefore)
  })
})
