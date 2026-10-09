import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignTabletopEncounterDrawer } from './CampaignTabletopEncounterDrawer'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'

describe('CampaignTabletopEncounterDrawer', () => {
  it('shows the private player turn order without GM controls', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        actorIdByTokenId={new Map()}
        connected
        currentActorMine={false}
        encounter={tabletopPlayerEncounter}
        memberships={createTabletopCampaign('PLAYER').memberships}
        pending={false}
        role='PLAYER'
        scene={tabletopLiveScene}
        onCommand={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open turn order' }))

    expect(screen.getByRole('dialog', { name: 'Turn order' })).toBeInTheDocument()
    expect(screen.getByText("Ember's Wake")).toBeInTheDocument()
    expect(screen.getByText('Vault Warden')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next turn' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Current turn')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'End turn' })).not.toBeInTheDocument()
    expect(screen.queryByText('wounded')).not.toBeInTheDocument()
  })

  it.each([
    [{ level: 'DESCRIPTIVE', state: 'NEAR_DEATH' }, 'Near death'],
    [{ level: 'BAR', ratio: 0.35 }, null],
    [{ level: 'EXACT', current: 12, maximum: 40 }, 'HP 12/40'],
    [null, null]
  ] as const)('shows a player only the health its level allows: %j', async (health, text) => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        actorIdByTokenId={new Map()}
        connected
        currentActorMine={false}
        encounter={{
          ...tabletopPlayerEncounter,
          actors: [
            tabletopPlayerEncounter.actors[0],
            { ...tabletopPlayerEncounter.actors[1], health }
          ]
        }}
        memberships={createTabletopCampaign('PLAYER').memberships}
        pending={false}
        role='PLAYER'
        scene={tabletopLiveScene}
        onCommand={() => undefined}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Open turn order' }))
    const rows = screen.getByLabelText('Encounter turn order').children
    const warden = rows[1] as HTMLElement
    expect(within(warden).getByText('Vault Warden')).toBeInTheDocument()
    // The player's own Character is theirs to see exactly.
    expect(screen.getByText('HP 36/36')).toBeInTheDocument()
    if (text) expect(within(warden).getByText(text)).toBeInTheDocument()
    expect(within(warden).queryByRole('progressbar') !== null).toBe(health?.level === 'BAR')
    if (health?.level === 'BAR')
      expect(within(warden).getByRole('progressbar', { name: 'Vault Warden health' })).toBeVisible()
    if (!health) expect(within(warden).queryByText(/HP|Hurt|Bloodied|Unhurt|Near death/)).toBeNull()
    expect(within(warden).queryByText(/\d+\/\d+/) !== null).toBe(health?.level === 'EXACT')
  })
  it('keeps a defeated creature in the turn order, marked defeated', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        actorIdByTokenId={new Map()}
        connected
        currentActorMine={false}
        encounter={{
          ...tabletopPlayerEncounter,
          actors: [
            tabletopPlayerEncounter.actors[0],
            { ...tabletopPlayerEncounter.actors[1], defeated: true }
          ]
        }}
        memberships={createTabletopCampaign('PLAYER').memberships}
        pending={false}
        role='PLAYER'
        scene={tabletopLiveScene}
        onCommand={() => undefined}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Open turn order' }))
    const [hero, warden] = [
      ...screen.getByLabelText('Encounter turn order').children
    ] as HTMLElement[]
    expect(warden).toHaveAttribute('data-defeated', 'true')
    expect(within(warden!).getByText('Defeated')).toBeInTheDocument()
    expect(hero).not.toHaveAttribute('data-defeated')
  })

  it('always shows the GM exact hit points instead of a band', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        actorIdByTokenId={new Map()}
        connected
        currentActorMine
        encounter={tabletopGmEncounter}
        memberships={createTabletopCampaign('OWNER').memberships}
        pending={false}
        role='OWNER'
        scene={tabletopLiveScene}
        onCommand={() => undefined}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Open turn order' }))
    expect(screen.getByText('HP 36/36')).toBeInTheDocument()
    expect(screen.getByText('HP 47/64')).toBeInTheDocument()
    expect(screen.queryByText(/wounded|healthy/i)).not.toBeInTheDocument()
  })
  it('sends an authoritative versioned turn command for the GM', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        actorIdByTokenId={new Map()}
        connected
        currentActorMine
        encounter={tabletopGmEncounter}
        memberships={createTabletopCampaign('OWNER').memberships}
        pending={false}
        role='OWNER'
        scene={tabletopLiveScene}
        onCommand={onCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open turn order' }))
    await user.click(await screen.findByRole('button', { name: 'Next turn' }))

    expect(onCommand).toHaveBeenCalledWith({
      commandId: expect.any(String),
      encounterId: tabletopGmEncounter.id,
      expectedVersion: tabletopGmEncounter.version,
      type: 'ADVANCE_TURN'
    })
  })

  it('binds an Encounter actor to an available Campaign Scene token', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        actorIdByTokenId={new Map()}
        connected
        currentActorMine
        encounter={tabletopGmEncounter}
        memberships={createTabletopCampaign('OWNER').memberships}
        pending={false}
        role='OWNER'
        scene={tabletopLiveScene}
        onCommand={onCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open turn order' }))
    await user.click(await screen.findByLabelText("Scene token for Ember's Wake"))
    const [emberOption] = await screen.findAllByRole('option', { hidden: true, name: 'Ember' })
    expect(emberOption).toBeDefined()
    await user.click(emberOption!)

    expect(onCommand).toHaveBeenCalledWith({
      actorId: tabletopGmEncounter.actors[0]!.id,
      commandId: expect.any(String),
      encounterId: tabletopGmEncounter.id,
      expectedEncounterVersion: tabletopGmEncounter.version,
      sceneId: tabletopLiveScene.id,
      tokenId: tabletopLiveScene.tokens[0]!.id,
      type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
    })
  })

  it('keeps commands unavailable while the live session reconnects', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        actorIdByTokenId={new Map()}
        connected={false}
        currentActorMine
        encounter={tabletopGmEncounter}
        memberships={createTabletopCampaign('OWNER').memberships}
        pending={false}
        role='OWNER'
        scene={tabletopLiveScene}
        onCommand={() => undefined}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open turn order' }))

    expect(screen.getByText(/turn controls will return/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next turn' })).toBeDisabled()
  })

  it('lets a player end the turn only for an actor they control', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        actorIdByTokenId={new Map()}
        connected
        currentActorMine
        encounter={tabletopPlayerEncounter}
        memberships={createTabletopCampaign('PLAYER').memberships}
        pending={false}
        role='PLAYER'
        scene={tabletopLiveScene}
        onCommand={onCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open turn order' }))
    expect(screen.queryByRole('button', { name: 'Next turn' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'End turn' }))

    expect(onCommand).toHaveBeenCalledWith({
      commandId: expect.any(String),
      encounterId: tabletopPlayerEncounter.id,
      expectedVersion: tabletopPlayerEncounter.version,
      type: 'ADVANCE_TURN'
    })
  })

  it('lets the GM grant a player control of an actor and set its disposition', async () => {
    const user = userEvent.setup()
    const onCommand = vi.fn()
    renderWithAppProviders(
      <CampaignTabletopEncounterDrawer
        actorIdByTokenId={new Map()}
        connected
        currentActorMine
        encounter={tabletopGmEncounter}
        memberships={createTabletopCampaign('OWNER').memberships}
        pending={false}
        role='OWNER'
        scene={tabletopLiveScene}
        onCommand={onCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Open turn order' }))
    expect(screen.getByText('ember always controls this Character.')).toBeVisible()
    await user.click(screen.getByLabelText('Who controls Vault Warden'))
    await user.click(await screen.findByRole('option', { hidden: true, name: 'ember' }))

    expect(onCommand).toHaveBeenCalledWith({
      actorId: tabletopGmEncounter.actors[1]!.id,
      commandId: expect.any(String),
      controllerUserIds: [tabletopCurrentUserId],
      encounterId: tabletopGmEncounter.id,
      expectedVersion: tabletopGmEncounter.version,
      type: 'UPDATE_ACTOR'
    })

    const disposition = screen.getByLabelText('Vault Warden disposition')
    await user.click(disposition)
    const dispositionOptions = document.getElementById(disposition.getAttribute('aria-controls')!)!
    await user.click(
      await within(dispositionOptions).findByRole('option', { hidden: true, name: 'Neutral' })
    )
    expect(onCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actorId: tabletopGmEncounter.actors[1]!.id,
        disposition: 'NEUTRAL',
        type: 'UPDATE_ACTOR'
      })
    )
  })

  describe('active grants (D99)', () => {
    const shown = {
      effectId: '44444444-4444-4444-8444-444444444401',
      label: 'Antitoxin (vial)',
      sourceHidden: false,
      remainingTicks: 2,
      expiresAtCampaignMinute: null
    }
    const hidden = {
      effectId: '44444444-4444-4444-8444-444444444402',
      label: null,
      sourceHidden: true,
      remainingTicks: 5,
      expiresAtCampaignMinute: null
    }

    it('lists them for a player without a hidden source, and offers no End', async () => {
      const user = userEvent.setup()
      renderWithAppProviders(
        <CampaignTabletopEncounterDrawer
          actorIdByTokenId={new Map()}
          connected
          currentActorMine={false}
          encounter={{
            ...tabletopPlayerEncounter,
            actors: [
              tabletopPlayerEncounter.actors[0],
              { ...tabletopPlayerEncounter.actors[1], activeGrants: [shown, hidden] }
            ]
          }}
          memberships={createTabletopCampaign('PLAYER').memberships}
          pending={false}
          role='PLAYER'
          scene={tabletopLiveScene}
          onCommand={() => undefined}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))

      const list = screen.getByRole('list', { name: 'Active grants on Vault Warden' })
      expect(
        within(list)
          .getAllByRole('listitem')
          .map((item) => item.textContent)
      ).toEqual(['Antitoxin (vial) · 2 rounds left', 'Hidden source · 5 rounds left'])
      expect(screen.queryByRole('button', { name: /^End / })).not.toBeInTheDocument()
    })

    it('lets the GM end a Creature grant, but not a Character grant from the tracker', async () => {
      const user = userEvent.setup()
      const onCommand = vi.fn()
      renderWithAppProviders(
        <CampaignTabletopEncounterDrawer
          actorIdByTokenId={new Map()}
          connected
          currentActorMine
          encounter={{
            ...tabletopGmEncounter,
            actors: [
              { ...tabletopGmEncounter.actors[0], activeGrants: [shown] },
              {
                ...tabletopGmEncounter.actors[1],
                activeGrants: [{ ...hidden, label: 'Trap blessing' }]
              }
            ]
          }}
          memberships={createTabletopCampaign('OWNER').memberships}
          pending={false}
          role='OWNER'
          scene={tabletopLiveScene}
          onCommand={onCommand}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))

      expect(screen.queryByRole('button', { name: 'End Antitoxin (vial)' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'End Trap blessing' }))

      expect(onCommand).toHaveBeenCalledWith({
        actorId: tabletopGmEncounter.actors[1]!.id,
        commandId: expect.any(String),
        encounterId: tabletopGmEncounter.id,
        endActiveEffectId: hidden.effectId,
        expectedVersion: tabletopGmEncounter.version,
        type: 'UPDATE_ACTOR'
      })
    })
  })
})
