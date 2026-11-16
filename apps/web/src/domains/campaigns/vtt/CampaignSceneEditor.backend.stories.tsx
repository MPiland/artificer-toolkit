import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useQuery } from '@tanstack/react-query'
import { useConvex, useQuery as useConvexQuery } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import {
  appendSceneDefinitionInputSchema,
  beginSceneDefinitionInputSchema,
  sceneDefinitionSaveProgressSchema
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { loadSceneDefinition } from '#app/data/campaigns/scenes'
import { queryKeys } from '#app/lib/queryKeys'
import { storyMutation, writesTo } from '#app/test/storybook/storyWrites'
import { STORY_CAMPAIGN } from '../../../../../apis/tests/developmentReviewDataScenarios'
import { SeededCampaign } from '../stories/SeededCampaign'
import { CampaignSceneEditor } from './CampaignSceneEditor'

/** The editor on the story Campaign's seeded Scene, found by name as Scene preparation finds it. */
function SeededSceneEditor({ campaign }: { campaign: CampaignDetailDto }) {
  const convex = useConvex()
  const session = useConvexQuery(api.account.session, {})
  const scenes = useConvexQuery(api.scenes.definitionReads.list, {
    campaignId: campaign.id,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  const sceneId = scenes?.page.find(({ name }) => name === STORY_CAMPAIGN.scene.name)?.id ?? null
  const definition = useQuery({
    queryKey: queryKeys.campaigns.sceneDefinition(campaign.id, sceneId),
    queryFn: ({ signal }) =>
      loadSceneDefinition(convex, { campaignId: campaign.id, sceneId: sceneId! }, signal),
    enabled: sceneId !== null
  })
  if (scenes && !sceneId)
    throw new Error(`The story Campaign has no "${STORY_CAMPAIGN.scene.name}".`)
  return definition.data && session?.user ? (
    <CampaignSceneEditor
      campaignId={campaign.id}
      currentUserId={session.user.userId}
      gameSystemId={campaign.gameSystemId}
      memberships={campaign.memberships}
      onDirtyChange={() => undefined}
      scene={definition.data}
    />
  ) : null
}

function SceneEditorFixture() {
  return <SeededCampaign>{(campaign) => <SeededSceneEditor campaign={campaign} />}</SeededCampaign>
}

// Reads the story account's seeded Scene and its real map asset (D218, D221); the save's begin,
// append and publish writes are spies that answer as the client parses them.
const meta = {
  title: 'Domains/Campaigns/VTT/Scene Editor',
  component: SceneEditorFixture,
  parameters: { a11y: { test: 'error' }, layout: 'fullscreen' }
} satisfies Meta<typeof SceneEditorFixture>

export default meta

type Story = StoryObj<typeof meta>

const { board, name: sceneName } = STORY_CAMPAIGN.scene

export const ConfiguredScene: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(
      await page.findByRole('region', { name: `Scene editor: ${sceneName}` })
    ).toBeVisible()
    await expect(await page.findByRole('toolbar', { name: 'Scene editor tools' })).toBeVisible()
    const wallTool = page.getByRole('button', { name: 'Draw wall' })
    await userEvent.click(wallTool)
    await expect(wallTool).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(page.getByRole('button', { name: 'Create wall' }))
    const saveButton = page.getByRole('button', { name: 'Save scene' })
    await expect(saveButton).toBeEnabled()
    await userEvent.click(saveButton)
    await waitFor(() => expect(saveButton).toBeDisabled())

    // The save is the seeded Scene's three writes: begin, the new barrier batch with the rest, publish.
    await waitFor(() => expect(writesTo(api.scenes.definitions.publish)).toHaveLength(1))
    const begins = writesTo(api.scenes.definitions.begin).map((write) =>
      beginSceneDefinitionInputSchema.parse(write)
    )
    await expect(begins).toEqual([
      expect.objectContaining({
        sceneId: expect.any(String),
        expectedVersion: expect.any(Number),
        counts: {
          annotations: 0,
          barriers: board.barriers.length + 1,
          darknessZones: 0,
          lights: board.lights.length,
          tokens: 2
        }
      })
    ])
    const commandId = begins[0]!.commandId
    const appended = writesTo(api.scenes.definitions.append).map((write) =>
      appendSceneDefinitionInputSchema.parse((write as { input: unknown }).input)
    )
    await expect(appended.map(({ saveId }) => saveId)).toEqual(appended.map(() => commandId))
    await expect(
      appended
        .flatMap((batch) =>
          batch.collection === 'barriers' ? batch.entities.map(({ kind }) => kind) : []
        )
        .sort()
    ).toEqual(['DOOR', 'WALL', 'WALL', 'WALL'])
    await expect(
      appended
        .flatMap((batch) =>
          batch.collection === 'tokens' ? batch.entities.map(({ label }) => label) : []
        )
        .sort()
    ).toEqual([STORY_CAMPAIGN.scene.allyLabel, STORY_CAMPAIGN.enemyLabel].sort())
    await expect(writesTo(api.scenes.definitions.publish)).toEqual([{ saveId: commandId }])

    // The publish answers as the save begin opened, so the client sees it published.
    const published = await storyMutation.mock.results.at(-1)!.value
    await expect(sceneDefinitionSaveProgressSchema.parse(published)).toMatchObject({
      saveId: commandId,
      status: 'PUBLISHED'
    })
  }
}
