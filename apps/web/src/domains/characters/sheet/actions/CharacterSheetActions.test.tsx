import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { characterSheetFixture } from '../fixtures/characterSheet.fixtures'
import { createSheet } from '../tests/sheetTestHarness'
import { CharacterSheetActions } from './CharacterSheetActions'

describe('Character Sheet actions', () => {
  it('renders and filters actions by action type', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.actions.items = [
      {
        id: 'feature-1',
        label: 'Action Surge',
        kind: 'ACTION',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Fighter',
        description: '<p>Take one additional action on your turn.</p>'
      },
      {
        id: 'feature-2',
        label: 'Parry',
        kind: 'REACTION',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Fighter',
        description: '<p>Reduce incoming melee damage.</p>'
      },
      {
        id: 'feature-3',
        label: 'Second Wind',
        kind: 'BONUS_ACTION',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Fighter',
        description: '<p>Regain hit points without giving up your action.</p>',
        resourceGrantId: 'resource-1'
      },
      {
        id: 'feature-4',
        label: 'Trance',
        kind: 'OTHER',
        availability: { status: 'AVAILABLE' },
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
        equippedSlot: 'MAIN_HAND',
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
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Equipment',
        description: '<p>A plain wooden staff.</p>',
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
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Artificer',
        description: '<p>Build a magical turret that attacks your enemies.</p>',
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
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Core action',
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
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Fighter',
        description: '<p>Recover your fighting spirit.</p>',
        resourceGrantId: sheet.resources.items[0]!.id
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
      actionId: 'action-second-wind',
      resourceGrantId: sheet.resources.items[0]!.id,
      expectedVersion: 4
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/charges could not be updated/i)

    await user.click(
      within(filteredCharges).getByRole('button', { name: /restore one second wind charge/i })
    )
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'RESTORE_RESOURCE',
      resourceGrantId: sheet.resources.items[0]!.id,
      expectedVersion: 4
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('spends the authored charge cost for a source-backed action', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const sheet = createSheet()
    sheet.actions.items = [
      {
        id: 'action-warping-strike',
        label: 'Warping Strike',
        kind: 'ACTION',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Astral Tear',
        resourceGrantId: sheet.resources.items[0]!.id,
        resourceCost: 2
      }
    ]
    sheet.resources.items[0] = {
      ...sheet.resources.items[0]!,
      used: 0,
      max: 3,
      remaining: 3
    }

    renderWithAppProviders(
      <CharacterSheetActions pending={false} sheet={sheet} submitCommand={submitCommand} />
    )

    await user.click(screen.getByRole('button', { name: /use 2 warping strike charges/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'USE_RESOURCE',
      actionId: 'action-warping-strike',
      resourceGrantId: sheet.resources.items[0]!.id,
      amount: 2,
      expectedVersion: 4
    })
  })

  it('keeps attack rows aligned while limiting their resource controls to Limited Use', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    sheet.actions.items = [
      {
        id: 'action-force-ballista',
        label: 'Force Ballista',
        kind: 'ACTION',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Artificer',
        description: '<p>Build a magical turret that attacks your enemies.</p>',
        resourceGrantId: sheet.resources.items[0]!.id,
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
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Wizard',
        description: '<p>Recover expended spell slots after a short rest.</p>',
        resourceGrantId: 'resource-arcane-recovery',
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

  it('keeps unavailable actions visible while allowing manual recovery', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const sheet = createSheet()
    sheet.actions.items = [
      {
        id: 'action-wand-burst',
        label: 'Wand Burst',
        kind: 'ACTION',
        availability: { status: 'UNAVAILABLE', reasonCode: 'SOURCE_NOT_ATTUNED' },
        resourceGrantId: sheet.resources.items[0]!.id,
        resourceCost: 1,
        sourceLabel: 'Wand of Bursts'
      }
    ]
    sheet.resources.items[0] = {
      ...sheet.resources.items[0]!,
      used: 1,
      max: 2,
      remaining: 1
    }

    renderWithAppProviders(
      <CharacterSheetActions pending={false} sheet={sheet} submitCommand={submitCommand} />
    )

    expect(screen.getByText(/attune to this item/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /use one wand burst charge/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /restore one wand burst charge/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'RESTORE_RESOURCE',
      resourceGrantId: sheet.resources.items[0]!.id,
      expectedVersion: 4
    })
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
})
