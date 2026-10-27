import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { encounterHeldRelationshipDtoSchema } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  ReleaseRelationshipInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { validated } from '../../../test/validatedFixture'
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
const releaseSent = fn()

async function sendReleaseCommand(command: ReleaseRelationshipInputDto) {
  releaseSent(command)
  return {
    projection: { ...tabletopPlayerEncounter, version: tabletopPlayerEncounter.version + 1 },
    roll: null,
    occurrence: null,
    evidenceRoll: null
  } satisfies EncounterCommandResultDto
}

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
    session: undefined,
    holds: [],
    onCommand: onGmCommand,
    onEndCharacterConcentration: () => undefined,
    onRelease: sendReleaseCommand
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
    session: undefined,
    holds: [],
    onCommand: () => undefined,
    onEndCharacterConcentration: () => undefined,
    onRelease: sendReleaseCommand
  }
}

const [playerCharacter, vaultWarden] = tabletopPlayerEncounter.actors
const playerHold = validated(encounterHeldRelationshipDtoSchema)({
  sourceActorId: playerCharacter!.id,
  heldActorId: vaultWarden!.id,
  activeEffectId: '00000000-0000-4000-8000-000000000e31',
  label: `Release ${vaultWarden!.label}`,
  drag: null
})

/** On the held creature's own turn, the player's Character lets go of it for no action (D152). */
export const PlayerReleasesOffTurn: Story = {
  args: {
    ...Player.args,
    encounter: { ...tabletopPlayerEncounter, currentActorId: vaultWarden!.id },
    holds: [playerHold]
  },
  play: async ({ canvasElement }) => {
    releaseSent.mockClear()
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Open turn order' }))
    // The drawer fades in; its content only counts as visible once the open transition ends.
    await waitFor(async () => {
      await expect(await canvas.findByRole('dialog', { name: 'Turn order' })).toBeVisible()
    })
    const section = within(await canvas.findByRole('region', { name: 'Holding' }))

    await userEvent.click(section.getByRole('button', { name: playerHold.label }))

    await waitFor(() => expect(releaseSent).toHaveBeenCalledTimes(1))
    await expect(await section.findByText('Released.')).toBeVisible()
    await expect(releaseSent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RELEASE_RELATIONSHIP',
        encounterId: tabletopPlayerEncounter.id,
        expectedVersion: tabletopPlayerEncounter.version,
        actorId: playerCharacter!.id,
        heldActorId: vaultWarden!.id,
        activeEffectId: playerHold.activeEffectId
      })
    )
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
          attack: {
            reasons: ['Long range'],
            rollMode: 'DISADVANTAGE',
            rollModeLabel: 'Disadvantage',
            keep: 'LOWER'
          },
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
