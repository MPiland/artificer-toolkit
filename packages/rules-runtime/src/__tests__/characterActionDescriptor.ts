import type { compileEffect } from '@artificer-toolkit/shared/compilers'

import type { CharacterActionCapabilityDescriptor } from '../characterActionCapabilityDiscovery.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'

export const ACTION_EFFECT_ID = '00000000-0000-4000-8000-000000000010'

/** A Character action capability wrapping one compiled Effect, as discovery would describe it. */
export function characterActionDescriptor(
  compiledEffect: ReturnType<typeof compileEffect>
): CharacterActionCapabilityDescriptor {
  return {
    kind: 'CHARACTER_ACTION',
    gameSystemId: DND5E_SYSTEM_ID,
    authoredRootKind: 'effect',
    entryPointDefinitionId: ACTION_EFFECT_ID,
    effectId: ACTION_EFFECT_ID,
    actionId: `source:ACTION:${ACTION_EFFECT_ID}`,
    sourceId: 'source',
    source: {
      kind: 'AUTHORED',
      sourceKind: 'FEATURE',
      definitionId: 'feature',
      sourceInstanceId: 'source'
    },
    mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
    activationSourceKind: 'ACTIVE_SOURCE',
    compiledEffect
  } as CharacterActionCapabilityDescriptor
}
