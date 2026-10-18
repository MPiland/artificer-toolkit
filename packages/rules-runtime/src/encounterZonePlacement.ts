import type {
  CompiledActionZoneChoice,
  CompiledActionZonePlacement
} from '@artificer-toolkit/schema/projections/characterMechanics'
import { SPATIAL_TURN_TRIGGERS } from '@artificer-toolkit/schema/shared/spatial'
import type {
  CompiledEffectGroup,
  CompiledManifest,
  CompiledManifestComponent
} from '@artificer-toolkit/shared/compilers'

import { CharacterRuleActionUnsupportedCompilationError } from './characterRuleActionSystemAdapter.js'
import { castChoiceOptions } from './encounterCastChoice.js'

type PlacedSpaceManifest = Exclude<
  CompiledManifest,
  { manifestKind: 'CREATURE' } | { manifestKind: 'SUMMON' }
>

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
  component: CompiledManifestComponent
  behavior: CompiledEffectGroup
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
const MODELED_COMPONENT_KEYS: ReadonlySet<string> = new Set([
  'id',
  'order',
  'label',
  'interactionKinds',
  'bypassAtHalfSpeed',
  'choosesUnaffected',
  'maxApplicationsPerTurn',
  'requiresFullyWithin',
  'movementCostMultiplier',
  'blockingRules',
  'automaticSaveSuccessImmunityDamageTypeId',
  'behaviors'
])

type ZoneInteractionKind = NonNullable<CompiledManifestComponent['interactionKinds']>[number]

const ZONE_MOVEMENT_TRIGGERS: Readonly<
  Partial<Record<ZoneInteractionKind, CompiledActionZonePlacement['triggerModes']>>
> = {
  ENTER_SPACE: ['ENTER'],
  ENTER_OR_PASS_THROUGH: ['ENTER', 'CROSS'],
  MOVE_ACROSS: ['CROSS']
}

const ZONE_TURN_TRIGGERS: Readonly<
  Partial<
    Record<ZoneInteractionKind, NonNullable<CompiledActionZonePlacement['turnTriggers']>[number]>
  >
> = {
  START_TURN_IN_SPACE: 'START_OF_TURN',
  END_TURN_IN_SPACE: 'END_OF_TURN',
  START_OF_SOURCE_TURN: 'START_OF_SOURCE_TURN'
}

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
 * The zone manifest of an action whose entries are one PLACED_SPACE or SOURCE zone and at most one
 * APPLY_GRANT beside it (D153), with that grant's entry; null for any other action.
 */
function placedSpaceEntries(compiledEffect: CompiledEffectGroup): {
  manifest: PlacedSpaceManifest
  sourceGrantEntry: CompiledEffectGroup['entries'][number] | null
} | null {
  const zones = compiledEffect.entries.filter(
    (entry) =>
      'outcome' in entry &&
      entry.outcome.effectKind === 'MANIFEST' &&
      entry.outcome.manifestKind === 'ZONE' &&
      (entry.outcome.attachmentKind === 'PLACED_SPACE' || entry.outcome.attachmentKind === 'SOURCE')
  )
  const [zone] = zones
  const others = compiledEffect.entries.filter((entry) => entry !== zone)
  if (
    zones.length !== 1 ||
    !zone ||
    !('outcome' in zone) ||
    others.length > 1 ||
    others.some((entry) => !('outcome' in entry) || entry.outcome.effectKind !== 'APPLY_GRANT')
  )
    return null
  return { manifest: zone.outcome as PlacedSpaceManifest, sourceGrantEntry: others[0] ?? null }
}

/**
 * The placed zone of an action together with the one behavior its entry runs, or null when the
 * action places none. A zone that models more than a single entering behavior is refused (never
 * partly honored).
 */
export function placedSpaceZone(compiledEffect: CompiledEffectGroup): PlacedSpaceZone | null {
  const entries = placedSpaceEntries(compiledEffect)
  if (!entries) return null
  const { manifest, sourceGrantEntry } = entries
  if (hasUnmodeledField(manifest, MODELED_MANIFEST_KEYS))
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A placed zone models only its label, shape and entering components.'
    )
  const [component] = manifest.components ?? []
  const { label, shape } = manifest
  if (manifest.components?.length !== 1 || !component || !shape || !label)
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A placed zone needs a label, a shape and exactly one component.'
    )
  if (hasUnmodeledField(component, MODELED_COMPONENT_KEYS))
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A placed zone component models only its interaction and behavior.'
    )
  const [behavior] = component.behaviors ?? []
  if (component.behaviors?.length !== 1 || !behavior)
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A placed zone component needs exactly one behavior.'
    )
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
    component,
    behavior,
    sourceGrantEntry
  }
}

/**
 * What a zone component reacts to, in canonical order: the movements and the turn boundaries its
 * interactions name, and whether it answers a melee hit on its source (D153). Null when it names
 * none, or any interaction the System does not model.
 */
export function zoneTriggers(
  component: CompiledManifestComponent
): Pick<
  CompiledActionZonePlacement,
  'triggerModes' | 'turnTriggers' | 'retaliatesMeleeHits'
> | null {
  const kinds = component.interactionKinds
  if (!kinds?.length) return null
  const movement = new Set<string>()
  const turn = new Set<string>()
  for (const kind of kinds) {
    if (kind === 'MELEE_HIT_ON_SOURCE') continue
    const movements = ZONE_MOVEMENT_TRIGGERS[kind]
    const boundary = ZONE_TURN_TRIGGERS[kind]
    if (!movements && !boundary) return null
    movements?.forEach((trigger) => movement.add(trigger))
    if (boundary) turn.add(boundary)
  }
  const turnTriggers = SPATIAL_TURN_TRIGGERS.filter((t) => turn.has(t))
  return {
    triggerModes: (['ENTER', 'EXIT', 'CROSS'] as const).filter((t) => movement.has(t)),
    ...(turnTriggers.length ? { turnTriggers } : {}),
    ...(kinds.includes('MELEE_HIT_ON_SOURCE') ? { retaliatesMeleeHits: true as const } : {})
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
