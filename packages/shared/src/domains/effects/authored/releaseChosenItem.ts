import { EFFECT_KIND } from '#core'

/**
 * The target drops the path's chosen item when it can: a held item is released, a worn one (armor)
 * stays, so a grant marked `unlessChosenItemReleased` applies instead (Heat Metal).
 */
export type ReleaseChosenItemAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.RELEASE_CHOSEN_ITEM
}
