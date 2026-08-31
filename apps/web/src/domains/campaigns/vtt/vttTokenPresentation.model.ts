import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { VttTokenPresentation } from './vttSceneRenderer.model'

const healthColours = {
  BLOODIED: 0xe8590c,
  CRITICAL: 0xc92a2a,
  DEFEATED: 0x495057,
  HEALTHY: null,
  WOUNDED: 0xf08c00
} as const

const fallbackColours = [0x1971c2, 0x2f9e44, 0x6741d9, 0x0b7285, 0x9c36b5, 0xc2255c] as const

export function buildVttTokenPresentations(input: {
  actorIdByTokenId: ReadonlyMap<string, string>
  artUrls?: Readonly<Record<string, string>>
  currentUserId: string
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  pending: PendingEncounterRuleOccurrenceSummaryDto | null
  scene: CampaignSceneStateDto
}): Record<string, VttTokenPresentation> {
  const actors = new Map(input.encounter.actors.map((actor) => [actor.id, actor]))
  const presentations: Record<string, VttTokenPresentation> = {}

  for (const token of input.scene.tokens) {
    const actorId = input.actorIdByTokenId.get(token.id)
    const actor = actorId ? actors.get(actorId) : undefined
    const statuses = actor ? actorConditionStatuses(actor.conditions) : []
    if (actor && actor.healthBand !== 'HEALTHY') {
      statuses.push({
        id: `health:${actor.healthBand}`,
        kind: 'HEALTH',
        label: titleCase(actor.healthBand),
        shortLabel: actor.healthBand === 'DEFEATED' ? '×' : '!'
      })
    }
    const pendingReaction = input.pending?.kind === 'MOVEMENT_REACTION' ? input.pending : null
    const reactionAvailable = pendingReaction?.choice.reactorTokenId === token.id
    if (reactionAvailable) {
      statuses.push({
        id: `reaction:${pendingReaction.occurrenceId}`,
        kind: 'REACTION',
        label: 'Reaction available',
        shortLabel: 'R'
      })
    }
    statuses.sort(compareStatuses)

    const healthColour = actor ? healthColours[actor.healthBand] : null
    const isCurrent = actor?.id === input.encounter.currentActorId
    const controlled = token.controlledByUserIds.includes(input.currentUserId)
    const statusDescription = statuses.map((status) => status.label).join(', ')
    presentations[token.id] = {
      accessibleDescription: [
        token.label,
        actor ? titleCase(actor.kind) : 'Scene token',
        isCurrent ? 'Current turn' : null,
        statusDescription || null
      ]
        .filter(Boolean)
        .join('. '),
      artUrl: input.artUrls?.[token.id] ?? null,
      facing: Boolean(actor),
      fillColor: healthColour ?? deterministicTokenColour(actor?.id ?? token.id),
      halo:
        reactionAvailable || isCurrent
          ? {
              color: reactionAvailable ? 0xf06595 : 0x22b8cf,
              label: reactionAvailable ? 'Reaction available' : 'Current turn'
            }
          : null,
      marked: isCurrent,
      outlineColor: isCurrent ? 0x22b8cf : controlled ? 0x51cf66 : 0xffffff,
      statuses
    }
  }

  return presentations
}

export function deterministicTokenColour(identity: string): number {
  let hash = 2166136261
  for (const character of identity) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return fallbackColours[Math.abs(hash) % fallbackColours.length]!
}

function actorConditionStatuses(conditions: unknown): VttTokenPresentation['statuses'] {
  if (!Array.isArray(conditions)) return []
  return conditions.flatMap((condition, index) => {
    if (typeof condition === 'string' && condition.trim()) {
      return [statusFromValues(`condition:${index}`, 'CONDITION', condition)]
    }
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return []
    const record = condition as Record<string, unknown>
    const label = firstString(record.label, record.name, record.code)
    if (!label) return []
    const id = firstString(record.id, record.conditionTypeId) ?? `condition:${index}`
    const kind = statusKind(record.kind ?? record.category)
    return [statusFromValues(id, kind, label)]
  })
}

function statusFromValues(
  id: string,
  kind: VttTokenPresentation['statuses'][number]['kind'],
  label: string
): VttTokenPresentation['statuses'][number] {
  const normalized = label.trim()
  return {
    id,
    kind,
    label: normalized,
    shortLabel: normalized.slice(0, 1).toUpperCase()
  }
}

function statusKind(value: unknown): VttTokenPresentation['statuses'][number]['kind'] {
  if (typeof value !== 'string') return 'CONDITION'
  const normalized = value.toUpperCase()
  return normalized === 'EFFECT' ||
    normalized === 'INJURY' ||
    normalized === 'MORALE' ||
    normalized === 'REACTION'
    ? normalized
    : 'CONDITION'
}

function compareStatuses(
  left: VttTokenPresentation['statuses'][number],
  right: VttTokenPresentation['statuses'][number]
): number {
  const priority = {
    REACTION: 0,
    INJURY: 1,
    MORALE: 2,
    CONDITION: 3,
    EFFECT: 4,
    HEALTH: 5
  } as const
  return priority[left.kind] - priority[right.kind] || left.label.localeCompare(right.label)
}

function firstString(...values: unknown[]): string | null {
  return (
    values.find((value): value is string => typeof value === 'string' && value.trim() !== '') ??
    null
  )
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase())
}
