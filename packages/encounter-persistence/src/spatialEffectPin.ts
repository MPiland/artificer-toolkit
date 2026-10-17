import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { StagedTurnZonePlanDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPhaseEvidence'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

/** Refuses a prepared execution whose zone is no longer the one it was planned against. */
export function assertSpatialEffectPin(
  pin: StagedTurnZonePlanDto['executions'][number]['candidate']['effect'],
  effect: EncounterSpatialRuleEffectRecord
) {
  if (
    pin.version !== effect.version ||
    pin.definitionChecksum !== effect.definitionChecksum ||
    pin.lifecycleChecksum !== effect.lifecycleChecksum ||
    pin.placementChecksum !== effect.placementChecksum ||
    pin.spatialStateChecksum !== effect.spatialStateChecksum ||
    pin.authoredEffectId !== effect.definition.authoredEffectId ||
    pin.compiledEntryId !== effect.definition.compiledEntryId ||
    pin.frozenGraphNodeId !== effect.definition.frozenGraphNodeId ||
    pin.frozenSourceChecksum !== effect.definition.frozenGraph.source.checksum ||
    pin.capabilityContractVersion !== effect.definition.frozenGraph.capabilityContractVersion ||
    pin.activation !== effect.placement.activation ||
    pin.revealed !== effect.spatialState.revealed ||
    pin.revealOnTrigger !== effect.placement.revealOnTrigger ||
    checksumRuleDocument(effect.definition) !== effect.definitionChecksum ||
    checksumRuleDocument(effect.lifecycle) !== effect.lifecycleChecksum ||
    checksumRuleDocument(effect.placement) !== effect.placementChecksum ||
    checksumRuleDocument(effect.spatialState) !== effect.spatialStateChecksum
  )
    throw new Error('Spatial settlement effect pin is stale.')
}
