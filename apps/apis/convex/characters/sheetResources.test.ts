import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { api } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const getSheet = makeFunctionReference<
  'query',
  CharacterSheetReadInput,
  CharacterSheetResponseDto | null
>('characters/sheet:get')

async function fixture() {
  const base = await readyCharacterFixture({
    resources: {
      id: crypto.randomUUID(),
      label: 'Focus',
      order: 0,
      availableAtLevel: 1,
      charges: {
        id: crypto.randomUUID(),
        resetKind: 'SHORT_REST' as const,
        limitKind: 'FIXED_AMOUNT' as const,
        scalingKind: 'NONE' as const,
        amount: 3
      }
    }
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const readState = () =>
    base.t.run(async (ctx) => ({
      character: await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique(),
      receipts: await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
        .collect()
    }))
  const sheet = await base.owner.caller.query(getSheet, { id: character.id })
  const resource = sheet!.resources.items.find((entry) => entry.label === 'Focus')!
  expect(resource).toMatchObject({ max: 3, remaining: 3, used: 0 })
  return { ...base, character, resource, readState }
}

afterEach(() => vi.restoreAllMocks())

describe('native Character Sheet resource usage', () => {
  it('shares owner/legacy commands, validates availability and recovery, and replays without consuming twice', async () => {
    const { owner, character, resource, readState } = await fixture()
    const before = await readState()
    const request: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'USE_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        resourceGrantId: resource.id,
        amount: 2
      }
    }
    const first = await owner.caller.mutation(execute, request)
    expect(first.sheet.resources.items.find((entry) => entry.id === resource.id)).toMatchObject({
      used: 2,
      remaining: 1
    })
    const after = await readState()
    const firstUsage = characterSheetStateSchema.parse(
      JSON.parse(after.character!.sheetState!.documentJson)
    ).resourceUsage[0]!
    expect(firstUsage).toMatchObject({
      used: 2,
      characterId: character.id,
      createdBy: owner.userId,
      updatedBy: owner.userId,
      createdAt: first.historyEntry!.occurredAt,
      updatedAt: first.historyEntry!.occurredAt
    })
    expect(JSON.parse(after.character!.documentJson)).toEqual(
      JSON.parse(before.character!.documentJson)
    )

    for (const command of [
      { type: 'USE_SHEET_RESOURCE', owner: resource.owner, amount: 2 },
      { type: 'USE_RESOURCE', resourceGrantId: resource.id, actionId: 'missing-action' },
      { type: 'RECOVER_SHEET_RESOURCE', owner: resource.owner, trigger: 'DAWN' },
      { type: 'RESTORE_RESOURCE', resourceGrantId: 'missing-resource' }
    ] as const) {
      await expect(
        owner.caller.mutation(execute, {
          id: character.id,
          command: {
            ...command,
            commandId: crypto.randomUUID(),
            expectedVersion: 2
          }
        })
      ).rejects.toThrow()
      expect(await readState()).toEqual(after)
    }

    const restored = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'RESTORE_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        resourceGrantId: resource.id
      }
    })
    expect(restored.sheet.resources.items.find((entry) => entry.id === resource.id)).toMatchObject({
      used: 1,
      remaining: 2
    })
    const restoredUsage = characterSheetStateSchema.parse(
      JSON.parse((await readState()).character!.sheetState!.documentJson)
    ).resourceUsage[0]!
    expect(restoredUsage).toMatchObject({
      id: firstUsage.id,
      createdAt: firstUsage.createdAt,
      updatedAt: restored.historyEntry!.occurredAt
    })
    expect(restoredUsage.updatedAt > firstUsage.updatedAt).toBe(true)
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'USE_SHEET_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        owner: resource.owner
      }
    })
    const beforeReplay = await readState()
    const replay = await owner.caller.mutation(execute, request)
    expect(replay.historyEntry).toEqual(first.historyEntry)
    expect(replay.streamVersion).toBe(4)
    expect(replay.sheet.resources.items.find((entry) => entry.id === resource.id)).toMatchObject({
      used: 2
    })
    expect(await readState()).toEqual(beforeReplay)

    const recovered = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'RECOVER_SHEET_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        owner: resource.owner,
        trigger: 'SHORT_REST'
      }
    })
    expect(recovered.sheet.resources.items.find((entry) => entry.id === resource.id)).toMatchObject(
      { used: 0, remaining: 3 }
    )
    expect(
      characterSheetStateSchema.parse(
        JSON.parse((await readState()).character!.sheetState!.documentJson)
      ).resourceUsage
    ).toEqual([])
  })

  it('retains raw usage above current capacity and rolls back a failed post-write projection', async () => {
    const { t, owner, character, resource, readState } = await fixture()
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'USE_SHEET_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        owner: resource.owner,
        amount: 3
      }
    })
    const stored = (await readState()).character!
    const state = characterSheetStateSchema.parse(JSON.parse(stored.sheetState!.documentJson))
    // Valid persisted usage can exceed the newly evaluated capacity after a source change.
    const overCapacity = {
      ...state,
      resourceUsage: state.resourceUsage.map((usage) => ({ ...usage, used: 5 }))
    }
    await t.run((ctx) =>
      ctx.db.patch(stored._id, {
        sheetState: {
          documentJson: canonicalizeRuleDocument(overCapacity),
          checksum: checksumRuleDocument(overCapacity)
        }
      })
    )
    const shrunk = await owner.caller.query(getSheet, { id: character.id })
    expect(shrunk!.resources.items.find((entry) => entry.id === resource.id)).toMatchObject({
      max: 3,
      used: 3,
      remaining: 0
    })
    const restored = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'RESTORE_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        resourceGrantId: resource.id
      }
    })
    expect(restored.sheet.resources.items.find((entry) => entry.id === resource.id)).toMatchObject({
      used: 3,
      remaining: 0
    })
    const beforeFailure = await readState()
    expect(
      characterSheetStateSchema.parse(JSON.parse(beforeFailure.character!.sheetState!.documentJson))
        .resourceUsage[0]!.used
    ).toBe(4)
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected resource projection failure')
      })
    const request: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'RESTORE_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        resourceGrantId: resource.id,
        all: true
      }
    }
    await expect(owner.caller.mutation(execute, request)).rejects.toThrow(
      'Injected resource projection failure'
    )
    expect(await readState()).toEqual(beforeFailure)
    vi.restoreAllMocks()
    const recovered = await owner.caller.mutation(execute, request)
    expect(recovered.sheet.resources.items.find((entry) => entry.id === resource.id)).toMatchObject(
      { used: 0, remaining: 3 }
    )
  })

  it('rejects stored resource rows belonging to another Character or sharing one owner', async () => {
    const { t, owner, character, resource, readState } = await fixture()
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'USE_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        resourceGrantId: resource.id
      }
    })
    const stored = await readState()
    const state = characterSheetStateSchema.parse(
      JSON.parse(stored.character!.sheetState!.documentJson)
    )
    const usage = state.resourceUsage[0]!
    for (const resourceUsage of [
      [{ ...usage, characterId: crypto.randomUUID() }],
      [usage, { ...usage, id: crypto.randomUUID() }]
    ]) {
      const invalid = { ...state, resourceUsage }
      await t.run((ctx) =>
        ctx.db.patch(stored.character!._id, {
          sheetState: {
            documentJson: canonicalizeRuleDocument(invalid),
            checksum: checksumRuleDocument(invalid)
          }
        })
      )
      const before = await readState()
      await expect(owner.caller.query(getSheet, { id: character.id })).rejects.toThrow(
        /ownership|unique/
      )
      await expect(
        owner.caller.mutation(execute, {
          id: character.id,
          command: {
            type: 'SET_INSPIRATION',
            commandId: crypto.randomUUID(),
            expectedVersion: 2,
            inspired: true
          }
        })
      ).rejects.toThrow(/ownership|unique/)
      expect(await readState()).toEqual(before)
    }
  })
})
