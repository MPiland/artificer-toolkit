import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { vi } from 'vitest'
import type { CharacterSheetResponseDto } from '#app/lib/api'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { server } from '#test/msw/server'
import { CharacterSheetActions } from '../components/sheet/CharacterSheetActions'
import { CharacterSheetConditions } from '../components/sheet/CharacterSheetConditions'
import { CharacterSheetHero } from '../components/sheet/CharacterSheetHero'
import { CharacterSheetHistoryList } from '../components/sheet/CharacterSheetHistory'
import { CharacterSheetInventory } from '../components/sheet/CharacterSheetInventory'
import { CharacterSheetNotes } from '../components/sheet/CharacterSheetNotes'
import { CharacterSheetOverview } from '../components/sheet/CharacterSheetOverview'
import { CharacterSheetReference } from '../components/sheet/CharacterSheetReference'
import { CharacterSheetResources } from '../components/sheet/CharacterSheetResources'
import { CharacterSheetSpells } from '../components/sheet/CharacterSheetSpells'
import { CharacterSheetView } from '../components/sheet/CharacterSheetView'

const API_BASE = 'http://localhost:3001'

function createSheet(): CharacterSheetResponseDto {
  return {
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
      abilities: [{ ability: 'DEXTERITY', score: 14, modifier: 2 }],
      facts: [],
      armorClass: 12,
      initiative: 2,
      proficiencyBonus: 2,
      currentHitPoints: 10,
      maxHitPoints: 12,
      tempHitPoints: 3,
      maxHitPointsOverride: null,
      exhaustionLevel: 0,
      conditions: [],
      hitDice: []
    },
    actions: { items: [] },
    resources: {
      items: [],
      hitDice: []
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
          attuned: false
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
      equipmentOptions: [{ id: 'equipment-1', label: 'Longsword' }],
      currencyOptions: [{ id: 'currency-1', label: 'Gold' }]
    },
    notes: {}
  }
}

describe('Character Sheet sections', () => {
  it('submits sheet commands through the production command mutation path', async () => {
    const user = userEvent.setup()
    let submittedCommand: unknown

    server.use(
      http.post(`${API_BASE}/characters/:characterId/commands`, async ({ request }) => {
        submittedCommand = await request.json()
        const sheet = createSheet()
        sheet.meta.streamVersion = 5

        return HttpResponse.json({
          characterId: sheet.meta.characterId,
          streamVersion: sheet.meta.streamVersion,
          sheet
        })
      })
    )

    renderWithAppProviders(<CharacterSheetView hasDraft={false} sheet={createSheet()} />)

    await user.click(screen.getByRole('button', { name: /apply damage/i }))

    await waitFor(() => expect(submittedCommand).toMatchObject({
      type: 'ADJUST_HIT_POINTS',
      expectedVersion: 4
    }))
  })

  it('shows sheet command errors from the production command mutation path', async () => {
    const user = userEvent.setup()

    server.use(
      http.post(`${API_BASE}/characters/:characterId/commands`, () => HttpResponse.json({
        error: 'This character changed in another tab. Refresh the sheet, then try again.'
      }, { status: 409 }))
    )

    renderWithAppProviders(<CharacterSheetView hasDraft sheet={createSheet()} />)

    expect(screen.getByText(/builder draft work/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /apply damage/i }))

    expect(await screen.findByText(/changed in another tab/i)).toBeInTheDocument()
  })

  it('reacts when the requested initial sheet tab changes', () => {
    const { rerender } = renderWithAppProviders(
      <CharacterSheetView
        hasDraft={false}
        initialTab='spells'
        sheet={createSheet()}
      />
    )

    expect(screen.getByRole('tab', { name: /spells/i })).toHaveAttribute('aria-selected', 'true')

    rerender(
      <CharacterSheetView
        hasDraft={false}
        initialTab='inventory'
        sheet={createSheet()}
      />
    )

    expect(screen.getByRole('tab', { name: /inventory/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('renders action descriptions as playable reference text', () => {
    const sheet = createSheet()
    sheet.actions.items = [
      {
        id: 'feature-1',
        label: 'Second Wind',
        kind: 'OTHER',
        sourceLabel: 'Fighter',
        description: '<p>Regain hit points as a bonus action.</p>'
      }
    ]

    renderWithAppProviders(<CharacterSheetActions sheet={sheet} />)

    expect(screen.getByText(/second wind/i)).toBeInTheDocument()
    expect(screen.getByText(/regain hit points as a bonus action/i)).toBeInTheDocument()
  })

  it('renders rich text character identity without exposing markup', () => {
    const sheet = createSheet()
    sheet.identity.description = '<p>A careful explorer with a dangerous curiosity.</p>'

    renderWithAppProviders(<CharacterSheetHero hasDraft={false} sheet={sheet} />)

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
    sheet.reference.senses = [{ label: 'Darkvision', value: '60 feet' }]

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
      <CharacterSheetOverview
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /apply damage/i }))

    expect(submitCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ADJUST_HIT_POINTS',
      expectedVersion: 4
    }))
  })

  it('locks overview health and exhaustion inputs while a sheet command is pending', () => {
    const sheet = createSheet()
    sheet.overview.exhaustionLevel = 1

    renderWithAppProviders(
      <CharacterSheetOverview
        pending
        sheet={sheet}
        submitCommand={vi.fn()}
      />
    )

    expect(screen.getByRole('textbox', { name: /^amount$/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^temp hp$/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^max hp override$/i })).toBeDisabled()
    expect(screen.getByLabelText(/exhaustion notes/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /apply damage/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /save exhaustion notes/i })).toBeDisabled()
  })

  it('adds conditions with notes from the overview panel', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()

    renderWithAppProviders(
      <CharacterSheetOverview
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByPlaceholderText(/add condition/i))
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

  it('locks condition inputs while a sheet command is pending', () => {
    renderWithAppProviders(
      <CharacterSheetConditions
        pending
        sheet={createSheet()}
        submitCommand={vi.fn()}
      />
    )

    expect(screen.getByPlaceholderText(/add condition/i)).toBeDisabled()
    expect(screen.getByLabelText(/condition notes/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
  })

  it('saves exhaustion notes through the overview panel', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.overview.exhaustionLevel = 1

    renderWithAppProviders(
      <CharacterSheetOverview
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.type(screen.getByLabelText(/exhaustion notes/i), 'Forced march through the swamp')
    await user.click(screen.getByRole('button', { name: /save exhaustion notes/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_EXHAUSTION',
      level: 1,
      notes: 'Forced march through the swamp',
      expectedVersion: 4
    })
  })

  it('updates active condition notes through the overview panel', async () => {
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
      <CharacterSheetOverview
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    expect(screen.getByText(/suffers from toxins affecting its body/i)).toBeInTheDocument()
    expect(screen.queryByText(/<p>a poisoned creature/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^notes$/i }))
    await user.clear(screen.getByLabelText(/poisoned notes/i))
    await user.type(screen.getByLabelText(/poisoned notes/i), 'Wyvern sting')
    await user.click(screen.getByRole('button', { name: /save notes/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADD_CONDITION',
      conditionTypeId: 'condition-1',
      notes: 'Wyvern sting',
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

    await user.click(screen.getByRole('button', { name: /apply currency/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'ADJUST_CURRENCY',
      currencyId: 'currency-1',
      amount: 1,
      expectedVersion: 4
    })
  })

  it('locks inventory inputs while a sheet command is pending', () => {
    renderWithAppProviders(
      <CharacterSheetInventory
        pending
        sheet={createSheet()}
        submitCommand={vi.fn()}
      />
    )

    expect(screen.getByRole('textbox', { name: /^add equipment$/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^quantity$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /^adjust currency$/i })).toBeDisabled()
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

    await user.click(screen.getByRole('button', { name: /increase longsword quantity/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPDATE_INVENTORY_ITEM',
      itemId: 'item-1',
      quantity: 2,
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

    await user.click(screen.getByRole('button', { name: /details/i }))
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
        attuned: false
      }
    ]

    renderWithAppProviders(
      <CharacterSheetInventory
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    expect(screen.getByText(/moonlit blade/i)).toBeInTheDocument()
    expect(screen.getAllByText(/longsword/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/qty 1 - weapon - 3 pounds - 15 gold - equipped/i)).toBeInTheDocument()
    expect(screen.getByText(/properties:/i)).toBeInTheDocument()
    expect(screen.getByText(/martial, melee/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /details/i }))

    expect(screen.getByText(/a balanced knightly blade/i)).toBeInTheDocument()
  })

  it('restores resources and applies rests from the resources panel', async () => {
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

    renderWithAppProviders(
      <CharacterSheetResources
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByRole('button', { name: /restore 1/i }))
    await user.click(screen.getByRole('button', { name: /long rest/i }))

    expect(screen.getByText(/regain hit points as a bonus action/i)).toBeInTheDocument()
    expect(submitCommand).toHaveBeenNthCalledWith(1, {
      type: 'RESTORE_RESOURCE',
      resourceGrantId: 'resource-1',
      expectedVersion: 4
    })
    expect(submitCommand).toHaveBeenNthCalledWith(2, {
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
      <CharacterSheetOverview
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

    await user.clear(screen.getByLabelText(/temp hp/i))
    await user.type(screen.getByLabelText(/temp hp/i), '9')

    rerender(
      <CharacterSheetOverview
        pending={false}
        sheet={refreshedSheet}
        submitCommand={submitCommand}
      />
    )

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
      <CharacterSheetOverview
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

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
      <CharacterSheetOverview
        pending={false}
        sheet={createSheet()}
        submitCommand={submitCommand}
      />
    )

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

    await user.click(screen.getByRole('button', { name: /prepare shield for wizard/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_PREPARED_SPELLS',
      classId: 'wizard',
      spellIds: ['hidden-spell', 'spell-2', 'spell-1'],
      expectedVersion: 4
    })
  })

  it('does not render spell preparation controls for known-spell sources', () => {
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

    expect(screen.queryByRole('button', { name: /prepare charm person for bard/i })).not.toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: /restore 1/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'RESTORE_SPELL_SLOT',
      slotKey: 'STANDARD:1',
      expectedVersion: 4
    })
  })

  it('renders spell casting details and rules text', () => {
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
        known: true
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells
        pending={false}
        sheet={sheet}
        submitCommand={vi.fn()}
      />
    )

    expect(screen.getByText(/level 1 - abjuration - 1 round - verbal, somatic, material/i)).toBeInTheDocument()
    expect(screen.getByText(/attributes:/i)).toBeInTheDocument()
    expect(screen.getByText(/concentration/i)).toBeInTheDocument()
    expect(screen.getByText(/a shimmering barrier protects you/i)).toBeInTheDocument()
    expect(screen.getByText(/a pinch of powdered silver/i)).toBeInTheDocument()
  })

  it('resyncs session notes when refreshed sheet data changes', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    const sheet = createSheet()
    sheet.notes.notes = '<p>Old notes</p>'
    const refreshedSheet = createSheet()
    refreshedSheet.meta.streamVersion = 5
    refreshedSheet.notes.notes = '<p>Updated notes</p>'

    const { rerender } = renderWithAppProviders(
      <CharacterSheetNotes
        pending={false}
        sheet={sheet}
        submitCommand={submitCommand}
      />
    )

    rerender(
      <CharacterSheetNotes
        pending={false}
        sheet={refreshedSheet}
        submitCommand={submitCommand}
      />
    )

    await screen.findByText(/updated notes/i)
    await user.click(screen.getByRole('button', { name: /save notes/i }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPDATE_NOTES',
      notes: '<p>Updated notes</p>',
      expectedVersion: 5
    })
  })

  it('locks session notes editing while a sheet command is pending', () => {
    const sheet = createSheet()
    sheet.notes.notes = '<p>Keep watch at midnight.</p>'

    renderWithAppProviders(
      <CharacterSheetNotes
        pending
        sheet={sheet}
        submitCommand={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/session notes/i)).toHaveAttribute('contenteditable', 'false')
    expect(screen.getByRole('button', { name: /save notes/i })).toBeDisabled()
  })

  it('renders rich text background notes without exposing markup', () => {
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

    expect(screen.getByText(/alignment: chaotic good/i)).toBeInTheDocument()
    expect(screen.getByText(/lifestyle: modest/i)).toBeInTheDocument()
    expect(screen.getByText(/faith: oghma/i)).toBeInTheDocument()
    expect(screen.getByText(/gender: nonbinary/i)).toBeInTheDocument()
    expect(screen.getByText(/age: 32/i)).toBeInTheDocument()
    expect(screen.getByText(/weathered blue cloak/i)).toBeInTheDocument()
    expect(screen.getByText(/asks one question/i)).toBeInTheDocument()
    expect(screen.getByText(/knowledge should help people/i)).toBeInTheDocument()
    expect(screen.getByText(/protects a missing mentor/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot leave a sealed door/i)).toBeInTheDocument()
    expect(screen.getByText(/archive lanterns/i)).toBeInTheDocument()
    expect(screen.getByText(/captain merrow/i)).toBeInTheDocument()
    expect(screen.getByText(/sable index/i)).toBeInTheDocument()
    expect(screen.getByText(/raised among dangerous archives/i)).toBeInTheDocument()
    expect(screen.queryByText(/<p>asks one question/i)).not.toBeInTheDocument()
  })

  it('renders sheet command history entries without needing the builder', () => {
    renderWithAppProviders(
      <CharacterSheetHistoryList
        entries={[
          {
            eventId: 'event-1',
            occurredAt: '2026-05-05T14:15:00.000Z',
            actorId: 'user-1',
            eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
            summary: '3 damage applied'
          }
        ]}
      />
    )

    expect(screen.getByText(/3 damage applied/i)).toBeInTheDocument()
    expect(screen.getByText(/character sheet command applied/i)).toBeInTheDocument()
  })
})
