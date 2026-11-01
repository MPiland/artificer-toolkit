import { type ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { type EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { buildEncounterMaintenanceTransition } from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import {
  planEncounterPlacedZone,
  planEncounterZoneBands
} from '@artificer-toolkit/rules-runtime/encounterPlacedZone'
import { preparedSpellCastLevel } from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
import {
  prepareNativeLiveActionMaintenance,
  prepareNativeLiveMaintainedState
} from './nativeEncounterMaintenance.js'
import type {
  AreaPlanBase,
  AreaPrepared,
  AreaReach,
  MovementTargets
} from './nativeAreaPreparation.js'

/**
 * Opens the maintenance an area commit shares across every creature it catches: what the cast
 * replaces, the ids and planner of the zone it leaves, and the zone that holds a condition.
 */
export async function prepareAreaCommitMaintenance(args: {
  input: AreaPlanBase
  command: ResolveEncounterActionInputDto
  caster: EncounterRunActorState
  lead: AreaPrepared
  movementTargets: ReadonlyMap<string, MovementTargets>
  placement: AreaReach['placement']
  areaOccurrenceId: string
}) {
  const { input, command, caster, lead, movementTargets, placement, areaOccurrenceId } = args
  const { state } = input
  // One Concentration spans every creature the area caught: the first outcome that maintains an
  // effect creates the one maintained state (and carries the replacement of the caster's prior
  // one); each later outcome joins it.
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared: lead,
    activeEffectsByActorId: input.activeEffectsByActorId,
    capture: input.capture,
    endedMaintainedStateId: command.endedMaintainedStateId,
    loadCarriedHolder: async (carrier) =>
      movementTargets.get(carrier.id) ?? input.loadTarget(carrier)
  })
  const removedIds = new Set(maintenance?.removed.map((effect) => effect.id))
  // The zone's own record, then one per band beside its wall (D154), all in the cast's maintenance.
  // They are named before the outcomes, so the hold a failed appear save leaves names its zone.
  const zoneIds = placement
    ? [crypto.randomUUID(), ...placement.regions.map(() => crypto.randomUUID())]
    : []
  const planZones = (maintainedEffectStateId: string | null) => {
    if (!placement) return []
    const zoneInput = {
      zone: placement.zone,
      maintainedEffectStateId: placement.zone.maintenance ? maintainedEffectStateId : null,
      encounterId: state.id,
      occurrenceId: areaOccurrenceId,
      rootCommandId: command.commandId,
      sourceActorId: caster.id,
      point: placement.origin,
      area: placement.shape,
      sourceToken: placement.sourceToken,
      distanceStep: placement.distanceStep,
      saveDc: lead.characterActionState?.actionMechanic.save?.dc ?? null,
      originLevel: preparedSpellCastLevel(lead),
      unaffectedActorIds: placement.unaffectedActorIds
    }
    return [
      planEncounterPlacedZone({ ...zoneInput, id: zoneIds[0]! }),
      ...planEncounterZoneBands({
        ...zoneInput,
        ids: zoneIds.slice(1),
        regions: placement.regions
      })
    ]
  }
  const holdingZone = placement?.zone.heldCondition
    ? { record: planZones(null)[0]!, maintenance: placement.zone.maintenance }
    : undefined
  return { maintenance, removedIds, planZones, holdingZone }
}

/**
 * A zone-only or summon-only cast has no creature outcome to hold its Concentration: the area root
 * carries it and the zone or the summon's carrier effect depends on the state (D135).
 */
export function openZoneOnlyMaintenance(args: {
  input: AreaPlanBase
  command: ResolveEncounterActionInputDto
  caster: EncounterRunActorState
  placement: AreaReach['placement']
  summon?: AreaReach['summon']
  areaOccurrenceId: string
  occurredAt: string
  maintenance: Awaited<ReturnType<typeof prepareAreaCommitMaintenance>>['maintenance']
  maintainedState: ReturnType<typeof prepareNativeLiveMaintainedState> | null
}) {
  const { input, command, caster, placement, summon, areaOccurrenceId, occurredAt, maintenance } =
    args
  const { state } = input
  let { maintainedState } = args
  let zoneMaintenanceTransition: ReturnType<typeof buildEncounterMaintenanceTransition> | null =
    null
  const completedPolicy = placement?.zone.maintenance ?? summon?.placement.entry.maintenance
  if (completedPolicy && maintenance && !maintainedState) {
    maintainedState = prepareNativeLiveMaintainedState({
      completedPolicy,
      maintenance,
      encounterId: state.id,
      ownerActorId: caster.id,
      actionId: command.actionId,
      sourceOccurrenceId: areaOccurrenceId,
      occurredAt
    })
    zoneMaintenanceTransition = buildEncounterMaintenanceTransition({
      maintenance,
      createdState: maintainedState,
      createdDependentEffectIds: []
    })
  }
  return { maintainedState, zoneMaintenanceTransition }
}
