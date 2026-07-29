import type { CoreMeta } from './core.js'
import { valuesOf } from '#utils'

export const ACTIVATION_CODE = {
  ACTION: 'ACTION',
  BONUS_ACTION: 'BONUS_ACTION',
  REACTION: 'REACTION',
  FREE: 'FREE'
} as const

export type ActivationCode = keyof typeof ACTIVATION_CODE

export type ActivationOption = CoreMeta<ActivationCode>

export const ACTIVATION_REGISTRY: Record<ActivationCode, ActivationOption> = {
  [ACTIVATION_CODE.ACTION]: {
    code: ACTIVATION_CODE.ACTION,
    label: 'Action',
    description: "Uses up the creature's action slot for the round.",
    tooltip: "Round's action slot."
  },
  [ACTIVATION_CODE.BONUS_ACTION]: {
    code: ACTIVATION_CODE.BONUS_ACTION,
    label: 'Bonus Action',
    description: "Uses up the creature's bonus action slot for the round.",
    tooltip: "Round's bonus action slot."
  },
  [ACTIVATION_CODE.REACTION]: {
    code: ACTIVATION_CODE.REACTION,
    label: 'Reaction',
    description: "Uses up the creature's reaction slot for the round.",
    tooltip: "Round's reaction slot."
  },
  [ACTIVATION_CODE.FREE]: {
    code: ACTIVATION_CODE.FREE,
    label: 'Free',
    description: 'This type of activation does not require any action slot to use.',
    tooltip: 'No action slot required.'
  }
} as const

export const ACTIVATION_OPTIONS = valuesOf(ACTIVATION_REGISTRY) as ActivationOption[]
