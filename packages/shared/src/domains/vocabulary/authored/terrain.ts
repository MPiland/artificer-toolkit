import type { Vocabulary } from './vocabulary.js'

export enum TerrainCode {
  ARCTIC = 'ARCTIC',
  COAST = 'COAST',
  DESERT = 'DESERT',
  FOREST = 'FOREST',
  GRASSLAND = 'GRASSLAND',
  MOUNTAIN = 'MOUNTAIN',
  SWAMP = 'SWAMP'
}

export type TerrainOption = Vocabulary<TerrainCode>

export const terrains: TerrainOption[] = [
  {
    id: '6b781ca1-2080-404d-964c-769f44641b63',
    code: TerrainCode.ARCTIC,
    label: 'Arctic',
    description:
      'Arctic terrain consists of frozen lands characterized by snow, ice, and extreme cold.',
    tooltip: 'Frozen, icy regions.'
  },
  {
    id: '399d5aab-5668-402e-847d-f8cbdc5713d1',
    code: TerrainCode.COAST,
    label: 'Coast',
    description:
      'Coastal terrain lies where land meets the sea, including beaches, cliffs, and shores.',
    tooltip: 'Land near the sea.'
  },
  {
    id: 'f15f1f3a-03e0-4c54-af93-e5470f455b0b',
    code: TerrainCode.DESERT,
    label: 'Desert',
    description:
      'Desert terrain consists of arid lands with little rainfall and extreme temperatures.',
    tooltip: 'Dry, arid regions.'
  },
  {
    id: '9431c2c9-3168-410b-bf9e-45b6c11cac68',
    code: TerrainCode.FOREST,
    label: 'Forest',
    description: 'Forest terrain is dominated by dense vegetation and trees.',
    tooltip: 'Wooded regions.'
  },
  {
    id: 'db61c315-9607-4393-8eb2-0dcd6b0e646c',
    code: TerrainCode.GRASSLAND,
    label: 'Grassland',
    description: 'Grassland terrain consists of open plains covered primarily by grasses.',
    tooltip: 'Open plains.'
  },
  {
    id: '331da97a-36ca-401a-9e98-99d1c119aadb',
    code: TerrainCode.MOUNTAIN,
    label: 'Mountain',
    description:
      'Mountain terrain is defined by high elevation, steep slopes, and rocky environments.',
    tooltip: 'High, rocky regions.'
  },
  {
    id: 'c1d6b69a-873f-4715-8507-40bfbab439df',
    code: TerrainCode.SWAMP,
    label: 'Swamp',
    description: 'Swamp terrain consists of wetlands with standing water and dense vegetation.',
    tooltip: 'Wetlands and marshes.'
  }
]
