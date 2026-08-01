import { describe, expect, it } from 'vitest'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'

import { getAffectedCharacterSheetPanelTargets } from './sheetPanelService.js'
import { characterSheetAdjustmentMatchesPanelTarget } from './sheetPanelTarget.js'

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
