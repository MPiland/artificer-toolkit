import { AUTHORING_CONSTRAINT, type FeatAuthored } from '@artificer-toolkit/shared'
import { FEAT_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

// Domain 0050 — format: 00000000-0000-0000-0050-NNNN00000000
function featId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0050-${hex}00000000`
}

export const grappler: FeatAuthored = {
  id: FEAT_IDS.GRAPPLER,
  label: 'Grappler',
  description:
    "You've developed the skills necessary to hold your own in close-quarters grappling. Prerequisite: Strength 13 or higher.",
  prerequisites: {
    id: featId(0x11f0),
    groups: [
      {
        id: featId(0x11f1),
        order: 0,
        contexts: [
          {
            id: featId(0x11f2),
            order: 0,
            subject: 'CHARACTER',
            conditions: [
              {
                id: featId(0x11f3),
                order: 0,
                kind: 'PREDICATE',
                constraint: AUTHORING_CONSTRAINT.INCLUDE,
                predicateCode: 'ABILITY_SCORE',
                authoringModeKind: 'SELECTED',
                abilities: 'STRENGTH',
                min: 13
              }
            ]
          }
        ]
      }
    ]
  },
  features: [
    {
      id: featId(0x1101),
      label: 'Advantage on Grappled Target',
      description: 'You have advantage on attack rolls against a creature you are grappling.',
      order: 0
    },
    {
      id: featId(0x1102),
      label: 'Pin',
      description:
        'You can use your action to try to pin a creature grappled by you. To do so, make another grapple check. If you succeed, you and the creature are both restrained until the grapple ends.',
      order: 1
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
