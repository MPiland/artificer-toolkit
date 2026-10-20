import { EFFECT_KIND } from '#core'

/** The target dies at once: 0 hit points, no temporary hit points, and a Character's death saves read dead. */
export type KillAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.KILL
}
