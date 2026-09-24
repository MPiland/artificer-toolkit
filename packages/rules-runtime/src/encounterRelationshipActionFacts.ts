import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'

import { EncounterValidationError } from './encounterErrors.js'

export interface EncounterRelationshipD20Contributor {
  readonly sourceId: string
  readonly grantId: string | null
  readonly domainKey: string | null
  readonly influence: 'ADVANTAGE' | 'DISADVANTAGE'
}

export type EncounterRelationshipActiveEffectsByActorId = ReadonlyMap<
  string,
  readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
>

/** Reads target-specific action facts from an authoritative active-effect set. */
export function lockedRelationshipActionFacts(input: {
  actionEffectId: string
  sourceActorId: string
  targetActorId: string
  targets: { readonly activeEffectsByActorId?: EncounterRelationshipActiveEffectsByActorId }
}): readonly EncounterRelationshipD20Contributor[] {
  const contributors: EncounterRelationshipD20Contributor[] = []
  for (const [relationshipTargetActorId, effects] of [
    ...(input.targets.activeEffectsByActorId ?? new Map())
  ].sort(([left], [right]) => left.localeCompare(right))) {
    for (const effect of effects) {
      if (
        effect.definition.schemaVersion !== 2 ||
        effect.definition.origin.kind !== 'ENCOUNTER' ||
        effect.definition.origin.sourceActorId !== input.sourceActorId
      ) {
        continue
      }
      for (const contribution of effect.definition.stateContributions) {
        if (contribution.kind !== 'ACTOR_RELATIONSHIP') continue
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
            module.actionEffectIds.includes(input.actionEffectId) &&
            relationshipTargetActorId === input.targetActorId
          ) {
            contributors.push({
              sourceId: `active-effect:${effect.id}`,
              grantId: null,
              domainKey: `actor-relationship:${contribution.relationshipOutcomeId}`,
              influence: module.influence
            })
          }
        }
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
