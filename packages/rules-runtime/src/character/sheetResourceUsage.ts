import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import {
  CharacterSheetCommandError,
  ensureResource,
  ensureResourceByOwner,
  resolveSpellCastSource
} from './sheetCommandReducer.js'
import { validateActionResourceUse } from './sheetCommandValidation.js'
import { planSpellSlotExchange } from './sheetSpellSlotExchange.js'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import type { CharacterResourceUsage } from '@artificer-toolkit/shared/core'

type SheetResource = CharacterSheetResponseDto['resources']['items'][number]

export function getProspectiveSheetResourceUsage(params: {
  resourceUsage: readonly CharacterResourceUsage[]
  resourceUsageUpdate?: { resource: SheetResource; used: number }
  characterId: string
  userId: string
  now?: string
}): readonly CharacterResourceUsage[] {
  const update = params.resourceUsageUpdate
  if (!update) return params.resourceUsage

  const owner = toCharacterResourceOwnerKey(update.resource.owner)
  const changedPoolId = createCharacterResourceOwnerKey(owner)
  const existing = params.resourceUsage.find(
    (usage) => createCharacterResourceOwnerKey(usage.owner) === changedPoolId
  )
  return [
    ...params.resourceUsage.filter(
      (usage) => createCharacterResourceOwnerKey(usage.owner) !== changedPoolId
    ),
    ...(update.used === 0
      ? []
      : [
          existing
            ? params.now
              ? { ...existing, used: update.used, updatedBy: params.userId, updatedAt: params.now }
              : { ...existing, used: update.used }
            : (() => {
                const occurredAt = params.now ?? new Date().toISOString()
                return {
                  id: crypto.randomUUID(),
                  characterId: params.characterId,
                  owner,
                  used: update.used,
                  createdBy: params.userId,
                  updatedBy: params.userId,
                  createdAt: occurredAt,
                  updatedAt: occurredAt
                }
              })()
        ])
  ]
}

/** Drops usage for Resources a rest recovered and for owners removed with an item or companion. */
export function pruneSheetResourceUsage(params: {
  resourceUsage: readonly CharacterResourceUsage[]
  resources: readonly SheetResource[]
  recoveredResourceIds: ReadonlySet<string>
  removedItemId?: string
  removedCompanionId?: string
}): readonly CharacterResourceUsage[] {
  const recoveredOwnerKeys = new Set(
    params.resources
      .filter((resource) => params.recoveredResourceIds.has(resource.id))
      .map((resource) =>
        createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(resource.owner))
      )
  )
  return params.resourceUsage.filter(
    (usage) =>
      !recoveredOwnerKeys.has(createCharacterResourceOwnerKey(usage.owner)) &&
      (usage.owner.kind !== 'ITEM_INSTANCE' ||
        usage.owner.itemInstanceId !== params.removedItemId) &&
      (usage.owner.kind !== 'COMPANION_FEATURE' ||
        usage.owner.companionInstanceId !== params.removedCompanionId)
  )
}

/** The same resource admission and spend calculation for Convex and room Sheet commands. */
export function getSheetCommandResourceUsageUpdate(params: {
  sheet: CharacterSheetResponseDto
  resourceUsage: readonly CharacterResourceUsage[]
  command: CharacterSheetCommandInputDto
}): { resource: SheetResource; used: number } | undefined {
  const { command } = params
  let resourceUsageUpdate:
    | {
        resource: SheetResource
        used: number
      }
    | undefined
  const getRawResourceUsed = (resource: SheetResource) => {
    const ownerKey = createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(resource.owner))
    return (
      params.resourceUsage.find(
        (usage) => createCharacterResourceOwnerKey(usage.owner) === ownerKey
      )?.used ?? resource.used
    )
  }
  if (
    command.type === 'USE_RESOURCE' ||
    command.type === 'RESTORE_RESOURCE' ||
    command.type === 'USE_SHEET_RESOURCE' ||
    command.type === 'RECOVER_SHEET_RESOURCE'
  ) {
    const resource =
      'owner' in command
        ? ensureResourceByOwner(params.sheet, command.owner)
        : ensureResource(params.sheet, command.resourceGrantId)
    const used = getRawResourceUsed(resource)
    if (command.type === 'USE_RESOURCE' || command.type === 'USE_SHEET_RESOURCE') {
      const amount = command.amount ?? 1
      validateActionResourceUse({
        sheet: params.sheet,
        actionId: command.actionId,
        resourceId: resource.id,
        amount
      })
      if (amount > resource.remaining)
        throw new CharacterSheetCommandError(
          `Resource "${resource.label}" only has ${resource.remaining} uses remaining.`
        )
      resourceUsageUpdate = { resource, used: used + amount }
    } else if (command.type === 'RECOVER_SHEET_RESOURCE') {
      if (!resource.recoveries.some((recovery) => recovery.trigger === command.trigger))
        throw new CharacterSheetCommandError(`Resource cannot be recovered by ${command.trigger}.`)
      resourceUsageUpdate = { resource, used: 0 }
    } else {
      resourceUsageUpdate = {
        resource,
        used: command.all ? 0 : Math.max(used - (command.amount ?? 1), 0)
      }
    }
  }
  if (command.type === 'EXCHANGE_SPELL_SLOTS') {
    const { resourceUse } = planSpellSlotExchange(params.sheet, command)
    if (resourceUse) {
      const resource = ensureResource(params.sheet, resourceUse.resourceId)
      resourceUsageUpdate = {
        resource,
        used: Math.max(getRawResourceUsed(resource) + resourceUse.delta, 0)
      }
    }
  }
  if (command.type === 'CAST_SPELL') {
    const { source, spell } = resolveSpellCastSource(params.sheet, command)
    if (
      spell.level > 0 &&
      (source?.castMode === 'LIMITED_USE' || source?.castMode === 'FIXED_LEVEL') &&
      source.resourceOwner
    ) {
      const resource = ensureResourceByOwner(params.sheet, source.resourceOwner)
      resourceUsageUpdate = { resource, used: getRawResourceUsed(resource) + 1 }
    }
  }
  return resourceUsageUpdate
}
