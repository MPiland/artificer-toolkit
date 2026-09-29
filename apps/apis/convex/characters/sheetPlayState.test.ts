import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { encodeCharacterRecord } from '@artificer-toolkit/schema/projections/characterStoredState'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord } from './stateDocuments'

const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')

describe('native Character play-state commands', () => {
  it('absorbs temporary HP, clamps healing, spends hit dice once and retains receipt replay', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    const stored = await readState()
    const before = readCharacterRecord(stored.character!)
    before.state.hitpoints.temp = 3
    const encoded = encodeCharacterRecord(stored.character!, {
      document: before,
      streamVersion: stored.character!.play.streamVersion,
      updatedAt: stored.character!.play.updatedAt
    })
    await t.run((ctx) =>
      ctx.db.patch(stored.character!.play._id, {
        playJson: encoded.play.playJson,
        checksum: encoded.play.checksum,
        updatedAt: encoded.play.updatedAt
      })
    )
    const damage = {
      type: 'ADJUST_HIT_POINTS' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 1,
      mode: 'DAMAGE' as const,
      amount: 5
    }
    const damaged = await owner.caller.mutation(execute, { id: character.id, command: damage })
    expect(damaged.sheet.overview).toMatchObject({
      currentHitPoints: 9,
      tempHitPoints: 0,
      maxHitPoints: 11
    })
    const healed = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        mode: 'HEAL',
        amount: 100
      }
    })
    expect(healed.sheet.overview.currentHitPoints).toBe(11)
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'USE_HIT_DIE',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        die: 10
      }
    })
    const spent = await readState()
    expect(readCharacterRecord(spent.character!).state.hitpoints.hitDice).toEqual([
      { die: 10, total: 1, used: 1 }
    ])
    for (const die of [10, 12]) {
      await expect(
        owner.caller.mutation(execute, {
          id: character.id,
          command: {
            type: 'USE_HIT_DIE',
            commandId: crypto.randomUUID(),
            expectedVersion: 4,
            die
          }
        })
      ).rejects.toThrow()
    }
    const replay = await owner.caller.mutation(execute, { id: character.id, command: damage })
    expect(replay.streamVersion).toBe(4)
    expect(replay.sheet.overview.currentHitPoints).toBe(11)
    expect(replay.historyEntry).toEqual(damaged.historyEntry)
    expect(await readState()).toEqual(spent)
  })

  it('tracks exhaustion and current System conditions, rejecting invalid targets without writes', async () => {
    const { owner, character, readState } = await readySheetFixture()
    const exhausted = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_EXHAUSTION',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        level: 1,
        notes: 'Long march'
      }
    })
    expect(exhausted.sheet.overview.exhaustion).toMatchObject({ level: 1, notes: 'Long march' })
    const before = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'SET_EXHAUSTION',
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          level: exhausted.sheet.overview.exhaustion.maximumLevel + 1
        }
      })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'ADD_CONDITION',
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          conditionTypeId: crypto.randomUUID()
        }
      })
    ).rejects.toThrow()
    expect(await readState()).toEqual(before)
    const condition = exhausted.sheet.reference.conditionOptions.find(
      (option) => option.label === 'Blinded'
    )
    if (!condition) throw new Error('Missing current System Blinded condition')
    const added = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADD_CONDITION',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        conditionTypeId: condition.id,
        notes: 'Smoke'
      }
    })
    expect(added.sheet.overview.conditions).toContainEqual(
      expect.objectContaining({ conditionTypeId: condition.id, notes: 'Smoke' })
    )
    const removed = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'REMOVE_CONDITION',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        conditionTypeId: condition.id
      }
    })
    expect(
      removed.sheet.overview.conditions.some((entry) => entry.conditionTypeId === condition.id)
    ).toBe(false)
    const recovered = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_EXHAUSTION',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        level: 0
      }
    })
    expect(recovered.sheet.overview.exhaustion.level).toBe(0)
    const after = await readState()
    expect(readCharacterRecord(after.character!).intent).toEqual(
      readCharacterRecord(before.character!).intent
    )
    expect(after.receipts).toHaveLength(4)
    expect(after.character?.play.streamVersion).toBe(5)
  })
})
