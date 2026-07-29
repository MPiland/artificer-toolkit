import type { Vocabulary } from './vocabulary.js'

export enum ChallengeRatingCode {
  CR_0 = 'CR_0',
  CR_1_8 = 'CR_1_8',
  CR_1_4 = 'CR_1_4',
  CR_1_2 = 'CR_1_2',
  CR_1 = 'CR_1',
  CR_2 = 'CR_2',
  CR_3 = 'CR_3',
  CR_4 = 'CR_4',
  CR_5 = 'CR_5',
  CR_6 = 'CR_6',
  CR_7 = 'CR_7',
  CR_8 = 'CR_8',
  CR_9 = 'CR_9',
  CR_10 = 'CR_10',
  CR_11 = 'CR_11',
  CR_12 = 'CR_12',
  CR_13 = 'CR_13',
  CR_14 = 'CR_14',
  CR_15 = 'CR_15',
  CR_16 = 'CR_16',
  CR_17 = 'CR_17',
  CR_18 = 'CR_18',
  CR_19 = 'CR_19',
  CR_20 = 'CR_20',
  CR_21 = 'CR_21',
  CR_22 = 'CR_22',
  CR_23 = 'CR_23',
  CR_24 = 'CR_24',
  CR_25 = 'CR_25',
  CR_26 = 'CR_26',
  CR_27 = 'CR_27',
  CR_28 = 'CR_28',
  CR_29 = 'CR_29',
  CR_30 = 'CR_30'
}

export interface ChallengeRatingOption extends Vocabulary<ChallengeRatingCode> {
  xp: number
  proficiencyBonus: number
}

export const challengeRatings: ChallengeRatingOption[] = [
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d01',
    code: ChallengeRatingCode.CR_0,
    label: '0',
    short: 'CR 0',
    xp: 0,
    proficiencyBonus: 2,
    description: 'Challenge Rating 0 — 0 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d02',
    code: ChallengeRatingCode.CR_1_8,
    label: '1/8',
    short: 'CR 1/8',
    xp: 25,
    proficiencyBonus: 2,
    description: 'Challenge Rating 1/8 — 25 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d03',
    code: ChallengeRatingCode.CR_1_4,
    label: '1/4',
    short: 'CR 1/4',
    xp: 50,
    proficiencyBonus: 2,
    description: 'Challenge Rating 1/4 — 50 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d04',
    code: ChallengeRatingCode.CR_1_2,
    label: '1/2',
    short: 'CR 1/2',
    xp: 100,
    proficiencyBonus: 2,
    description: 'Challenge Rating 1/2 — 100 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d05',
    code: ChallengeRatingCode.CR_1,
    label: '1',
    short: 'CR 1',
    xp: 200,
    proficiencyBonus: 2,
    description: 'Challenge Rating 1 — 200 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d06',
    code: ChallengeRatingCode.CR_2,
    label: '2',
    short: 'CR 2',
    xp: 450,
    proficiencyBonus: 2,
    description: 'Challenge Rating 2 — 450 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d07',
    code: ChallengeRatingCode.CR_3,
    label: '3',
    short: 'CR 3',
    xp: 700,
    proficiencyBonus: 2,
    description: 'Challenge Rating 3 — 700 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d08',
    code: ChallengeRatingCode.CR_4,
    label: '4',
    short: 'CR 4',
    xp: 1100,
    proficiencyBonus: 2,
    description: 'Challenge Rating 4 — 1,100 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d09',
    code: ChallengeRatingCode.CR_5,
    label: '5',
    short: 'CR 5',
    xp: 1800,
    proficiencyBonus: 3,
    description: 'Challenge Rating 5 — 1,800 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d0a',
    code: ChallengeRatingCode.CR_6,
    label: '6',
    short: 'CR 6',
    xp: 2300,
    proficiencyBonus: 3,
    description: 'Challenge Rating 6 — 2,300 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d0b',
    code: ChallengeRatingCode.CR_7,
    label: '7',
    short: 'CR 7',
    xp: 2900,
    proficiencyBonus: 3,
    description: 'Challenge Rating 7 — 2,900 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d0c',
    code: ChallengeRatingCode.CR_8,
    label: '8',
    short: 'CR 8',
    xp: 3900,
    proficiencyBonus: 3,
    description: 'Challenge Rating 8 — 3,900 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d0d',
    code: ChallengeRatingCode.CR_9,
    label: '9',
    short: 'CR 9',
    xp: 5000,
    proficiencyBonus: 4,
    description: 'Challenge Rating 9 — 5,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d0e',
    code: ChallengeRatingCode.CR_10,
    label: '10',
    short: 'CR 10',
    xp: 5900,
    proficiencyBonus: 4,
    description: 'Challenge Rating 10 — 5,900 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d0f',
    code: ChallengeRatingCode.CR_11,
    label: '11',
    short: 'CR 11',
    xp: 7200,
    proficiencyBonus: 4,
    description: 'Challenge Rating 11 — 7,200 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d10',
    code: ChallengeRatingCode.CR_12,
    label: '12',
    short: 'CR 12',
    xp: 8400,
    proficiencyBonus: 4,
    description: 'Challenge Rating 12 — 8,400 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d11',
    code: ChallengeRatingCode.CR_13,
    label: '13',
    short: 'CR 13',
    xp: 10000,
    proficiencyBonus: 5,
    description: 'Challenge Rating 13 — 10,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d12',
    code: ChallengeRatingCode.CR_14,
    label: '14',
    short: 'CR 14',
    xp: 11500,
    proficiencyBonus: 5,
    description: 'Challenge Rating 14 — 11,500 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d13',
    code: ChallengeRatingCode.CR_15,
    label: '15',
    short: 'CR 15',
    xp: 13000,
    proficiencyBonus: 5,
    description: 'Challenge Rating 15 — 13,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d14',
    code: ChallengeRatingCode.CR_16,
    label: '16',
    short: 'CR 16',
    xp: 15000,
    proficiencyBonus: 5,
    description: 'Challenge Rating 16 — 15,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d15',
    code: ChallengeRatingCode.CR_17,
    label: '17',
    short: 'CR 17',
    xp: 18000,
    proficiencyBonus: 6,
    description: 'Challenge Rating 17 — 18,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d16',
    code: ChallengeRatingCode.CR_18,
    label: '18',
    short: 'CR 18',
    xp: 20000,
    proficiencyBonus: 6,
    description: 'Challenge Rating 18 — 20,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d17',
    code: ChallengeRatingCode.CR_19,
    label: '19',
    short: 'CR 19',
    xp: 22000,
    proficiencyBonus: 6,
    description: 'Challenge Rating 19 — 22,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d18',
    code: ChallengeRatingCode.CR_20,
    label: '20',
    short: 'CR 20',
    xp: 25000,
    proficiencyBonus: 6,
    description: 'Challenge Rating 20 — 25,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d19',
    code: ChallengeRatingCode.CR_21,
    label: '21',
    short: 'CR 21',
    xp: 33000,
    proficiencyBonus: 7,
    description: 'Challenge Rating 21 — 33,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d1a',
    code: ChallengeRatingCode.CR_22,
    label: '22',
    short: 'CR 22',
    xp: 41000,
    proficiencyBonus: 7,
    description: 'Challenge Rating 22 — 41,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d1b',
    code: ChallengeRatingCode.CR_23,
    label: '23',
    short: 'CR 23',
    xp: 50000,
    proficiencyBonus: 7,
    description: 'Challenge Rating 23 — 50,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d1c',
    code: ChallengeRatingCode.CR_24,
    label: '24',
    short: 'CR 24',
    xp: 62000,
    proficiencyBonus: 7,
    description: 'Challenge Rating 24 — 62,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d1d',
    code: ChallengeRatingCode.CR_25,
    label: '25',
    short: 'CR 25',
    xp: 75000,
    proficiencyBonus: 8,
    description: 'Challenge Rating 25 — 75,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d1e',
    code: ChallengeRatingCode.CR_26,
    label: '26',
    short: 'CR 26',
    xp: 90000,
    proficiencyBonus: 8,
    description: 'Challenge Rating 26 — 90,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d1f',
    code: ChallengeRatingCode.CR_27,
    label: '27',
    short: 'CR 27',
    xp: 105000,
    proficiencyBonus: 8,
    description: 'Challenge Rating 27 — 105,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d20',
    code: ChallengeRatingCode.CR_28,
    label: '28',
    short: 'CR 28',
    xp: 120000,
    proficiencyBonus: 8,
    description: 'Challenge Rating 28 — 120,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d21',
    code: ChallengeRatingCode.CR_29,
    label: '29',
    short: 'CR 29',
    xp: 135000,
    proficiencyBonus: 9,
    description: 'Challenge Rating 29 — 135,000 XP.'
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22',
    code: ChallengeRatingCode.CR_30,
    label: '30',
    short: 'CR 30',
    xp: 155000,
    proficiencyBonus: 9,
    description: 'Challenge Rating 30 — 155,000 XP.'
  }
]
