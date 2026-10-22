import {
  collectSpatialMeleeRetaliationCandidates,
  collectSpatialMovementCandidates,
  collectSpatialTurnCandidates
} from '@artificer-toolkit/shared/vtt'

import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'

// The zone contacts a raise site acts on: the shared geometry reports how a creature meets each
// zone, and the event table (ADR 0039) keeps the contacts whose zone subscribes to that event.

/** The movement contacts whose zone subscribes to how the mover met it (enter, leave or cross). */
export function zoneMovementContacts(
  input: Parameters<typeof collectSpatialMovementCandidates>[0]
) {
  return collectSpatialMovementCandidates(input).filter((candidate) => {
    const zone = input.effects.find((effect) => effect.effectId === candidate.effectId)
    return (
      zone !== undefined &&
      discoverEncounterEventHooks({
        zones: [zone],
        events: [{ kind: 'ZONE_MOVEMENT', movement: candidate.trigger }]
      }).zones.length > 0
    )
  })
}

/** The zones a creature stands in at a turn boundary they subscribe to. */
export function zoneTurnContacts(input: Parameters<typeof collectSpatialTurnCandidates>[0]) {
  const { zones } = discoverEncounterEventHooks({
    zones: input.effects,
    events: [{ kind: 'ZONE_TURN', boundary: input.trigger }]
  })
  return collectSpatialTurnCandidates({ ...input, effects: zones })
}

/** The zones on the hit creature that answer a melee hit and that the attacker stands in. */
export function zoneMeleeRetaliationContacts(
  input: Parameters<typeof collectSpatialMeleeRetaliationCandidates>[0]
) {
  const { zones } = discoverEncounterEventHooks({
    zones: input.effects,
    events: [{ kind: 'ZONE_SOURCE_MELEE_HIT' }]
  })
  return collectSpatialMeleeRetaliationCandidates({ ...input, effects: zones })
}
