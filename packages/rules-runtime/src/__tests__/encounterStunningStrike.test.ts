import { describe, expect, it } from 'vitest'

import { SRD_ABILITIES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { advanceNativeActionGraphs } from '../encounterActionExecution.js'
import { resolveNativeActionOnHit } from '../encounterActionOnHit.js'
import type { EncounterOnHitCandidate } from '../encounterOnHitChoice.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { SRD, evaluateSrdCharacter, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCondition } from '../testing/dnd5eSrdEncounter.js'
import {
  HIT,
  SMITE_OCCURRENCE_ID,
  damage,
  scriptedRolls,
  smiteRuntime,
  smiteTargetBinding,
  smiterWeaponAttack
} from './optionalSmiteAttack.js'

/**
 * SPELLS-31.T5rb: Stunning Strike is a generic optional on-hit rider. A Monk's melee hit offers 1 ki;
 * spending it calls a Constitution save against 8 + proficiency + Wisdom, and a failure stuns the
 * target until the end of the Monk's next turn.
 */

const MONK = srdByLabel(SRD.classes, 'Monk')
const STUNNING_STRIKE = MONK.features?.find((feature) => feature.label === 'Stunning Strike')
const CONSTITUTION_ID = SRD_ABILITIES.find(({ code }) => code === 'CONSTITUTION')!.id
const KI_POOL_ID = 'CLASS:monk:ki'

if (!STUNNING_STRIKE?.effects?.[0]) throw new Error('The SRD Monk must author Stunning Strike.')
const RIDER_ID = STUNNING_STRIKE.effects[0].id

const kiAt = (cost: number): EncounterOnHitCandidate => ({
  kind: 'RESOURCE_POOL',
  riderId: RIDER_ID,
  poolId: KI_POOL_ID,
  cost
})

/** A level 5 Monk (Wisdom 14, proficiency +3) with a Shortsword, hitting an Ogre-sized target. */
function monkCharacter() {
  return evaluateSrdCharacter({
    abilities: { STRENGTH: 10, DEXTERITY: 16, WISDOM: 14 },
    classes: [{ label: 'Monk', level: 5 }],
    items: [{ label: 'Shortsword', equipped: true }],
    features: [
      {
        acquisitionId: 'acquired:stunning-strike',
        featureId: STUNNING_STRIKE!.id,
        source: { kind: 'CLASS', classId: MONK.id, classLevel: 5 },
        timing: { kind: 'CLASS_LEVEL', classId: MONK.id, classLevel: 5 }
      }
    ]
  })
}

function monkStrike(rolls: readonly number[]) {
  const character = monkCharacter()
  const { plan, actionMechanic, compilerSource } = smiterWeaponAttack(
    'Shortsword',
    { attackKind: 'MELEE', grip: 'ONE_HANDED', activation: 'ACTION' },
    character
  )
  const scripted = scriptedRolls(rolls)
  const binding = smiteTargetBinding(actionMechanic)
  const source = {
    runtime: smiteRuntime(),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan,
    occurrenceId: SMITE_OCCURRENCE_ID,
    autoRoll: { SOURCE: true, TARGET: true },
    binding: {
      ...binding,
      targetDerivedFacts: {
        ...binding.targetDerivedFacts,
        savingThrowDefinitions: [
          {
            abilityDefinitionId: CONSTITUTION_ID,
            modifier: 0,
            rollMode: 'NORMAL' as const,
            contributors: []
          }
        ]
      }
    },
    afterTest: async () => undefined,
    random: scripted.next
  }
  return {
    compilerSource,
    scripted,
    advance: (candidates: readonly EncounterOnHitCandidate[]) =>
      advanceNativeActionGraphs({ ...source, onHitCandidates: candidates }),
    answer: async (
      held: Awaited<ReturnType<typeof advanceNativeActionGraphs>>,
      candidates: readonly EncounterOnHitCandidate[],
      selection: Parameters<typeof resolveNativeActionOnHit>[0]['selection']
    ) => {
      if (held.kind !== 'PENDING' || held.pause?.kind !== 'ON_HIT')
        throw new Error('The hit must be held for the on-hit choice.')
      return resolveNativeActionOnHit({
        ...source,
        candidates,
        adjustedBinding: null,
        offer: held.pause.payload,
        selection
      })
    }
  }
}

async function useStunningStrike(rolls: readonly number[]) {
  const attack = monkStrike(rolls)
  const held = await attack.advance([kiAt(1)])
  if (held.kind !== 'PENDING' || held.pause?.kind !== 'ON_HIT')
    throw new Error('Expected a held hit.')
  const result = await attack.answer(held, [kiAt(1)], {
    kind: 'OPTION',
    optionId: held.pause.payload.options[0]!.useOptionId
  })
  if (result.execution.kind !== 'COMPLETE') throw new Error('The action must settle.')
  return { attack, held, ...result, execution: result.execution }
}

describe('Stunning Strike as an optional ki rider (SPELLS-31.T5rb)', () => {
  it('holds the hit on a 1 ki option and a decline', async () => {
    const attack = monkStrike([HIT])
    const held = await attack.advance([kiAt(1)])
    expect(held).toMatchObject({
      kind: 'PENDING',
      pause: {
        kind: 'ON_HIT',
        payload: {
          options: [{ kind: 'RESOURCE_POOL', riderId: RIDER_ID, poolId: KI_POOL_ID, cost: 1 }]
        }
      }
    })
  })

  it('stuns the target when its Constitution save fails against 8 + proficiency + Wisdom', async () => {
    // attack d20, shortsword d6, then the target's save d20 (1 + 0 against DC 13).
    const { execution } = await useStunningStrike([HIT, 2, 0])
    expect(execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_FAIL' })
    expect(JSON.stringify(execution.applications)).toContain(srdCondition('Stunned'))
    expect(damage(execution)).toHaveLength(1)
    const saveTest = execution.execution.evidence.trace.find(
      (step) => step.nodeId === 'nested-save-test'
    )
    expect(saveTest?.inputs.threshold).toBe(13)
  })

  it('leaves the target standing when its save meets the DC', async () => {
    // The save meets DC 13 on a natural 13 (face index 12).
    const { execution } = await useStunningStrike([HIT, 2, 12])
    expect(execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(JSON.stringify(execution.applications)).not.toContain(srdCondition('Stunned'))
  })

  it('fails a save one short of the DC', async () => {
    const { execution } = await useStunningStrike([HIT, 2, 11])
    expect(execution.nestedD20).toMatchObject({ resultPath: 'ON_SAVE_FAIL' })
  })

  it("times the stun to the end of the Monk's next turn", () => {
    const { entry } = smiterWeaponAttack(
      'Shortsword',
      { attackKind: 'MELEE', grip: 'ONE_HANDED', activation: 'ACTION' },
      monkCharacter()
    )
    if (entry.kind !== 'CHARACTER_ACTION' || entry.compilation.kind !== 'COMPILED')
      throw new Error('The weapon attack must compile.')
    expect(entry.compilation.activeEffectPlan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      tickAnchor: 'SOURCE',
      initialRemaining: 1
    })
  })
})
