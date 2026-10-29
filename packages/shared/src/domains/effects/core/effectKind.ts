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
  FOLLOW_UP_SAVE: 'FOLLOW_UP_SAVE',
  FOLLOW_UP_CHECK: 'FOLLOW_UP_CHECK',
  MOVEMENT_RULE: 'MOVEMENT_RULE',
  ACTION_ECONOMY_RULE: 'ACTION_ECONOMY_RULE',
  STABILIZE: 'STABILIZE',
  KILL: 'KILL',
  HIT_POINTS_TO_ZERO: 'HIT_POINTS_TO_ZERO',
  REVIVE: 'REVIVE',
  ARMOR_CLASS_FLOOR: 'ARMOR_CLASS_FLOOR',
  RESTORE_RESOURCE: 'RESTORE_RESOURCE',
  SPELL_SLOT_EXCHANGE: 'SPELL_SLOT_EXCHANGE',
  TELEPATHIC_LINK: 'TELEPATHIC_LINK',
  PLANT_PORTAL: 'PLANT_PORTAL',
  TREE_STRIDE: 'TREE_STRIDE',
  ACTOR_RELATIONSHIP: 'ACTOR_RELATIONSHIP',
  CONCEAL_FROM_OBSERVERS: 'CONCEAL_FROM_OBSERVERS',
  REMOVE_FROM_PLAY: 'REMOVE_FROM_PLAY',
  DETECT_CONCEALED: 'DETECT_CONCEALED',
  CANCEL_TRIGGERING_EVENT: 'CANCEL_TRIGGERING_EVENT',
  SOURCE_IMMUNITY: 'SOURCE_IMMUNITY',
  RELEASE_CHOSEN_ITEM: 'RELEASE_CHOSEN_ITEM',
  END_EFFECTS: 'END_EFFECTS',
  DEGRADE_EQUIPMENT: 'DEGRADE_EQUIPMENT',
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
    description: 'This effect deals damage.'
  },
  [EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION]: {
    code: EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION,
    label: 'Hit Point Maximum Reduction',
    description: 'Reduces a target’s hit point maximum by an already resolved damage outcome.'
  },
  [EFFECT_KIND.SCALAR_REDUCTION]: {
    code: EFFECT_KIND.SCALAR_REDUCTION,
    label: 'Scalar Reduction',
    description: 'Reduces one UUID-backed scalar by a bounded amount.'
  },
  [EFFECT_KIND.CONDITION]: {
    code: EFFECT_KIND.CONDITION,
    label: 'Condition',
    description: 'This effect applies a condition.'
  },
  [EFFECT_KIND.HEAL]: {
    code: EFFECT_KIND.HEAL,
    label: 'Heal',
    description: 'This effect restores hit points or grants temporary hit points.'
  },
  [EFFECT_KIND.APPLY_GRANT]: {
    code: EFFECT_KIND.APPLY_GRANT,
    label: 'Apply Grant',
    description: 'This effect applies one or more typed grants for a duration or trigger.'
  },
  [EFFECT_KIND.FORCED_MOVEMENT]: {
    code: EFFECT_KIND.FORCED_MOVEMENT,
    label: 'Forced Movement',
    description:
      'This effect compels movement with typed direction, distance, and action-economy usage.'
  },
  [EFFECT_KIND.TELEPORT]: {
    code: EFFECT_KIND.TELEPORT,
    label: 'Teleport',
    description: 'This effect repositions a creature.'
  },
  [EFFECT_KIND.MANIFEST]: {
    code: EFFECT_KIND.MANIFEST,
    label: 'Manifest',
    description:
      'This effect creates a persistent manifested thing such as a summon, wall, cloud, or sensor.'
  },
  [EFFECT_KIND.FOLLOW_UP_SAVE]: {
    code: EFFECT_KIND.FOLLOW_UP_SAVE,
    label: 'Follow-up Save',
    description:
      'This effect schedules a later saving throw with typed success and failure results.'
  },
  [EFFECT_KIND.FOLLOW_UP_CHECK]: {
    code: EFFECT_KIND.FOLLOW_UP_CHECK,
    label: 'Follow-up Check',
    description: 'Offers a later fixed-DC ability check with typed success and failure results.'
  },
  [EFFECT_KIND.MOVEMENT_RULE]: {
    code: EFFECT_KIND.MOVEMENT_RULE,
    label: 'Movement Rule',
    description: 'Applies a closed movement or anchor restriction.'
  },
  [EFFECT_KIND.ACTION_ECONOMY_RULE]: {
    code: EFFECT_KIND.ACTION_ECONOMY_RULE,
    label: 'Action Economy Rule',
    description: 'Limits attacks for an activation or turn.'
  },
  [EFFECT_KIND.STABILIZE]: {
    code: EFFECT_KIND.STABILIZE,
    label: 'Stabilize',
    description: 'Stabilizes a creature at 0 hit points.'
  },
  [EFFECT_KIND.KILL]: {
    code: EFFECT_KIND.KILL,
    label: 'Kill',
    description: 'The target dies at once.'
  },
  [EFFECT_KIND.HIT_POINTS_TO_ZERO]: {
    code: EFFECT_KIND.HIT_POINTS_TO_ZERO,
    label: 'Drop to 0 Hit Points',
    description: 'The target drops to 0 hit points without taking damage.'
  },
  [EFFECT_KIND.REVIVE]: {
    code: EFFECT_KIND.REVIVE,
    label: 'Revive',
    description: 'A dead creature returns to life with 1 hit point or all of them.'
  },
  [EFFECT_KIND.ARMOR_CLASS_FLOOR]: {
    code: EFFECT_KIND.ARMOR_CLASS_FLOOR,
    label: 'Armor Class Floor',
    description: 'Prevents Armor Class from falling below a fixed minimum.'
  },
  [EFFECT_KIND.RESTORE_RESOURCE]: {
    code: EFFECT_KIND.RESTORE_RESOURCE,
    label: 'Restore Resource',
    description: 'Raises a feature charge to a minimum number of remaining uses when it is empty.'
  },
  [EFFECT_KIND.SPELL_SLOT_EXCHANGE]: {
    code: EFFECT_KIND.SPELL_SLOT_EXCHANGE,
    label: 'Spell Slot Exchange',
    description:
      'Recovers expended spell slots, or converts between spell slots and a feature charge pool.'
  },
  [EFFECT_KIND.TELEPATHIC_LINK]: {
    code: EFFECT_KIND.TELEPATHIC_LINK,
    label: 'Telepathic Link',
    description: 'Links selected creatures for telepathic communication.'
  },
  [EFFECT_KIND.PLANT_PORTAL]: {
    code: EFFECT_KIND.PLANT_PORTAL,
    label: 'Plant Portal',
    description: 'Links two plants as a movement-powered portal.'
  },
  [EFFECT_KIND.TREE_STRIDE]: {
    code: EFFECT_KIND.TREE_STRIDE,
    label: 'Tree Stride',
    description: 'Moves a creature between qualifying trees.'
  },
  [EFFECT_KIND.ACTOR_RELATIONSHIP]: {
    code: EFFECT_KIND.ACTOR_RELATIONSHIP,
    label: 'Grappled',
    description:
      'Grapples the target: how it escapes, the largest target, conditions until the grapple ends and how many it holds at once.'
  },
  [EFFECT_KIND.CONCEAL_FROM_OBSERVERS]: {
    code: EFFECT_KIND.CONCEAL_FROM_OBSERVERS,
    label: 'Conceal From Observers',
    description:
      'Makes the holder’s location unknown to each observer who fails to notice it, until noticed or until it attacks.'
  },
  [EFFECT_KIND.REMOVE_FROM_PLAY]: {
    code: EFFECT_KIND.REMOVE_FROM_PLAY,
    label: 'Remove From Play',
    description:
      'Takes the holder out of play until the effect ends: it cannot be targeted, its token leaves the Scene and, unless it keeps its turn, initiative skips it.'
  },
  [EFFECT_KIND.DETECT_CONCEALED]: {
    code: EFFECT_KIND.DETECT_CONCEALED,
    label: 'Detect Concealed',
    description: 'Ends the checking creature’s ignorance of every concealment its check beats.'
  },
  [EFFECT_KIND.CANCEL_TRIGGERING_EVENT]: {
    code: EFFECT_KIND.CANCEL_TRIGGERING_EVENT,
    label: 'Cancel Triggering Event',
    description:
      'Cancels the event that triggered this reaction, such as a spell being cast, so it has no effect.'
  },
  [EFFECT_KIND.SOURCE_IMMUNITY]: {
    code: EFFECT_KIND.SOURCE_IMMUNITY,
    label: 'Source Immunity',
    description:
      'Makes the target immune to this source’s use of this effect for the result’s duration.'
  },
  [EFFECT_KIND.RELEASE_CHOSEN_ITEM]: {
    code: EFFECT_KIND.RELEASE_CHOSEN_ITEM,
    label: 'Release Chosen Item',
    description:
      'The target lets go of the path’s chosen item when it is releasable (held, not worn).'
  },
  [EFFECT_KIND.END_EFFECTS]: {
    code: EFFECT_KIND.END_EFFECTS,
    label: 'End Effects',
    description:
      'Ends the effects held on the target that grant a named condition: all of them, or the one the caster picks. Conditions only they held end with them.'
  },
  [EFFECT_KIND.DEGRADE_EQUIPMENT]: {
    code: EFFECT_KIND.DEGRADE_EQUIPMENT,
    label: 'Degrade Equipment',
    description:
      'A nonmagical item the target wears or wields takes a permanent, cumulative penalty and may be destroyed.'
  },
  [EFFECT_KIND.CLOSED_RULE]: {
    code: EFFECT_KIND.CLOSED_RULE,
    label: 'Closed Rule',
    description: 'Selects an audited deterministic SRD rule descriptor.'
  },
  [EFFECT_KIND.MANUAL_ADJUDICATION]: {
    code: EFFECT_KIND.MANUAL_ADJUDICATION,
    label: 'Manual Adjudication',
    description: 'This outcome is descriptive and must be resolved by a player or GM.'
  }
} as const

export const EFFECT_KIND_OPTIONS = valuesOf(EFFECT_KIND_REGISTRY) as readonly EffectKindOption[]

export const NON_MANIFEST_EFFECT_KIND_OPTIONS = EFFECT_KIND_OPTIONS.filter(
  (option): option is CoreMeta<NonManifestEffectKind> => option.code !== EFFECT_KIND.MANIFEST
)
