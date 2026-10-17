import type {
  CompiledActionZoneChoice,
  CompiledActionZonePlacement
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  CompiledEffectGroup,
  CompiledManifest,
  CompiledManifestComponent
} from '@artificer-toolkit/shared/compilers'

import { CharacterRuleActionUnsupportedCompilationError } from './characterRuleActionSystemAdapter.js'

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
  component: CompiledManifestComponent
  behavior: CompiledEffectGroup
}

/** The authored fields a placed zone models; any other field would change behavior unmodeled. */
const MODELED_MANIFEST_KEYS: ReadonlySet<string> = new Set([
  'id',
  'effectKind',
  'manifestKind',
  'attachmentKind',
  'label',
  'shape',
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
  'automaticSaveSuccessImmunityDamageTypeIds',
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
  END_TURN_IN_SPACE: 'END_OF_TURN'
}

function hasUnmodeledField(value: object, modeled: ReadonlySet<string>): boolean {
  return Object.entries(value).some(([key, field]) => field !== undefined && !modeled.has(key))
}

/**
 * The options of an action whose one ON_USE CHOICE path lets its caster pick the zone at cast
 * (D140), each as the action narrowed to that option's entries; null for any other action.
 */
export function zoneChoiceOptions(
  compiledEffect: CompiledEffectGroup
): { optionId: string; label: string; compiledEffect: CompiledEffectGroup }[] | null {
  const [first] = compiledEffect.entries
  if (
    !first ||
    !compiledEffect.entries.every(
      (entry) =>
        'outcome' in entry &&
        entry.groupKind === 'CHOICE' &&
        entry.pathCode === 'ON_USE' &&
        entry.pathGroupId === first.pathGroupId &&
        entry.label !== undefined
    )
  )
    return null
  const optionIds = [...new Set(compiledEffect.entries.map(({ entryId }) => entryId))]
  if (optionIds.length < 2) return null
  return optionIds.map((optionId) => {
    const entries = compiledEffect.entries.filter((entry) => entry.entryId === optionId)
    const [entry] = entries
    return {
      optionId,
      label: entry && 'label' in entry ? (entry.label ?? '') : '',
      compiledEffect: { ...compiledEffect, entries }
    }
  })
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
  const options = zoneChoiceOptions(compiledEffect)
  if (!options) return singlePlacedSpaceManifest(compiledEffect)
  const manifests = options.map((option) => singlePlacedSpaceManifest(option.compiledEffect))
  return manifests.every((manifest) => manifest !== null) ? (manifests[0] ?? null) : null
}

function singlePlacedSpaceManifest(
  compiledEffect: CompiledEffectGroup
): PlacedSpaceManifest | null {
  const [entry] = compiledEffect.entries
  if (compiledEffect.entries.length !== 1 || !entry || !('outcome' in entry)) return null
  const outcome = entry.outcome
  return outcome.effectKind === 'MANIFEST' &&
    outcome.manifestKind === 'ZONE' &&
    (outcome.attachmentKind === 'PLACED_SPACE' || outcome.attachmentKind === 'SOURCE')
    ? (outcome as PlacedSpaceManifest)
    : null
}

/**
 * The placed zone of an action together with the one behavior its entry runs, or null when the
 * action places none. A zone that models more than a single entering behavior is refused (never
 * partly honored).
 */
export function placedSpaceZone(compiledEffect: CompiledEffectGroup): PlacedSpaceZone | null {
  const manifest = singlePlacedSpaceManifest(compiledEffect)
  if (!manifest) return null
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
  return {
    attachment: manifest.attachmentKind === 'SOURCE' ? 'SOURCE' : 'PLACED_SPACE',
    label,
    shape,
    component,
    behavior
  }
}

/**
 * What a zone component reacts to, in canonical order: the movements and the turn boundaries its
 * interactions name. Null when it names none, or any interaction the System does not model.
 */
export function zoneTriggers(
  component: CompiledManifestComponent
): Pick<CompiledActionZonePlacement, 'triggerModes' | 'turnTriggers'> | null {
  const kinds = component.interactionKinds
  if (!kinds?.length) return null
  const movement = new Set<string>()
  const turn = new Set<string>()
  for (const kind of kinds) {
    const movements = ZONE_MOVEMENT_TRIGGERS[kind]
    const boundary = ZONE_TURN_TRIGGERS[kind]
    if (!movements && !boundary) return null
    movements?.forEach((trigger) => movement.add(trigger))
    if (boundary) turn.add(boundary)
  }
  const turnTriggers = (['START_OF_TURN', 'END_OF_TURN'] as const).filter((t) => turn.has(t))
  return {
    triggerModes: (['ENTER', 'EXIT', 'CROSS'] as const).filter((t) => movement.has(t)),
    ...(turnTriggers.length ? { turnTriggers } : {})
  }
}

/** What every zone an action may place shares: its only zone, or its first option's (D140). */
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
