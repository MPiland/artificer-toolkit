import { describe, expect, it } from 'vitest'

import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { divineWord } from '@artificer-toolkit/source-data/srd/spells/divine-word.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast } from '../testing/plannedTimedCondition.js'

/**
 * ATTACK-16.T1a: an authored ROLL_TABLE path runs in its OUTCOME phase. The table die is rolled
 * there, each row's outcomes are gated on the roll, and only the rolled row applies. The table is
 * homebrew (parity with any authored table), cast on Divine Word's saving throw.
 */

const CHARISMA = SRD_ABILITIES.find(({ code }) => code === 'CHARISMA')!.id
const BLINDED = SRD_CONDITION_TYPES.find(({ code }) => code === 'BLINDED')!.id
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

function tableSpell(
  path: Partial<Pick<TablePath, 'dieConfig' | 'rollTableKind' | 'rows'>> = {}
): SpellAuthored {
  const [effect] = divineWord.effects!
  const table: TablePath = {
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
  return {
    ...divineWord,
    id: testUuid(0xa131),
    label: 'Homebrew System Shock',
    effects: [{ ...effect!, paths: [table] }]
  }
}

function castPlan(spell: SpellAuthored) {
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
  }).entry.compilation.executionPlan
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
    dc = UNSAVEABLE_DC
  }: { tableRoll: number; damageDie?: number; dc?: number }
) {
  const rolled: number[] = []
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
        attackAbility: null,
        attackRollMode: 'NORMAL',
        save: { abilityDefinitionId: CHARISMA, dc },
        outcomes: []
      },
      sourceDerivedFacts: {},
      targetActorId: TARGET_ID,
      targetDerivedFacts: {
        statBlock: { armorClass: 12 },
        savingThrowDefinitions: [
          { abilityDefinitionId: CHARISMA, modifier: 0, rollMode: 'NORMAL', contributors: [] }
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
      if (maxExclusive === 6) return tableRoll - 1
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
      'a repeat row',
      [
        row(1, [1, 5], [blinded]),
        {
          id: testUuid(0xa141),
          order: 2,
          rollRange: [6, 6],
          resolutionKind: 'REPEAT_TABLE',
          repeat: { count: 2, rerollValues: [{ id: testUuid(0xa142), order: 1, value: 6 }] }
        } satisfies TableRow
      ],
      /roll table repeats/
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
      'a row with a lasting condition',
      [
        row(1, [1, 5], [blinded]),
        row(2, [6, 6], [deafened], {
          duration: { id: testUuid(0xa144), durationKind: 'ROUND', amount: 1 }
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
