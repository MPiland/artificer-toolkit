import { describe, expect, it } from 'vitest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  creatureFeature,
  srdCondition,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { prepareCreatureAction, settleCreatureAction } from './encounterCreatureAction.js'

/**
 * SPELLS-33 T4i3d: a branch of an immediate follow-up save carries the one gate table's gates
 * (HP band, REDUCED_TO_ZERO_BY), and a KILL is admitted in a band only when the band is gated. The
 * homebrew here is the seeded Giant Spider's Bite with its poison save's bands rewritten.
 */

const ATTACKER_ID = testUuid(0x2400)
const TARGET_ID = testUuid(0x2401)
const KILL_OUTCOME_ID = testUuid(0x2402)
const PRONE_OUTCOME_ID = testUuid(0x2403)
const PRONE = srdCondition('Prone')
const SPIDER = srdByLabel(SRD.creatures, 'Giant Spider')
const OGRE_HIT_POINTS = 59

type FixedPath = Extract<
  NonNullable<
    NonNullable<CreatureAuthored['features']>[number]['effects']
  >[number]['paths'][number],
  { selectionKind: 'FIXED' }
>
type FollowUpSave = Extract<
  FixedPath['resultBlock']['outcomes'][number],
  { effectKind: 'FOLLOW_UP_SAVE' }
>
type Branch = Extract<FollowUpSave['onFailure'], { kind: 'OUTCOMES' }>
type BranchGate = NonNullable<Branch['gate']>

function spiderWithFailureBranch(rewrite: (failure: Branch) => Branch): CreatureAuthored {
  return {
    ...SPIDER,
    features: SPIDER.features?.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            effects: feature.effects?.map((effect) => ({
              ...effect,
              paths: effect.paths.map((path) =>
                path.selectionKind !== 'FIXED'
                  ? path
                  : {
                      ...path,
                      resultBlock: {
                        ...path.resultBlock,
                        outcomes: path.resultBlock.outcomes.map((outcome) =>
                          outcome.effectKind === 'FOLLOW_UP_SAVE' &&
                          outcome.onFailure.kind === 'OUTCOMES'
                            ? { ...outcome, onFailure: rewrite(outcome.onFailure) }
                            : outcome
                        )
                      }
                    }
              )
            }))
          }
    )
  }
}

/** The Bite's poison damage outcome, which the failed save deals. */
function poisonOutcome(): Branch['outcomes'][number] {
  const failure = SPIDER.features
    ?.flatMap((feature) => feature.effects ?? [])
    .flatMap((effect) => effect.paths)
    .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
    .find((outcome) => outcome.effectKind === 'FOLLOW_UP_SAVE')
  if (failure?.effectKind !== 'FOLLOW_UP_SAVE' || failure.onFailure.kind !== 'OUTCOMES')
    throw new Error('Expected the Giant Spider’s poison save.')
  const [poison] = failure.onFailure.outcomes
  if (!poison) throw new Error('Expected the Giant Spider’s poison damage.')
  return poison
}

function killBranch(gate?: BranchGate): (failure: Branch) => Branch {
  return (failure) => ({
    ...failure,
    ...(gate ? { gate } : {}),
    outcomes: [{ id: KILL_OUTCOME_ID, effectKind: 'KILL' }]
  })
}

/**
 * The Bite against the seeded Ogre (AC 11, CON 16: +3 to its save), every roll a 0-based die face in
 * request order: the attack d20, the 1d8 bite die, the save d20, then the save's damage dice.
 */
async function biteOgre(attacker: CreatureAuthored, rolls: readonly number[], hitPoints: number) {
  const prepared = await prepareCreatureAction({
    actor: srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
    target: srdCreatureActor({
      id: TARGET_ID,
      creature: srdByLabel(SRD.creatures, 'Ogre'),
      currentHitPoints: hitPoints
    }),
    featureId: creatureFeature(attacker, 'Bite').id,
    overridable: true
  })
  return settleCreatureAction({ prepared, rolls })
}

const HIT = 9
const BITE_FACE = 0
const SAVE_FAILS = 0
const MAX_FACE = 7

const kinds = (result: Awaited<ReturnType<typeof biteOgre>>) =>
  result.execution.applications.map(({ kind }) => kind)

describe('a hit-point gate on a nested save band (SPELLS-33 T4i3d)', () => {
  const slayer = (atMost: number) =>
    spiderWithFailureBranch(killBranch({ kind: 'TARGET_HIT_POINTS_AT_MOST', amount: atMost }))

  it('kills a target within the band on a failed save', async () => {
    const result = await biteOgre(slayer(100), [HIT, BITE_FACE, SAVE_FAILS, 0, 0], OGRE_HIT_POINTS)
    expect(kinds(result)).toContain('KILL')
  })

  it('spares a target above the band, and publishes the kill behind a gate node', async () => {
    const result = await biteOgre(
      slayer(OGRE_HIT_POINTS - 1),
      [HIT, BITE_FACE, SAVE_FAILS, 0, 0],
      OGRE_HIT_POINTS
    )
    expect(kinds(result)).not.toContain('KILL')
    const nodes = result.execution.published.definition.nodes
    expect(nodes.find(({ id }) => id === 'nested-save-gate-on_save_fail')).toMatchObject({
      operation: { key: 'dnd5e.nested-save-gate', contractVersion: 2 },
      inputs: {
        resultPath: { kind: 'NODE_OUTPUT', nodeId: 'nested-save-test', port: 'resultPath' },
        hitPointsAtMost: { kind: 'LITERAL', value: OGRE_HIT_POINTS - 1 }
      }
    })
    expect(nodes.find(({ id }) => id === 'nested-save-on_save_fail-1')).toMatchObject({
      inputs: {
        resolvedPath: { kind: 'NODE_OUTPUT', nodeId: 'nested-save-gate-on_save_fail' }
      }
    })
  })

  it('does not kill when the save succeeds, whatever the target’s hit points', async () => {
    const result = await biteOgre(slayer(100), [HIT, BITE_FACE, 19, 0, 0], OGRE_HIT_POINTS)
    expect(kinds(result)).not.toContain('KILL')
  })

  it('refuses a kill that no gate holds, so a save alone never kills', async () => {
    await expect(
      biteOgre(
        spiderWithFailureBranch(killBranch()),
        [HIT, BITE_FACE, SAVE_FAILS, 0, 0],
        OGRE_HIT_POINTS
      )
    ).rejects.toThrow(/no discovered action/)
  })
})

describe('a reduced-to-0 gate on a nested save band (SPELLS-33 T4i3d)', () => {
  const poison = poisonOutcome()
  const proneAfterPoison = spiderWithFailureBranch((failure) => ({
    ...failure,
    gate: { kind: 'REDUCED_TO_ZERO_BY', damageOutcomeId: poison.id },
    outcomes: [poison, { id: PRONE_OUTCOME_ID, effectKind: 'CONDITION', conditionId: PRONE }]
  }))
  const rolls = [HIT, BITE_FACE, SAVE_FAILS, MAX_FACE, MAX_FACE]

  it('holds the follow-up outcomes back unless the band’s damage took the target to 0', async () => {
    expect(kinds(await biteOgre(proneAfterPoison, rolls, OGRE_HIT_POINTS))).toEqual([
      'DAMAGE',
      'DAMAGE'
    ])
    expect(kinds(await biteOgre(proneAfterPoison, rolls, 5))).toEqual([
      'DAMAGE',
      'DAMAGE',
      'CONDITION_APPLY'
    ])
  })

  it('refuses a gate that does not name the band’s first damage', async () => {
    const wrong = spiderWithFailureBranch((failure) => ({
      ...failure,
      gate: { kind: 'REDUCED_TO_ZERO_BY', damageOutcomeId: testUuid(0x2404) },
      outcomes: [poison]
    }))
    await expect(biteOgre(wrong, rolls, 5)).rejects.toThrow(/no discovered action/)
  })
})
