import type { ManifestDestructionCriterionDto } from '@artificer-toolkit/schema/effects/destructionCriterion'
import type { SpatialLayerDestructionDto } from '@artificer-toolkit/schema/shared/spatial'
import { MANIFEST_SPELL_CAPABILITY_OPTIONS } from '@artificer-toolkit/shared/authored'

type ZoneLayer = { placement: { layerIndex?: number; destruction?: SpatialLayerDestructionDto } }

/**
 * Whether a layer of a layered zone may not be destroyed yet (D223): its zone's layers fall in
 * order and one before it remains on the Scene. `zones` are the Scene's placed zones.
 */
export function zoneLayerOutOfOrder(layer: ZoneLayer, zones: readonly ZoneLayer[]): boolean {
  const { destruction, layerIndex = 0 } = layer.placement
  return (
    destruction?.inOrder === true &&
    zones.some(
      ({ placement }) =>
        placement.destruction?.zoneId === destruction.zoneId &&
        (placement.layerIndex ?? 0) < layerIndex
    )
  )
}

/** One authored way a zone layer is destroyed, as the GM reads it, in the System's damage terms. */
export function zoneLayerDestructionCriterionText(
  criterion: ManifestDestructionCriterionDto,
  damageTypes: readonly { id: string; label: string }[]
): string {
  switch (criterion.kind) {
    case 'DAMAGE_THRESHOLD': {
      const damageType = damageTypes.find(({ id }) => id === criterion.damageTypeId)
      return `${criterion.amount} or more ${damageType?.label ?? criterion.damageTypeId} damage`
    }
    case 'STRONG_WIND':
      return 'A strong wind'
    case 'WIND_SPEED':
      return `Wind of ${criterion.minimumMilesPerHour} miles per hour or more for ${criterion.afterRounds} ${criterion.afterRounds === 1 ? 'round' : 'rounds'}`
    case 'SPELL_CAPABILITY': {
      const capability = MANIFEST_SPELL_CAPABILITY_OPTIONS.find(
        ({ code }) => code === criterion.capability
      )
      const level = criterion.minimumSpellLevel
        ? `a spell of level ${criterion.minimumSpellLevel} or higher`
        : 'any spell'
      return `${capability?.label ?? criterion.capability}: ${level}`
    }
    case 'NAMED_OBJECT':
      return criterion.objectLabel
  }
}
