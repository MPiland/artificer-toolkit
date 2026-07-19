import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { vi } from 'vitest'
import type { CharacterSheetResponseDto } from '#app/lib/api'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { server } from '#test/msw/server'
import { CharacterSheetActions } from '../components/sheet/CharacterSheetActions'
import { CharacterSheetHero } from '../components/sheet/CharacterSheetHero'
import { CharacterSheetInventory } from '../components/sheet/CharacterSheetInventory'
import { CharacterSheetNotes } from '../components/sheet/CharacterSheetNotes'
import { CharacterSheetOverview } from '../components/sheet/CharacterSheetOverview'
import { CharacterSheetOverviewStatusStrip } from '../components/sheet/CharacterSheetOverviewStatusStrip'
import { CharacterSheetOverviewVitals } from '../components/sheet/CharacterSheetOverviewVitals'
import { CharacterSheetReference } from '../components/sheet/CharacterSheetReference'
import { CharacterSheetResources } from '../components/sheet/CharacterSheetResources'
import { CharacterSheetSpells } from '../components/sheet/CharacterSheetSpells'
import { CharacterSheetView } from '../components/sheet/CharacterSheetView'

function createSheet(): CharacterSheetResponseDto {
  return {
    publicId: 'character-1',
    meta: {
      characterId: 'character-1',
      systemId: 'system-1',
      status: 'ACTIVE',
      streamVersion: 4
    },
    identity: {
      label: 'Aria',
      classSummary: 'Fighter 1',
      totalLevel: 1
    },
    overview: {
      abilities: [
        { ability: 'STRENGTH', score: 10, modifier: 0 },
        { ability: 'DEXTERITY', score: 14, modifier: 2 },
        { ability: 'CONSTITUTION', score: 12, modifier: 1 },
        { ability: 'INTELLIGENCE', score: 8, modifier: -1 },
        { ability: 'WISDOM', score: 13, modifier: 1 },
        { ability: 'CHARISMA', score: 11, modifier: 0 }
      ],
      facts: [
        { label: 'Speed', value: '30 feet' },
        { label: 'Passive Perception', value: '11' },
        { label: 'Passive Investigation', value: '9' },
        { label: 'Passive Insight', value: '11' }
      ],
      armorClass: 12,
      initiative: 2,
      proficiencyBonus: 2,
      currentHitPoints: 10,
      maxHitPoints: 12,
      tempHitPoints: 3,
      maxHitPointsOverride: null,
      exhaustionLevel: 0,
      conditions: [],
      hitDice: [{ die: 8, total: 1, used: 0, remaining: 1 }],
      savingThrows: [
        { ability: 'STRENGTH', label: 'Strength', total: 2, proficiency: 'FULL' },
        { ability: 'DEXTERITY', label: 'Dexterity', total: 2, proficiency: 'NONE' },
        { ability: 'CONSTITUTION', label: 'Constitution', total: 3, proficiency: 'FULL' },
        { ability: 'INTELLIGENCE', label: 'Intelligence', total: -1, proficiency: 'NONE' },
        { ability: 'WISDOM', label: 'Wisdom', total: 1, proficiency: 'NONE' },
        { ability: 'CHARISMA', label: 'Charisma', total: 0, proficiency: 'NONE' }
      ],
      skills: [
        { skillId: 'athletics', code: 'ATHLETICS', label: 'Athletics', ability: 'STRENGTH', total: 2, proficiency: 'FULL' },
        { skillId: 'perception', code: 'PERCEPTION', label: 'Perception', ability: 'WISDOM', total: 1, proficiency: 'NONE' },
        { skillId: 'investigation', code: 'INVESTIGATION', label: 'Investigation', ability: 'INTELLIGENCE', total: -1, proficiency: 'NONE' },
        { skillId: 'insight', code: 'INSIGHT', label: 'Insight', ability: 'WISDOM', total: 1, proficiency: 'NONE' },
        { skillId: 'stealth', code: 'STEALTH', label: 'Stealth', ability: 'DEXTERITY', total: 2, proficiency: 'NONE' }
      ]
    },
    actions: { items: [] },
    resources: {
      items: [
        {
          id: 'resource-1',
          label: 'Second Wind',
          sourceLabel: 'Fighter',
          used: 0,
          max: 1,
          remaining: 1,
          recovery: 'SHORT_REST'
        }
      ],
      hitDice: [{ die: 8, total: 1, used: 0, remaining: 1 }]
    },
    spells: {
      saveDc: null,
      attackBonus: null,
      slots: [],
      spells: []
    },
    inventory: {
      items: [
        {
          id: 'item-1',
          equipmentId: 'equipment-1',
          label: 'Longsword',
          quantity: 1,
          equipped: false,
          attuned: false,
          requiresAttunement: true
        }
      ],
      currencies: []
    },
    reference: {
      features: [],
      proficiencies: [],
      defenses: [],
      senses: [],
      conditionOptions: [
        {
          id: 'condition-1',
          label: 'Poisoned',
          description: 'A poisoned creature suffers from toxins affecting its body.'
        }
      ],
      equipmentOptions: [
        {
          id: 'equipment-1',
          label: 'Longsword',
          isContainer: false,
          requiresAttunement: true
        }
      ],
      currencyOptions: [{ id: 'currency-1', label: 'Gold' }]
    },
    notes: {}
  }
}

function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

function trpcErrorJson(message: string, status: number) {
  return HttpResponse.json([{
    error: {
      code: -32009,
      data: {
        code: 'CONFLICT',
        httpStatus: status,
        path: 'characters.command'
      },
      message
    }
  }], { status })
}

function readBatchedInput<TInput>(body: unknown): TInput {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return (body as { 0: TInput })[0]
}

async function openHpControls(user: ReturnType<typeof userEvent.setup>) {
  const manageButton = screen.getByRole('button', { name: /manage hp/i })
  if (manageButton.getAttribute('aria-expanded') !== 'true') {
    await user.click(manageButton)
  }
  await screen.findByLabelText(/^amount$/i)
}

async function openEquipmentManager(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /manage equipment/i }))
  await screen.findByRole('dialog', { name: /manage equipment/i })
}

async function showCarriedEquipment(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /containers/i }))
  await screen.findByText(/items not assigned to a container/i)
}

function mockMobileSheetViewport() {
  const originalMatchMedia = window.matchMedia

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 760px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })

  return () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    })
  }
}

describe('Character Sheet sections', () => {
  it('submits sheet commands through the production command mutation path', async () => {
    const user = userEvent.setup()
    let submittedCommand: unknown

    server.use(
      http.post('*/api/trpc/characters.command', async ({ request }) => {
        const body = await request.json()
        submittedCommand = readBatchedInput<{ id: string, input: unknown }>(body).input
        const sheet = createSheet()
        sheet.meta.streamVersion = 5

        return trpcJson({
          characterId: sheet.meta.characterId,
          streamVersion: sheet.meta.streamVersion,
          sheet
        })
      })
    )

    renderWithAppProviders(<CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={createSheet()} />)

    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /apply damage/i }))

    await waitFor(() => expect(submittedCommand).toMatchObject({
      type: 'ADJUST_HIT_POINTS',
      expectedVersion: 4
    }))
  })

  it('shows sheet command errors from the production command mutation path', async () => {
    const user = userEvent.setup()

    server.use(
      http.post('*/api/trpc/characters.command', () => trpcErrorJson(
        'This character changed in another tab. Refresh the sheet, then try again.',
        409
      ))
    )

    renderWithAppProviders(<CharacterSheetView characterPublicId='character-1' hasDraft sheet={createSheet()} />)

    expect(screen.getByText(/builder draft work/i)).toBeInTheDocument()
    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /apply damage/i }))

    expect(await screen.findByText(/changed in another tab/i)).toBeInTheDocument()
  })

  it('reacts when the requested initial sheet tab changes', () => {
    const { rerender } = renderWithAppProviders(
      <CharacterSheetView
        characterPublicId='character-1'
        hasDraft={false}
        initialTab='spells'
        sheet={createSheet()}
      />
    )

    expect(screen.getByRole('tab', { name: /spells/i })).toHaveAttribute('aria-selected', 'true')

    rerender(
      <CharacterSheetView
        characterPublicId='character-1'
        hasDraft={false}
        initialTab='inventory'
        sheet={createSheet()}
      />
    )

    expect(screen.getByRole('tab', { name: /^equipment$/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('renders and filters actions by action type', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.actions.items = [
      {
        id: 'feature-1',
        label: 'Action Surge',
        kind: 'ACTION',
        sourceLabel: 'Fighter',
        description: '<p>Take one additional action on your turn.</p>'
      },
      {
        id: 'feature-2',
        label: 'Parry',
        kind: 'REACTION',
        sourceLabel: 'Fighter',
        description: '<p>Reduce incoming melee damage.</p>'
      }
    ]

    renderWithAppProviders(<CharacterSheetActions sheet={sheet} />)

    expect(screen.getByText(/action surge/i)).toBeInTheDocument()
    expect(screen.getByText(/take one additional action/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^reaction$/i }))

    expect(screen.getByText(/parry/i)).toBeInTheDocument()
    expect(screen.queryByText(/action surge/i)).not.toBeInTheDocument()
  })

  it('renders resolved action mechanics without inventing roll controls', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.inventory.items = []
    sheet.resources.items = []
    sheet.actions.items = [
      {
        id: 'feature-option:force-ballista',
        label: 'Force Ballista',
        kind: 'ACTION',
        sourceLabel: 'Artificer',
        rollable: true,
        mechanic: {
          effectId: 'force-ballista-effect',
          trigger: 'ATTACK_ROLL',
          activation: { kind: 'ACTION', amount: 1 },
          rangeLabel: '120 ft',
          attackBonus: 7,
          outcomes: [
            {
              kind: 'DAMAGE',
              pathCode: 'ON_HIT',
              expression: '2d8',
              damageTypeId: 'force',
              damageTypeLabel: 'Force'
            }
          ]
        }
      },
      {
        id: 'feature:dash',
        label: 'Dash',
        kind: 'ACTION',
        sourceLabel: 'Core action',
        rollable: false,
        mechanic: {
          effectId: 'dash-effect',
          trigger: 'ACTIVATED',
          activation: { kind: 'ACTION', amount: 1 },
          outcomes: [{ kind: 'EFFECT', pathCode: 'ON_USE', effectKind: 'MOVEMENT', label: 'Gain extra movement' }]
        }
      }
    ]

    renderWithAppProviders(<CharacterSheetActions sheet={sheet} />)

    const ballista = screen.getByRole('group', { name: 'Force Ballista' })
    expect(within(ballista).getByText(/120 ft · \+7 to hit/i)).toBeInTheDocument()
    expect(within(ballista).getByText(/2d8 · force damage · on hit/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^roll$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^attack$/i }))
    expect(screen.getByRole('group', { name: 'Force Ballista' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Dash' })).not.toBeInTheDocument()
  })

  it('renders rich text character identity without exposing markup', () => {
    const sheet = createSheet()
    sheet.identity.description = '<p>A careful explorer with a dangerous curiosity.</p>'

    renderWithAppProviders(<CharacterSheetHero characterPublicId='character-1' hasDraft={false} sheet={sheet} />)

    expect(screen.getByText(/careful explorer/i)).toBeInTheDocument()
    expect(screen.queryByText(/<p>a careful explorer/i)).not.toBeInTheDocument()
  })

  it('renders reference feature descriptions as rules text', () => {
    const sheet = createSheet()
    sheet.reference.features = [
      {
        id: 'feature-1',
        label: 'Action Surge',
        sourceLabel: 'Fighter',
        source: { kind: 'CLASS', classId: 'fighter', classLevel: 2 },
        description: '<p>Take one additional action on your turn.</p>'
      }
    ]
    sheet.reference.proficiencies = [{ label: 'Athletics', value: 'Skill · Proficient' }]
    sheet.reference.senses = [{ senseId: 'darkvision', label: 'Darkvision', value: '60 feet' }]

    renderWithAppProviders(<CharacterSheetReference sheet={sheet} />)

    expect(screen.getByText(/action surge/i)).toBeInTheDocument()
    expect(screen.getByText(/take one additional action/i)).toBeInTheDocument()
    expect(screen.getByText(/athletics/i)).toBeInTheDocument()
    expect(screen.getByText(/skill · proficient/i)).toBeInTheDocument()
    expect(screen.getByText(/darkvision/i)).toBeInTheDocument()
    expect(screen.getByText(/60 feet/i)).toBeInTheDocument()
  })

  it('sends sheet commands with the current stream version', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /apply damage/i }))

    expect(submitCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ADJUST_HIT_POINTS',
      expectedVersion: 4
    }))
  })

  it('renders the overview as a dense digital sheet scan path', () => {
    const sheet = createSheet()
    sheet.overview.conditions = [{ conditionTypeId: 'condition-1', label: 'Poisoned' }]
    sheet.reference.features = [
      {
        id: 'feature-1',
        label: 'Action Surge',
        sourceLabel: 'Fighter',
        source: { kind: 'CLASS', classId: 'fighter', classLevel: 2 },
        description: '<p>Take one additional action on your turn.</p>'
      }
    ]

    renderWithAppProviders(<CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={sheet} />)

    expect(screen.getByRole('heading', { name: /^overview$/i })).toBeInTheDocument()
    const abilityStrip = screen.getByRole('region', { name: /ability scores/i })
    expect(within(abilityStrip).getByText('STR')).toBeInTheDocument()
    expect(within(abilityStrip).getByText('DEX')).toBeInTheDocument()

    const combatSection = screen.getByRole('heading', { name: /combat facts and hit points/i }).closest('section')
    expect(combatSection).not.toBeNull()
    expect(within(combatSection as HTMLElement).getByText(/armor class/i)).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText(/30 feet/i)).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText(/^hp$/i)).toBeInTheDocument()

    const statusSummary = screen.getByRole('region', { name: /status summary/i })
    expect(within(statusSummary).getByText(/exhaustion/i)).toBeInTheDocument()
    expect(within(statusSummary).getAllByText(/poisoned/i).length).toBeGreaterThan(0)

    const savesSection = screen.getByRole('heading', { name: /saving throws/i }).closest('section')
    expect(savesSection).not.toBeNull()
    expect(within(savesSection as HTMLElement).getByText(/strength/i)).toBeInTheDocument()

    const skillsSection = screen.getByRole('heading', { name: /^skills$/i }).closest('section')
    expect(skillsSection).not.toBeNull()
    expect(within(skillsSection as HTMLElement).getByText(/athletics/i)).toBeInTheDocument()

    const sensesSection = screen.getByText(/^senses$/i).closest('section')
    expect(sensesSection).not.toBeNull()
    expect(within(sensesSection as HTMLElement).getByText(/passive perception/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /equipment summary/i })).not.toBeInTheDocument()

    const actionsSection = screen.getByRole('heading', { name: /^actions$/i }).closest('section')
    expect(actionsSection).not.toBeNull()
    expect(within(actionsSection as HTMLElement).getByText(/second wind/i)).toBeInTheDocument()

    const featuresSection = screen.getByRole('heading', { name: /features & traits/i }).closest('section')
    expect(featuresSection).not.toBeNull()
    expect(within(featuresSection as HTMLElement).getByText(/action surge/i)).toBeInTheDocument()
    expect(within(featuresSection as HTMLElement).getByText(/take one additional action/i)).toBeInTheDocument()

    const resourceSection = screen.getByRole('heading', { name: /^resources$/i }).closest('section')
    expect(resourceSection).not.toBeNull()
    expect(within(resourceSection as HTMLElement).getByText(/second wind/i)).toBeInTheDocument()
    expect(within(resourceSection as HTMLElement).queryByText(/hit dice/i)).not.toBeInTheDocument()
  })

  it('groups mobile sheet pages by in-game task', async () => {
    const restoreViewport = mockMobileSheetViewport()
    const user = userEvent.setup()

    try {
      renderWithAppProviders(<CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={createSheet()} />)

      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
      expect(screen.getAllByText(/^Overview$/).length).toBeGreaterThan(0)
      expect(screen.getByRole('region', { name: /ability scores/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /saving throws/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /^skills$/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /open sheet section menu/i }))
      expect(screen.queryByRole('button', { name: /history/i })).not.toBeInTheDocument()
      await user.click(await screen.findByRole('button', { name: /^skills$/i }))
      expect(screen.getAllByRole('heading', { name: /^skills$/i }).length).toBeGreaterThan(0)

      await user.click(await screen.findByRole('button', { name: /open sheet section menu/i }))
      await user.click(await screen.findByRole('button', { name: /equipment/i }))

      expect(screen.getAllByText(/^Equipment$/).length).toBeGreaterThan(0)
      expect(screen.getByRole('heading', { name: /^equipment$/i, level: 1 })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /containers/i })).toBeInTheDocument()
    } finally {
      restoreViewport()
    }
  })

  it('locks overview health and status controls while a sheet command is pending', () => {
    const sheet = createSheet()
    sheet.overview.exhaustionLevel = 1

    renderWithAppProviders(
      <>
        <CharacterSheetOverviewVitals
          pending
          sheet={sheet}
          submitCommand={vi.fn()}
        />
        <CharacterSheetOverview
          pending
          sheet={sheet}
          submitCommand={vi.fn()}
        />
        <CharacterSheetOverviewStatusStrip
          pending
          sheet={sheet}
          submitCommand={vi.fn()}
        />
      </>
    )

    expect(screen.getByRole('button', { name: /manage hp/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /clear exhaustion/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /add condition/i })).toBeDisabled()
  })

  it('adds conditions with notes from the compact status strip', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /add condition/i }))
    await user.click(await screen.findByPlaceholderText(/add condition/i))
    await user.click(await screen.findByText(/poisoned/i))
    expect(screen.getByText(/suffers from toxins affecting its body/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/condition notes/i), 'Spider venom')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADD_CONDITION',
      conditionTypeId: 'condition-1',
      notes: 'Spider venom',
      expectedVersion: 4
    })
  })

  it('locks condition controls while a sheet command is pending', () => {
    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending
        sheet={createSheet()}
        submitCommand={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /add condition/i })).toBeDisabled()
  })

  it('sets exhaustion through the compact status strip', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /set exhaustion level 2/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_EXHAUSTION',
      level: 2,
      expectedVersion: 4
    })
  })

  it('updates active condition notes through the compact status strip', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.overview.conditions = [
      {
        conditionTypeId: 'condition-1',
        label: 'Poisoned',
        description: '<p>A poisoned creature suffers from toxins affecting its body.</p>',
        notes: 'Spider venom'
      }
    ]

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /poisoned/i }))
    await user.click(await screen.findByRole('button', { name: /edit poisoned notes/i }))
    const notesField = screen.getByLabelText(/condition notes/i)
    expect(notesField).toHaveValue('Spider venom')
    await user.clear(notesField)
    await user.type(notesField, 'Wyvern sting')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADD_CONDITION',
      conditionTypeId: 'condition-1',
      notes: 'Wyvern sting',
      expectedVersion: 4
    })
  })

  it('removes active conditions from the compact status strip', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.overview.conditions = [
      {
        conditionTypeId: 'condition-1',
        label: 'Poisoned',
        notes: 'Spider venom'
      }
    ]

    renderWithAppProviders(
      <CharacterSheetOverviewStatusStrip
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /poisoned/i }))
    await user.click(await screen.findByRole('button', { name: /remove poisoned condition/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'REMOVE_CONDITION',
      conditionTypeId: 'condition-1',
      expectedVersion: 4
    })
  })

  it('allows currency updates even when the character has no current currency rows', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetInventory
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await openEquipmentManager(user)
    await user.click(screen.getByRole('button', { name: /apply currency/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADJUST_CURRENCY',
      currencyId: 'currency-1',
      amount: 1,
      expectedVersion: 4
    })
  })

  it('locks inventory inputs while a sheet command is pending', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CharacterSheetInventory
        pending
        sheet={createSheet()}
        submitCommand={vi.fn()}
      />
    )

    await openEquipmentManager(user)
    expect(screen.getByRole('combobox', { name: /^equipment$/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^quantity$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: /^currency type$/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^amount$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /apply currency/i })).toBeDisabled()
  })

  it('updates inventory quantity through sheet commands', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetInventory
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await showCarriedEquipment(user)
    await user.click(screen.getByRole('button', { name: /increase longsword quantity/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPDATE_INVENTORY_ITEM',
      itemId: 'item-1',
      quantity: 2,
      expectedVersion: 4
    })
  })

  it('removes one inventory quantity through the stack removal command', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetInventory
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await showCarriedEquipment(user)
    await user.click(screen.getByRole('button', { name: /decrease longsword quantity/i }))
    await user.click(within(await screen.findByRole('dialog', { name: /remove longsword/i })).getByRole('button', { name: /remove item/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'REMOVE_INVENTORY_ITEM',
      itemId: 'item-1',
      quantity: 1,
      expectedVersion: 4
    })
  })

  it('toggles inventory equipment, attunement, and removal through sheet commands', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetInventory
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await showCarriedEquipment(user)
    await user.click(screen.getByRole('button', { name: /equip longsword/i }))
    await user.click(screen.getByRole('button', { name: /attune longsword/i }))
    await user.click(screen.getByRole('button', { name: /remove longsword/i }))
    await user.click(within(await screen.findByRole('dialog', { name: /remove longsword/i })).getByRole('button', { name: /remove item/i }))

    expect(submitCommand).toHaveBeenNthCalledWith(1, {
      type: 'EQUIP_ITEM',
      itemId: 'item-1',
      expectedVersion: 4
    })
    expect(submitCommand).toHaveBeenNthCalledWith(2, {
      type: 'ATTUNE_ITEM',
      itemId: 'item-1',
      expectedVersion: 4
    })
    expect(submitCommand).toHaveBeenNthCalledWith(3, {
      type: 'REMOVE_INVENTORY_ITEM',
      itemId: 'item-1',
      expectedVersion: 4
    })
  })

  it('adds inventory items through sheet commands', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'scrollIntoView'
    )
    Element.prototype.scrollIntoView = vi.fn()

    try {
      renderWithAppProviders(
        <CharacterSheetInventory
          pending={false}
          sheet={createSheet()}
          submitCommand={submitCommand}
        />
      )

      await openEquipmentManager(user)
      await user.click(screen.getByRole('combobox', { name: /^equipment$/i }))
      await user.keyboard('{ArrowDown}{Enter}')
      await user.click(screen.getByRole('button', { name: /add item/i }))
    } finally {
      if (scrollIntoViewDescriptor) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
      } else {
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
      }
    }

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: 'equipment-1',
      quantity: 1,
      expectedVersion: 4
    })
  })

  it('updates inventory custom labels and notes through sheet commands', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetInventory
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await showCarriedEquipment(user)
    await user.click(screen.getByRole('button', { name: /edit longsword details/i }))
    await user.type(screen.getByLabelText(/custom name/i), 'Moonlit Blade')
    await user.type(screen.getByLabelText(/item notes/i), 'Loaned by the captain')
    await user.click(screen.getByRole('button', { name: /save details/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPDATE_INVENTORY_ITEM',
      itemId: 'item-1',
      customName: 'Moonlit Blade',
      notes: 'Loaned by the captain',
      expectedVersion: 4
    })
  })

  it('renders inventory item reference details from equipment records', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.inventory.items = [
      {
        id: 'item-1',
        equipmentId: 'equipment-1',
        label: 'Moonlit Blade',
        equipmentLabel: 'Longsword',
        description: '<p>A balanced knightly blade.</p>',
        category: 'WEAPON',
        properties: ['MARTIAL', 'MELEE'],
        cost: { amount: 15, currencyId: 'gp' },
        costLabel: 'Gold',
        weight: { amount: 3, unit: 'POUNDS' },
        customName: 'Moonlit Blade',
        quantity: 1,
        equipped: true,
        attuned: false,
        requiresAttunement: false
      }
    ]

    renderWithAppProviders(
      <CharacterSheetInventory
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await showCarriedEquipment(user)
    expect(screen.getAllByText(/moonlit blade/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/longsword/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/qty 1 - weapon - 3 pounds - 15 gold - equipped/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/properties:/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/martial, melee/i).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /edit moonlit blade details/i }))

    expect(screen.getAllByText(/a balanced knightly blade/i).length).toBeGreaterThan(0)
  })

  it('uses resources, restores resources, spends hit dice, and applies rests from the resources panel', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.resources.items = [
      {
        id: 'resource-1',
        label: 'Second Wind',
        description: '<p>Regain hit points as a bonus action.</p>',
        sourceLabel: 'Fighter',
        used: 2,
        max: 3,
        remaining: 1,
        recovery: 'SHORT_REST'
      }
    ]
    sheet.resources.hitDice = [{ die: 10, total: 1, used: 0, remaining: 1 }]

    renderWithAppProviders(
      <CharacterSheetResources
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /use second wind/i }))
    await user.click(screen.getByRole('button', { name: /restore 1 second wind/i }))
    await user.click(screen.getByRole('button', { name: /spend d10 hit die/i }))
    await user.click(screen.getByRole('button', { name: /long rest/i }))

    expect(screen.getByText(/regain hit points as a bonus action/i)).toBeInTheDocument()
    expect(submitCommand).toHaveBeenNthCalledWith(1, {
      type: 'USE_RESOURCE',
      resourceGrantId: 'resource-1',
      expectedVersion: 4
    })
    expect(submitCommand).toHaveBeenNthCalledWith(2, {
      type: 'RESTORE_RESOURCE',
      resourceGrantId: 'resource-1',
      expectedVersion: 4
    })
    expect(submitCommand).toHaveBeenNthCalledWith(3, {
      type: 'USE_HIT_DIE',
      die: 10,
      expectedVersion: 4
    })
    expect(submitCommand).toHaveBeenNthCalledWith(4, {
      type: 'APPLY_REST',
      restKind: 'LONG',
      expectedVersion: 4
    })
  })

  it('resyncs HP setting inputs when refreshed sheet data changes', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const refreshedSheet = createSheet()
    refreshedSheet.meta.streamVersion = 5
    refreshedSheet.overview.tempHitPoints = 1
    refreshedSheet.overview.maxHitPoints = 18
    refreshedSheet.overview.maxHitPointsOverride = 18

    const { rerender } = renderWithAppProviders(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await openHpControls(user)
    await user.clear(screen.getByLabelText(/temp hp/i))
    await user.type(screen.getByLabelText(/temp hp/i), '9')

    rerender(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={refreshedSheet}
        submitCommand={submitCommand}
      />
    )

    await openHpControls(user)
    await waitFor(() => expect(screen.getByLabelText(/temp hp/i)).toHaveValue('1'))
    await user.click(screen.getByRole('button', { name: /save hp settings/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_HIT_POINTS',
      temp: 1,
      maxOverride: 18,
      expectedVersion: 5
    })
  })

  it('does not pin calculated max HP when saving settings without an override', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await openHpControls(user)
    await user.clear(screen.getByLabelText(/temp hp/i))
    await user.type(screen.getByLabelText(/temp hp/i), '5')
    await user.click(screen.getByRole('button', { name: /save hp settings/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_HIT_POINTS',
      temp: 5,
      maxOverride: null,
      expectedVersion: 4
    })
  })

  it('does not submit no-op hit point adjustments', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverviewVitals
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await openHpControls(user)
    await user.clear(screen.getByRole('textbox', { name: /^amount$/i }))
    await user.type(screen.getByRole('textbox', { name: /^amount$/i }), '0')

    expect(screen.getByRole('button', { name: /apply damage/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^heal$/i })).toBeDisabled()
  })

  it('prepares spells through the class-scoped sheet command', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.spells.preparationSources = [
      {
        classId: 'wizard',
        label: 'Wizard',
        preparedSpellIds: ['hidden-spell', 'spell-2']
      }
    ]
    sheet.spells.spells = [
      {
        id: 'spell-1',
        label: 'Shield',
        level: 1,
        prepared: false,
        known: true,
        sourceLabel: 'Wizard',
        sources: [{ classId: 'wizard', label: 'Wizard', canPrepare: true, prepared: false }]
      },
      {
        id: 'spell-2',
        label: 'Mage Armor',
        level: 1,
        prepared: true,
        known: true,
        sourceLabel: 'Wizard',
        sources: [{ classId: 'wizard', label: 'Wizard', canPrepare: true, prepared: true }]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /manage spells/i }))
    const manageDialog = await screen.findByRole('dialog', { name: /manage spells/i })
    await user.click(within(manageDialog).getByRole('button', { name: /^prepare$/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_PREPARED_SPELLS',
      classId: 'wizard',
      spellIds: ['hidden-spell', 'spell-2', 'spell-1'],
      expectedVersion: 4
    })
  })

  it('does not render spell preparation controls for known-spell sources', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.spells.spells = [
      {
        id: 'spell-1',
        label: 'Charm Person',
        level: 1,
        prepared: false,
        known: true,
        sourceLabel: 'Bard',
        sources: [{ classId: 'bard', label: 'Bard', canPrepare: false, prepared: false }]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /manage spells/i }))
    const manageDialog = await screen.findByRole('dialog', { name: /manage spells/i })
    expect(within(manageDialog).queryByRole('button', { name: /^prepare$/i })).not.toBeInTheDocument()
  })

  it('restores a single spell slot without clearing the full slot pool', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.spells.slots = [
      {
        slotKey: 'STANDARD:1',
        label: 'Level 1',
        level: 1,
        used: 2,
        max: 3,
        remaining: 1
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /level 1: 1 of 3 remaining/i }))
    const slotDialog = await screen.findByRole('dialog', { name: /manage spell slot/i })
    await user.click(within(slotDialog).getByRole('button', { name: /restore one/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'RESTORE_SPELL_SLOT',
      slotKey: 'STANDARD:1',
      expectedVersion: 4
    })
  })

  it('uses spell slots through sheet commands', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.spells.slots = [
      {
        slotKey: 'STANDARD:1',
        label: 'Level 1',
        level: 1,
        used: 0,
        max: 3,
        remaining: 3
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /level 1: 3 of 3 remaining/i }))
    const slotDialog = await screen.findByRole('dialog', { name: /manage spell slot/i })
    await user.click(within(slotDialog).getByRole('button', { name: /use one slot/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'USE_SPELL_SLOT',
      slotKey: 'STANDARD:1',
      expectedVersion: 4
    })
  })

  it('renders spell casting details and submits casts through the focused drawer', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.spells.spells = [
      {
        id: 'spell-1',
        label: 'Shield',
        description: '<p>A shimmering barrier protects you.</p>',
        level: 1,
        school: 'ABJURATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
        attributes: ['CONCENTRATION'],
        materialDescription: '<p>A pinch of powdered silver.</p>',
        prepared: true,
        known: true,
        sources: [{ id: 'wizard-source', classId: 'wizard', label: 'Wizard', castMode: 'AT_WILL', canPrepare: true, prepared: true }]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    expect(screen.getByRole('group', { name: 'Shield' })).toBeInTheDocument()
    expect(screen.getByText(/level 1 - abjuration - 1 round - verbal, somatic, material/i)).toBeInTheDocument()
    expect(screen.getByText(/attributes:/i)).toBeInTheDocument()
    expect(screen.getByText(/concentration/i)).toBeInTheDocument()
    expect(screen.getByText(/a shimmering barrier protects you/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^cast$/i }))
    const castDialog = await screen.findByRole('dialog', { name: /cast shield/i })
    await user.click(within(castDialog).getByRole('button', { name: /cast shield/i }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'CAST_SPELL',
      spellId: 'spell-1',
      sourceId: 'wizard-source',
      expectedVersion: 4
    })
  })

  it('shows spell level, provenance, mechanics, and the selected upcast result', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    })
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.spells.slots = [
      { slotKey: 'STANDARD:1', label: 'Level 1', level: 1, used: 0, max: 4, remaining: 4 },
      { slotKey: 'STANDARD:2', label: 'Level 2', level: 2, used: 0, max: 2, remaining: 2 }
    ]
    sheet.spells.spells = [
      {
        id: 'healing-word',
        label: 'Healing Word',
        level: 1,
        school: 'EVOCATION',
        prepared: true,
        known: true,
        sources: [
          {
            id: 'artificer-source',
            classId: 'artificer',
            label: 'Artificer',
            provenance: 'CLASS',
            acquisition: 'PREPARED',
            castMode: 'SPELL_SLOT',
            canPrepare: true,
            prepared: true
          }
        ],
        mechanics: [
          {
            effectId: 'healing-word-effect',
            trigger: 'ACTIVATED',
            activation: { kind: 'BONUS_ACTION', amount: 1 },
            rangeLabel: '60 ft',
            outcomes: [
              {
                kind: 'HEAL',
                pathCode: 'ON_USE',
                expression: '1d4 + 4',
                temporary: false,
                scaling: [
                  { level: 1, expression: '1d4 + 4' },
                  { level: 2, expression: '2d4 + 4' }
                ]
              }
            ]
          }
        ]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    const spellCard = screen.getByRole('group', { name: 'Healing Word' })
    expect(within(spellCard).getAllByText(/level 1/i).length).toBeGreaterThan(0)
    expect(within(spellCard).getByText(/artificer · class · prepared · spell slot/i)).toBeInTheDocument()
    expect(within(spellCard).getByText(/60 ft/i)).toBeInTheDocument()
    expect(within(spellCard).getByText(/1d4 \+ 4 · healing/i)).toBeInTheDocument()
    expect(within(spellCard).getByText(/higher-level spell slot/i)).toBeInTheDocument()

    await user.click(within(spellCard).getByRole('button', { name: /^cast$/i }))
    const castDialog = await screen.findByRole('dialog', { name: /cast healing word/i })
    expect(within(castDialog).getByText(/1d4 \+ 4 · healing/i)).toBeInTheDocument()

    await user.click(within(castDialog).getByRole('combobox', { name: /cast using/i }))
    fireEvent.click(await screen.findByRole('option', { hidden: true, name: /level 2 · 2\/2/i }))

    expect(within(castDialog).getByText(/2d4 \+ 4 · healing/i)).toBeInTheDocument()
    await user.click(within(castDialog).getByRole('button', { name: /cast healing word/i }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'CAST_SPELL',
      spellId: 'healing-word',
      sourceId: 'artificer-source',
      slotKey: 'STANDARD:2',
      expectedVersion: 4
    })
  })

  it('resyncs the selected note when refreshed sheet data changes', async () => {
    const sheet = createSheet()
    sheet.notes.groups = [{ id: 'session', label: 'Session Notes', kind: 'SESSION', sortOrder: 0 }]
    sheet.notes.items = [{ id: 'note-1', title: 'Session One', body: '<p>Old notes</p>', groupId: 'session', pinned: false, createdAt: '2026-07-10T12:00:00.000Z', updatedAt: '2026-07-10T12:00:00.000Z' }]
    const refreshedSheet = createSheet()
    refreshedSheet.meta.streamVersion = 5
    refreshedSheet.notes.groups = sheet.notes.groups
    refreshedSheet.notes.items = [{ id: 'note-1', title: 'Session One', body: '<p>Updated notes</p>', groupId: 'session', pinned: true, createdAt: '2026-07-10T12:00:00.000Z', updatedAt: '2026-07-11T12:00:00.000Z' }]

    const { rerender } = renderWithAppProviders(
      <CharacterSheetNotes
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn()}
      />
    )

    rerender(
      <CharacterSheetNotes
        pending={false}
        sheet={refreshedSheet}
        submitCommand={vi.fn()}
      />
    )

    expect(await screen.findByText(/updated notes/i)).toBeInTheDocument()
    expect(screen.getByText(/pinned/i)).toBeInTheDocument()
    expect(screen.getByText(/edited/i)).toBeInTheDocument()
  })

  it('locks note content and submission while a sheet command is pending', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.notes.groups = [{ id: 'session', label: 'Session Notes', kind: 'SESSION', sortOrder: 0 }]

    renderWithAppProviders(
      <CharacterSheetNotes
        pending
        sheet={sheet}
        submitCommand={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /new note/i }))
    const editor = await screen.findByRole('dialog', { name: /new note/i })
    expect(within(editor).getByLabelText(/^note$/i)).toHaveAttribute('contenteditable', 'false')
    expect(within(editor).getByRole('button', { name: /create note/i })).toBeDisabled()
  })

  it('renders Builder-owned backstory as read-only rich text without exposing markup', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.notes.alignment = 'Chaotic Good'
    sheet.notes.lifestyle = 'Modest'
    sheet.notes.faith = 'Oghma'
    sheet.notes.gender = 'Nonbinary'
    sheet.notes.age = '32'
    sheet.notes.appearance = '<p>Ink-stained sleeves and a weathered blue cloak.</p>'
    sheet.notes.personalityTraits = '<p>Asks one question too many.</p>'
    sheet.notes.ideals = '<p>Knowledge should help people.</p>'
    sheet.notes.bonds = '<p>Protects a missing mentor.</p>'
    sheet.notes.flaws = '<p>Cannot leave a sealed door alone.</p>'
    sheet.notes.organizations = '<p>Member of the Archive Lanterns.</p>'
    sheet.notes.allies = '<p>Trusts Captain Merrow.</p>'
    sheet.notes.enemies = '<p>Hunted by the Sable Index.</p>'
    sheet.notes.backstory = '<p>Raised among dangerous archives.</p>'

    renderWithAppProviders(
      <CharacterSheetNotes
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn()}
      />
    )

    await user.click(screen.getByText(/character backstory/i))
    expect(screen.getByText(/raised among dangerous archives/i)).toBeInTheDocument()
    expect(screen.queryByText(/<p>raised among dangerous archives/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit backstory/i })).not.toBeInTheDocument()
  })

})
