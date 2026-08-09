import { describe, expect, it, vi } from 'vitest'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type { CharacterBuilderResolution } from './builderService.js'
import { buildCharacterSheetPanel, getAffectedCharacterSheetPanelTargets } from './sheetPanelService.js'
import { characterSheetAdjustmentMatchesPanelTarget } from './sheetPanelTarget.js'

vi.mock('./sheetService.js', () => ({
  resolveCharacterSheetEngine: () => ({ spellMechanics: [] }),
  resolveCharacterSheetSkillKey: () => undefined
}))

describe('getAffectedCharacterSheetPanelTargets', () => {
  it('returns the owning item panel for owned-item and item-resource commands', () => {
    const itemId = '00000000-0000-4000-8000-000000000101'

    expect(
      getAffectedCharacterSheetPanelTargets({
        type: 'EQUIP_ITEM',
        commandId: '00000000-0000-4000-8000-000000000102',
        expectedVersion: 3,
        itemId
      })
    ).toEqual([{ kind: 'ITEM', itemInstanceId: itemId }])

    expect(
      getAffectedCharacterSheetPanelTargets({
        type: 'USE_SHEET_RESOURCE',
        commandId: '00000000-0000-4000-8000-000000000103',
        expectedVersion: 3,
        owner: {
          kind: 'ITEM_INSTANCE',
          chargeId: '00000000-0000-4000-8000-000000000104',
          itemInstanceId: itemId
        }
      })
    ).toEqual([{ kind: 'ITEM', itemInstanceId: itemId }])
  })
})

describe('known spell panel projection', () => {
  it('marks only Builder-selected class spell sources as manageable known spells', () => {
    const classId = '00000000-0000-4000-8000-000000000113'
    const source = {
      source: {
        spellId: '00000000-0000-0000-0020-005200000000',
        sourceKind: 'CLASS' as const,
        sourceInstanceId: 'class:wizard'
      },
      classId,
      label: 'Wizard',
      provenance: 'CLASS' as const,
      acquisition: 'KNOWN' as const,
      canPrepare: false,
      prepared: false
    }
    const inheritedSource = {
      ...source,
      source: {
        ...source.source,
        sourceKind: 'FEATURE' as const,
        sourceInstanceId: 'feature:innate'
      },
      classId: undefined,
      provenance: 'FEATURE' as const,
      acquisition: 'GRANTED' as const
    }
    const sheet = {
      spells: {
        slots: [],
        activeGroups: [],
        spells: [
          {
            id: source.source.spellId,
            label: 'Magic Missile',
            level: 1,
            sources: [source, inheritedSource]
          }
        ]
      }
    } as unknown as CharacterSheetResponseDto

    const panel = buildCharacterSheetPanel({
      character: { id: '00000000-0000-4000-8000-000000000101' } as CharacterAuthored,
      resolution: {} as CharacterBuilderResolution,
      sheet,
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      target: { kind: 'SPELLS' },
      editable: true
    })

    expect(panel.kind).toBe('SPELLS')
    if (panel.kind !== 'SPELLS') return
    expect(panel.allowedCommands).toContain('SET_KNOWN_SPELLS')
    expect(panel.groups[0]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: source.source,
          known: true,
          canManageKnown: true,
          knownClassId: classId
        }),
        expect.objectContaining({
          source: inheritedSource.source,
          known: false,
          canManageKnown: false
        })
      ])
    )
  })
})

describe('characterSheetAdjustmentMatchesPanelTarget', () => {
  const metadata = {
    id: '00000000-0000-4000-8000-000000000001',
    characterId: '00000000-0000-4000-8000-000000000002',
    createdBy: '00000000-0000-4000-8000-000000000003',
    updatedBy: '00000000-0000-4000-8000-000000000003',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z'
  }
  const passive = {
    ...metadata,
    family: 'PASSIVE',
    skillId: 'insight',
    field: 'TOTAL_OVERRIDE',
    value: 15
  } satisfies CharacterSheetAdjustment

  it('matches only the focused sense entry', () => {
    expect(
      characterSheetAdjustmentMatchesPanelTarget(passive, {
        kind: 'SENSES',
        entry: { kind: 'PASSIVE', skillId: 'insight' }
      })
    ).toBe(true)
    expect(
      characterSheetAdjustmentMatchesPanelTarget(passive, {
        kind: 'SENSES',
        entry: { kind: 'PASSIVE', skillId: 'perception' }
      })
    ).toBe(false)
  })
})
