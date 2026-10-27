import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ReceiptD20ContributorDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'

import { EncounterValidationError } from './encounterErrors.js'

export type EncounterRelationshipD20Contributor = Readonly<ReceiptD20ContributorDto>

export type EncounterRelationshipActiveEffectsByActorId = ReadonlyMap<
  string,
  readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
>

/**
 * Every actor relationship an actor of the Run applied, each with that source and the actor holding the effect (the
 * related creature), read from the Run's active effects in actor-id order.
 */
export function encounterRelationships(
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId
) {
  return [...activeEffectsByActorId]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([actorId, effects]) =>
      effects.flatMap((effect) => {
        const { definition } = effect
        if (definition.origin.kind !== 'ENCOUNTER') return []
        const { sourceActorId } = definition.origin
        // A relationship no actor applied has no source to hold it.
        if (!sourceActorId) return []
        return definition.stateContributions.flatMap((contribution) =>
          contribution.kind === 'ACTOR_RELATIONSHIP'
            ? [{ sourceActorId, actorId, effect, contribution }]
            : []
        )
      })
    )
}

/** The actor relationships `sourceActorId` applied, in actor-id order. */
export function encounterSourceRelationships(
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId,
  sourceActorId: string
) {
  return encounterRelationships(activeEffectsByActorId).filter(
    (relationship) => relationship.sourceActorId === sourceActorId
  )
}

/** The actors the source currently holds through a relationship it applied (`heldBySource` targeting reads them). */
export function encounterHeldActorIds(
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId,
  sourceActorId: string
): ReadonlySet<string> {
  return new Set(
    encounterSourceRelationships(activeEffectsByActorId, sourceActorId).map(
      ({ actorId }) => actorId
    )
  )
}

/**
 * The relationships whose source follows the creature holding them (`SOURCE_FOLLOWS_TARGET`): the
 * source moves with that creature and within its space.
 */
export function encounterFollowRelationships(
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId
) {
  return encounterRelationships(activeEffectsByActorId).filter(({ contribution }) =>
    contribution.modules.some(({ kind }) => kind === 'SOURCE_FOLLOWS_TARGET')
  )
}

/** The creatures the source holds by hand, each filling one of its hands (`SOURCE_OCCUPIES_HAND`, D152). */
export function encounterSourceHandHoldRelationships(
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId,
  sourceActorId: string
) {
  return encounterSourceRelationships(activeEffectsByActorId, sourceActorId).filter(
    ({ contribution }) => contribution.modules.some(({ kind }) => kind === 'SOURCE_OCCUPIES_HAND')
  )
}

/** How many of the source's hands the creatures it holds fill. */
export function encounterSourceHandHolds(
  activeEffectsByActorId: EncounterRelationshipActiveEffectsByActorId,
  sourceActorId: string
) {
  return encounterSourceHandHoldRelationships(activeEffectsByActorId, sourceActorId).length
}

/** Reads target-specific action facts from an authoritative active-effect set. */
export function lockedRelationshipActionFacts(input: {
  actionEffectId: string
  sourceActorId: string
  targetActorId: string
  targets: { readonly activeEffectsByActorId?: EncounterRelationshipActiveEffectsByActorId }
}): readonly EncounterRelationshipD20Contributor[] {
  const contributors: EncounterRelationshipD20Contributor[] = []
  for (const {
    actorId: relationshipTargetActorId,
    effect,
    contribution
  } of encounterSourceRelationships(
    input.targets.activeEffectsByActorId ?? new Map(),
    input.sourceActorId
  )) {
    for (const module of contribution.modules) {
      if (
        module.kind === 'SOURCE_ACTION_TARGET_RESTRICTION' &&
        module.actionEffectIds.includes(input.actionEffectId) &&
        relationshipTargetActorId !== input.targetActorId
      ) {
        throw new EncounterValidationError(
          'The selected action target is restricted by an active relationship.'
        )
      }
      if (
        module.kind === 'SOURCE_ATTACK_ROLL_INFLUENCE' &&
        (module.actionEffectIds === null ||
          module.actionEffectIds.includes(input.actionEffectId)) &&
        relationshipTargetActorId === input.targetActorId
      ) {
        contributors.push({
          sourceId: createCharacterMechanicSourceKey({
            kind: 'ACTIVE_EFFECT',
            activeEffectId: effect.id
          }),
          grantId: null,
          domainKey: `actor-relationship:${contribution.relationshipOutcomeId}`,
          influence: module.influence,
          source: { kind: 'ACTIVE_EFFECT', id: effect.id, holderActorId: input.sourceActorId }
        })
      }
    }
  }
  contributors.sort(compareCanonicalD20Contributors)
  for (let index = 1; index < contributors.length; index += 1) {
    if (compareCanonicalD20Contributors(contributors[index - 1]!, contributors[index]!) === 0) {
      throw new EncounterValidationError('Active relationship action contributors must be unique.')
    }
  }
  return contributors
}

export function mergeCanonicalD20Contributors(
  ...groups: readonly (readonly EncounterRelationshipD20Contributor[])[]
): readonly EncounterRelationshipD20Contributor[] {
  const merged = groups.flatMap((group) => group.map((contributor) => ({ ...contributor })))
  merged.sort(compareCanonicalD20Contributors)
  for (let index = 1; index < merged.length; index += 1) {
    if (compareCanonicalD20Contributors(merged[index - 1]!, merged[index]!) === 0) {
      throw new EncounterValidationError('Action roll contributors must be unique.')
    }
  }
  return merged
}
