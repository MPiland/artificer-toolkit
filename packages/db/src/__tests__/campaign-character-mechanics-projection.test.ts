import { describe, expect, it } from 'vitest'

import {
  assertCurrentCampaignCharacterMechanicsProjection,
  CampaignCharacterMechanicsProjectionMismatchError,
  decideCampaignCharacterMechanicsProjectionPublication
} from '../repositories/campaignCharacterMechanicsProjection.js'
import { checksumCampaignCharacterMechanicsProjection } from '../utils/versionedProjectionChecksum.js'

const checksum = (value: string) => value.repeat(64)

function projectionCandidate() {
  return {
    kind: 'BASE_REFERENCE' as const,
    campaignId: 'campaign-1',
    characterId: 'character-1',
    characterStreamVersion: 4,
    baseMechanicsProjectionChecksum: checksum('a'),
    mechanicalContextChecksum: checksum('b'),
    manualMaximumModifierOwner: null,
    projectionSchemaVersion: 3,
    projectionChecksum: checksum('c'),
  }
}

describe('Campaign Character mechanics projection checksum', () => {
  it('is deterministic and binds the base mechanics and mechanical context identities', () => {
    const candidate = projectionCandidate()
    const projectionChecksum = checksumCampaignCharacterMechanicsProjection(candidate)

    expect(
      checksumCampaignCharacterMechanicsProjection({ ...candidate, projectionChecksum })
    ).toBe(projectionChecksum)
    expect(
      checksumCampaignCharacterMechanicsProjection({
        ...candidate,
        mechanicalContextChecksum: checksum('d')
      })
    ).not.toBe(projectionChecksum)
    expect(
      checksumCampaignCharacterMechanicsProjection({
        ...candidate,
        manualMaximumModifierOwner: 'CAMPAIGN'
      })
    ).not.toBe(projectionChecksum)
    expect(
      checksumCampaignCharacterMechanicsProjection({
        ...candidate,
        baseMechanicsProjectionChecksum: checksum('e')
      })
    ).not.toBe(projectionChecksum)
  })

  it('permits the same mechanical context to publish against an advanced Character base', () => {
    const existing = projectionCandidate()
    const candidate = {
      ...existing,
      characterStreamVersion: 5,
      baseMechanicsProjectionChecksum: checksum('d'),
      projectionChecksum: checksum('e')
    }

    expect(
      decideCampaignCharacterMechanicsProjectionPublication({
        candidate,
        existing,
        expectedPriorOverlayChecksum: existing.projectionChecksum
      })
    ).toBe('PUBLISH')
  })

  it('rejects a delayed publisher whose expected prior overlay no longer matches', () => {
    const existing = { ...projectionCandidate(), projectionChecksum: checksum('d') }
    const candidate = { ...projectionCandidate(), projectionChecksum: checksum('e') }

    expect(
      decideCampaignCharacterMechanicsProjectionPublication({
        candidate,
        existing,
        expectedPriorOverlayChecksum: checksum('c')
      })
    ).toBe('REJECT_EXPECTED_PRIOR')
  })

  it('rejects a live base checksum mismatch and an unexpected schema version', () => {
    const current = projectionCandidate()
    const currentInput = {
      current,
      expectedBaseMechanicsProjectionChecksum: current.baseMechanicsProjectionChecksum,
      expectedCharacterStreamVersion: current.characterStreamVersion,
      expectedMechanicalContextChecksum: current.mechanicalContextChecksum,
      expectedProjectionSchemaVersion: current.projectionSchemaVersion,
      liveBaseMechanicsProjectionChecksum: current.baseMechanicsProjectionChecksum,
      liveBaseStreamVersion: current.characterStreamVersion,
      liveCharacterStreamVersion: current.characterStreamVersion
    }

    expect(() =>
      assertCurrentCampaignCharacterMechanicsProjection({
        ...currentInput,
        liveBaseMechanicsProjectionChecksum: checksum('f')
      })
    ).toThrow(CampaignCharacterMechanicsProjectionMismatchError)
    expect(() =>
      assertCurrentCampaignCharacterMechanicsProjection({
        ...currentInput,
        expectedProjectionSchemaVersion: 4
      })
    ).toThrow(CampaignCharacterMechanicsProjectionMismatchError)
  })

})
