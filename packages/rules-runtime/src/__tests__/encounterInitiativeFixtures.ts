import type { InitiativeActorFactSource } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'

import {
  createStagedInitiativeRoundState,
  hydrateStagedState,
  inMemoryInitiativeRepository,
  serializeStagedInitiativeRoundState
} from '../encounterInitiativeStaging.js'
import {
  applyEncounterInitiativeAdvance,
  planEncounterInitiativeAdvance,
  settleEncounterInitiativeRound
} from '../encounterInitiativeStateSettlement.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { ENCOUNTER_ID } from '../testing/dnd5eSrdEncounter.js'
import { initiativePolicySnapshot } from '../testing/initiativePolicySnapshot.js'

/** Canonical ascending actor identities; A < B < C. */
export const ACTOR_A = '00000000-0000-4000-8000-0000000000a1'
export const ACTOR_B = '00000000-0000-4000-8000-0000000000a2'
export const ACTOR_C = '00000000-0000-4000-8000-0000000000a3'
export const SIDE_HEROES = '00000000-0000-4000-8000-0000000005a1'
export const SIDE_FOES = '00000000-0000-4000-8000-0000000005a2'

/** The staged PREPARING round Encounter start or a new round creates for these actors. */
export function preparingRound(input: {
  actors: readonly { id: string; sideId: string; owner?: { ownerActorId: string } }[]
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

/** The round with `currentActorId` taking its turn in `order`, as the real settlement leaves it. */
export async function roundAt(
  order: readonly string[],
  currentActorId: string,
  cadence: 'ENCOUNTER_START' | 'EACH_ROUND'
): Promise<EncounterInitiativeRoundStateDto> {
  let state = preparingRound({
    actors: order.map((id) => ({ id, sideId: SIDE_FOES })),
    ...(cadence === 'EACH_ROUND'
      ? { policy: initiativePolicySnapshot({ procedure: 'ACTOR_ROLL', cadence }) }
      : {})
  })
  state = await settleEncounterInitiativeRound({
    repository: inMemoryInitiativeRepository(state).repository,
    state,
    orderedActorIds: order
  })
  for (const actorId of order.slice(0, order.indexOf(currentActorId))) {
    const plan = planEncounterInitiativeAdvance({
      state,
      currentActorId: actorId,
      defeatedActorIds: new Set()
    })
    state = await applyEncounterInitiativeAdvance({
      repository: inMemoryInitiativeRepository(state).repository,
      state,
      plan,
      defeatedActorIds: new Set()
    })
  }
  return hydrateStagedState(serializeStagedInitiativeRoundState(state))
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
