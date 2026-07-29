import { describe, expect, it } from 'vitest'

import { getAffectedCharacterSheetPanelTargets } from './sheetPanelService.js'

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
