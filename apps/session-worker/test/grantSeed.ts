import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import type { EffectAuthored, PathLifecycleAuthored } from '@artificer-toolkit/shared/authored'

import type { MovementRoomConfig } from './movementRoomFixture.js'

/**
 * Seeds the real planned grant of `effect` (the SRD Antitoxin's by default), carrying `lifecycle`,
 * onto an Encounter actor; a Character actor's grant becomes a row of its Character.
 */
export function seedModifierGrant(input: {
  sourceActorId: string
  holderActorId: string
  lifecycle: PathLifecycleAuthored
  effect?: EffectAuthored
  sourceLabel?: string
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
