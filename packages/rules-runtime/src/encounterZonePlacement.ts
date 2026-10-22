import type {
  CompiledActionZoneChoice,
  CompiledActionZonePlacement
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  CompiledEffectGroup,
  CompiledManifestComponent
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
  /**
   * Its components in authored order, each with the one behavior its entry runs: the first covers
   * the zone's shape, each later one the region it authors (D154). A component that only lends an
   * occupant save bonus runs no behavior (D155). Empty for a zone no creature interacts with, which
   * only its appear save acts through.
   */
  components: Array<{ component: CompiledManifestComponent; behavior: CompiledEffectGroup | null }>
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
  'components'
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
  'behaviors'
])

function hasUnmodeledField(value: object, modeled: ReadonlySet<string>): boolean {
  return Object.entries(value).some(([key, field]) => field !== undefined && !modeled.has(key))
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
 * amendment): the action narrowed to its save outcome entries, run as its area occurrence. Null
 * when the action authors none beside its zone.
 */
export function zoneAppearSave(compiledEffect: CompiledEffectGroup): CompiledEffectGroup | null {
  const entries = compiledEffect.entries.filter((entry) => entry.pathCode !== 'ON_USE')
  return entries.length ? { ...compiledEffect, entries } : null
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
  if ((!components.length && !appearSave) || !shape || !label)
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A placed zone needs a label, a shape and a component or a save when it appears.'
    )
  if (components[0]?.region || components.slice(1).some((component) => !component.region))
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A placed zone’s first component covers its shape, and each later one a region beside it.'
    )
  const planned = components.map((component) => {
    if (hasUnmodeledField(component, MODELED_COMPONENT_KEYS))
      throw new CharacterRuleActionUnsupportedCompilationError(
        'A placed zone component models only its region, interaction and behavior.'
      )
    const [behavior] = component.behaviors ?? []
    // A component lending an occupant save bonus acts on no one, so it authors no behavior (D155).
    if (component.occupantSaveBonus) {
      if (component.behaviors?.length)
        throw new CharacterRuleActionUnsupportedCompilationError(
          'A zone lending an occupant save bonus authors no behavior.'
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
  const { hollow, wallThickness } = manifest
  if (Boolean(hollow) !== (wallThickness !== undefined))
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A hollow zone has a wall thickness, and only a hollow zone has one.'
    )
  return {
    attachment: manifest.attachmentKind === 'SOURCE' ? 'SOURCE' : 'PLACED_SPACE',
    label,
    shape,
    ...(wallThickness ? { ringThickness: wallThickness } : {}),
    components: planned,
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
