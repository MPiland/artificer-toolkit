import {
  reactionMovementTriggerBindingDtoSchema,
  type ReactionMovementTriggerBindingDto
} from '@artificer-toolkit/schema/shared/reaction'

import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'

export interface MovementReactionCapabilityDescriptor<
  TCapability extends EffectActionCapabilityDescriptor = EffectActionCapabilityDescriptor
> {
  capability: TCapability
  binding: ReactionMovementTriggerBindingDto
}

function bindingOf(
  capability: EffectActionCapabilityDescriptor
): ReactionMovementTriggerBindingDto | null {
  const normalized = capability.mechanicFacts.invocation.reactionMovementTrigger
  const compiled =
    'reactionMovementTrigger' in capability.compiledEffect.invocation
      ? capability.compiledEffect.invocation.reactionMovementTrigger
        ? reactionMovementTriggerBindingDtoSchema.parse(
            capability.compiledEffect.invocation.reactionMovementTrigger
          )
        : null
      : null
  if (JSON.stringify(normalized) !== JSON.stringify(compiled)) {
    throw new Error(
      'Effect action capability reaction movement binding does not match the compiled Effect.'
    )
  }
  return normalized
}

export function discoverMovementReactionCapabilities<
  TCapability extends EffectActionCapabilityDescriptor
>(
  capabilities: readonly TCapability[]
): readonly MovementReactionCapabilityDescriptor<TCapability>[] {
  const discovered: MovementReactionCapabilityDescriptor<TCapability>[] = []
  for (const capability of capabilities) {
    const binding = bindingOf(capability)
    const invocation = capability.compiledEffect.invocation
    const normalized = capability.mechanicFacts.invocation
    if (
      binding === null ||
      invocation.kind !== 'ACTION' ||
      invocation.activation.code !== 'REACTION' ||
      normalized.activation?.code !== 'REACTION' ||
      normalized.activation.amount !== invocation.activation.amount
    )
      continue
    discovered.push({ capability, binding })
  }
  return discovered.sort((left, right) => {
    const leftKey = [
      left.capability.gameSystemId,
      left.capability.kind,
      left.capability.sourceId,
      left.capability.effectId,
      left.capability.actionId
    ].join('\u0000')
    const rightKey = [
      right.capability.gameSystemId,
      right.capability.kind,
      right.capability.sourceId,
      right.capability.effectId,
      right.capability.actionId
    ].join('\u0000')
    return leftKey.localeCompare(rightKey)
  })
}
