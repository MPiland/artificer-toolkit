import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { CharacterSpellSlotConsumptionFieldsDto } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey,
  type CharacterResourceOwnerKey,
  type CharacterResourceUsage
} from '@artificer-toolkit/shared/character'
import { EncounterValidationError, StaleCharacterActionError } from '../encounterErrors.js'
import { dividesHealing, spendsChosenUnits } from './characterChosenSpend.js'
import { selectAmmunition, type AmmunitionStack } from './characterAmmunition.js'
import { readSpellCastSlot } from './characterSpellCastActions.js'
import { spellCastActionId } from '../spellCastCandidates.js'

type CompiledCharacterAction = Extract<
  CompiledActionEntryPoint,
  { kind: 'CHARACTER_ACTION'; compilation: { kind: 'COMPILED' } }
>

type NativeCharacterActionMechanic = Omit<
  CharacterRulePolicyOutput['actionDecisions'][number]['mechanic'],
  'save'
> & {
  save: { abilityDefinitionId: string; dc: number | null } | null
  /** The level a spell is cast at, which selects the authored scaling row of its outcomes. */
  spellCastLevel?: number
  /** The Character's level in each class, which selects class-level scaling rows of its outcomes. */
  classLevels?: Readonly<Record<string, number>>
  /** The optional on-hit riders the player chose (D123), whose merged outcomes then resolve. */
  selectedOptionalRiderIds?: readonly string[]
  /** The units the caster spent from the action's pool, for a heal that gives hit points per unit spent. */
  spentUnits?: number
  /** This creature's share of the pool the caster divides among the creatures the action reaches. */
  dividedAmount?: number
}

/** The resolved mechanics of the spell cast a Character action makes; undefined for any other action. */
export function castMechanicsOf(
  policyOutput: Pick<CharacterRulePolicyOutput, 'spellCastMechanics'>,
  candidate: Pick<CharacterActionCandidate, 'actionId' | 'effectId' | 'mechanicsOwner'>
) {
  return candidate.mechanicsOwner.kind === 'SPELL'
    ? policyOutput.spellCastMechanics.find(castActionNames(candidate))
    : undefined
}

/** A spell cast's action id is a digest of its cast candidate's id, so the id names the candidate. */
function castActionNames(candidate: Pick<CharacterActionCandidate, 'actionId' | 'effectId'>) {
  return (value: { candidateId: string }) =>
    [undefined, candidate.effectId].some(
      (laterEffectId) => spellCastActionId(value.candidateId, laterEffectId) === candidate.actionId
    )
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

export type NativeCharacterItemConsumption = {
  characterId: string
  itemInstanceId: string
  beforeUsed: number
  afterUsed: number
  beforeQuantity: number
  afterQuantity: number
  expectedStreamVersion: number
}

export type NativeCharacterSpellConsumption = CharacterSpellSlotConsumptionFieldsDto & {
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
    case 'ACTIVE_EFFECT':
      return right.kind === 'ACTIVE_EFFECT' && left.activeEffectId === right.activeEffectId
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

export function resourceOwner(
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
      return toCharacterResourceOwnerKey({
        kind: resource.ownerKind,
        resourceGrantId: resource.accessId,
        source: {
          spellId: resource.spellId,
          sourceKind: 'FEATURE',
          sourceInstanceId: resource.sourceInstanceId
        }
      })
  }
}

function stale(): never {
  throw new StaleCharacterActionError()
}

/**
 * The one place a pool charge is spent: checks the pool row against the Character's usage rows and
 * returns the usage change, or null when Manual play, or an overridable shortfall, spends nothing.
 * "Do it anyway" spends only what remains and records the shortfall in `ruleWarnings`.
 */
export function spendCharacterResource(input: {
  resource: CharacterRulePolicyOutput['resources'][number] | undefined
  binding: { poolId: string; chargeId: string; cost: number }
  resourceUsage: readonly CharacterResourceUsage[]
  characterId: string
  expectedStreamVersion: number
  automationMode: AutomationModeDto
  overridable: boolean
  ruleWarnings: EncounterRuleWarningDto[]
}): NativeCharacterActionResourceConsumption | null {
  const { resource, binding } = input
  if (
    !resource ||
    resource.state !== 'RESOLVED' ||
    resource.chargeId !== binding.chargeId ||
    !Number.isSafeInteger(resource.rawUsed) ||
    resource.rawUsed < 0 ||
    resource.remaining === null ||
    !Number.isSafeInteger(resource.remaining) ||
    resource.remaining < 0 ||
    (!input.overridable && resource.remaining < binding.cost)
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
  if (input.automationMode === 'MANUAL') return null
  const spent = Math.min(binding.cost, resource.remaining)
  if (spent < binding.cost)
    input.ruleWarnings.push({
      code: 'RESOURCE_UNAVAILABLE',
      message: `Not enough uses left: needs ${binding.cost}, has ${resource.remaining}.`
    })
  if (spent === 0) return null
  const afterUsed = beforeUsed + spent
  if (!Number.isSafeInteger(afterUsed)) stale()
  return {
    poolId: binding.poolId,
    chargeId: binding.chargeId,
    cost: spent,
    owner,
    usageId: existing?.id ?? crypto.randomUUID(),
    beforeUsed,
    afterUsed,
    beforeRemaining: resource.remaining,
    afterRemaining: resource.remaining - spent,
    characterId: input.characterId,
    expectedStreamVersion: input.expectedStreamVersion
  }
}

export function prepareNativeCharacterActionState(input: {
  entry: CompiledCharacterAction
  candidate: CharacterActionCandidate
  /** The units the caster chose to spend from the action's pool; required by a heal that gives hit points per unit spent. */
  spentUnits?: number
  /** This creature's share of a pool the caster divides among the creatures the action reaches; required by an action that divides one. */
  dividedAmount?: number
  /** The offered cast modifier the caster pays; spent beside the spell's own cost. */
  castModifier?: NonNullable<CharacterActionCandidate['castModifiers']>[number] | null
  policyOutput: CharacterRulePolicyOutput
  resourceUsage: readonly CharacterResourceUsage[]
  /** The effective inventory: used-up rows are already hidden. */
  inventory: readonly { id: string; quantity: number }[]
  itemUsage: readonly { itemInstanceId: string; used: number }[]
  characterId: string
  expectedStreamVersion: number
  classLevels: readonly { classId: string; level: number }[]
  automationMode: AutomationModeDto
  /** The Encounter's frozen Campaign option: an ammunition attack draws pieces from its stack. */
  trackAmmunition: boolean
  /** What the command fires: the stack it names, and how many attacks it makes (one piece each); null for a read. */
  ammunition: { itemInstanceId?: string; attacks: number } | null
  /** Assisted RESOLVE_ACTION reports overridable warnings; every other caller refuses them. */
  overridable: boolean
}): {
  actionMechanic: NativeCharacterActionMechanic
  resourceConsumption: NativeCharacterActionResourceConsumption | null
  itemConsumption: NativeCharacterItemConsumption | null
  spellConsumption: NativeCharacterSpellConsumption | null
  /** The ammunition stack this attack fires, whose modifiers apply to it alone. */
  ammunition: AmmunitionStack | null
  ruleWarnings: EncounterRuleWarningDto[]
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
  if (!decision || !sameIdentity(decision, input.candidate)) stale()
  // An overridable action may lack its equip or resource; any other refusal is stale.
  const { overridable } = input
  const notEquipped =
    decision.status === 'UNAVAILABLE' && decision.reasonCode === 'SOURCE_NOT_EQUIPPED'
  if (
    decision.status !== 'AVAILABLE' &&
    !(overridable && (notEquipped || decision.reasonCode === 'INSUFFICIENT_RESOURCE'))
  )
    stale()
  const ruleWarnings: EncounterRuleWarningDto[] = notEquipped
    ? [{ code: 'SOURCE_NOT_EQUIPPED', message: "The item this action uses isn't equipped." }]
    : []

  // Manual play counts and applies nothing; otherwise the attack fires the stack it was given.
  const fired =
    input.automationMode === 'MANUAL'
      ? null
      : selectAmmunition({
          equipment: input.candidate.equipment,
          inventory: input.inventory,
          requestedItemInstanceId: input.ammunition?.itemInstanceId,
          preview: !input.ammunition
        })
  const ammunition = fired?.stack ?? null
  const baseMechanic = ammunition
    ? (decision.ammunitionMechanics?.find(
        ({ itemInstanceId }) => itemInstanceId === ammunition.itemInstanceId
      )?.mechanic ?? stale())
    : decision.mechanic
  const savingThrow = input.candidate.mechanicFacts.invocation.savingThrow
  const isSpellCast = input.candidate.mechanicsOwner.kind === 'SPELL'
  const namesCast = castActionNames(input.candidate)
  const spellCastLevel = castMechanicsOf(input.policyOutput, input.candidate)?.castLevel
  // A heal that gives hit points per unit spent takes the units the caster chose, each at the pool's cost.
  const choosesUnits = spendsChosenUnits(input.candidate)
  if (choosesUnits !== (input.spentUnits !== undefined))
    throw new EncounterValidationError(
      choosesUnits ? 'Choose how many to spend.' : 'This action does not spend a chosen amount.'
    )
  if (dividesHealing(input.candidate) !== (input.dividedAmount !== undefined))
    throw new EncounterValidationError(
      input.dividedAmount === undefined
        ? 'Divide the healing among the targets.'
        : 'This action does not divide an amount.'
    )
  const actionMechanic: NativeCharacterActionMechanic = {
    ...baseMechanic,
    ...(spellCastLevel === undefined ? {} : { spellCastLevel }),
    ...(input.spentUnits === undefined ? {} : { spentUnits: input.spentUnits }),
    ...(input.dividedAmount === undefined ? {} : { dividedAmount: input.dividedAmount }),
    classLevels: Object.fromEntries(
      input.classLevels.map(({ classId, level }) => [classId, level])
    ),
    save:
      baseMechanic.save === null
        ? null
        : savingThrow
          ? {
              abilityDefinitionId: savingThrow.abilityDefinitionId,
              dc: baseMechanic.save.dc
            }
          : stale()
  }

  // A single-use item is used up in Assisted play whether or not the GM overrides a warning.
  const consumedItem =
    input.automationMode !== 'MANUAL' && input.candidate.equipment?.consumedOnUse
      ? input.candidate.equipment
      : null
  let itemConsumption: NativeCharacterItemConsumption | null = null
  if (consumedItem) {
    const row = input.inventory.find((item) => item.id === consumedItem.itemInstanceId)
    if (!row || !Number.isSafeInteger(row.quantity) || row.quantity < 1) stale()
    const beforeUsed = input.itemUsage.find((usage) => usage.itemInstanceId === row.id)?.used ?? 0
    itemConsumption = {
      characterId: input.characterId,
      itemInstanceId: row.id,
      beforeUsed,
      afterUsed: beforeUsed + 1,
      beforeQuantity: row.quantity,
      afterQuantity: row.quantity - 1,
      expectedStreamVersion: input.expectedStreamVersion
    }
  }

  // Tracked ammunition is drawn one piece per attack; "Do it anyway" fires what remains.
  if (fired && input.trackAmmunition && !consumedItem) {
    const pieces = input.ammunition?.attacks ?? 1
    const drawn = Math.min(pieces, fired.remaining)
    if (drawn < pieces) {
      if (!overridable) stale()
      ruleWarnings.push({
        code: 'RESOURCE_UNAVAILABLE',
        message:
          fired.remaining === 0
            ? 'No ammunition left.'
            : `Needs ${pieces} pieces of ammunition, has ${fired.remaining}.`
      })
    }
    const row = input.inventory.find(({ id }) => id === ammunition?.itemInstanceId)
    if (row && drawn > 0) {
      const beforeUsed = input.itemUsage.find((usage) => usage.itemInstanceId === row.id)?.used ?? 0
      itemConsumption = {
        characterId: input.characterId,
        itemInstanceId: row.id,
        beforeUsed,
        afterUsed: beforeUsed + drawn,
        beforeQuantity: row.quantity,
        afterQuantity: row.quantity - drawn,
        expectedStreamVersion: input.expectedStreamVersion
      }
    }
  }

  // A leveled cast spends the slot its decision named, in Assisted play only.
  let spellConsumption: NativeCharacterSpellConsumption | null = null
  if (isSpellCast) {
    const cast = input.policyOutput.spellCastDecisions.find(namesCast)
    if (!cast || cast.status !== 'AVAILABLE') stale()
    if (cast.slotKey !== null && input.automationMode !== 'MANUAL') {
      const slot = readSpellCastSlot(input.policyOutput.spellSlots, cast.slotKey)
      if (!slot || !Number.isSafeInteger(slot.used) || slot.used < 0) stale()
      spellConsumption = {
        characterId: input.characterId,
        spellId: input.candidate.mechanicsOwner.id,
        candidateId: cast.candidateId,
        slotKey: cast.slotKey,
        beforeUsed: slot.used,
        afterUsed: slot.used + 1,
        expectedStreamVersion: input.expectedStreamVersion
      }
    }
  }

  const binding = input.entry.compilation.resourceBinding
  if (binding === null) {
    if (
      input.candidate.resourceUse !== null ||
      decision.resourcePoolId !== null ||
      decision.resourceCost !== null
    )
      stale()
    return {
      actionMechanic,
      resourceConsumption: input.castModifier
        ? spendCharacterResource({
            resource: input.policyOutput.resources.find(
              ({ poolId }) => poolId === input.castModifier?.poolId
            ),
            binding: input.castModifier,
            resourceUsage: input.resourceUsage,
            characterId: input.characterId,
            expectedStreamVersion: input.expectedStreamVersion,
            automationMode: input.automationMode,
            overridable,
            ruleWarnings
          })
        : null,
      itemConsumption,
      spellConsumption,
      ammunition,
      ruleWarnings
    }
  }
  if (input.castModifier) stale()
  if (!Number.isSafeInteger(binding.cost) || binding.cost < 1) stale()
  const resource = input.policyOutput.resources.find((value) => value.poolId === binding.poolId)
  const units = input.spentUnits ?? 1
  if (!Number.isSafeInteger(units) || units < 1)
    throw new EncounterValidationError('Spend at least 1.')
  if (!overridable && resource?.remaining != null && units * binding.cost > resource.remaining)
    throw new EncounterValidationError(
      `Not enough left: ${units * binding.cost} needed, ${resource.remaining} remain.`
    )
  if (
    !input.candidate.resourceUse ||
    input.candidate.resourceUse.poolId !== binding.poolId ||
    input.candidate.resourceUse.chargeId !== binding.chargeId ||
    input.candidate.resourceUse.cost !== binding.cost ||
    // An unequipped source reports no bound resource; its binding still comes from the entry.
    (!notEquipped &&
      (decision.resourcePoolId !== binding.poolId || decision.resourceCost !== binding.cost))
  )
    stale()

  return {
    actionMechanic,
    ruleWarnings,
    itemConsumption,
    spellConsumption,
    ammunition,
    resourceConsumption: spendCharacterResource({
      resource,
      binding: { ...binding, cost: binding.cost * units },
      resourceUsage: input.resourceUsage,
      characterId: input.characterId,
      expectedStreamVersion: input.expectedStreamVersion,
      automationMode: input.automationMode,
      overridable,
      ruleWarnings
    })
  }
}
