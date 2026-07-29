import type { Vocabulary } from './vocabulary.js'

export enum RarityCode {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  VERY_RARE = 'VERY_RARE',
  LEGENDARY = 'LEGENDARY',
  ARTIFACT = 'ARTIFACT'
}

export type RarityOption = Vocabulary<RarityCode>

export const rarities: RarityOption[] = [
  {
    id: '400db198-2d77-4b99-9fc4-f60b605a6b96',
    code: RarityCode.COMMON,
    label: 'Common',
    description: 'Common items are widely available and relatively easy to obtain.',
    tooltip: 'Widely available.'
  },
  {
    id: 'ae80f98c-9d79-44b4-a1d5-712a3c73458c',
    code: RarityCode.UNCOMMON,
    label: 'Uncommon',
    description:
      'Uncommon items are less frequently encountered and often have minor magical properties.',
    tooltip: 'Less common.'
  },
  {
    id: 'ce82cec3-2d87-412d-93e4-f82bfee111e6',
    code: RarityCode.RARE,
    label: 'Rare',
    description: 'Rare items are powerful and difficult to find.',
    tooltip: 'Hard to find.'
  },
  {
    id: 'c79678e1-3dde-4436-82bf-dcf30df0d4ea',
    code: RarityCode.VERY_RARE,
    label: 'Very Rare',
    description: 'Very rare items are exceptionally powerful and seldom encountered.',
    tooltip: 'Exceptionally rare.'
  },
  {
    id: '28e48561-eb93-4bca-ba15-f771a0aa237a',
    code: RarityCode.LEGENDARY,
    label: 'Legendary',
    description: 'Legendary items are unique or nearly unique artifacts of immense power.',
    tooltip: 'Legendary power.'
  },
  {
    id: 'f9e7c097-7a0e-4433-94d9-adcafebed2f5',
    code: RarityCode.ARTIFACT,
    label: 'Artifact',
    description: 'Artifacts are singular, storied items of extraordinary significance and power.',
    tooltip: 'Unique artifact.'
  }
]
