import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { CampaignTabletopEncounterDrawer } from './CampaignTabletopEncounterDrawer'
import {
  createTabletopCampaign,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'

const meta = {
  component: CampaignTabletopEncounterDrawer,
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen'
  },
  title: 'Domains/Campaigns/VTT/Tabletop Turn Order'
} satisfies Meta<typeof CampaignTabletopEncounterDrawer>

export default meta
type Story = StoryObj<typeof meta>

const onGmCommand = fn()

export const Gm: Story = {
  args: {
    actorIdByTokenId: new Map(),
    connected: true,
    currentActorMine: true,
    encounter: tabletopGmEncounter,
    memberships: createTabletopCampaign('OWNER').memberships,
    pending: false,
    role: 'OWNER',
    scene: tabletopLiveScene,
    onCommand: onGmCommand,
    onEndCharacterConcentration: () => undefined
  }
}

export const GmOpen: Story = {
  args: Gm.args,
  play: async ({ canvasElement }) => {
    onGmCommand.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(await page.findByRole('button', { name: 'Open turn order' }))
    await waitFor(async () => {
      await expect(await page.findByRole('dialog', { name: 'Turn order' })).toBeVisible()
    })
    await userEvent.click(page.getByRole('button', { name: 'Next turn' }))
    await expect(onGmCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADVANCE_TURN',
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version
      })
    )
  }
}

export const Player: Story = {
  args: {
    actorIdByTokenId: new Map(),
    connected: true,
    currentActorMine: false,
    encounter: tabletopPlayerEncounter,
    memberships: createTabletopCampaign('PLAYER').memberships,
    pending: false,
    role: 'PLAYER',
    scene: tabletopLiveScene,
    onCommand: () => undefined,
    onEndCharacterConcentration: () => undefined
  }
}

/** The current actor is the player's own Character, so they can end the turn. */
export const PlayerTurn: Story = {
  args: {
    ...Player.args,
    currentActorMine: true
  }
}

export const Reconnecting: Story = {
  args: {
    ...Gm.args,
    connected: false
  }
}

const [targetHero, targetWarden] = tabletopPlayerEncounter.actors as [
  (typeof tabletopPlayerEncounter.actors)[number],
  (typeof tabletopPlayerEncounter.actors)[number]
]
// A creature the GM revealed unnamed that the player cannot see (D131).
const targetUnseen = {
  ...targetWarden,
  id: '99999999-9999-4999-8999-999999999904',
  label: 'Unseen creature',
  unseenReason: 'INVISIBLE' as const
}
const onTargetPick = fn()
const onTargetCancel = fn()

/**
 * The turn-order drawer as the target list: creatures the player cannot see lead, marked Hidden or
 * Invisible with no distance (D131); the visible ones follow nearest first. Each creature is a
 * button, and the map stays reachable.
 */
export const Targeting: Story = {
  args: {
    ...Player.args,
    encounter: {
      ...tabletopPlayerEncounter,
      actors: [...tabletopPlayerEncounter.actors, targetUnseen]
    },
    targeting: {
      entries: [
        {
          actorId: targetUnseen.id,
          attack: null,
          band: null,
          distance: null,
          distanceLabel: null,
          label: targetUnseen.label,
          tokenId: null,
          unseenReason: 'INVISIBLE'
        },
        {
          actorId: targetWarden.id,
          attack: { reasons: ['Long range'], rollMode: 'DISADVANTAGE' },
          band: 'LONG',
          distance: 40,
          distanceLabel: '40 ft',
          label: 'Vault Warden',
          tokenId: null,
          unseenReason: null
        },
        {
          actorId: targetHero.id,
          attack: null,
          band: 'OUT',
          distance: 90,
          distanceLabel: '90 ft',
          label: "Ember's Wake",
          tokenId: null,
          unseenReason: null
        }
      ],
      pickedActorId: null,
      onCancel: onTargetCancel,
      onPick: onTargetPick
    }
  },
  play: async ({ canvasElement }) => {
    onTargetPick.mockClear()
    onTargetCancel.mockClear()
    const page = within(canvasElement.ownerDocument.body)
    await expect(await page.findByRole('dialog', { name: 'Pick a target' })).toBeVisible()
    const targets = page.getAllByRole('button', { name: /^Target / })
    await expect(targets.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Target Unseen creature',
      'Target Vault Warden',
      "Target Ember's Wake"
    ])
    await expect(page.getByText('Invisible · Distance unknown')).toBeVisible()
    await expect(page.getByText('40 ft · In long range · Disadvantage (Long range)')).toBeVisible()
    await expect(page.getByText('90 ft · Out of range')).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Target Vault Warden' }))
    await expect(onTargetPick).toHaveBeenCalledWith(targetWarden.id)
    await userEvent.click(page.getByRole('button', { name: 'Cancel targeting' }))
    await expect(onTargetCancel).toHaveBeenCalledOnce()
  }
}
