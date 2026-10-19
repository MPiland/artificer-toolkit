import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { mirrorImage } from '@artificer-toolkit/source-data/srd/spells/mirror-image.js'
import { spellChildId } from '@artificer-toolkit/source-data/srd/spells/shared.js'

/**
 * A self spell that grants three attack decoys (`ATTACK_DECOYS`, a use counter and an Action to
 * dismiss them), so the domain's compile and lifecycle contract is proved before a shipped spell
 * authors it.
 */
export function attackDecoysSpell(): SpellAuthored {
  const spell: SpellAuthored = structuredClone(mirrorImage)
  const path = spell.effects?.[0]?.paths?.[0]
  if (!path || !('resultBlock' in path)) throw new Error('Expected a single result path.')
  Object.assign(path.resultBlock, {
    lifecycle: { uses: 3, holderEnd: { activation: ACTIVATION_CODE.ACTION } },
    outcomes: [
      {
        id: spellChildId(spell.id, 0x2f0, 1),
        effectKind: EFFECT_KIND.APPLY_GRANT,
        grants: {
          modifiers: [
            {
              id: spellChildId(spell.id, 0x2f1, 1),
              grantKind: GRANT_KIND.MODIFIER_GRANT,
              valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_DECOYS,
              domain: {},
              modifierKind: MODIFIER_KIND.ENABLE,
              payload: {
                armorClass: { amount: 10, abilities: [ABILITY_CODE.DEXTERITY] },
                thresholds: [
                  { remaining: 3, minimumRoll: 6 },
                  { remaining: 2, minimumRoll: 8 },
                  { remaining: 1, minimumRoll: 11 }
                ].map((threshold, index) => ({
                  id: spellChildId(spell.id, 0x2f2, index + 1),
                  ...threshold
                }))
              },
              scope: MODIFIER_SCOPE_KIND.GLOBAL,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              order: 1
            }
          ]
        }
      }
    ]
  })
  return spell
}
