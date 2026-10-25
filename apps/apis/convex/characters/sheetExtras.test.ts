import { readReceiptHeaders } from '../lib/receiptLedgers'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { cat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { rowboat } from '@artificer-toolkit/source-data/srd/vehicles/rowboat.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { api } from '../_generated/api'
import {
  importedSubject,
  importSeededSubjects,
  versionWithCompilation
} from '../../tests/fixtures/publication'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import {
  deleteAuthoredVersion,
  insertAuthoredVersion,
  readPublishedDocument
} from '../content/documents'
import { readCharacterRecord, readCharacterRow } from './stateDocuments'

const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')

async function fixture() {
  const base = await readyCharacterFixture()
  const sourceFeature = cat.features?.[0]
  if (!sourceFeature) throw new Error('The Cat fixture requires a feature.')
  const feature = {
    ...sourceFeature,
    charges: {
      id: crypto.randomUUID(),
      limitKind: 'FIXED_AMOUNT' as const,
      scalingKind: 'NONE' as const,
      resetKind: 'SHORT_REST' as const,
      amount: 2
    }
  }
  const creature = {
    ...cat,
    id: crypto.randomUUID(),
    label: 'Charged Cat',
    features: [feature]
  }
  const vehicle = {
    ...rowboat,
    id: crypto.randomUUID(),
    label: 'Test Rowboat',
    hitPoints: 20
  }
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        subjectKind: 'CREATURE',
        ...creature,
        document: creature
      }),
      importedSubject({
        subjectKind: 'VEHICLE',
        ...vehicle,
        document: vehicle
      })
    ]
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const readState = () =>
    base.t.run(async (ctx) => {
      const stored = await readCharacterRow(ctx, character.id)
      return {
        character: stored,
        authored: stored ? readCharacterRecord(stored) : null,
        sheetState: stored ? readCharacterSheetState(stored) : null,
        receipts: await readReceiptHeaders(
          ctx,
          'characterCommandReceipts',
          await ctx.db
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
            .collect()
        )
      }
    })
  return { ...base, character, creature, vehicle, readState }
}

type WithoutCommandIdentity<T> = T extends unknown
  ? Omit<T, 'commandId' | 'expectedVersion'>
  : never

const command = (
  characterId: string,
  expectedVersion: number,
  body: WithoutCommandIdentity<CharacterSheetExecuteInput['command']>
): CharacterSheetExecuteInput => ({
  id: characterId,
  command: { ...body, commandId: crypto.randomUUID(), expectedVersion }
})

describe('native Character Sheet extra commands', () => {
  it('adds creature and vehicle extras with source defaults and preserves Builder intent', async () => {
    const { owner, character, creature, vehicle, readState } = await fixture()
    const before = await readState()
    const creatureResponse = await owner.caller.mutation(
      execute,
      command(character.id, 1, {
        type: 'ADD_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          creatureId: creature.id,
          originKind: 'WORLD'
        }
      })
    )
    expect(creatureResponse).not.toHaveProperty('sheet')
    const creatureResponseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: creatureResponse.characterId
    }))!
    const companion = creatureResponseSheet.extras.items.find((item) => item.kind === 'COMPANION')!
    expect(companion).toMatchObject({
      creatureId: creature.id,
      hitPoints: { maximum: 2, current: 2 }
    })
    expect(
      creatureResponseSheet.resources.items.some(
        (resource) =>
          resource.owner.kind === 'COMPANION_FEATURE' &&
          resource.owner.companionInstanceId === companion.id &&
          resource.max === 2
      )
    ).toBe(true)
    const mountResponse = await owner.caller.mutation(
      execute,
      command(character.id, 2, {
        type: 'ADD_SHEET_EXTRA',
        extra: { kind: 'MOUNT', creatureId: creature.id, originKind: 'WORLD' }
      })
    )
    expect(mountResponse).not.toHaveProperty('sheet')
    const mountResponseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: mountResponse.characterId
    }))!
    const ownedResponse = await owner.caller.mutation(
      execute,
      command(character.id, 3, {
        type: 'ADD_SHEET_EXTRA',
        extra: {
          kind: 'OWNED',
          creatureId: creature.id,
          originKind: 'SUMMONED'
        }
      })
    )
    expect(ownedResponse).not.toHaveProperty('sheet')
    const ownedResponseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: ownedResponse.characterId
    }))!
    expect(mountResponseSheet.extras.items.find((item) => item.kind === 'MOUNT')).toMatchObject({
      hitPoints: { maximum: 2, current: 2 },
      hitDice: [{ die: 4, total: 1, used: 0 }]
    })
    expect(ownedResponseSheet.extras.items.find((item) => item.kind === 'OWNED')).toMatchObject({
      hitPoints: { maximum: 2, current: 2 },
      hitDice: [{ die: 4, total: 1, used: 0 }]
    })
    const vehicleResponse = await owner.caller.mutation(
      execute,
      command(character.id, 4, {
        type: 'ADD_SHEET_EXTRA',
        extra: { kind: 'VEHICLE', vehicleId: vehicle.id }
      })
    )
    expect(vehicleResponse).not.toHaveProperty('sheet')
    const vehicleResponseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: vehicleResponse.characterId
    }))!
    const boat = vehicleResponseSheet.extras.items.find((item) => item.kind === 'VEHICLE')!
    expect(boat.hitPoints).toMatchObject({ maximum: 20, current: 20 })
    const stored = (await readState()).authored!
    expect(stored.intent).toEqual(before.authored?.intent)
    expect(stored.state.creatures).toHaveLength(3)
    for (const kind of ['COMPANION', 'MOUNT', 'OWNED'] as const) {
      expect(
        stored.state.creatures?.find((extra) => extra.relationshipKind === kind)
      ).toMatchObject({
        creatureId: creature.id,
        currentHitPoints: 2,
        hitDice: [{ die: 4, total: 1, used: 0 }]
      })
    }
    expect(stored.state.vehicles).toMatchObject([{ vehicleId: vehicle.id, currentHitPoints: 20 }])
  })

  it('updates fields, clamps HP, enforces exclusive assignments, and removes only the selected extra', async () => {
    const { owner, character, creature, vehicle, readState } = await fixture()
    let response = await owner.caller.mutation(
      execute,
      command(character.id, 1, {
        type: 'ADD_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          creatureId: creature.id,
          originKind: 'SUMMONED'
        }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    let responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const companionId = responseSheet.extras.items.find((item) => item.kind === 'COMPANION')!.id
    response = await owner.caller.mutation(
      execute,
      command(character.id, 2, {
        type: 'ADD_SHEET_EXTRA',
        extra: { kind: 'VEHICLE', vehicleId: vehicle.id }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const vehicleId = responseSheet.extras.items.find((item) => item.kind === 'VEHICLE')!.id
    response = await owner.caller.mutation(
      execute,
      command(character.id, 3, {
        type: 'ADD_INVENTORY_ITEM',
        equipmentId: (await readState()).authored!.state.equipment.inventory[0]!.equipmentId,
        quantity: 1
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const itemId = responseSheet.inventory.items.at(-1)!.id
    response = await owner.caller.mutation(
      execute,
      command(character.id, 4, {
        type: 'UPDATE_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          extraId: companionId,
          customName: 'Mittens',
          notes: 'Scout',
          currentHitPoints: 99,
          tempHitPoints: 4,
          hitDice: [{ die: 4, total: 1, used: 0 }],
          equipmentItemIds: [itemId, itemId]
        }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    expect(responseSheet.extras.items.find((item) => item.id === companionId)).toMatchObject({
      customName: 'Mittens',
      hitPoints: { current: 2, temp: 4 },
      equipmentItemIds: [itemId]
    })
    await expect(
      owner.caller.mutation(
        execute,
        command(character.id, 5, {
          type: 'UPDATE_SHEET_EXTRA',
          extra: {
            kind: 'VEHICLE',
            extraId: vehicleId,
            equipmentItemIds: [itemId]
          }
        })
      )
    ).rejects.toThrow('already assigned')
    await owner.caller.mutation(
      execute,
      command(character.id, 5, {
        type: 'UPDATE_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          extraId: companionId,
          equipmentItemIds: []
        }
      })
    )
    response = await owner.caller.mutation(
      execute,
      command(character.id, 6, {
        type: 'UPDATE_SHEET_EXTRA',
        extra: {
          kind: 'VEHICLE',
          extraId: vehicleId,
          equipmentItemIds: [itemId]
        }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    expect(
      responseSheet.extras.items.find((item) => item.id === vehicleId)?.equipmentItemIds
    ).toEqual([itemId])
    const beforeInvalid = await readState()
    await expect(
      owner.caller.mutation(
        execute,
        command(character.id, 7, {
          type: 'UPDATE_SHEET_EXTRA',
          extra: {
            kind: 'COMPANION',
            extraId: companionId,
            equipmentItemIds: [itemId]
          }
        })
      )
    ).rejects.toThrow('already assigned')
    await expect(
      owner.caller.mutation(
        execute,
        command(character.id, 7, {
          type: 'UPDATE_SHEET_EXTRA',
          extra: {
            kind: 'VEHICLE',
            extraId: vehicleId,
            equipmentItemIds: [crypto.randomUUID()]
          }
        })
      )
    ).rejects.toThrow('not available')
    await expect(
      owner.caller.mutation(
        execute,
        command(character.id, 7, {
          type: 'UPDATE_SHEET_EXTRA',
          extra: { kind: 'COMPANION', extraId: vehicleId }
        })
      )
    ).rejects.toThrow()
    expect(await readState()).toEqual(beforeInvalid)
    response = await owner.caller.mutation(
      execute,
      command(character.id, 7, {
        type: 'UPDATE_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          extraId: companionId,
          customName: 'Renamed',
          notes: 'Updated'
        }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    expect(responseSheet.extras.items.find((item) => item.id === companionId)).toMatchObject({
      customName: 'Renamed',
      notes: 'Updated',
      hitPoints: { current: 2, temp: 4 }
    })
    await owner.caller.mutation(
      execute,
      command(character.id, 8, {
        type: 'UPDATE_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          extraId: companionId,
          customName: null,
          notes: null
        }
      })
    )
    const cleared = (await readState()).authored!.state.creatures!.find(
      (extra) => extra.id === companionId
    )!
    expect(cleared.customName).toBeUndefined()
    expect(cleared.notes).toBeUndefined()
    expect(cleared.tempHitPoints).toBe(4)
    const removed = await owner.caller.mutation(
      execute,
      command(character.id, 9, {
        type: 'REMOVE_SHEET_EXTRA',
        extra: { kind: 'VEHICLE', extraId: vehicleId }
      })
    )
    expect(removed).not.toHaveProperty('sheet')
    const removedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: removed.characterId
    }))!
    expect(removedSheet.extras.items.some((item) => item.id === vehicleId)).toBe(false)
    expect((await readState()).authored?.state.vehicles).toEqual([])
  })

  it('rejects foreign owners, rolls back projection failures, and replays without double add', async () => {
    const { owner, other, character, creature, readState } = await fixture()
    const request = command(character.id, 1, {
      type: 'ADD_SHEET_EXTRA',
      extra: {
        kind: 'COMPANION',
        creatureId: creature.id,
        originKind: 'WORLD'
      }
    })
    const beforeAdd = await readState()
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected extra projection failure')
      })
    await expect(owner.caller.mutation(execute, request)).rejects.toThrow(
      'Injected extra projection failure'
    )
    expect(await readState()).toEqual(beforeAdd)
    vi.restoreAllMocks()
    const first = await owner.caller.mutation(execute, request)
    const replay = await owner.caller.mutation(execute, request)
    expect(replay).not.toHaveProperty('sheet')
    const replaySheet = (await owner.caller.query(api.characters.sheet.get, {
      id: replay.characterId
    }))!
    expect(replay.historyEntry).toEqual(first.historyEntry)
    expect(replaySheet.extras.items.filter((item) => item.kind === 'COMPANION')).toHaveLength(1)
    const before = await readState()
    await expect(
      other.caller.mutation(
        execute,
        command(character.id, 2, {
          type: 'ADD_SHEET_EXTRA',
          extra: {
            kind: 'COMPANION',
            creatureId: creature.id,
            originKind: 'WORLD'
          }
        })
      )
    ).rejects.toThrow()
    expect(await readState()).toEqual(before)
  })

  it('tracks charged companions independently and rolls back then replays removal exactly', async () => {
    const { owner, character, creature, readState } = await fixture()
    let response = await owner.caller.mutation(
      execute,
      command(character.id, 1, {
        type: 'ADD_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          creatureId: creature.id,
          originKind: 'WORLD'
        }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    let responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const firstId = responseSheet.extras.items.find((item) => item.kind === 'COMPANION')!.id
    response = await owner.caller.mutation(
      execute,
      command(character.id, 2, {
        type: 'ADD_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          creatureId: creature.id,
          originKind: 'SUMMONED'
        }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const secondId = responseSheet.extras.items
      .filter((item) => item.kind === 'COMPANION')
      .find((item) => item.id !== firstId)!.id
    response = await owner.caller.mutation(
      execute,
      command(character.id, 3, {
        type: 'ADD_INVENTORY_ITEM',
        equipmentId: (await readState()).authored!.state.equipment.inventory[0]!.equipmentId,
        quantity: 1
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const itemId = responseSheet.inventory.items.at(-1)!.id
    response = await owner.caller.mutation(
      execute,
      command(character.id, 4, {
        type: 'UPDATE_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          extraId: firstId,
          equipmentItemIds: [itemId]
        }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const secondItemId = responseSheet.inventory.items.find((item) => item.id !== itemId)!.id
    response = await owner.caller.mutation(
      execute,
      command(character.id, 5, {
        type: 'UPDATE_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          extraId: secondId,
          equipmentItemIds: [secondItemId]
        }
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    const firstResource = responseSheet.resources.items.find(
      (resource) =>
        resource.owner.kind === 'COMPANION_FEATURE' &&
        resource.owner.companionInstanceId === firstId
    )!
    const secondResource = responseSheet.resources.items.find(
      (resource) =>
        resource.owner.kind === 'COMPANION_FEATURE' &&
        resource.owner.companionInstanceId === secondId
    )!
    response = await owner.caller.mutation(
      execute,
      command(character.id, 6, {
        type: 'USE_SHEET_RESOURCE',
        owner: firstResource.owner,
        amount: 1
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    response = await owner.caller.mutation(
      execute,
      command(character.id, 7, {
        type: 'USE_SHEET_RESOURCE',
        owner: secondResource.owner,
        amount: 1
      })
    )
    expect(response).not.toHaveProperty('sheet')
    responseSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: response.characterId
    }))!
    await expect(
      owner.caller.mutation(
        execute,
        command(character.id, 8, {
          type: 'UPSERT_SHEET_ADJUSTMENT',
          adjustment: {
            family: 'COMPANION',
            companionInstanceId: firstId,
            field: 'SIZE_OVERRIDE',
            value: 'AVERAGE'
          }
        })
      )
    ).rejects.toThrow('Size "AVERAGE" is not available.')
    await owner.caller.mutation(
      execute,
      command(character.id, 8, {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        adjustment: {
          family: 'COMPANION',
          companionInstanceId: firstId,
          field: 'SIZE_OVERRIDE',
          value: 'SMALL'
        }
      })
    )
    await owner.caller.mutation(
      execute,
      command(character.id, 9, {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        adjustment: {
          family: 'COMPANION',
          companionInstanceId: secondId,
          field: 'SIZE_OVERRIDE',
          value: 'MEDIUM'
        }
      })
    )
    const beforeRemove = await readState()
    const remove = command(character.id, 10, {
      type: 'REMOVE_SHEET_EXTRA',
      extra: { kind: 'COMPANION', extraId: firstId }
    })
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected remove projection failure')
      })
    await expect(owner.caller.mutation(execute, remove)).rejects.toThrow(
      'Injected remove projection failure'
    )
    expect(await readState()).toEqual(beforeRemove)
    vi.restoreAllMocks()
    const removed = await owner.caller.mutation(execute, remove)
    expect(removed).not.toHaveProperty('sheet')
    const removedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: removed.characterId
    }))!
    const afterRemove = await readState()
    const state = afterRemove.sheetState!
    expect(state.adjustments).toEqual(
      beforeRemove.sheetState!.adjustments.filter(
        (adjustment) =>
          adjustment.family !== 'COMPANION' || adjustment.companionInstanceId !== firstId
      )
    )
    expect(state.resourceUsage).toEqual(
      beforeRemove.sheetState!.resourceUsage.filter(
        (usage) =>
          usage.owner.kind !== 'COMPANION_FEATURE' || usage.owner.companionInstanceId !== firstId
      )
    )
    expect(
      state.adjustments.some(
        (adjustment) =>
          adjustment.family === 'COMPANION' && adjustment.companionInstanceId === firstId
      )
    ).toBe(false)
    expect(
      state.adjustments.some(
        (adjustment) =>
          adjustment.family === 'COMPANION' && adjustment.companionInstanceId === secondId
      )
    ).toBe(true)
    expect(
      state.resourceUsage.some(
        (usage) =>
          usage.owner.kind === 'COMPANION_FEATURE' && usage.owner.companionInstanceId === firstId
      )
    ).toBe(false)
    expect(
      state.resourceUsage.some(
        (usage) =>
          usage.owner.kind === 'COMPANION_FEATURE' && usage.owner.companionInstanceId === secondId
      )
    ).toBe(true)
    expect(afterRemove.authored!.state.equipment.inventory).toEqual(
      beforeRemove.authored!.state.equipment.inventory
    )
    expect(afterRemove.authored!.state.creatureEquipment?.[firstId]).toBeUndefined()
    expect(afterRemove.authored!.state.creatureEquipment?.[secondId]).toEqual([
      { equipmentItemId: secondItemId }
    ])
    expect(removedSheet.extras.items.some((item) => item.id === firstId)).toBe(false)
    const replay = await owner.caller.mutation(execute, remove)
    expect(replay).not.toHaveProperty('sheet')
    expect(replay.historyEntry).toEqual(removed.historyEntry)
    expect(await readState()).toEqual(afterRemove)
  })

  it('rejects missing, wrong-kind, private, and inactive extra sources without writes', async () => {
    const { t, owner, other, character, creature, vehicle, readState } = await fixture()
    const privateCopy = await other.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CREATURE',
      subjectId: creature.id
    })
    if (!privateCopy.updatedAt) throw new Error('Missing private Creature draft timestamp.')
    await other.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'CREATURE',
      subjectId: privateCopy.subjectId,
      expectedDraftUpdatedAt: privateCopy.updatedAt
    })
    expect(
      await other.caller.query(api.content.details.get, {
        subjectKind: 'CREATURE',
        id: privateCopy.subjectId,
        view: 'active'
      })
    ).not.toBeNull()
    expect(
      await owner.caller.query(api.content.details.get, {
        subjectKind: 'CREATURE',
        id: privateCopy.subjectId,
        view: 'active'
      })
    ).toBeNull()
    const inactiveCopy = await owner.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CREATURE',
      subjectId: creature.id
    })
    if (!inactiveCopy.updatedAt) throw new Error('Missing inactive Creature draft timestamp.')
    const inactiveDraft = await owner.caller.mutation(api.content.drafts.save, {
      subjectKind: 'CREATURE',
      subjectId: inactiveCopy.subjectId,
      systemId: inactiveCopy.systemId,
      label: inactiveCopy.label,
      payload: { ...inactiveCopy.payload, status: 'DRAFT' }
    })
    await owner.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'CREATURE',
      subjectId: inactiveCopy.subjectId,
      expectedDraftUpdatedAt: inactiveDraft.updatedAt!
    })
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', inactiveCopy.subjectId))
        .unique()
      if (!root) throw new Error('Missing inactive source root.')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      if (!version) throw new Error('Missing inactive source version.')
      const document = {
        ...creatureAuthoredDtoSchema.parse(await readPublishedDocument(ctx, root, version)),
        status: 'DRAFT'
      }
      const checksum = checksumRuleDocument(document)
      await deleteAuthoredVersion(ctx, version)
      const currentVersionId = await insertAuthoredVersion(
        ctx,
        {
          subjectKind: version.subjectKind,
          id: version.id,
          systemId: version.systemId,
          label: version.label,
          checksum,
          contentSourceId: version.contentSourceId,
          versionId: version.versionId,
          version: version.version,
          documentSchemaVersion: version.documentSchemaVersion
        },
        canonicalizeRuleDocument(document),
        version.compilation
      )
      await ctx.db.patch(root._id, { checksum, currentVersionId })
    })
    const cases = [
      {
        kind: 'COMPANION' as const,
        creatureId: crypto.randomUUID(),
        originKind: 'WORLD' as const
      },
      {
        kind: 'COMPANION' as const,
        creatureId: vehicle.id,
        originKind: 'WORLD' as const
      },
      { kind: 'VEHICLE' as const, vehicleId: creature.id },
      {
        kind: 'COMPANION' as const,
        creatureId: privateCopy.subjectId,
        originKind: 'WORLD' as const
      },
      {
        kind: 'COMPANION' as const,
        creatureId: inactiveCopy.subjectId,
        originKind: 'WORLD' as const
      }
    ]
    for (const extra of cases) {
      const before = await readState()
      await expect(
        owner.caller.mutation(execute, command(character.id, 1, { type: 'ADD_SHEET_EXTRA', extra }))
      ).rejects.toThrow('not available')
      expect(await readState()).toEqual(before)
    }
  })
})
