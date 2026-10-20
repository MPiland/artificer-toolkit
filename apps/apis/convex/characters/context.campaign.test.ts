import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  ShareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CharacterSheetExtraCatalogReadInput,
  CharacterSheetExtraCatalogResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { cat as rawCat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { rowboat } from '@artificer-toolkit/source-data/srd/vehicles/rowboat.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { loadCharacterBuilderContext } from './builderContext'
import { loadCharacterRuleContext, readCharacterSources } from './context'
import { srdCreatureRecord } from '../../tests/fixtures/srdCreatures'

const cat = srdCreatureRecord(rawCat.id)

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const share = makeFunctionReference<'mutation', ShareCampaignContentInput, unknown>(
  'campaigns/contentShares:share'
)
const listExtras = makeFunctionReference<
  'query',
  CharacterSheetExtraCatalogReadInput,
  CharacterSheetExtraCatalogResponseDto
>('characters/extraOptions:list')
const executeSheet = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')

async function publishDuplicate(
  caller: Awaited<ReturnType<typeof readySheetFixture>>['owner']['caller'],
  subjectKind: 'BACKGROUND' | 'EQUIPMENT' | 'CREATURE' | 'VEHICLE',
  subjectId: string,
  label: string
) {
  const draft = await caller.mutation(api.content.drafts.duplicate, { subjectKind, subjectId })
  const saved = await caller.mutation(api.content.drafts.save, {
    subjectKind,
    subjectId: draft.subjectId,
    systemId: draft.systemId,
    label,
    payload: { ...draft.payload, label }
  })
  await caller.mutation(api.content.publication.publishDraft, {
    subjectKind,
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: saved.updatedAt!
  })
  return draft.subjectId
}

async function setup() {
  const base = await readySheetFixture()
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Character source access',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const membershipId = await base.t.run((ctx) =>
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
  const assignmentId = await base.t.run((ctx) =>
    ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      characterId: base.character.id,
      assignedAt: campaign.createdAt
    })
  )
  return { ...base, campaign, membershipId, assignmentId }
}

describe('assigned native Character Campaign source access', () => {
  it('shares exact Homebrew roots, requires explicit Homebrew parents, and keeps global details private', async () => {
    const { t, owner, other, campaign, character } = await setup()
    const background = await publishDuplicate(
      other.caller,
      'BACKGROUND',
      acolyte.id,
      'Shitstorm background'
    )
    const parent = await publishDuplicate(other.caller, 'EQUIPMENT', club.id, 'Shared parent')
    const variantDraft = await other.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: club.id
    })
    const variant = equipmentAuthoredDtoSchema.parse({
      ...variantDraft.payload,
      id: variantDraft.subjectId,
      label: 'Shared variant',
      category: 'VARIANT',
      parentEquipmentId: parent
    })
    const savedVariant = await other.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: variantDraft.subjectId,
      systemId: variantDraft.systemId,
      label: 'Shared variant',
      payload: variant
    })
    await other.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'EQUIPMENT',
      subjectId: variantDraft.subjectId,
      expectedDraftUpdatedAt: savedVariant.updatedAt!
    })
    const sharedVariant = variantDraft.subjectId
    const sibling = await publishDuplicate(other.caller, 'EQUIPMENT', club.id, 'Unshared sibling')
    for (const [subjectKind, subjectId] of [
      ['BACKGROUND', background],
      ['EQUIPMENT', parent],
      ['EQUIPMENT', sharedVariant]
    ] as const)
      await other.caller.mutation(share, { campaignId: campaign.id, subjectKind, subjectId })
    const selected = {
      ...character,
      intent: { ...character.intent, background: { backgroundId: background } },
      state: {
        ...character.state,
        equipment: {
          ...character.state.equipment,
          inventory: [{ id: crypto.randomUUID(), equipmentId: sharedVariant, quantity: 1 }]
        }
      }
    }
    const context = await t.run(async (ctx) => {
      const result = await loadCharacterRuleContext(ctx, selected, owner.userId)
      return {
        backgrounds: result.registry.backgrounds.map((row) => row.id),
        equipment: result.registry.equipment.map((row) => row.id)
      }
    })
    expect(context.backgrounds).toContain(background)
    expect(context.equipment).toContain(sharedVariant)
    expect(context.equipment).not.toContain(sibling)
    const builder = await t.run(async (ctx) => {
      const result = await loadCharacterBuilderContext(ctx, selected, owner.userId, 'resolution')
      return {
        backgrounds: result.catalog.backgrounds.map((row) => row.id),
        equipment: result.catalog.equipment.map((row) => row.id)
      }
    })
    expect(builder.backgrounds).toContain(background)
    expect(builder.equipment).toContain(sharedVariant)
    expect(builder.equipment).not.toContain(sibling)
    const presented = await owner.caller.query(api.characters.builder.activeCharacter, {
      id: character.id
    })
    if (!presented) throw new Error('Missing active Character.')
    expect(JSON.stringify(presented)).not.toContain('Shitstorm')
    expect(presented.id).toBe(character.id)
    expect(
      await other.caller.query(api.content.details.get, {
        subjectKind: 'BACKGROUND',
        id: background,
        view: 'active'
      })
    ).not.toBeNull()
    expect(
      await owner.caller.query(api.content.details.get, {
        subjectKind: 'BACKGROUND',
        id: background,
        view: 'active'
      })
    ).toBeNull()
  })

  it('restricts official catalogue sources while preserving personal Homebrew and selected Sheet extras', async () => {
    const { t, owner, campaign, committed, character } = await setup()
    const sourceId = crypto.randomUUID()
    const catalogueId = crypto.randomUUID()
    const creatureId = crypto.randomUUID()
    const vehicleId = crypto.randomUUID()
    await t.run(async (ctx) => {
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: sourceId,
        code: 'campaign-official'
      })
      await ctx.db.insert('rulesCatalogues', {
        ...SRD_RULES_CATALOGUE,
        id: catalogueId,
        code: 'campaign-official',
        contentSourceIds: [sourceId]
      })
      const root = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!root) throw new Error('Missing Campaign.')
      await ctx.db.patch(root._id, { additionalRulesCatalogueIds: [catalogueId] })
    })
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'CREATURE', ...cat, document: cat })]
    })
    await importSeededSubjects(t, {
      contentSourceId: sourceId,
      subjects: [
        importedSubject({
          subjectKind: 'CREATURE',
          ...cat,
          id: creatureId,
          label: 'Campaign cat',
          document: { ...cat, id: creatureId, label: 'Campaign cat' }
        }),
        importedSubject({
          subjectKind: 'VEHICLE',
          ...rowboat,
          id: vehicleId,
          label: 'Campaign boat',
          document: { ...rowboat, id: vehicleId, label: 'Campaign boat' }
        })
      ]
    })
    const own = await publishDuplicate(owner.caller, 'CREATURE', cat.id, 'Personal cat')
    const selected = {
      ...character,
      state: {
        ...character.state,
        creatures: [
          {
            id: crypto.randomUUID(),
            creatureId,
            relationshipKind: 'COMPANION' as const,
            originKind: 'WORLD' as const
          }
        ],
        vehicles: [{ id: crypto.randomUUID(), vehicleId }]
      }
    }
    const visible = await t.run(async (ctx) => {
      const context = await loadCharacterRuleContext(ctx, selected, owner.userId)
      return {
        creatures: [...context.creaturesById.keys()],
        vehicles: [...context.vehiclesById.keys()]
      }
    })
    expect(visible.creatures).toEqual([creatureId])
    expect(visible.vehicles).toEqual([vehicleId])
    const extras = await owner.caller.query(listExtras, {
      id: committed.publicId,
      kind: 'CREATURE',
      limit: 25
    })
    expect(extras.items.map((item) => item.id)).toContain(creatureId)
    expect(extras.items.map((item) => item.id)).toContain(own)
    expect(
      (
        await owner.caller.query(listExtras, { id: committed.publicId, kind: 'VEHICLE', limit: 25 })
      ).items.map((item) => item.id)
    ).toContain(vehicleId)
    const added = await owner.caller.mutation(executeSheet, {
      id: character.id,
      command: {
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        type: 'ADD_SHEET_EXTRA',
        extra: { kind: 'VEHICLE', vehicleId }
      }
    })
    expect(added).not.toHaveProperty('sheet')
    const addedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: added.characterId
    }))!
    expect(addedSheet.extras.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'VEHICLE', vehicleId })])
    )
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!root) throw new Error('Missing Campaign.')
      await ctx.db.patch(root._id, { additionalRulesCatalogueIds: [] })
    })
    await expect(
      owner.caller.query(listExtras, { id: committed.publicId, kind: 'VEHICLE', limit: 25 })
    ).resolves.toMatchObject({ items: [] })
    await expect(
      owner.caller.mutation(executeSheet, {
        id: character.id,
        command: {
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          type: 'ADD_SHEET_EXTRA',
          extra: { kind: 'VEHICLE', vehicleId }
        }
      })
    ).rejects.toThrow()
  })

  it('fails closed for GM reads and restores personal access after assignment removal or a left member', async () => {
    const { t, owner, other, character, membershipId, assignmentId } = await setup()
    await expect(
      t.run((ctx) => loadCharacterRuleContext(ctx, character, other.userId))
    ).rejects.toThrow('owned')
    await t.run((ctx) =>
      ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    await expect(
      t.run((ctx) => loadCharacterRuleContext(ctx, character, owner.userId))
    ).rejects.toThrow()
    await t.run((ctx) => ctx.db.delete(assignmentId))
    await expect(
      t.run(async (ctx) =>
        (await loadCharacterRuleContext(ctx, character, owner.userId)).registry.backgrounds.map(
          (row) => row.id
        )
      )
    ).resolves.toBeDefined()
  })

  it('selects and adds only shared extras, masks cursor labels, and rejects additions after revocation', async () => {
    const { t, owner, other, campaign, character, committed, readState } = await setup()
    const officialCat = { ...cat, label: 'Shitstorm official cat' }
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({ subjectKind: 'CREATURE', ...officialCat, document: officialCat })
      ]
    })
    const sharedId = await publishDuplicate(other.caller, 'CREATURE', cat.id, 'Shitstorm companion')
    const siblingId = await publishDuplicate(other.caller, 'CREATURE', cat.id, 'Unshared companion')
    await other.caller.mutation(share, {
      campaignId: campaign.id,
      subjectKind: 'CREATURE',
      subjectId: sharedId
    })
    const first = await owner.caller.query(listExtras, {
      id: committed.publicId,
      kind: 'CREATURE',
      limit: 1
    })
    expect(JSON.stringify(first).toLowerCase()).not.toContain('shitstorm')
    expect(first.nextCursor).not.toBeNull()
    const second = await owner.caller.query(listExtras, {
      id: committed.publicId,
      kind: 'CREATURE',
      limit: 1,
      cursor: first.nextCursor!
    })
    expect(new Set([...first.items, ...second.items].map((item) => item.id))).toEqual(
      new Set([cat.id, sharedId])
    )
    expect([...first.items, ...second.items].map((item) => item.id)).not.toContain(siblingId)
    expect(second.nextCursor).toBeNull()
    const sheet = await owner.caller.query(api.characters.sheet.get, { id: committed.publicId })
    if (!sheet) throw new Error('Missing Sheet.')
    const added = await owner.caller.mutation(executeSheet, {
      id: character.id,
      command: {
        type: 'ADD_SHEET_EXTRA',
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion,
        extra: {
          kind: 'COMPANION',
          creatureId: sharedId,
          originKind: 'WORLD'
        }
      }
    })
    expect(added).not.toHaveProperty('sheet')
    const addedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: added.characterId
    }))!
    expect(addedSheet.extras.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ creatureId: sharedId })])
    )
    expect(JSON.stringify(addedSheet.extras)).not.toContain('Shitstorm')
    const companion = addedSheet.extras.items.find((item) => item.kind === 'COMPANION')
    if (!companion) throw new Error('Missing companion.')
    const panel = await owner.caller.query(api.characters.panels.get, {
      id: character.id,
      target: { kind: 'COMPANION', companionInstanceId: companion.id }
    })
    expect(JSON.stringify(panel)).not.toContain('Shitstorm')
    const stored = await readState()
    await owner.caller.query(api.characters.sheet.get, { id: character.id })
    expect(await readState()).toEqual(stored)
    await t.run(async (ctx) => {
      const record = await ctx.db
        .query('campaignContentShares')
        .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
          q.eq('campaignId', campaign.id).eq('subjectKind', 'CREATURE').eq('subjectId', sharedId)
        )
        .unique()
      if (!record) throw new Error('Missing share.')
      await ctx.db.delete(record._id)
    })
    expect(
      (
        await owner.caller.query(listExtras, {
          id: committed.publicId,
          kind: 'CREATURE',
          limit: 25
        })
      ).items.map((item) => item.id)
    ).toEqual([cat.id])
    const before = await readState()
    await expect(
      owner.caller.mutation(executeSheet, {
        id: character.id,
        command: {
          type: 'ADD_SHEET_EXTRA',
          commandId: crypto.randomUUID(),
          expectedVersion: added.streamVersion,
          extra: {
            kind: 'COMPANION',
            creatureId: sharedId,
            originKind: 'WORLD'
          }
        }
      })
    ).rejects.toThrow()
    expect(await readState()).toEqual(before)
  })

  it('preserves player-private notes and their history under the Campaign text policy', async () => {
    const { owner, other, character, readState } = await setup()
    const command = {
      type: 'CREATE_NOTE' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 1,
      title: 'Shitstorm private plan',
      body: '<p>Shitstorm private details</p>',
      groupId: 'session-notes'
    }
    const created = await owner.caller.mutation(executeSheet, { id: character.id, command })
    expect(created).not.toHaveProperty('sheet')
    const createdSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: created.characterId
    }))!
    expect(createdSheet.notes.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: command.title, body: command.body })
      ])
    )
    expect(created.historyEntry?.summary).toContain(command.title)
    const before = await readState()
    const replay = await owner.caller.mutation(executeSheet, { id: character.id, command })
    expect(replay.historyEntry).toEqual(created.historyEntry)
    expect(await readState()).toEqual(before)
    expect(await other.caller.query(api.characters.sheet.get, { id: character.id })).toBeNull()
  })

  it('counts only enabled catalogue and owned sources for assigned Characters', async () => {
    const { t, owner, character } = await setup()
    const ids = await t.run(async (ctx) => {
      for (let index = 0; index < 100; index++)
        await ctx.db.insert('contentSources', {
          ...SRD_CONTENT_SOURCE,
          id: crypto.randomUUID(),
          code: `disabled-${index}`
        })
      return (await readCharacterSources(ctx, character, owner.userId)).sources.map(
        (source) => source.id
      )
    })
    expect(ids).toContain(SRD_CONTENT_SOURCE.id)
    expect(ids.length).toBeLessThanOrEqual(2)
  })

  it('accepts displayed roll labels while preserving original roll snapshots and masking current history', async () => {
    const { t, owner, other, campaign, character, readState } = await setup()
    const equipmentId = await publishDuplicate(other.caller, 'EQUIPMENT', club.id, 'Shitstorm club')
    await other.caller.mutation(share, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: equipmentId
    })
    const added = await owner.caller.mutation(executeSheet, {
      id: character.id,
      command: {
        type: 'ADD_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        equipmentId,
        quantity: 1
      }
    })
    expect(added).not.toHaveProperty('sheet')
    const addedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: added.characterId
    }))!
    const item = addedSheet.inventory.items.find((row) => row.equipmentId === equipmentId)
    if (!item) throw new Error('Missing shared inventory item.')
    const equipped = await owner.caller.mutation(executeSheet, {
      id: character.id,
      command: {
        type: 'EQUIP_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        itemId: item.id
      }
    })
    expect(equipped).not.toHaveProperty('sheet')
    const equippedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: equipped.characterId
    }))!
    const action = equippedSheet.actions.items.find(
      (row) => row.label.includes('storm') && row.mechanic?.attackBonus != null
    )
    if (!action?.mechanic || action.mechanic.attackBonus == null)
      throw new Error('Missing shared attack.')
    expect(action.label).not.toContain('Shitstorm')
    const bonus = action.mechanic.attackBonus
    const request = {
      characterId: character.id,
      expression: bonus === 0 ? '1d20' : `1d20 ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}`,
      rollMode: action.mechanic.attackRollMode ?? 'NORMAL',
      source: { kind: 'ATTACK' as const, label: `${action.label.slice(0, 80)} attack`.slice(0, 80) }
    }
    const before = await readState()
    const rolled = await owner.caller.mutation(api.rolls.execute, request)
    expect(rolled.source).toEqual(request.source)
    expect(await owner.caller.query(api.rolls.history, {})).toEqual([
      { ...rolled, gmCampaignRoll: null }
    ])
    const storedRolls = await t.run((ctx) => ctx.db.query('userRollHistory').collect())
    expect(storedRolls[0].source.label).toContain('Shitstorm')
    await expect(
      owner.caller.mutation(api.rolls.execute, { ...request, expression: '1d20 + 999' })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(api.rolls.execute, {
        ...request,
        source: { kind: 'ATTACK', label: storedRolls[0].source.label }
      })
    ).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('userRollHistory').collect())).toEqual(storedRolls)
    expect(await readState()).toEqual(before)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign.')
      await ctx.db.patch(row._id, { contentMaturity: 'MATURE' })
    })
    expect((await owner.caller.query(api.rolls.history, {}))[0].source.label).toContain('Shitstorm')
  })
})
