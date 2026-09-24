import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey,
  type CharacterResourceOwnerKey,
  type CharacterResourceUsage
} from '@artificer-toolkit/shared/character'

type CompiledCharacterAction = Extract<
  CompiledActionEntryPoint,
  { kind: 'CHARACTER_ACTION'; compilation: { kind: 'COMPILED' } }
>

type NativeCharacterActionMechanic = Omit<
  CharacterRulePolicyOutput['actionDecisions'][number]['mechanic'],
  'save'
> & {
  save: { abilityDefinitionId: string; dc: number | null } | null
}

type ActionIdentity = Pick<
  CharacterActionCandidate,
  'actionId' | 'effectId' | 'sourceId' | 'source'
>

export type NativeCharacterActionResourceConsumption = {
  poolId: string
  chargeId: string
  cost: number
  owner: CharacterResourceOwnerKey
  usageId: string
  beforeUsed: number
  afterUsed: number
  beforeRemaining: number
  afterRemaining: number
  characterId: string
  expectedStreamVersion: number
}

function sameSource(
  left: CharacterActionCandidate['source'],
  right: CharacterActionCandidate['source']
): boolean {
  if (left.kind !== right.kind) return false
  switch (left.kind) {
    case 'AUTHORED':
      return (
        right.kind === 'AUTHORED' &&
        left.sourceKind === right.sourceKind &&
        left.definitionId === right.definitionId &&
        left.sourceInstanceId === right.sourceInstanceId
      )
    case 'EQUIPMENT_INSTANCE':
      return (
        right.kind === 'EQUIPMENT_INSTANCE' &&
        left.equipmentId === right.equipmentId &&
        left.itemInstanceId === right.itemInstanceId
      )
    case 'SYSTEM':
      return right.kind === 'SYSTEM' && left.systemId === right.systemId
    case 'COMPANION_INSTANCE':
      return (
        right.kind === 'COMPANION_INSTANCE' &&
        left.creatureId === right.creatureId &&
        left.companionInstanceId === right.companionInstanceId
      )
    case 'MANUAL_ADJUSTMENT':
      return right.kind === 'MANUAL_ADJUSTMENT' && left.adjustmentId === right.adjustmentId
  }
}

function sameIdentity(left: ActionIdentity, right: ActionIdentity): boolean {
  return (
    left.actionId === right.actionId &&
    left.effectId === right.effectId &&
    left.sourceId === right.sourceId &&
    sameSource(left.source, right.source)
  )
}

function resourceOwner(
  resource: CharacterRulePolicyOutput['resources'][number]
): CharacterResourceOwnerKey {
  switch (resource.ownerKind) {
    case 'AUTHORED_GRANT':
      return {
        kind: resource.ownerKind,
        resourceGrantId: resource.resourceGrantId
      }
    case 'AUTHORED_SOURCE':
      return toCharacterResourceOwnerKey({
        kind: resource.ownerKind,
        chargeId: resource.chargeId,
        source: resource.source
      })
    case 'ITEM_INSTANCE':
      return toCharacterResourceOwnerKey({
        kind: resource.ownerKind,
        chargeId: resource.chargeId,
        itemInstanceId: resource.itemInstanceId
      })
    case 'COMPANION_FEATURE':
      return toCharacterResourceOwnerKey({
        kind: resource.ownerKind,
        chargeId: resource.chargeId,
        companionInstanceId: resource.companionInstanceId,
        featureId: resource.featureId
      })
    case 'SPELL_SOURCE':
      throw new Error(
        'Spell-source resource actions are not supported by this Character action entry point.'
      )
  }
}

function stale(): never {
  throw new Error('The committed Character action resource is unavailable or stale.')
}

export function prepareNativeCharacterActionState(input: {
  entry: CompiledCharacterAction
  candidate: CharacterActionCandidate
  policyOutput: CharacterRulePolicyOutput
  resourceUsage: readonly CharacterResourceUsage[]
  characterId: string
  expectedStreamVersion: number
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
}): {
  actionMechanic: NativeCharacterActionMechanic
  resourceConsumption: NativeCharacterActionResourceConsumption | null
} {
  if (
    !Number.isSafeInteger(input.expectedStreamVersion) ||
    input.expectedStreamVersion < 0 ||
    input.entry.actionId !== input.candidate.actionId ||
    input.entry.effectId !== input.candidate.effectId
  )
    stale()
  const decision = input.policyOutput.actionDecisions.find(
    (value) => value.actionId === input.candidate.actionId
  )
  if (!decision || !sameIdentity(decision, input.candidate) || decision.status !== 'AVAILABLE')
    stale()

  const savingThrow = input.candidate.mechanicFacts.invocation.savingThrow
  const actionMechanic: NativeCharacterActionMechanic = {
    ...decision.mechanic,
    save:
      decision.mechanic.save === null
        ? null
        : savingThrow
          ? {
              abilityDefinitionId: savingThrow.abilityDefinitionId,
              dc: decision.mechanic.save.dc
            }
          : stale()
  }

  const binding =
    input.entry.schemaVersion === 2 ||
    input.entry.schemaVersion === 3 ||
    input.entry.schemaVersion === 4
      ? input.entry.compilation.resourceBinding
      : null
  if (binding === null) {
    if (
      input.candidate.resourceUse !== null ||
      decision.resourcePoolId !== null ||
      decision.resourceCost !== null
    )
      stale()
    return { actionMechanic, resourceConsumption: null }
  }
  if (!Number.isSafeInteger(binding.cost) || binding.cost < 1) stale()
  const resource = input.policyOutput.resources.find((value) => value.poolId === binding.poolId)
  if (
    !input.candidate.resourceUse ||
    input.candidate.resourceUse.poolId !== binding.poolId ||
    input.candidate.resourceUse.chargeId !== binding.chargeId ||
    input.candidate.resourceUse.cost !== binding.cost ||
    decision.resourcePoolId !== binding.poolId ||
    decision.resourceCost !== binding.cost ||
    !resource ||
    resource.state !== 'RESOLVED' ||
    resource.chargeId !== binding.chargeId ||
    !Number.isSafeInteger(resource.rawUsed) ||
    resource.rawUsed < 0 ||
    resource.remaining === null ||
    !Number.isSafeInteger(resource.remaining) ||
    resource.remaining < binding.cost
  )
    stale()

  const owner = resourceOwner(resource)
  if (createCharacterResourceOwnerKey(owner) !== binding.poolId) stale()
  const matchingUsage = input.resourceUsage.filter(
    (usage) => createCharacterResourceOwnerKey(usage.owner) === binding.poolId
  )
  if (
    matchingUsage.length > 1 ||
    input.resourceUsage.some(
      (usage) =>
        usage.characterId !== input.characterId ||
        !Number.isSafeInteger(usage.used) ||
        usage.used < 0
    )
  )
    stale()
  const existing = matchingUsage[0]
  const beforeUsed = existing?.used ?? 0
  if (beforeUsed !== resource.rawUsed) stale()
  if (input.automationMode === 'MANUAL') return { actionMechanic, resourceConsumption: null }
  const afterUsed = beforeUsed + binding.cost
  const afterRemaining = resource.remaining - binding.cost
  if (
    !Number.isSafeInteger(afterUsed) ||
    !Number.isSafeInteger(afterRemaining) ||
    afterRemaining < 0
  )
    stale()
  return {
    actionMechanic,
    resourceConsumption: {
      poolId: binding.poolId,
      chargeId: binding.chargeId,
      cost: binding.cost,
      owner,
      usageId: existing?.id ?? crypto.randomUUID(),
      beforeUsed,
      afterUsed,
      beforeRemaining: resource.remaining,
      afterRemaining,
      characterId: input.characterId,
      expectedStreamVersion: input.expectedStreamVersion
    }
  }
}
