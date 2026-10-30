import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  SCALING,
  SPELL_GRANT_ATTRIBUTE,
  VALUE_DOMAIN_CODE,
  type EffectAuthored,
  type FeatureAuthored
} from '@artificer-toolkit/shared'
import { SPELL_IDS } from '../ids.js'
import { srdSpells } from '../spells/index.js'
import { spellChildId } from '../spells/shared.js'

const allCantripIds = srdSpells.filter((spell) => spell.level === 0).map((spell) => spell.id)

/** The Warlock's 3rd-level Pact Boon and its three pacts; `rowId` is the Warlock's row id by group and entry. */
export function pactBoonFeature(
  rowId: (group: number, entry: number) => string,
  pactOfTheBlade: EffectAuthored
): FeatureAuthored {
  return {
    id: rowId(3, 21),
    label: 'Pact Boon',
    description:
      'At 3rd level, your otherworldly patron bestows a gift upon you for your loyal service. You gain one of the following features of your choice.',
    availableAtLevel: 3,
    order: 3,
    optionChoices: [{ level: 3, count: 1 }],
    options: [
      {
        id: rowId(3, 22),
        label: 'Pact of the Chain',
        description:
          "You learn the find familiar spell and can cast it as a ritual. The spell doesn't count against your number of spells known.\n\nWhen you cast the spell, you can choose one of the normal forms for your familiar or one of the following special forms: imp, pseudodragon, quasit, or sprite.\n\nAdditionally, when you take the Attack action, you can forgo one of your own attacks to allow your familiar to make one attack of its own with its reaction.",
        grants: {
          spells: [
            {
              id: rowId(3, 23),
              grantKind: GRANT_KIND.SPELL_GRANT,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              scalingKind: SCALING.NONE,
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              spellIds: [SPELL_IDS.FIND_FAMILIAR],
              attributes: [SPELL_GRANT_ATTRIBUTE.KNOWN, SPELL_GRANT_ATTRIBUTE.RITUAL],
              order: 0
            }
          ],
          modifiers: [
            {
              id: rowId(0x54, 1),
              grantKind: GRANT_KIND.MODIFIER_GRANT,
              valueDomainCode: VALUE_DOMAIN_CODE.DELEGATED_ATTACK,
              domain: {},
              modifierKind: MODIFIER_KIND.ENABLE,
              scope: MODIFIER_SCOPE_KIND.GLOBAL,
              selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
              // The familiar the granted spell summons attacks with its reaction.
              payload: { effectIds: [spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x210, 1)] },
              order: 0
            }
          ]
        },
        order: 0
      },
      {
        id: rowId(3, 24),
        label: 'Pact of the Blade',
        description:
          "You can use your action to create a pact weapon in your empty hand. You can choose the form that this melee weapon takes each time you create it. You are proficient with it while you wield it. This weapon counts as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.\n\nYour pact weapon disappears if it is more than 5 feet away from you for 1 minute or more. It also disappears if you use this feature again, if you dismiss the weapon (no action required), or if you die.\n\nYou can transform one magic weapon into your pact weapon by performing a special ritual while you hold the weapon. You perform the ritual over the course of 1 hour, which can be done during a short rest. You can then dismiss the weapon, shunting it into an extradimensional space, and it appears whenever you create your pact weapon thereafter. You can't affect an artifact or a sentient weapon in this way. The weapon ceases being your pact weapon if you die, if you perform the 1-hour ritual on a different weapon, or if you use a 1-hour ritual to break your bond to it. The weapon appears at your feet if it is in the extradimensional space when the bond breaks.",
        // The weapon is one the warlock holds: creating it in any form, its disappearance 5 feet away
        // and the bonding ritual stay description (D156). It lasts until used again or let go.
        effects: [pactOfTheBlade],
        order: 1
      },
      {
        id: rowId(3, 25),
        label: 'Pact of the Tome',
        description:
          "Your patron gives you a grimoire called a Book of Shadows. When you gain this feature, choose three cantrips from any class's spell list (the three needn't be from the same list). While the book is on your person, you can cast those cantrips at will. They don't count against your number of cantrips known. If they don't appear on the warlock spell list, they are nonetheless warlock spells for you.\n\nIf you lose your Book of Shadows, you can perform a 1-hour ceremony to receive a replacement from your patron. This ceremony can be performed during a short or long rest, and it destroys the previous book. The book turns to ash when you die.",
        grants: {
          spells: [
            {
              id: rowId(3, 55),
              grantKind: GRANT_KIND.SPELL_GRANT,
              selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
              count: 3,
              selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
              scalingKind: SCALING.NONE,
              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
              spellIds: allCantripIds,
              attributes: [SPELL_GRANT_ATTRIBUTE.KNOWN, SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
              order: 0
            }
          ]
        },
        order: 2
      }
    ]
  }
}
