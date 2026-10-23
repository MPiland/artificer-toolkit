import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { ActiveGrantListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  activeGrantLabel,
  activeGrantTimeLeft
} from '../../../components/activeGrants/activeGrantDisplay'
import type { VttStatusCategory, VttTokenPresentation } from './vttSceneRenderer.model'

const healthColours = {
  BLOODIED: 0xe8590c,
  CRITICAL: 0xc92a2a,
  HEALTHY: null,
  WOUNDED: 0xf08c00
} as const
const DEFEATED_COLOUR = 0x495057

/** The token's inner ring shows the actor's disposition; a token with no actor keeps white. */
export const dispositionRingColours = {
  FRIENDLY: 0x339af0,
  HOSTILE: 0xff6b6b,
  NEUTRAL: 0xcc5de8
} as const
const NO_DISPOSITION_RING_COLOUR = 0xffffff

type StatusKind = VttTokenPresentation['statuses'][number]['kind']
/** Every status kind but a grant, whose category is its derived polarity. */
type NonGrantStatusKind = Exclude<StatusKind, 'EFFECT'>
const statusCategories: Record<NonGrantStatusKind, VttStatusCategory> = {
  CONCENTRATION: 'CONCENTRATION',
  CONDITION: 'HARMFUL',
  HEALTH: 'OTHER',
  INJURY: 'HARMFUL',
  LOOT: 'OTHER',
  MORALE: 'HARMFUL',
  REACTION: 'OTHER'
}
const grantCategories = {
  BENEFICIAL: 'BENEFICIAL',
  HARMFUL: 'HARMFUL',
  NEUTRAL: 'OTHER'
} as const satisfies Record<ActiveGrantListingDto['polarity'], VttStatusCategory>

const fallbackColours = [0x1971c2, 0x2f9e44, 0x6741d9, 0x0b7285, 0x9c36b5, 0xc2255c] as const

export function buildVttTokenPresentations(input: {
  actorIdByTokenId: ReadonlyMap<string, string>
  artUrls?: Readonly<Record<string, string>>
  boundTokenControl: ReadonlyMap<string, boolean>
  /** The System's condition types that name the actors' conditions; undefined while it loads. */
  conditionTypes?: SystemAuthoredDto['conditionTypes']
  currentUserId: string
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  pending: PendingEncounterRuleOccurrenceSummaryDto | null
  /** The defeated creatures carrying loot tables; the GM's view only, so players never see a marker. */
  lootActorIds?: ReadonlySet<string>
  scene: CampaignSceneStateDto
  /** The tokens the caster can pick while targeting; empty when no one is targeting. */
  targetableTokenIds?: ReadonlySet<string>
}): Record<string, VttTokenPresentation> {
  const actors = new Map(input.encounter.actors.map((actor) => [actor.id, actor]))
  // Only the GM projection carries health; players see none by default.
  const healthBands = new Map(
    input.encounter.actors.flatMap((actor) =>
      'healthBand' in actor ? [[actor.id, actor.healthBand] as const] : []
    )
  )
  const presentations: Record<string, VttTokenPresentation> = {}

  for (const token of input.scene.tokens) {
    const actorId = input.actorIdByTokenId.get(token.id)
    const actor = actorId ? actors.get(actorId) : undefined
    const statuses = actor
      ? [
          ...actorConditionStatuses(actor.conditions, input.conditionTypes),
          ...actor.activeGrants.map((grant) => ({
            category: grantCategories[grant.polarity],
            id: `grant:${grant.effectId}`,
            kind: 'EFFECT' as const,
            label: `${activeGrantLabel(grant)}, ${activeGrantTimeLeft(grant)}`
          })),
          ...(actor.concentration
            ? [
                statusFromValues(
                  'concentration',
                  'CONCENTRATION',
                  actor.concentration.label
                    ? `Concentrating: ${actor.concentration.label}`
                    : 'Concentrating'
                )
              ]
            : [])
        ]
      : []
    const healthBand = actor ? healthBands.get(actor.id) : undefined
    // Everyone sees a defeated creature fall (D63) and a Character die (D96); the GM also sees how
    // hurt the rest are.
    const defeated = actor?.defeated === true
    if (actor && defeated)
      statuses.push(
        statusFromValues(
          'health:defeated',
          'HEALTH',
          actor.kind === 'CHARACTER' ? 'Dead' : 'Defeated'
        )
      )
    else if (healthBand && healthBand !== 'HEALTHY') {
      statuses.push(statusFromValues(`health:${healthBand}`, 'HEALTH', titleCase(healthBand)))
    }
    if (actorId && input.lootActorIds?.has(actorId))
      statuses.push(statusFromValues('loot', 'LOOT', 'Has loot'))
    const pendingReaction = input.pending?.kind === 'MOVEMENT_REACTION' ? input.pending : null
    const reactionAvailable = pendingReaction?.choice.reactorTokenId === token.id
    if (reactionAvailable) {
      statuses.push(
        statusFromValues(
          `reaction:${pendingReaction.occurrenceId}`,
          'REACTION',
          'Reaction available'
        )
      )
    }
    statuses.sort(compareStatuses)

    const healthColour = defeated ? DEFEATED_COLOUR : healthBand ? healthColours[healthBand] : null
    const isCurrent = actor?.id === input.encounter.currentActorId
    const controlled =
      input.boundTokenControl.get(token.id) ??
      token.controlledByUserIds.includes(input.currentUserId)
    const statusDescription = statuses.map((status) => status.label).join(', ')
    const dispositionLabel = actor ? titleCase(actor.disposition) : null
    presentations[token.id] = {
      accessibleDescription: [
        token.label,
        actor ? titleCase(actor.kind) : 'Scene token',
        dispositionLabel,
        isCurrent ? 'Current turn' : null,
        statusDescription || null,
        controlled ? 'Yours' : null
      ]
        .filter(Boolean)
        .join('. '),
      artUrl: input.artUrls?.[token.id] ?? null,
      dispositionLabel,
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
      outlineColor: actor ? dispositionRingColours[actor.disposition] : NO_DISPOSITION_RING_COLOUR,
      statuses,
      targetable: input.targetableTokenIds?.has(token.id) ?? false
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

function actorConditionStatuses(
  conditions: EncounterGmProjectionDto['actors'][number]['conditions'],
  conditionTypes: SystemAuthoredDto['conditionTypes'] | undefined
): VttTokenPresentation['statuses'] {
  if (!conditionTypes) return []
  return conditions.map(({ conditionTypeId, innate }) => {
    const definition = conditionTypes.find((entry) => entry.id === conditionTypeId)
    if (!definition)
      throw new Error(`Condition type "${conditionTypeId}" is not defined by the System.`)
    return {
      ...statusFromValues(
        conditionTypeId,
        'CONDITION',
        innate ? `${definition.label} (innate)` : definition.label
      ),
      ...(definition.description ? { description: definition.description } : {})
    }
  })
}

function statusFromValues(
  id: string,
  kind: NonGrantStatusKind,
  label: string
): VttTokenPresentation['statuses'][number] {
  return { category: statusCategories[kind], id, kind, label: label.trim() }
}

function compareStatuses(
  left: VttTokenPresentation['statuses'][number],
  right: VttTokenPresentation['statuses'][number]
): number {
  const priority = {
    REACTION: 0,
    CONCENTRATION: 1,
    INJURY: 2,
    MORALE: 3,
    CONDITION: 4,
    EFFECT: 5,
    LOOT: 6,
    HEALTH: 7
  } as const
  return priority[left.kind] - priority[right.kind] || left.label.localeCompare(right.label)
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase())
}
