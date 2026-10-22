import type { Meta, StoryObj } from '@storybook/react-vite'
import { useQueryClient } from '@tanstack/react-query'
import { ConvexReactClient, useConvex, useQuery } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { fn, mocked } from 'storybook/test'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  contentSnapshotCatalogueManifestDtoSchema,
  contentSnapshotListObjectSchema
} from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  lootDocumentSchema,
  lootLookupInputSchema,
  saveLootInputSchema,
  type LootDocument
} from '@artificer-toolkit/schema/api/lootTables'
import { EQUIPMENT_CATEGORY_CODE } from '@artificer-toolkit/shared/core'
import { getContentCatalogueManifest } from '#app/data/contentSnapshots/queries'
import { contentCatalogueQueryKey } from '#app/data/contentSnapshots/useContentCatalogue'
import { authoredRouteStoryUser } from '#domains/authoredRouteStory.fixtures'
import { CampaignSceneLootEditor } from './CampaignSceneLootEditor'
import { tabletopCampaignId, tabletopSceneDefinition } from './CampaignTabletop.stories.fixtures'

const gameSystemId = '11111111-1111-4111-8111-111111111111'
const contentSourceId = '99999999-9999-4999-8999-999999999911'
const equipmentListSha = 'e'.repeat(64)
const objectRef = (sha256: string) => ({ sha256, byteLength: 100, rootCount: 1 })

const catalogueManifest = contentSnapshotCatalogueManifestDtoSchema.parse({
  userId: authoredRouteStoryUser.id,
  sources: [
    {
      contentSourceId,
      systemId: gameSystemId,
      kind: 'PLATFORM',
      head: {
        scope: 'SOURCE',
        scopeId: contentSourceId,
        revision: 1,
        builtRevision: 1,
        kinds: {
          EQUIPMENT: {
            index: objectRef('c'.repeat(64)),
            list: objectRef(equipmentListSha),
            documents: objectRef('d'.repeat(64))
          }
        }
      }
    }
  ]
})

const equipmentListObject = contentSnapshotListObjectSchema.parse({
  format: 3,
  scope: 'SOURCE',
  scopeId: contentSourceId,
  kind: 'EQUIPMENT',
  part: 'list',
  roots: [
    {
      id: '99999999-9999-4999-8999-999999999912',
      label: 'Silvered Dagger',
      publicId: 'silvered-dagger',
      category: EQUIPMENT_CATEGORY_CODE.WEAPON
    }
  ]
})

const system = {
  currencies: [{ id: '99999999-9999-4999-8999-999999999913', label: 'Gold Piece' }],
  skills: [{ id: '99999999-9999-4999-8999-999999999914', label: 'Investigation' }]
}

const owner = {
  kind: 'SCENE',
  campaignId: tabletopCampaignId,
  sceneDefinitionId: tabletopSceneDefinition.id
} as const

/** The fake backend lives in sessionStorage so a browser reload reopens what was saved. */
const storageKey = `story-loot:${owner.sceneDefinitionId}`
function readStored(): LootDocument {
  const raw = window.sessionStorage.getItem(storageKey)
  return lootDocumentSchema.parse(raw ? JSON.parse(raw) : { owner, version: 0, tables: [] })
}

const meta = {
  component: CampaignSceneLootEditor,
  parameters: { a11y: { test: 'error' }, layout: 'fullscreen' },
  title: 'Domains/Campaigns/VTT/Scene Loot Editor',
  args: { campaignId: tabletopCampaignId, gameSystemId, sceneId: tabletopSceneDefinition.id },
  beforeEach: () => {
    const client = new ConvexReactClient('https://story-fixture.convex.cloud', { logger: false })
    Object.defineProperty(client, 'query', {
      value: fn<ConvexReactClient['query']>().mockImplementation(async (...[reference, input]) => {
        if (getFunctionName(reference) !== getFunctionName(api.loot.tables.get))
          throw new Error(`Unexpected loot query: ${getFunctionName(reference)}`)
        lootLookupInputSchema.parse(input)
        return readStored()
      })
    })
    Object.defineProperty(client, 'mutation', {
      value: fn<ConvexReactClient['mutation']>().mockImplementation(
        async (...[reference, input]) => {
          if (getFunctionName(reference) !== getFunctionName(api.loot.tables.save))
            throw new Error(`Unexpected loot mutation: ${getFunctionName(reference)}`)
          const values = saveLootInputSchema.parse(input)
          const current = readStored()
          if (current.version !== values.expectedVersion)
            throw new Error('Loot tables changed before this save.')
          const saved = lootDocumentSchema.parse({
            owner: values.owner,
            version: values.expectedVersion + 1,
            tables: values.tables
          })
          window.sessionStorage.setItem(storageKey, JSON.stringify(saved))
          return saved
        }
      )
    })
    mocked(useConvex).mockReturnValue(client)
    mocked(useQuery).mockReturnValue(system)
    return () => client.close()
  },
  decorators: [
    (Story) => {
      const queryClient = useQueryClient()
      const manifestQuery = getContentCatalogueManifest()
      queryClient.setQueryDefaults(manifestQuery.queryKey, {
        queryFn: async () => catalogueManifest
      })
      queryClient.setQueryData(manifestQuery.queryKey, catalogueManifest)
      queryClient.setQueryData(
        contentCatalogueQueryKey(authoredRouteStoryUser.id, 'EQUIPMENT', [equipmentListSha]),
        [equipmentListObject]
      )
      return <Story />
    }
  ]
} satisfies Meta<typeof CampaignSceneLootEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}
