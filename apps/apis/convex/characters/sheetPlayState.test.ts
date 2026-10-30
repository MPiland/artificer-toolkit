import { api } from '../_generated/api'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { encodeCharacterRecord } from '@artificer-toolkit/schema/projections/characterStoredState'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
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
        state: encoded.play.state,
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
    expect(damaged).not.toHaveProperty('sheet')
    const damagedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: damaged.characterId
    }))!
    expect(damagedSheet.overview).toMatchObject({
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
    expect(healed).not.toHaveProperty('sheet')
    const healedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: healed.characterId
    }))!
    expect(healedSheet.overview.currentHitPoints).toBe(11)
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
    expect(replay).not.toHaveProperty('sheet')
    const replaySheet = (await owner.caller.query(api.characters.sheet.get, {
      id: replay.characterId
    }))!
    expect(replay.streamVersion).toBe(4)
    expect(replaySheet.overview.currentHitPoints).toBe(11)
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
    expect(exhausted).not.toHaveProperty('sheet')
    const exhaustedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: exhausted.characterId
    }))!
    expect(exhaustedSheet.overview.exhaustion).toMatchObject({ level: 1, notes: 'Long march' })
    const before = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'SET_EXHAUSTION',
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          level: exhaustedSheet.overview.exhaustion.maximumLevel + 1
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
    const condition = exhaustedSheet.reference.conditionOptions.find(
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
    expect(added).not.toHaveProperty('sheet')
    const addedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: added.characterId
    }))!
    expect(addedSheet.overview.conditions).toContainEqual(
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
    expect(removed).not.toHaveProperty('sheet')
    const removedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: removed.characterId
    }))!
    expect(
      removedSheet.overview.conditions.some((entry) => entry.conditionTypeId === condition.id)
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
    expect(recovered).not.toHaveProperty('sheet')
    const recoveredSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: recovered.characterId
    }))!
    expect(recoveredSheet.overview.exhaustion.level).toBe(0)
    const after = await readState()
    expect(readCharacterRecord(after.character!).intent).toEqual(
      readCharacterRecord(before.character!).intent
    )
    expect(after.receipts).toHaveLength(4)
    expect(after.character?.play.streamVersion).toBe(5)
  })

  it('dies at once on reaching the authored Exhaustion level, and an HP edit is the correction (SPELLS-10.T1c)', async () => {
    const { owner, character } = await readySheetFixture()
    const run = (command: CharacterSheetExecuteInput['command']) =>
      owner.caller.mutation(execute, { id: character.id, command })
    const overview = async () =>
      (await owner.caller.query(api.characters.sheet.get, { id: character.id }))!.overview
    const setLevel = (level: number, expectedVersion: number) =>
      run({ type: 'SET_EXHAUSTION', commandId: crypto.randomUUID(), expectedVersion, level })

    const { currentHitPoints: standing, maxHitPoints } = await overview()
    // Exhaustion 4 and up halves the maximum (SPELLS-10.T1b), so hit points stand at the halved maximum.
    const halved = Math.min(standing, Math.floor(maxHitPoints / 2))
    await setLevel(5, 1)
    expect(await overview()).toMatchObject({
      currentHitPoints: halved,
      deathSaves: NO_DEATH_SAVES
    })

    await setLevel(6, 2)
    expect(await overview()).toMatchObject({
      currentHitPoints: 0,
      deathSaves: { successes: 0, failures: 3, stable: false }
    })

    // Lowering the level changes nothing by itself; the D96 HP edit is what revives.
    await setLevel(5, 3)
    expect((await overview()).currentHitPoints).toBe(0)
    await run({
      type: 'SET_HIT_POINTS',
      commandId: crypto.randomUUID(),
      expectedVersion: 4,
      current: halved
    })
    expect(await overview()).toMatchObject({
      currentHitPoints: halved,
      deathSaves: NO_DEATH_SAVES,
      exhaustion: { level: 5 }
    })
  })
})
