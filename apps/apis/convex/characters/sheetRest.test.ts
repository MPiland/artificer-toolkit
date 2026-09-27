import { createHash } from 'node:crypto'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import {
  characterSheetCommandInputDtoSchema,
  type CharacterRestPreviewInput,
  type CharacterRestPreviewRequestDto,
  type CharacterRestPreviewResponseDto,
  type CharacterSheetCommandResponseDto,
  type CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { ExecuteRollInputDto, RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { formatCharacterHitDiceRollExpression } from '@artificer-toolkit/shared/character'
import {
  buildCharacterRestPreview,
  sortFingerprintValue
} from '@artificer-toolkit/rules-runtime/character/sheetRest'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import * as evaluation from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { loadCharacterSheet } from './sheetPreparation'
import { createActiveRuleEffectStore } from '../rules/effectStore'

const preview = makeFunctionReference<
  'query',
  CharacterRestPreviewInput,
  CharacterRestPreviewResponseDto
>('characters/rest:preview')
const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const roll = makeFunctionReference<'mutation', ExecuteRollInputDto, RollRecordDto>('rolls:execute')
const clearRolls = makeFunctionReference<'mutation', Record<string, never>, { ok: true }>(
  'rolls:clearHistory'
)
const getSheet = makeFunctionReference<
  'query',
  CharacterSheetReadInput,
  CharacterSheetResponseDto | null
>('characters/sheet:get')

function request(
  restKind: 'SHORT' | 'LONG',
  expectedVersion: number
): CharacterRestPreviewRequestDto {
  return {
    restKind,
    expectedVersion,
    selectedHitDice: [],
    resetMaximumHitPointModifier: false,
    healingMode: 'AUTOMATIC',
    manualHealingAccepted: false,
    selectedCompanionInstanceIds: [],
    requestRoll: false
  }
}

function completion(input: CharacterRestPreviewInput, projected: CharacterRestPreviewResponseDto) {
  const command = characterSheetCommandInputDtoSchema.parse({
    ...input.input,
    type: 'COMPLETE_REST',
    commandId: crypto.randomUUID(),
    previewFingerprint: projected.previewFingerprint
  })
  if (command.type !== 'COMPLETE_REST') throw new Error('Expected a complete-rest command.')
  return { id: input.id, command }
}

type StateContribution = Extract<
  ActiveRuleEffectDefinitionDto,
  { schemaVersion: 2 }
>['stateContributions'][number]

function scalarReduction(recoveryTriggers: Array<'SHORT_REST' | 'LONG_REST'>): StateContribution {
  return {
    kind: 'SCALAR_REDUCTION',
    valueDefinitionId: '00000000-0000-4000-8000-000000000106',
    amount: 1,
    stacking: 'ADDITIVE',
    floor: 0,
    recoveryTriggers,
    terminalConsequence: 'TARGET_DIED',
    sourceOutcomeId: '00000000-0000-4000-8000-000000000107',
    sourceNodeId: 'entry',
    sourceOperationKey: 'comparison'
  }
}

function hitPointMaximumReduction(
  recoveryTags: Array<'RESTORE_HIT_POINT_MAXIMUM' | 'LONG_REST'>
): StateContribution {
  return {
    kind: 'HIT_POINT_MAXIMUM_REDUCTION',
    amount: 3,
    sourceDamageOutcomeId: '00000000-0000-4000-8000-000000000108',
    sourceDamageNodeId: 'entry',
    sourceDamageOperationKey: 'comparison',
    recoveryTags
  }
}

function reductionDefinition(
  characterId: string,
  contribution: StateContribution
): ActiveRuleEffectDefinitionDto {
  const definitionId = '00000000-0000-4000-8000-000000000101'
  const entryId = '00000000-0000-4000-8000-000000000102'
  const sourceOccurrenceId = '00000000-0000-4000-8000-000000000103'
  const rootCommandId = '00000000-0000-4000-8000-000000000104'
  return {
    schemaVersion: 2,
    origin: {
      kind: 'CHARACTER',
      sourceAggregateId: characterId,
      sourceOccurrenceId,
      rootCommandId
    },
    authoredEffectId: definitionId,
    compiledEntryId: entryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId: '00000000-0000-4000-8000-000000000105',
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: 'OWNER',
      expiration: { kind: 'INDEFINITE' }
    },
    stateContributions: [contribution]
  }
}

describe('native Character rest preview and completion', () => {
  it('keeps previews read-only and preserves legacy fingerprint bytes without native revision pins', async () => {
    const { t, owner, other, character, readState } = await readySheetFixture()
    const before = await readState()
    for (const restKind of ['SHORT', 'LONG'] as const) {
      const input = request(restKind, 1)
      const current = await owner.caller.query(preview, { id: character.id, input })
      expect(current.canApply).toBe(false)
      const proof = await t.run(async (ctx) => {
        const loaded = await loadCharacterSheet(ctx, owner.userId, character.id)
        if (!loaded) throw new Error('Missing current Sheet.')
        const restPolicy = loaded.ruleEvaluation.output.rest
        const legacy = await buildCharacterRestPreview({
          character: loaded.character,
          resolution: loaded.resolution,
          restPolicy,
          effectiveMaximum: loaded.sheet.overview.maxHitPoints,
          ruleRevisionId: 'transitional-revision',
          sheet: loaded.sheet,
          input
        })
        const fingerprintInput = {
          restKind,
          streamVersion: 1,
          rulesPolicy: {
            rest: restPolicy,
            longRest:
              restKind === 'LONG'
                ? {
                    exhaustionAfter: restPolicy.exhaustionAfterLongRest,
                    hitDiceRecoveryCount: restPolicy.hitDiceRecoveredAfterLongRest,
                    recoveredHitDice: []
                  }
                : undefined
          },
          hitPoints: {
            current: loaded.sheet.overview.currentHitPoints,
            maximum: loaded.sheet.overview.maxHitPoints,
            temporary: 0,
            maximumModifier: 0
          },
          selectedHitDice: [],
          resetMaximumHitPointModifier: false,
          healingMode: 'AUTOMATIC',
          manualHealingAccepted: false,
          selectedCompanionInstanceIds: [],
          rollEvidence: undefined,
          automaticRecoveries: { resources: [], spellSlots: [] },
          eligibleCompanions: []
        }
        const nativeHash = createHash('sha256')
          .update(JSON.stringify(sortFingerprintValue(fingerprintInput)))
          .digest('hex')
        const legacyHash = createHash('sha256')
          .update(
            JSON.stringify(
              sortFingerprintValue({
                ...fingerprintInput,
                rulesPolicy: {
                  ...fingerprintInput.rulesPolicy,
                  revisionId: 'transitional-revision'
                }
              })
            )
          )
          .digest('hex')
        return { legacyFingerprint: legacy.previewFingerprint, legacyHash, nativeHash }
      })
      expect(proof.legacyFingerprint).toBe(proof.legacyHash)
      expect(current.previewFingerprint).toBe(proof.nativeHash)
      await expect(
        owner.caller.mutation(execute, completion({ id: character.id, input }, current))
      ).rejects.toThrow('no completed recovery')
    }
    await expect(
      other.caller.query(preview, { id: character.id, input: request('LONG', 1) })
    ).rejects.toThrow('unavailable')
    await expect(
      t.query(preview, { id: character.id, input: request('LONG', 1) })
    ).rejects.toThrow()
    await expect(
      owner.caller.query(preview, { id: character.id, input: request('LONG', 0) })
    ).rejects.toThrow('changed')
    expect(await readState()).toEqual(before)
    expect(await t.run((ctx) => ctx.db.query('userRollHistory').collect())).toEqual([])
  })

  it('consumes exact hit-die evidence with HP/state/receipt atomically and replays after history clearing', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    const originalIntent = characterAuthoredDtoSchema.parse(
      JSON.parse((await readState()).character!.documentJson)
    ).intent
    const damaged = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 6,
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    })
    const effectIds = {
      matching: '00000000-0000-4000-8000-000000000111',
      preserved: '00000000-0000-4000-8000-000000000112',
      preservedMaximum: '00000000-0000-4000-8000-000000000113'
    }
    await t.run(async (ctx) => {
      const store = createActiveRuleEffectStore(ctx)
      await store.create({
        id: effectIds.matching,
        owner: { kind: 'CHARACTER', characterId: character.id },
        definition: reductionDefinition(character.id, scalarReduction(['SHORT_REST'])),
        lifecycle: { schemaVersion: 1, remainingTicks: null }
      })
      await store.create({
        id: effectIds.preserved,
        owner: { kind: 'CHARACTER', characterId: character.id },
        definition: reductionDefinition(character.id, scalarReduction(['LONG_REST'])),
        lifecycle: { schemaVersion: 1, remainingTicks: null }
      })
      // A short rest leaves a Life Drain's long-rest maximum reduction in place.
      await store.create({
        id: effectIds.preservedMaximum,
        owner: { kind: 'CHARACTER', characterId: character.id },
        definition: reductionDefinition(
          character.id,
          hitPointMaximumReduction(['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST'])
        ),
        lifecycle: { schemaVersion: 1, remainingTicks: null }
      })
    })
    const pool = damaged.sheet.overview.hitDice[0]!
    const constitution = damaged.sheet.overview.abilities.find(
      (ability) => ability.ability === 'CONSTITUTION'
    )!
    const rolled = await owner.caller.mutation(roll, {
      characterId: character.id,
      expression: formatCharacterHitDiceRollExpression([
        { die: pool.die, count: 1, modifierPerDie: constitution.modifier }
      ]),
      source: { kind: 'HIT_DIE', label: 'Short rest hit dice' }
    })
    const input: CharacterRestPreviewInput = {
      id: character.id,
      input: {
        ...request('SHORT', 2),
        selectedHitDice: [{ die: pool.die, count: 1 }],
        rollId: rolled.id,
        rollEvidence: {
          expression: rolled.normalizedExpression,
          total: rolled.evidence.total,
          terms: rolled.evidence.terms.map((term) => ({
            die: term.die,
            count: term.count,
            rolls: term.rolls,
            modifierPerDie: constitution.modifier
          }))
        }
      }
    }
    const beforePreview = await readState()
    const projected = await owner.caller.query(preview, input)
    expect(projected.canApply).toBe(true)
    expect(await readState()).toEqual(beforePreview)
    const manualInput: CharacterRestPreviewInput = {
      ...input,
      input: { ...input.input, healingMode: 'MANUAL' }
    }
    const manual = await owner.caller.query(preview, manualInput)
    expect(manual.canApply).toBe(false)
    await expect(owner.caller.mutation(execute, completion(manualInput, manual))).rejects.toThrow(
      'no completed recovery'
    )
    await expect(
      owner.caller.query(preview, {
        ...input,
        input: { ...input.input, rollId: crypto.randomUUID() }
      })
    ).rejects.toThrow('authoritative roll')
    const evidence = input.input.rollEvidence!
    const delta = evidence.terms[0]!.rolls[0] === pool.die ? -1 : 1
    await expect(
      owner.caller.query(preview, {
        ...input,
        input: {
          ...input.input,
          rollEvidence: {
            ...evidence,
            total: evidence.total + delta,
            terms: evidence.terms.map((term, index) =>
              index === 0
                ? {
                    ...term,
                    rolls: term.rolls.map((value, rollIndex) =>
                      rollIndex === 0 ? value + delta : value
                    )
                  }
                : term
            )
          }
        }
      })
    ).rejects.toThrow('authoritative roll')
    const command = completion(input, projected)
    const beforeComplete = {
      state: await readState(),
      rolls: await t.run((ctx) => ctx.db.query('userRollHistory').collect()),
      effects: await t.run((ctx) =>
        createActiveRuleEffectStore(ctx).list({ kind: 'CHARACTER', characterId: character.id })
      )
    }
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected rest projection failure')
      })
    await expect(owner.caller.mutation(execute, command)).rejects.toThrow(
      'Injected rest projection failure'
    )
    expect({
      state: await readState(),
      rolls: await t.run((ctx) => ctx.db.query('userRollHistory').collect()),
      effects: await t.run((ctx) =>
        createActiveRuleEffectStore(ctx).list({ kind: 'CHARACTER', characterId: character.id })
      )
    }).toEqual(beforeComplete)
    vi.restoreAllMocks()
    const completed = await owner.caller.mutation(execute, command)
    expect(
      await t.run((ctx) =>
        createActiveRuleEffectStore(ctx).list({ kind: 'CHARACTER', characterId: character.id })
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: effectIds.preserved }),
        expect.objectContaining({ id: effectIds.preservedMaximum })
      ])
    )
    expect(
      await t.run((ctx) =>
        createActiveRuleEffectStore(ctx).list({ kind: 'CHARACTER', characterId: character.id })
      )
    ).toHaveLength(2)
    expect(completed.streamVersion).toBe(3)
    expect(completed.sheet.overview.hitDice.find((die) => die.die === pool.die)?.used).toBe(1)
    // Healing stops at the maximum the preserved Life Drain reduction still lowers.
    expect(completed.sheet.overview.maxHitPoints).toBe(damaged.sheet.overview.maxHitPoints - 3)
    expect(completed.sheet.overview.currentHitPoints).toBe(
      Math.min(
        damaged.sheet.overview.maxHitPoints - 3,
        damaged.sheet.overview.currentHitPoints + rolled.evidence.total
      )
    )
    expect(completed.result).toMatchObject({
      type: 'COMPLETE_REST',
      rest: { rollEvidence: input.input.rollEvidence, spentHitDice: [{ die: pool.die, count: 1 }] }
    })
    expect(completed.historyEntry?.result).toEqual(completed.result)
    expect((await t.run((ctx) => ctx.db.query('userRollHistory').collect()))[0]?.consumedAt).toBe(
      completed.historyEntry!.occurredAt
    )
    const stored = await readState()
    expect(
      characterAuthoredDtoSchema.parse(JSON.parse(stored.character!.documentJson)).intent
    ).toEqual(originalIntent)
    await expect(
      owner.caller.query(preview, { ...input, input: { ...input.input, expectedVersion: 3 } })
    ).rejects.toThrow('authoritative roll')
    await expect(
      owner.caller.mutation(execute, {
        ...command,
        command: { ...command.command, manualHealingAccepted: true }
      })
    ).rejects.toThrow('replay does not match')
    const noted = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'CREATE_NOTE',
        title: 'After resting',
        body: 'Ready',
        groupId: 'session-notes',
        commandId: crypto.randomUUID(),
        expectedVersion: 3
      }
    })
    await owner.caller.mutation(clearRolls, {})
    const beforeReplay = await readState()
    const replay = await owner.caller.mutation(execute, command)
    expect(replay.sheet).toEqual(noted.sheet)
    expect(replay.result).toEqual(completed.result)
    expect(replay.historyEntry).toEqual(completed.historyEntry)
    expect(await readState()).toEqual(beforeReplay)
    expect(await t.run((ctx) => ctx.db.query('userRollHistory').collect())).toEqual([])
  })

  it('resets only the requested HP modifier and rejects changed current policy fingerprints', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    const originalSheet = (await owner.caller.query(getSheet, { id: character.id }))!
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 5 },
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    })
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_HIT_POINTS',
        current: 3,
        temp: 4,
        commandId: crypto.randomUUID(),
        expectedVersion: 2
      }
    })
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_EXHAUSTION',
        level: 2,
        notes: 'Fatigued',
        commandId: crypto.randomUUID(),
        expectedVersion: 3
      }
    })
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'USE_HIT_DIE',
        die: originalSheet.overview.hitDice[0]!.die,
        commandId: crypto.randomUUID(),
        expectedVersion: 4
      }
    })
    const input: CharacterRestPreviewInput = {
      id: character.id,
      input: { ...request('LONG', 5), resetMaximumHitPointModifier: true }
    }
    const longEffectId = '00000000-0000-4000-8000-000000000121'
    const longMaximumEffectId = '00000000-0000-4000-8000-000000000122'
    const restorationOnlyEffectId = '00000000-0000-4000-8000-000000000123'
    await t.run(async (ctx) => {
      const store = createActiveRuleEffectStore(ctx)
      await store.create({
        id: longEffectId,
        owner: { kind: 'CHARACTER', characterId: character.id },
        definition: reductionDefinition(character.id, scalarReduction(['LONG_REST'])),
        lifecycle: { schemaVersion: 1, remainingTicks: null }
      })
      // A long rest ends a Life Drain reduction (D62) but not one only magic restores (Clay Golem).
      await store.create({
        id: longMaximumEffectId,
        owner: { kind: 'CHARACTER', characterId: character.id },
        definition: reductionDefinition(
          character.id,
          hitPointMaximumReduction(['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST'])
        ),
        lifecycle: { schemaVersion: 1, remainingTicks: null }
      })
      await store.create({
        id: restorationOnlyEffectId,
        owner: { kind: 'CHARACTER', characterId: character.id },
        definition: reductionDefinition(
          character.id,
          hitPointMaximumReduction(['RESTORE_HIT_POINT_MAXIMUM'])
        ),
        lifecycle: { schemaVersion: 1, remainingTicks: null }
      })
    })
    const before = await readState()
    const ordinary = await owner.caller.query(preview, {
      ...input,
      input: { ...input.input, resetMaximumHitPointModifier: false }
    })
    const projected = await owner.caller.query(preview, input)
    // Only the restoration-only reduction outlasts the long rest.
    expect(ordinary.hitPoints.maximum).toBe(originalSheet.overview.maxHitPoints + 5 - 3)
    expect(projected.hitPoints.maximum).toBe(originalSheet.overview.maxHitPoints - 3)
    expect(projected.hitPoints.canResetMaximumHitPointModifier).toBe(true)
    expect(await readState()).toEqual(before)
    const command = completion(input, projected)
    const original = evaluation.evaluateCharacterRules
    vi.spyOn(evaluation, 'evaluateCharacterRules').mockImplementation((facts) => {
      const current = original(facts)
      return {
        ...current,
        output: { ...current.output, rest: { ...current.output.rest, exhaustionAfterLongRest: 0 } }
      }
    })
    await expect(owner.caller.mutation(execute, command)).rejects.toThrow('Rest preview changed')
    expect(await readState()).toEqual(before)
    expect(
      await t.run((ctx) =>
        createActiveRuleEffectStore(ctx).list({ kind: 'CHARACTER', characterId: character.id })
      )
    ).toHaveLength(3)
    vi.restoreAllMocks()
    const completed = await owner.caller.mutation(execute, command)
    expect(
      await t.run((ctx) =>
        createActiveRuleEffectStore(ctx).list({ kind: 'CHARACTER', characterId: character.id })
      )
    ).toEqual([expect.objectContaining({ id: restorationOnlyEffectId })])
    expect(completed.sheet.overview).toMatchObject({
      currentHitPoints: originalSheet.overview.maxHitPoints - 3,
      maxHitPoints: originalSheet.overview.maxHitPoints - 3,
      maxHitPointsReductions: [
        { id: restorationOnlyEffectId, amount: 3, recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'] }
      ],
      tempHitPoints: 0,
      exhaustion: { level: 1 }
    })
    expect(completed.sheet.overview.hitDice[0]!.used).toBe(0)
    if (completed.result?.type !== 'COMPLETE_REST')
      throw new Error('Missing completed rest result.')
    expect(completed.result.rest.resetMaximumHitPointModifier).toBe(true)
    const after = (await readState()).character!
    const state = characterSheetStateSchema.parse(JSON.parse(after.sheetState!.documentJson))
    expect(
      state.adjustments.some(
        (adjustment) =>
          adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_MODIFIER'
      )
    ).toBe(false)
    expect(
      characterAuthoredDtoSchema.parse(JSON.parse(after.documentJson)).state.exhaustion?.notes
    ).toBe('Fatigued')
  })
})
