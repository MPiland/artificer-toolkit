import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConvexReactClient } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest'

import { renderWithAppProviders } from '#test/renderWithAppProviders'
import type { CharacterPreparationOptionsResponseDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { characterSheetFixture } from '../fixtures/characterSheet.fixtures'
import type { CharacterSheet } from '../core/CharacterSheet.types'
import { CharacterSheetFixtureView as CharacterSheetView } from '../fixtures/CharacterSheetFixtureView'
import { CharacterSheetExtras } from '../extras/CharacterSheetExtras'
import { CharacterSheetAdjustmentEditor } from './CharacterSheetAdjustmentEditor'
import { CharacterSheetExtraPanel } from './CharacterSheetExtraPanel'
import { CharacterSheetInspector } from './CharacterSheetInspector'
import { CharacterSheetItemPanelContent } from './CharacterSheetItemPanel'
import { CharacterSheetRulesPanel } from './CharacterSheetRulesPanel'
import { CharacterSheetSpellPanelContent } from './CharacterSheetSpellPanelContent'
import { CharacterSheetSpellCustomizationEditor } from './CharacterSheetSpellCustomizationEditor'
import { CharacterSheetSpellsPanelContent } from './CharacterSheetSpellsPanelContent'
import {
  abilityPanelFixture,
  astralTearItemPanelFixture,
  companionPanelFixture,
  itemPanelFixture,
  movementPanelFixture,
  savingThrowPanelFixture,
  sensesPanelFixture,
  spellPanelAttackDamageFixture,
  spellPanelFixture,
  spellPanelConfiguredCustomizationsFixture,
  spellsPanelFixture,
  vehiclePanelFixture
} from './inspector.fixtures'
import { getCharacterSheetPanelImageTarget } from './inspector.model'

function mockPanelQueries(
  panel: CharacterSheetPanelDto,
  preparation?: CharacterPreparationOptionsResponseDto
) {
  const read = (reference: Parameters<ConvexReactClient['query']>[0]) => {
    switch (getFunctionName(reference)) {
      case getFunctionName(api.characters.panels.get):
        return panel
      case getFunctionName(api.characters.preparationOptions.get):
        return preparation ?? null
      default:
        throw new Error(`Unconfigured native query: ${getFunctionName(reference)}`)
    }
  }
  vi.spyOn(ConvexReactClient.prototype, 'query').mockImplementation(async (...[reference]) =>
    read(reference)
  )
  const watch = vi
    .spyOn(ConvexReactClient.prototype, 'watchQuery')
    .mockImplementation((...[reference]) => ({
      localQueryResult: () => read(reference),
      journal: () => undefined,
      onUpdate: () => () => undefined
    }))
  return watch
}

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollIntoView'
)

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterAll(() => {
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoViewDescriptor)
  } else {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  }
})

describe('Character Sheet inspector', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(320)
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(400)
  })
  afterEach(() => vi.restoreAllMocks())

  it('maps authored domain panels to their active artwork', () => {
    expect(getCharacterSheetPanelImageTarget(spellPanelAttackDamageFixture)?.lookup).toMatchObject({
      subjectKind: 'SPELL',
      subjectId: spellPanelAttackDamageFixture.spellId,
      scope: 'ACTIVE'
    })
    expect(getCharacterSheetPanelImageTarget(itemPanelFixture)?.lookup).toMatchObject({
      subjectKind: 'EQUIPMENT',
      subjectId: itemPanelFixture.equipmentId
    })
    expect(getCharacterSheetPanelImageTarget(companionPanelFixture)?.lookup).toMatchObject({
      subjectKind: 'CREATURE',
      subjectId: companionPanelFixture.creatureId
    })
    expect(getCharacterSheetPanelImageTarget(vehiclePanelFixture)?.lookup).toMatchObject({
      subjectKind: 'VEHICLE',
      subjectId: vehiclePanelFixture.vehicleId
    })
    expect(getCharacterSheetPanelImageTarget(abilityPanelFixture)).toBeNull()
  })

  it('renders the aggregate Extras panel through the exhaustive rules-panel adapter', () => {
    const panel = {
      kind: 'EXTRAS',
      panelId: 'extras',
      characterId: 'character-owned',
      target: { kind: 'EXTRAS' },
      title: 'Extras',
      state: 'DEFAULT',
      editable: true,
      allowedCommands: ['ADD_EXTRA'],
      companionCount: 2,
      mountCount: 1,
      ownedCreatureCount: 3,
      vehicleCount: 1
    } satisfies CharacterSheetPanelDto

    renderWithAppProviders(
      <CharacterSheetRulesPanel
        expectedVersion={4}
        panel={panel}
        pending={false}
        submitCommand={vi.fn()}
        onTargetChange={vi.fn()}
      />
    )

    expect(screen.getByText('Total extras')).toBeVisible()
    expect(screen.getByText('7')).toBeVisible()
  })

  it('opens as an overlay from the existing ability card', async () => {
    const watch = mockPanelQueries(abilityPanelFixture)
    const user = userEvent.setup()

    renderWithAppProviders(
      <CharacterSheetView
        characterPublicId='character-owned'
        hasDraft={false}
        sheet={characterSheetFixture}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Inspect Strength ability' }))

    const inspector = await screen.findByRole('dialog', { name: 'Strength' })
    expect(inspector).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Astra Vale' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /save sheet/i })).not.toBeInTheDocument()
    expect(
      watch.mock.calls.every(
        ([reference]) => getFunctionName(reference) === getFunctionName(api.characters.panels.get)
      )
    ).toBe(true)
  })

  it('commits numeric fields on blur', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetAdjustmentEditor
        editor={abilityPanelFixture.editors[0]}
        pending={false}
        onClear={vi.fn().mockResolvedValue(true)}
        onCommit={onCommit}
      />
    )

    const input = screen.getByRole('textbox', { name: 'Other modifier' })
    await user.type(input, '3')
    await user.tab()

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 3
      })
    )
  })

  it('commits a sense range override as a typed length', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetRulesPanel
        expectedVersion={4}
        panel={sensesPanelFixture}
        pending={false}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Unit' }))
    await user.click(await screen.findByRole('option', { name: 'Yards' }))
    await user.type(screen.getByRole('textbox', { name: 'Override Darkvision range' }), '20')
    await user.tab()

    expect(submitCommand).toHaveBeenCalledTimes(1)
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPSERT_SHEET_ADJUSTMENT',
      expectedVersion: 4,
      adjustment: {
        family: 'SENSE',
        senseId: sensesPanelFixture.senses[0].senseId,
        field: 'RANGE_OVERRIDE',
        value: { amount: 20, unit: 'YARDS' }
      }
    })
  })

  describe('speed override', () => {
    const renderMovementPanel = () => {
      const submitCommand = vi.fn().mockResolvedValue(true)
      renderWithAppProviders(
        <CharacterSheetRulesPanel
          expectedVersion={4}
          panel={movementPanelFixture}
          pending={false}
          submitCommand={submitCommand}
          onTargetChange={vi.fn()}
        />
      )
      return submitCommand
    }

    it('shows each speed in its own unit and a speed the Character does not hold as not held', () => {
      renderMovementPanel()

      expect(screen.getByText('Walking: 10 yards')).toBeVisible()
      expect(screen.getByText('Swimming: not held. Set a speed to add it.')).toBeVisible()
    })

    it('commits an amount in the speed’s base unit without choosing one', async () => {
      const user = userEvent.setup()
      const submitCommand = renderMovementPanel()

      expect(screen.getAllByRole('combobox', { name: 'Unit' })[0]).toHaveValue('Yards')
      await user.type(screen.getByRole('textbox', { name: 'Override Walking speed' }), '30')
      await user.tab()

      expect(submitCommand).toHaveBeenCalledTimes(1)
      expect(submitCommand).toHaveBeenCalledWith({
        type: 'UPSERT_SHEET_ADJUSTMENT',
        expectedVersion: 4,
        adjustment: {
          family: 'MOVEMENT',
          speedId: movementPanelFixture.speeds[0].speedId,
          field: 'SPEED_OVERRIDE',
          value: { amount: 30, unit: 'YARDS' }
        }
      })
    })

    it('commits a speed for a Character with no base in the unit the player picks', async () => {
      const user = userEvent.setup()
      const submitCommand = renderMovementPanel()

      await user.click(screen.getAllByRole('combobox', { name: 'Unit' })[1])
      await user.click(await screen.findByRole('option', { name: 'Miles' }))
      await user.type(screen.getByRole('textbox', { name: 'Override Swimming speed' }), '2')
      await user.tab()

      expect(submitCommand).toHaveBeenCalledTimes(1)
      expect(submitCommand).toHaveBeenCalledWith({
        type: 'UPSERT_SHEET_ADJUSTMENT',
        expectedVersion: 4,
        adjustment: {
          family: 'MOVEMENT',
          speedId: movementPanelFixture.speeds[1].speedId,
          field: 'SPEED_OVERRIDE',
          value: { amount: 2, unit: 'MILES' }
        }
      })
    })
  })

  describe('sense override draft', () => {
    const overriddenSensesPanel = (
      amount: number
    ): Extract<CharacterSheetPanelDto, { kind: 'SENSES' }> => ({
      ...sensesPanelFixture,
      senses: [
        {
          ...sensesPanelFixture.senses[0],
          state: 'OVERRIDDEN',
          editor: {
            ...sensesPanelFixture.senses[0].editor,
            adjustmentId: '00000000-0000-0000-0000-0000000000a1',
            value: { amount, unit: 'FEET' }
          }
        }
      ]
    })
    const renderSensesPanel = (panel: Extract<CharacterSheetPanelDto, { kind: 'SENSES' }>) => (
      <CharacterSheetRulesPanel
        expectedVersion={4}
        panel={panel}
        pending={false}
        submitCommand={vi.fn().mockResolvedValue(true)}
        onTargetChange={vi.fn()}
      />
    )

    it('keeps typed text when a refetch returns an equal editor value', async () => {
      const user = userEvent.setup()
      const view = renderWithAppProviders(renderSensesPanel(overriddenSensesPanel(60)))

      const input = screen.getByRole('textbox', { name: 'Override Darkvision range' })
      await user.type(input, '5')
      expect(input).toHaveValue('605')

      view.rerender(renderSensesPanel(overriddenSensesPanel(60)))

      expect(screen.getByRole('textbox', { name: 'Override Darkvision range' })).toHaveValue('605')
    })

    it('shows a changed committed value', () => {
      const view = renderWithAppProviders(renderSensesPanel(overriddenSensesPanel(60)))

      view.rerender(renderSensesPanel(overriddenSensesPanel(90)))

      expect(screen.getByRole('textbox', { name: 'Override Darkvision range' })).toHaveValue('90')
    })
  })

  it('announces command failures inside the overlay', async () => {
    const watch = mockPanelQueries(abilityPanelFixture)

    renderWithAppProviders(
      <CharacterSheetInspector
        characterId='character-owned'
        commandError='The server rejected this change.'
        expectedVersion={4}
        pending={false}
        submitCommand={vi.fn().mockResolvedValue(false)}
        target={{ kind: 'ABILITY', ability: 'STRENGTH' }}
        onClose={vi.fn()}
        onTargetChange={vi.fn()}
      />
    )

    const inspector = await screen.findByRole('dialog', { name: 'Strength' })
    expect(
      within(inspector).getByRole('alert', {
        name: 'Character sheet update failed'
      })
    ).toHaveTextContent('The server rejected this change.')
    expect(
      watch.mock.calls.some(
        ([reference]) =>
          getFunctionName(reference) === getFunctionName(api.characters.sheetSlices.get)
      )
    ).toBe(false)
  })

  it('prepares a lazily discovered uncommitted Spell through the authoritative command', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const characterId = '00000000-0000-0000-0000-000000000001'
    const classId = '00000000-0000-0000-0000-000000000002'
    const spellId = '00000000-0000-0000-0000-000000000003'
    const panel = {
      kind: 'SPELLS',
      target: { kind: 'SPELLS' },
      panelId: 'spells',
      characterId,
      title: 'Manage spells',
      state: 'DEFAULT',
      editable: true,
      allowedCommands: ['SET_PREPARED_SPELLS'],
      slots: [],
      groups: []
    } satisfies CharacterSheetPanelDto

    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={panel}
        pending={false}
        preparationOptions={{
          characterId,
          streamVersion: 4,
          classes: [
            {
              classId,
              label: 'Cleric',
              preparedSpellLimit: 2,
              eligibleSpellIds: [spellId],
              preparedSpellIds: []
            }
          ],
          catalogue: { kind: 'INLINE', spells: [{ spellId, label: 'Healing Word', level: 1 }] }
        }}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
      />
    )

    const option = screen.getByRole('group', { name: 'Healing Word' })
    await user.click(within(option).getByRole('button', { name: 'Prepare' }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_PREPARED_SPELLS',
      expectedVersion: 4,
      classId,
      spellIds: [spellId]
    })
  })

  describe('spell level disclosure', () => {
    const characterId = '00000000-0000-0000-0000-000000000001'
    const classId = '00000000-0000-0000-0000-000000000002'
    type SpellGroups = Extract<CharacterSheetPanelDto, { kind: 'SPELLS' }>['groups']
    const knownGroup = (level: number, spellId: string, label: string): SpellGroups[number] => {
      const source = {
        spellId,
        sourceKind: 'CLASS' as const,
        sourceInstanceId: `CLASS:${classId}`
      }
      return {
        level,
        label: `Level ${level}`,
        sources: [
          {
            target: { kind: 'SPELL', source },
            source,
            spellId,
            label,
            sourceLabel: 'Known source',
            prepared: false,
            canPrepare: false,
            known: true,
            canManageKnown: true,
            knownClassId: classId,
            state: 'DEFAULT'
          }
        ]
      }
    }
    const view = (groups: SpellGroups) => (
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={{
          kind: 'SPELLS',
          target: { kind: 'SPELLS' },
          panelId: 'spells',
          characterId,
          title: 'Manage spells',
          state: 'DEFAULT',
          editable: true,
          allowedCommands: ['SET_KNOWN_SPELLS'],
          slots: [],
          groups
        }}
        pending={false}
        submitCommand={vi.fn().mockResolvedValue(true)}
        onTargetChange={vi.fn()}
      />
    )
    const magicMissile = knownGroup(1, '00000000-0000-0000-0000-000000000003', 'Magic Missile')
    const fireball = knownGroup(3, '00000000-0000-0000-0000-000000000004', 'Fireball')

    it('opens the level that gains its first held Spell', () => {
      const { rerender } = renderWithAppProviders(view([]))

      rerender(view([magicMissile]))

      expect(
        within(screen.getByRole('group', { name: 'Magic Missile' })).getByRole('button', {
          name: 'Forget'
        })
      ).toBeDefined()
    })

    it('keeps a level the player collapsed closed when another level appears', async () => {
      const user = userEvent.setup()
      const { rerender } = renderWithAppProviders(view([magicMissile]))
      expect(screen.getByRole('group', { name: 'Magic Missile' })).toBeDefined()

      await user.click(screen.getByRole('button', { name: 'Level 1' }))
      rerender(view([magicMissile, fireball]))

      expect(screen.getByRole('group', { name: 'Fireball' })).toBeDefined()
      expect(screen.queryByRole('group', { name: 'Magic Missile' })).toBeNull()
    })
  })

  it('keeps preparation options independent when another class already commits the Spell', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const characterId = '00000000-0000-0000-0000-000000000001'
    const preparingClassId = '00000000-0000-0000-0000-000000000002'
    const knownClassId = '00000000-0000-0000-0000-000000000003'
    const spellId = '00000000-0000-0000-0000-000000000004'
    const source = {
      spellId,
      sourceKind: 'CLASS' as const,
      sourceInstanceId: `CLASS:${knownClassId}`
    }
    const panel = {
      kind: 'SPELLS',
      target: { kind: 'SPELLS' },
      panelId: 'spells',
      characterId,
      title: 'Manage spells',
      state: 'DEFAULT',
      editable: true,
      allowedCommands: ['SET_PREPARED_SPELLS'],
      slots: [],
      groups: [
        {
          level: 1,
          label: 'Level 1',
          sources: [
            {
              target: { kind: 'SPELL', source },
              source,
              spellId,
              label: 'Shared Spell',
              sourceLabel: 'Known source',
              prepared: false,
              canPrepare: false,
              known: true,
              canManageKnown: true,
              knownClassId,
              state: 'DEFAULT'
            }
          ]
        }
      ]
    } satisfies CharacterSheetPanelDto

    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={panel}
        pending={false}
        preparationOptions={{
          characterId,
          streamVersion: 4,
          classes: [
            {
              classId: preparingClassId,
              label: 'Preparing source',
              preparedSpellLimit: 2,
              eligibleSpellIds: [spellId],
              preparedSpellIds: []
            }
          ],
          catalogue: { kind: 'INLINE', spells: [{ spellId, label: 'Shared Spell', level: 1 }] }
        }}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
      />
    )

    const preparingOption = within(
      screen.getByRole('region', { name: 'Eligible spells' })
    ).getByRole('group', { name: 'Shared Spell' })
    expect(preparingOption).toBeDefined()
    await user.click(within(preparingOption!).getByRole('button', { name: 'Prepare' }))

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_PREPARED_SPELLS',
      expectedVersion: 4,
      classId: preparingClassId,
      spellIds: [spellId]
    })
  })

  it('blocks whole-set preparation replacement when cached options are from an older stream', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const characterId = '00000000-0000-0000-0000-000000000001'
    const classId = '00000000-0000-0000-0000-000000000002'
    const spellId = '00000000-0000-0000-0000-000000000003'
    const source = {
      spellId,
      sourceKind: 'CLASS' as const,
      sourceInstanceId: `CLASS:${classId}`
    }
    const panel = {
      kind: 'SPELLS',
      target: { kind: 'SPELLS' },
      panelId: 'spells',
      characterId,
      title: 'Manage spells',
      state: 'DEFAULT',
      editable: true,
      allowedCommands: ['SET_PREPARED_SPELLS'],
      slots: [],
      groups: [
        {
          level: 1,
          label: 'Level 1',
          sources: [
            {
              target: { kind: 'SPELL', source },
              source,
              spellId,
              label: 'Prepared Spell',
              sourceLabel: 'Preparing source',
              prepared: true,
              canPrepare: true,
              preparationClassId: classId,
              known: false,
              canManageKnown: false,
              state: 'DEFAULT'
            }
          ]
        }
      ]
    } satisfies CharacterSheetPanelDto

    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={5}
        panel={panel}
        pending={false}
        preparationOptions={{
          characterId,
          streamVersion: 4,
          classes: [
            {
              classId,
              label: 'Preparing source',
              preparedSpellLimit: 2,
              eligibleSpellIds: [spellId],
              preparedSpellIds: [spellId]
            }
          ],
          catalogue: { kind: 'INLINE', spells: [{ spellId, label: 'Prepared Spell', level: 1 }] }
        }}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
      />
    )

    const unprepare = within(screen.getByRole('group', { name: 'Prepared Spell' })).getByRole(
      'button',
      { name: 'Unprepare' }
    )
    expect(unprepare).toBeDisabled()
    await user.click(unprepare)
    expect(submitCommand).not.toHaveBeenCalled()
  })

  it('loads preparation options only when the aggregate Spells inspector opens', async () => {
    const characterId = '00000000-0000-0000-0000-000000000001'
    const classId = '00000000-0000-0000-0000-000000000002'
    const spellId = '00000000-0000-0000-0000-000000000003'
    mockPanelQueries(
      {
        kind: 'SPELLS',
        target: { kind: 'SPELLS' },
        panelId: 'spells',
        characterId,
        title: 'Manage spells',
        state: 'DEFAULT',
        editable: true,
        allowedCommands: ['SET_PREPARED_SPELLS'],
        slots: [],
        groups: []
      },
      {
        characterId,
        streamVersion: 4,
        classes: [
          {
            classId,
            label: 'Cleric',
            preparedSpellLimit: 2,
            eligibleSpellIds: [spellId],
            preparedSpellIds: []
          }
        ],
        catalogue: { kind: 'INLINE', spells: [{ spellId, label: 'Healing Word', level: 1 }] }
      }
    )

    renderWithAppProviders(
      <CharacterSheetInspector
        characterId={characterId}
        expectedVersion={4}
        pending={false}
        submitCommand={vi.fn().mockResolvedValue(true)}
        target={{ kind: 'SPELLS' }}
        onClose={vi.fn()}
        onTargetChange={vi.fn()}
      />
    )

    expect(await screen.findByRole('group', { name: 'Healing Word' })).toBeVisible()
  })

  it('does not render preparation controls without a preparation capability', () => {
    const characterId = '00000000-0000-0000-0000-000000000001'
    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={{
          kind: 'SPELLS',
          target: { kind: 'SPELLS' },
          panelId: 'spells',
          characterId,
          title: 'Manage spells',
          state: 'DEFAULT',
          editable: true,
          allowedCommands: ['SET_PREPARED_SPELLS'],
          slots: [],
          groups: []
        }}
        pending={false}
        preparationOptions={{
          characterId,
          streamVersion: 4,
          classes: [],
          catalogue: { kind: 'INLINE', spells: [] }
        }}
        submitCommand={vi.fn()}
        onTargetChange={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /prepare/i })).not.toBeInTheDocument()
  })

  it('keeps offscreen prepared selections while paging a bounded list in the inspector scroll owner', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const characterId = '00000000-0000-4000-8000-000000000001'
    const classId = '00000000-0000-4000-8000-000000000002'
    const spells = Array.from({ length: 120 }, (_, index) => ({
      spellId: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
      label: `Spell ${String(index).padStart(3, '0')}`,
      level: 1
    }))
    renderWithAppProviders(
      <div role='dialog'>
        <CharacterSheetSpellsPanelContent
          expectedVersion={4}
          panel={{
            kind: 'SPELLS',
            target: { kind: 'SPELLS' },
            panelId: 'spells',
            characterId,
            title: 'Manage spells',
            state: 'DEFAULT',
            editable: true,
            allowedCommands: ['SET_PREPARED_SPELLS'],
            slots: [],
            groups: [
              {
                level: 1,
                label: 'Level 1',
                sources: spells.map((spell, index) => {
                  const source = {
                    spellId: spell.spellId,
                    sourceKind: 'CLASS' as const,
                    sourceInstanceId: `CLASS:${classId}`
                  }
                  return {
                    spellId: spell.spellId,
                    label: spell.label,
                    sourceLabel: 'Cleric',
                    source,
                    target: { kind: 'SPELL', source },
                    prepared: index === 119,
                    canPrepare: true,
                    preparationClassId: classId,
                    known: false,
                    canManageKnown: false,
                    state: 'DEFAULT'
                  } satisfies Extract<
                    CharacterSheetPanelDto,
                    { kind: 'SPELLS' }
                  >['groups'][number]['sources'][number]
                })
              }
            ]
          }}
          pending={false}
          preparationOptions={{
            characterId,
            streamVersion: 4,
            classes: [
              {
                classId,
                label: 'Cleric',
                preparedSpellLimit: 3,
                eligibleSpellIds: spells.map((spell) => spell.spellId),
                preparedSpellIds: [spells[119]!.spellId]
              }
            ],
            catalogue: { kind: 'INLINE', spells }
          }}
          submitCommand={submitCommand}
          onTargetChange={vi.fn()}
        />
      </div>
    )
    const region = screen.getByRole('region', { name: 'Eligible spells' })
    expect(within(region).getAllByRole('group').length).toBeLessThan(20)
    expect(within(region).queryByRole('group', { name: 'Spell 119' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('group').length).toBeLessThan(21)
    await user.click(
      within(screen.getByRole('group', { name: 'Spell 000' })).getByRole('button', {
        name: 'Prepare'
      })
    )
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_PREPARED_SPELLS',
      expectedVersion: 4,
      classId,
      spellIds: [spells[119]!.spellId, spells[0]!.spellId]
    })
    fireEvent.scroll(screen.getByRole('dialog'), { target: { scrollTop: 39 * 64 } })
    expect(await screen.findByRole('group', { name: 'Spell 040' })).toBeVisible()
    expect(within(region).getAllByRole('group').length).toBeLessThan(20)
    expect(screen.queryByRole('group', { name: 'Spell 000' })).not.toBeInTheDocument()
  })

  it('requires compact metadata for an unheld eligible panel source', () => {
    const group = spellsPanelFixture.groups[0]!
    const source = group.sources[0]!
    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={{
          ...spellsPanelFixture,
          groups: [
            {
              ...group,
              sources: [{ ...source, prepared: false, known: false, canManageKnown: false }]
            }
          ]
        }}
        pending={false}
        preparationOptions={{
          characterId: spellsPanelFixture.characterId,
          streamVersion: 4,
          classes: [
            {
              classId: source.preparationClassId!,
              label: 'Class spells',
              preparedSpellLimit: 3,
              eligibleSpellIds: [source.spellId],
              preparedSpellIds: []
            }
          ],
          catalogue: { kind: 'INLINE', spells: [] }
        }}
        submitCommand={vi.fn()}
        onTargetChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Prepare' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Preparation options are incomplete')
  })

  it('commits select changes immediately', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetAdjustmentEditor
        editor={savingThrowPanelFixture.proficiencyEditor}
        pending={false}
        onClear={vi.fn().mockResolvedValue(true)}
        onCommit={onCommit}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Proficiency' }))
    const option = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[role="option"][value="FULL"]')
      if (!element) throw new Error('Proficient option is not available')
      return element
    })
    await user.click(option)

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'FULL'
      })
    )
  })

  it('shows a field error when the server rejects an edit', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <CharacterSheetAdjustmentEditor
        editor={abilityPanelFixture.editors[0]}
        pending={false}
        onClear={vi.fn().mockResolvedValue(true)}
        onCommit={vi.fn().mockResolvedValue(false)}
      />
    )

    const input = screen.getByRole('textbox', { name: 'Other modifier' })
    await user.type(input, '2')
    await user.tab()

    expect(
      await screen.findByText('The adjustment could not be saved. The server value was restored.')
    ).toBeVisible()
    expect(input).toHaveValue('')
  })

  it('opens a contextual spell customization without persisting until its value commits', async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetSpellCustomizationEditor
        options={spellPanelAttackDamageFixture.customizationOptions}
        pending={false}
        onRemove={vi.fn().mockResolvedValue(true)}
        onSet={onSet}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Add customization' }))
    await user.click(await screen.findByRole('option', { hidden: true, name: 'Spell attack' }))

    expect(onSet).not.toHaveBeenCalled()
    const value = screen.getByRole('textbox', { name: 'Value' })
    await user.type(value, '7')
    await user.tab()

    expect(onSet).toHaveBeenCalledWith({
      category: 'TO_HIT',
      mode: 'BONUS',
      value: 7
    })
  })

  it('replaces an existing spell customization mode immediately with its value and note', async () => {
    const user = userEvent.setup()
    const onSet = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetSpellCustomizationEditor
        options={[spellPanelConfiguredCustomizationsFixture.customizationOptions[0]!]}
        pending={false}
        onRemove={vi.fn().mockResolvedValue(true)}
        onSet={onSet}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Mode' }))
    await user.click(await screen.findByRole('option', { hidden: true, name: 'Override' }))

    expect(onSet).toHaveBeenCalledWith({
      category: 'TO_HIT',
      mode: 'OVERRIDE',
      value: 2,
      sourceNote: 'Wand of the War Mage'
    })
  })

  it('commits owned-item resource, quantity, and removal commands immediately', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()
    const panel = {
      ...itemPanelFixture,
      facts: itemPanelFixture.facts.map((fact) =>
        fact.label === 'Quantity' ? { ...fact, value: '2' } : fact
      )
    }

    renderWithAppProviders(
      <CharacterSheetItemPanelContent
        expectedVersion={4}
        panel={panel}
        pending={false}
        submitCommand={submitCommand}
        onClose={onClose}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Use one Moon-Touched Longsword charges' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'USE_RESOURCE',
      expectedVersion: 4,
      resourceGrantId: itemPanelFixture.resources[0]!.id
    })

    await user.click(
      screen.getByRole('button', { name: 'Restore one Moon-Touched Longsword charges' })
    )
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'RESTORE_RESOURCE',
      expectedVersion: 4,
      resourceGrantId: itemPanelFixture.resources[0]!.id
    })

    await user.click(screen.getByRole('button', { name: 'Customize' }))
    await user.click(await screen.findByRole('button', { name: '−' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'UPDATE_INVENTORY_ITEM',
      expectedVersion: 4,
      itemId: itemPanelFixture.itemInstanceId,
      quantity: 1
    })

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(
      await screen.findByRole('dialog', { name: 'Remove Moon-Touched Longsword?' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove item' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'REMOVE_INVENTORY_ITEM',
      expectedVersion: 4,
      itemId: itemPanelFixture.itemInstanceId
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows one owned item pool and lets each charged feature spend it', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetItemPanelContent
        expectedVersion={4}
        panel={astralTearItemPanelFixture}
        pending={false}
        submitCommand={submitCommand}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('The Astral Tear Awakened charges')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    expect(screen.getByText('Resets: Dawn')).toBeInTheDocument()
    expect(screen.getByText('Warping Strike')).toBeInTheDocument()
    expect(screen.getByText('Spells')).toBeInTheDocument()
    expect(screen.getAllByText('1 charge · 2 / 3')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Use Warping Strike' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'USE_RESOURCE',
      expectedVersion: 4,
      resourceGrantId: astralTearItemPanelFixture.resources[0]!.id
    })

    await user.click(screen.getByRole('button', { name: 'Use Spells' }))
    expect(submitCommand).toHaveBeenLastCalledWith({
      type: 'USE_RESOURCE',
      expectedVersion: 4,
      resourceGrantId: astralTearItemPanelFixture.resources[0]!.id
    })
  })

  it('dispatches companion adjustments and resource commands', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)

    renderWithAppProviders(
      <CharacterSheetExtraPanel
        equipmentItems={[]}
        expectedVersion={4}
        panel={companionPanelFixture}
        pending={false}
        submitCommand={submitCommand}
        onClose={vi.fn()}
      />
    )

    const armorClass = screen.getByRole('textbox', { name: 'Override armor class' })
    await user.clear(armorClass)
    await user.type(armorClass, '13')
    await user.tab()
    expect(submitCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPSERT_SHEET_ADJUSTMENT',
        adjustment: expect.objectContaining({
          family: 'COMPANION',
          companionInstanceId: companionPanelFixture.companionInstanceId,
          field: 'ARMOR_CLASS_OVERRIDE',
          value: 13
        })
      })
    )

    const resourceControls = screen.getByText('Keen Sight').parentElement!.parentElement!
    await user.click(within(resourceControls).getByRole('button', { name: 'Use' }))
    await user.click(within(resourceControls).getByRole('button', { name: 'Restore' }))
    const hitDiceControls = screen.getByText('d8 hit dice').parentElement!.parentElement!
    await user.click(within(hitDiceControls).getByRole('button', { name: 'Use' }))
    await user.click(within(hitDiceControls).getByRole('button', { name: 'Restore' }))
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'USE_SHEET_RESOURCE',
      expectedVersion: 4,
      owner: companionPanelFixture.resources[0]!.target.owner
    })
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'RECOVER_SHEET_RESOURCE',
      expectedVersion: 4,
      owner: companionPanelFixture.resources[0]!.target.owner,
      trigger: 'MANUAL'
    })
    expect(submitCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_SHEET_EXTRA',
        extra: expect.objectContaining({ hitDice: [{ die: 8, total: 2, used: 2 }] })
      })
    )
    expect(submitCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_SHEET_EXTRA',
        extra: expect.objectContaining({ hitDice: [{ die: 8, total: 2, used: 0 }] })
      })
    )
  })

  it('shows another Spell source’s own name, not an unsaved edit from the previous source', async () => {
    const user = userEvent.setup()
    const spellFor = (sourceInstanceId: string, customName: string) => {
      const source = { ...spellPanelFixture.source, sourceInstanceId }
      return (
        <CharacterSheetSpellPanelContent
          expectedVersion={4}
          panel={{
            ...spellPanelFixture,
            source,
            target: { kind: 'SPELL', source },
            textEditors: spellPanelFixture.textEditors.map((editor) =>
              editor.field === 'CUSTOM_NAME' ? { ...editor, value: customName } : editor
            )
          }}
          pending={false}
          submitCommand={vi.fn().mockResolvedValue(true)}
        />
      )
    }
    const { rerender } = renderWithAppProviders(spellFor('CLASS:wizard', 'Darts'))
    await user.click(await screen.findByRole('button', { name: /Customize/ }))

    await user.type(await screen.findByLabelText('Custom name'), ' (spare)')
    rerender(spellFor('CLASS:sorcerer', 'Bolts'))

    expect(await screen.findByLabelText('Custom name')).toHaveValue('Bolts')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows another Companion’s own name, not an unsaved edit from the previous Companion', async () => {
    const user = userEvent.setup()
    const companionFor = (companionInstanceId: string, customName: string) => (
      <CharacterSheetExtraPanel
        equipmentItems={[]}
        expectedVersion={4}
        panel={{
          ...companionPanelFixture,
          companionInstanceId,
          textEditors: [
            {
              kind: 'TEXT',
              field: 'CUSTOM_NAME',
              label: 'Custom name',
              value: customName,
              multiline: false,
              maximumLength: 120,
              commitIntent: 'ON_BLUR_OR_ENTER'
            }
          ]
        }}
        pending={false}
        submitCommand={vi.fn().mockResolvedValue(true)}
        onClose={vi.fn()}
      />
    )
    const { rerender } = renderWithAppProviders(
      companionFor('00000000-0000-4000-8000-000000000501', 'Ferdinand')
    )

    await user.type(screen.getByLabelText('Custom name'), ' the Wise')
    rerender(companionFor('00000000-0000-4000-8000-000000000502', 'Hoot'))

    expect(screen.getByLabelText('Custom name')).toHaveValue('Hoot')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not render companion mutations without the matching permissions', () => {
    renderWithAppProviders(
      <CharacterSheetExtraPanel
        equipmentItems={[]}
        expectedVersion={4}
        panel={{ ...companionPanelFixture, editable: false, allowedCommands: [] }}
        pending={false}
        submitCommand={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Active on sheet')).toBeDisabled()
    expect(screen.getByLabelText('Current hit points')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Remove extra' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Override armor class' })).not.toBeInTheDocument()
    const resourceControls = screen.getByText('Keen Sight').parentElement!.parentElement!
    expect(within(resourceControls).getByRole('button', { name: 'Use' })).toBeDisabled()
    expect(within(resourceControls).getByRole('button', { name: 'Restore' })).toBeDisabled()
  })

  it('disables companion restore when manual recovery is unavailable', () => {
    renderWithAppProviders(
      <CharacterSheetExtraPanel
        equipmentItems={[]}
        expectedVersion={4}
        panel={{
          ...companionPanelFixture,
          resources: [
            {
              ...companionPanelFixture.resources[0]!,
              recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
            }
          ]
        }}
        pending={false}
        submitCommand={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const resourceControls = screen.getByText('Keen Sight').parentElement!.parentElement!
    expect(within(resourceControls).getByRole('button', { name: 'Restore' })).toBeDisabled()
  })

  it('uses backend extra labels without a misleading shared header', () => {
    const sheet: CharacterSheet = structuredClone(characterSheetFixture)
    sheet.extras = {
      kindOptions: [{ code: 'COMPANION', label: 'Companion' }],
      originOptions: [{ code: 'WORLD', label: 'World' }],
      items: [
        {
          id: companionPanelFixture.companionInstanceId,
          kind: 'COMPANION',
          kindLabel: 'Companion',
          creatureId: companionPanelFixture.creatureId,
          relationshipKind: 'COMPANION',
          relationshipLabel: 'Companion',
          originKind: 'WORLD',
          originLabel: 'World',
          authoredName: 'Owl',
          displayName: 'Ferdinand',
          customName: 'Ferdinand',
          isActive: true,
          armorClass: 11,
          speedLabel: 'Flying 60 feet',
          hitPoints: { current: 1, temp: 0, maximum: 1 },
          hitDice: [],
          actions: [],
          features: [],
          equipmentItemIds: []
        }
      ]
    }

    renderWithAppProviders(
      <CharacterSheetExtras pending={false} sheet={sheet} submitCommand={vi.fn()} />
    )

    expect(screen.getByText('Ferdinand (Owl)')).toBeInTheDocument()
    expect(screen.getByText('Flying 60 feet')).toBeInTheDocument()
    expect(screen.queryByText('Companion')).not.toBeInTheDocument()
    expect(screen.queryByText('Capacity')).not.toBeInTheDocument()
  })

  it('casts a summon with the form and Creature Type picked in the Spell panel (SPELLS-34.2)', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const summonOptions = {
      summonForms: [
        { id: 'form-bat', label: 'Bat' },
        { id: 'form-cat', label: 'Cat' }
      ],
      creatureTypes: [
        { id: 'type-celestial', label: 'Celestial' },
        { id: 'type-fey', label: 'Fey' }
      ]
    }
    renderWithAppProviders(
      <CharacterSheetSpellPanelContent
        expectedVersion={4}
        panel={{
          ...spellPanelFixture,
          legalCastModes: spellPanelFixture.legalCastModes.map((mode) => ({
            ...mode,
            ...summonOptions
          }))
        }}
        pending={false}
        submitCommand={submitCommand}
      />
    )

    await user.click(screen.getByLabelText('Summon form'))
    await user.click(await screen.findByRole('option', { name: 'Cat' }))
    await user.click(screen.getByRole('radio', { name: 'Fey' }))
    await user.click(screen.getAllByRole('button', { name: 'Cast' })[0]!)

    expect(submitCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CAST_SPELL',
        formId: 'form-cat',
        creatureTypeId: 'type-fey'
      })
    )
  })
})
