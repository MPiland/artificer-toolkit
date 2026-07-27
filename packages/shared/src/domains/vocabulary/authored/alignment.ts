import type { Vocabulary } from './vocabulary.js'

export enum AlignmentCode {
  NEUTRAL = 'NEUTRAL',
  LAWFUL_NEUTRAL = 'LAWFUL_NEUTRAL',
  CHAOTIC_NEUTRAL = 'CHAOTIC_NEUTRAL',
  LAWFUL_GOOD = 'LAWFUL_GOOD',
  CHAOTIC_GOOD = 'CHAOTIC_GOOD',
  CHAOTIC_EVIL = 'CHAOTIC_EVIL',
  LAWFUL_EVIL = 'LAWFUL_EVIL',
  NEUTRAL_GOOD = 'NEUTRAL_GOOD',
  NEUTRAL_EVIL = 'NEUTRAL_EVIL'
}

export type AlignmentOption = Vocabulary<AlignmentCode>

export const alignments: AlignmentOption[] = [
  {
    id: '3ccbc183-c125-43fc-94b4-9aeb1af88f94',
    label: 'Neutral',
    description:
      "Neutral (N) is the alignment of those who prefer to steer clear of moral questions and don't take sides, doing what seems best at the time. Lizardfolk, most druids, and many humans are neutral.",
    tooltip: "Prefer to steer clear of moral questions and don't take sides.",
    code: AlignmentCode.NEUTRAL
  },
  {
    id: '5a04ea40-f91a-4f09-bebe-d123cc79e595',
    label: 'Lawful Neutral',
    description:
      'Lawful neutral (LN) individuals act in accordance with law, tradition, or personal codes. Many monks and some wizards are lawful neutral.',
    tooltip: 'Act in accordance with law, tradition, or personal codes.',
    code: AlignmentCode.LAWFUL_NEUTRAL
  },
  {
    id: 'f95b0f41-d0af-4579-bc30-5a325d748491',
    label: 'Chaotic Neutral',
    description:
      'Chaotic neutral (CN) creatures follow their whims, holding their personal freedom above all else. Many barbarians and rogues, and some bards, are chaotic neutral.',
    tooltip: 'Follow their whims, holding their personal freedom above all else.',
    code: AlignmentCode.CHAOTIC_NEUTRAL
  },
  {
    id: '32a3f29f-8db8-447a-b9d1-d07349e69e07',
    label: 'Lawful Good',
    description:
      'Lawful good (LG) creatures can be counted on to do the right thing as expected by society. Gold dragons, paladins, and most dwarves are lawful good.',
    tooltip: 'Can be counted on to do the right thing as expected by society.',
    code: AlignmentCode.LAWFUL_GOOD
  },
  {
    id: 'e8d3d5ad-1bd7-4bbc-a282-1d3ac3e1b289',
    label: 'Chaotic Good',
    description:
      'Chaotic good (CG) creatures act as their conscience directs, with little regard for what others expect. Copper dragons, many elves, and unicorns are chaotic good.',
    tooltip: 'Act as their conscience directs, with little regard for what others expect.',
    code: AlignmentCode.CHAOTIC_GOOD
  },
  {
    id: 'c4d8c7fd-6562-46f1-a15a-14b13a660523',
    label: 'Chaotic Evil',
    description:
      'Chaotic evil (CE) creatures act with arbitrary violence, spurred by their greed, hatred, or bloodlust. Demons, red dragons, and orcs are chaotic evil.',
    tooltip: 'Act with arbitrary violence, spurred by their greed, hatred, or bloodlust.',
    code: AlignmentCode.CHAOTIC_EVIL
  },
  {
    id: 'f5b23c3d-9273-4af8-afb1-c07c32b03c68',
    label: 'Lawful Evil',
    description:
      'Lawful evil (LE) creatures methodically take what they want, within the limits of a code of tradition, loyalty, or order. Devils, blue dragons, and hobgoblins are lawful evil.',
    tooltip:
      'Methodically take what they want, within the limits of a code of tradition, loyalty, or order.',
    code: AlignmentCode.LAWFUL_EVIL
  },
  {
    id: '85f617e8-6923-4c6d-9d06-3384e8885010',
    label: 'Neutral Good',
    description:
      'Neutral good (NG) folk do the best they can to help others according to their needs. Many celestials, some cloud giants, and most gnomes are neutral good.',
    tooltip: 'Do the best they can to help others according to their needs.',
    code: AlignmentCode.NEUTRAL_GOOD
  },
  {
    id: '0381d5c9-2399-4a46-9ebb-57fd9212cf36',
    label: 'Neutral Evil',
    description:
      'Neutral evil (NE) is the alignment of those who do whatever they can get away with, without compassion or qualms. Many drow, some cloud giants, and goblins are neutral evil.',
    tooltip: 'Do whatever they can get away with, without compassion or qualms.',
    code: AlignmentCode.NEUTRAL_EVIL
  }
]
