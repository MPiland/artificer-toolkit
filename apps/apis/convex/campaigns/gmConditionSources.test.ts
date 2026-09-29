import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignConditionDto,
  DeleteCampaignConditionInput,
  SaveCampaignConditionInput
} from '@artificer-toolkit/schema/api/campaignLiveState'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { campaignCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord } from '../characters/stateDocuments'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
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
const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')

describe('native Campaign GM condition sources', () => {
  it('keeps a manual DM condition independent from the same Sheet condition type', async () => {
    const base = await readySheetFixture()
    const player = base.owner
    const gm = base.other
    const conditionType = SRD_CONDITION_TYPES[0]
    if (!conditionType) throw new Error('Missing SRD condition fixture.')
    const campaign = await gm.caller.mutation(createCampaign, {
      name: 'GM condition sources',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await base.t.run(async (ctx) => {
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
        characterId: base.character.id,
        assignedAt: campaign.createdAt
      })
    })
    const input = { campaignId: campaign.id, characterId: base.character.id }
    const readCampaignState = () =>
      base.t.run(async (ctx) =>
        ctx.db
          .query('campaignCharacterStates')
          .withIndex('by_campaignId_characterId', (q) =>
            q.eq('campaignId', campaign.id).eq('characterId', base.character.id)
          )
          .unique()
      )
    const sheetConditionIds = async () => {
      const state = await base.readState()
      if (!state.character) throw new Error('Missing Character state.')
      const character = readCharacterRecord(state.character)
      return (character.state?.conditions ?? []).map((condition) => condition.conditionTypeId)
    }

    await player.caller.mutation(execute, {
      id: base.character.id,
      command: {
        type: 'ADD_CONDITION',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        conditionTypeId: conditionType.id
      }
    })
    expect(await sheetConditionIds()).toEqual([conditionType.id])

    const first = await gm.caller.mutation(saveCondition, {
      ...input,
      conditionTypeId: conditionType.id,
      visibility: 'VISIBLE',
      expectedVersion: 0,
      notes: 'DM first note'
    })
    const updated = await gm.caller.mutation(saveCondition, {
      ...input,
      conditionTypeId: conditionType.id,
      visibility: 'SECRET',
      expectedVersion: 0,
      notes: 'DM updated note'
    })
    expect(updated).toMatchObject({ id: first.id, version: 1, notes: 'DM updated note' })
    const beforeStale = await readCampaignState()
    await expect(
      gm.caller.mutation(saveCondition, {
        ...input,
        conditionTypeId: conditionType.id,
        visibility: 'VISIBLE',
        expectedVersion: 0,
        notes: 'Stale write'
      })
    ).rejects.toThrow('changed before this save')
    expect(await readCampaignState()).toEqual(beforeStale)
    expect(await sheetConditionIds()).toEqual([conditionType.id])
    const stored = campaignCharacterStateSchema.parse(JSON.parse(beforeStale!.documentJson))
    expect(stored.conditions).toEqual([
      expect.objectContaining({
        id: first.id,
        conditionTypeId: conditionType.id,
        version: 1,
        visibility: 'SECRET',
        notes: 'DM updated note'
      })
    ])

    await player.caller.mutation(execute, {
      id: base.character.id,
      command: {
        type: 'REMOVE_CONDITION',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        conditionTypeId: conditionType.id
      }
    })
    expect(await sheetConditionIds()).toEqual([])
    expect(
      campaignCharacterStateSchema.parse(JSON.parse((await readCampaignState())!.documentJson))
        .conditions
    ).toHaveLength(1)

    await player.caller.mutation(execute, {
      id: base.character.id,
      command: {
        type: 'ADD_CONDITION',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        conditionTypeId: conditionType.id
      }
    })
    const sheetBeforeDelete = await base.readState()
    await gm.caller.mutation(deleteCondition, {
      ...input,
      conditionId: first.id,
      expectedVersion: 1
    })
    expect(await readCampaignState()).toBeNull()
    expect(await base.readState()).toEqual(sheetBeforeDelete)
    expect(await sheetConditionIds()).toEqual([conditionType.id])
  }, 30000)
})
