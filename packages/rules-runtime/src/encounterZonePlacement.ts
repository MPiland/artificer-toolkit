import type { CompiledActionZonePlacement } from '@artificer-toolkit/schema/projections/characterMechanics'
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
  'interactionKind',
  'bypassAtHalfSpeed',
  'choosesUnaffected',
  'behaviors'
])

const ZONE_INTERACTION_TRIGGER_MODES: Readonly<
  Partial<
    Record<
      NonNullable<CompiledManifestComponent['interactionKind']>,
      CompiledActionZonePlacement['triggerModes']
    >
  >
> = {
  ENTER_SPACE: ['ENTER'],
  ENTER_OR_PASS_THROUGH: ['ENTER', 'CROSS'],
  MOVE_ACROSS: ['CROSS']
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
  const manifest = placedSpaceManifest(compiledEffect)
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

/** The movement a zone component reacts to, in canonical order; null for an unmodeled interaction. */
export function zoneTriggerModes(
  component: CompiledManifestComponent
): CompiledActionZonePlacement['triggerModes'] | null {
  return (
    (component.interactionKind && ZONE_INTERACTION_TRIGGER_MODES[component.interactionKind]) || null
  )
}
