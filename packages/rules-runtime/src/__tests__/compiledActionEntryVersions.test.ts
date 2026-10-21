import { describe, expect, it } from 'vitest'
import { compiledActionEntryPointsSchema } from '@artificer-toolkit/schema/projections/characterMechanics'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { evaluateSrdCharacter, itemAction } from '../testing/dnd5eSrdCharacter.js'

// A Fighter's handaxe attack, compiled through the real SRD policy and entry compiler.
const fighter = evaluateSrdCharacter({
  abilities: { STRENGTH: 16 },
  classes: [{ label: 'Fighter', level: 1 }],
  items: [{ label: 'Handaxe', equipped: true }]
})
const { candidate } = itemAction(fighter, 'Handaxe', { attackKind: 'MELEE', activation: 'ACTION' })
const entry = compileCharacterActionEntryPoints({
  gameSystemId: SRD_SYSTEM_ID,
  candidates: fighter.facts.actionCandidates,
  descriptors: discoverCharacterActionCapabilities({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: fighter.facts.actionCandidates,
    conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    entryPoints: fighter.entryPoints
  })
}).find((value) => value.kind === 'CHARACTER_ACTION' && value.actionId === candidate.actionId)

describe('compiled Character action entry versions', () => {
  it('accepts only the current compiled action version', () => {
    if (entry?.kind !== 'CHARACTER_ACTION' || entry.compilation.kind !== 'COMPILED') {
      throw new Error('The SRD handaxe attack must compile.')
    }
    expect(entry.schemaVersion).toBe(4)
    expect(compiledActionEntryPointsSchema.safeParse([entry]).success).toBe(true)

    const { compilation } = entry
    const plan = compilation.executionPlan
    if (plan.kind !== 'TEST_OUTCOME') throw new Error('The handaxe attack must roll a test.')
    const retired = {
      kind: entry.kind,
      actionId: entry.actionId,
      effectId: entry.effectId,
      targetPolicy: entry.targetPolicy
    }
    const retiredCompilation = {
      kind: 'COMPILED' as const,
      published: plan.test.published,
      resourceBinding: compilation.resourceBinding,
      activeEffectPlan: compilation.activeEffectPlan
    }
    expect(
      compiledActionEntryPointsSchema.safeParse([
        { ...retired, schemaVersion: 2, compilation: retiredCompilation }
      ]).success
    ).toBe(false)
    expect(
      compiledActionEntryPointsSchema.safeParse([
        {
          ...retired,
          schemaVersion: 3,
          compilation: { ...retiredCompilation, compilerSource: plan.compilerSource }
        }
      ]).success
    ).toBe(false)
  })
})
