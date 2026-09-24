import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  UpdateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { listCampaignAdjustmentsInputSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import type {
  campaignCharacterSheetExecuteInputSchema,
  campaignCharacterSheetPanelInputSchema,
  campaignCharacterRestPreviewInputSchema
} from '@artificer-toolkit/schema/api/campaignCharacterSheet'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { CharacterPreparationOptionsResponseDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import type {
  CharacterRestPreviewRequestDto,
  CharacterRestPreviewResponseDto,
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CharacterHistoryInput,
  CharacterHistoryPage
} from '@artificer-toolkit/schema/api/characterHistory'
import { campaignCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readyCharacterFixture, readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'
import { api, components, internal } from '../_generated/api'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const updateCampaign = makeFunctionReference<'mutation', UpdateCampaignInput, CampaignDetailDto>(
  'campaigns/update:update'
)
const get = makeFunctionReference<
  'query',
  z.input<typeof listCampaignAdjustmentsInputSchema>,
  CharacterSheetResponseDto
>('campaigns/characterSheet:get')
const panel = makeFunctionReference<
  'query',
  z.input<typeof campaignCharacterSheetPanelInputSchema>,
  CharacterSheetPanelDto
>('campaigns/characterSheet:panel')
const preparationOptions = makeFunctionReference<
  'query',
  z.input<typeof listCampaignAdjustmentsInputSchema>,
  CharacterPreparationOptionsResponseDto
>('campaigns/characterSheet:preparationOptions')
const restPreview = makeFunctionReference<
  'query',
  z.input<typeof campaignCharacterRestPreviewInputSchema>,
  CharacterRestPreviewResponseDto
>('campaigns/characterSheet:restPreview')
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
const history = makeFunctionReference<'query', CharacterHistoryInput, CharacterHistoryPage>(
  'characters/history:list'
)

async function setup(fixture?: Awaited<ReturnType<typeof readySheetFixture>>) {
  const { owner: player, other: gm, ...base } = fixture ?? (await readySheetFixture())
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'Campaign Sheet',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  // Assignment/membership fixtures only: public admission is outside this test's boundary.
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
  const assignment = {
    campaignId: campaign.id,
    userId: player.userId,
    characterId: base.character.id,
    assignedAt: campaign.createdAt
  }
  const assignmentId = await base.t.run((ctx) =>
    ctx.db.insert('campaignCharacterAssignments', assignment)
  )
  const input = { campaignId: campaign.id, characterId: base.character.id }
  const overlayMetadata = {
    ...input,
    createdBy: gm.userId,
    version: 0,
    createdAt: campaign.createdAt,
    updatedAt: campaign.createdAt
  }
  return {
    ...base,
    player,
    gm,
    campaign,
    input,
    memberId,
    assignment,
    assignmentId,
    overlayMetadata
  }
}

function restInput(expectedVersion: number): CharacterRestPreviewRequestDto {
  return {
    restKind: 'LONG',
    expectedVersion,
    selectedHitDice: [],
    resetMaximumHitPointModifier: false,
    healingMode: 'AUTOMATIC',
    manualHealingAccepted: false,
    selectedCompanionInstanceIds: [],
    requestRoll: false
  }
}

describe('native Campaign Character Sheet boundary', () => {
  it('requires exact assignment authority before reads and replay, including archive and membership changes', async () => {
    const {
      t,
      player,
      gm,
      campaign,
      character,
      input,
      memberId,
      assignment,
      assignmentId,
      readState
    } = await setup()
    const user = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Party member',
            email: 'party@example.invalid',
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
            expiresAt: Date.now() + 60000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const member = t.withIdentity({ subject: user._id, sessionId: session._id })
    const identity = await member.query(api.account.identity, {})
    if (!identity) throw new Error('Missing party member identity.')
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: identity.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    const command = {
      type: 'SET_INSPIRATION' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 1,
      inspired: true
    }
    const before = await readState()
    expect((await player.caller.query(get, input)).meta.viewer).toBe('CHARACTER_OWNER')
    expect((await gm.caller.query(get, input)).meta.viewer).toBe('CAMPAIGN_OWNER')
    expect(await gm.caller.query(preparationOptions, input)).toEqual(
      await player.caller.query(preparationOptions, input)
    )
    await expect(t.query(get, input)).rejects.toThrow()
    await expect(member.query(get, input)).rejects.toThrow('Assigned Character not found')
    await expect(
      member.query(panel, { ...input, target: { kind: 'ABILITY', ability: 'STRENGTH' } })
    ).rejects.toThrow()
    await expect(member.query(restPreview, { ...input, input: restInput(1) })).rejects.toThrow()
    await expect(member.query(preparationOptions, input)).rejects.toThrow()
    await expect(member.mutation(execute, { ...input, command })).rejects.toThrow()
    expect(await gm.caller.query(api.characters.sheet.get, { id: character.id })).toBeNull()
    await expect(
      gm.caller.query(api.characters.panels.get, {
        id: character.id,
        target: { kind: 'ABILITY', ability: 'STRENGTH' }
      })
    ).rejects.toThrow()
    await expect(
      gm.caller.mutation(personalExecute, { id: character.id, command })
    ).rejects.toThrow()
    await expect(
      gm.caller.query(get, { ...input, campaignId: crypto.randomUUID() })
    ).rejects.toThrow()
    expect(await readState()).toEqual(before)

    const first = await gm.caller.mutation(execute, { ...input, command })
    const written = await readState()
    expect(first.streamVersion).toBe(2)
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'LEFT', leftAt: campaign.createdAt }))
    await expect(player.caller.query(get, input)).rejects.toThrow()
    await expect(gm.caller.query(get, input)).rejects.toThrow('Assigned Character not found')
    await expect(gm.caller.mutation(execute, { ...input, command })).rejects.toThrow()
    expect(await readState()).toEqual(written)
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'ACTIVE', leftAt: null }))
    await t.run((ctx) => ctx.db.delete(assignmentId))
    await expect(gm.caller.query(get, input)).rejects.toThrow('Assigned Character not found')
    await expect(gm.caller.mutation(execute, { ...input, command })).rejects.toThrow()
    expect(await readState()).toEqual(written)
    await t.run((ctx) => ctx.db.insert('campaignCharacterAssignments', assignment))
    await gm.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: 0
    })
    expect((await gm.caller.query(get, input)).meta.capabilities).toMatchObject({
      managePlayState: false,
      manageInventory: false,
      managePrivateNotes: false
    })
    expect(
      await gm.caller.query(panel, { ...input, target: { kind: 'ABILITY', ability: 'STRENGTH' } })
    ).toMatchObject({ editable: false, allowedCommands: [] })
    await expect(gm.caller.mutation(execute, { ...input, command })).rejects.toThrow('read-only')
    await expect(
      gm.caller.mutation(execute, {
        ...input,
        command: { ...command, commandId: crypto.randomUUID(), expectedVersion: 2 }
      })
    ).rejects.toThrow('read-only')
    expect(await readState()).toEqual(written)
  })

  it('evaluates Campaign slot precedence without exposing secret metadata or rewriting player adjustments', async () => {
    const { t, player, gm, character, input, overlayMetadata, readState } = await setup()
    await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        adjustment: { family: 'ABILITY', ability: 'STRENGTH', field: 'SCORE_OVERRIDE', value: 18 }
      }
    })
    await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 2 }
      }
    })
    const personal = await player.caller.query(get, input)
    const state = campaignCharacterStateSchema.parse({
      adjustments: [
        {
          ...overlayMetadata,
          id: crypto.randomUUID(),
          visibility: 'VISIBLE',
          adjustment: {
            family: 'ABILITY',
            ability: 'STRENGTH',
            field: 'SCORE_OVERRIDE',
            value: 19,
            sourceNote: 'Shared ability cause'
          }
        },
        {
          ...overlayMetadata,
          id: crypto.randomUUID(),
          visibility: 'SECRET',
          adjustment: {
            family: 'HIT_POINTS',
            field: 'MAXIMUM_OVERRIDE',
            value: 30,
            sourceNote: 'SECRET-HP-OVERRIDE'
          }
        },
        {
          ...overlayMetadata,
          id: crypto.randomUUID(),
          visibility: 'SECRET',
          adjustment: {
            family: 'HIT_POINTS',
            field: 'MAXIMUM_MODIFIER',
            value: 4,
            sourceNote: 'SECRET-HP-MODIFIER'
          }
        },
        {
          ...overlayMetadata,
          id: crypto.randomUUID(),
          visibility: 'SECRET',
          adjustment: {
            family: 'ABILITY',
            ability: 'DEXTERITY',
            field: 'SCORE_OVERRIDE',
            value: 21,
            sourceNote: 'SECRET-ABILITY'
          }
        }
      ],
      conditions: [
        {
          ...overlayMetadata,
          id: crypto.randomUUID(),
          visibility: 'VISIBLE',
          conditionTypeId: SRD_CONDITION_TYPES[0].id,
          notes: 'Shared condition'
        },
        {
          ...overlayMetadata,
          id: crypto.randomUUID(),
          visibility: 'SECRET',
          conditionTypeId: SRD_CONDITION_TYPES[1].id,
          notes: 'SECRET-CONDITION'
        }
      ]
    })
    // Campaign adjustment writes are not native yet; seed their current persisted projection.
    const stateId = await t.run((ctx) =>
      ctx.db.insert('campaignCharacterStates', {
        ...input,
        documentJson: JSON.stringify(state),
        checksum: checksumRuleDocument(state)
      })
    )
    const before = await readState()
    const playerSheet = await player.caller.query(get, input)
    const gmSheet = await gm.caller.query(get, input)
    expect(playerSheet.overview).toMatchObject({
      maxHitPoints: 30,
      maxHitPointsOverride: null,
      maxHitPointsModifier: 0,
      maxHitPointsModifierAdjustmentId: null
    })
    expect(gmSheet.overview).toMatchObject({
      maxHitPoints: 30,
      maxHitPointsOverride: 30,
      maxHitPointsModifier: 4,
      maxHitPointsModifierAdjustmentId: state.adjustments[2]!.id
    })
    expect(
      playerSheet.overview.abilities.find((ability) => ability.ability === 'STRENGTH')?.score
    ).toBe(19)
    expect(
      playerSheet.overview.abilities.find((ability) => ability.ability === 'DEXTERITY')?.score
    ).toBe(21)
    expect(playerSheet.overview.conditions.map((condition) => condition.conditionTypeId)).toEqual([
      SRD_CONDITION_TYPES[0].id
    ])
    expect(gmSheet.overview.conditions.map((condition) => condition.conditionTypeId)).toEqual(
      expect.arrayContaining([SRD_CONDITION_TYPES[0].id, SRD_CONDITION_TYPES[1].id])
    )
    const playerPanel = await player.caller.query(panel, {
      ...input,
      target: { kind: 'ABILITY', ability: 'DEXTERITY' }
    })
    const gmPanel = await gm.caller.query(panel, {
      ...input,
      target: { kind: 'ABILITY', ability: 'DEXTERITY' }
    })
    const rest = await player.caller.query(restPreview, { ...input, input: restInput(3) })
    const playerText = JSON.stringify({ playerSheet, playerPanel, rest })
    for (const secret of state.adjustments.slice(1)) {
      expect(playerText).not.toContain(secret.id)
      expect(playerText).not.toContain(secret.adjustment.sourceNote)
    }
    expect(playerText).not.toContain('SECRET-CONDITION')
    expect(JSON.stringify(gmPanel)).toContain('SECRET-ABILITY')
    expect(JSON.stringify(gmSheet)).toContain('SECRET-CONDITION')
    expect(rest.hitPoints).toMatchObject({
      maximumHitPointModifier: 0,
      canResetMaximumHitPointModifier: false
    })
    expect(await readState()).toEqual(before)
    await t.run((ctx) => ctx.db.delete(stateId))
    expect(await player.caller.query(get, input)).toEqual(personal)
    expect(await readState()).toEqual(before)
  })

  it('shares item, extra and spell names while excluding owner notes from GM Sheets and panels', async () => {
    const fixture = await readyCharacterFixture({
      features: [
        {
          id: crypto.randomUUID(),
          label: 'Granted Cantrip',
          description: '',
          availableAtLevel: 1,
          order: 0,
          grants: {
            spells: [
              {
                id: crypto.randomUUID(),
                grantKind: 'SPELL_GRANT' as const,
                selectionKind: 'GRANTED' as const,
                scalingKind: 'NONE' as const,
                authoringModeKind: 'SELECTED' as const,
                spellIds: [fireBolt.id],
                attributes: ['CAST_AT_WILL' as const],
                castingAbility: 'INTELLIGENCE' as const,
                order: 0
              }
            ]
          }
        }
      ]
    })
    const equipment = { ...club, id: crypto.randomUUID(), label: 'Private Keepsake Club' }
    await fixture.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment }),
        importedSubject({ subjectKind: 'SPELL', ...fireBolt, document: fireBolt }),
        importedSubject({ subjectKind: 'CREATURE', ...cat, document: cat })
      ]
    })
    const { draft, character } = await fixture.createCharacter()
    const committed = await fixture.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const readState = () =>
      fixture.t.run(async (ctx) => ({
        character: await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', character.id))
          .unique(),
        receipts: await ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
          .take(20)
      }))
    const { player, gm, input } = await setup({ ...fixture, character, committed, readState })
    const added = await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'ADD_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        equipmentId: equipment.id,
        quantity: 1,
        customName: 'shit keepsake',
        notes: 'shit PRIVATE-ITEM'
      }
    })
    const item = added.sheet.inventory.items.find((entry) => entry.equipmentId === equipment.id)!
    const equipped = await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'EQUIP_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        itemId: item.id
      }
    })
    const source = equipped.sheet.spells.spells.find((spell) => spell.id === fireBolt.id)
      ?.sources?.[0]?.source
    if (!source) throw new Error('Missing initial Class spell grant.')
    const group = await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'CREATE_NOTE_GROUP',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        label: 'PRIVATE-GROUP'
      }
    })
    const groupId = group.sheet.notes.groups?.find((entry) => entry.kind === 'CUSTOM')?.id
    if (!groupId) throw new Error('Missing private note group.')
    await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'CREATE_NOTE',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        title: 'PRIVATE-TITLE',
        body: '<p>shit PRIVATE-BODY</p>',
        groupId
      }
    })
    const extra = await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'ADD_SHEET_EXTRA',
        commandId: crypto.randomUUID(),
        expectedVersion: 5,
        extra: { kind: 'COMPANION', creatureId: cat.id, originKind: 'WORLD' }
      }
    })
    const companion = extra.sheet.extras.items.find((entry) => entry.kind === 'COMPANION')!
    await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'UPDATE_SHEET_EXTRA',
        commandId: crypto.randomUUID(),
        expectedVersion: 6,
        extra: {
          kind: 'COMPANION',
          extraId: companion.id,
          customName: 'shit familiar',
          notes: 'shit PRIVATE-EXTRA'
        }
      }
    })
    await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 7,
        source,
        customName: 'shit flame',
        notes: 'shit PRIVATE-SPELL'
      }
    })
    const before = await readState()
    const sheet = await gm.caller.query(get, input)
    expect(sheet.meta).toMatchObject({
      hasBuilderDraft: false,
      capabilities: { managePrivateNotes: false, openBuilder: false }
    })
    expect(sheet.inventory.items.find((entry) => entry.id === item.id)).toMatchObject({
      label: '**** keepsake',
      customName: 'shit keepsake'
    })
    expect(sheet.extras.items.find((entry) => entry.id === companion.id)).toMatchObject({
      displayName: '**** familiar',
      customName: 'shit familiar'
    })
    expect(sheet.spells.spells.find((spell) => spell.id === fireBolt.id)?.sources).toContainEqual(
      expect.objectContaining({ customName: 'shit flame' })
    )
    expect(sheet.notes.groups).toBeUndefined()
    expect(sheet.notes.items).toBeUndefined()
    expect(sheet.notes.notes).toBeUndefined()
    expect(JSON.stringify(sheet)).not.toContain('PRIVATE-')
    const targets = [
      { kind: 'ITEM', itemInstanceId: item.id },
      { kind: 'COMPANION', companionInstanceId: companion.id },
      { kind: 'SPELL', source }
    ] satisfies z.input<typeof campaignCharacterSheetPanelInputSchema>['target'][]
    const names = ['shit keepsake', 'shit familiar', 'shit flame']
    const notes = ['shit PRIVATE-ITEM', 'shit PRIVATE-EXTRA', 'shit PRIVATE-SPELL']
    for (const [index, target] of targets.entries()) {
      const gmPanel = await gm.caller.query(panel, { ...input, target })
      const ownerPanel = await player.caller.query(panel, { ...input, target })
      if (!('textEditors' in gmPanel) || !('textEditors' in ownerPanel))
        throw new Error('Expected text editors.')
      expect(gmPanel.textEditors.find((editor) => editor.field === 'CUSTOM_NAME')?.value).toBe(
        names[index]
      )
      expect(gmPanel.textEditors.some((editor) => editor.field === 'NOTES')).toBe(false)
      expect(ownerPanel.textEditors.find((editor) => editor.field === 'NOTES')?.value).toBe(
        notes[index]
      )
      expect(gmPanel.title).toContain('****')
      expect(JSON.stringify(gmPanel)).not.toContain('PRIVATE-')
    }
    const ownerSheet = await player.caller.query(get, input)
    expect(ownerSheet.notes.items?.[0]?.body).toBe('<p>shit PRIVATE-BODY</p>')
    expect(await readState()).toEqual(before)
    const renamedExtra = await gm.caller.mutation(execute, {
      ...input,
      command: {
        type: 'UPDATE_SHEET_EXTRA',
        commandId: crypto.randomUUID(),
        expectedVersion: ownerSheet.meta.streamVersion,
        extra: { kind: 'COMPANION', extraId: companion.id, customName: 'shit renamed familiar' }
      }
    })
    const renamedSpell = await gm.caller.mutation(execute, {
      ...input,
      command: {
        type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: renamedExtra.streamVersion,
        source,
        customName: 'shit renamed flame'
      }
    })
    expect(
      renamedSpell.sheet.extras.items.find((entry) => entry.id === companion.id)
    ).toMatchObject({
      displayName: '**** renamed familiar',
      customName: 'shit renamed familiar'
    })
    expect(
      renamedSpell.sheet.spells.spells.find((spell) => spell.id === fireBolt.id)?.sources
    ).toContainEqual(expect.objectContaining({ customName: 'shit renamed flame' }))
    expect(JSON.stringify(renamedSpell.sheet)).not.toContain('PRIVATE-')
    const afterRenames = await readState()
    expect(
      characterAuthoredDtoSchema
        .parse(JSON.parse(afterRenames.character!.documentJson))
        .state.creatures?.find((entry) => entry.id === companion.id)
    ).toMatchObject({
      customName: 'shit renamed familiar',
      notes: 'shit PRIVATE-EXTRA'
    })
    expect(
      characterSheetStateSchema.parse(JSON.parse(afterRenames.character!.sheetState!.documentJson))
        .spellCustomizations
    ).toContainEqual(
      expect.objectContaining({ customName: 'shit renamed flame', notes: 'shit PRIVATE-SPELL' })
    )
    expect(afterRenames.receipts).toHaveLength(before.receipts.length + 2)
  })

  it('uses the Character receipt stream for GM renames and rejects stale, conflicting and forbidden writes', async () => {
    const { player, gm, character, input, readState } = await setup()
    const initial = await player.caller.query(get, input)
    const itemId = initial.inventory.items[0]!.id
    await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'UPDATE_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        itemId,
        notes: 'PRIVATE-UNCHANGED'
      }
    })
    const rename = {
      type: 'UPDATE_INVENTORY_ITEM' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 2,
      itemId,
      customName: 'shit club'
    }
    const first = await gm.caller.mutation(execute, { ...input, command: rename })
    expect(first).toMatchObject({ streamVersion: 3, historyEntry: { actorId: gm.userId } })
    expect(first.sheet.inventory.items.find((item) => item.id === itemId)).toMatchObject({
      label: '**** club',
      customName: 'shit club'
    })
    expect(JSON.stringify(first)).not.toContain('PRIVATE-UNCHANGED')
    await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'SET_INSPIRATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        inspired: true
      }
    })
    const beforeReplay = await readState()
    const replay = await gm.caller.mutation(execute, { ...input, command: rename })
    expect(replay).toMatchObject({ streamVersion: 4, sheet: { overview: { inspiration: true } } })
    expect(replay.historyEntry).toEqual(first.historyEntry)
    expect(await readState()).toEqual(beforeReplay)
    const forbidden = [
      { ...rename, customName: 'conflicting replay' },
      { ...rename, commandId: crypto.randomUUID() },
      { ...rename, commandId: crypto.randomUUID(), expectedVersion: 4, notes: null },
      {
        type: 'CREATE_NOTE',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        title: 'Forbidden',
        groupId: 'session-notes'
      },
      {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 100 }
      }
    ] satisfies CharacterSheetExecuteInput['command'][]
    for (const command of forbidden) {
      await expect(gm.caller.mutation(execute, { ...input, command })).rejects.toThrow()
      expect(await readState()).toEqual(beforeReplay)
    }
    await expect(
      gm.caller.mutation(api.characters.drafts.create, {
        id: character.id,
        systemId: character.systemId
      })
    ).rejects.toThrow()
    expect(await readState()).toEqual(beforeReplay)
    const cleared = await gm.caller.mutation(execute, {
      ...input,
      command: {
        ...rename,
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        customName: null
      }
    })
    expect(cleared.streamVersion).toBe(5)
    expect(
      cleared.sheet.inventory.items.find((item) => item.id === itemId)?.customName
    ).toBeUndefined()
    const final = await readState()
    const authored = characterAuthoredDtoSchema.parse(JSON.parse(final.character!.documentJson))
    expect(authored.state.equipment.inventory.find((item) => item.id === itemId)).toMatchObject({
      notes: 'PRIVATE-UNCHANGED'
    })
    expect(
      authored.state.equipment.inventory.find((item) => item.id === itemId)?.customName
    ).toBeUndefined()
    expect(final.character?.streamVersion).toBe(5)
    expect(final.receipts).toHaveLength(4)
    expect(final.receipts.filter((receipt) => receipt.actorId === gm.userId)).toHaveLength(2)
    const ownerHistory = await player.caller.query(history, {
      id: character.id,
      paginationOpts: { cursor: null, numItems: 48 }
    })
    expect(ownerHistory.page).toHaveLength(2)
    expect(ownerHistory.page.every((entry) => entry.actorId === player.userId)).toBe(true)
    expect(ownerHistory.page.some((entry) => entry.eventId === first.historyEntry?.eventId)).toBe(
      false
    )
    expect(await readState()).toEqual(final)
  })

  it('uses secret Campaign HP for rest without leaking or resetting player adjustment state', async () => {
    const { t, player, gm, character, input, overlayMetadata, readState } = await setup()
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
          sourceNote: 'Player modifier'
        }
      }
    })
    await player.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        mode: 'DAMAGE',
        amount: 3
      }
    })
    const state = campaignCharacterStateSchema.parse({
      adjustments: [
        {
          ...overlayMetadata,
          id: crypto.randomUUID(),
          visibility: 'SECRET',
          adjustment: {
            family: 'HIT_POINTS',
            field: 'MAXIMUM_MODIFIER',
            value: 4,
            sourceNote: 'SECRET-REST-CAUSE'
          }
        }
      ],
      conditions: []
    })
    const stateId = await t.run((ctx) =>
      ctx.db.insert('campaignCharacterStates', {
        ...input,
        documentJson: JSON.stringify(state),
        checksum: checksumRuleDocument(state)
      })
    )
    const before = await readState()
    const overlayBefore = await t.run((ctx) => ctx.db.get(stateId))
    const rest = await gm.caller.query(restPreview, { ...input, input: restInput(3) })
    const ownerRest = await player.caller.query(restPreview, { ...input, input: restInput(3) })
    for (const preview of [rest, ownerRest]) {
      expect(preview.hitPoints).toMatchObject({
        maximum: 15,
        maximumHitPointModifier: 0,
        canResetMaximumHitPointModifier: false
      })
      expect(JSON.stringify(preview)).not.toContain(state.adjustments[0]!.id)
      expect(JSON.stringify(preview)).not.toContain('SECRET-REST-CAUSE')
    }
    await expect(
      gm.caller.query(restPreview, {
        ...input,
        input: { ...restInput(3), resetMaximumHitPointModifier: true }
      })
    ).rejects.toThrow()
    const command = {
      type: 'COMPLETE_REST' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 3,
      restKind: 'LONG' as const,
      previewFingerprint: rest.previewFingerprint,
      selectedHitDice: [],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC' as const,
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: []
    }
    await expect(
      gm.caller.mutation(execute, {
        ...input,
        command: { ...command, resetMaximumHitPointModifier: true }
      })
    ).rejects.toThrow()
    expect(await readState()).toEqual(before)
    const first = await gm.caller.mutation(execute, { ...input, command })
    expect(first.sheet.overview.currentHitPoints).toBe(15)
    expect(first.historyEntry?.actorId).toBe(gm.userId)
    const after = await readState()
    expect(after.character?.streamVersion).toBe(4)
    expect(after.receipts).toHaveLength(before.receipts.length + 1)
    expect(
      characterAuthoredDtoSchema.parse(JSON.parse(after.character!.documentJson)).state.hitpoints
        .current
    ).toBe(15)
    expect(
      characterSheetStateSchema.parse(JSON.parse(after.character!.sheetState!.documentJson))
        .adjustments
    ).toEqual(
      characterSheetStateSchema.parse(JSON.parse(before.character!.sheetState!.documentJson))
        .adjustments
    )
    expect(await t.run((ctx) => ctx.db.get(stateId))).toEqual(overlayBefore)
    const replay = await gm.caller.mutation(execute, { ...input, command })
    expect(replay.historyEntry).toEqual(first.historyEntry)
    expect(replay.result).toEqual(first.result)
    expect(await readState()).toEqual(after)
  })

  it('applies the Campaign attunement override to GM command policy with no receipt for rejected attunement', async () => {
    const { t, gm, campaign, input, readState } = await setup()
    const equipment = {
      ...club,
      id: crypto.randomUUID(),
      label: 'Attuned Club',
      requiresAttunement: true
    }
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment })]
    })
    const updated = await gm.caller.mutation(updateCampaign, {
      campaignId: campaign.id,
      expectedVersion: campaign.version,
      attunementSlotOverride: 0
    })
    const added = await gm.caller.mutation(execute, {
      ...input,
      command: {
        type: 'ADD_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        equipmentId: equipment.id,
        quantity: 1
      }
    })
    const itemId = added.sheet.inventory.items.find((item) => item.equipmentId === equipment.id)!.id
    await gm.caller.mutation(execute, {
      ...input,
      command: {
        type: 'EQUIP_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        itemId
      }
    })
    const before = await readState()
    const command = {
      type: 'ATTUNE_ITEM' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 3,
      itemId
    }
    await expect(gm.caller.mutation(execute, { ...input, command })).rejects.toThrow('more than 0')
    expect(await readState()).toEqual(before)
    await gm.caller.mutation(updateCampaign, {
      campaignId: campaign.id,
      expectedVersion: updated.version,
      attunementSlotOverride: 1
    })
    const result = await gm.caller.mutation(execute, { ...input, command })
    expect(result.sheet.inventory.items.find((item) => item.id === itemId)?.attuned).toBe(true)
    const after = await readState()
    expect(after.character?.streamVersion).toBe(4)
    expect(after.receipts).toHaveLength(before.receipts.length + 1)
    expect(
      characterAuthoredDtoSchema.parse(JSON.parse(after.character!.documentJson)).state.equipment
        .attuned
    ).toContain(itemId)
    expect(
      characterAuthoredDtoSchema.parse(JSON.parse(after.character!.documentJson)).intent
    ).toEqual(characterAuthoredDtoSchema.parse(JSON.parse(before.character!.documentJson)).intent)
  })
})
