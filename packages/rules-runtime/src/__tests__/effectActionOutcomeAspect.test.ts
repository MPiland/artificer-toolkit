import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  dnd5eDirectOutcomeEntry,
  dnd5eTestOutcomeEntries,
  type Dnd5eOutcomeCarriers,
  type Dnd5eOutcomeEntry
} from '../systems/dnd5e/effectActionOutcomeAspect.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { catalogueBasicActionEffect } from '../testing/concealmentFixture.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

const FIRE_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')?.id ?? ''
const ONE_RESULT =
  'D&D Effect action must have one fixed direct result without lifecycle overrides.'
const TEST_PATHS = 'D&D test action paths must be unique direct outcomes.'
const NOTHING_CARRIED: Dnd5eOutcomeCarriers = {
  sequence: false,
  choice: false,
  lifetime: () => false
}
const ALL_CARRIED: Dnd5eOutcomeCarriers = { sequence: true, choice: true, lifetime: () => true }
const NOTHING_PLANNED = () => false

const THIRTY_FEET = {
  id: testUuid(0x15d01),
  rangeKind: RANGE_KIND.DISTANCE,
  amount: 30,
  unit: MEASUREMENT_UNIT_CODE.FEET
}

/**
 * An action authored from core options: 3 fire damage to a single creature within 30 feet on
 * `pathCode`, rolled by `trigger`, with the result block and path fields `block` and `path` add.
 */
function action(
  trigger: Record<string, unknown>,
  pathCode: string,
  block: Record<string, unknown> = {},
  path: Record<string, unknown> = {}
): EffectAuthored {
  return {
    id: ACTION_EFFECT_ID,
    order: 1,
    invocation: {
      kind: 'ACTION',
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: THIRTY_FEET,
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.ANY
      },
      ...trigger
    },
    paths: [
      {
        id: testUuid(0x15d02),
        order: 1,
        pathCode,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: testUuid(0x15d03),
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: testUuid(0x15d04),
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: FIRE_ID,
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 3
            }
          ],
          ...block
        },
        ...path
      }
    ]
  } as EffectAuthored
}

const ACTIVATED = { triggerCode: TRIGGER.ACTIVATED }
const SAVING_THROW = {
  triggerCode: TRIGGER.SAVING_THROW,
  savingThrow: {
    id: testUuid(0x15d05),
    dcMethod: 'FIXED_DC',
    abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
    baseDc: 13
  }
}
const TEN_ROUNDS = { duration: { id: testUuid(0x15d06), durationKind: 'ROUND', amount: 10 } }
const INSTANTANEOUS = { duration: { id: testUuid(0x15d07), durationKind: 'INSTANTANEOUS' } }

/** The one entry an authored action compiles to, as the outcome aspect reads it. */
function entryOf(effect: EffectAuthored): Dnd5eOutcomeEntry {
  const [entry] = compileEffect(effect).entries
  if (entry?.resolutionKind !== 'DIRECT') throw new Error('The fixture compiles no direct entry.')
  return entry
}

function directEntry(
  entries: readonly Dnd5eOutcomeEntry[],
  carriers: Dnd5eOutcomeCarriers = NOTHING_CARRIED,
  repeatsSave = false
) {
  return dnd5eDirectOutcomeEntry(entries, { test: 'NONE', repeatsSave, carriers })
}

function saveEntries(
  entries: readonly Dnd5eOutcomeEntry[],
  carriers: Dnd5eOutcomeCarriers = NOTHING_CARRIED,
  planned: Parameters<typeof dnd5eTestOutcomeEntries>[1]['planned'] = NOTHING_PLANNED
) {
  return dnd5eTestOutcomeEntries(entries, { test: 'SAVE', carriers, planned })
}

describe('the outcome aspect composes a direct result on its own (QUALITY-15.T1d)', () => {
  const onUse = entryOf(action(ACTIVATED, PATH_CODE.ON_USE))

  it('composes the one result an action applies on use', () => {
    expect(directEntry([onUse])).toBe(onUse)
  })

  it('refuses a second result unless the save it repeats follows it', () => {
    const second = { ...onUse, id: testUuid(0x15d08), entryId: testUuid(0x15d08) }
    expect(() => directEntry([onUse, second])).toThrow(ONE_RESULT)
    expect(directEntry([onUse, second], NOTHING_CARRIED, true)).toBe(onUse)
    expect(() => directEntry([onUse], NOTHING_CARRIED, true)).toThrow(ONE_RESULT)
    expect(() => directEntry([])).toThrow(ONE_RESULT)
  })

  it('composes a result only on the path its test resolves to', () => {
    expect(() => directEntry([entryOf(action(ACTIVATED, PATH_CODE.ON_HIT))])).toThrow(ONE_RESULT)
    const onCheckSuccess = entryOf(action(ACTIVATED, PATH_CODE.ON_CHECK_SUCCESS))
    expect(
      dnd5eDirectOutcomeEntry([onCheckSuccess], {
        test: 'CHECK',
        repeatsSave: false,
        carriers: NOTHING_CARRIED
      })
    ).toBe(onCheckSuccess)
  })

  it('composes a sequence or a choice only when its carriers hold them', () => {
    const sequence = { ...onUse, groupKind: PATH_GROUP_TYPE.SEQUENTIAL }
    const choice = { ...onUse, groupKind: PATH_GROUP_TYPE.CHOICE }
    expect(() => directEntry([sequence])).toThrow(ONE_RESULT)
    expect(() => directEntry([choice])).toThrow(ONE_RESULT)
    expect(directEntry([sequence], ALL_CARRIED)).toBe(sequence)
    expect(directEntry([choice], ALL_CARRIED)).toBe(choice)
  })

  it('refuses a result with a range or targeting of its own, whatever its carriers hold', () => {
    const ranged = entryOf(action(ACTIVATED, PATH_CODE.ON_USE, {}, { rangeOverride: THIRTY_FEET }))
    const targeted = entryOf(
      action(
        ACTIVATED,
        PATH_CODE.ON_USE,
        {},
        { targetingOverride: { selectionKind: TARGET_SELECTION_KIND.SELF } }
      )
    )
    expect(() => directEntry([ranged], ALL_CARRIED)).toThrow(ONE_RESULT)
    expect(() => directEntry([targeted], ALL_CARRIED)).toThrow(ONE_RESULT)
  })

  it('composes a result that outlasts its use only when a plan holds its lifetime', () => {
    const timed = entryOf(action(ACTIVATED, PATH_CODE.ON_USE, TEN_ROUNDS))
    const maintained = entryOf(
      action(ACTIVATED, PATH_CODE.ON_USE, { maintenanceDefinitionId: testUuid(0x15d09) })
    )
    for (const lasting of [timed, maintained]) {
      expect(() => directEntry([lasting])).toThrow(ONE_RESULT)
      expect(directEntry([lasting], ALL_CARRIED)).toBe(lasting)
    }
    const instant = entryOf(action(ACTIVATED, PATH_CODE.ON_USE, INSTANTANEOUS))
    expect(directEntry([instant])).toBe(instant)
  })
})

describe('the outcome aspect composes each test result on its own path (QUALITY-15.T1d)', () => {
  const failed = entryOf(action(SAVING_THROW, PATH_CODE.ON_SAVE_FAIL))
  const succeeded = entryOf(action(SAVING_THROW, PATH_CODE.ON_SAVE_SUCCESS))

  it('composes a result on every path the save resolves to, and no other', () => {
    expect(saveEntries([failed, succeeded])).toEqual([failed, succeeded])
    expect(() => saveEntries([failed, entryOf(action(SAVING_THROW, PATH_CODE.ON_HIT))])).toThrow(
      TEST_PATHS
    )
    expect(() => saveEntries([entryOf(action(SAVING_THROW, PATH_CODE.ON_USE))])).toThrow(TEST_PATHS)
  })

  it('composes a sequence only when its carriers hold its later results, and never a choice', () => {
    const sequence = { ...failed, groupKind: PATH_GROUP_TYPE.SEQUENTIAL }
    const choice = { ...failed, groupKind: PATH_GROUP_TYPE.CHOICE }
    expect(() => saveEntries([sequence])).toThrow(TEST_PATHS)
    expect(saveEntries([sequence], { ...NOTHING_CARRIED, sequence: true })).toEqual([sequence])
    expect(() => saveEntries([choice], { ...ALL_CARRIED, choice: false })).toThrow(TEST_PATHS)
  })

  it('composes a lasting result only when a plan holds its lifetime, and an instant one always', () => {
    const timed = entryOf(action(SAVING_THROW, PATH_CODE.ON_SAVE_FAIL, TEN_ROUNDS))
    expect(() => saveEntries([timed])).toThrow(TEST_PATHS)
    expect(
      saveEntries([timed], { ...NOTHING_CARRIED, lifetime: (entry) => entry === timed })
    ).toEqual([timed])
    const instant = entryOf(action(SAVING_THROW, PATH_CODE.ON_SAVE_FAIL, INSTANTANEOUS))
    expect(saveEntries([instant])).toEqual([instant])
  })

  it('leaves the entries a plan or a table holds to them', () => {
    const offPath = entryOf(action(SAVING_THROW, PATH_CODE.ON_USE))
    expect(saveEntries([failed, offPath], NOTHING_CARRIED, (entry) => entry === offPath)).toEqual([
      failed
    ])
  })

  it('refuses a second relationship, even one a plan holds', () => {
    const [grapple] = compileEffect(
      catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.GRAPPLE)
    ).entries.filter(
      (entry): entry is Dnd5eOutcomeEntry =>
        entry.resolutionKind === 'DIRECT' && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP'
    )
    if (!grapple) throw new Error('Grapple holds no relationship.')
    const relationship = { ...grapple, pathCode: PATH_CODE.ON_SAVE_FAIL }
    const another = { ...relationship, id: testUuid(0x15d0a), entryId: testUuid(0x15d0a) }
    expect(saveEntries([relationship], ALL_CARRIED, () => true)).toEqual([])
    expect(() => saveEntries([relationship, another], ALL_CARRIED, () => true)).toThrow(
      'D&D action has more than one relationship outcome.'
    )
  })
})

function planOf(effect: EffectAuthored) {
  const action = characterActionDescriptor(compileEffect(effect))
  return dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
}

describe('the compiler composes outcomes by the aspect (QUALITY-15.T1d admissions)', () => {
  it('compiles a save whose failure is authored as instantaneous as one with no duration', () => {
    const instant = planOf(action(SAVING_THROW, PATH_CODE.ON_SAVE_FAIL, INSTANTANEOUS))
    const plain = planOf(action(SAVING_THROW, PATH_CODE.ON_SAVE_FAIL))
    if (instant?.kind !== 'TEST_OUTCOME' || plain?.kind !== 'TEST_OUTCOME')
      throw new Error('Expected both saves to compile to a TEST and its OUTCOME.')
    expect(instant.test).toEqual(plain.test)
    expect(instant.outcomes.map(({ pathCode }) => pathCode)).toEqual(['ON_SAVE_FAIL'])
  })

  it('compiles a Hide held by a named maintained effect, whose concealment plan holds it', () => {
    const hide = catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.HIDE)
    const [path] = hide.paths
    if (!path || !('resultBlock' in path)) throw new Error('Hide has no direct result block.')
    const maintenanceDefinitionId = testUuid(0x15d0b)
    const maintained = {
      ...hide,
      paths: [{ ...path, resultBlock: { ...path.resultBlock, maintenanceDefinitionId } }]
    }
    const action = characterActionDescriptor(compileEffect(maintained))
    const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
    const [plan] =
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action, published }) ?? []
    expect(plan?.concealmentContribution).toBeDefined()
    expect(plan?.maintenance?.definitionId).toBe(maintenanceDefinitionId)
  })
})
