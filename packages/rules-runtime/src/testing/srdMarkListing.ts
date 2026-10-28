import type { ActiveGrantListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'

import { listActiveGrantListings } from '../activeGrantListings.js'
import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import { prepareAttackTargetGrantTriggers } from '../encounterAttackAppliedEffects.js'
import { SRD, srdByLabel } from './dnd5eSrdCharacter.js'
import {
  ENCOUNTER_ID,
  srdCreatureActor,
  srdCreatureTarget,
  srdEncounterState,
  TIMESTAMP,
  testUuid
} from './dnd5eSrdEncounter.js'

/**
 * The GM's listing of the SRD mark (ATTACK-13) a melee attack by `markerActorId` leaves on
 * `holderActorId`, built by the Encounter's own attack, effect-record and listing code.
 */
export function srdMarkListing(input: {
  markerActorId: string
  holderActorId: string
}): ActiveGrantListingDto {
  const goblin = srdByLabel(SRD.creatures, 'Goblin')
  const marker = srdCreatureActor({ id: input.markerActorId, creature: goblin })
  const holder = srdCreatureActor({ id: input.holderActorId, creature: goblin })
  const [mark] = prepareAttackTargetGrantTriggers({
    encounter: srdEncounterState({
      actors: [marker, holder],
      currentActorId: marker.id,
      optionalCombatKinds: ['MARK']
    }),
    attacker: marker,
    target: srdCreatureTarget(holder),
    occurrenceId: testUuid(0x13e0),
    commandId: testUuid(0x13e1),
    activeEffectsByActorId: new Map()
  })
  if (!mark) throw new Error('The SRD Marking rule gave no mark.')
  const [listing] = listActiveGrantListings([
    prepareActiveRuleEffectRecord({
      id: mark.id,
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: holder.id },
      definition: mark.effect.definition,
      lifecycle: mark.effect.lifecycle,
      currentEffects: [],
      occurredAt: TIMESTAMP
    })
  ])
  if (!listing) throw new Error('The SRD mark lists no grant.')
  return listing
}
