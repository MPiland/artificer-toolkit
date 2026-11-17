import type {
  CompiledActionZoneChoice,
  CompiledActionZonePlacement
} from '@artificer-toolkit/schema/projections/characterMechanics'
import { MAX_ZONE_LAYERS } from '@artificer-toolkit/schema/shared/spatial'
import type {
  CompiledEffectGroup,
  CompiledManifestComponent,
  CompiledManifestProximityRule
} from '@artificer-toolkit/shared/compilers'

import type { AttackProfileCapabilityAdapter } from './attackProfileCapability.js'
import { CharacterRuleActionUnsupportedCompilationError } from './characterRuleActionSystemAdapter.js'
import { castChoiceOptions } from './encounterCastChoice.js'
import { placedSpaceEntries, type PlacedSpaceManifest } from './placedSpaceEntries.js'

/**
 * An authored zone an action places, with the behavior its entry runs: left at a chosen point, or
 * (a SOURCE zone) centered on the action's user and moving with it.
 */
export interface PlacedSpaceZone {
  attachment: CompiledActionZonePlacement['attachment']
  label: string
  shape: NonNullable<PlacedSpaceManifest['shape']>
  /** A hollow zone's wall thickness: it is a ring (D154). Absent for a filled zone. */
  ringThickness?: CompiledActionZonePlacement['ringThickness']
  /** The spot DC that conceals the zone (MOVE-3.4). Absent for a zone in plain sight. */
  camouflage?: CompiledActionZonePlacement['camouflage']
  /**
   * Its components in authored order, each with the one behavior its entry runs: the first covers
   * the zone's shape, each later one the region it authors (D154). A component that only lends an
   * occupant save bonus runs no behavior (D155). Empty for a zone no creature interacts with, which
   * only its appear save acts through.
   */
  components: Array<{ component: CompiledManifestComponent; behavior: CompiledEffectGroup | null }>
  /**
   * Whether the components are layers of the zone's own shape, each met in order (D223), rather than
   * a shape and the regions beside it. Absent for a zone of one layer or with regions.
   */
  layered?: true
  /**
   * Whether a layered zone's layers are destroyed only in order and stay destroyed (D223). Absent
   * when no layer authors what destroys it, or any may fall first.
   */
  destructionInOrder?: true
  /**
   * The proximity rule that puts a creature within `reach` of the zone through its behavior (D223);
   * absent for a zone with none.
   */
  proximity?: {
    reach: CompiledManifestProximityRule['distance']
    planned: PlacedSpaceZone['components'][number]
  }
  /** Whether the caster designates creatures at cast that the zone never affects. */
  designatedCreatureImmunity?: true
  /** The save each creature in the area makes when the zone appears; null for none. */
  appearSave: CompiledEffectGroup | null
  /** The zone's compiled entry: its manifest outcome. */
  entry: CompiledEffectGroup['entries'][number]
  /** The one APPLY_GRANT entry authored beside the zone, which its placer holds; null for none. */
  sourceGrantEntry: CompiledEffectGroup['entries'][number] | null
}

/** The authored fields a placed zone models; any other field would change behavior unmodeled. */
const MODELED_MANIFEST_KEYS: ReadonlySet<string> = new Set([
  'id',
  'effectKind',
  'manifestKind',
  'attachmentKind',
  'label',
  'shape',
  'hollow',
  'wallThickness',
  'camouflage',
  'components',
  'componentsMustResolveInOrder',
  // The GM destroys a layer by its criteria (D223); a destroyed layer is removed, so it stays so.
  'destructionMustResolveInOrder',
  'destroyedComponentsRemainDestroyed',
  // Its halo is a record of the zone's own (D223); a rule that acts as a creature moves is refused.
  'proximityRule',
  'designatedCreatureImmunity',
  // No antimagic suppression exists, so a zone immune to it is honored as is (D223).
  'suppressionImmunities'
])
/**
 * The target fact a planner pins `false` when an occupant lacks the sight a zone requires of it, so the
 * zone's save succeeds unrolled. Absent for a zone that needs no sight.
 */
export const ZONE_SIGHT_REQUIREMENT_MET_FACT_KEY = 'zoneSightRequirementMet'
const MODELED_COMPONENT_KEYS: ReadonlySet<string> = new Set([
  'id',
  'order',
  'label',
  'region',
  'interactionKinds',
  'bypassAtHalfSpeed',
  'choosesUnaffected',
  'maxApplicationsPerTurn',
  'requiresFullyWithin',
  'requiredSight',
  'movementCostMultiplier',
  'perDistanceMoved',
  'blockingRules',
  'automaticSaveSuccessImmunityDamageTypeId',
  'occupantSaveBonus',
  'occupantConditionImmunity',
  'destructionCriteria',
  'requiresIgnition',
  'behaviors'
])

function hasUnmodeledField(value: object, modeled: ReadonlySet<string>): boolean {
  return Object.entries(value).some(([key, field]) => field !== undefined && !modeled.has(key))
}

/**
 * The component a zone's proximity rule puts a creature near the zone through (D223): the rule's one
 * behavior, caught at the start of the creature's turn, that needs sight of the zone when the rule
 * does. A rule that also acts as a creature moves is refused until movement reads that sight.
 */
function proximityPlan(
  rule: CompiledManifestProximityRule,
  label: string,
  attachmentKind: PlacedSpaceManifest['attachmentKind']
): NonNullable<PlacedSpaceZone['proximity']> {
  if (attachmentKind !== 'PLACED_SPACE')
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A proximity rule belongs to a zone left where its cast places it.'
    )
  if (rule.events.length !== 1 || rule.events[0] !== 'START_TURN')
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A proximity rule acts only at the start of a creature’s turn.'
    )
  return {
    reach: rule.distance,
    planned: {
      component: {
        id: rule.id,
        order: 1,
        label,
        interactionKinds: ['START_TURN_IN_SPACE'],
        ...(rule.requiresSight ? { requiredSight: ['OCCUPANT_SEES_ZONE' as const] } : {})
      },
      behavior: rule.behavior
    }
  }
}

/**
 * The manifest of an action whose one outcome places a zone in the space it names (a PLACED_SPACE
 * ZONE) or on its user (a SOURCE ZONE), or null for any other action. Identification only:
 * {@link placedSpaceZone} validates it.
 */
export function placedSpaceManifest(
  compiledEffect: CompiledEffectGroup
): PlacedSpaceManifest | null {
  // A cast-time pick places one of its options' zones, which share the area (D140).
  const options = castChoiceOptions(compiledEffect)
  if (!options) return singlePlacedSpaceManifest(compiledEffect)
  const manifests = options.map((option) => singlePlacedSpaceManifest(option.compiledEffect))
  return manifests.every((manifest) => manifest !== null) ? (manifests[0] ?? null) : null
}

function singlePlacedSpaceManifest(
  compiledEffect: CompiledEffectGroup
): PlacedSpaceManifest | null {
  return placedSpaceEntries(compiledEffect)?.manifest ?? null
}

/**
 * The save each creature in the area makes when the zone an action places appears (D154
 * amendment): the action narrowed to its save outcome entries, run as its area occurrence. A zone a
 * failed save leaves on its target is that save's own outcome, so the save is kept with no other.
 * Null when the action authors none beside its zone.
 */
export function zoneAppearSave(compiledEffect: CompiledEffectGroup): CompiledEffectGroup | null {
  const zone = placedSpaceEntries(compiledEffect)?.entry
  const entries = compiledEffect.entries.filter(
    (entry) => entry.pathCode !== 'ON_USE' && entry !== zone
  )
  return entries.length || zone?.pathCode === 'ON_SAVE_FAIL' ? { ...compiledEffect, entries } : null
}

/**
 * The placed zone of an action together with the one behavior its entry runs, or null when the
 * action places none. A zone that models more than a single entering behavior is refused (never
 * partly honored).
 */
export function placedSpaceZone(compiledEffect: CompiledEffectGroup): PlacedSpaceZone | null {
  const entries = placedSpaceEntries(compiledEffect)
  if (!entries) return null
  const { manifest, entry, sourceGrantEntry } = entries
  if (hasUnmodeledField(manifest, MODELED_MANIFEST_KEYS))
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A placed zone models only its label, shape and entering components.'
    )
  const components = [...(manifest.components ?? [])].sort((a, b) => a.order - b.order)
  const { label, shape } = manifest
  const appearSave = zoneAppearSave(compiledEffect)
  if (!shape || !label)
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A placed zone needs a label and a shape.'
    )
  const layered = manifest.componentsMustResolveInOrder === true
  if (
    layered
      ? components.length < 2 ||
        components.length > MAX_ZONE_LAYERS ||
        components.some((component) => component.region)
      : components[0]?.region || components.slice(1).some((component) => !component.region)
  )
    throw new CharacterRuleActionUnsupportedCompilationError(
      layered
        ? `A layered zone has 2 to ${MAX_ZONE_LAYERS} layers, each covering its shape.`
        : 'A placed zone’s first component covers its shape, and each later one a region beside it.'
    )
  const destructible =
    manifest.destructionMustResolveInOrder === true ||
    components.some((component) => component.destructionCriteria?.length)
  if (destructible && (!layered || manifest.destroyedComponentsRemainDestroyed !== true))
    throw new CharacterRuleActionUnsupportedCompilationError(
      'Only a layered zone whose destroyed layers stay destroyed authors what destroys them.'
    )
  // Lighting is the zone's own state, so a zone waiting to be lit has nothing beside it.
  if (components.length > 1 && components.some((component) => component.requiresIgnition))
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A zone that needs lighting has one component.'
    )
  const planned = components.map((component) => {
    if (hasUnmodeledField(component, MODELED_COMPONENT_KEYS))
      throw new CharacterRuleActionUnsupportedCompilationError(
        'A placed zone component models only its region, interaction and behavior.'
      )
    const [behavior] = component.behaviors ?? []
    // A component lending its occupants a save bonus or condition immunity acts on no one, so it
    // authors no behavior (D155).
    if (component.occupantSaveBonus || component.occupantConditionImmunity) {
      if (component.behaviors?.length)
        throw new CharacterRuleActionUnsupportedCompilationError(
          'A zone lending its occupants a benefit authors no behavior.'
        )
      return { component, behavior: null }
    }
    // A component that only changes the cost of moving through it (Entangle's difficult terrain)
    // is met by no creature, so it authors no behavior either (SPELLS-20 T4d).
    if (
      component.movementCostMultiplier !== undefined &&
      !component.interactionKinds?.length &&
      !component.behaviors?.length
    )
      return { component, behavior: null }
    if (component.behaviors?.length !== 1 || !behavior)
      throw new CharacterRuleActionUnsupportedCompilationError(
        'A placed zone component needs exactly one behavior.'
      )
    return { component, behavior }
  })
  const { hollow, wallThickness, camouflage } = manifest
  if (Boolean(hollow) !== (wallThickness !== undefined))
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A hollow zone has a wall thickness, and only a hollow zone has one.'
    )
  return {
    attachment:
      manifest.attachmentKind === 'SOURCE' || manifest.attachmentKind === 'PRIMARY_TARGET'
        ? manifest.attachmentKind
        : 'PLACED_SPACE',
    label,
    shape,
    ...(manifest.proximityRule
      ? { proximity: proximityPlan(manifest.proximityRule, label, manifest.attachmentKind) }
      : {}),
    ...(wallThickness ? { ringThickness: wallThickness } : {}),
    ...(camouflage ? { camouflage } : {}),
    components: planned,
    ...(layered ? { layered: true as const } : {}),
    ...(destructible && manifest.destructionMustResolveInOrder
      ? { destructionInOrder: true as const }
      : {}),
    ...(manifest.designatedCreatureImmunity ? { designatedCreatureImmunity: true as const } : {}),
    appearSave,
    entry,
    sourceGrantEntry
  }
}

/**
 * The retaliation zone a creature's passive melee trait stands for (Remorhaz Heated Body): a SOURCE
 * zone as far around its holder as the trait's range, answering a melee hit on the holder with the
 * trait's own direct entries (D153). The trait authors no zone, so the zone is derived from it. Null
 * for any other effect.
 */
export function passiveMeleeRetaliationZone(
  compiledEffect: CompiledEffectGroup,
  label: string | undefined,
  attackKind: AttackProfileCapabilityAdapter['attackKind']
): PlacedSpaceZone | null {
  const { invocation, entries } = compiledEffect
  if (invocation.kind !== 'PASSIVE' || attackKind(invocation.triggerCode) !== 'MELEE') return null
  const { range } = invocation
  const [entry] = entries
  if (!label || range.rangeKind !== 'DISTANCE' || !entry)
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A passive melee trait answers a hit within a distance of its holder.'
    )
  return {
    attachment: 'SOURCE',
    label,
    shape: {
      id: range.id,
      shapeKind: 'SPHERE',
      radius: { amount: range.amount, unit: range.unit }
    },
    components: [
      {
        component: {
          id: compiledEffect.id,
          order: 1,
          label,
          interactionKinds: ['MELEE_HIT_ON_SOURCE']
        },
        behavior: compiledEffect
      }
    ],
    appearSave: null,
    entry,
    sourceGrantEntry: null
  }
}

/**
 * What every zone an action may place shares (whether it spares creatures, its Concentration): its
 * only zone, or its first option's (D140). The options' areas may differ (D154).
 */
export function sharedZonePlacement(
  placement: CompiledActionZonePlacement | CompiledActionZoneChoice
): CompiledActionZonePlacement {
  return 'options' in placement ? placement.options[0]!.zone : placement
}

/**
 * The zone the caster's pick places: the option it names, or the action's only zone when it names
 * none. Null when the pick does not fit the action.
 */
export function chosenZonePlacement(
  placement: CompiledActionZonePlacement | CompiledActionZoneChoice,
  optionId: string | undefined
): CompiledActionZonePlacement | null {
  if (!('options' in placement)) return optionId === undefined ? placement : null
  return placement.options.find((option) => option.optionId === optionId)?.zone ?? null
}
