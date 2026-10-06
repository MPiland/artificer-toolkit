import { v5 as uuidv5 } from 'uuid'

import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { PinnedConditionRuleStateDefinitionDto } from '@artificer-toolkit/schema/shared/ruleState'
import type {
  CombatPerceptionContribution,
  CombatPerceptionContributionSource
} from '@artificer-toolkit/shared/rules'
import { lengthMeasurementInSceneUnits, type SceneGrid } from '@artificer-toolkit/shared/vtt'

const COMBAT_PERCEPTION_CONTRIBUTION_INSTANCE_NAMESPACE = '9bcf57bc-3776-4eaf-a836-6f246bbb6786'
const CONDITION_PERCEPTION_CONTRIBUTION_INSTANCE_NAMESPACE = '6cb4da7e-2f2a-477f-b5dd-1b8e079e75e0'

const observerKinds = new Set<CombatPerceptionContribution['kind']>([
  'SENSE_GRANT',
  'SENSE_SUPPRESS',
  'ACCESS_LIMIT'
])
const subjectKinds = new Set<CombatPerceptionContribution['kind']>(['EMISSION_SUPPRESS'])
const localAreaKinds = new Set<CombatPerceptionContribution['kind']>(['ILLUMINATION_EFFECT'])

/** Exact immutable fields read from an active-effect row while its owning scope is locked. */
export interface LockedCombatPerceptionEffect {
  id: string
  version: number
  createdOrdinal: number
  definitionChecksum: string
  definition: Pick<ActiveRuleEffectDefinitionDto, 'perceptionContributions'>
}

export interface CombatPerceptionContributionPartitions {
  observerContributions: readonly CombatPerceptionContributionSource[]
  subjectContributions: readonly CombatPerceptionContributionSource[]
  localAreaContributions: readonly CombatPerceptionContributionSource[]
}

function contributionInstanceId(activeEffectId: string, contributionId: string): string {
  return uuidv5(
    `${activeEffectId}:${contributionId}`,
    COMBAT_PERCEPTION_CONTRIBUTION_INSTANCE_NAMESPACE
  )
}

function conditionContributionInstanceId(
  conditionDefinitionId: string,
  definitionChecksum: string,
  contributionId: string
): string {
  return uuidv5(
    `${conditionDefinitionId}:${definitionChecksum}:${contributionId}`,
    CONDITION_PERCEPTION_CONTRIBUTION_INSTANCE_NAMESPACE
  )
}

function compareEffects(left: LockedCombatPerceptionEffect, right: LockedCombatPerceptionEffect) {
  return left.createdOrdinal - right.createdOrdinal || left.id.localeCompare(right.id)
}

function sourcesForKinds(
  effects: readonly LockedCombatPerceptionEffect[],
  kinds: ReadonlySet<CombatPerceptionContribution['kind']>,
  sceneGrid: SceneGrid
): CombatPerceptionContributionSource[] {
  return [...effects].sort(compareEffects).flatMap((effect) =>
    (effect.definition.perceptionContributions ?? [])
      .filter((contribution) => kinds.has(contribution.kind))
      .map((contribution): CombatPerceptionContributionSource => {
        const resolvedContribution: CombatPerceptionContribution =
          contribution.kind === 'SENSE_GRANT'
            ? {
                ...contribution,
                range: lengthMeasurementInSceneUnits(contribution.range, sceneGrid)
              }
            : contribution
        return {
          instanceId: contributionInstanceId(effect.id, contribution.id),
          source: {
            kind: 'ACTIVE_EFFECT',
            activeEffectId: effect.id,
            activeEffectVersion: effect.version,
            activeEffectDefinitionChecksum: effect.definitionChecksum
          },
          sourceOrdinal: effect.createdOrdinal,
          contribution: resolvedContribution
        }
      })
  )
}

/**
 * Partitions only locked, current active-effect definitions by their factual runtime relation.
 * Relation is supplied by the owning Encounter coordinator; it is never persisted or inferred from a label.
 */
export function deriveCombatPerceptionContributionPartitions(input: {
  sceneGrid: SceneGrid
  observerEffects: readonly LockedCombatPerceptionEffect[]
  subjectEffects: readonly LockedCombatPerceptionEffect[]
  localAreaEffects: readonly LockedCombatPerceptionEffect[]
}): CombatPerceptionContributionPartitions {
  return {
    observerContributions: sourcesForKinds(input.observerEffects, observerKinds, input.sceneGrid),
    subjectContributions: sourcesForKinds(input.subjectEffects, subjectKinds, input.sceneGrid),
    localAreaContributions: sourcesForKinds(input.localAreaEffects, localAreaKinds, input.sceneGrid)
  }
}

/**
 * Resolves UUID-backed condition policy into the same contribution vocabulary as
 * active effects. The source remains a condition revision, never an invented effect.
 */
export function deriveConditionCombatPerceptionContributions(input: {
  conditionDefinitions: readonly PinnedConditionRuleStateDefinitionDto[]
  relation: 'OBSERVER' | 'SUBJECT'
  sceneGrid: SceneGrid
}): readonly CombatPerceptionContributionSource[] {
  const kinds = input.relation === 'OBSERVER' ? observerKinds : subjectKinds
  return [...input.conditionDefinitions]
    .sort((left, right) => left.conditionDefinitionId.localeCompare(right.conditionDefinitionId))
    .flatMap((definition) =>
      (definition.document.perceptionContributions ?? [])
        .filter((contribution) => kinds.has(contribution.kind))
        .map((contribution): CombatPerceptionContributionSource => ({
          instanceId: conditionContributionInstanceId(
            definition.conditionDefinitionId,
            definition.definitionChecksum,
            contribution.id
          ),
          source: {
            kind: 'CONDITION_DEFINITION',
            conditionDefinitionId: definition.conditionDefinitionId,
            conditionDefinitionVersion: definition.definitionVersion,
            conditionDefinitionChecksum: definition.definitionChecksum
          },
          sourceOrdinal: 0,
          contribution:
            contribution.kind === 'SENSE_GRANT'
              ? {
                  ...contribution,
                  range: contribution.range
                    ? lengthMeasurementInSceneUnits(contribution.range, input.sceneGrid)
                    : null
                }
              : contribution
        }))
    )
}
