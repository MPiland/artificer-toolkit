import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { vi } from 'vitest'
import type { CharacterSheetResponseDto } from '#app/lib/api'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { server } from '#test/msw/server'
import { characterSheetFixture } from '../character.fixtures'
import { CharacterSheetActions } from '../components/sheet/CharacterSheetActions'
import { CharacterSheetHero } from '../components/sheet/CharacterSheetHero'
import { CharacterSheetInventory } from '../components/sheet/CharacterSheetInventory'
import { CharacterSheetMobileStats } from '../components/sheet/CharacterSheetMobileStats'
import { CharacterSheetNotes } from '../components/sheet/CharacterSheetNotes'
import { CharacterSheetOverview } from '../components/sheet/CharacterSheetOverview'
import { CharacterSheetOverviewStatusStrip } from '../components/sheet/CharacterSheetOverviewStatusStrip'
import { CharacterSheetOverviewVitals } from '../components/sheet/CharacterSheetOverviewVitals'
import { CharacterSheetReference } from '../components/sheet/CharacterSheetReference'
import { CharacterSheetSpells } from '../components/sheet/CharacterSheetSpells'
import { CharacterSheetView } from '../components/sheet/CharacterSheetView'
import { CharacterSheetSpellsPanelContent } from '../components/sheet/panels/CharacterSheetSpellPanels'
import { spellsPanelFixture } from '../components/sheet/panels/characterSheetPanel.fixtures'

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
        {
          skillId: 'athletics',
          code: 'ATHLETICS',
          label: 'Athletics',
          ability: 'STRENGTH',
          total: 2,
          proficiency: 'FULL'
        },
        {
          skillId: 'perception',
          code: 'PERCEPTION',
          label: 'Perception',
          ability: 'WISDOM',
          total: 1,
          proficiency: 'NONE'
        },
        {
          skillId: 'investigation',
          code: 'INVESTIGATION',
          label: 'Investigation',
          ability: 'INTELLIGENCE',
          total: -1,
          proficiency: 'NONE'
        },
        {
          skillId: 'insight',
          code: 'INSIGHT',
          label: 'Insight',
          ability: 'WISDOM',
          total: 1,
          proficiency: 'NONE'
        },
        {
          skillId: 'stealth',
          code: 'STEALTH',
          label: 'Stealth',
          ability: 'DEXTERITY',
          total: 2,
          proficiency: 'NONE'
        }
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
          owner: {
            kind: 'AUTHORED_GRANT',
            resourceGrantId: 'resource-1',
            source: {
              kind: 'SYSTEM',
              systemId: '11111111-1111-1111-1111-111111111111'
            }
          },
          recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
        }
      ],
      hitDice: [{ die: 8, total: 1, used: 0, remaining: 1 }]
    },
    spells: {
      saveDc: null,
      attackBonus: null,
      slots: [],
      activeGroups: [],
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
    notes: {},
    extras: {
      kindOptions: [],
      originOptions: [],
      creatureOptions: [],
      vehicleOptions: [],
      items: []
    }
  }
}

function trpcJson(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

function trpcErrorJson(message: string, status: number) {
  return HttpResponse.json(
    [
      {
        error: {
          code: -32009,
          data: {
            code: 'CONFLICT',
            httpStatus: status,
            path: 'characters.command'
          },
          message
        }
      }
    ],
    { status }
  )
}

function readBatchedInput<TInput>(body: unknown): TInput {
  if (typeof body !== 'object' || body === null || !('0' in body)) {
    throw new Error('Expected batched tRPC input.')
  }

  return (body as { 0: TInput })[0]
}

async function openHpControls(user: ReturnType<typeof userEvent.setup>) {
  const manageButton = screen.getByRole('button', { name: /manage (?:hp|hit points)/i })
  if (manageButton.getAttribute('aria-expanded') !== 'true') {
    await user.click(manageButton)
  }
  await screen.findByRole('dialog', { name: /manage hit points/i })
  await screen.findByLabelText(/hit point amount/i)
}

async function openEquipmentManager(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /manage equipment/i }))
  await screen.findByRole('dialog', { name: /manage equipment/i })
}

async function showCarriedEquipment(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /^carried$/i }))
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

function mockTabletLandscapeViewport() {
  const originalMatchMedia = window.matchMedia

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('orientation: landscape'),
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
        submittedCommand = readBatchedInput<{ id: string; input: unknown }>(body).input
        const sheet = createSheet()
        sheet.meta.streamVersion = 5

        return trpcJson({
          characterId: sheet.meta.characterId,
          streamVersion: sheet.meta.streamVersion,
          sheet
        })
      })
    )

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={createSheet()} />
    )

    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /^damage$/i }))

    await waitFor(() =>
      expect(submittedCommand).toMatchObject({
        type: 'ADJUST_HIT_POINTS',
        expectedVersion: 4
      })
    )
  })

  it('shows sheet command errors from the production command mutation path', async () => {
    const user = userEvent.setup()

    server.use(
      http.post('*/api/trpc/characters.command', () =>
        trpcErrorJson(
          'This character changed in another tab. Refresh the sheet, then try again.',
          409
        )
      )
    )

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft sheet={createSheet()} />
    )

    expect(screen.getByText(/builder draft work/i)).toBeInTheDocument()
    await openHpControls(user)
    await user.click(screen.getByRole('button', { name: /^damage$/i }))

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

    expect(screen.getByRole('tab', { name: /^equipment$/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('keeps skills and proficiencies in the tablet overview instead of duplicating tabs', () => {
    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={createSheet()} />
    )

    const tabList = screen.getByRole('tablist')
    expect(within(tabList).queryByRole('tab', { name: /^skills$/i })).not.toBeInTheDocument()
    expect(within(tabList).queryByRole('tab', { name: /^proficiencies$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^skills$/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^proficiencies$/i })).toBeInTheDocument()
  })

  it('keeps skills persistent beside the tablet landscape workspace', async () => {
    const restoreViewport = mockTabletLandscapeViewport()
    const user = userEvent.setup()

    try {
      renderWithAppProviders(
        <CharacterSheetView
          characterPublicId='character-1'
          hasDraft={false}
          sheet={createSheet()}
        />
      )

      const tabList = screen.getByRole('tablist')
      expect(within(tabList).queryByRole('tab', { name: /^skills$/i })).not.toBeInTheDocument()
      expect(
        within(tabList).queryByRole('tab', { name: /^proficiencies$/i })
      ).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: /^skills$/i })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /overview facts/i })).toBeInTheDocument()

      await user.click(within(tabList).getByRole('tab', { name: /^actions$/i }))

      expect(screen.getByRole('region', { name: /^skills$/i })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: /overview facts/i })).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: /^actions$/i })).toBeInTheDocument()
    } finally {
      restoreViewport()
    }
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
      },
      {
        id: 'feature-3',
        label: 'Second Wind',
        kind: 'BONUS_ACTION',
        sourceLabel: 'Fighter',
        description: '<p>Regain hit points without giving up your action.</p>',
        resourceGrantId: 'resource-1'
      },
      {
        id: 'feature-4',
        label: 'Trance',
        kind: 'OTHER',
        sourceLabel: 'Sea Elf',
        description: '<p>Meditate deeply instead of sleeping.</p>'
      }
    ]

    renderWithAppProviders(
      <CharacterSheetActions pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    expect(screen.getByText(/action surge/i)).toBeInTheDocument()
    expect(screen.getByText(/take one additional action/i)).toBeInTheDocument()
    expect(screen.getByText(/meditate deeply instead of sleeping/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^action$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^bonus action$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^reaction$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^other$/i }))

    expect(screen.getByText(/trance/i)).toBeInTheDocument()
    expect(screen.getByText('(Special)')).toBeInTheDocument()
    expect(screen.queryByText(/^range$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^hit \/ dc$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^damage$/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^reaction$/i }))

    expect(screen.getByText(/parry/i)).toBeInTheDocument()
    expect(screen.getByText(/reduce incoming melee damage/i)).toBeInTheDocument()
    expect(screen.queryByText(/take one additional action/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/meditate deeply instead of sleeping/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/action surge/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^bonus action$/i }))

    expect(screen.getByText(/second wind/i)).toBeInTheDocument()
    expect(screen.getByText(/regain hit points without giving up your action/i)).toBeInTheDocument()
    expect(screen.queryByText(/^range$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^hit \/ dc$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^damage$/i)).not.toBeInTheDocument()
  })

  it('renders resolved action mechanics without inventing roll controls', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.inventory.items = [
      {
        id: 'staff-1',
        equipmentId: 'quarterstaff',
        label: 'Quarterstaff',
        description: '<p>A plain wooden staff.</p>',
        category: 'WEAPON',
        properties: [
          { code: 'SIMPLE', label: 'Simple' },
          { code: 'VERSATILE', label: 'Versatile' }
        ],
        quantity: 1,
        equipped: true,
        attuned: false,
        requiresAttunement: false
      }
    ]
    sheet.resources.items = []
    sheet.actions.items = [
      {
        id: 'equipment:quarterstaff:attack',
        label: 'Quarterstaff',
        kind: 'ACTION',
        sourceLabel: 'Equipment',
        description: '<p>A plain wooden staff.</p>',
        rollable: true,
        mechanic: {
          effectId: 'quarterstaff-effect',
          trigger: 'ATTACK_ROLL',
          activation: { kind: 'ACTION', amount: 1 },
          rangeLabel: '5 ft',
          attackBonus: 4,
          outcomes: [
            {
              kind: 'DAMAGE',
              pathCode: 'ON_HIT',
              expression: '1d6 + 2',
              damageTypeId: 'bludgeoning',
              damageTypeLabel: 'Bludgeoning'
            }
          ]
        }
      },
      {
        id: 'feature-option:force-ballista',
        label: 'Force Ballista',
        kind: 'ACTION',
        sourceLabel: 'Artificer',
        description: '<p>Build a magical turret that attacks your enemies.</p>',
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
            },
            {
              kind: 'EFFECT',
              pathCode: 'ON_HIT',
              effectKind: 'FORCED_MOVEMENT',
              label: 'Push the target 5 feet'
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
          outcomes: [
            {
              kind: 'EFFECT',
              pathCode: 'ON_USE',
              effectKind: 'MOVEMENT',
              label: 'Gain extra movement'
            }
          ]
        }
      }
    ]

    renderWithAppProviders(
      <CharacterSheetActions pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    const ballista = screen.getByRole('group', { name: 'Force Ballista' })
    expect(within(ballista).getByText('120 ft')).toBeInTheDocument()
    expect(within(ballista).getByText('+7')).toBeInTheDocument()
    expect(within(ballista).getByText(/2d8 force/i)).toBeInTheDocument()
    expect(screen.queryByText(/build a magical turret/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/push the target/i)).not.toBeInTheDocument()
    const quarterstaff = screen.getByRole('group', { name: 'Quarterstaff' })
    expect(within(quarterstaff).getByText('5 ft')).toBeInTheDocument()
    expect(within(quarterstaff).getByText('+4')).toBeInTheDocument()
    expect(within(quarterstaff).getByText(/1d6 \+ 2 bludgeoning/i)).toBeInTheDocument()
    expect(screen.queryByText(/versatile/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/plain wooden staff/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^roll$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^attack$/i }))
    expect(screen.getByRole('group', { name: 'Force Ballista' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Dash' })).not.toBeInTheDocument()
  })

  it('uses and restores feature charges from the All actions list', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const sheet = createSheet()
    sheet.actions.items = [
      {
        id: 'action-second-wind',
        label: 'Second Wind',
        kind: 'BONUS_ACTION',
        sourceLabel: 'Fighter',
        description: '<p>Recover your fighting spirit.</p>',
        resourceGrantId: 'resource-1'
      }
    ]
    sheet.resources.items[0] = {
      ...sheet.resources.items[0]!,
      used: 1,
      max: 2,
      remaining: 1,
      description: '<p>Recover your fighting spirit.</p>'
    }

    renderWithAppProviders(
      <CharacterSheetActions pending={false} sheet={sheet} submitCommand={submitCommand} />
    )

    const charges = screen.getByRole('group', { name: /second wind charges/i })
    expect(within(charges).getByText(/1\s*\/\s*2/)).toBeInTheDocument()
    expect(screen.getByText(/recover your fighting spirit/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^bonus action$/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^limited use$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^limited use$/i }))

    expect(screen.getByRole('heading', { name: /^bonus action$/i })).toBeInTheDocument()
    const filteredCharges = screen.getByRole('group', { name: /second wind charges/i })
    expect(screen.queryByRole('heading', { name: /^limited use$/i })).not.toBeInTheDocument()

    await user.click(
      within(filteredCharges).getByRole('button', { name: /use one second wind charge/i })
    )
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'USE_RESOURCE',
      resourceGrantId: 'resource-1',
      expectedVersion: 4
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/charges could not be updated/i)

    await user.click(
      within(filteredCharges).getByRole('button', { name: /restore one second wind charge/i })
    )
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'RESTORE_RESOURCE',
      resourceGrantId: 'resource-1',
      expectedVersion: 4
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps attack rows aligned while limiting their resource controls to Limited Use', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.actions.items = [
      {
        id: 'action-force-ballista',
        label: 'Force Ballista',
        kind: 'ACTION',
        sourceLabel: 'Artificer',
        description: '<p>Build a magical turret that attacks your enemies.</p>',
        resourceGrantId: 'resource-1',
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
      }
    ]
    sheet.resources.items[0] = {
      ...sheet.resources.items[0]!,
      used: 1,
      max: 2,
      remaining: 1
    }

    renderWithAppProviders(
      <CharacterSheetActions pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    expect(screen.getByRole('heading', { name: /^attack$/i })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /force ballista charges/i })).not.toBeInTheDocument()
    expect(screen.getByText(/artificer.*1\s*\/\s*2 uses/i)).toBeInTheDocument()
    expect(screen.getByText(/^range$/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^limited use$/i }))

    expect(screen.getByRole('heading', { name: /^attack$/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /force ballista charges/i })).toBeInTheDocument()
    expect(screen.getByText(/build a magical turret/i)).toBeInTheDocument()
    expect(screen.queryByText(/^range$/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^limited use$/i })).not.toBeInTheDocument()
  })

  it('shows a resource-backed recovery feature only as its charge row', () => {
    const sheet = createSheet()
    sheet.actions.items = [
      {
        id: 'feature:arcane-recovery:recovery',
        label: 'Arcane Recovery',
        kind: 'OTHER',
        sourceLabel: 'Wizard',
        description: '<p>Recover expended spell slots after a short rest.</p>',
        resourceGrantId: 'resource-arcane-recovery',
        rollable: false,
        mechanic: {
          effectId: 'arcane-recovery-effect',
          trigger: 'ACTIVATED',
          activation: { kind: 'OTHER', amount: 1 },
          rangeLabel: 'Self',
          outcomes: [
            {
              kind: 'EFFECT',
              pathCode: 'ON_USE',
              effectKind: 'RESOURCE_RECOVERY',
              label: 'Recover expended spell slots'
            }
          ]
        }
      }
    ]
    sheet.resources.items = [
      {
        ...sheet.resources.items[0]!,
        id: 'resource-arcane-recovery',
        label: 'Arcane Recovery',
        description: '<p>Recover expended spell slots with a short rest.</p>',
        sourceLabel: 'Wizard',
        owner: {
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-arcane-recovery',
          source: {
            kind: 'AUTHORED',
            sourceKind: 'FEATURE',
            definitionId: '00000000-0000-4000-8000-000000000117',
            sourceInstanceId: 'feature:arcane-recovery'
          }
        },
        sourceFeatureId: 'feature:arcane-recovery'
      }
    ]

    renderWithAppProviders(
      <CharacterSheetActions pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    expect(screen.getAllByRole('group', { name: 'Arcane Recovery' })).toHaveLength(1)
    expect(screen.getByText(/recover expended spell slots after a short rest/i)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /arcane recovery charges/i })).toBeInTheDocument()
  })

  it('shows standalone resource descriptions only through the Limited Use filter', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.actions.items = []
    sheet.resources.items = [
      {
        id: 'resource-spellblade',
        label: 'Inspiring Strike',
        description: '<p>Rebuild your courage mid-battle.</p>',
        sourceLabel: 'Order of Scribes',
        owner: {
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-spellblade',
          source: {
            kind: 'AUTHORED',
            sourceKind: 'SUBCLASS',
            definitionId: '00000000-0000-4000-8000-000000000119',
            sourceInstanceId: 'feature:inspiring-strike'
          }
        },
        sourceFeatureId: 'feature:inspiring-strike',
        used: 0,
        max: 1,
        remaining: 1,
        recoveries: [{ trigger: 'LONG_REST', amount: { kind: 'ALL' } }]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetActions pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    expect(screen.queryByText(/rebuild your courage mid-battle/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^limited use$/i }))

    expect(screen.getByText(/rebuild your courage mid-battle/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^other$/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^limited use$/i })).not.toBeInTheDocument()
  })

  it('shows only spell sources explicitly marked for the Attack list', async () => {
    const user = userEvent.setup()
    const sheet = structuredClone(characterSheetFixture)

    renderWithAppProviders(
      <CharacterSheetActions pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    await user.click(screen.getByRole('button', { name: /^attack$/i }))

    expect(screen.getByRole('group', { name: 'Fire Bolt' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Magic Missile' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Shield' })).not.toBeInTheDocument()
  })

  it('keeps descriptive character prose out of the compact play header', () => {
    const sheet = createSheet()
    sheet.identity.description = '<p>A careful explorer with a dangerous curiosity.</p>'

    renderWithAppProviders(
      <CharacterSheetHero characterPublicId='character-1' hasDraft={false} sheet={sheet} />
    )

    expect(screen.queryByText(/careful explorer/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/<p>a careful explorer/i)).not.toBeInTheDocument()
    expect(screen.queryByText(`Level ${sheet.identity.totalLevel}`)).not.toBeInTheDocument()
    expect(screen.getByText(sheet.identity.classSummary)).toBeInTheDocument()
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
    sheet.reference.proficiencies = [
      { kind: 'WEAPON', label: 'Quarterstaff', value: 'Equipment · Proficient' }
    ]
    sheet.reference.senses = [{ senseId: 'darkvision', label: 'Darkvision', value: '60 feet' }]

    renderWithAppProviders(<CharacterSheetReference sheet={sheet} />)

    expect(screen.getByText(/action surge/i)).toBeInTheDocument()
    expect(screen.getByText(/take one additional action/i)).toBeInTheDocument()
    expect(screen.getByText(/quarterstaff/i)).toBeInTheDocument()
    expect(screen.getByText(/equipment · proficient/i)).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: /^damage$/i }))

    expect(submitCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADJUST_HIT_POINTS',
        expectedVersion: 4
      })
    )
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

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={sheet} />
    )

    expect(screen.getByRole('heading', { name: /^overview$/i })).toBeInTheDocument()
    const abilityStrip = screen.getByRole('region', { name: /ability scores/i })
    expect(within(abilityStrip).getByText('STR')).toBeInTheDocument()
    expect(within(abilityStrip).getByText('DEX')).toBeInTheDocument()

    const combatSection = screen
      .getByRole('heading', { name: /combat facts and hit points/i })
      .closest('section')
    expect(combatSection).not.toBeNull()
    expect(within(combatSection as HTMLElement).getByText(/armor class/i)).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText(/30 feet/i)).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText(/^hp$/i)).toBeInTheDocument()

    const statusSummary = screen.getByRole('region', { name: /status summary/i })
    expect(within(statusSummary).getByText(/exhaustion/i)).toBeInTheDocument()
    expect(within(statusSummary).getAllByText(/poisoned/i).length).toBeGreaterThan(0)

    const savesSection = screen.getByRole('heading', { name: /saving throws/i }).closest('section')
    expect(savesSection).not.toBeNull()
    expect(
      within(savesSection as HTMLElement).getByRole('button', {
        name: /inspect strength saving throw/i
      })
    ).toBeInTheDocument()

    const skillsSection = screen.getByRole('heading', { name: /^skills$/i }).closest('section')
    expect(skillsSection).not.toBeNull()
    expect(within(skillsSection as HTMLElement).getByText(/athletics/i)).toBeInTheDocument()

    const sensesSection = screen.getByText(/^senses$/i).closest('section')
    expect(sensesSection).not.toBeNull()
    expect(
      within(sensesSection as HTMLElement).getByText(/passive perception/i)
    ).toBeInTheDocument()
    expect(
      within(sensesSection as HTMLElement).getByText(/passive investigation/i)
    ).toBeInTheDocument()
    expect(within(sensesSection as HTMLElement).getByText(/passive insight/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /equipment summary/i })).not.toBeInTheDocument()

    const attacksSection = screen.getByRole('heading', { name: /^attacks$/i }).closest('section')
    expect(attacksSection).not.toBeNull()
    expect(
      within(attacksSection as HTMLElement).getByText(/no attacks are currently available/i)
    ).toBeInTheDocument()

    const featuresSection = screen
      .getByRole('heading', { name: /features & traits/i })
      .closest('section')
    expect(featuresSection).not.toBeNull()
    expect(within(featuresSection as HTMLElement).getByText(/action surge/i)).toBeInTheDocument()
    expect(
      within(featuresSection as HTMLElement).getByText(/take one additional action/i)
    ).toBeInTheDocument()

    expect(screen.queryByRole('heading', { name: /^resources$/i })).not.toBeInTheDocument()
  })

  it('shows one distinct proficiency indicator for every skill level', () => {
    const sheet = createSheet()
    sheet.overview.skills = sheet.overview.skills.slice(0, 4).map((skill, index) => ({
      ...skill,
      proficiency: (['NONE', 'HALF', 'FULL', 'DOUBLE'] as const)[index] ?? 'NONE'
    }))

    renderWithAppProviders(
      <CharacterSheetView characterPublicId='character-1' hasDraft={false} sheet={sheet} />
    )

    const skillsSection = screen.getByRole('heading', { name: /^skills$/i }).closest('section')
    expect(skillsSection).not.toBeNull()
    expect(
      within(skillsSection as HTMLElement)
        .getAllByRole('img')
        .map((indicator) => indicator.getAttribute('aria-label'))
    ).toEqual(['Not proficient', 'Half proficiency', 'Proficient', 'Expertise'])
  })

  it('groups non-duplicative proficiencies and places desktop defenses with combat facts', () => {
    const sheet = createSheet()
    sheet.reference.proficiencies = [
      { kind: 'ARMOR', label: 'Light Armor', value: 'Equipment property · Proficient' },
      { kind: 'WEAPON', label: 'Simple Weapons', value: 'Class · Proficient' },
      { kind: 'WEAPON', label: 'Martial Weapons', value: 'Class · Proficient' },
      { kind: 'TOOL', label: "Cartographer's Tools", value: 'Equipment · Proficient' },
      { kind: 'LANGUAGE', label: 'Common', value: 'Language · Proficient' }
    ]
    sheet.reference.defenses = [
      { kind: 'RESISTANCE', damageTypeId: 'poison', label: 'Poison', value: 'Resistance' }
    ]

    renderWithAppProviders(
      <>
        <CharacterSheetOverview
          pending={false}
          sheet={sheet}
          showDefenses={false}
          submitCommand={vi.fn()}
        />
        <CharacterSheetOverviewVitals
          pending={false}
          sheet={sheet}
          showDefenses
          submitCommand={vi.fn()}
        />
      </>
    )

    const proficiencies = screen.getByRole('button', { name: /proficiencies/i }).closest('section')
    expect(proficiencies).not.toBeNull()
    expect(within(proficiencies as HTMLElement).getByText('Armor')).toBeInTheDocument()
    expect(within(proficiencies as HTMLElement).getByText('Light')).toBeInTheDocument()
    expect(within(proficiencies as HTMLElement).queryByText('Light Armor')).not.toBeInTheDocument()
    expect(within(proficiencies as HTMLElement).getByText('Weapons')).toBeInTheDocument()
    expect(within(proficiencies as HTMLElement).getByText('Simple, Martial')).toBeInTheDocument()
    expect(
      within(proficiencies as HTMLElement).queryByText(/Simple Weapons|Martial Weapons/)
    ).not.toBeInTheDocument()
    expect(within(proficiencies as HTMLElement).getByText('Tools')).toBeInTheDocument()
    expect(
      within(proficiencies as HTMLElement).getByText("Cartographer's Tools")
    ).toBeInTheDocument()
    expect(within(proficiencies as HTMLElement).getByText('Languages')).toBeInTheDocument()
    expect(within(proficiencies as HTMLElement).getByText('Common')).toBeInTheDocument()
    expect(within(proficiencies as HTMLElement).queryByText('Athletics')).not.toBeInTheDocument()

    const combatSection = screen
      .getByRole('heading', { name: /combat facts and hit points/i })
      .closest('section')
    expect(combatSection).not.toBeNull()
    expect(within(combatSection as HTMLElement).getByText('Defenses')).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText('Resistances')).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText('Poison')).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText('Immunities')).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText('Vulnerabilities')).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getAllByText('None')).toHaveLength(2)
    expect(
      within(combatSection as HTMLElement).getByRole('button', { name: /long rest/i })
    ).toHaveAttribute('data-variant', 'default')
  })

  it('keeps defenses out of the mobile overview because they are managed from the header', () => {
    renderWithAppProviders(
      <CharacterSheetMobileStats pending={false} sheet={createSheet()} submitCommand={vi.fn()} />
    )

    expect(screen.queryByText(/^defenses$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/^senses$/i)).toBeInTheDocument()
  })

  it('groups mobile sheet pages by in-game task', async () => {
    const restoreViewport = mockMobileSheetViewport()
    const user = userEvent.setup()

    try {
      renderWithAppProviders(
        <CharacterSheetView
          characterPublicId='character-1'
          hasDraft={false}
          sheet={createSheet()}
        />
      )

      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
      expect(screen.getAllByText(/^Overview$/).length).toBeGreaterThan(0)
      expect(screen.getByRole('region', { name: /ability scores/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /saving throws/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /^skills$/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /manage defenses/i })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /manage conditions and exhaustion/i })
      ).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: /status summary/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /manage conditions and exhaustion/i }))
      const conditionsDialog = await screen.findByRole('dialog', {
        name: /conditions & exhaustion/i
      })
      expect(
        within(conditionsDialog).getByRole('combobox', { name: /add condition/i })
      ).toBeInTheDocument()
      expect(within(conditionsDialog).getByText(/^Exhaustion$/i)).toBeInTheDocument()
      await user.keyboard('{Escape}')
      await waitFor(() => {
        expect(
          screen.queryByRole('dialog', { name: /conditions & exhaustion/i })
        ).not.toBeInTheDocument()
      })

      const sectionMenuButton = screen.getByRole('button', {
        name: /open sheet section menu/i
      })
      expect(sectionMenuButton).not.toHaveTextContent(/sections/i)

      const mobilePager = screen.getByRole('region', {
        name: /character sheet mobile pages/i
      })
      const mobileViewport = mobilePager.children.item(1)
      expect(mobileViewport).toBeInstanceOf(HTMLElement)
      fireEvent.touchStart(mobileViewport as HTMLElement, {
        touches: [{ clientX: 320, clientY: 120 }]
      })
      fireEvent.touchEnd(mobileViewport as HTMLElement, {
        changedTouches: [{ clientX: 220, clientY: 124 }]
      })
      expect(screen.getByRole('heading', { name: /^actions$/i, level: 2 })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /^resources$/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /open sheet section menu/i }))
      expect(screen.queryByRole('button', { name: /history/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^resources$/i })).not.toBeInTheDocument()

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
        <CharacterSheetOverviewVitals pending sheet={sheet} submitCommand={vi.fn()} />
        <CharacterSheetOverview pending sheet={sheet} submitCommand={vi.fn()} />
        <CharacterSheetOverviewStatusStrip pending sheet={sheet} submitCommand={vi.fn()} />
      </>
    )

    expect(screen.getByRole('button', { name: /manage (?:hp|hit points)/i })).toBeDisabled()
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
      <CharacterSheetOverviewStatusStrip pending sheet={createSheet()} submitCommand={vi.fn()} />
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
      <CharacterSheetInventory pending sheet={createSheet()} submitCommand={vi.fn()} />
    )

    await openEquipmentManager(user)
    expect(screen.getByRole('combobox', { name: /^equipment$/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^quantity$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: /^currency type$/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^amount$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /apply currency/i })).toBeDisabled()
  })

  it('opens owned-item details from the carried row without a separate details control', async () => {
    const user = userEvent.setup()
    const openPanel = vi.fn()

    renderWithAppProviders(
      <CharacterSheetInventory
        openPanel={openPanel}
        pending={false}
        sheet={createSheet()}
        submitCommand={vi.fn()}
      />
    )

    await showCarriedEquipment(user)
    await user.click(screen.getByRole('button', { name: /open longsword details/i }))

    expect(openPanel).toHaveBeenCalledWith({
      kind: 'ITEM',
      itemInstanceId: 'item-1'
    })
    expect(screen.queryByRole('button', { name: /^details$/i })).not.toBeInTheDocument()
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

  it('renders inventory item reference details from equipment records', async () => {
    const user = userEvent.setup()
    const openPanel = vi.fn()
    const sheet = createSheet()
    sheet.inventory.items = [
      {
        id: 'item-1',
        equipmentId: 'equipment-1',
        label: 'Moonlit Blade',
        equipmentLabel: 'Longsword',
        description: '<p>A balanced knightly blade.</p>',
        category: 'WEAPON',
        properties: [
          { code: 'MARTIAL', label: 'Martial' },
          { code: 'ONE_HANDED', label: 'One-Handed' }
        ],
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
        openPanel={openPanel}
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn()}
      />
    )

    await showCarriedEquipment(user)
    const row = screen.getByRole('button', { name: /open moonlit blade details/i })
    expect(within(row).getByText(/moonlit blade/i)).toBeInTheDocument()
    expect(within(row).getByText(/longsword/i)).toBeInTheDocument()
    expect(within(row).getByText(/3 pounds/i)).toBeInTheDocument()
    expect(within(row).getByText(/equipped/i)).toBeInTheDocument()
    expect(screen.queryByText(/properties:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/martial, one-handed/i)).not.toBeInTheDocument()

    await user.click(row)
    expect(openPanel).toHaveBeenCalledWith({ kind: 'ITEM', itemInstanceId: 'item-1' })
    expect(screen.queryByText(/a balanced knightly blade/i)).not.toBeInTheDocument()
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
    expect(screen.queryByRole('button', { name: /save hp settings/i })).not.toBeInTheDocument()
    expect(submitCommand).not.toHaveBeenCalled()
  })

  it('commits HP settings on blur without pinning calculated max HP', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)

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
    await user.tab()

    await waitFor(() =>
      expect(submitCommand).toHaveBeenCalledWith({
        type: 'SET_HIT_POINTS',
        temp: 5,
        maxOverride: null,
        expectedVersion: 4
      })
    )
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
    await user.clear(screen.getByRole('textbox', { name: /hit point amount/i }))
    await user.type(screen.getByRole('textbox', { name: /hit point amount/i }), '0')

    expect(screen.getByRole('button', { name: /^damage$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^heal$/i })).toBeDisabled()
  })

  it('prepares and unprepares spell sources in the manage panel', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const panel = {
      ...spellsPanelFixture,
      groups: [
        {
          ...spellsPanelFixture.groups[0],
          sources: [
            {
              ...spellsPanelFixture.groups[0].sources[0],
              spellId: '11111111-1111-1111-1111-111111111111',
              label: 'Mage Armor',
              prepared: false
            }
          ]
        }
      ]
    }
    const source = panel.groups[0]!.sources[0]

    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={panel}
        pending={false}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
        onOpenBuilder={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /^prepare$/i }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_PREPARED_SPELLS',
      classId: source.preparationClassId,
      spellIds: [source.spellId],
      expectedVersion: 4
    })

    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={{
          ...panel,
          groups: [
            {
              ...panel.groups[0]!,
              sources: [
                {
                  ...source,
                  prepared: true
                }
              ]
            }
          ]
        }}
        pending={false}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
        onOpenBuilder={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /^unprepare$/i }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_PREPARED_SPELLS',
      classId: source.preparationClassId,
      spellIds: [],
      expectedVersion: 4
    })
  })

  it('does not render spell preparation controls for non-preparable sources', () => {
    const panel = {
      ...spellsPanelFixture,
      groups: [
        {
          ...spellsPanelFixture.groups[0],
          sources: [
            {
              ...spellsPanelFixture.groups[0].sources[0],
              spellId: '22222222-2222-2222-2222-222222222222',
              label: 'Bardic Charm',
              canPrepare: false
            }
          ]
        }
      ]
    }

    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={panel}
        pending={false}
        submitCommand={vi.fn().mockResolvedValue(true)}
        onTargetChange={vi.fn()}
        onOpenBuilder={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /^prepare$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^unprepare$/i })).not.toBeInTheDocument()
  })

  it('restores a single spell slot without clearing the full slot pool', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const panel = {
      ...spellsPanelFixture,
      slots: [
        {
          slotKey: 'LEVEL_1',
          label: 'Level 1',
          used: 2,
          maximum: 3,
          remaining: 1
        }
      ]
    }

    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={panel}
        pending={false}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
        onOpenBuilder={vi.fn()}
      />
    )

    await user.click(screen.getAllByRole('button', { name: /restore one level 1 spell slot/i })[0]!)

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'RESTORE_SPELL_SLOT',
      slotKey: 'LEVEL_1',
      expectedVersion: 4
    })
  })

  it('uses spell slots through sheet commands', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const panel = {
      ...spellsPanelFixture,
      slots: [
        {
          slotKey: 'LEVEL_1',
          label: 'Level 1',
          used: 0,
          maximum: 3,
          remaining: 3
        }
      ]
    }

    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={panel}
        pending={false}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
        onOpenBuilder={vi.fn()}
      />
    )

    await user.click(screen.getAllByRole('button', { name: /use one level 1 spell slot/i })[0]!)

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'USE_SPELL_SLOT',
      slotKey: 'LEVEL_1',
      expectedVersion: 4
    })
  })

  it('casts directly from the spell list through row references', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const sheet = createSheet()
    sheet.spells.activeGroups = [
      {
        level: 1,
        label: 'Level 1',
        entries: [
          {
            rowId: 'row-shield',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '44444444-4444-4444-4444-444444444444',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 1
            },
            spellId: '44444444-4444-4444-4444-444444444444',
            source: {
              spellId: '44444444-4444-4444-4444-444444444444',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'wizard-source',
            castLevel: 1,
            displayName: 'Shield',
            primaryEffect: '1 round',
            available: true,
            cast: {
              spellId: '44444444-4444-4444-4444-444444444444',
              sourceId: 'wizard-source'
            }
          }
        ]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells pending={false} sheet={sheet} submitCommand={submitCommand} />
    )

    await user.click(screen.getByRole('button', { name: /cast shield at level 1/i }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'CAST_SPELL',
      spellId: '44444444-4444-4444-4444-444444444444',
      sourceId: 'wizard-source',
      expectedVersion: 4
    })
  })

  it('filters the existing spell level groups by backend action type', async () => {
    const user = userEvent.setup()
    const sheet = structuredClone(characterSheetFixture)

    renderWithAppProviders(
      <CharacterSheetSpells pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    await user.click(screen.getByRole('button', { name: /^reaction$/i }))

    expect(
      screen.getByRole('group', { name: /shield from wizard at level 1/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /fire bolt/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/^cantrips$/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^bonus action$/i }))

    expect(
      screen.getByRole('group', { name: /misty step from wizard at level 2/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /shield/i })).not.toBeInTheDocument()
  })

  it('opens spell entries from the list through openPanel', async () => {
    const user = userEvent.setup()
    const openPanel = vi.fn()
    const sheet = createSheet()
    sheet.spells.activeGroups = [
      {
        level: 0,
        label: 'Cantrips',
        entries: [
          {
            rowId: 'row-fire-bolt',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '55555555-5555-5555-5555-555555555555',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 0
            },
            spellId: '55555555-5555-5555-5555-555555555555',
            source: {
              spellId: '55555555-5555-5555-5555-555555555555',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'wizard-cantrip-source',
            castLevel: 0,
            displayName: 'Fire Bolt',
            available: true,
            cast: {
              spellId: '55555555-5555-5555-5555-555555555555',
              sourceId: 'wizard-cantrip-source'
            }
          }
        ]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn()}
        openPanel={openPanel}
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Open details for Fire Bolt as a cantrip' })
    )
    expect(openPanel).toHaveBeenCalledWith({
      kind: 'SPELL',
      source: {
        spellId: '55555555-5555-5555-5555-555555555555',
        sourceKind: 'CLASS',
        sourceInstanceId: 'class:wizard'
      },
      castLevel: 0
    })
  })

  it('renders compact spell rows and omits legacy metadata', async () => {
    const sheet = createSheet()
    sheet.spells.activeGroups = [
      {
        level: 1,
        label: 'Level 1',
        entries: [
          {
            rowId: 'row-healing-word',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '66666666-6666-6666-6666-666666666666',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:artificer'
              },
              castLevel: 1
            },
            spellId: '66666666-6666-6666-6666-666666666666',
            source: {
              spellId: '66666666-6666-6666-6666-666666666666',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:artificer'
            },
            sourceId: 'artificer-source',
            castLevel: 1,
            displayName: 'Healing Word',
            primaryEffect: '1d4 + 4 · healing',
            available: false,
            unavailableReason: 'No first-level slot available',
            cast: {
              spellId: '66666666-6666-6666-6666-666666666666',
              sourceId: 'artificer-source'
            }
          }
        ]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn()}
        openPanel={vi.fn()}
      />
    )

    const spellRow = screen.getByRole('group', { name: 'Healing Word at level 1' })
    expect(within(spellRow).getByText('Healing Word')).toBeInTheDocument()
    expect(within(spellRow).queryByText('Artificer')).not.toBeInTheDocument()
    expect(within(spellRow).getByText('1d4 + 4 · healing')).toBeInTheDocument()
    expect(within(spellRow).getByText('No first-level slot available')).toBeInTheDocument()
    expect(screen.getByText('Level 1')).toBeInTheDocument()
    expect(within(spellRow).queryByText(/level 1/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/abjuration/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/verbal/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/material/i)).not.toBeInTheDocument()
  })

  it('resyncs the selected note when refreshed sheet data changes', async () => {
    const sheet = createSheet()
    sheet.notes.groups = [{ id: 'session', label: 'Session Notes', kind: 'SESSION', sortOrder: 0 }]
    sheet.notes.items = [
      {
        id: 'note-1',
        title: 'Session One',
        body: '<p>Old notes</p>',
        groupId: 'session',
        pinned: false,
        createdAt: '2026-07-10T12:00:00.000Z',
        updatedAt: '2026-07-10T12:00:00.000Z'
      }
    ]
    const refreshedSheet = createSheet()
    refreshedSheet.meta.streamVersion = 5
    refreshedSheet.notes.groups = sheet.notes.groups
    refreshedSheet.notes.items = [
      {
        id: 'note-1',
        title: 'Session One',
        body: '<p>Updated notes</p>',
        groupId: 'session',
        pinned: true,
        createdAt: '2026-07-10T12:00:00.000Z',
        updatedAt: '2026-07-11T12:00:00.000Z'
      }
    ]

    const { rerender } = renderWithAppProviders(
      <CharacterSheetNotes pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    rerender(<CharacterSheetNotes pending={false} sheet={refreshedSheet} submitCommand={vi.fn()} />)

    expect(await screen.findByText(/updated notes/i)).toBeInTheDocument()
    expect(screen.getByText(/pinned/i)).toBeInTheDocument()
    expect(screen.getByText(/edited/i)).toBeInTheDocument()
  })

  it('locks note content and submission while a sheet command is pending', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.notes.groups = [{ id: 'session', label: 'Session Notes', kind: 'SESSION', sortOrder: 0 }]

    renderWithAppProviders(<CharacterSheetNotes pending sheet={sheet} submitCommand={vi.fn()} />)

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
      <CharacterSheetNotes pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    await user.click(screen.getByText(/character backstory/i))
    expect(screen.getByText(/raised among dangerous archives/i)).toBeInTheDocument()
    expect(screen.queryByText(/<p>raised among dangerous archives/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit backstory/i })).not.toBeInTheDocument()
  })
})
