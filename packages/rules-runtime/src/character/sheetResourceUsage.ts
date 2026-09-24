import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import type { CharacterResourceUsage } from '@artificer-toolkit/shared/core'

type SheetResource = CharacterSheetResponseDto['resources']['items'][number]

export function getProspectiveSheetResourceUsage(params: {
  resourceUsage: readonly CharacterResourceUsage[]
  resourceUsageUpdate?: { resource: SheetResource; used: number }
  recoveredResourceOwnerKeys?: ReadonlySet<string>
  characterId: string
  userId: string
  now?: string
}): readonly CharacterResourceUsage[] {
  const resourceUsageAfterRest = params.recoveredResourceOwnerKeys?.size
    ? params.resourceUsage.map((usage) =>
        params.recoveredResourceOwnerKeys?.has(createCharacterResourceOwnerKey(usage.owner))
          ? { ...usage, used: 0 }
          : usage
      )
    : params.resourceUsage
  const update = params.resourceUsageUpdate
  if (!update) return resourceUsageAfterRest

  const owner = toCharacterResourceOwnerKey(update.resource.owner)
  const changedPoolId = createCharacterResourceOwnerKey(owner)
  const existing = resourceUsageAfterRest.find(
    (usage) => createCharacterResourceOwnerKey(usage.owner) === changedPoolId
  )
  return [
    ...resourceUsageAfterRest.filter(
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
