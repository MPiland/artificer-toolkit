import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  STARTING_EQUIPMENT_KIND,
  SUBJECT,
  type BackgroundAuthored
} from '@artificer-toolkit/shared'
import { BACKGROUND_IDS } from '../ids.js'
import { SRD_LANGUAGES, SRD_SKILLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

// Equipment IDs (equipId formula: 00000000-0000-0000-0060-{hex}00000000)
const HOLY_SYMBOL_AMULET_ID = '00000000-0000-0000-0060-006000000000'
const PRAYER_BOOK_ID = '00000000-0000-0000-0060-00a500000000'
const PRAYER_WHEEL_ID = '00000000-0000-0000-0060-016b00000000'
const INCENSE_ID = '00000000-0000-0000-0060-016900000000'
const VESTMENTS_ID = '00000000-0000-0000-0060-016a00000000'
const COMMON_CLOTHES_ID = '00000000-0000-0000-0060-008300000000'
const POUCH_ID = '00000000-0000-0000-0060-009700000000'
const CURRENCY_GP = '00000000-0000-0000-0003-000400000000'

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD skill vocabulary entry for ${code} required for background source data.`)
  return entry.id
}

function availableLanguageIds(): string[] {
  return SRD_LANGUAGES.map((language) => language.id)
}

function bgId(bgIndex: number, group: number, entry: number): string {
  const bb = bgIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-8040-${bb}${gg}${nn}000000`
}

export const acolyte: BackgroundAuthored = {
  kind: SUBJECT.BACKGROUND,
  id: BACKGROUND_IDS.ACOLYTE,
  label: 'Acolyte',
  description: [
    '<p>You have spent your life in the service of a temple to a specific god or pantheon of gods. You act as an intermediary between the realm of the holy and the mortal world, performing sacred rites and offering sacrifices to conduct worshipers into the presence of the divine. You are not necessarily a cleric; performing sacred rites is not the same thing as channeling divine power.</p>',
    '<p>Choose a god, a pantheon of gods, or some other quasi-divine being, then work with your GM to detail the nature of your religious service. You might have been a lesser temple functionary, a priest called to serve differently, the leader of a small cult outside an established temple, or an occult servant who now denies a fiendish master.</p>'
  ].join(''),
  proficiencies: [
    {
      id: bgId(1, 1, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [skillId('INSIGHT'), skillId('RELIGION')],
      order: 0
    },
    {
      id: bgId(1, 1, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      languageIds: availableLanguageIds(),
      order: 1
    }
  ],
  features: [
    {
      id: bgId(1, 2, 1),
      label: 'Shelter of the Faithful',
      description:
        '<p>As an acolyte, you command the respect of those who share your faith and can perform the religious ceremonies of your deity.</p>',
      details: [
        {
          id: bgId(1, 2, 2),
          label: 'Detail',
          description: [
            '<p>You and your adventuring companions can expect free healing and care at a temple, shrine, or other established presence of your faith, though you must provide any material components needed for spells. Those who share your religion will support you, but only you, at a modest lifestyle.</p>',
            '<p>You might also have ties to a specific temple dedicated to your chosen deity or pantheon, and you have a residence there. While near your temple, you can call upon the priests for assistance, provided the request is not hazardous and you remain in good standing.</p>'
          ].join(''),
          order: 1
        }
      ],
      order: 0
    }
  ],
  startingEquipment: {
    id: bgId(1, 3, 0),
    sets: [
      {
        id: bgId(1, 3, 1),
        order: 0,
        groups: [
          {
            id: bgId(1, 3, 2),
            order: 0,
            options: [
              {
                id: bgId(1, 3, 3),
                order: 0,
                items: [
                  {
                    id: bgId(1, 3, 4),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [HOLY_SYMBOL_AMULET_ID],
                    quantity: 1
                  },
                  {
                    id: bgId(1, 3, 5),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [PRAYER_BOOK_ID, PRAYER_WHEEL_ID],
                    count: 1
                  },
                  {
                    id: bgId(1, 3, 6),
                    order: 2,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [INCENSE_ID],
                    quantity: 5
                  },
                  {
                    id: bgId(1, 3, 7),
                    order: 3,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [VESTMENTS_ID],
                    quantity: 1
                  },
                  {
                    id: bgId(1, 3, 8),
                    order: 4,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [COMMON_CLOTHES_ID],
                    quantity: 1
                  },
                  {
                    id: bgId(1, 3, 9),
                    order: 5,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [POUCH_ID],
                    quantity: 1
                  },
                  {
                    id: bgId(1, 3, 10),
                    order: 6,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.CURRENCY,
                    currencies: [{ currencyId: CURRENCY_GP, amount: 15 }]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  details: [
    {
      id: bgId(1, 4, 1),
      label: 'Personality Trait 1',
      description:
        "I idolize a particular hero of my faith, and constantly refer to that person's deeds and example.",
      order: 0
    },
    {
      id: bgId(1, 4, 2),
      label: 'Personality Trait 2',
      description:
        'I can find common ground between the fiercest enemies, empathizing with them and always working toward peace.',
      order: 1
    },
    {
      id: bgId(1, 4, 3),
      label: 'Personality Trait 3',
      description:
        'I see omens in every event and action. The gods try to speak to us; we just need to listen.',
      order: 2
    },
    {
      id: bgId(1, 4, 4),
      label: 'Personality Trait 4',
      description: 'Nothing can shake my optimistic attitude.',
      order: 3
    },
    {
      id: bgId(1, 4, 5),
      label: 'Personality Trait 5',
      description: 'I quote (or misquote) sacred texts and proverbs in almost every situation.',
      order: 4
    },
    {
      id: bgId(1, 4, 6),
      label: 'Personality Trait 6',
      description:
        'I am tolerant (or intolerant) of other faiths and respect (or condemn) the worship of other gods.',
      order: 5
    },
    {
      id: bgId(1, 4, 7),
      label: 'Personality Trait 7',
      description:
        "I've enjoyed fine food, drink, and high society among my temple's elite. Rough living grates on me.",
      order: 6
    },
    {
      id: bgId(1, 4, 8),
      label: 'Personality Trait 8',
      description:
        "I've spent so long in the temple that I have little practical experience dealing with people in the outside world.",
      order: 7
    },
    {
      id: bgId(1, 4, 9),
      label: 'Ideal: Tradition',
      description:
        'The ancient traditions of worship and sacrifice must be preserved and upheld. (Lawful)',
      order: 8
    },
    {
      id: bgId(1, 4, 10),
      label: 'Ideal: Charity',
      description: 'I always try to help those in need, no matter what the personal cost. (Good)',
      order: 9
    },
    {
      id: bgId(1, 4, 11),
      label: 'Ideal: Change',
      description:
        'We must help bring about the changes the gods are constantly working in the world. (Chaotic)',
      order: 10
    },
    {
      id: bgId(1, 4, 12),
      label: 'Ideal: Power',
      description: "I hope to one day rise to the top of my faith's religious hierarchy. (Lawful)",
      order: 11
    },
    {
      id: bgId(1, 4, 13),
      label: 'Ideal: Faith',
      description:
        'I trust that my deity will guide my actions. I have faith that if I work hard, things will go well. (Lawful)',
      order: 12
    },
    {
      id: bgId(1, 4, 14),
      label: 'Ideal: Aspiration',
      description:
        "I seek to prove myself worthy of my god's favor by matching my actions against his or her teachings. (Any)",
      order: 13
    },
    {
      id: bgId(1, 4, 15),
      label: 'Bond 1',
      description: 'I would die to recover an ancient relic of my faith that was lost long ago.',
      order: 14
    },
    {
      id: bgId(1, 4, 16),
      label: 'Bond 2',
      description:
        'I will someday get revenge on the corrupt temple hierarchy who branded me a heretic.',
      order: 15
    },
    {
      id: bgId(1, 4, 17),
      label: 'Bond 3',
      description: 'I owe my life to the priest who took me in when my parents died.',
      order: 16
    },
    {
      id: bgId(1, 4, 18),
      label: 'Bond 4',
      description: 'Everything I do is for the common people.',
      order: 17
    },
    {
      id: bgId(1, 4, 19),
      label: 'Bond 5',
      description: 'I will do anything to protect the temple where I served.',
      order: 18
    },
    {
      id: bgId(1, 4, 20),
      label: 'Bond 6',
      description:
        'I seek to preserve a sacred text that my enemies consider heretical and seek to destroy.',
      order: 19
    },
    {
      id: bgId(1, 4, 21),
      label: 'Flaw 1',
      description: 'I judge others harshly, and myself even more severely.',
      order: 20
    },
    {
      id: bgId(1, 4, 22),
      label: 'Flaw 2',
      description: "I put too much trust in those who wield power within my temple's hierarchy.",
      order: 21
    },
    {
      id: bgId(1, 4, 23),
      label: 'Flaw 3',
      description:
        'My piety sometimes leads me to blindly trust those who profess faith in my god.',
      order: 22
    },
    {
      id: bgId(1, 4, 24),
      label: 'Flaw 4',
      description: 'I am inflexible in my thinking.',
      order: 23
    },
    {
      id: bgId(1, 4, 25),
      label: 'Flaw 5',
      description: 'I am suspicious of strangers and expect the worst of them.',
      order: 24
    },
    {
      id: bgId(1, 4, 26),
      label: 'Flaw 6',
      description:
        'Once I pick a goal, I become obsessed with it to the detriment of everything else in my life.',
      order: 25
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
