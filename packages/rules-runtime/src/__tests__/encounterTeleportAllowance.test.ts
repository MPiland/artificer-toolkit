import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { balor } from '@artificer-toolkit/source-data/srd/creatures/balor.js'
import { marilith } from '@artificer-toolkit/source-data/srd/creatures/marilith.js'
import { RANGE_KIND } from '@artificer-toolkit/shared/core'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { dimensionDoor } from '@artificer-toolkit/source-data/srd/spells/dimension-door.js'
import { mistyStep } from '@artificer-toolkit/source-data/srd/spells/misty-step.js'
import { describe, expect, it } from 'vitest'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { executionTeleportAllowance } from '../systems/dnd5e/teleportAllowance.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

const TARGET_ID = '00000000-0000-4000-8000-000000000011'
const OCCURRENCE_ID = '00000000-0000-4000-8000-000000000012'

function authoredEffect(spell: { effects?: readonly object[] }) {
  const [effect] = spell.effects ?? []
  if (!effect) throw new Error('The spell has no effect.')
  return effect
}

function teleportFeature<Feature extends { label: string }>(creature: {
  features: readonly Feature[]
}) {
  const feature = creature.features.find(({ label }) => label === 'Teleport')
  if (!feature) throw new Error('The creature has no Teleport feature.')
  return feature
}

function plan(effect: object) {
  const action = characterActionDescriptor(
    compileEffect({ ...(effect as Parameters<typeof compileEffect>[0]), id: ACTION_EFFECT_ID })
  )
  return {
    kind: 'SINGLE_GRAPH' as const,
    published: dnd5eCharacterRuleActionSystemAdapter.compile({ action })
  }
}

async function cast(effect: object) {
  return executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan: plan(effect),
    occurrenceId: OCCURRENCE_ID,
    binding: {
      actionMechanic: {
        attackBonus: null,
        attackKind: null,
        attackDomain: null,
        attackAbility: null,
        attackRollMode: 'NORMAL',
        save: null,
        outcomes: []
      },
      sourceDerivedFacts: {},
      targetActorId: TARGET_ID,
      targetDerivedFacts: { statBlock: { armorClass: 12 }, savingThrowDefinitions: [] },
      targetConditionIds: [],
      currentHitPoints: 20,
      temporaryHitPoints: 0,
      maximumHitPoints: 20,
      targetScalarValues: {},
      defenses: []
    },
    afterTest: async () => undefined
  })
}

describe('the in-Scene teleport allowance', () => {
  it.each([
    ['Misty Step', mistyStep, { maxFeet: 30, destinationKind: 'VISIBLE' }],
    ['Dimension Door', dimensionDoor, { maxFeet: 500, destinationKind: 'SPECIFIED_POINT' }],
    ['Balor Teleport', teleportFeature(balor), { maxFeet: 120, destinationKind: 'VISIBLE' }],
    ['Marilith Teleport', teleportFeature(marilith), { maxFeet: 120, destinationKind: 'VISIBLE' }]
  ])(
    'compiles the SRD %s to a teleport allowance of its range with no applications',
    async (_name, spell, allowance) => {
      expect(
        plan(authoredEffect(spell)).published.definition.nodes.map(({ operation }) => operation.key)
      ).toContain('dnd5e.teleport-allowance-proposal')

      const result = await cast(authoredEffect(spell))
      expect(executionTeleportAllowance(result.execution)).toEqual(allowance)
      expect(result.applications).toEqual([])
    }
  )

  it('is authored from core options: a custom Spell of a 15 foot visible teleport', async () => {
    const custom = {
      ...authoredEffect(mistyStep),
      id: '00000000-0000-4000-8000-0000000009a0',
      invocation: {
        ...(authoredEffect(mistyStep) as { invocation: object }).invocation,
        range: {
          id: '00000000-0000-4000-8000-0000000009a1',
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 15,
          unit: 'FEET'
        }
      }
    }
    const result = await cast(custom)
    expect(executionTeleportAllowance(result.execution)).toEqual({
      maxFeet: 15,
      destinationKind: 'VISIBLE'
    })
  })

  it('reads no allowance from an execution that was not a teleport', async () => {
    const dash = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.DASH)
    const { execution } = await cast(
      authoredEffect({ effects: dash?.document.effects as object[] })
    )
    expect(executionTeleportAllowance(execution)).toBeNull()
  })

  it('still refuses teleports that are not a self teleport with a measured range', () => {
    const effect = authoredEffect(mistyStep) as {
      invocation: { range: object }
      paths: { resultBlock: { outcomes: object[] } }[]
    }
    const selfRange = {
      ...effect,
      invocation: { ...effect.invocation, range: { id: 'self', rangeKind: RANGE_KIND.SELF } }
    }
    const otherCreatures = {
      ...effect,
      paths: effect.paths.map((path) => ({
        ...path,
        resultBlock: {
          ...path.resultBlock,
          outcomes: path.resultBlock.outcomes.map((outcome) => ({
            ...outcome,
            targetKind: 'CHOSEN_CREATURES'
          }))
        }
      }))
    }
    expect(() => plan(selfRange)).toThrow()
    expect(() => plan(otherCreatures)).toThrow()
  })
})
