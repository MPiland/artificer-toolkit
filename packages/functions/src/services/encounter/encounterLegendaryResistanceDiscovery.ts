import type { EncounterActorRecord, EncounterRecord } from '@artificer-toolkit/db'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import {
  serverPublishedRuleDefinitionDtoSchema,
  type ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { CurrentReusableDefinitionSource } from '../rules/ruleCapabilityStateService.js'
import { findEncounterFeatureResource } from './encounterActorRuleEvaluation.js'
import { snapshotFeatureDefinitions } from './encounterActorState.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'

export interface EncounterLegendaryResistanceCandidate {
  targetActorId: string
  ownerFeatureId: string
  chargeId: string
  featureCost: number
  poolBefore: number
  poolRemaining: number
  lifecycle: {
    definitionId: string
    definitionVersion: number
    definitionChecksum: string
    choiceGraphDefinitionId: string
    choiceGraphDefinitionVersion: number
    choiceGraphDefinitionChecksum: string
    useOutput: string
    interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME'
    replacement: 'SAVE_SUCCESS'
  }
  choiceGraph: ServerPublishedRuleDefinitionDto
}

function requireCurrentIntegrity(current: ReusableDefinitionCurrentDto): void {
  if (checksumRuleDocument(current.document) !== current.checksum) {
    throw new EncounterConflictError('Legendary Resistance definition checksum is invalid.')
  }
}

function requireCreatureTarget(
  actor: EncounterActorRecord,
  encounter: Pick<EncounterRecord, 'gameSystemId'>
) {
  if (actor.kind !== 'CREATURE') return null
  if (actor.systemId !== encounter.gameSystemId) {
    throw new EncounterValidationError(
      'Legendary Resistance requires an immutable Creature target.'
    )
  }
  const features = snapshotFeatureDefinitions(actor)
  if (features.length === 0) return null
  return features
}

function toPublishedGraph(current: ReusableDefinitionCurrentDto): ServerPublishedRuleDefinitionDto {
  const definition = ruleGraphDefinitionDtoSchema.safeParse(current.document)
  if (!definition.success) {
    throw new EncounterConflictError('Legendary Resistance choice graph is invalid.')
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: current.id,
    gameSystemId: current.gameSystemId,
    definitionFamilyKey: current.definitionFamilyKey,
    checksum: current.checksum,
    definition: definition.data
  })
}

/**
 * Resolves one exact, Feature-owned Legendary Resistance source for a target.
 * This is discovery only: it neither chooses, consumes, nor applies anything.
 */
export async function discoverEncounterLegendaryResistanceCandidate(input: {
  encounter: Pick<EncounterRecord, 'gameSystemId'>
  targetActor: EncounterActorRecord
  actorRules: EncounterActorRuleOutput
  definitions: CurrentReusableDefinitionSource
}): Promise<EncounterLegendaryResistanceCandidate | null> {
  const features = requireCreatureTarget(input.targetActor, input.encounter)
  if (!features) return null
  const candidates: EncounterLegendaryResistanceCandidate[] = []
  for (const feature of features) {
    for (const definitionId of feature.ruleDefinitionIds ?? []) {
      const lifecycleCurrent = await input.definitions.requireCurrent(definitionId)
      if (lifecycleCurrent.definitionFamilyKey !== 'dnd5e-encounter-lifecycle') continue
      requireCurrentIntegrity(lifecycleCurrent)
      if (
        lifecycleCurrent.id !== definitionId ||
        lifecycleCurrent.gameSystemId !== input.encounter.gameSystemId
      ) {
        throw new EncounterConflictError('Legendary Resistance lifecycle System identity is stale.')
      }
      const lifecycle = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(
        lifecycleCurrent.document
      )
      if (!lifecycle.success || lifecycle.data.kind !== 'LEGENDARY_RESISTANCE') continue
      const graphCurrent = await input.definitions.requireCurrent(
        lifecycle.data.choiceGraph.definitionId
      )
      requireCurrentIntegrity(graphCurrent)
      if (
        graphCurrent.id !== lifecycle.data.choiceGraph.definitionId ||
        graphCurrent.gameSystemId !== input.encounter.gameSystemId ||
        graphCurrent.definitionFamilyKey !== 'rules-runtime-graph' ||
        graphCurrent.version !== lifecycle.data.choiceGraph.definitionVersion ||
        graphCurrent.checksum !== lifecycle.data.choiceGraph.definitionChecksum
      ) {
        throw new EncounterConflictError('Legendary Resistance choice graph pin is stale.')
      }
      const choiceGraph = toPublishedGraph(graphCurrent)
      const resource = findEncounterFeatureResource(
        input.actorRules,
        input.targetActor.id,
        feature.id
      )
      const featureCharge =
        feature.charges?.limitKind === 'FIXED_AMOUNT' && feature.charges.scalingKind === 'NONE'
          ? feature.charges
          : null
      const featureCost = 1
      if (
        !featureCharge ||
        !Number.isSafeInteger(featureCharge.amount) ||
        featureCharge.amount < featureCost ||
        !resource ||
        resource.maximum === null ||
        resource.remaining === null ||
        resource.used < 0 ||
        resource.remaining < featureCost
      ) {
        continue
      }
      candidates.push({
        targetActorId: input.targetActor.id,
        ownerFeatureId: feature.id,
        chargeId: featureCharge.id,
        featureCost,
        poolBefore: resource.remaining,
        poolRemaining: resource.remaining - featureCost,
        lifecycle: {
          definitionId: lifecycleCurrent.id,
          definitionVersion: lifecycleCurrent.version,
          definitionChecksum: lifecycleCurrent.checksum,
          choiceGraphDefinitionId: choiceGraph.id,
          choiceGraphDefinitionVersion: graphCurrent.version,
          choiceGraphDefinitionChecksum: choiceGraph.checksum,
          useOutput: lifecycle.data.choiceGraph.useOutput,
          interruptedStage: lifecycle.data.interruptedStage,
          replacement: lifecycle.data.replacement
        },
        choiceGraph
      })
    }
  }
  if (candidates.length === 0) return null
  if (candidates.length !== 1) {
    throw new EncounterValidationError(
      'Creature has ambiguous Legendary Resistance lifecycle bindings.'
    )
  }
  return candidates[0]!
}
