import {
  characterActor,
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { ActionRoomConfig } from './actionRoomFixture.js'
import { dependentEffectDefinition } from './movementRoomFixture.js'

/**
 * A Character actor already wearing an SRD Creature's form (D130 amendment), and the seed that stores
 * the Character-owned effect holding it, authored to keep the Character's proficiencies or not (D191).
 */
export function characterInForm(input: {
  actorId: string
  characterId: string
  effectId: string
  creature: CreatureAuthored
  retainsProficiencies: boolean
}) {
  const creature = srdCreatureActor({
    id: input.actorId,
    creature: installedSrdCreature(input.creature)
  })
  const character = characterActor({ id: input.actorId, characterId: input.characterId })
  if (
    character.kind !== 'CHARACTER' ||
    creature.kind !== 'CREATURE' ||
    !creature.sourceId ||
    !creature.sourceRevision
  )
    throw new Error('Expected a Character and an installed Creature.')
  const { sourceId, sourceRevision } = creature
  const actor = {
    ...character,
    // Initiative reads the Character's frozen identity, which a turn change checks.
    snapshot: { kind: 'CHARACTER', id: input.characterId, systemId: srdSystemRecord.id },
    form: {
      effectId: input.effectId,
      excessDamageCarriesOver: true,
      sourceId,
      sourceRevision,
      snapshot: creature.snapshot,
      currentHitPoints: creature.currentHitPoints,
      maxHitPoints: creature.maxHitPoints,
      tempHitPoints: 0
    }
  }
  // An effect on a Character's actor is stored as the Character's own row.
  const seed: NonNullable<ActionRoomConfig['seed']> = async ({
    effects,
    encounterId,
    occurredAt
  }) => {
    await effects.create({
      id: input.effectId,
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: input.actorId },
      lifecycle: { schemaVersion: 1, remainingTicks: 600 },
      definition: {
        ...dependentEffectDefinition({ encounterId, sourceActorId: input.actorId }),
        stateContributions: [
          {
            kind: 'CREATURE_FORM',
            formOutcomeId: 'form',
            creatureId: sourceId,
            excessDamageCarriesOver: true,
            retainedAbilityIds: [],
            retainsProficiencies: input.retainsProficiencies
          }
        ]
      },
      occurredAt
    })
  }
  return { actor, seed }
}
