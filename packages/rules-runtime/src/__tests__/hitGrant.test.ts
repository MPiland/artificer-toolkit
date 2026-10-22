import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { resolveRuleCapabilityAvailability } from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import { evaluateEncounterActionEconomy } from '../encounterActionEconomy.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { encounterActiveGrantCapabilitySuppressions } from '../encounterActiveGrants.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import type { CurrentReusableDefinitionSource } from '../ruleCapabilityStateService.js'
import { dnd5eCharacterRuleActionSystemAdapter as adapter } from '../systems/dnd5e/effectActionCompiler.js'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '../systems/dnd5e/identity.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { joltingGauntlet } from '../testing/joltingGauntlet.js'
import { creatureActor, creatureEncounter } from './encounterCreatureAction.js'

/**
 * SPELLS-5.5 (D99): an attack's hit applies its grant, like Shocking Grasp's "can't take
 * reactions", and a `REACTION_COUNT SET_VALUE 0` grant suppresses its holder's reactions.
 */

const ENCOUNTER_ID = testUuid(0xf50)
const SOURCE_ID = testUuid(0xf51)
const TARGET_ID = testUuid(0xf52)

/** The published SRD rule-state definitions, served as current reusable definitions. */
const srdDefinitions: CurrentReusableDefinitionSource = {
  async requireCurrent(definitionId) {
    const seed = SRD_RULE_STATE_DEFINITIONS.find((definition) => definition.id === definitionId)
    if (!seed) throw new Error(`SRD rule-state definition ${definitionId} is missing.`)
    return reusableDefinitionCurrentDtoSchema.parse({
      ...seed,
      gameSystemId: SRD_SYSTEM_ID,
      contentSourceId: testUuid(0xf56),
      contractVersion: 1,
      version: 1,
      publishedAt: '2026-09-26T00:00:00.000Z',
      publishedBy: SRD_USER_ID
    })
  }
}

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
      keep: 'FIRST',
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
        tickAnchor: 'HOLDER',
        resultGate: { paths: ['ON_HIT', 'ON_CRIT'] }
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

  it('applies a miss’s grant only on a miss (RULES-2.T6d)', () => {
    expect(plannedGrant('ON_MISS', { grantPaths: ['ON_MISS'] })).toMatchObject(appliedGrant)
    expect(plannedGrant('ON_HIT', { grantPaths: ['ON_MISS'] })).toBeNull()
    expect(plannedGrant('ON_CRIT', { grantPaths: ['ON_MISS'] })).toBeNull()
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

    expect(encounterActiveGrantCapabilitySuppressions(SRD_SYSTEM_ID, [effect])).toEqual([
      {
        activeEffectId: effect.id,
        contributionId: expect.any(String),
        capabilityDefinitionIds: [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]
      }
    ])
  })

  it('suppresses by grant instance, so two holders of one authored grant both resolve (D99)', () => {
    const grant = plannedGrant('ON_HIT')
    if (!grant) throw new Error('No grant was planned.')
    const effects = [testUuid(0xf55), testUuid(0xf56)].map((id) => ({
      id,
      definition: grant.definition
    }))

    const suppressions = encounterActiveGrantCapabilitySuppressions(SRD_SYSTEM_ID, effects)
    const availability = resolveRuleCapabilityAvailability({
      gameSystemId: SRD_SYSTEM_ID,
      capabilityDefinitionId: DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
      conditions: [],
      activeEffectSuppressions: suppressions
    })

    expect(new Set(suppressions.map(({ contributionId }) => contributionId)).size).toBe(2)
    expect(availability.available).toBe(false)
    expect(availability.suppressingActiveEffectIds).toEqual(effects.map(({ id }) => id))
  })

  it('keeps its reactions under a REACTION_COUNT grant that leaves it one', () => {
    const grant = plannedGrant('ON_HIT', { reactionCount: 1 })
    if (!grant) throw new Error('No grant was planned.')

    expect(
      encounterActiveGrantCapabilitySuppressions(SRD_SYSTEM_ID, [
        { id: testUuid(0xf55), definition: grant.definition }
      ])
    ).toEqual([])
  })

  it('refuses its reaction allowance while the grant is active, on the action-economy path', async () => {
    const grant = plannedGrant('ON_HIT')
    if (!grant) throw new Error('No grant was planned.')
    const actor = creatureActor({ id: TARGET_ID, label: 'Wolf', features: [] })
    const { state, movementTargets } = creatureEncounter([actor])
    const target = movementTargets.get(actor.id)
    if (!target) throw new Error('The Encounter has no target.')
    const effect = {
      id: testUuid(0xf55),
      owner: {
        kind: 'ENCOUNTER_ACTOR' as const,
        encounterId: state.id,
        targetActorId: actor.id
      },
      sourceEncounterId: state.id,
      maintainedEffectStateId: null,
      createdOrdinal: 1,
      version: 1,
      definition: grant.definition,
      definitionChecksum: 'a'.repeat(64),
      lifecycle: { schemaVersion: 1 as const, remainingTicks: 1 },
      lifecycleChecksum: 'b'.repeat(64),
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z'
    }
    const evaluate = (activeEffects: readonly (typeof effect)[]) =>
      evaluateEncounterActionEconomy({
        actor,
        state,
        activation: { code: 'REACTION', amount: 1 },
        target: { ...target, activeEffects: [...activeEffects] },
        loadTarget: async () => target,
        definitions: srdDefinitions
      })

    await expect(evaluate([])).resolves.toMatchObject({ available: true })
    await expect(evaluate([effect])).resolves.toMatchObject({
      available: false
    })
  })
})
