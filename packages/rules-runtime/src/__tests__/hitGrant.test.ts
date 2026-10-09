import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { encounterActiveGrantCapabilitySuppressions } from '../encounterActiveGrants.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter as adapter } from '../systems/dnd5e/effectActionCompiler.js'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '../systems/dnd5e/identity.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { joltingGauntlet } from '../testing/joltingGauntlet.js'

/**
 * SPELLS-5.5 (D99): an attack's hit applies its grant, like Shocking Grasp's "can't take
 * reactions", and a `REACTION_COUNT SET_VALUE 0` grant suppresses its holder's reactions.
 */

const ENCOUNTER_ID = testUuid(0xf50)
const SOURCE_ID = testUuid(0xf51)
const TARGET_ID = testUuid(0xf52)

function gauntletAction(input?: Parameters<typeof joltingGauntlet>[0]) {
  const [effect] = joltingGauntlet(input).effects ?? []
  if (!effect) throw new Error('The gauntlet has no effect.')
  return characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID }))
}

/** The gauntlet's two-phase plan and the active-effect plan its hit carries. */
function compileGauntlet(input?: Parameters<typeof joltingGauntlet>[0]) {
  const action = gauntletAction(input)
  const executionPlan = adapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
  if (executionPlan?.kind !== 'TEST_OUTCOME') throw new Error('The gauntlet is not a TEST/OUTCOME.')
  const plans =
    adapter.activeEffectPlans?.({ action, published: executionPlan.test.published }) ?? []
  return { executionPlan, plans }
}

/** The grant effect the room plans once the gauntlet's attack resolves to `resultPath`. */
function plannedGrant(
  resultPath: 'ON_HIT' | 'ON_CRIT' | 'ON_MISS',
  input?: Parameters<typeof joltingGauntlet>[0]
) {
  const { executionPlan, plans } = compileGauntlet(input)
  const execution = {
    status: 'COMPLETE',
    outputs: {},
    evidence: {
      source: {
        definitionId: ACTION_EFFECT_ID,
        gameSystemId: ENCOUNTER_ID,
        definitionFamilyKey: 'rules-runtime-graph',
        checksum: 'd'.repeat(64)
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: {}
    }
  } satisfies ServerCompletedRuleExecutionDto
  return prepareEncounterActionEffectPlans({
    encounterId: ENCOUNTER_ID,
    occurrenceId: testUuid(0xf53),
    commandId: testUuid(0xf54),
    sourceActorId: SOURCE_ID,
    sourceLabel: 'Jolting Gauntlet',
    sourceHidden: false,
    currentActorId: SOURCE_ID,
    target: {
      actorId: TARGET_ID,
      conditionIds: [],
      effectiveSize: 'MEDIUM',
      lifetimeScope: 'ENCOUNTER',
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    activeEffectPlan: plans[0] ?? null,
    published: executionPlan.test.published,
    execution,
    d20: {
      requestId: testUuid(0xf54),
      rollMode: 'NORMAL',
      derivedRollMode: 'NORMAL',
      rawFaces: [15],
      selectedNatural: 15,
      contributors: [],
      contributorChecksum: 'c'.repeat(64),
      modifier: 0,
      total: 15,
      defenseOrDc: 10,
      resultPath
    },
    applications: []
  }).recurringEffect
}

/** The grant a planned effect carries, as its definition freezes it. */
const appliedGrant = {
  definition: {
    schemaVersion: 2,
    stateContributions: [{ kind: 'MODIFIER_GRANT', sourceLabel: 'Jolting Gauntlet' }]
  }
}

describe('an attack’s hit applies its grant (SPELLS-5.5)', () => {
  it('compiles the hit’s grant beside its damage as the attack’s one active-effect plan', () => {
    const { executionPlan, plans } = compileGauntlet()

    // The hit's damage (doubled on a critical) resolves in the TEST's outcomes, the grant beside it.
    expect(executionPlan.outcomes.map(({ pathCode }) => pathCode)).toEqual(['ON_CRIT', 'ON_HIT'])
    expect(JSON.stringify(executionPlan.outcomes)).not.toContain(testUuid(0xf42))
    expect(plans).toMatchObject([
      {
        recurrenceStage: 'START_OF_TURN',
        initialRemaining: 1,
        modifierGrantContribution: { tickAnchor: 'HOLDER' },
        adapterFacts: { 'dnd5e.grant-authored-path': 'ON_HIT' }
      }
    ])
  })

  it('applies the grant on a hit or a critical hit, and nothing on a miss', () => {
    expect(plannedGrant('ON_HIT')).toMatchObject(appliedGrant)
    expect(plannedGrant('ON_CRIT')).toMatchObject(appliedGrant)
    expect(plannedGrant('ON_MISS')).toBeNull()
  })

  it('applies a critical hit’s grant only on a critical hit', () => {
    expect(plannedGrant('ON_HIT', { grantPaths: ['ON_CRIT'] })).toBeNull()
    expect(plannedGrant('ON_CRIT', { grantPaths: ['ON_CRIT'] })).toMatchObject(appliedGrant)
  })

  it('refuses an attack that applies more than one grant on a hit', () => {
    expect(() => compileGauntlet({ grantPaths: ['ON_HIT', 'ON_CRIT'] })).toThrow(
      'D&D attacks apply at most one grant on a hit.'
    )
  })
})

describe('a creature that can’t take reactions (SPELLS-5.5)', () => {
  it('has its reaction allowance suppressed by a REACTION_COUNT 0 grant', () => {
    const grant = plannedGrant('ON_HIT')
    if (!grant) throw new Error('No grant was planned.')
    const effect = { id: testUuid(0xf55), definition: grant.definition }

    expect(encounterActiveGrantCapabilitySuppressions([effect])).toEqual([
      {
        activeEffectId: effect.id,
        contributionId: testUuid(0xf43),
        capabilityDefinitionIds: [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]
      }
    ])
  })

  it('keeps its reactions under a REACTION_COUNT grant that leaves it one', () => {
    const grant = plannedGrant('ON_HIT', { reactionCount: 1 })
    if (!grant) throw new Error('No grant was planned.')

    expect(
      encounterActiveGrantCapabilitySuppressions([
        { id: testUuid(0xf55), definition: grant.definition }
      ])
    ).toEqual([])
  })
})
