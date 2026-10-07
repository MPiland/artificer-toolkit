import type { InitiativeActorFactSource } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'

import {
  createStagedInitiativeRoundState,
  hydrateStagedState
} from '../encounterInitiativeStaging.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { ENCOUNTER_ID } from '../testing/dnd5eSrdEncounter.js'

/** Canonical ascending actor identities; A < B < C. */
export const ACTOR_A = '00000000-0000-4000-8000-0000000000a1'
export const ACTOR_B = '00000000-0000-4000-8000-0000000000a2'
export const ACTOR_C = '00000000-0000-4000-8000-0000000000a3'
export const SIDE_HEROES = '00000000-0000-4000-8000-0000000005a1'
export const SIDE_FOES = '00000000-0000-4000-8000-0000000005a2'

/** The staged PREPARING round Encounter start or a new round creates for these actors. */
export function preparingRound(input: {
  actors: readonly { id: string; sideId: string }[]
  round?: number
  policy?: { snapshot: EncounterInitiativePolicySnapshotDto; checksum: string }
}): EncounterInitiativeRoundStateDto {
  return hydrateStagedState(
    createStagedInitiativeRoundState({
      encounter: {
        id: ENCOUNTER_ID,
        automationMode: input.policy ? 'ASSISTED' : 'MANUAL',
        initiativePolicySnapshot: input.policy?.snapshot ?? null,
        initiativePolicySnapshotChecksum: input.policy?.checksum ?? null,
        actors: input.actors
      },
      round: input.round ?? 1
    })
  )
}

/** A Creature initiative source; the D&D adapter reads only its initiative modifier. */
export function creatureSource(
  actorId: string,
  initiativeModifier: number
): InitiativeActorFactSource {
  return {
    kind: 'CREATURE',
    actor: { id: actorId, sourceId: null, snapshot: null, sourceRevision: null },
    systemId: DND5E_SYSTEM_ID,
    actorRule: {
      actorId,
      initiativeModifier,
      targetProtection: { status: 'NOT_NORMALIZED' },
      featureResources: []
    }
  }
}

export function customSource(actorId: string): InitiativeActorFactSource {
  return {
    kind: 'CUSTOM',
    actor: { id: actorId, sourceId: null, snapshot: null, sourceRevision: null },
    systemId: null
  }
}

/** Scripted trusted dice: returns each queued value once, in order, and records each request. */
export function scriptedDice(values: readonly number[]) {
  const queue = [...values]
  const requests: { min: number; max: number }[] = []
  return {
    requests,
    remaining: () => queue.length,
    next(request: { min: number; max: number }): number {
      requests.push({ min: request.min, max: request.max })
      const value = queue.shift()
      if (value === undefined) throw new Error('The scripted dice ran out.')
      return value
    }
  }
}
