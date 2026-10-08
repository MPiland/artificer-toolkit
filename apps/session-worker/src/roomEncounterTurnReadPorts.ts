import type {
  EncounterTurnReadPorts,
  EncounterTurnReadTransaction
} from '@artificer-toolkit/encounter-persistence/ports'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import { MAX_BASIC_ACTION_CHOICES } from '@artificer-toolkit/schema/api/encounterActionChoices'
import { BASIC_ACTION_DEFINITION_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { roomSceneTokenReaders } from './roomActionSceneInputs.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { readRoomScene } from './roomSceneRead.js'

/**
 * A member's turn reads over the room's held state. The inputs must be a `heldOnly` view, so a
 * Character, definition or System the room does not hold current refuses the read instead of
 * loading it from Convex. The caller owns admission.
 */
export async function roomEncounterTurnReadTransaction(
  input: Parameters<typeof roomEncounterReadTransaction>[0]
): Promise<EncounterTurnReadTransaction<RoomCharacterTurnFacts>> {
  const { store, inputs, campaignId, epoch, observed } = input
  const base = await roomEncounterReadTransaction(input)
  const ports: EncounterTurnReadPorts<RoomCharacterTurnFacts> = {
    ...base.ports,
    // Reads as the Campaign owner, the same identity Convex's port reads under.
    readCharacterTurnFacts: async (campaign, characterId) => ({
      ...(await prepareRoomLiveCharacterSheet(
        store,
        inputs,
        {
          campaignId,
          authorityEpoch: epoch,
          expectedUserId: campaign.ownerUserId,
          expectedRole: 'OWNER',
          characterId
        },
        observed
      )),
      activeEffects: await listActiveRuleEffects(
        { db: store.store },
        { kind: 'CHARACTER', characterId },
        { ownerVerified: true }
      )
    }),
    listBasicActionDefinitions: async (gameSystemId) => {
      const definitions = await inputs.platformDefinitionsOfFamily(
        { gameSystemId, definitionFamilyKey: BASIC_ACTION_DEFINITION_FAMILY_KEY },
        observed
      )
      if (definitions.length > MAX_BASIC_ACTION_CHOICES)
        throw new Error('The basic-action catalogue exceeds its bound.')
      // Label then id, the order Convex's index returns.
      return definitions.sort(
        (left, right) =>
          Number(left.label > right.label) - Number(left.label < right.label) ||
          Number(left.id > right.id) - Number(left.id < right.id)
      )
    },
    sceneReaders: {
      readScene: async (sceneId) => readRoomScene(store, sceneId),
      ...roomSceneTokenReaders(store)
    }
  }
  return { db: base.db, ports }
}

type RoomCharacterTurnFacts = Awaited<ReturnType<typeof prepareRoomLiveCharacterSheet>> & {
  activeEffects: Awaited<ReturnType<typeof listActiveRuleEffects>>
}
