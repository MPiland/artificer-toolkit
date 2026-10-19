import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'

/**
 * SPELLS-31.T4k2a (D156): the Hunter's Escape the Horde, authored as disadvantage on attacks against
 * its holder made on the `OPPORTUNITY` occasion, gives a reaction attack its walk provokes
 * disadvantage.
 */

const MOVER_ID = testUuid(0xe20)
const REACTOR_ID = testUuid(0xe21)
const CHARACTER_ID = testUuid(0xe22)
const MOVER_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The SRD Escape the Horde option, acquired by the fixture Character at its first level. */
const escapeTheHorde = () => {
  const option = hunterConclave.features
    ?.find((feature) => feature.label === 'Defensive Tactics')
    ?.options?.find((entry) => entry.label === 'Escape the Horde')
  if (!option?.grants) throw new Error('The SRD Hunter must author Escape the Horde.')
  return {
    id: option.id,
    label: option.label,
    description: option.description,
    availableAtLevel: 1,
    order: 0,
    grants: option.grants
  }
}

/** Walks the Character past a Wolf, uses the opportunity attack offered and returns its roll mode. */
async function opportunityAttackRollMode(input: { escapeTheHorde: boolean }) {
  const room = await movementRoom({
    actors: [
      srdCreatureActor({ id: REACTOR_ID, creature: reactionWolf }),
      characterActor({ id: MOVER_ID, characterId: CHARACTER_ID })
    ],
    moverActorId: MOVER_ID,
    positions: { [REACTOR_ID]: { x: 50, y: 150 }, [MOVER_ID]: MOVER_START },
    characterClassFeatures: input.escapeTheHorde ? [escapeTheHorde()] : []
  })
  await room.move([MOVER_START, { x: 450, y: 150 }])
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  const option = pending.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  await room.respond({ kind: 'OPTION', optionId: option.optionId })
  const prompt = await room.pendingFor(true)
  if (prompt?.kind !== 'D20_EVIDENCE') throw new Error('Expected the reaction attack roll.')
  return prompt.request.rollMode
}

describe('room Escape the Horde (SPELLS-31.T4k2a)', () => {
  it('rolls an opportunity attack at a Character without it normally', async () => {
    expect(await opportunityAttackRollMode({ escapeTheHorde: false })).toBe('NORMAL')
  }, 120000)

  it('gives the opportunity attack disadvantage against a Character with it', async () => {
    expect(await opportunityAttackRollMode({ escapeTheHorde: true })).toBe('DISADVANTAGE')
  }, 120000)
})
