import { describe, expect, it } from 'vitest'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_ABILITIES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  discoverEncounterBasicActions,
  isEncounterBasicActionId,
  readEncounterBasicActionEntries
} from '../encounterBasicActionCapabilityDiscovery.js'
import { SRD_SYSTEM_ID, srdDefinitions, testUuid } from '../testing/dnd5eSrdEncounter.js'

const ACTOR_ID = testUuid(0xba01)

async function discover(definitionIds: readonly string[]) {
  const entries = (
    await Promise.all(
      definitionIds.map((id) =>
        readEncounterBasicActionEntries({
          actorId: ACTOR_ID,
          actionId: `${ACTOR_ID}:BASIC_ACTION:${id}:EFFECT:x`,
          gameSystemId: SRD_SYSTEM_ID,
          definitions: srdDefinitions
        })
      )
    )
  ).flat()
  return discoverEncounterBasicActions({
    actorId: ACTOR_ID,
    gameSystemId: SRD_SYSTEM_ID,
    entries,
    conditionDefinitionIds: [],
    abilityDefinitions: SRD_ABILITIES
  })
}

describe('authored basic action compilation', () => {
  it('compiles every authored SRD entry as a BASIC_ACTION capability of the actor', async () => {
    const authored = SRD_BASIC_ACTION_DEFINITIONS.filter(({ document }) => document.effects.length)
    const { available, unavailable } = await discover(authored.map(({ id }) => id))
    expect(unavailable).toEqual([])
    expect(available.map(({ definitionId }) => definitionId).sort()).toEqual(
      authored.map(({ id }) => id).sort()
    )
    for (const capability of available) {
      expect(capability).toMatchObject({
        kind: 'BASIC_ACTION',
        restrictions: null,
        encounterActorId: ACTOR_ID,
        entryPointDefinitionId: capability.effectId,
        sourceId: capability.definitionId
      })
      expect(capability.actionId).toBe(
        `${ACTOR_ID}:BASIC_ACTION:${capability.definitionId}:EFFECT:${capability.effectId}`
      )
      expect(isEncounterBasicActionId(ACTOR_ID, capability.actionId)).toBe(true)
    }
  })

  it('names Dodge by its catalogue label', async () => {
    const { available } = await discover([SRD_BASIC_ACTION_IDS.DODGE])
    expect(available).toMatchObject([{ label: 'Dodge', definitionId: SRD_BASIC_ACTION_IDS.DODGE }])
  })

  it('offers First Aid as an authored CHECK action now that the mechanics field is gone', async () => {
    const { available } = await discover([SRD_BASIC_ACTION_IDS.FIRST_AID])
    expect(available).toMatchObject([
      { label: 'First Aid', definitionId: SRD_BASIC_ACTION_IDS.FIRST_AID }
    ])
  })

  it("reads only the entry an action id names, and nothing for another actor's id", async () => {
    const dodgeId = SRD_BASIC_ACTION_IDS.DODGE
    const read = (actorId: string, actionId: string) =>
      readEncounterBasicActionEntries({
        actorId,
        actionId,
        gameSystemId: SRD_SYSTEM_ID,
        definitions: srdDefinitions
      })
    expect(await read(ACTOR_ID, `${ACTOR_ID}:BASIC_ACTION:${dodgeId}:EFFECT:x`)).toHaveLength(1)
    expect(await read(ACTOR_ID, `${testUuid(0xba02)}:BASIC_ACTION:${dodgeId}:EFFECT:x`)).toEqual([])
    expect(await read(ACTOR_ID, `${ACTOR_ID}:CHARACTER_ACTION:${dodgeId}`)).toEqual([])
  })
})
