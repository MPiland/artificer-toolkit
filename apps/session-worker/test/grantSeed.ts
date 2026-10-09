import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import type { PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'

import type { MovementRoomConfig } from './movementRoomFixture.js'

/** Seeds the SRD Antitoxin's real planned grant, carrying `lifecycle`, onto an Encounter actor. */
export function seedModifierGrant(input: {
  sourceActorId: string
  holderActorId: string
  lifecycle: PathLifecycleAuthored
}): NonNullable<MovementRoomConfig['seed']> {
  return async ({ effects, encounterId, occurredAt }) => {
    const planned = plannedModifierGrant({ encounterId, ...input })
    await effects.create({
      id: crypto.randomUUID(),
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: input.holderActorId },
      definition: planned.definition,
      lifecycle: planned.lifecycle,
      occurredAt
    })
  }
}
