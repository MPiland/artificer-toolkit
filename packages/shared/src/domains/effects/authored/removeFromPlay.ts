import { EFFECT_KIND } from '#core'

/**
 * The holder leaves play while the effect lasts (Banishment, Etherealness): untargetable and off the
 * Scene, returning at the same place when the effect ends. `keepsTurn` leaves its turns in
 * initiative for a holder that still acts from where it went.
 */
export type RemoveFromPlayAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.REMOVE_FROM_PLAY
  keepsTurn: boolean
}
