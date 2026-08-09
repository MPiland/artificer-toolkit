import { describe, expect, it } from 'vitest'
import type { CampaignCharacterContentOverlay } from './campaignCharacterContent.js'
import {
  buildCampaignAssemblyStructure,
  findCampaignCharacterSnapshot,
  parseCampaignAuthoredSnapshot
} from './campaignCharacterContent.js'

const id = '00000000-0000-4000-8000-000000000001'
const systemId = '00000000-0000-4000-8000-000000000002'
const userId = '00000000-0000-4000-8000-000000000003'

describe('Campaign Character content', () => {
  it('keeps an existing binding pinned instead of selecting the latest approval', () => {
    const pinned = parseCampaignAuthoredSnapshot({
      id: '00000000-0000-4000-8000-000000000004',
      subjectKind: 'FEAT',
      subjectId: id,
      revision: 1,
      snapshot: { id, label: 'Pinned', description: '', userId, systemId }
    })
    const latest = parseCampaignAuthoredSnapshot({
      id: '00000000-0000-4000-8000-000000000005',
      subjectKind: 'FEAT',
      subjectId: id,
      revision: 2,
      snapshot: { id, label: 'Latest', description: '', userId, systemId }
    })
    const overlay: CampaignCharacterContentOverlay = {
      campaignId: id,
      bindings: new Map([[`FEAT:${id}`, pinned]]),
      latest: new Map([[`FEAT:${id}`, latest]])
    }

    expect(findCampaignCharacterSnapshot(overlay, 'FEAT', id)?.revision).toBe(1)
  })

  it('derives root, ancestry, option, and choice links from hydrated snapshots', () => {
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
