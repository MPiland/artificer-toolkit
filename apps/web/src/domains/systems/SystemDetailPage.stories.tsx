import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { HttpResponse, http } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { ReusableDefinitionWorkspaceDto } from '@artificer-toolkit/schema/api/reusableDefinitions'
import type { GameSystemRuleCapabilityDto } from '@artificer-toolkit/schema/api/rulesRuntime'
import { senseReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'
import {
  authoredRouteStorySystem,
  authoredRouteStorySystems,
  authoredRouteStoryUser
} from '#domains/authoredRouteStory.fixtures'
import { SystemDetailPage } from './SystemDetailPage'

const systemId = authoredRouteStorySystem.id
const definitionId = '77777777-7777-4777-8777-777777777777'
const contentSourceId = '88888888-8888-4888-8888-888888888888'
const authorUserId = '99999999-9999-4999-8999-999999999999'

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

const capability = {
  gameSystemId: systemId,
  contractVersion: 1,
  authoredRootKinds: ['effect'],
  definitionFamilyKeys: ['sense', 'rules-runtime-graph'],
  factContracts: [{ key: 'actor.level', valueKind: 'NUMBER' }],
  operationContracts: [{ key: 'number.add', contractVersion: 1 }]
} satisfies GameSystemRuleCapabilityDto

const senseDocument = senseReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'SENSE',
  id: definitionId,
  gameSystemId: systemId,
  capabilities: [
    {
      channel: 'VISUAL',
      accessGrade: 'PRECISE',
      satisfies: ['DETECT', 'LOCATE', 'PRECISE', 'SEE'],
      illuminationAccess: 'DIM',
      obscurementAccess: 'NONE',
      perceivesInvisible: false,
      physicalConstraints: ['LINE_OF_EFFECT']
    }
  ]
})

function createWorkspace(): ReusableDefinitionWorkspaceDto {
  return {
    id: definitionId,
    gameSystemId: systemId,
    contentSourceId,
    definitionFamilyKey: 'sense',
    label: 'Keen sight',
    description: 'A homebrew visual sense.',
    version: 0,
    sourceKind: 'USER',
    editable: true,
    currentVersion: null,
    draftVersion: null,
    current: null,
    draft: null
  }
}

function definitionHandlers() {
  let workspace = createWorkspace()
  const summary = () => {
    const { current: _current, draft: _draft, ...value } = workspace
    return value
  }

  return [
    http.get('*/api/trpc/systems.list*', () => trpcJson([systemSummary])),
    http.get('*/api/trpc/systems.get*', () => trpcJson(authoredRouteStorySystem)),
    http.get('*/api/trpc/systems.capability*', () => trpcJson(capability)),
    http.get('*/api/trpc/systems.definitions.list*', () => trpcJson([summary()])),
    http.get('*/api/trpc/systems.definitions.get*', () => trpcJson(workspace)),
    http.post('*/api/trpc/systems.definitions.saveDraft*', () => {
      workspace = {
        ...workspace,
        draftVersion: 1,
        draft: {
          definitionId,
          gameSystemId: systemId,
          authorUserId,
          document: senseDocument,
          checksum: 'a'.repeat(64),
          baseDefinitionVersion: 0,
          version: 1,
          createdAt: '2026-08-30T00:00:00.000Z',
          updatedAt: '2026-08-30T00:00:00.000Z'
        }
      }
      return trpcJson(workspace)
    }),
    http.post('*/api/trpc/systems.definitions.publish*', () => {
      workspace = {
        ...workspace,
        version: 1,
        currentVersion: 1,
        draftVersion: null,
        current: {
          id: definitionId,
          gameSystemId: systemId,
          contentSourceId,
          definitionFamilyKey: 'sense',
          label: workspace.label,
          description: workspace.description,
          document: senseDocument,
          checksum: 'a'.repeat(64),
          contractVersion: 1,
          version: 1,
          publishedAt: '2026-08-30T00:00:00.000Z',
          publishedBy: authorUserId
        },
        draft: null
      }
      return trpcJson(workspace)
    })
  ]
}

function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

const meta = {
  title: 'Domains/Systems/System Detail',
  component: SystemDetailPage,
  args: { systemId },
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: definitionHandlers() },
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
