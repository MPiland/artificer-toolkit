import { runInDurableObject } from 'cloudflare:test'
import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { seededInitiativePolicySnapshot } from '@artificer-toolkit/rules-runtime/testing/initiativePolicySnapshot'
import { SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/initiativePolicies.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * ENCOUNTER-4.T1: the seeded DMG Speed Factor initiative variant through the public START command
 * of the real local room. Each actor declares its action, the declared modifiers order the round,
 * and the acting actor may take only the action it declared.
 */

/** Every die the room rolls shows this face (zero-based): each d20 a 19. */
const DIE = 18
const GOBLIN_ID = testUuid(0x4e10)
const WOLF_ID = testUuid(0x4e11)
const LOW_DEXTERITY_WOLF_ID = testUuid(0x4e0f)
const goblin = srdByLabel(SRD.creatures, 'Goblin')
const lowDexterityWolf = {
  ...plainWolf,
  abilityScores: { ...plainWolf.abilityScores, DEXTERITY: plainWolf.abilityScores.DEXTERITY - 1 }
}

afterEach(closeTrackedSockets)

type Room = Awaited<ReturnType<typeof speedFactorRoom>>
type Answer = Awaited<ReturnType<Room['send']>>

function speedFactorRoom(
  actors = [
    srdCreatureActor({ id: GOBLIN_ID, creature: goblin }),
    srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
  ]
) {
  return actionRoom({
    actors,
    ownerFeatureId: creatureFeature(goblin, 'Scimitar').id,
    status: 'PREPARED',
    initiativePolicy: seededInitiativePolicySnapshot(
      SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID
    ),
    autoRoll: 'EVERYONE',
    fallbackRoll: DIE
  })
}

function pendingOf(answer: Answer) {
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return answer.type === 'COMMAND_COMMITTED' && answer.delta?.scope === 'ENCOUNTER'
    ? answer.delta.result.occurrence?.pending
    : undefined
}

/**
 * The GM starts the Run and answers each initiative prompt: the Goblin declares its Scimitar, the
 * Wolf its first offered action. Returns the actors the room asked to declare, in order.
 */
async function startDeclaringScimitar(room: Room) {
  let pending = pendingOf(
    await room.send({
      type: 'START',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
  )
  const declared: string[] = []
  for (let prompt = 0; pending && prompt < 10; prompt += 1) {
    if (pending.kind !== 'INITIATIVE_DECLARATION')
      throw new Error(`Unexpected initiative prompt ${pending.kind}.`)
    const actorId = pending.actorId
    const option =
      actorId === GOBLIN_ID
        ? pending.primaryOptions.find(({ label }) => label === 'Scimitar')
        : pending.primaryOptions[0]
    if (!option || option.kind !== 'CREATURE_FEATURE_ACTION')
      throw new Error('The room offers no Creature action to declare.')
    declared.push(actorId)
    pending = pendingOf(
      await room.send({
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        correlationId: null,
        resolution: {
          kind: 'INITIATIVE_DECLARATION',
          requestId: pending.requestId,
          primary: { kind: option.kind, optionId: option.optionId },
          bonus: null
        }
      })
    )
  }
  return declared
}

/** The current actor and each actor's settled initiative, as the room stores the Run. */
function readTurnOrder(room: Room, actorIds: readonly string[]) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const store = new RoomEncounterStore(context.storage)
    const [run] = store.documents('encounterRuns')
    if (!run) throw new Error('The room holds no Run.')
    const scoreOf = (actorId: string): unknown => {
      const row = store
        .documents('encounterInitiativeParticipants')
        .find((participant) => participant.actorId === actorId)
      if (!row) throw new Error('The Run holds no such participant.')
      return row.initiativeScore
    }
    return {
      currentActorId: JSON.parse(run.stateJson).currentActorId,
      initiatives: Object.fromEntries(actorIds.map((id) => [id, scoreOf(id)]))
    }
  })
}

describe('the Speed Factor initiative variant (ENCOUNTER-4.T1)', () => {
  it('orders the round by the declared modifiers and holds the Goblin to its declared Scimitar', async () => {
    const room = await speedFactorRoom()

    expect(new Set(await startDeclaringScimitar(room))).toEqual(new Set([GOBLIN_ID, WOLF_ID]))

    // Both roll a 19 with a +2 Dexterity modifier; the Small Goblin's +2 size modifier puts it first.
    expect(await readTurnOrder(room, [GOBLIN_ID, WOLF_ID])).toEqual({
      currentActorId: GOBLIN_ID,
      initiatives: { [GOBLIN_ID]: 19 + 2 + 2, [WOLF_ID]: 19 + 2 }
    })

    const shortbow = room.featureActionId(
      srdCreatureActor({ id: GOBLIN_ID, creature: goblin }),
      creatureFeature(goblin, 'Shortbow').id
    )
    const refused = await room.startAction(WOLF_ID, [], room.sceneContext(1), null, shortbow)
    expect(refused.answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'UNDECLARED_ACTION' })

    const declared = await room.startAction(WOLF_ID, [], room.sceneContext(1))
    expect(declared.answer.type, JSON.stringify(declared.answer)).toBe('COMMAND_COMMITTED')
  }, 120000)

  it('settles a tied score by the higher Dexterity score, whatever the actor identities', async () => {
    // Both Medium Wolves roll a 19 and declare the same action, and Dexterity 14 and 15 both give +2.
    // The lower-Dexterity Wolf holds the lower identity, so only the authored tie rule puts the other first.
    const room = await speedFactorRoom([
      srdCreatureActor({ id: LOW_DEXTERITY_WOLF_ID, creature: lowDexterityWolf }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ])

    await startDeclaringScimitar(room)

    expect(await readTurnOrder(room, [LOW_DEXTERITY_WOLF_ID, WOLF_ID])).toEqual({
      currentActorId: WOLF_ID,
      initiatives: { [LOW_DEXTERITY_WOLF_ID]: 19 + 2, [WOLF_ID]: 19 + 2 }
    })
  }, 120000)
})
