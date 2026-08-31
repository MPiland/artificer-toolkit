import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import { characterSheetFixture } from '#domains/characters/sheet/fixtures/characterSheet.fixtures'
import { CampaignTabletopActionDrawer } from './CampaignTabletopActionDrawer'
import { tabletopGmEncounter, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import type { LiveSessionCommittedMessage } from './liveSessionClient'

const resolveAction = fn()
const sourceActor = tabletopGmEncounter.actors[0]!
const targetActor = tabletopGmEncounter.actors[1]!
const actorIdByTokenId = new Map([
  [tabletopLiveScene.tokens[0]!.id, sourceActor.id],
  [tabletopLiveScene.tokens[1]!.id, targetActor.id]
])

async function resolveActionCommand(
  command: ResolveEncounterActionInputDto
): Promise<LiveSessionCommittedMessage> {
  resolveAction(command)
  return {
    type: 'COMMAND_COMMITTED',
    acceptedSequence: 1,
    aggregateKind: 'ENCOUNTER',
    aggregateId: tabletopGmEncounter.id,
    deliverySequence: 1,
    originCommandId: command.commandId,
    replayed: false,
    changedAggregates: [
      {
        aggregateKind: 'ENCOUNTER',
        aggregateId: tabletopGmEncounter.id,
        beforeVersion: tabletopGmEncounter.version,
        version: tabletopGmEncounter.version + 1
      }
    ],
    encounterActorTokenBindings: [],
    encounterSceneBindings: [],
    version: tabletopGmEncounter.version + 1,
    response: {
      projection: { ...tabletopGmEncounter, version: tabletopGmEncounter.version + 1 },
      roll: null,
      occurrence: null,
      resolution: {
        rulePackRevisionId: '77777777-7777-4777-8777-777777777799',
        checksum: 'a'.repeat(64),
        evaluatorKind: 'ZEN',
        evaluatorVersion: '1.0.0',
        modelContractVersion: 4,
        modelKey: 'encounter-resolve',
        normalizedFacts: {},
        trace: null,
        rolls: [],
        proposedOutcomes: [
          {
            kind: 'DAMAGE',
            targetActorId: targetActor.id,
            amount: 4,
            damageTypeId: null
          }
        ],
        appliedOutcomes: [
          {
            proposed: {
              kind: 'DAMAGE',
              targetActorId: targetActor.id,
              amount: 4,
              damageTypeId: null
            },
            status: 'APPLIED',
            before: { hitPoints: 47 },
            after: { hitPoints: 43 },
            correlatedCommandId: null
          }
        ],
        override: null
      }
    }
  }
}

const meta = {
  component: CampaignTabletopActionDrawer,
  parameters: {
    a11y: { test: 'error' },
    layout: 'padded'
  },
  title: 'Domains/Campaigns/VTT/Tabletop Actions'
} satisfies Meta<typeof CampaignTabletopActionDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const ResolveTargetedAction: Story = {
  args: {
    actions: characterSheetFixture.actions.items,
    actorIdByTokenId,
    connected: true,
    encounter: tabletopGmEncounter,
    pending: false,
    scene: tabletopLiveScene,
    onResolve: resolveActionCommand
  },
  play: async ({ canvasElement }) => {
    resolveAction.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(await page.findByRole('button', { name: 'Open actions' }))
    const dialog = await page.findByRole('dialog', { name: 'Actions' })
    await waitFor(() => expect(dialog).toBeVisible())
    const drawer = within(dialog)

    await userEvent.click(drawer.getByLabelText('Action'))
    await userEvent.click(await page.findByRole('option', { name: 'Quarterstaff · Equipment' }))
    await userEvent.click(drawer.getByLabelText('Target'))
    await userEvent.click(await page.findByRole('option', { name: 'Vault Warden' }))
    await expect(drawer.getByText('5 ft · +4 to hit')).toBeVisible()
    await userEvent.click(drawer.getByRole('button', { name: 'Resolve action' }))

    await waitFor(() => expect(resolveAction).toHaveBeenCalledTimes(1))
    await expect(await drawer.findByText('Action resolved · 1 outcome applied.')).toBeVisible()
    await expect(resolveAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESOLVE_ACTION',
        actorId: sourceActor.id,
        actionId: 'equipment-staff:attack',
        targetActorId: targetActor.id,
        sceneContext: {
          sceneId: tabletopLiveScene.id,
          expectedSceneVersion: tabletopLiveScene.version,
          sourceTokenId: tabletopLiveScene.tokens[0]!.id,
          targetTokenId: tabletopLiveScene.tokens[1]!.id
        }
      })
    )
  }
}
