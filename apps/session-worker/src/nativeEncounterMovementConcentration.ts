import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { deadCharacterIdsOfTargets } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { encounterConcentrationEndReason } from '@artificer-toolkit/rules-runtime/encounterConcentrationEnd'
import { prepareEncounterConcentrationState } from '@artificer-toolkit/rules-runtime/encounterConcentration'
import { prepareEncounterMovementConcentration } from '@artificer-toolkit/rules-runtime/encounterMovementConcentration'
import {
  movementSlotKey,
  projectEncounterMovementConcentrationEnd,
  projectEncounterMovementEffectRelease,
  projectedHeldStates
} from '@artificer-toolkit/rules-runtime/encounterMovementMaintenance'
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

/** Both spatial damage interruption and save preparation observe the same projected states, in casting order. */
export async function readNativeLiveMovementConcentrationStates(input: {
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
  const response = await capture({
    kind: 'MAINTENANCE_STATES',
    actorId: targetActorId,
    definitionId
  })
  if (response.kind !== 'MAINTENANCE_STATES')
    throw new Error('Movement Concentration states are unavailable.')
  const held = projectedHeldStates(projection, response.states, targetActorId, definitionId)
  const prepared = await Promise.all(
    held.map((maintained) =>
      prepareEncounterConcentrationState({
        state,
        targetActorId,
        maintained,
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
    )
  )
  return prepared.filter((entry) => entry !== null)
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
    loadStates: (targetActorId, targets, projection) =>
      readNativeLiveMovementConcentrationStates({
        state,
        targetActorId,
        targets,
        projection,
        capture
      }),
    findEnds: async (actorId, targets, projection) => {
      const target = targets.get(actorId)
      if (!target) return []
      const held = await readNativeLiveMovementConcentrationStates({
        state,
        targetActorId: actorId,
        targets,
        projection,
        capture
      })
      if (!held.length) return []
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
        ? held.map(({ maintained }) => ({
            maintainedState: {
              id: maintained.id,
              version: maintained.version,
              maintenanceDefinitionId: maintained.maintenanceDefinitionId,
              descriptorChecksum: maintained.descriptorChecksum,
              createdAt: maintained.createdAt
            },
            reason
          }))
        : []
    },
    projectEnd: async ({ actorId, maintainedState }, targets, projection) => {
      const definitionId = maintainedState.maintenanceDefinitionId
      const slot =
        projection?.slots.get(movementSlotKey(actorId, definitionId, maintainedState.id)) ??
        (await readNativeLiveMaintenanceSlot({
          encounterId: state.id,
          actorId,
          definitionId,
          stateId: maintainedState.id,
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
          maintenance: {
            state: maintained,
            removed: slot.dependents,
            zoneIds: slot.zoneIds,
            owners,
            characterVersions
          },
          targets,
          projection,
          campaignId: state.campaignId,
          gameSystemId: state.gameSystemId,
          occurredAt: input.occurredAt
        },
        (row) => readNativeLiveMaintenanceCharacter(row, state.gameSystemId)
      )
    },
    readVocabulary: async () => {
      const response = await capture({ kind: 'SYSTEM_VOCABULARY' })
      if (response.kind !== 'SYSTEM_VOCABULARY')
        throw new Error('Movement repeat save vocabulary is unavailable.')
      return response.snapshot
    },
    projectRelease: async (effect, targets, projection) => {
      const removed = [effect]
      const { owners, characterVersions } = await readNativeLiveMaintenanceOwners({
        gameSystemId: state.gameSystemId,
        actors: [...targets.values()].map((target) => target.actor),
        activeEffectsByActorId: new Map(
          [...targets].map(([id, target]) => [id, target.activeEffects])
        ),
        removed,
        slot: null,
        capture,
        targets,
        projection
      })
      return projectEncounterMovementEffectRelease(
        {
          maintenance: { removed, owners, characterVersions },
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
