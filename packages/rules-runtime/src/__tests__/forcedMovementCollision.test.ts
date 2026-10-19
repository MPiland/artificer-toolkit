import { describe, expect, it } from 'vitest'
import { EFFECT_KIND } from '@artificer-toolkit/shared/core'
import type { ForcedMovementCollisionAuthored } from '@artificer-toolkit/shared/authored'
import { ancientBronzeDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-bronze-dragon.js'
import { bronzeDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/bronze-dragon-wyrmling.js'

import { installedSrdCreature, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  creatureActor,
  prepareCreatureAction,
  settleCreatureAction
} from './encounterCreatureAction.js'

const DRAGON_ID = testUuid(0xd6b01)
const TARGET_ID = testUuid(0xd6b02)
const FAILED = 0

const collision: ForcedMovementCollisionAuthored = {
  id: 'collision-1',
  damageTypeId: testUuid(0xd6b10),
  diceConfig: '1d6',
  savingThrow: {
    id: 'collision-save-1',
    dcMethod: 'FIXED_DC',
    abilityDefinitionId: testUuid(0xd6b11),
    baseDc: 13
  },
  conditionId: testUuid(0xd6b12)
}

/** The wyrmling's Repulsion Breath, whose push carries `withCollision` (D159). */
function breatherWith(withCollision: ForcedMovementCollisionAuthored | undefined) {
  const creature = installedSrdCreature(bronzeDragonWyrmling)
  const feature = creature.features.find(({ effects }) =>
    effects?.some(({ paths }) =>
      paths.some(
        (path) =>
          'resultBlock' in path &&
          path.resultBlock.outcomes.some(
            ({ effectKind }) => effectKind === EFFECT_KIND.FORCED_MOVEMENT
          )
      )
    )
  )
  if (!feature) throw new Error('The wyrmling has no Repulsion Breath.')
  const effects = feature.effects
    ?.filter(({ paths }) =>
      paths.some(
        (path) =>
          'resultBlock' in path &&
          path.resultBlock.outcomes.some(
            ({ effectKind }) => effectKind === EFFECT_KIND.FORCED_MOVEMENT
          )
      )
    )
    .map((effect) => ({
      ...effect,
      paths: effect.paths.map((path) =>
        'resultBlock' in path
          ? {
              ...path,
              resultBlock: {
                ...path.resultBlock,
                outcomes: path.resultBlock.outcomes.map((outcome) =>
                  outcome.effectKind === EFFECT_KIND.FORCED_MOVEMENT
                    ? { ...outcome, ...(withCollision ? { collision: withCollision } : {}) }
                    : outcome
                )
              }
            }
          : path
      )
    }))
  return {
    featureId: feature.id,
    actor: creatureActor({
      id: DRAGON_ID,
      label: creature.label,
      statBlock: creature,
      features: [{ ...feature, effects }]
    })
  }
}

async function breatheOn(withCollision: ForcedMovementCollisionAuthored | undefined) {
  const { actor, featureId } = breatherWith(withCollision)
  const prepared = await prepareCreatureAction({
    actor,
    target: creatureActor({
      id: TARGET_ID,
      label: 'Target',
      statBlock: installedSrdCreature(ancientBronzeDragon),
      features: []
    }),
    featureId,
    overridable: false
  })
  const { execution } = await settleCreatureAction({ prepared, rolls: [FAILED] })
  return (
    prepared.adapter.interpretSpatial?.({
      execution: execution.execution,
      occurrenceId: testUuid(0xd6b03),
      published: execution.published,
      targetActorId: TARGET_ID
    }) ?? []
  )
}

describe('an authored forced movement collision (SPELLS-33.T6k2b, D159)', () => {
  it('rides the committed movement, flat, with the save the struck creature makes', async () => {
    expect(await breatheOn(collision)).toEqual([
      expect.objectContaining({
        kind: 'FORCED_MOVEMENT',
        collision: {
          diceConfig: '1d6',
          damageTypeId: collision.damageTypeId,
          abilityDefinitionId: collision.savingThrow.abilityDefinitionId,
          dc: 13,
          conditionId: collision.conditionId
        }
      })
    ])
  })

  it('is null on a movement that authors none', async () => {
    expect(await breatheOn(undefined)).toEqual([expect.objectContaining({ collision: null })])
  })

  it.each([
    [
      'a save that is not a fixed DC',
      { savingThrow: { ...collision.savingThrow, dcMethod: 'SOURCE_SAVE_DC' } }
    ],
    ['dice that are not a single dice term', { diceConfig: '1d6+2' }],
    ['a damage type that is not an identity', { damageTypeId: 'bludgeoning' }]
  ] as const)('refuses %s rather than dropping the collision', async (_label, change) => {
    await expect(
      breatheOn({ ...collision, ...change } as ForcedMovementCollisionAuthored)
    ).rejects.toThrow()
  })
})
