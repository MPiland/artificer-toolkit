import { describe, expect, it } from 'vitest'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

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

function hitDiceGraph(input: SrdCharacterInput) {
  const character = evaluateSrdCharacter(input)
  const { candidate } = itemAction(character, 'Unarmed Strike', { attackKind: 'UNARMED' })
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
  const hit = executionPlan.outcomes.find(({ pathCode }) => pathCode === 'ON_HIT')
  return JSON.stringify(hit)
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
