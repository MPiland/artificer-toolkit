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
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { api } from '../_generated/api'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { input } from '../../tests/fixtures/characters'
import * as builderContext from './builderContext'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readCharacterRecord } from './stateDocuments'

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

afterEach(() => vi.restoreAllMocks())

describe('native Character Sheet adjustment storage', () => {
  it('updates one semantic slot, preserves metadata, checks panel ownership, and resets only that panel', async () => {
    const { owner, character, readState } = await readySheetFixture()
    const before = await owner.caller.query(getSheet, { id: character.id })
    const adjustmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const first = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        adjustment: {
          id: adjustmentId,
          family: 'ABILITY',
          ability: 'STRENGTH',
          field: 'SCORE_OVERRIDE',
          value: 20,
          sourceNote: 'Personal override'
        }
      }
    })
    expect(first).not.toHaveProperty('sheet')
    const firstSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: first.characterId
    }))!
    expect(
      firstSheet.overview.abilities.find((ability) => ability.ability === 'STRENGTH')?.score
    ).toBe(20)
    const firstStored = await readState()
    const firstState = readCharacterSheetState(firstStored.character!)
    expect(firstState.adjustments).toHaveLength(1)
    expect(firstState.adjustments[0]).toMatchObject({
      id: adjustmentId,
      characterId: character.id,
      createdBy: owner.userId,
      updatedBy: owner.userId,
      createdAt: first.historyEntry!.occurredAt,
      updatedAt: first.historyEntry!.occurredAt,
      sourceNote: 'Personal override'
    })
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        adjustment: {
          id: crypto.randomUUID(),
          family: 'ABILITY',
          ability: 'STRENGTH',
          field: 'SCORE_OVERRIDE',
          value: 18
        }
      }
    })
    const updated = await readState()
    const state = readCharacterSheetState(updated.character!)
    expect(state.adjustments).toHaveLength(1)
    expect(state.adjustments[0]).toMatchObject({
      id: adjustmentId,
      value: 18,
      createdAt: firstState.adjustments[0]!.createdAt
    })
    expect(state.adjustments[0]!.updatedAt > firstState.adjustments[0]!.updatedAt).toBe(true)
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'REMOVE_SHEET_ADJUSTMENT',
          commandId: crypto.randomUUID(),
          expectedVersion: 3,
          adjustmentId,
          family: 'ABILITY',
          target: { kind: 'ABILITY', ability: 'DEXTERITY' }
        }
      })
    ).rejects.toThrow('unavailable')
    // UUID spelling cannot let a different slot reuse an existing identity.
    for (const duplicateId of [adjustmentId, adjustmentId.toUpperCase()]) {
      await expect(
        owner.caller.mutation(execute, {
          id: character.id,
          command: {
            type: 'UPSERT_SHEET_ADJUSTMENT',
            commandId: crypto.randomUUID(),
            expectedVersion: 3,
            adjustment: {
              id: duplicateId,
              family: 'ABILITY',
              ability: 'DEXTERITY',
              field: 'SCORE_OVERRIDE',
              value: 19
            }
          }
        })
      ).rejects.toThrow('unique identities')
    }
    expect(await readState()).toEqual(updated)
    const reset = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'RESET_SHEET_PANEL_ADJUSTMENTS',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        target: { kind: 'ABILITY', ability: 'STRENGTH' }
      }
    })
    expect(reset).not.toHaveProperty('sheet')
    const resetSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: reset.characterId
    }))!
    expect(resetSheet.overview.abilities).toEqual(before!.overview.abilities)
    expect(readCharacterSheetState((await readState()).character!).adjustments).toEqual([])
  })

  it('keeps Sheet overrides on the Character and leaves every authored source record unchanged', async () => {
    const { owner, character, readState, t } = await readySheetFixture()
    const authoredRecords = () =>
      t.run(async (ctx) => ({
        roots: await ctx.db.query('authoredRoots').collect(),
        versions: await ctx.db.query('authoredVersions').collect(),
        payloadChunks: await ctx.db.query('authoredVersionPayloadChunks').collect(),
        compilations: await ctx.db.query('authoredVersionCompilations').collect()
      }))
    const before = await authoredRecords()
    const sheet = (await owner.caller.query(getSheet, { id: character.id }))!
    const item = sheet.inventory.items[0]!
    const adjustments = [
      { family: 'ABILITY', ability: 'STRENGTH', field: 'SCORE_OVERRIDE', value: 20 },
      { family: 'ITEM', itemInstanceId: item.id, field: 'WEIGHT_OVERRIDE', value: 1 }
    ] as const
    for (const [index, adjustment] of adjustments.entries()) {
      await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'UPSERT_SHEET_ADJUSTMENT',
          commandId: crypto.randomUUID(),
          expectedVersion: index + 1,
          adjustment
        }
      })
    }
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: adjustments.length + 1,
        current: 20,
        temp: 0,
        maxOverride: 20
      }
    })

    const overridden = (await owner.caller.query(getSheet, { id: character.id }))!
    expect(
      overridden.overview.abilities.find((ability) => ability.ability === 'STRENGTH')?.score
    ).toBe(20)
    expect(overridden.overview.maxHitPointsOverride).toBe(20)
    expect(readCharacterSheetState((await readState()).character!).adjustments).toEqual(
      [...adjustments, { family: 'HIT_POINTS', field: 'MAXIMUM_OVERRIDE', value: 20 }].map(
        (adjustment) => expect.objectContaining(adjustment)
      )
    )
    expect(await authoredRecords()).toEqual(before)
  })

  it('persists HP clamps against prospective overrides and keeps override separate from the HP modifier panel', async () => {
    const { owner, character, readState } = await readySheetFixture()
    const overridden = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        current: 80,
        temp: 4,
        maxOverride: 20
      }
    })
    expect(overridden).not.toHaveProperty('sheet')
    const overriddenSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: overridden.characterId
    }))!
    expect(overriddenSheet.overview).toMatchObject({
      currentHitPoints: 20,
      maxHitPoints: 20,
      tempHitPoints: 4,
      maxHitPointsOverride: 20
    })
    const sourceLoads = vi.spyOn(builderContext, 'loadCharacterBuilderContext')
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: -100 }
      }
    })
    expect(sourceLoads).toHaveBeenCalledTimes(1)
    sourceLoads.mockClear()
    const reset = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'RESET_SHEET_PANEL_ADJUSTMENTS',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        target: { kind: 'HIT_POINTS' }
      }
    })
    expect(sourceLoads).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveProperty('sheet')
    const resetSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: reset.characterId
    }))!
    expect(resetSheet.overview).toMatchObject({
      currentHitPoints: 20,
      maxHitPoints: 20,
      maxHitPointsOverride: 20,
      maxHitPointsModifier: 0
    })
    const cleared = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        maxOverride: null
      }
    })
    expect(cleared).not.toHaveProperty('sheet')
    const clearedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: cleared.characterId
    }))!
    expect(clearedSheet.overview).toMatchObject({
      currentHitPoints: 11,
      maxHitPoints: 11,
      tempHitPoints: 4,
      maxHitPointsOverride: null
    })
    let stored = await readState()
    expect(readCharacterRecord(stored.character!).state.hitpoints.current).toBe(11)
    sourceLoads.mockClear()
    const reduced = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 5,
        adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: -100 }
      }
    })
    expect(sourceLoads).toHaveBeenCalledTimes(1)
    expect(reduced).not.toHaveProperty('sheet')
    const reducedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: reduced.characterId
    }))!
    expect(reducedSheet.overview).toMatchObject({ currentHitPoints: 0, maxHitPoints: 0 })
    stored = await readState()
    expect(readCharacterRecord(stored.character!).state.hitpoints.current).toBe(0)
    const adjustmentId = readCharacterSheetState(stored.character!).adjustments[0]!.id
    sourceLoads.mockClear()
    const removed = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'REMOVE_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 6,
        adjustmentId: adjustmentId.toUpperCase(),
        family: 'HIT_POINTS',
        target: { kind: 'HIT_POINTS' }
      }
    })
    expect(sourceLoads).toHaveBeenCalledTimes(1)
    expect(removed).not.toHaveProperty('sheet')
    const removedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: removed.characterId
    }))!
    expect(removedSheet.overview).toMatchObject({ currentHitPoints: 0, maxHitPoints: 11 })
  })

  it('stores a speed override as a length and refuses a bare number at the boundary', async () => {
    const { owner, character, readState } = await readySheetFixture()
    const fly = SRD_SPEEDS.find((speed) => speed.code === 'FLY')!
    const before = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'UPSERT_SHEET_ADJUSTMENT',
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          adjustment: {
            family: 'MOVEMENT',
            speedId: fly.id,
            field: 'SPEED_OVERRIDE',
            // @ts-expect-error A speed override is a length, never a bare number.
            value: 42
          }
        }
      })
    ).rejects.toThrow()
    expect(await readState()).toEqual(before)

    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        adjustment: {
          family: 'MOVEMENT',
          speedId: fly.id,
          field: 'SPEED_OVERRIDE',
          value: { amount: 12, unit: 'YARDS' }
        }
      }
    })
    expect(readCharacterSheetState((await readState()).character!).adjustments).toEqual([
      expect.objectContaining({
        family: 'MOVEMENT',
        speedId: fly.id,
        field: 'SPEED_OVERRIDE',
        value: { amount: 12, unit: 'YARDS' }
      })
    ])
  })

  it('hydrates current movement settings into policy and rejects foreign System targets', async () => {
    const { owner, character, readState } = await readySheetFixture()
    const fly = SRD_SPEEDS.find((speed) => speed.code === 'FLY')!
    const walk = SRD_SPEEDS.find((speed) => speed.code === 'WALK')!
    const spy = vi.spyOn(projection, 'projectCharacterSheetBundle')
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        adjustment: {
          family: 'MOVEMENT',
          speedId: fly.id,
          field: 'SPEED_OVERRIDE',
          value: { amount: 42, unit: 'FEET' }
        }
      }
    })
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_MOVEMENT_DISPLAY_PREFERENCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        preference: { mode: 'EXPLICIT', speedId: fly.id }
      }
    })
    expect(spy.mock.lastCall?.[0].ruleEvaluation.output.movement).toMatchObject({
      primaryMovementSpeedId: fly.id,
      speeds: expect.arrayContaining([expect.objectContaining({ speedId: fly.id, amount: 42 })])
    })
    const before = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'SET_MOVEMENT_DISPLAY_PREFERENCE',
          commandId: crypto.randomUUID(),
          expectedVersion: 3,
          preference: { mode: 'EXPLICIT', speedId: crypto.randomUUID() }
        }
      })
    ).rejects.toThrow('unavailable')
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'UPSERT_SHEET_ADJUSTMENT',
          commandId: crypto.randomUUID(),
          expectedVersion: 3,
          adjustment: {
            family: 'SKILL',
            skillId: crypto.randomUUID(),
            field: 'MISC_BONUS',
            value: 2
          }
        }
      })
    ).rejects.toThrow('not available')
    expect(await readState()).toEqual(before)
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_MOVEMENT_DISPLAY_PREFERENCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        preference: { mode: 'AUTO' }
      }
    })
    expect(spy.mock.lastCall?.[0].ruleEvaluation.output.movement.primaryMovementSpeedId).toBe(
      walk.id
    )
  })

  it('preserves Sheet records through a valid Builder commit and rejects corrupted ownership', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        adjustment: { family: 'ABILITY', ability: 'STRENGTH', field: 'SCORE_OVERRIDE', value: 20 }
      }
    })
    const before = await readState()
    const draft = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: character.id
    })
    await owner.caller.mutation(api.characters.commit.commit, {
      mode: 'edit',
      expectedDraftId: draft.id,
      character: { ...draft.payload.character, label: 'Renamed' }
    })
    const after = await readState()
    expect(after.character!.sheetState).toEqual(before.character!.sheetState)
    expect(
      (await owner.caller.query(getSheet, { id: character.id }))!.overview.abilities.find(
        (ability) => ability.ability === 'STRENGTH'
      )?.score
    ).toBe(20)
    const invalid = readCharacterSheetState(after.character!)
    invalid.adjustments[0]!.characterId = crypto.randomUUID()
    await t.run((ctx) =>
      writeCharacterRecord(ctx, after.character!, {
        document: readCharacterRecord(after.character!),
        sheetState: invalid
      })
    )
    const corrupted = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'SET_EXHAUSTION',
          commandId: crypto.randomUUID(),
          expectedVersion: after.character!.play.streamVersion,
          level: 1
        }
      })
    ).rejects.toThrow('ownership mismatch')
    expect(await readState()).toEqual(corrupted)
  })
})
