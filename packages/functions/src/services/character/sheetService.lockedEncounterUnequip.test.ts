import type { DBLike } from '@artificer-toolkit/db'
import { describe, expect, it } from 'vitest'

import {
  executeLockedEncounterCharacterUnequip,
  type LockedEncounterCharacterUnequipCapability
} from './sheetService.js'

const capability: LockedEncounterCharacterUnequipCapability = {
  encounterId: '00000000-0000-4000-8000-000000000701',
  campaignId: '00000000-0000-4000-8000-000000000702',
  characterId: '00000000-0000-4000-8000-000000000703',
  actorUserId: '00000000-0000-4000-8000-000000000704',
  liveSessionAuthority: {
    sessionId: '00000000-0000-4000-8000-000000000705',
    authorityId: 'authority-1'
  },
  expectedCharacterStreamVersion: 3,
  expectedMechanicsProjectionChecksum: 'a'.repeat(64),
  expectedCampaignOverlayChecksum: 'b'.repeat(64),
  commandId: '00000000-0000-4000-8000-000000000706',
  sourceCommandId: '00000000-0000-4000-8000-000000000707',
  occurrenceId: '00000000-0000-4000-8000-000000000708',
  command: {
    type: 'UNEQUIP_ITEM',
    commandId: '00000000-0000-4000-8000-000000000706',
    expectedVersion: 3,
    itemId: '00000000-0000-4000-8000-000000000709'
  },
  campaignContext: {
    viewer: 'CAMPAIGN_OWNER',
    campaignId: '00000000-0000-4000-8000-000000000702',
    campaignStatus: 'ACTIVE',
    contentMaturity: null,
    attunementSlotOverride: null,
    adjustments: [],
    secretAdjustmentIds: new Set(),
    conditions: []
  }
}

describe('executeLockedEncounterCharacterUnequip', () => {
  it('rejects a non-UNEQUIP command at the internal wrapper boundary', async () => {
    const invalidCapability = {
      ...capability,
      command: {
        type: 'SET_INSPIRATION',
        commandId: capability.commandId,
        expectedVersion: 3,
        inspired: false
      }
    } as unknown as LockedEncounterCharacterUnequipCapability

    await expect(
      executeLockedEncounterCharacterUnequip({
        db: {} as DBLike,
        capability: invalidCapability
      })
    ).rejects.toThrow('locked Encounter Sheet command is invalid')
  })

  it('rejects a capability whose sealed command does not match its child command ID', async () => {
    await expect(
      executeLockedEncounterCharacterUnequip({
        db: {} as DBLike,
        capability: { ...capability, commandId: '00000000-0000-4000-8000-000000000710' }
      })
    ).rejects.toThrow('locked Encounter Sheet command is invalid')
  })
})
