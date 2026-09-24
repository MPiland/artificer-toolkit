import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CharacterSheetView } from '../core/CharacterSheetView'
import { CharacterSheetMobileStats } from '../mobile/CharacterSheetMobileStats'
import { createSheet, mockMobileSheetViewport } from '../tests/sheetTestHarness'
import { CharacterSheetOverview } from './CharacterSheetOverview'
import { CharacterSheetOverviewVitals } from '../vitals/CharacterSheetOverviewVitals'

describe('Character Sheet overview', () => {
  it('renders the overview as a dense digital sheet scan path', async () => {
    const user = userEvent.setup()
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

    expect(screen.getAllByRole('heading', { name: /^overview$/i }).length).toBeGreaterThan(0)
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
    expect(within(statusSummary).getAllByText(/^exhaustion$/i).length).toBeGreaterThan(0)
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

    expect(screen.getByRole('region', { name: /^actions$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^features$/i }))
    expect(screen.getByText(/action surge/i)).toBeInTheDocument()
    expect(screen.getByText(/take one additional action/i)).toBeInTheDocument()

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

  it('opens only the selected passive check or special sense', async () => {
    const user = userEvent.setup()
    const sheet = createSheet()
    const openPanel = vi.fn()
    sheet.reference.senses = [{ senseId: 'darkvision', label: 'Darkvision', value: '60 feet' }]

    renderWithAppProviders(<CharacterSheetOverview openPanel={openPanel} sheet={sheet} />)

    await user.click(screen.getByRole('button', { name: 'Inspect Passive Insight' }))
    expect(openPanel).toHaveBeenLastCalledWith({
      kind: 'SENSES',
      entry: {
        kind: 'PASSIVE',
        skillId: sheet.overview.skills.find((skill) => skill.label === 'Insight')?.skillId
      }
    })

    await user.click(screen.getByRole('button', { name: 'Inspect Darkvision' }))
    expect(openPanel).toHaveBeenLastCalledWith({
      kind: 'SENSES',
      entry: { kind: 'SENSE', senseId: 'darkvision' }
    })
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
        <CharacterSheetOverview sheet={sheet} showDefenses={false} />
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
    expect(within(combatSection as HTMLElement).queryByText('Defenses')).not.toBeInTheDocument()
    expect(
      within(combatSection as HTMLElement).getByRole('button', { name: /manage resistances/i })
    ).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText('Poison')).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText('Immunities')).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getByText('Vulnerabilities')).toBeInTheDocument()
    expect(within(combatSection as HTMLElement).getAllByText('None')).toHaveLength(2)
    expect(
      within(combatSection as HTMLElement).getByRole('button', { name: /long rest/i })
    ).toHaveAttribute('data-variant', 'default')
  })

  it('keeps defenses out of the mobile overview because they are managed from the header', () => {
    renderWithAppProviders(<CharacterSheetMobileStats sheet={createSheet()} />)

    expect(screen.queryByText(/^defenses$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/^senses$/i)).toBeInTheDocument()
  })

  it('labels the mobile conditions drawer close control', async () => {
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

      await user.click(screen.getByRole('button', { name: /manage conditions and exhaustion/i }))

      const dialog = await screen.findByRole('dialog', { name: /conditions & exhaustion/i })
      expect(
        within(dialog).getByRole('button', { name: /close conditions and exhaustion/i })
      ).toBeInTheDocument()
    } finally {
      restoreViewport()
    }
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

      expect(screen.getByRole('tablist')).toBeInTheDocument()
      expect(screen.getAllByText(/^Overview$/).length).toBeGreaterThan(0)
      expect(screen.getByRole('region', { name: /ability scores/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /saving throws/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /^skills$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /manage defenses/i })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /manage conditions and exhaustion/i })
      ).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /status summary/i })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /manage conditions and exhaustion/i }))
      const conditionsDialog = await screen.findByRole('dialog', {
        name: /conditions & exhaustion/i
      })
      expect(
        within(conditionsDialog).getByRole('combobox', { name: /add condition/i })
      ).toBeInTheDocument()
      expect(within(conditionsDialog).getAllByText(/^Exhaustion$/i).length).toBeGreaterThan(0)
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
        touches: [{ clientX: 320, clientY: 120 }],
        changedTouches: [{ clientX: 320, clientY: 120 }]
      })
      fireEvent.touchEnd(mobileViewport as HTMLElement, {
        changedTouches: [{ clientX: 220, clientY: 124 }]
      })
      expect(screen.getByRole('heading', { name: /^actions$/i, level: 2 })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /^resources$/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /open sheet section menu/i }))
      const sectionMenu = await screen.findByRole('navigation', { name: /sheet sections/i })
      expect(screen.queryByRole('button', { name: /^history$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^resources$/i })).not.toBeInTheDocument()

      await user.click(within(sectionMenu).getByRole('button', { name: /^skills$/i }))
      expect(screen.getAllByRole('heading', { name: /^skills$/i }).length).toBeGreaterThan(0)

      await user.click(await screen.findByRole('button', { name: /open sheet section menu/i }))
      await user.click(
        within(await screen.findByRole('navigation', { name: /sheet sections/i })).getByRole(
          'button',
          { name: /inventory/i }
        )
      )

      expect(
        await screen.findByRole('heading', { name: /^inventory$/i, level: 2 })
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /my inventory/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^carried$/i })).toBeInTheDocument()
    } finally {
      restoreViewport()
    }
  })
})
