import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { ActiveGrantListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { MoraleDispositionDto } from '@artificer-toolkit/schema/shared/optionalCombat'
import { facingArcSectors } from '@artificer-toolkit/shared/vtt'
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

/** A confirmed morale outcome the token shows; a creature that fights on shows none. */
const moraleOutcomeLabels = {
  CONTINUE: null,
  FLEE: 'Fled',
  SURRENDER: 'Surrendered'
} as const satisfies Record<MoraleDispositionDto, string | null>

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
  COVER: 'OTHER',
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
  /** The System's cover tiers that name the GM's cover overrides; undefined while it loads. */
  coverTiers?: NonNullable<SystemAuthoredDto['cover']>['tiers']
  currentUserId: string
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  pending: PendingEncounterRuleOccurrenceSummaryDto | null
  /** The defeated creatures carrying loot tables; the GM's view only, so players never see a marker. */
  lootActorIds?: ReadonlySet<string>
  scene: CampaignSceneStateDto
  /** The token the member selected; with the current-turn token, it shows its Facing arcs. */
  selectedTokenId?: string | null
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
          ...actor.consequences.map(({ id, label }) =>
            statusFromValues(`consequence:${id}`, 'INJURY', label)
          ),
          ...actor.activeGrants.map((grant) => {
            // Another actor's grant (a mark) names who gave it.
            const source =
              grant.sourceActorId && grant.sourceActorId !== actor.id
                ? actors.get(grant.sourceActorId)
                : undefined
            return {
              category: grantCategories[grant.polarity],
              id: `grant:${grant.effectId}`,
              kind: 'EFFECT' as const,
              label: [
                source
                  ? `${activeGrantLabel(grant)} from ${source.label}`
                  : activeGrantLabel(grant),
                activeGrantTimeLeft(grant)
              ].join(', ')
            }
          }),
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
    // Like health, only the GM projection carries morale, so players see no outcome.
    const moraleDisposition = actor && 'morale' in actor ? actor.morale?.disposition : null
    const moraleOutcome = moraleDisposition ? moraleOutcomeLabels[moraleDisposition] : null
    if (moraleOutcome) statuses.push(statusFromValues('morale', 'MORALE', moraleOutcome))
    // Everyone sees the GM's cover override, as they see what the target hides behind.
    const coverStatus = tokenCoverStatus(token.coverTierOverride, input.coverTiers)
    if (coverStatus) statuses.push(coverStatus)
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
      facing: Boolean(actor) && input.encounter.facingStepDegrees !== null,
      facingArcs:
        actor && input.encounter.facingArcs && (isCurrent || token.id === input.selectedTokenId)
          ? facingArcSectors({
              arcs: input.encounter.facingArcs,
              rotationDegrees: token.rotationDegrees
            })
          : null,
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

function tokenCoverStatus(
  override: CampaignSceneStateDto['tokens'][number]['coverTierOverride'],
  coverTiers: NonNullable<SystemAuthoredDto['cover']>['tiers'] | undefined
): VttTokenPresentation['statuses'][number] | null {
  if (!override || !coverTiers) return null
  if (override.tierCode === null) return statusFromValues('cover', 'COVER', 'No cover')
  const tier = coverTiers.find(({ code }) => code === override.tierCode)
  return tier ? statusFromValues('cover', 'COVER', tier.label) : null
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
    COVER: 5,
    EFFECT: 6,
    LOOT: 7,
    HEALTH: 8
  } as const
  return priority[left.kind] - priority[right.kind] || left.label.localeCompare(right.label)
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase())
}
