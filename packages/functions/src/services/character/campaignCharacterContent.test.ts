import { describe, expect, it } from 'vitest'
import type { CampaignCharacterContentOverlay } from './campaignCharacterContent.js'
import {
  buildCampaignAssemblyStructure,
  findCampaignCharacterSource
} from './campaignCharacterContent.js'

const id = '00000000-0000-4000-8000-000000000001'
const systemId = '00000000-0000-4000-8000-000000000002'
const userId = '00000000-0000-4000-8000-000000000003'

describe('Campaign Character content', () => {
  it('resolves the current shared source without a Character lifecycle pin', () => {
    const current = {
      subjectKind: 'FEAT',
      subjectId: id,
      authoredVersionId: '00000000-0000-4000-8000-000000000012',
      authoredVersion: 2,
      authoredChecksum: 'c'.repeat(64),
      compiledProjectionChecksum: 'd'.repeat(64),
      authoredDependencies: [],
      authored: { id, label: 'Current', description: '', userId, systemId }
    } as const
    const overlay: CampaignCharacterContentOverlay = {
      campaignId: id,
      userId,
      latest: new Map([[`FEAT:${id}`, current]]),
      sharesByRoot: new Map()
    }

    expect(findCampaignCharacterSource(overlay, 'FEAT', id)?.authoredVersion).toBe(2)
  })

  it('derives root, ancestry, option, and choice links from hydrated sources', () => {
    const structure = buildCampaignAssemblyStructure({
      backgrounds: [],
      classes: [],
      equipment: [],
      feats: [],
      spells: [],
      races: [
        {
          id,
          label: 'Campaign Race',
          category: 'BASE',
          selectionMode: 'DIRECT',
          size: 'MEDIUM',
          speeds: [],
          userId,
          systemId,
          features: [
            {
              id: '00000000-0000-4000-8000-000000000006',
              label: 'Trait',
              description: '',
              order: 0,
              options: [
                {
                  id: '00000000-0000-4000-8000-000000000007',
                  label: 'Choice',
                  description: '',
                  order: 0
                }
              ],
              optionChoices: [{ level: 1, count: 1 }]
            }
          ],
          ancestry: {
            id: '00000000-0000-4000-8000-000000000008',
            label: 'Lineage',
            options: [
              {
                id: '00000000-0000-4000-8000-000000000009',
                label: 'Lineage',
                description: '',
                order: 0,
                features: [
                  {
                    id: '00000000-0000-4000-8000-000000000010',
                    label: 'Lineage Trait',
                    description: '',
                    order: 0
                  }
                ]
              }
            ]
          }
        }
      ]
    })

    expect(structure.rootFeatureLinks).toHaveLength(1)
    expect(structure.ancestryOptions[0]?.featureLinks).toHaveLength(1)
    expect(structure.featureOptions).toHaveLength(1)
    expect(structure.featureOptionChoices).toHaveLength(1)
  })
})
