import { describe, expect, it } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import { compiledTestSpellCast } from '@artificer-toolkit/rules-runtime/testing/plannedTimedCondition'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { prismaticSpray } from '@artificer-toolkit/source-data/srd/spells/prismatic-spray.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-4.T2ps-d3 (D204, D208): the SRD Prismatic Spray is authored from core options through the
 * spell node map and publishes what the SRD source publishes. A homebrew spell authored with the same
 * options (another die, ranged rows, a three-ray repeat and two lasting rows) passes the map unchanged
 * and compiles the same way, so the table, repeat and merged-row options are generic.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

type SpellEffect = NonNullable<SpellAuthored['effects']>[number]
type TablePath = Extract<SpellEffect['paths'][number], { selectionKind: 'ROLL_TABLE' }>
type TableRow = TablePath['rows'][number]

const idFor = (part: number) =>
  `7e57a000-0000-4000-8${part.toString(16).padStart(3, '0')}-0000000002d3`
const conditionId = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)!.id
const FIRE = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')!.id

function normalize(spell: SpellAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'spell',
    systemId: srdSystemRecord.id,
    values: structuredClone(spell) as unknown as Record<string, unknown>
  })
}

/** A row on faces `from`..`to` holding `condition` until the end of the target's next turn. */
function lastingRow(order: number, from: number, to: number, condition: string): TableRow {
  return {
    id: idFor(0x10 + order),
    order,
    rollRange: [from, to],
    resolutionKind: 'RESULT',
    resultBlock: {
      id: idFor(0x20 + order),
      resultKind: 'SINGLE',
      duration: { id: idFor(0x30 + order), durationKind: 'ROUND', amount: 1 },
      outcomes: [{ id: idFor(0x40 + order), effectKind: 'CONDITION', conditionId: condition }]
    }
  }
}

/**
 * Homebrew Chromatic Burst: a 30-foot cone, a Constitution save, and on a failure a d6: deafened on
 * 1-2, blinded on 3-4, 4d6 fire on 5, and on 6 three more rays that reroll any 6.
 */
function chromaticBurst(): SpellAuthored {
  const [effect] = structuredClone(prismaticSpray.effects!)
  const invocation = effect!.invocation as Extract<
    SpellEffect['invocation'],
    { triggerCode: 'SAVING_THROW' }
  >
  const [failPath] = effect!.paths as TablePath[]
  return {
    ...structuredClone(prismaticSpray),
    id: idFor(0x01),
    label: 'Chromatic Burst',
    level: 5,
    effects: [
      {
        ...effect!,
        invocation: {
          ...invocation,
          savingThrow: {
            ...invocation.savingThrow,
            abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION
          },
          shape: {
            id: idFor(0x02),
            shapeKind: 'CONE',
            length: { amount: 30, unit: 'FEET' }
          }
        },
        paths: [
          {
            ...failPath!,
            rollTableKind: 'RANGE',
            dieConfig: '1d6',
            rows: [
              lastingRow(1, 1, 2, conditionId('DEAFENED')),
              lastingRow(2, 3, 4, conditionId('BLINDED')),
              {
                id: idFor(0x13),
                order: 3,
                rollRange: [5, 5],
                resolutionKind: 'RESULT',
                resultBlock: {
                  id: idFor(0x23),
                  resultKind: 'SINGLE',
                  outcomes: [
                    {
                      id: idFor(0x43),
                      effectKind: 'DAMAGE',
                      damageTypeId: FIRE,
                      valueKind: 'DICE',
                      scalingKind: 'NONE',
                      diceConfig: '4d6'
                    }
                  ]
                }
              },
              {
                id: idFor(0x14),
                order: 4,
                rollRange: [6, 6],
                resolutionKind: 'REPEAT_TABLE',
                repeat: {
                  count: 3,
                  rerollValues: [{ id: idFor(0x54), order: 1, value: 6 }]
                }
              }
            ]
          }
        ]
      }
    ]
  }
}

/** The cast's compiled plans for a level-`level` slot, as a Character casts it. */
function castCompilation(spell: SpellAuthored) {
  const candidateId = `CLASS:class-${spell.id}:${spell.id}:level:${spell.level}`
  return compiledTestSpellCast({
    spell,
    cast: {
      sequence: 0,
      candidateId,
      spellId: spell.id,
      source: { spellId: spell.id, sourceKind: 'CLASS', sourceInstanceId: `class-${spell.id}` },
      spellLevel: spell.level,
      castMode: 'SPELL_SLOT',
      castLevel: spell.level,
      baseEntry: true,
      resourceOwnerKey: null,
      slotPoolCode: null
    },
    decision: {
      status: 'AVAILABLE',
      reasonCode: 'SPELL_SLOT_REMAINING',
      slotKey: `STANDARD:${spell.level}`
    }
  }).entry.compilation
}

describe('Prismatic Spray authored from core options (SPELLS-4.T2ps-d3)', () => {
  it.each([
    ['the SRD Prismatic Spray', prismaticSpray],
    ['a homebrew Chromatic Burst', chromaticBurst()]
  ])('keeps %s exactly as authored through the spell node map', async (_name, spell) => {
    const result = await normalize(spell)
    expect(result.clearedPaths).toEqual([])
    expect(result.values).toEqual(expect.objectContaining({ effects: spell.effects }))
  })

  it('publishes the authored Prismatic Spray as the SRD source publishes it', async () => {
    const { values } = await normalize(prismaticSpray)
    const authored = { ...prismaticSpray, effects: values.effects } as SpellAuthored
    expect(compileSpell(authored)).toEqual(compileSpell(prismaticSpray))
    expect(castCompilation(authored)).toEqual(castCompilation(prismaticSpray))
  })

  it('plans each lasting row of the homebrew table on its own faces, as Prismatic Spray’s', async () => {
    const { values } = await normalize(chromaticBurst())
    const authored = { ...chromaticBurst(), effects: values.effects } as SpellAuthored
    expect(castCompilation(authored).rollTableRowPlans?.map((plan) => plan.rollTableRow)).toEqual([
      { min: 1, max: 2 },
      { min: 3, max: 4 }
    ])
    expect(
      castCompilation(prismaticSpray).rollTableRowPlans?.map((plan) => plan.rollTableRow)
    ).toEqual([
      { min: 6, max: 6 },
      { min: 7, max: 7 }
    ])
  })
})
