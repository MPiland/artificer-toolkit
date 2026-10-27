import { encounterRuleActionId } from '@artificer-toolkit/rules-runtime/encounterRuleAction'
import { systemTriggerCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { DND5E_MASSIVE_DAMAGE_DEFINITION_ID } from '@artificer-toolkit/schema/shared/optionalCombat'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * ATTACK-16.T1b: a rule's own action (a rule-owned source) runs only when the rule raises it. An
 * action submitted through the public command that names one is refused for a Creature and a
 * Character alike, so no one applies a rule's outcomes at will.
 */

const OGRE_ID = testUuid(0x16e0)
const CHARACTER_ACTOR_ID = testUuid(0x16e1)
const CHARACTER_ID = testUuid(0x16e2)
const RAISED_EFFECT_ID = testUuid(0x16e3)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const ogre = srdByLabel(SRD.creatures, 'Ogre')

function ruleRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: OGRE_ID, creature: ogre }),
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER' as const, id: CHARACTER_ID, systemId: srdSystemRecord.id }
      }
    ],
    ownerFeatureId: creatureFeature(ogre, 'Greatclub').id,
    optionalCombatKinds: ['MASSIVE_DAMAGE']
  })
}

describe('a rule-owned action named through the public command (ATTACK-16.T1b)', () => {
  it.each([
    ['Creature', OGRE_ID],
    ['Character', CHARACTER_ACTOR_ID]
  ])('is refused for a %s and changes nothing', async (_kind, actorId) => {
    const room = await ruleRoom()
    const version = await room.version()
    const answer = await room.send({
      type: 'RESOLVE_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: version,
      actorId,
      actionId: encounterRuleActionId(
        actorId,
        DND5E_MASSIVE_DAMAGE_DEFINITION_ID,
        RAISED_EFFECT_ID
      ),
      target: { kind: 'ACTOR', actorId },
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      sceneContext: null
    })
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'SOURCE_REQUIREMENTS_NOT_MET'
    })
    expect(await room.version()).toBe(version)
  })

  it('is refused when it claims a rule raised it with no failed save behind it', async () => {
    const room = await ruleRoom()
    const version = await room.version()
    const parentCommandId = crypto.randomUUID()
    const actionId = encounterRuleActionId(
      OGRE_ID,
      DND5E_MASSIVE_DAMAGE_DEFINITION_ID,
      RAISED_EFFECT_ID
    )
    const answer = await room.send({
      type: 'RESOLVE_ACTION',
      encounterId: room.room.encounterId,
      commandId: systemTriggerCommandId(parentCommandId, OGRE_ID, actionId),
      expectedVersion: version,
      actorId: OGRE_ID,
      actionId,
      target: { kind: 'ACTOR', actorId: OGRE_ID },
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      sceneContext: null,
      systemTrigger: { parentCommandId, trigger: 'RULE' }
    })
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'COMMAND_ID_REUSED' })
    expect(await room.version()).toBe(version)
  })
})
