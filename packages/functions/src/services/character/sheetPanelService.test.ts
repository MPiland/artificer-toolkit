import { describe, expect, it } from 'vitest'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type { CharacterBuilderResolution } from './builderService.js'
import {
  buildCharacterSheetPanel,
  getAffectedCharacterSheetPanelTargets
} from './sheetPanelService.js'
import { characterSheetAdjustmentMatchesPanelTarget } from './sheetPanelTarget.js'
import { createEmptyCharacterSheetRuleProjection } from './sheetTestFixtures.js'

const ruleProjection = createEmptyCharacterSheetRuleProjection()

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

describe('resource panel projection', () => {
  it('returns the exact policy-backed resource after a typed resource command', () => {
    const characterId = '00000000-0000-4000-8000-000000000101'
    const owner = {
      kind: 'AUTHORED_GRANT' as const,
      resourceGrantId: 'resource-1',
      source: {
        kind: 'SYSTEM' as const,
        systemId: '00000000-0000-4000-8000-000000000199'
      }
    }
    const resourceId = createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner))
    const sheet = {
      resources: {
        items: [
          {
            id: resourceId,
            owner,
            label: 'Second Wind',
            sourceLabel: 'Fighter',
            used: 1,
            max: 2,
            remaining: 1,
            recoveries: [{ trigger: 'SHORT_REST' as const, amount: { kind: 'ALL' as const } }]
          }
        ]
      }
    } as unknown as CharacterSheetResponseDto
    const character = { id: characterId } as CharacterAuthored
    const resolution = {} as CharacterBuilderResolution

    const panel = buildCharacterSheetPanel({
      character,
      resolution,
      sheet,
      ruleProjection,
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      target: { kind: 'RESOURCE', owner },
      editable: true
    })

    expect(panel).toMatchObject({
      kind: 'RESOURCE',
      panelId: `resource:${resourceId}`,
      owner,
      title: 'Second Wind',
      sourceLabel: 'Fighter',
      used: 1,
      maximum: 2,
      remaining: 1,
      allowedCommands: ['USE_RESOURCE', 'RECOVER_RESOURCE']
    })
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

    const character = {
      id: '00000000-0000-4000-8000-000000000101'
    } as CharacterAuthored
    const resolution = {
      sourceRegistry: {
        system: null,
        races: [],
        classes: [],
        backgrounds: [],
        equipment: [],
        features: []
      },
      registry: { equipment: [] }
    } as unknown as CharacterBuilderResolution
    const panel = buildCharacterSheetPanel({
      character,
      resolution,
      sheet,
      ruleProjection,
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

describe('campaign projection panel redaction', () => {
  it('does not expose private item customization through an item panel', () => {
    const character = {
      id: '00000000-0000-4000-8000-000000000101'
    } as CharacterAuthored
    const resolution = {
      registry: { equipment: [] },
      sourceRegistry: {
        system: null,
        races: [],
        classes: [],
        backgrounds: [],
        equipment: [],
        features: []
      }
    } as unknown as CharacterBuilderResolution
    const panel = buildCharacterSheetPanel({
      character,
      resolution,
      sheet: {
        inventory: {
          items: [
            {
              id: '00000000-0000-4000-8000-000000000102',
              equipmentId: '00000000-0000-4000-8000-000000000103',
              label: 'Longsword',
              equipmentLabel: 'Longsword',
              quantity: 1,
              equipped: false,
              attuned: false,
              requiresAttunement: false
            }
          ],
          currencies: [],
          containers: []
        },
        resources: { items: [] }
      } as unknown as CharacterSheetResponseDto,
      ruleProjection,
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      target: { kind: 'ITEM', itemInstanceId: '00000000-0000-4000-8000-000000000102' },
      editable: true
    })

    expect(panel).toMatchObject({ kind: 'ITEM', title: 'Longsword', displayName: 'Longsword' })
    expect(JSON.stringify(panel)).not.toContain('PRIVATE-SENTINEL')
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
