import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const EFFECT_KIND = {
  DAMAGE: 'DAMAGE',
  HIT_POINT_MAXIMUM_REDUCTION: 'HIT_POINT_MAXIMUM_REDUCTION',
  SCALAR_REDUCTION: 'SCALAR_REDUCTION',
  CONDITION: 'CONDITION',
  HEAL: 'HEAL',
  APPLY_GRANT: 'APPLY_GRANT',
  FORCED_MOVEMENT: 'FORCED_MOVEMENT',
  TELEPORT: 'TELEPORT',
  MANIFEST: 'MANIFEST',
  MOVE_MANIFEST: 'MOVE_MANIFEST',
  COMMAND_MANIFEST: 'COMMAND_MANIFEST',
  FOLLOW_UP_SAVE: 'FOLLOW_UP_SAVE',
  FOLLOW_UP_CHECK: 'FOLLOW_UP_CHECK',
  MOVEMENT_RULE: 'MOVEMENT_RULE',
  ACTION_ECONOMY_RULE: 'ACTION_ECONOMY_RULE',
  STABILIZE: 'STABILIZE',
  ARMOR_CLASS_FLOOR: 'ARMOR_CLASS_FLOOR',
  TELEPATHIC_LINK: 'TELEPATHIC_LINK',
  PLANT_PORTAL: 'PLANT_PORTAL',
  TREE_STRIDE: 'TREE_STRIDE',
  ACTOR_RELATIONSHIP: 'ACTOR_RELATIONSHIP',
  CLOSED_RULE: 'CLOSED_RULE',
  MANUAL_ADJUDICATION: 'MANUAL_ADJUDICATION'
} as const
export type EffectKind = keyof typeof EFFECT_KIND
export type NonManifestEffectKind = Exclude<EffectKind, typeof EFFECT_KIND.MANIFEST>

export type EffectKindOption = CoreMeta<EffectKind>

export const EFFECT_KIND_REGISTRY: Record<EffectKind, EffectKindOption> = {
  [EFFECT_KIND.DAMAGE]: {
    code: EFFECT_KIND.DAMAGE,
    label: 'Damage',
    tooltip: 'This effect deals damage.',
    description: 'This effect deals damage.'
  },
  [EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION]: {
    code: EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION,
    label: 'Hit Point Maximum Reduction',
    tooltip: 'Reduces a target’s hit point maximum by an already resolved damage outcome.',
    description:
      'References one earlier damage outcome and records the recovery tag required to end it.'
  },
  [EFFECT_KIND.SCALAR_REDUCTION]: {
    code: EFFECT_KIND.SCALAR_REDUCTION,
    label: 'Scalar Reduction',
    tooltip: 'Reduces one UUID-backed scalar by a bounded amount.',
    description: 'Persists an additive, recoverable reduction without changing the base value.'
  },
  [EFFECT_KIND.CONDITION]: {
    code: EFFECT_KIND.CONDITION,
    label: 'Condition',
    tooltip: 'This effect applies a condition.',
    description: 'This effect applies a condition.'
  },
  [EFFECT_KIND.HEAL]: {
    code: EFFECT_KIND.HEAL,
    label: 'Heal',
    tooltip: 'This effect restores hit points or grants temporary hit points.',
    description: 'This effect restores hit points or grants temporary hit points.'
  },
  [EFFECT_KIND.APPLY_GRANT]: {
    code: EFFECT_KIND.APPLY_GRANT,
    label: 'Apply Grant',
    tooltip: 'This effect applies one or more typed grants for a duration or trigger.',
    description: 'This effect applies one or more typed grants for a duration or trigger.'
  },
  [EFFECT_KIND.FORCED_MOVEMENT]: {
    code: EFFECT_KIND.FORCED_MOVEMENT,
    label: 'Forced Movement',
    tooltip:
      'This effect compels movement with typed direction, distance, and action-economy usage.',
    description:
      'This effect compels movement with typed direction, distance, and action-economy usage.'
  },
  [EFFECT_KIND.TELEPORT]: {
    code: EFFECT_KIND.TELEPORT,
    label: 'Teleport',
    tooltip: 'This effect repositions a creature.',
    description: 'This effect repositions a creature.'
  },
  [EFFECT_KIND.MANIFEST]: {
    code: EFFECT_KIND.MANIFEST,
    label: 'Manifest',
    tooltip:
      'This effect creates a persistent manifested thing such as a summon, wall, cloud, or sensor.',
    description:
      'This effect creates a persistent manifested thing such as a summon, wall, cloud, or sensor.'
  },
  [EFFECT_KIND.MOVE_MANIFEST]: {
    code: EFFECT_KIND.MOVE_MANIFEST,
    label: 'Move Manifest',
    tooltip: 'This effect repositions a previously created manifestation.',
    description: 'This effect repositions a previously created manifestation.'
  },
  [EFFECT_KIND.COMMAND_MANIFEST]: {
    code: EFFECT_KIND.COMMAND_MANIFEST,
    label: 'Command Manifest',
    tooltip: 'This effect commands a previously created manifestation to use one of its behaviors.',
    description:
      'This effect commands a previously created manifestation to use one of its behaviors.'
  },
  [EFFECT_KIND.FOLLOW_UP_SAVE]: {
    code: EFFECT_KIND.FOLLOW_UP_SAVE,
    label: 'Follow-up Save',
    tooltip: 'This effect schedules a later saving throw with typed success and failure results.',
    description: 'Schedules a later saving throw without applying encounter state.'
  },
  [EFFECT_KIND.FOLLOW_UP_CHECK]: {
    code: EFFECT_KIND.FOLLOW_UP_CHECK,
    label: 'Follow-up Check',
    tooltip: 'Offers a later fixed-DC ability check with typed success and failure results.',
    description: 'Schedules an ability check without applying encounter state.'
  },
  [EFFECT_KIND.MOVEMENT_RULE]: {
    code: EFFECT_KIND.MOVEMENT_RULE,
    label: 'Movement Rule',
    tooltip: 'Applies a closed movement or anchor restriction.',
    description: 'Describes a deterministic movement restriction for a future encounter resolver.'
  },
  [EFFECT_KIND.ACTION_ECONOMY_RULE]: {
    code: EFFECT_KIND.ACTION_ECONOMY_RULE,
    label: 'Action Economy Rule',
    tooltip: 'Limits attacks for an activation or turn.',
    description: 'Describes a deterministic attack-count restriction.'
  },
  [EFFECT_KIND.STABILIZE]: {
    code: EFFECT_KIND.STABILIZE,
    label: 'Stabilize',
    tooltip: 'Stabilizes a creature at 0 hit points.',
    description: 'Marks a creature at 0 hit points as stable.'
  },
  [EFFECT_KIND.ARMOR_CLASS_FLOOR]: {
    code: EFFECT_KIND.ARMOR_CLASS_FLOOR,
    label: 'Armor Class Floor',
    tooltip: 'Prevents Armor Class from falling below a fixed minimum.',
    description: 'Applies a minimum Armor Class without lowering a higher value.'
  },
  [EFFECT_KIND.TELEPATHIC_LINK]: {
    code: EFFECT_KIND.TELEPATHIC_LINK,
    label: 'Telepathic Link',
    tooltip: 'Links selected creatures for telepathic communication.',
    description: 'Defines the range, language, plane, and Intelligence limits of a telepathic link.'
  },
  [EFFECT_KIND.PLANT_PORTAL]: {
    code: EFFECT_KIND.PLANT_PORTAL,
    label: 'Plant Portal',
    tooltip: 'Links two plants as a movement-powered portal.',
    description: 'Defines the plants, destination knowledge, plane, and movement cost of a portal.'
  },
  [EFFECT_KIND.TREE_STRIDE]: {
    code: EFFECT_KIND.TREE_STRIDE,
    label: 'Tree Stride',
    tooltip: 'Moves a creature between qualifying trees.',
    description: 'Defines qualifying trees, distance, movement costs, and per-round use.'
  },
  [EFFECT_KIND.ACTOR_RELATIONSHIP]: {
    code: EFFECT_KIND.ACTOR_RELATIONSHIP,
    label: 'Actor Relationship',
    tooltip: 'Creates a target-owned, source-provenanced actor relationship.',
    description: 'Persists bounded relationship modules as one target-owned active effect.'
  },
  [EFFECT_KIND.CLOSED_RULE]: {
    code: EFFECT_KIND.CLOSED_RULE,
    label: 'Closed Rule',
    tooltip: 'Selects an audited deterministic SRD rule descriptor.',
    description: 'Preserves a closed, resolver-recognized SRD mechanic without free-form scripting.'
  },
  [EFFECT_KIND.MANUAL_ADJUDICATION]: {
    code: EFFECT_KIND.MANUAL_ADJUDICATION,
    label: 'Manual Adjudication',
    tooltip: 'This outcome is descriptive and must be resolved by a player or GM.',
    description: 'Marks behavior the engine intentionally does not automate.'
  }
} as const

export const EFFECT_KIND_OPTIONS = valuesOf(EFFECT_KIND_REGISTRY) as readonly EffectKindOption[]

export const NON_MANIFEST_EFFECT_KIND_OPTIONS = EFFECT_KIND_OPTIONS.filter(
  (option): option is CoreMeta<NonManifestEffectKind> => option.code !== EFFECT_KIND.MANIFEST
)
