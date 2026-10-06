import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { dnd5eCharacterActionCapabilityAdapter } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID } from '../systems/dnd5e/reactionEligibilityPolicy.js'
import { SRD, evaluateSrdCharacter, itemAction, srdByLabel } from './dnd5eSrdCharacter.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureActor,
  outcomeDice,
  prepareCreatureAction,
  settleCreatureAction,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const ATTACKER_ID = testUuid(0xc1)
const TARGET_ID = testUuid(0xc2)
/** A natural 20, as a 0-based die face. */
const NATURAL_20 = 19

function damage(execution: Awaited<ReturnType<typeof executeNativeActionGraphs>>) {
  return execution.applications.flatMap((application) =>
    application.kind === 'DAMAGE'
      ? [[application.requestedAmount, application.damageTypeId] as const]
      : []
  )
}

/** A seeded SRD Creature's attack against the seeded Ogre (AC 11), every roll a 0-based face. */
async function creatureAttack(input: { attacker: string; feature: string; rolls: number[] }) {
  const attacker = srdByLabel(SRD.creatures, input.attacker)
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
    target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
    featureId: creatureFeature(attacker, input.feature).id,
    overridable: true
  })
  return (await settleCreatureAction({ prepared, rolls: input.rolls })).execution
}

describe('critical hits double every damage die of the attack (SRD 5.1)', () => {
  it('doubles each damage part of a Creature hit, but not its modifier', async () => {
    // Adult Red Dragon Bite: 2d10 + 8 piercing plus 2d6 fire; a critical is 4d10 + 8 and 4d6.
    const critical = await creatureAttack({
      attacker: 'Adult Red Dragon',
      feature: 'Bite',
      rolls: [NATURAL_20, 0, 1, 2, 3, 0, 1, 2, 3]
    })
    expect(critical.d20).toMatchObject({ resultPath: 'ON_CRIT' })
    expect(outcomeDice(critical)).toEqual({
      hit: ['d10', 'd10', 'd10', 'd10', 'd6', 'd6', 'd6', 'd6'],
      save: []
    })
    expect(damage(critical)).toEqual([
      [1 + 2 + 3 + 4 + 8, srdDamageTypeId('PIERCING')],
      [1 + 2 + 3 + 4, srdDamageTypeId('FIRE')]
    ])
  })

  it('doubles the hit dice before a forced save, but not the save’s damage', async () => {
    // Giant Spider Bite: 1d8 + 3 piercing, then DC 11 Constitution or 2d8 poison. The poison is
    // the save's damage, not the attack's, so a critical rolls 2d8 + 3 piercing and 2d8 poison.
    const critical = await creatureAttack({
      attacker: 'Giant Spider',
      feature: 'Bite',
      rolls: [NATURAL_20, 3, 4, 0, 2, 4]
    })
    expect(outcomeDice(critical)).toEqual({ hit: ['d8', 'd8'], save: ['d8', 'd8'] })
    expect(damage(critical)).toEqual([
      [4 + 5 + 3, srdDamageTypeId('PIERCING')],
      [3 + 5, srdDamageTypeId('POISON')]
    ])
  })

  it('doubles an opportunity attack’s dice', async () => {
    // The Wolf's Bite as a movement reaction: 2d4 + 2 piercing; a critical is 4d4 + 2.
    const wolfBite = creatureFeature(srdByLabel(SRD.creatures, 'Wolf'), 'Bite')
    const bite = wolfBite.effects?.[0]
    if (!bite || bite.invocation.kind !== 'ACTION') throw new Error('The Wolf Bite is missing.')
    const reaction = {
      ...wolfBite,
      effects: [
        {
          ...bite,
          invocation: {
            ...bite.invocation,
            activation: { code: 'REACTION' as const, amount: 1 },
            reactionMovementTrigger: {
              kind: 'MOVEMENT' as const,
              stage: 'BEFORE_LEAVE_REACH' as const,
              perceptionRequirement: null,
              eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
              movementInterruption: null
            }
          },
          // The Bite's damage alone; its prone rider is not the subject here.
          paths: bite.paths.slice(0, 1)
        }
      ]
    }
    const prepared = await prepareCreatureAction({
      actor: creatureActor({ id: ATTACKER_ID, label: 'Wolf', features: [reaction] }),
      target: srdCreatureActor({ id: TARGET_ID, creature: srdByLabel(SRD.creatures, 'Ogre') }),
      featureId: reaction.id,
      overridable: false
    })
    const { execution } = await settleCreatureAction({
      prepared,
      rolls: [NATURAL_20, 0, 1, 2, 3]
    })
    expect(outcomeDice(execution).hit).toEqual(['d4', 'd4', 'd4', 'd4'])
    expect(damage(execution)).toEqual([[1 + 2 + 3 + 4 + 2, srdDamageTypeId('PIERCING')]])
  })

  it('doubles a Character weapon attack’s dice, but not its ability modifier', async () => {
    // An SRD Fighter with STR 16 and a one-handed Longsword: 1d8 + 3; a critical is 2d8 + 3.
    const character = evaluateSrdCharacter({
      abilities: { STRENGTH: 16 },
      classes: [{ label: 'Fighter', level: 1 }],
      items: [{ label: 'Longsword', equipped: true }]
    })
    const { candidate, decision } = itemAction(character, 'Longsword', {
      attackKind: 'MELEE',
      grip: 'ONE_HANDED'
    })
    const action = dnd5eCharacterActionCapabilityAdapter.discover({
      candidates: character.facts.actionCandidates,
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
      entryPoints: character.entryPoints
    })[character.facts.actionCandidates.indexOf(candidate)]
    if (!action) throw new Error('The Longsword action was not discovered.')
    const plan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
      action,
      compilerSource: buildCompiledActionCompilerSource(action)
    })
    if (!plan) throw new Error('The Longsword action has no execution plan.')
    const rolls = [NATURAL_20, 3, 6]
    const critical = await executeNativeActionGraphs({
      runtime: createPlatformRulesRuntime({
        continuationIntegrityKey: new Uint8Array(32).fill(1),
        definitions: {
          async requireCurrent() {
            throw new Error('Definitions are not used by sealed graphs.')
          }
        }
      }),
      adapter: dnd5eCharacterRuleActionSystemAdapter,
      plan,
      occurrenceId: testUuid(0xc3),
      binding: {
        actionMechanic: { ...decision.mechanic, save: null },
        sourceDerivedFacts: {},
        targetActorId: TARGET_ID,
        targetDerivedFacts: { statBlock: { armorClass: 11 } },
        targetConditionIds: [],
        currentHitPoints: 59,
        temporaryHitPoints: 0,
        maximumHitPoints: 59,
        targetScalarValues: {},
        defenses: []
      },
      afterTest: async () => undefined,
      random: (maxExclusive) => {
        const value = rolls.shift()
        if (value === undefined || value >= maxExclusive)
          throw new Error(`Unexpected random call (max ${maxExclusive}).`)
        return value
      }
    })
    expect(rolls).toEqual([])
    expect(critical.d20).toMatchObject({ selectedNatural: 20, resultPath: 'ON_CRIT' })
    expect(outcomeDice(critical).hit).toEqual(['d8', 'd8'])
    expect(damage(critical)).toEqual([[4 + 7 + 3, srdDamageTypeId('SLASHING')]])
  })
})
