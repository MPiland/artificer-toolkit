import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  ExecuteDiceConfigurationInputDto,
  ExecuteRollInputDto,
  RollHistoryResponseDto,
  RollIdInputDto,
  RollRecordDto,
  RollResultDto
} from '@artificer-toolkit/schema/api/rolls'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { formatCharacterHitDiceRollExpression } from '@artificer-toolkit/shared/character'
import { readySheetFixture } from '../tests/fixtures/readyCharacter'

const execute = makeFunctionReference<'mutation', ExecuteRollInputDto, RollRecordDto>(
  'rolls:execute'
)
const configuration = makeFunctionReference<
  'mutation',
  ExecuteDiceConfigurationInputDto,
  RollResultDto
>('rolls:executeConfiguration')
const history = makeFunctionReference<'query', Record<string, never>, RollHistoryResponseDto>(
  'rolls:history'
)
const discard = makeFunctionReference<'mutation', RollIdInputDto, { ok: true }>('rolls:discard')
const clear = makeFunctionReference<'mutation', Record<string, never>, { ok: true }>(
  'rolls:clearHistory'
)
const getSheet = makeFunctionReference<
  'query',
  CharacterSheetReadInput,
  CharacterSheetResponseDto | null
>('characters/sheet:get')

describe('native private authoritative rolls', () => {
  it('uses cryptographic samples and rejects the biased upper interval', async () => {
    const { owner, character } = await readySheetFixture()
    const samples = [2 ** 32 - 1, 0, 4_294_967_279]
    let index = 0
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (!(array instanceof Uint32Array) || array.length !== 1)
        throw new Error('Expected a bounded roll sample.')
      const sample = samples[index++]
      if (sample === undefined) throw new Error('Unexpected extra random sample.')
      array[0] = sample
      return array
    })
    try {
      const rolled = await owner.caller.mutation(execute, {
        characterId: character.id,
        expression: '2d20',
        source: { kind: 'MANUAL', label: 'Manual roll' }
      })
      expect(rolled.evidence.terms[0]!.rolls).toEqual([1, 20])
      expect(rolled.evidence.total).toBe(21)
      expect(random).toHaveBeenCalledTimes(3)
    } finally {
      random.mockRestore()
    }
  })

  it('matches current Sheet roll surfaces and rejects forged or foreign requests without writes', async () => {
    const { t, owner, other, character, readState } = await readySheetFixture()
    const before = await readState()
    const sheet = (await owner.caller.query(getSheet, { id: character.id }))!
    const strength = sheet.overview.abilities.find((ability) => ability.ability === 'STRENGTH')!
    const expression =
      strength.modifier === 0
        ? '1d20'
        : `1d20 ${strength.modifier > 0 ? '+' : '-'} ${Math.abs(strength.modifier)}`
    const request: ExecuteRollInputDto = {
      characterId: character.id,
      expression,
      rollMode: strength.rollMode,
      source: { kind: 'ABILITY_CHECK', label: 'Strength check' }
    }
    const rolled = await owner.caller.mutation(execute, request)
    expect(rolled).toMatchObject({
      characterId: character.id,
      characterLabel: character.label,
      source: request.source
    })
    expect(rolled.ruleset.systemId).toBe(character.systemId)
    expect(rolled.evidence.total).toBe(rolled.evidence.terms[0]!.subtotal + strength.modifier)
    expect(await owner.caller.query(history, {})).toEqual([rolled])
    expect(await other.caller.query(history, {})).toEqual([])
    for (const forged of [
      { ...request, expression: '1d20 + 999' },
      { ...request, source: { kind: 'ABILITY_CHECK' as const, label: 'Invented check' } },
      { ...request, rollMode: 'DISADVANTAGE' as const },
      { ...request, expression: '41d20' }
    ])
      await expect(owner.caller.mutation(execute, forged)).rejects.toThrow()
    await expect(other.caller.mutation(execute, request)).rejects.toThrow('Character not found')
    await expect(t.mutation(execute, request)).rejects.toThrow()
    await expect(t.query(history, {})).rejects.toThrow()
    expect(await owner.caller.query(history, {})).toEqual([rolled])
    expect(await readState()).toEqual(before)
  })

  it('records manual and hit-die evidence while standalone configuration stays outside history', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    const before = await readState()
    const manual = await owner.caller.mutation(execute, {
      characterId: character.id,
      expression: '1d20 + 2',
      rollMode: 'ADVANTAGE',
      source: { kind: 'MANUAL', label: 'Client-provided label' }
    })
    expect(manual.source).toEqual({ kind: 'MANUAL', label: 'Manual roll' })
    expect(manual.evidence.mode).toBe('ADVANTAGE')
    expect(manual.evidence.total).toBe(Math.max(...manual.evidence.terms[0]!.rolls) + 2)
    const sheet = (await owner.caller.query(getSheet, { id: character.id }))!
    const pool = sheet.overview.hitDice[0]!
    const constitution = sheet.overview.abilities.find(
      (ability) => ability.ability === 'CONSTITUTION'
    )!
    const expression = formatCharacterHitDiceRollExpression([
      { die: pool.die, count: 1, modifierPerDie: constitution.modifier }
    ])
    const request: ExecuteRollInputDto = {
      characterId: character.id,
      expression,
      source: { kind: 'HIT_DIE', label: 'Short rest hit dice' }
    }
    const hitDie = await owner.caller.mutation(execute, request)
    expect(hitDie.normalizedExpression).toBe(expression)
    expect(hitDie.evidence.terms).toMatchObject([{ die: pool.die, count: 1 }])
    expect(hitDie.evidence.modifier).toBe(constitution.modifier)
    expect(hitDie.evidence.total).toBe(hitDie.evidence.terms[0]!.rolls[0]! + constitution.modifier)
    await expect(
      owner.caller.mutation(execute, {
        ...request,
        expression: `2d${pool.die} + ${constitution.modifier * 2}`
      })
    ).rejects.toThrow('not available')
    const previousHistory = await owner.caller.query(history, {})
    const standalone = await owner.caller.mutation(configuration, { configuration: '4d6dl1' })
    expect(standalone.evidence.terms[0]!.keptRollIndexes).toHaveLength(3)
    expect(standalone.evidence.total).toBe(
      [...standalone.evidence.terms[0]!.rolls]
        .sort((a, b) => b - a)
        .slice(0, 3)
        .reduce((total, die) => total + die, 0)
    )
    await expect(t.mutation(configuration, { configuration: '1d6' })).rejects.toThrow()
    expect(await owner.caller.query(history, {})).toEqual(previousHistory)
    expect(await readState()).toEqual(before)
  })

  it('retains twenty private records, protects consumed rolls from discard, and clears only the caller', async () => {
    const { t, owner, other, character } = await readySheetFixture()
    const request: ExecuteRollInputDto = {
      characterId: character.id,
      expression: '1d6',
      source: { kind: 'MANUAL', label: 'Manual roll' }
    }
    const template = await owner.caller.mutation(execute, request)
    const seeded = Array.from({ length: 19 }, (_, index) => ({
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date(Date.UTC(2020, 0, 1, 0, 0, index)).toISOString()
    }))
    const otherRoll = { ...template, id: crypto.randomUUID(), characterId: null }
    await t.run(async (ctx) => {
      for (const record of seeded)
        await ctx.db.insert('userRollHistory', { ...record, userId: owner.userId })
      await ctx.db.insert('userRollHistory', { ...otherRoll, userId: other.userId })
    })
    const newest = await owner.caller.mutation(execute, request)
    const retained = await owner.caller.query(history, {})
    expect(retained).toHaveLength(20)
    expect(retained.some((record) => record.id === seeded[0]!.id)).toBe(false)
    expect(retained.some((record) => record.id === newest.id)).toBe(true)
    expect(retained).toEqual(
      [...retained].sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
      )
    )
    expect(
      retained.every(
        (record) => !('userId' in record) && !('consumedAt' in record) && !('_id' in record)
      )
    ).toBe(true)
    await other.caller.mutation(discard, { id: newest.id })
    expect(await owner.caller.query(history, {})).toEqual(retained)
    await t.run(async (ctx) => {
      const record = await ctx.db
        .query('userRollHistory')
        .withIndex('by_userId_id', (q) => q.eq('userId', owner.userId).eq('id', newest.id))
        .unique()
      if (!record) throw new Error('Expected a retained roll.')
      await ctx.db.patch(record._id, { consumedAt: new Date().toISOString() })
    })
    await owner.caller.mutation(discard, { id: newest.id.toUpperCase() })
    expect(await owner.caller.query(history, {})).toEqual(retained)
    await owner.caller.mutation(discard, { id: template.id })
    expect(await owner.caller.query(history, {})).toHaveLength(19)
    await owner.caller.mutation(clear, {})
    expect(await owner.caller.query(history, {})).toEqual([])
    expect(await other.caller.query(history, {})).toEqual([otherRoll])
    expect(await t.run((ctx) => ctx.db.query('userRollHistory').collect())).toHaveLength(1)
  })

  it('rolls back insertion and retention trimming when the enclosing mutation fails', async () => {
    const { t, owner, character } = await readySheetFixture()
    const request: ExecuteRollInputDto = {
      characterId: character.id,
      expression: '1d6',
      source: { kind: 'MANUAL', label: 'Manual roll' }
    }
    const template = await owner.caller.mutation(execute, request)
    await t.run(async (ctx) => {
      for (let index = 0; index < 19; index++)
        await ctx.db.insert('userRollHistory', {
          ...template,
          id: crypto.randomUUID(),
          userId: owner.userId,
          createdAt: new Date(Date.UTC(2020, 0, 1, 0, 0, index)).toISOString()
        })
    })
    const before = await t.run((ctx) => ctx.db.query('userRollHistory').collect())
    await expect(
      owner.caller.run(async (ctx) => {
        await ctx.runMutation(execute, request)
        throw new Error('Injected enclosing transaction failure')
      })
    ).rejects.toThrow('Injected enclosing transaction failure')
    expect(await t.run((ctx) => ctx.db.query('userRollHistory').collect())).toEqual(before)
    const retried = await owner.caller.mutation(execute, request)
    expect((await owner.caller.query(history, {})).some((record) => record.id === retried.id)).toBe(
      true
    )
  })
})
