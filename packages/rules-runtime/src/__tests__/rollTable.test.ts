import { describe, expect, it } from 'vitest'

import type { CreatureAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { divineWord } from '@artificer-toolkit/source-data/srd/spells/divine-word.js'
import { prismaticSpray } from '@artificer-toolkit/source-data/srd/spells/prismatic-spray.js'
import { viciousMockery } from '@artificer-toolkit/source-data/srd/spells/vicious-mockery.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { MAX_ACTIVE_EFFECT_TURNS } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import { prepareNativeActionEffectsPlan } from '../encounterActionEffects.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY } from '../systems/dnd5e/effectActionContracts.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { dnd5eRollTableRerollFaceOperation } from '../systems/dnd5e/effectActionOperationRegistry.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast } from '../testing/plannedTimedCondition.js'
import {
  prepareCreatureAction,
  settleCreatureAction,
  srdAbilityId
} from './encounterCreatureAction.js'

/**
 * ATTACK-16.T1a: an authored ROLL_TABLE path runs in its OUTCOME phase. The table die is rolled
 * there, each row's outcomes are gated on the roll, and only the rolled row applies. The table is
 * homebrew (parity with any authored table), cast on Divine Word's saving throw.
 */

const CHARISMA = SRD_ABILITIES.find(({ code }) => code === 'CHARISMA')!.id
const BLINDED = SRD_CONDITION_TYPES.find(({ code }) => code === 'BLINDED')!.id
const RESTRAINED = SRD_CONDITION_TYPES.find(({ code }) => code === 'RESTRAINED')!.id
const PETRIFIED = SRD_CONDITION_TYPES.find(({ code }) => code === 'PETRIFIED')!.id
const DEAFENED = SRD_CONDITION_TYPES.find(({ code }) => code === 'DEAFENED')!.id
const FIRE = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')!.id
const TARGET_ID = testUuid(0xa160)
/** Out of reach of any d20 total, so every target fails the save. */
const UNSAVEABLE_DC = 99

type SpellEffect = NonNullable<SpellAuthored['effects']>[number]
type TablePath = Extract<SpellEffect['paths'][number], { selectionKind: 'ROLL_TABLE' }>
type TableRow = TablePath['rows'][number]
type RowBlock = Extract<TableRow, { resolutionKind: 'RESULT' }>['resultBlock']
type RowOutcome = RowBlock['outcomes'][number]

function row(
  order: number,
  roll: number | [number, number],
  outcomes: RowOutcome[],
  block: Pick<RowBlock, 'duration'> = {}
): TableRow {
  return {
    id: testUuid(0xa100 + order),
    order,
    ...(typeof roll === 'number' ? { rollValue: roll } : { rollRange: roll }),
    resolutionKind: 'RESULT',
    resultBlock: {
      id: testUuid(0xa110 + order),
      resultKind: outcomes.length > 1 ? 'SEQUENCE' : 'SINGLE',
      outcomes,
      ...block
    }
  }
}

/** The row that rolls the table `count` more times on `face`, rerolling the `rerolled` faces. */
function repeatRow(face: number, count: number, rerolled: readonly number[]): TableRow {
  return {
    id: testUuid(0xa141),
    order: 9,
    rollRange: [face, face],
    resolutionKind: 'REPEAT_TABLE',
    repeat: {
      count,
      rerollValues: rerolled.map((value, index) => ({
        id: testUuid(0xa150 + index),
        order: index + 1,
        value
      }))
    }
  }
}

const blinded: RowOutcome = { id: testUuid(0xa121), effectKind: 'CONDITION', conditionId: BLINDED }
const deafened: RowOutcome = {
  id: testUuid(0xa122),
  effectKind: 'CONDITION',
  conditionId: DEAFENED
}
const fireDice: RowOutcome = {
  id: testUuid(0xa123),
  effectKind: 'DAMAGE',
  damageTypeId: FIRE,
  valueKind: 'DICE',
  scalingKind: 'NONE',
  diceConfig: '2d4'
}
const fixedFire: RowOutcome = {
  id: testUuid(0xa124),
  effectKind: 'DAMAGE',
  damageTypeId: FIRE,
  valueKind: 'FIXED',
  scalingKind: 'NONE',
  amount: 5
}

/** 1-2 blinded, 3-5 2d4 fire, 6 five fire and deafened. */
const RANGE_ROWS = [
  row(1, [1, 2], [blinded]),
  row(2, [3, 5], [fireDice]),
  row(3, [6, 6], [fixedFire, deafened])
]

function tablePath(
  path: Partial<
    Pick<TablePath, 'id' | 'order' | 'pathCode' | 'dieConfig' | 'rollTableKind' | 'rows'>
  > = {}
): TablePath {
  return {
    id: testUuid(0xa130),
    order: 1,
    pathCode: 'ON_SAVE_FAIL',
    groupType: 'SINGLE',
    originKind: 'SOURCE',
    selectionKind: 'ROLL_TABLE',
    rollTableKind: 'RANGE',
    dieConfig: '1d6',
    rows: RANGE_ROWS,
    ...path
  }
}

function tableSpell(
  path: Partial<Pick<TablePath, 'dieConfig' | 'rollTableKind' | 'rows'>> = {},
  otherPaths: readonly TablePath[] = []
): SpellAuthored {
  const [effect] = divineWord.effects!
  return {
    ...divineWord,
    id: testUuid(0xa131),
    label: 'Homebrew System Shock',
    effects: [{ ...effect!, paths: [tablePath(path), ...otherPaths] }]
  }
}

/** The table on a test-less self Effect's own ON_USE path: no attack, save or check rolls first. */
function selfTableSpell(path: Partial<Pick<TablePath, 'rows'>> = {}): SpellAuthored {
  const spell = tableSpell(path)
  const [effect] = spell.effects!
  const { savingThrow: _save, ...invocation } = effect!.invocation as Extract<
    SpellEffect['invocation'],
    { triggerCode: 'SAVING_THROW' }
  >
  return {
    ...spell,
    effects: [
      {
        ...effect!,
        invocation: {
          ...invocation,
          triggerCode: 'ACTIVATED',
          range: { id: testUuid(0xa132), rangeKind: 'SELF' },
          targeting: { selectionKind: 'SELF' }
        },
        paths: [tablePath({ ...path, pathCode: 'ON_USE' })]
      }
    ]
  }
}

function castPlan(spell: SpellAuthored) {
  return castCompilation(spell).executionPlan
}

function castCompilation(spell: SpellAuthored) {
  return compiledTestSpellCast({
    spell,
    cast: {
      sequence: 0,
      candidateId: `CLASS:class-${spell.id}:${spell.id}:level:7`,
      spellId: spell.id,
      source: { spellId: spell.id, sourceKind: 'CLASS', sourceInstanceId: `class-${spell.id}` },
      spellLevel: 7,
      castMode: 'SPELL_SLOT',
      castLevel: 7,
      baseEntry: true,
      resourceOwnerKey: null,
      slotPoolCode: null
    },
    decision: { status: 'AVAILABLE', reasonCode: 'SPELL_SLOT_REMAINING', slotKey: 'STANDARD:7' }
  }).entry.compilation
}

/** Compiles the spell's one Effect straight through the System adapter, for its refusals. */
function compileTable(spell: SpellAuthored) {
  const [effect] = spell.effects!
  const compiled = compileSpell({ ...spell, effects: [{ ...effect!, id: ACTION_EFFECT_ID }] })
  const action = {
    ...characterActionDescriptor(compiled.effects![0]!, 7),
    conditionDefinitionIds: SRD_CONDITION_TYPES.map(({ id }) => id)
  }
  return dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
}

/**
 * Casts the table at a target that fails the save (or makes it at DC 1), with the table die
 * landing on `tableRoll` and every damage die on `damageDie`.
 */
function cast(
  spell: SpellAuthored,
  {
    tableRoll,
    damageDie = 1,
    dc = UNSAVEABLE_DC,
    ability = CHARISMA,
    tableDie = 6,
    rerollMax = 0,
    rerolls = []
  }: {
    tableRoll: number
    damageDie?: number
    dc?: number | null
    ability?: string
    tableDie?: number
    /** The bound on a repeat's reroll index, and the 1-based indexes it lands on, in order. */
    rerollMax?: number
    rerolls?: readonly number[]
  }
) {
  const rolled: number[] = []
  const pendingRerolls = [...rerolls]
  return executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan: castPlan(spell),
    occurrenceId: testUuid(0xa161),
    binding: {
      actionMechanic: {
        attackBonus: null,
        attackKind: null,
        attackDomain: null,
        attackAbility: null,
        attackRollMode: 'NORMAL',
        save: dc === null ? null : { abilityDefinitionId: ability, dc },
        outcomes: []
      },
      sourceDerivedFacts: {},
      targetActorId: TARGET_ID,
      targetDerivedFacts: {
        statBlock: { armorClass: 12 },
        savingThrowDefinitions: [
          { abilityDefinitionId: ability, modifier: 0, rollMode: 'NORMAL', contributors: [] }
        ]
      },
      targetConditionIds: [],
      currentHitPoints: 60,
      temporaryHitPoints: 0,
      maximumHitPoints: 60,
      targetScalarValues: {},
      defenses: []
    },
    afterTest: async () => undefined,
    random: (maxExclusive) => {
      rolled.push(maxExclusive)
      if (maxExclusive === 20) return 9
      if (maxExclusive === rerollMax && pendingRerolls.length > 0)
        return pendingRerolls.shift()! - 1
      if (maxExclusive === tableDie) return tableRoll - 1
      return damageDie - 1
    }
  }).then((result) => ({ ...result, rolled }))
}

function traceOf(result: Awaited<ReturnType<typeof cast>>) {
  return result.execution.evidence.trace
}

describe('roll table outcomes (ATTACK-16.T1a)', () => {
  it.each([
    [1, [['CONDITION_APPLY', BLINDED]]],
    [2, [['CONDITION_APPLY', BLINDED]]],
    [3, [['DAMAGE', 6]]],
    [5, [['DAMAGE', 6]]],
    [
      6,
      [
        ['DAMAGE', 5],
        ['CONDITION_APPLY', DEAFENED]
      ]
    ]
  ])('applies only the row a failed save rolls %i on', async (tableRoll, expected) => {
    const result = await cast(tableSpell(), { tableRoll, damageDie: 3 })
    expect(
      result.applications.map((application) => [
        application.kind,
        application.kind === 'CONDITION_APPLY'
          ? application.conditionId
          : application.kind === 'DAMAGE'
            ? application.requestedAmount
            : null
      ])
    ).toEqual(expected)
  })

  it('settles a row with no outcomes as owing nothing', async () => {
    const spell = tableSpell({
      rows: [row(1, [1, 3], [blinded]), row(2, [4, 6], [])]
    })
    expect((await cast(spell, { tableRoll: 5 })).applications).toEqual([])
    const first = await cast(spell, { tableRoll: 2 })
    expect(first.applications).toMatchObject([{ kind: 'CONDITION_APPLY', conditionId: BLINDED }])
  })

  it('rolls the dice that adjacent rows share once, within the graph node bound', async () => {
    const types = SRD_DAMAGE_TYPES.slice(0, 4)
    const heavy = (face: number): RowOutcome => ({
      ...fireDice,
      id: testUuid(0xa170 + face),
      damageTypeId: types[face - 1]!.id,
      diceConfig: '10d8'
    })
    // Four rows of 10d8 would need ~76 nodes if each rolled its own dice (the bound is 64).
    const spell = tableSpell({
      rows: [
        row(1, [1, 1], [heavy(1)]),
        row(2, [2, 2], [heavy(2)]),
        row(3, [3, 3], [heavy(3)]),
        row(4, [4, 4], [heavy(4)]),
        row(5, [5, 6], [blinded])
      ]
    })
    const hit = await cast(spell, { tableRoll: 3, damageDie: 2 })
    expect(hit.applications).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 20, damageTypeId: types[2]!.id }
    ])
    expect(hit.rolled).toEqual([20, 6, ...Array<number>(10).fill(8)])
    const miss = await cast(spell, { tableRoll: 5, damageDie: 2 })
    expect(miss.applications).toMatchObject([{ kind: 'CONDITION_APPLY', conditionId: BLINDED }])
    expect(miss.rolled).toEqual([20, 6])
  })

  it('records the table die and every row gate in the OUTCOME trace', async () => {
    const result = await cast(tableSpell(), { tableRoll: 4, damageDie: 2 })
    const trace = traceOf(result)
    expect(trace.find(({ nodeId }) => nodeId === 'roll-table-die-1')).toMatchObject({
      evidence: { kind: 'INTEGER_RANGE', value: 4 },
      outputs: { value: 4 }
    })
    expect(
      trace
        .filter(({ operation }) => operation.key === 'dnd5e.roll-table-row-gate')
        .map(({ nodeId, outputs }) => [nodeId, outputs.authorized])
    ).toEqual([
      ['roll-table-row-1', false],
      ['roll-table-row-2', true],
      ['roll-table-row-3', false]
    ])
    expect(result.phaseReceipts?.map(({ phase }) => phase)).toEqual(['TEST', 'OUTCOME'])
    // The rolled row's own dice are the only damage dice asked for: two d4 for 2d4.
    expect(result.rolled).toEqual([20, 6, 4, 4])
    expect(result.applications).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 4, damageTypeId: FIRE }
    ])
  })

  it('rolls nothing when the save succeeds', async () => {
    const result = await cast(tableSpell(), { tableRoll: 1, dc: 1 })
    expect(result.applications).toEqual([])
    expect(result.rolled).toEqual([20])
  })

  it('selects an EXACT row by its one face', async () => {
    // Every face is its own row, each with its own outcome identity; only face 4 deafens.
    const spell = tableSpell({
      rollTableKind: 'EXACT',
      rows: [1, 2, 3, 4, 5, 6].map((face) =>
        row(face, face, [{ ...(face === 4 ? deafened : blinded), id: testUuid(0xa150 + face) }])
      )
    })
    const fourth = await cast(spell, { tableRoll: 4 })
    expect(fourth.applications).toMatchObject([{ kind: 'CONDITION_APPLY', conditionId: DEAFENED }])
  })

  it('compiles the table into a TEST and an OUTCOME template for the failed save', () => {
    const plan = compileTable(tableSpell())
    expect(plan?.kind).toBe('TEST_OUTCOME')
    expect(
      plan?.kind === 'TEST_OUTCOME' ? plan.outcomes.map(({ pathCode }) => pathCode) : []
    ).toEqual(['ON_SAVE_FAIL'])
  })

  it.each([
    [
      'a repeat that can roll its own face again',
      [row(1, [1, 5], [blinded]), repeatRow(6, 2, [1])],
      /reroll its own faces/
    ],
    [
      'a row that heals',
      [
        row(1, [1, 5], [blinded]),
        row(
          2,
          [6, 6],
          [
            {
              id: testUuid(0xa143),
              effectKind: 'HEAL',
              valueKind: 'DICE',
              scalingKind: 'NONE',
              diceConfig: '1d4'
            }
          ]
        )
      ],
      /roll table row outcome is not supported/
    ],
    [
      'a row lasting longer than its timed plan can count',
      [
        row(1, [1, 5], [blinded]),
        row(2, [6, 6], [deafened], {
          duration: { id: testUuid(0xa144), durationKind: 'DAY', amount: 2 }
        })
      ],
      /roll table row lasts/
    ]
  ])('refuses %s at compile', (_label, rows, message) => {
    expect(() => compileTable(tableSpell({ rows }))).toThrow(message)
  })

  it('refuses a die that is not one plain term', () => {
    expect(() =>
      compileTable(
        tableSpell({
          dieConfig: '1d6+1',
          rows: [row(1, [2, 7], [blinded])]
        })
      )
    ).toThrow(/roll table die/)
  })
})

const ONE_ROUND = { id: testUuid(0xa145), durationKind: 'ROUND', amount: 1 } as const
const mockeryGrant: RowOutcome = {
  ...viciousMockery
    .effects!.flatMap(({ paths }) => paths)
    .flatMap((path) => ('resultBlock' in path ? path.resultBlock.outcomes : []))
    .find(({ effectKind }) => effectKind === 'APPLY_GRANT')!,
  id: testUuid(0xa125)
}

/** 1-2 blinded for a round, 3-4 five fire, 5-6 the mockery's disadvantage for a round. */
const LASTING_ROWS = [
  row(1, [1, 2], [blinded], { duration: ONE_ROUND }),
  row(2, [3, 4], [fixedFire]),
  row(3, [5, 6], [mockeryGrant], { duration: ONE_ROUND })
]

// The authored spell with the rows its later tasks build emptied: they owe nothing yet.
function sprayWithRowsEmptiedFrom(firstEmptied: number): SpellAuthored {
  return sprayWithRowsEmptied((order) => order >= firstEmptied)
}

function sprayWithRowsEmptied(emptied: (order: number) => boolean): SpellAuthored {
  return {
    ...prismaticSpray,
    effects: prismaticSpray.effects!.map((effect) => ({
      ...effect,
      paths: effect.paths.map((path) =>
        path.selectionKind === 'ROLL_TABLE'
          ? {
              ...path,
              rows: path.rows.map((tableRow) =>
                emptied(tableRow.order)
                  ? {
                      id: tableRow.id,
                      order: tableRow.order,
                      rollValue: tableRow.order,
                      resolutionKind: 'RESULT' as const,
                      resultBlock: {
                        id: `${tableRow.id}__result`,
                        resultKind: 'SINGLE' as const,
                        outcomes: []
                      }
                    }
                  : tableRow
              )
            }
          : path
      )
    }))
  }
}

describe('a table of alike damage rows (SPELLS-4.T2ps-a)', () => {
  const DEXTERITY = SRD_ABILITIES.find(({ code }) => code === 'DEXTERITY')!.id
  const spray = sprayWithRowsEmptiedFrom(6)
  const sprayCast = (tableRoll: number, dc: number) =>
    cast(spray, { tableRoll, damageDie: 3, dc, ability: DEXTERITY, tableDie: 8 })

  it('rolls the ten dice of the rolled colour once, and only those', async () => {
    const result = await sprayCast(2, UNSAVEABLE_DC)
    expect(result.applications).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 30 }])
    expect(result.rolled).toEqual([20, 8, ...Array<number>(10).fill(6)])
  })

  it('halves the damage of a creature that saves, and owes nothing for an emptied row', async () => {
    const saved = await sprayCast(5, 1)
    expect(saved.applications).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 15 }])
    expect((await sprayCast(6, 1)).applications).toEqual([])
  })
})

describe('a table row that petrifies after three failed saves (SPELLS-4.T2ps-b)', () => {
  // Rows 7 and 8 are the later tasks'; row 6 is authored as it ships.
  it('plans row 6 on its own face as a restraint that repeats to a tally, with petrified at the end', () => {
    const spray = castCompilation(sprayWithRowsEmptiedFrom(7))
    const plan = (spray.rollTableRowPlans ?? []).find(({ rollTableRow }) => rollTableRow?.min === 6)
    expect(plan).toMatchObject({
      rollTableRow: { min: 6, max: 6 },
      initialRemaining: MAX_ACTIVE_EFFECT_TURNS,
      conditionContributions: [{ conditionId: RESTRAINED }],
      saveThresholds: { successesToEnd: 3, failuresToResolve: 3, consecutive: false },
      adapterFacts: { [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY]: PETRIFIED }
    })
  })

  it('restrains on a failed save for its plan to hold, and applies nothing on a made one', async () => {
    const DEXTERITY = SRD_ABILITIES.find(({ code }) => code === 'DEXTERITY')!.id
    const spray = sprayWithRowsEmptiedFrom(7)
    const sprayCast = (dc: number) =>
      cast(spray, { tableRoll: 6, damageDie: 3, dc, ability: DEXTERITY, tableDie: 8 })
    const failed = await sprayCast(UNSAVEABLE_DC)
    expect(failed.applications).toMatchObject([
      { kind: 'CONDITION_APPLY', conditionId: RESTRAINED }
    ])
    expect(failed.execution.outputs.rollTableRoll).toBe(6)
    const saved = await sprayCast(1)
    expect(saved.applications).toEqual([])
  })
})

describe('roll table rows that last (ATTACK-16.T1a2)', () => {
  const compilation = castCompilation(tableSpell({ rows: LASTING_ROWS }))
  const plans = compilation.rollTableRowPlans ?? []

  it('plans each lasting row on its own faces, with no plan that serves every roll', () => {
    expect(compilation.activeEffectPlan).toBeNull()
    expect(
      plans.map((plan) => [
        plan.rollTableRow,
        plan.compiledEntryId,
        plan.initialRemaining,
        plan.conditionContributions.map(({ conditionId }) => conditionId),
        plan.modifierGrantContribution != null
      ])
    ).toEqual([
      [{ min: 1, max: 2 }, LASTING_ROWS[0]!.id, 1, [BLINDED], false],
      [{ min: 5, max: 6 }, LASTING_ROWS[2]!.id, 1, [], true]
    ])
  })

  it('applies a timed row condition in the OUTCOME phase, for its plan to hold', async () => {
    const result = await cast(tableSpell({ rows: LASTING_ROWS }), { tableRoll: 2 })
    expect(result.applications).toMatchObject([{ kind: 'CONDITION_APPLY', conditionId: BLINDED }])
    expect(result.execution.outputs.rollTableRoll).toBe(2)
  })

  it('leaves a granting row to its plan: the OUTCOME phase applies nothing', async () => {
    const result = await cast(tableSpell({ rows: LASTING_ROWS }), { tableRoll: 6 })
    expect(result.applications).toEqual([])
    expect(result.execution.outputs.rollTableRoll).toBe(6)
  })

  it('refuses a lasting row when the action rolls a second table', () => {
    const success = tablePath({
      id: testUuid(0xa146),
      order: 2,
      pathCode: 'ON_SAVE_SUCCESS',
      rows: [
        row(11, [1, 3], [{ ...blinded, id: testUuid(0xa191) }]),
        row(12, [4, 6], [{ ...deafened, id: testUuid(0xa192) }])
      ]
    })
    expect(() => compileTable(tableSpell({ rows: LASTING_ROWS }, [success]))).toThrow(
      /roll table rows last only on an action with one table/
    )
  })
})

describe('a roll table on a test-less action (ATTACK-16.T1c2a)', () => {
  const use = (tableRoll: number, spell = selfTableSpell()) =>
    cast(spell, { tableRoll, damageDie: 3, dc: null })

  it('compiles the table into the one DIRECT graph', () => {
    expect(compileTable(selfTableSpell())?.kind).toBe('SINGLE_GRAPH')
  })

  it.each([
    [1, [['CONDITION_APPLY', BLINDED]]],
    [4, [['DAMAGE', 6]]],
    [
      6,
      [
        ['DAMAGE', 5],
        ['CONDITION_APPLY', DEAFENED]
      ]
    ]
  ])('applies only the row a use rolls %i on', async (tableRoll, expected) => {
    const result = await use(tableRoll)
    expect(
      result.applications.map((application) => [
        application.kind,
        application.kind === 'CONDITION_APPLY'
          ? application.conditionId
          : application.kind === 'DAMAGE'
            ? application.requestedAmount
            : null
      ])
    ).toEqual(expected)
  })

  it('rolls the table die and the rolled row dice, with no d20', async () => {
    const result = await use(3)
    expect(result.rolled).toEqual([6, 4, 4])
    expect(result.phaseReceipts ?? []).toEqual([])
    expect(traceOf(result).find(({ nodeId }) => nodeId === 'roll-table-die-1')).toMatchObject({
      evidence: { kind: 'INTEGER_RANGE', value: 3 }
    })
    expect(result.execution.outputs.rollTableRoll).toBe(3)
  })

  it('plans each lasting row of a direct table on its own faces', async () => {
    const spell = selfTableSpell({ rows: LASTING_ROWS })
    const compilation = castCompilation(spell)
    expect(compilation.activeEffectPlan).toBeNull()
    expect(
      (compilation.rollTableRowPlans ?? []).map((plan) => [plan.rollTableRow, plan.compiledEntryId])
    ).toEqual([
      [{ min: 1, max: 2 }, LASTING_ROWS[0]!.id],
      [{ min: 5, max: 6 }, LASTING_ROWS[2]!.id]
    ])
    const granted = await use(5, spell)
    expect(granted.applications).toEqual([])
    expect(granted.execution.outputs.rollTableRoll).toBe(5)
  })

  it('refuses a direct outcome beside the table on its path', () => {
    const spell = selfTableSpell()
    const [effect] = spell.effects!
    const [path] = effect!.paths
    const direct = {
      id: testUuid(0xa133),
      order: 2,
      pathCode: 'ON_USE',
      groupType: 'SINGLE',
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: testUuid(0xa134),
        resultKind: 'SINGLE',
        outcomes: [{ ...fixedFire, id: testUuid(0xa135) }]
      }
    } satisfies SpellEffect['paths'][number]
    expect(() =>
      compileTable({ ...spell, effects: [{ ...effect!, paths: [path!, direct] }] })
    ).toThrow(/roll table path must not mix direct outcomes/)
  })
})

describe('a roll table row that rolls the table again (SPELLS-4.T2ps-d1)', () => {
  const REPEAT_ROWS = [
    row(1, [1, 2], [blinded]),
    row(2, [3, 4], [fixedFire]),
    row(3, [5, 5], [deafened]),
    repeatRow(6, 2, [6])
  ]
  const repeatCast = (
    tableRoll: number,
    rerolls: readonly number[],
    options: { dc?: number } = {}
  ) => cast(tableSpell({ rows: REPEAT_ROWS }), { tableRoll, rerollMax: 5, rerolls, ...options })

  it('rolls the die and its rerolls in the TEST, then applies the rows they landed on', async () => {
    const result = await repeatCast(6, [1, 3])
    expect(result.applications).toMatchObject([
      { kind: 'CONDITION_APPLY', conditionId: BLINDED },
      { kind: 'DAMAGE', requestedAmount: 5 }
    ])
    expect(result.rolled).toEqual([20, 6, 5, 5])
    // The OUTCOME holds the rolled rows' gates alone: it rolls nothing itself.
    expect(traceOf(result).map(({ nodeId }) => nodeId)).toEqual(
      expect.arrayContaining(['roll-table-ray-1', 'roll-table-ray-2'])
    )
  })

  it('rolls no reroll when the die lands on a row of its own, and none when the save is made', async () => {
    const landed = await repeatCast(3, [1, 1])
    expect(landed.applications).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 5 }])
    expect(landed.rolled).toEqual([20, 6])
    const saved = await repeatCast(6, [1, 1], { dc: 1 })
    expect(saved.applications).toEqual([])
    expect(saved.rolled).toEqual([20])
  })

  it('rolls a reroll only among the faces it does not reroll', () => {
    const faces = [1, 2, 3, 4, 5].map(
      (index) => dnd5eRollTableRerollFaceOperation.execute({ index, faces: 6, excluded: '6' }).face
    )
    expect(faces).toEqual([1, 2, 3, 4, 5])
    expect(() =>
      dnd5eRollTableRerollFaceOperation.execute({ index: 6, faces: 6, excluded: '6' })
    ).toThrow()
  })

  it('refuses a repeat that can roll its own face again, and a test-less action with one', () => {
    expect(() =>
      compileTable(tableSpell({ rows: [row(1, [1, 5], [blinded]), repeatRow(6, 2, [1])] }))
    ).toThrow(/reroll its own faces/)
    expect(() => compileTable(selfTableSpell({ rows: REPEAT_ROWS }))).toThrow(/repeats need a test/)
  })

  describe('on Prismatic Spray', () => {
    const DEXTERITY = SRD_ABILITIES.find(({ code }) => code === 'DEXTERITY')!.id
    // Rows 6 and 7 are emptied: this block proves the rerolled rays alone.
    const spray = sprayWithRowsEmptied((order) => order === 6 || order === 7)
    const sprayCast = (dc: number) =>
      cast(spray, {
        tableRoll: 8,
        damageDie: 3,
        dc,
        ability: DEXTERITY,
        tableDie: 8,
        rerollMax: 7,
        rerolls: [1, 4]
      })
    const rolledDice = [20, 8, 7, 7, ...Array<number>(20).fill(6)]

    it('rolls the two extra rays in the TEST, within the graph node bound', async () => {
      const failed = await sprayCast(UNSAVEABLE_DC)
      expect(failed.applications).toMatchObject([
        { kind: 'DAMAGE', requestedAmount: 30 },
        { kind: 'DAMAGE', requestedAmount: 30 }
      ])
      expect(failed.rolled).toEqual(rolledDice)
    })

    it('halves each ray for a creature that saves', async () => {
      const saved = await sprayCast(1)
      expect(saved.applications).toMatchObject([
        { kind: 'DAMAGE', requestedAmount: 15 },
        { kind: 'DAMAGE', requestedAmount: 15 }
      ])
      expect(saved.rolled).toEqual(rolledDice)
    })
  })
})

describe('a target struck by two rows that last (SPELLS-4.T2ps-d2)', () => {
  const FEATURE_ID = testUuid(0xa1a0)
  const SOURCE_ID = testUuid(0xa1a1)
  const HOLDER_ID = testUuid(0xa1a2)
  const ROWS = [
    row(1, [1, 2], [blinded], { duration: ONE_ROUND }),
    row(2, [3, 4], [deafened], { duration: ONE_ROUND }),
    row(3, [5, 5], [fixedFire]),
    repeatRow(6, 2, [6])
  ]
  /** An ogre whose feature is the spell's one Effect, a Wisdom save or the spell's own. */
  function tableOgre(spell: SpellAuthored, save?: { baseDc: number }): CreatureAuthored {
    const ogre = srdByLabel(SRD.creatures, 'Ogre')
    const [effect] = spell.effects!
    return {
      ...ogre,
      features: [
        ...ogre.features,
        {
          id: FEATURE_ID,
          label: 'Prism Ray',
          description: 'Homebrew table feature.',
          order: 99,
          effects: [
            {
              ...effect!,
              invocation: save
                ? {
                    ...effect!.invocation,
                    savingThrow: {
                      id: testUuid(0xa1a3),
                      dcMethod: 'FIXED_DC' as const,
                      abilityDefinitionId: srdAbilityId('WISDOM'),
                      baseDc: save.baseDc
                    }
                  }
                : effect!.invocation
            }
          ]
        }
      ]
    }
  }
  /** The ray at an Ogre whose save d20 and table dice take the 0-based faces given, in order. */
  async function ray(
    rolls: readonly number[],
    spell = tableSpell({ rows: ROWS }),
    save: { baseDc: number } | undefined = { baseDc: UNSAVEABLE_DC }
  ) {
    const prepared = await prepareCreatureAction({
      actor: srdCreatureActor({ id: SOURCE_ID, creature: tableOgre(spell, save) }),
      target: srdCreatureActor({ id: HOLDER_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
      featureId: FEATURE_ID,
      overridable: true
    })
    const { execution } = await settleCreatureAction({ prepared, rolls })
    return prepareNativeActionEffectsPlan({
      prepared,
      execution,
      occurrenceId: testUuid(0xa1a4),
      commandId: testUuid(0xa1a5),
      activeEffectsByActorId: new Map()
    })
  }
  const heldConditions = (effects: Awaited<ReturnType<typeof ray>>) =>
    [effects.recurringEffect, ...effects.riderEffects].flatMap((effect) =>
      effect
        ? effect.definition.stateContributions.flatMap((contribution) =>
            contribution.kind === 'CONDITION_OWNERSHIP' ? [contribution.conditionId] : []
          )
        : []
    )

  it('holds the effect of each row the rolls landed on, side by side', async () => {
    // Save fails; the die lands on 6; its two extra rays land on faces 1 and 3.
    const effects = await ray([0, 5, 0, 2])
    expect(heldConditions(effects)).toEqual([BLINDED, DEAFENED])
    expect(effects.riderEffects).toHaveLength(1)
  })

  it('holds one effect when both rays land on the same row', async () => {
    const effects = await ray([0, 5, 0, 1])
    expect(heldConditions(effects)).toEqual([BLINDED])
    expect(effects.riderEffects).toEqual([])
  })

  it('holds the row that lasts beside a row that damages', async () => {
    const effects = await ray([0, 5, 2, 4])
    expect(heldConditions(effects)).toEqual([DEAFENED])
  })

  it('holds the one effect of a die that lands on a row, rolling no rays', async () => {
    const effects = await ray([0, 3])
    expect(heldConditions(effects)).toEqual([DEAFENED])
  })

  describe('on Prismatic Spray', () => {
    it('plans indigo and violet on their own faces, so the authored spell compiles', () => {
      const plans = castCompilation(prismaticSpray).rollTableRowPlans ?? []
      expect(plans.map((plan) => plan.rollTableRow)).toEqual([
        { min: 6, max: 6 },
        { min: 7, max: 7 }
      ])
    })

    it('holds the restraint and the blindness of a target both rays struck', async () => {
      // The save fails (a natural 1); the die lands on 8; its rays land on 6 and 7.
      const effects = await ray([0, 7, 5, 6], prismaticSpray, undefined)
      expect(heldConditions(effects)).toEqual([RESTRAINED, BLINDED])
    })
  })
})
