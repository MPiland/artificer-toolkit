import { EFFECT_KIND } from '#core'

/** The checking creature stops being unaware of every concealment its check total beats. */
export type DetectConcealedAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.DETECT_CONCEALED
}
