import { describe, expect, it } from 'vitest'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import {
  evaluateSrdCharacter,
  itemAction,
  srdFeature,
  type SrdCharacterInput
} from '../testing/dnd5eSrdCharacter.js'

/**
 * SPELLS-31.T4l2: the Unarmed Strike's fixed damage (1 + Strength) compiles to a dice graph once a
 * grant (Martial Arts) sets a weapon die, and stays a flat amount without one.
 */

const TARGET_ID = '00000000-0000-4000-8000-0000000c0001'

function hitDiceGraph(input: SrdCharacterInput) {
  const character = evaluateSrdCharacter(input)
  const { candidate, decision } = itemAction(character, 'Unarmed Strike', {
    attackKind: 'UNARMED'
  })
  const entry = compileCharacterActionEntryPoints({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: character.facts.actionCandidates,
    descriptors: discoverCharacterActionCapabilities({
      gameSystemId: SRD_SYSTEM_ID,
      candidates: character.facts.actionCandidates,
      conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
      abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
      entryPoints: character.entryPoints
    })
  }).find((value) => value.kind === 'CHARACTER_ACTION' && value.actionId === candidate.actionId)
  if (entry?.kind !== 'CHARACTER_ACTION' || entry.compilation.kind !== 'COMPILED')
    throw new Error('The Unarmed Strike must compile.')
  const { executionPlan } = entry.compilation
  if (executionPlan.kind !== 'TEST_OUTCOME') throw new Error('The strike must roll a test.')
  const { facts } = dnd5eCharacterRuleActionSystemAdapter.bindFacts({
    actionMechanic: decision.mechanic,
    published: executionPlan.test.published,
    sourceDerivedFacts: {},
    targetActorId: TARGET_ID,
    targetDerivedFacts: { statBlock: { armorClass: 12 } },
    targetConditionIds: [],
    currentHitPoints: 20,
    temporaryHitPoints: 0,
    maximumHitPoints: 20,
    targetScalarValues: {},
    defenses: []
  })
  const specialized = dnd5eCharacterRuleActionSystemAdapter.specializeOutcomeTemplate?.({
    compilerSource: executionPlan.compilerSource,
    testTemplate: executionPlan.test,
    selectedPath: 'ON_HIT',
    facts,
    testOutputs: { resultPath: 'ON_HIT' },
    testRollMode: 'NORMAL'
  })
  if (!specialized) throw new Error('The ON_HIT template must specialize.')
  return JSON.stringify(specialized.published.definition.nodes)
}

const DIE_NODE = /"key":"evidence\.integer-range".{0,160}?"max":\{"kind":"LITERAL","value":(\d+)\}/g
const dieFaces = (graph: string) => [...graph.matchAll(DIE_NODE)].map(([, faces]) => Number(faces))

describe('Unarmed Strike damage graph (SPELLS-31.T4l2)', () => {
  it('rolls the Martial Arts die beside the fixed amount', () => {
    const graph = hitDiceGraph({
      abilities: { DEXTERITY: 16, STRENGTH: 10 },
      classes: [{ label: 'Monk', level: 5 }],
      features: [
        srdFeature({ owner: 'CLASS', classLabel: 'Monk', featureLabel: 'Martial Arts', level: 1 })
      ]
    })
    expect(dieFaces(graph)).toEqual([6])
  })

  it('stays a flat amount with no die-setting grant', () => {
    const graph = hitDiceGraph({
      abilities: { STRENGTH: 14 },
      classes: [{ label: 'Fighter', level: 1 }]
    })
    expect(dieFaces(graph)).toEqual([])
  })
})
