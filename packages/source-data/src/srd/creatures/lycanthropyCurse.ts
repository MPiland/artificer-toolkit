import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'

/**
 * A lycanthrope's bite curse ships as a GM ruling beside the attack's automated damage (D187a,
 * SPELLS-33.T6b2): the curse changes the victim's whole statistics and allegiance over time, which
 * no authored option resolves.
 */
export function lycanthropyCurseOutcome(id: string, lycanthropy: string, saveDc: number) {
  return {
    id,
    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
    label: 'Curse of Lycanthropy',
    reasonCode: MANUAL_ADJUDICATION_REASON.NARRATIVE_JUDGMENT,
    instructions: `If the target is a humanoid, it must succeed on a DC ${saveDc} Constitution saving throw or be cursed with ${lycanthropy} lycanthropy. A cursed humanoid keeps its statistics and gains the lycanthrope's speeds in nonhumanoid form, damage immunities, traits and actions that don't involve equipment, with proficiency in its natural attacks. The curse lasts until removed by the remove curse spell or other magic.`
  }
}
