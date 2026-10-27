import { describe, expect, it } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * MOVE-4.T3b (ADR 0038): the cling a won climb gives the climbed creature is an authored effect, so
 * its ESCAPE_CHECK `holderForcedMovement` (where a dislodged climber lands) passes through the
 * effect node map exactly as authored, with the forced-movement fields an outcome uses.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function climbCling() {
  const definition = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    ({ document }) => document.kind === 'CLIMB_ONTO_LARGER_CREATURE'
  )
  if (definition?.document.parameters.kind !== 'CLIMB_ONTO_LARGER_CREATURE') {
    throw new Error('Missing SRD climb definition.')
  }
  return structuredClone(definition.document.parameters.effect)
}

async function normalize(effect: object) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'effect',
    systemId: srdSystemRecord.id,
    values: structuredClone(effect) as Record<string, unknown>
  })
}

function dislodge(effect: ReturnType<typeof climbCling>) {
  const [path] = effect.paths ?? []
  if (path?.selectionKind !== 'FIXED') throw new Error('The cling must author a fixed path.')
  const outcome = path.resultBlock.outcomes[0]
  if (outcome?.effectKind !== 'ACTOR_RELATIONSHIP') throw new Error('The cling must hold.')
  const module = outcome.modules.find(({ kind }) => kind === 'ESCAPE_CHECK')
  if (module?.kind !== 'ESCAPE_CHECK') throw new Error('The cling must author its dislodge.')
  return module
}

describe('an escape check landing through the effect node map (MOVE-4.T3b)', () => {
  it('keeps the SRD climb cling and its authored landing exactly as authored', async () => {
    const effect = climbCling()
    expect(dislodge(effect).holderForcedMovement).toMatchObject({ distanceMode: 'EXACT' })

    const result = await normalize(effect)

    expect(result.clearedPaths).toEqual([])
    expect(result.values).toEqual(effect)
  })

  it('keeps a landing that moves up to the mover’s speed with no distance', async () => {
    const effect = climbCling()
    dislodge(effect).holderForcedMovement = {
      id: dislodge(effect).holderForcedMovement!.id,
      effectKind: 'FORCED_MOVEMENT',
      direction: 'ANY',
      actionEconomy: 'NONE',
      distanceMode: 'UP_TO_SPEED'
    }

    const result = await normalize(effect)

    expect(result.clearedPaths).toEqual([])
    expect(result.values).toEqual(effect)
  })
})
