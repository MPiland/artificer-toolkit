import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { getFunctionName } from 'convex/server'
import { useMutation as useConvexMutation } from 'convex/react'
import { expect, mocked, userEvent, waitFor, within } from 'storybook/test'
import {
  createReusableDefinitionInputDtoSchema,
  saveReusableDefinitionDraftInputDtoSchema,
  publishReusableDefinitionDraftInputDtoSchema
} from '@artificer-toolkit/schema/api/reusableDefinitions'
import { gameSystemRuleCapabilityDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  getSystem,
  getSystemRuleCapability,
  getSystemSummary,
  getSystemDefinition,
  getSystemDefinitions
} from '#app/data/systems/queries'
import {
  authoredRouteStorySystem,
  authoredRouteStorySystems,
  authoredRouteStoryUser
} from '#domains/authoredRouteStory.fixtures'
import { SystemDetailPage } from './SystemDetailPage'
import {
  createDefinitionWorkspace,
  withDefinitionDraft,
  withDefinitionPublication
} from './SystemDefinitionWorkspace.fixtures'

const systemId = authoredRouteStorySystem.id

const systemSummary = {
  ...authoredRouteStorySystems[0]!,
  rulesCatalogues: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      label: '2014 SRD',
      description: 'Open rules content available to this System.'
    }
  ]
}

const capability = gameSystemRuleCapabilityDtoSchema.parse({
  gameSystemId: systemId,
  contractVersion: 1,
  authoredRootKinds: ['effect'],
  contentKinds: [],
  definitionFamilyKeys: ['sense', 'rules-runtime-graph'],
  factContracts: [{ key: 'actor.level', valueKind: 'NUMBER' }],
  operationContracts: [{ key: 'number.add', contractVersion: 1 }]
})

let workspace = createDefinitionWorkspace()

const meta = {
  title: 'Domains/Systems/System Detail',
  component: SystemDetailPage,
  args: { systemId },
  beforeEach: () => {
    workspace = createDefinitionWorkspace()
  },
  decorators: [
    (Story) => {
      const queryClient = useQueryClient()
      queryClient.setQueryDefaults(getSystem(systemId).queryKey, {
        queryFn: async () => authoredRouteStorySystem
      })
      queryClient.setQueryDefaults(getSystemSummary(systemId).queryKey, {
        queryFn: async () => systemSummary
      })
      queryClient.setQueryDefaults(getSystemRuleCapability(systemId).queryKey, {
        queryFn: async () => capability
      })
      const page = () => {
        const { current: _current, draft: _draft, ...summary } = workspace
        return { page: [summary], isDone: true, continueCursor: '' }
      }
      queryClient.setQueryDefaults(getSystemDefinitions(systemId).queryKey, {
        queryFn: async () => page()
      })
      queryClient.setQueryDefaults(['convexQuery', getFunctionName(api.content.definitions.get)], {
        queryFn: async () => workspace
      })
      mocked(useConvexMutation).mockImplementation((reference) => {
        const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
          async (input?: unknown) => {
            switch (getFunctionName(reference)) {
              case getFunctionName(api.content.definitions.create): {
                const values = createReusableDefinitionInputDtoSchema.parse(input)
                workspace = createDefinitionWorkspace({ ...values, id: crypto.randomUUID() })
                break
              }
              case getFunctionName(api.content.definitions.saveDraft): {
                const values = saveReusableDefinitionDraftInputDtoSchema.parse(input)
                workspace = withDefinitionDraft(workspace, values.document)
                break
              }
              case getFunctionName(api.content.definitions.publish):
                publishReusableDefinitionDraftInputDtoSchema.parse(input)
                workspace = withDefinitionPublication(workspace)
                break
              default:
                throw new Error(`Unconfigured native mutation: ${getFunctionName(reference)}`)
            }
            queryClient.setQueryData(getSystemDefinition(workspace.id).queryKey, workspace)
            queryClient.setQueryData(getSystemDefinitions(systemId).queryKey, page())
            return workspace
          },
          { withOptimisticUpdate: () => mutate }
        )
        return mutate
      })
      return <Story />
    }
  ],
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        context: { user: authoredRouteStoryUser }
      }
    }
  }
} satisfies Meta<typeof SystemDetailPage>

export default meta

type Story = StoryObj<typeof meta>

export const DefinitionAuthoring: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'D&D 5e SRD' })).toBeVisible()
    await expect(await canvas.findByText('2014 SRD')).toBeVisible()
    await expect(
      await canvas.findAllByRole('heading', { name: 'Reusable definitions' })
    ).toHaveLength(2)
    await expect(await canvas.findByText('New')).toBeVisible()
    await expect(await canvas.findByLabelText('Channel')).toHaveValue('VISUAL')

    await userEvent.click(await canvas.findByRole('button', { name: 'Save draft' }))
    await waitFor(async () => expect(await canvas.findByText('Draft')).toBeVisible())

    const publish = await canvas.findByRole('button', { name: 'Publish' })
    await expect(publish).toBeEnabled()
    await userEvent.click(publish)
    await waitFor(async () => expect(await canvas.findByText('Published')).toBeVisible())
  }
}
