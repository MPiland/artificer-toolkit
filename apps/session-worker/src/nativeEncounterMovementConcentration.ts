import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { deadCharacterIdsOfTargets } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { encounterConcentrationEndReason } from '@artificer-toolkit/rules-runtime/encounterConcentrationEnd'
import { prepareEncounterConcentrationState } from '@artificer-toolkit/rules-runtime/encounterConcentration'
import { prepareEncounterMovementConcentration } from '@artificer-toolkit/rules-runtime/encounterMovementConcentration'
import { projectEncounterMovementConcentrationEnd } from '@artificer-toolkit/rules-runtime/encounterMovementMaintenance'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import {
  readNativeLiveMaintenanceOwners,
  readNativeLiveMaintenanceSlot,
  readNativeLiveMaintenanceCharacter,
  type NativeLiveMovementMaintenanceProjection
} from './nativeEncounterMaintenance.js'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'

type CharacterFacts = PreparedLiveCharacterSheet

/** Both spatial damage interruption and save preparation observe the same projected slot. */
export async function readNativeLiveMovementConcentrationState(input: {
  state: Parameters<typeof prepareEncounterConcentrationState>[0]['state']
  targetActorId: string
  targets: Parameters<
    typeof prepareEncounterMovementConcentration<
      CharacterFacts,
      NativeLiveMovementMaintenanceProjection
    >
  >[0]['targets']
  projection?: NativeLiveMovementMaintenanceProjection
  capture(request: LiveSessionEncounterRulesRequest): Promise<LiveSessionEncounterRulesResponse>
}) {
  const { state, targetActorId, targets, projection, capture } = input
  const definitionId = requireInstalledConcentrationMaintenanceDefinitionId(state.gameSystemId)
  const projected = projection?.slots.get(`${targetActorId}:${definitionId}`)
  const stored = projected
    ? null
    : await capture({ kind: 'MAINTENANCE_SLOT', actorId: targetActorId, definitionId })
  if (stored && stored.kind !== 'MAINTENANCE_SLOT')
    throw new Error('Movement Concentration slot is unavailable.')
  return prepareEncounterConcentrationState({
    state,
    targetActorId,
    maintained: projected ? projected.state : (stored?.state ?? null),
    loadTarget: () => targets.get(targetActorId),
    readDefinition: async (definitionId) => {
      const response = await capture({ kind: 'DEFINITION', definitionId })
      if (response.kind !== 'DEFINITION')
        throw new Error('Movement Concentration definition is unavailable.')
      return response.definition
    },
    readVocabulary: async () => {
      const response = await capture({ kind: 'SYSTEM_VOCABULARY' })
      if (response.kind !== 'SYSTEM_VOCABULARY')
        throw new Error('Movement Concentration vocabulary is unavailable.')
      return response.snapshot
    }
  })
}

/** Computes checks against the state after the preceding movement contact; no writes or new versions. */
export function prepareNativeLiveMovementConcentration(
  input: Parameters<
    typeof prepareEncounterMovementConcentration<
      CharacterFacts,
      NativeLiveMovementMaintenanceProjection
    >
  >[0] & {
    capture(request: LiveSessionEncounterRulesRequest): Promise<LiveSessionEncounterRulesResponse>
    runtime: RulesRuntimeService
    random(maximum: number): number
  }
) {
  const { capture, state } = input
  return prepareEncounterMovementConcentration<
    CharacterFacts,
    NativeLiveMovementMaintenanceProjection
  >(input, {
    runtime: async () => input.runtime,
    random: input.random,
    loadState: (targetActorId, targets, projection) =>
      readNativeLiveMovementConcentrationState({
        state,
        targetActorId,
        targets,
        projection,
        capture
      }),
    findEnd: async (actorId, targets, projection) => {
      const definitionId = requireInstalledConcentrationMaintenanceDefinitionId(state.gameSystemId)
      const slot =
        projection?.slots.get(`${actorId}:${definitionId}`) ??
        (await readNativeLiveMaintenanceSlot({
          encounterId: state.id,
          actorId,
          definitionId,
          capture
        }))
      const target = targets.get(actorId)
      if (!slot.state || !target) return null
      const reason = await encounterConcentrationEndReason({
        actor: target.actor,
        deadCharacterIds: deadCharacterIdsOfTargets([target]),
        conditionIds: target.state.conditions,
        activeEffects: target.activeEffects,
        gameSystemId: state.gameSystemId,
        definitions: {
          requireCurrent: async (id) => {
            const response = await capture({ kind: 'DEFINITION', definitionId: id })
            if (response.kind !== 'DEFINITION' || !response.definition)
              throw new Error('Concentration capability definition is unavailable.')
            return response.definition
          }
        }
      })
      return reason
        ? {
            maintainedState: {
              id: slot.state.id,
              version: slot.state.version,
              maintenanceDefinitionId: slot.state.maintenanceDefinitionId,
              descriptorChecksum: slot.state.descriptorChecksum
            },
            reason
          }
        : null
    },
    projectEnd: async ({ actorId, maintainedState }, targets, projection) => {
      const definitionId = maintainedState.maintenanceDefinitionId
      const projectedSlot = projection?.slots.get(`${actorId}:${definitionId}`)
      const slot =
        projectedSlot ??
        (await readNativeLiveMaintenanceSlot({
          encounterId: state.id,
          actorId,
          definitionId,
          capture
        }))
      const maintained = slot.state
      if (
        !maintained ||
        maintained.id !== maintainedState.id ||
        maintained.encounterId !== state.id ||
        maintained.ownerActorId !== actorId ||
        maintained.version !== maintainedState.version ||
        maintained.maintenanceDefinitionId !== definitionId ||
        maintained.descriptorChecksum !== maintainedState.descriptorChecksum
      )
        throw new Error('Movement Concentration state changed before cleanup.')
      const { owners, characterVersions } = await readNativeLiveMaintenanceOwners({
        gameSystemId: state.gameSystemId,
        actors: [...targets.values()].map((target) => target.actor),
        activeEffectsByActorId: new Map(
          [...targets].map(([id, target]) => [id, target.activeEffects])
        ),
        removed: slot.dependents,
        slot: { actorId, definitionId, stateId: maintained.id },
        capture,
        targets,
        projection
      })
      return projectEncounterMovementConcentrationEnd(
        {
          maintenance: { state: maintained, removed: slot.dependents, owners, characterVersions },
          targets,
          projection,
          campaignId: state.campaignId,
          gameSystemId: state.gameSystemId,
          occurredAt: input.occurredAt
        },
        (row) => readNativeLiveMaintenanceCharacter(row, state.gameSystemId)
      )
    }
  })
}
