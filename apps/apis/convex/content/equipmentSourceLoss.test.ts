import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AuthoredDeleteActiveInput,
  AuthoredPublicationResult,
  AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { healersKit } from '@artificer-toolkit/source-data/srd/equipment/healers-kit.js'
import * as S from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_LANGUAGES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { api } from '../_generated/api'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { readCharacterDraft } from '../characters/documents'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'

const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)

async function publishOwnedClub(base: Awaited<ReturnType<typeof readySheetFixture>>) {
  const draft = await base.owner.caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'EQUIPMENT',
    subjectId: club.id
  })
  if (!draft.updatedAt) throw new Error('Missing Equipment draft revision.')
  return base.owner.caller.mutation(publish, {
    subjectKind: 'EQUIPMENT',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

async function snapshot(base: Awaited<ReturnType<typeof readySheetFixture>>, subjectId: string) {
  return base.t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', subjectId))
      .unique()
    return {
      root,
      version: root ? await ctx.db.get(root.currentVersionId) : null,
      draft: await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', subjectId))
        .unique(),
      character: await readCharacterRow(ctx, base.character.id),
      characterDraft: await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
        .unique(),
      characterDraftPayloads: await ctx.db
        .query('characterDraftPayloads')
        .withIndex('by_characterId_id', (q) => q.eq('characterId', base.character.id))
        .collect(),
      partyItems: await ctx.db.query('campaignPartyItems').collect(),
      partyInventories: await ctx.db.query('campaignPartyInventories').collect(),
      shares: await ctx.db.query('campaignContentShares').collect(),
      events: await ctx.db.query('campaignEvents').collect()
    }
  })
}

describe('native Equipment deletion source-loss cleanup', () => {
  // A Character write queues the Sheet derivation 300 ms out and cancels the one it replaces. On real
  // timers convex-test starts a queued derivation mid-test, and the next write then cancels one that
  // is already running (invariant error "canceled" after it finished). Fake timers keep queued work
  // pending until the test's cleanup cancels it.
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('retains acquired Equipment rules and contents in active and saved Character state after authored deletion', async () => {
    const base = await readySheetFixture()
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({
          subjectKind: 'EQUIPMENT',
          ...backpack,
          document: backpack
        }),
        importedSubject({
          subjectKind: 'EQUIPMENT',
          ...healersKit,
          document: healersKit
        })
      ]
    })
    const duplicated = await base.owner.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: healersKit.id
    })
    const abyssal = SRD_LANGUAGES.find((language) => language.code === 'ABYSSAL')
    if (!abyssal) throw new Error('Missing Abyssal language.')
    const modified = await base.owner.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: duplicated.subjectId,
      systemId: duplicated.systemId,
      label: "Owned Healer's Kit source-loss proof",
      payload: {
        ...duplicated.payload,
        label: "Owned Healer's Kit source-loss proof",
        modifiers: [S.stealthDisadvantageModifier(duplicated.subjectId)],
        features: [
          {
            id: crypto.randomUUID(),
            label: 'Abyssal training',
            description: 'You speak Abyssal.',
            order: 1,
            grants: {
              proficiencies: [
                {
                  id: crypto.randomUUID(),
                  grantKind: 'PROFICIENCY_GRANT',
                  proficiencyKind: 'LANGUAGE',
                  level: 'FULL',
                  selectionKind: 'GRANTED',
                  scalingKind: 'NONE',
                  authoringModeKind: 'SELECTED',
                  languageIds: [abyssal.id],
                  order: 1
                }
              ]
            }
          }
        ]
      }
    })
    if (!modified.updatedAt) throw new Error('Missing Equipment draft revision.')
    const publication = await base.owner.caller.mutation(publish, {
      subjectKind: 'EQUIPMENT',
      subjectId: modified.subjectId,
      expectedDraftUpdatedAt: modified.updatedAt
    })
    const record = (await base.readState()).character
    if (!record) throw new Error('Missing Character.')
    const removedItemId = crypto.randomUUID()
    const backpackItemId = crypto.randomUUID()
    const nestedClubItemId = crypto.randomUUID()
    const noteGroupId = crypto.randomUUID()
    const noteId = crypto.randomUUID()
    const current = readCharacterRecord(record)
    const document = characterAuthoredDtoSchema.parse({
      ...current,
      intent: {
        ...current.intent,
        startingEquipment: {
          ...current.intent.startingEquipment,
          background: {
            ...current.intent.startingEquipment?.background,
            groups: [
              ...(current.intent.startingEquipment?.background?.groups ?? []),
              {
                groupId: crypto.randomUUID(),
                optionId: crypto.randomUUID(),
                selections: [
                  {
                    selectionKey: crypto.randomUUID(),
                    equipmentId: publication.subjectId,
                    quantity: 1
                  },
                  {
                    selectionKey: crypto.randomUUID(),
                    equipmentId: backpack.id,
                    quantity: 1
                  }
                ]
              }
            ]
          }
        }
      },
      state: {
        ...current.state,
        equipment: {
          inventory: [
            {
              id: removedItemId,
              equipmentId: publication.subjectId,
              quantity: 1
            },
            { id: backpackItemId, equipmentId: backpack.id, quantity: 1 },
            {
              id: nestedClubItemId,
              equipmentId: club.id,
              quantity: 1,
              containerId: removedItemId
            }
          ],
          equipped: [
            { itemId: removedItemId, slot: 'WORN' },
            { itemId: backpackItemId, slot: 'WORN' }
          ],
          attuned: [removedItemId, backpackItemId]
        },
        noteGroups: [{ id: noteGroupId, label: 'Private', sortOrder: 0, kind: 'CUSTOM' }],
        notes: [
          {
            id: noteId,
            title: 'Keep me',
            groupId: noteGroupId,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
          }
        ]
      }
    })
    await base.t.run((ctx) => writeCharacterRecord(ctx, record, { document }))
    const opened = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: base.character.id,
      systemId: base.character.systemId
    })
    const saved = await base.owner.caller.mutation(api.characters.drafts.save, {
      characterId: base.character.id,
      expectedDraftId: opened.id,
      mode: 'edit',
      character: { ...document, label: 'Saved equipment repair' }
    })
    const before = await snapshot(base, publication.subjectId)
    const beforeSheet = await base.owner.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    if (!beforeSheet) throw new Error('Missing Character Sheet.')
    expect(
      beforeSheet.actions.items.some(
        (action) => action.sourceLabel === "Owned Healer's Kit source-loss proof"
      )
    ).toBe(true)
    expect(
      beforeSheet.resources.items.some(
        (resource) =>
          resource.owner.kind === 'ITEM_INSTANCE' && resource.owner.itemInstanceId === removedItemId
      )
    ).toBe(true)
    expect(
      beforeSheet.reference.proficiencies.some(
        (proficiency) => proficiency.kind === 'LANGUAGE' && proficiency.label === abyssal.label
      )
    ).toBe(true)
    expect(
      beforeSheet.overview.skills.find((skill) => skill.skillId === S.skillId('STEALTH'))?.rollMode
    ).toBe('DISADVANTAGE')
    if (!before.version) throw new Error('Missing Equipment version.')

    await expect(
      base.owner.caller.mutation(deleteActive, {
        subjectKind: 'EQUIPMENT',
        subjectId: publication.subjectId
      })
    ).resolves.toBeNull()
    const after = await snapshot(base, publication.subjectId)
    const afterSheet = await base.owner.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    if (!afterSheet) throw new Error('Missing Character Sheet after deletion.')
    expect(
      afterSheet.actions.items.some(
        (action) => action.sourceLabel === "Owned Healer's Kit source-loss proof"
      )
    ).toBe(true)
    expect(
      afterSheet.resources.items.some(
        (resource) =>
          resource.owner.kind === 'ITEM_INSTANCE' && resource.owner.itemInstanceId === removedItemId
      )
    ).toBe(true)
    expect(
      afterSheet.reference.proficiencies.some(
        (proficiency) => proficiency.kind === 'LANGUAGE' && proficiency.label === abyssal.label
      )
    ).toBe(true)
    expect(
      afterSheet.overview.skills.find((skill) => skill.skillId === S.skillId('STEALTH'))?.rollMode
    ).toBe('DISADVANTAGE')
    if (!after.character || !after.characterDraft) throw new Error('Missing reconciled Character.')
    const characterRecord = after.character
    const draftRecord = after.characterDraft
    const active = readCharacterRecord(characterRecord)
    const savedCharacter = (
      await base.t.run((ctx) => readCharacterDraft(ctx, draftRecord, characterRecord))
    ).payload.character
    expect(active.status).toBe('ACTIVE')
    expect(savedCharacter.status).toBe('DRAFT')
    for (const current of [active, savedCharacter]) {
      expect(current.state.equipment.inventory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: backpackItemId,
            equipmentId: backpack.id
          }),
          expect.objectContaining({
            id: nestedClubItemId,
            equipmentId: club.id
          })
        ])
      )
      expect(
        current.state.equipment.inventory.some((item) => item.equipmentId === publication.subjectId)
      ).toBe(true)
      expect(
        current.state.equipment.inventory.find((item) => item.id === nestedClubItemId)?.containerId
      ).toBe(removedItemId)
      expect(current.state.equipment.equipped).toContainEqual({
        itemId: removedItemId,
        slot: 'WORN'
      })
      expect(current.state.equipment.attuned).toContain(removedItemId)
      expect(
        current.intent.startingEquipment?.background?.groups?.flatMap(
          (group) => group.selections ?? []
        )
      ).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ equipmentId: publication.subjectId })])
      )
      expect(current.state.notes).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: noteId, title: 'Keep me' })])
      )
    }
    expect(
      afterSheet.reference.equipmentOptions.some((option) => option.id === publication.subjectId)
    ).toBe(true)
    const acquired = active.state.equipment.inventory.find((item) => item.id === removedItemId)
    expect(acquired?.retainedRulesJson).toBeDefined()
    // D163: with its source deleted, the Sheet reads the held item's pinned prose.
    const itemDescription = (sheet: typeof afterSheet) =>
      sheet.inventory.items.find((item) => item.id === removedItemId)?.description
    expect(healersKit.description).toBeTruthy()
    expect(itemDescription(beforeSheet)).toBe(healersKit.description)
    expect(itemDescription(afterSheet)).toBe(healersKit.description)
    await expect(
      base.owner.caller.mutation(api.characters.sheetCommands.execute, {
        id: base.character.id,
        command: {
          type: 'ADD_INVENTORY_ITEM',
          equipmentId: publication.subjectId,
          quantity: 1,
          commandId: crypto.randomUUID(),
          expectedVersion: after.character.play.streamVersion
        }
      })
    ).rejects.toThrow('is not available for this character')
    await expect(
      base.owner.caller.mutation(api.characters.sheetCommands.execute, {
        id: base.character.id,
        command: {
          type: 'UPDATE_INVENTORY_ITEM',
          itemId: removedItemId,
          quantity: 2,
          commandId: crypto.randomUUID(),
          expectedVersion: after.character.play.streamVersion
        }
      })
    ).rejects.toThrow('New Equipment copies require current source access')
    expect(await snapshot(base, publication.subjectId)).toEqual(after)
    expect(after.root).toBeNull()
    expect(await base.t.run((ctx) => ctx.db.get(before.version!._id))).toBeNull()
    expect(readCharacterSheetState(after.character)).toEqual(
      readCharacterSheetState(before.character!)
    )
    expect(after.characterDraft).toMatchObject({
      id: saved.id,
      label: 'Saved equipment repair'
    })
  }, 30_000)

  it('rejects anonymous and foreign deletes without changing the owned root or Character', async () => {
    const base = await readySheetFixture()
    const publication = await publishOwnedClub(base)
    const before = await snapshot(base, publication.subjectId)
    const input: AuthoredDeleteActiveInput = {
      subjectKind: 'EQUIPMENT',
      subjectId: publication.subjectId
    }
    await expect(base.t.mutation(deleteActive, input)).rejects.toThrow()
    await expect(base.other.caller.mutation(deleteActive, input)).rejects.toThrow()
    expect(await snapshot(base, publication.subjectId)).toEqual(before)
  })

  it('deletes the authored source while retaining acquired party Equipment and denying new copies', async () => {
    const base = await readySheetFixture()
    const publication = await publishOwnedClub(base)
    const campaign = await base.owner.caller.mutation(createCampaign, {
      name: 'Equipment holding guard',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await base.owner.caller.mutation(api.campaigns.contentShares.share, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: publication.subjectId
    })
    await base.owner.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'ITEM_ADD',
        campaignId: campaign.id,
        idempotencyKey: crypto.randomUUID(),
        expectedOwnerVersion: 0,
        equipmentId: publication.subjectId,
        quantity: 1
      }
    })
    const before = await snapshot(base, publication.subjectId)
    await expect(
      base.owner.caller.mutation(deleteActive, {
        subjectKind: 'EQUIPMENT',
        subjectId: publication.subjectId
      })
    ).resolves.toBeNull()
    const after = await snapshot(base, publication.subjectId)
    expect(after.root).toBeNull()
    expect(after.shares).toEqual([])
    expect(after.partyItems).toEqual(before.partyItems)
    expect(after.partyInventories).toEqual(before.partyInventories)
    expect(after.partyItems[0]?.retainedRulesJson).toBeDefined()
    const page = await base.owner.caller.query(api.campaigns.partyInventory.items, {
      campaignId: campaign.id,
      paginationOpts: { cursor: null, numItems: 48 }
    })
    expect(page.isDone).toBe(true)
    expect(page.page).toContainEqual(
      expect.objectContaining({ id: before.partyItems[0]!.id, quantity: 1 })
    )
    await expect(
      base.owner.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: {
          kind: 'ITEM_ADD',
          campaignId: campaign.id,
          equipmentId: publication.subjectId,
          quantity: 1,
          expectedOwnerVersion: 1,
          idempotencyKey: crypto.randomUUID()
        }
      })
    ).rejects.toThrow('unavailable')
    await expect(
      base.owner.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
        input: {
          kind: 'ITEM_UPDATE',
          campaignId: campaign.id,
          itemId: before.partyItems[0]!.id,
          quantity: 2,
          expectedOwnerVersion: 1,
          idempotencyKey: crypto.randomUUID()
        }
      })
    ).rejects.toThrow('unavailable')
    expect(await snapshot(base, publication.subjectId)).toEqual(after)
    await base.owner.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'ITEM_CONSUME',
        campaignId: campaign.id,
        itemId: before.partyItems[0]!.id,
        amount: 1,
        expectedOwnerVersion: 1,
        idempotencyKey: crypto.randomUUID()
      }
    })
    expect((await snapshot(base, publication.subjectId)).partyItems).toEqual([])
  })
})
