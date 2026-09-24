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
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { api } from '../_generated/api'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { input } from '../../tests/fixtures/characters'
import * as builderContext from './builderContext'

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
    expect(
      first.sheet.overview.abilities.find((ability) => ability.ability === 'STRENGTH')?.score
    ).toBe(20)
    const firstStored = await readState()
    const firstState = characterSheetStateSchema.parse(
      JSON.parse(firstStored.character!.sheetState!.documentJson)
    )
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
    const state = characterSheetStateSchema.parse(
      JSON.parse(updated.character!.sheetState!.documentJson)
    )
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
    expect(reset.sheet.overview.abilities).toEqual(before!.overview.abilities)
    expect(
      characterSheetStateSchema.parse(
        JSON.parse((await readState()).character!.sheetState!.documentJson)
      ).adjustments
    ).toEqual([])
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
    expect(overridden.sheet.overview).toMatchObject({
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
    expect(reset.sheet.overview).toMatchObject({
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
    expect(cleared.sheet.overview).toMatchObject({
      currentHitPoints: 11,
      maxHitPoints: 11,
      tempHitPoints: 4,
      maxHitPointsOverride: null
    })
    let stored = await readState()
    expect(
      characterAuthoredDtoSchema.parse(JSON.parse(stored.character!.documentJson)).state.hitpoints
        .current
    ).toBe(11)
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
    expect(reduced.sheet.overview).toMatchObject({ currentHitPoints: 0, maxHitPoints: 0 })
    stored = await readState()
    expect(
      characterAuthoredDtoSchema.parse(JSON.parse(stored.character!.documentJson)).state.hitpoints
        .current
    ).toBe(0)
    const adjustmentId = characterSheetStateSchema.parse(
      JSON.parse(stored.character!.sheetState!.documentJson)
    ).adjustments[0]!.id
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
    expect(removed.sheet.overview).toMatchObject({ currentHitPoints: 0, maxHitPoints: 11 })
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
        adjustment: { family: 'MOVEMENT', speedId: fly.id, field: 'SPEED_OVERRIDE', value: 42 }
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
    const invalid = characterSheetStateSchema.parse(
      JSON.parse(after.character!.sheetState!.documentJson)
    )
    invalid.adjustments[0]!.characterId = crypto.randomUUID()
    await t.run((ctx) =>
      ctx.db.patch(after.character!._id, {
        sheetState: {
          documentJson: canonicalizeRuleDocument(invalid),
          checksum: checksumRuleDocument(invalid)
        }
      })
    )
    const corrupted = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'SET_INSPIRATION',
          commandId: crypto.randomUUID(),
          expectedVersion: 3,
          inspired: true
        }
      })
    ).rejects.toThrow('ownership mismatch')
    expect(await readState()).toEqual(corrupted)
  })
})
