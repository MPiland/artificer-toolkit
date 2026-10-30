import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import type { CharacterPreparationOptionsResponseDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import { characterSheetFixture } from '../fixtures/characterSheet.fixtures'
import { CharacterSheetSpellsPanelContent } from '../inspector/CharacterSheetSpellsPanelContent'
import { spellsPanelFixture } from '../inspector/inspector.fixtures'
import { createSheet } from '../tests/sheetTestHarness'
import { CharacterSheetSpells } from './CharacterSheetSpells'

describe('Character Sheet spells', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(320)
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(400)
  })
  afterEach(() => vi.restoreAllMocks())
  it('keeps preparation disabled until a spellbook spell is learned', async () => {
    const submitCommand = vi.fn()
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
              sources: [
                {
                  ...source,
                  prepared: false,
                  known: false,
                  canManageKnown: true,
                  knownClassId: source.preparationClassId
                }
              ]
            }
          ]
        }}
        pending={false}
        preparationOptions={{
          characterId: spellsPanelFixture.characterId,
          streamVersion: 4,
          classes: [],
          catalogue: { kind: 'INLINE', spells: [] }
        }}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
      />
    )
    const prepare = screen.getByRole('button', { name: 'Prepare' })
    expect(prepare).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Learn' })).toBeEnabled()
    await userEvent.setup().click(prepare)
    expect(submitCommand).not.toHaveBeenCalled()
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
    const preparationOptions: CharacterPreparationOptionsResponseDto = {
      characterId: panel.characterId,
      streamVersion: 4,
      classes: [
        {
          classId: source.preparationClassId!,
          label: 'Wizard',
          preparedSpellLimit: 20,
          eligibleSpellIds: [source.spellId],
          preparedSpellIds: []
        }
      ],
      catalogue: {
        kind: 'INLINE',
        spells: [{ spellId: source.spellId, label: source.label, level: panel.groups[0]!.level }]
      }
    }

    renderWithAppProviders(
      <CharacterSheetSpellsPanelContent
        expectedVersion={4}
        panel={panel}
        pending={false}
        preparationOptions={preparationOptions}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
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
        preparationOptions={{
          ...preparationOptions,
          classes: [{ ...preparationOptions.classes[0]!, preparedSpellIds: [source.spellId] }]
        }}
        submitCommand={submitCommand}
        onTargetChange={vi.fn()}
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
      />
    )

    expect(screen.queryByRole('button', { name: /^prepare$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^unprepare$/i })).not.toBeInTheDocument()
  })

  it('forgets a known spell while preserving the other known spells for its class', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const first = spellsPanelFixture.groups[0]!.sources[0]!
    const second = {
      ...first,
      spellId: '33333333-3333-3333-3333-333333333333',
      label: 'Shield',
      known: true,
      canPrepare: false,
      canManageKnown: true,
      knownClassId: '00000000-0000-4000-8000-000000000113',
      prepared: false,
      preparationClassId: undefined
    }
    const panel = {
      ...spellsPanelFixture,
      groups: [
        {
          ...spellsPanelFixture.groups[0]!,
          sources: [
            {
              ...first,
              spellId: '22222222-2222-2222-2222-222222222222',
              label: 'Magic Missile',
              known: true,
              canPrepare: false,
              canManageKnown: true,
              knownClassId: '00000000-0000-4000-8000-000000000113',
              prepared: false,
              preparationClassId: undefined
            },
            second
          ]
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
      />
    )

    await user.click(screen.getAllByRole('button', { name: /^forget$/i })[0]!)

    expect(submitCommand).toHaveBeenCalledWith({
      type: 'SET_KNOWN_SPELLS',
      classId: '00000000-0000-4000-8000-000000000113',
      spellIds: ['33333333-3333-3333-3333-333333333333'],
      expectedVersion: 4
    })
  })

  it('does not render known-spell controls for inherent spell sources', () => {
    const source = spellsPanelFixture.groups[0]!.sources[0]!
    const panel = {
      ...spellsPanelFixture,
      groups: [
        {
          ...spellsPanelFixture.groups[0]!,
          sources: [
            {
              ...source,
              source: {
                ...source.source,
                sourceKind: 'FEATURE' as const,
                sourceInstanceId: 'feature:innate-spell'
              },
              target: {
                kind: 'SPELL' as const,
                source: {
                  ...source.source,
                  sourceKind: 'FEATURE' as const,
                  sourceInstanceId: 'feature:innate-spell'
                }
              },
              canPrepare: false,
              known: true,
              canManageKnown: false,
              preparationClassId: undefined,
              knownClassId: undefined
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
        submitCommand={vi.fn()}
        onTargetChange={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /^learn$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^forget$/i })).not.toBeInTheDocument()
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

  it('labels ritual-only spell actions without requiring a spell slot', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn().mockResolvedValue(true)
    const sheet = createSheet()
    const spellId = '77777777-7777-7777-7777-777777777777'
    const source = {
      spellId,
      sourceKind: 'FEATURE' as const,
      sourceInstanceId: 'feature:magic-item-analysis'
    }
    sheet.spells.spells = [
      {
        id: spellId,
        label: 'Detect Magic',
        level: 1,
        sources: [
          {
            id: 'ritual-source',
            source,
            label: 'Magic Item Analysis',
            provenance: 'FEATURE',
            acquisition: 'KNOWN',
            castMode: 'RITUAL',
            canPrepare: false,
            prepared: false
          }
        ]
      }
    ]
    sheet.spells.activeGroups = [
      {
        level: 1,
        label: 'Level 1',
        entries: [
          {
            rowId: 'row-detect-magic',
            target: { kind: 'SPELL', source, castLevel: 1 },
            spellId,
            source,
            sourceId: 'ritual-source',
            sourceLabel: 'Magic Item Analysis',
            castLevel: 1,
            displayName: 'Detect Magic',
            available: true,
            cast: { spellId, sourceId: 'ritual-source' }
          }
        ]
      }
    ]

    renderWithAppProviders(
      <CharacterSheetSpells pending={false} sheet={sheet} submitCommand={submitCommand} />
    )

    await user.click(
      screen.getByRole('button', {
        name: /cast ritual detect magic from magic item analysis at level 1/i
      })
    )
    expect(submitCommand).toHaveBeenCalledWith({
      type: 'CAST_SPELL',
      spellId,
      sourceId: 'ritual-source',
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
})
