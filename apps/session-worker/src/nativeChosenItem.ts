import type { NativeEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { encounterChosenItemRefusal } from '@artificer-toolkit/rules-runtime/encounterChosenItem'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'

import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'

/**
 * The item instance an action names. A Character action's item choice is known before it rolls; a
 * Creature's plan follows its roll. A target that cannot take the chosen item refuses the action.
 */
export function requireChosenItemInstance(input: {
  source: NativeEncounterActionSource
  commandTarget: ResolveEncounterActionInputDto['target']
  targetMovement: Parameters<typeof encounterChosenItemRefusal>[0]['target'] | undefined
}) {
  const { source, commandTarget, targetMovement } = input
  const itemInstanceId =
    source.kind === 'REPEAT_PATH'
      ? source.boundItemInstanceId
      : commandTarget.kind === 'ACTOR'
        ? commandTarget.boundItemInstanceId
        : undefined
  const refusal =
    source.kind === 'CHARACTER_ACTION' && targetMovement
      ? encounterChosenItemRefusal({
          plan: source.entry.compilation.activeEffectPlan?.chosenItem,
          target: targetMovement,
          itemInstanceId
        })
      : null
  if (refusal !== null)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: refusal
    })
  return itemInstanceId
}
