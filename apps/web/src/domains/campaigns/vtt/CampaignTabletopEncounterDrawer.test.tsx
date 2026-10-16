import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
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
        onEndCharacterConcentration={() => undefined}
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
        onEndCharacterConcentration={() => undefined}
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
        onEndCharacterConcentration={() => undefined}
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
        onEndCharacterConcentration={() => undefined}
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
        onEndCharacterConcentration={() => undefined}
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
        onEndCharacterConcentration={() => undefined}
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
        onEndCharacterConcentration={() => undefined}
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
        onEndCharacterConcentration={() => undefined}
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
        onEndCharacterConcentration={() => undefined}
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

  describe('revealing a creature the map hides (ATTACK-17.3)', () => {
    const warden = tabletopGmEncounter.actors[1]!
    const gmDrawer = (encounter: EncounterGmProjectionDto, onCommand = vi.fn()) =>
      renderWithAppProviders(
        <CampaignTabletopEncounterDrawer
          actorIdByTokenId={new Map()}
          connected
          currentActorMine
          encounter={encounter}
          memberships={createTabletopCampaign('OWNER').memberships}
          pending={false}
          role='OWNER'
          scene={tabletopLiveScene}
          onCommand={onCommand}
          onEndCharacterConcentration={() => undefined}
        />
      )

    it('lets the GM reveal an actor named', async () => {
      const user = userEvent.setup()
      const onCommand = vi.fn()
      gmDrawer(tabletopGmEncounter, onCommand)

      await user.click(screen.getByRole('button', { name: 'Open turn order' }))
      await user.click(screen.getByRole('combobox', { name: 'Reveal Vault Warden to players' }))
      // Every actor row carries its own reveal list, so the option is read from this actor's.
      const levels = await screen.findByRole('listbox', {
        hidden: true,
        name: 'Reveal Vault Warden to players'
      })
      await user.click(within(levels).getByRole('option', { hidden: true, name: 'Reveal named' }))

      expect(onCommand).toHaveBeenCalledWith({
        actorId: warden.id,
        commandId: expect.any(String),
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        reveal: 'NAMED',
        type: 'UPDATE_ACTOR'
      })
    })

    it('shows the GM the level an actor is revealed at', async () => {
      const user = userEvent.setup()
      gmDrawer({
        ...tabletopGmEncounter,
        actors: tabletopGmEncounter.actors.map((actor) =>
          actor.id === warden.id ? { ...actor, reveal: 'UNNAMED' as const } : actor
        )
      })
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))
      expect(screen.getByRole('combobox', { name: 'Reveal Vault Warden to players' })).toHaveValue(
        'Reveal unnamed'
      )
    })

    it('lists a creature revealed unnamed to a player as an unseen creature, with no controls', async () => {
      const user = userEvent.setup()
      renderWithAppProviders(
        <CampaignTabletopEncounterDrawer
          actorIdByTokenId={new Map()}
          connected
          currentActorMine={false}
          encounter={{
            ...tabletopPlayerEncounter,
            actors: tabletopPlayerEncounter.actors.map((actor) =>
              actor.id === warden.id ? { ...actor, label: 'Unseen creature' } : actor
            )
          }}
          memberships={createTabletopCampaign('PLAYER').memberships}
          pending={false}
          role='PLAYER'
          scene={tabletopLiveScene}
          onCommand={vi.fn()}
          onEndCharacterConcentration={() => undefined}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))
      expect(await screen.findByText('Unseen creature')).toBeVisible()
      expect(screen.queryByText('Vault Warden')).toBeNull()
      expect(screen.queryByLabelText(/^Reveal .* to players$/)).toBeNull()
    })
  })

  describe('active grants (D99)', () => {
    const shown = {
      effectId: '44444444-4444-4444-8444-444444444401',
      label: 'Antitoxin (vial)',
      sourceHidden: false,
      remainingTicks: 2,
      expiresAtCampaignMinute: null,
      polarity: 'BENEFICIAL' as const
    }
    const hidden = {
      effectId: '44444444-4444-4444-8444-444444444402',
      label: null,
      sourceHidden: true,
      remainingTicks: 5,
      expiresAtCampaignMinute: null,
      polarity: 'NEUTRAL' as const
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
          onEndCharacterConcentration={() => undefined}
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
          onEndCharacterConcentration={() => undefined}
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

  describe('Concentration (SPELLS-5.11)', () => {
    const concentration = { label: 'Bless', sourceHidden: false }

    it('names the Concentration on the viewer-controlled Character and ends it through the Sheet', async () => {
      const user = userEvent.setup()
      const onCommand = vi.fn()
      const onEndCharacterConcentration = vi.fn()
      renderWithAppProviders(
        <CampaignTabletopEncounterDrawer
          actorIdByTokenId={new Map()}
          connected
          currentActorMine
          encounter={{
            ...tabletopPlayerEncounter,
            actors: [
              { ...tabletopPlayerEncounter.actors[0], concentration },
              tabletopPlayerEncounter.actors[1]
            ]
          }}
          memberships={createTabletopCampaign('PLAYER').memberships}
          pending={false}
          role='PLAYER'
          scene={tabletopLiveScene}
          onCommand={onCommand}
          onEndCharacterConcentration={onEndCharacterConcentration}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))

      expect(screen.getByText('Concentrating on Bless')).toBeVisible()
      await user.click(screen.getByRole('button', { name: "End Concentration for Ember's Wake" }))

      expect(onEndCharacterConcentration).toHaveBeenCalledWith(
        tabletopPlayerEncounter.actors[0]!.sourceId
      )
      expect(onCommand).not.toHaveBeenCalled()
    })

    it('shows no Concentration or End control when the actor is not concentrating', async () => {
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
          onEndCharacterConcentration={() => undefined}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))

      expect(screen.queryByText(/Concentrating/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /End Concentration/ })).not.toBeInTheDocument()
    })

    it('lets the GM end a Creature Concentration with an actor update, not a Sheet command', async () => {
      const user = userEvent.setup()
      const onCommand = vi.fn()
      const onEndCharacterConcentration = vi.fn()
      renderWithAppProviders(
        <CampaignTabletopEncounterDrawer
          actorIdByTokenId={new Map()}
          connected
          currentActorMine
          encounter={{
            ...tabletopGmEncounter,
            actors: [
              tabletopGmEncounter.actors[0],
              { ...tabletopGmEncounter.actors[1], concentration }
            ]
          }}
          memberships={createTabletopCampaign('OWNER').memberships}
          pending={false}
          role='OWNER'
          scene={tabletopLiveScene}
          onCommand={onCommand}
          onEndCharacterConcentration={onEndCharacterConcentration}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))
      await user.click(screen.getByRole('button', { name: 'End Concentration for Vault Warden' }))

      expect(onCommand).toHaveBeenCalledWith({
        actorId: tabletopGmEncounter.actors[1]!.id,
        commandId: expect.any(String),
        encounterId: tabletopGmEncounter.id,
        endConcentration: true,
        expectedVersion: tabletopGmEncounter.version,
        type: 'UPDATE_ACTOR'
      })
      expect(onEndCharacterConcentration).not.toHaveBeenCalled()
    })

    it('offers a player no End for a Creature, and no label when the source is hidden', async () => {
      const user = userEvent.setup()
      renderWithAppProviders(
        <CampaignTabletopEncounterDrawer
          actorIdByTokenId={new Map()}
          connected
          currentActorMine={false}
          encounter={{
            ...tabletopPlayerEncounter,
            actors: [
              {
                ...tabletopPlayerEncounter.actors[0],
                concentration: { label: null, sourceHidden: true }
              },
              { ...tabletopPlayerEncounter.actors[1], concentration }
            ]
          }}
          memberships={createTabletopCampaign('PLAYER').memberships}
          pending={false}
          role='PLAYER'
          scene={tabletopLiveScene}
          onCommand={() => undefined}
          onEndCharacterConcentration={() => undefined}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))

      expect(screen.getByText('Concentrating')).toBeVisible()
      expect(screen.queryByText(/Concentrating on/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'End Concentration for Vault Warden' })
      ).not.toBeInTheDocument()
    })
  })

  describe('concealment observers (D116)', () => {
    const [watcher, hider] = tabletopGmEncounter.actors
    const bystander = {
      ...watcher!,
      id: 'e5c2b6f8-6a5e-4c0e-9b8a-2f5d3a9c7b11',
      label: 'Torchbearer'
    }
    const concealment = {
      effectId: '9d1f7a52-3b0c-4c4e-8f6a-7a1b2c3d4e5f',
      concealmentTotal: 17,
      observerActorIds: [watcher!.id]
    }
    const gmEncounter = {
      ...tabletopGmEncounter,
      actors: [watcher!, { ...hider!, concealment }, bystander]
    }

    function renderDrawer(
      encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto,
      role: 'OWNER' | 'PLAYER',
      onCommand = vi.fn()
    ) {
      renderWithAppProviders(
        <CampaignTabletopEncounterDrawer
          actorIdByTokenId={new Map()}
          connected
          currentActorMine
          encounter={encounter}
          memberships={createTabletopCampaign(role).memberships}
          pending={false}
          role={role}
          scene={tabletopLiveScene}
          onCommand={onCommand}
          onEndCharacterConcentration={() => undefined}
        />
      )
      return onCommand
    }

    it('lists to the GM who a hidden creature is hidden from and who noticed it', async () => {
      const user = userEvent.setup()
      renderDrawer(gmEncounter, 'OWNER')
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))

      const section = screen.getByRole('list', { name: `Hidden creature ${hider!.label}` })
      expect(within(section).getByText(`Hidden from ${watcher!.label}`)).toBeVisible()
      expect(within(section).getByText(`Noticed by ${bystander.label}`)).toBeVisible()
      expect(within(section).queryByText(`Hidden from ${bystander.label}`)).toBeNull()
    })

    it('removes an observer through SET_CONCEALMENT_OBSERVERS', async () => {
      const user = userEvent.setup()
      const onCommand = renderDrawer(gmEncounter, 'OWNER')
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))
      await user.click(
        screen.getByRole('button', { name: `Stop hiding ${hider!.label} from ${watcher!.label}` })
      )

      expect(onCommand).toHaveBeenCalledWith({
        activeEffectId: concealment.effectId,
        add: [],
        commandId: expect.any(String),
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        remove: [watcher!.id],
        type: 'SET_CONCEALMENT_OBSERVERS'
      })
    })

    it('adds an observer through SET_CONCEALMENT_OBSERVERS', async () => {
      const user = userEvent.setup()
      const onCommand = renderDrawer(gmEncounter, 'OWNER')
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))
      await user.click(
        screen.getByRole('button', { name: `Hide ${hider!.label} from ${bystander.label}` })
      )

      expect(onCommand).toHaveBeenCalledWith({
        activeEffectId: concealment.effectId,
        add: [bystander.id],
        commandId: expect.any(String),
        encounterId: tabletopGmEncounter.id,
        expectedVersion: tabletopGmEncounter.version,
        remove: [],
        type: 'SET_CONCEALMENT_OBSERVERS'
      })
    })

    it('shows a creature that is not hidden no observer list', async () => {
      const user = userEvent.setup()
      renderDrawer(tabletopGmEncounter, 'OWNER')
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))

      expect(screen.queryByText(/Hidden from/)).toBeNull()
    })

    it('offers a player no observer list or control', async () => {
      const user = userEvent.setup()
      renderDrawer(tabletopPlayerEncounter, 'PLAYER')
      await user.click(screen.getByRole('button', { name: 'Open turn order' }))

      expect(screen.queryByText(/Hidden from|Noticed by/)).toBeNull()
      expect(screen.queryByRole('button', { name: /Stop hiding|Hide .* from/ })).toBeNull()
    })
  })
})
