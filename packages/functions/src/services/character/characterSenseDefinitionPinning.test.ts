import { describe, expect, it, vi } from 'vitest'

import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { SenseReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/combatPerception'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const mocks = vi.hoisted(() => ({
  requireCurrent: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createReusableDefinitionRepository: () => ({ requireCurrent: mocks.requireCurrent })
}))

import { resolvePinnedCharacterSenseDefinitions } from './characterMechanicsCompiler.js'

const SYSTEM_ID = '00000000-0000-4000-8000-000000000401'
const SENSE_ID = '00000000-0000-4000-8000-000000000402'

function range(amount: number) {
  return {
    id: '00000000-0000-4000-8000-000000000403',
    amount,
    unit: 'FEET' as const,
    calculation: { base: amount, effective: amount, contributions: [], override: null }
  }
}

function current(
  overrides: Partial<ReusableDefinitionCurrentDto> = {}
): ReusableDefinitionCurrentDto {
  const document: SenseReusableDefinitionDocumentDto = {
    schemaVersion: 1 as const,
    kind: 'SENSE' as const,
    id: SENSE_ID,
    gameSystemId: SYSTEM_ID,
    capabilities: [
      {
        channel: 'VISUAL' as const,
        accessGrade: 'PRECISE' as const,
        satisfies: ['SEE'],
        illuminationAccess: 'ORDINARY_DARKNESS' as const,
        obscurementAccess: 'IGNORE' as const,
        perceivesInvisible: false,
        physicalConstraints: []
      }
    ]
  }
  return {
    id: SENSE_ID,
    gameSystemId: SYSTEM_ID,
    contentSourceId: '00000000-0000-4000-8000-000000000404',
    definitionFamilyKey: 'sense',
    label: 'Night sight',
    description: null,
    document,
    checksum: checksumRuleDocument(document),
    contractVersion: 1,
    version: 3,
    publishedAt: '2026-08-27T00:00:00.000Z',
    publishedBy: '00000000-0000-4000-8000-000000000405',
    ...overrides
  }
}

describe('resolvePinnedCharacterSenseDefinitions', () => {
  it('pins one exact current same-System document per final sense', async () => {
    const definition = current()
    mocks.requireCurrent.mockResolvedValueOnce(definition)

    await expect(
      resolvePinnedCharacterSenseDefinitions({
        db: {} as never,
        gameSystemId: SYSTEM_ID,
        senses: [{ senseDefinitionId: SENSE_ID, range: range(60) }]
      })
    ).resolves.toEqual([
      {
        senseDefinitionId: SENSE_ID,
        definitionVersion: 3,
        definitionContractVersion: 1,
        definitionChecksum: definition.checksum,
        document: definition.document,
        range: range(60)
      }
    ])
    expect(mocks.requireCurrent).toHaveBeenCalledTimes(1)
    expect(mocks.requireCurrent).toHaveBeenCalledWith(SENSE_ID)
  })

  it('fails closed before pinning for a non-sense or checksum-mismatched definition', async () => {
    mocks.requireCurrent.mockResolvedValueOnce(current({ definitionFamilyKey: 'effect' }))
    await expect(
      resolvePinnedCharacterSenseDefinitions({
        db: {} as never,
        gameSystemId: SYSTEM_ID,
        senses: [{ senseDefinitionId: SENSE_ID, range: range(60) }]
      })
    ).rejects.toThrow(/same-System sense document/i)

    mocks.requireCurrent.mockResolvedValueOnce(current({ checksum: 'a'.repeat(64) }))
    await expect(
      resolvePinnedCharacterSenseDefinitions({
        db: {} as never,
        gameSystemId: SYSTEM_ID,
        senses: [{ senseDefinitionId: SENSE_ID, range: range(60) }]
      })
    ).rejects.toThrow(/checksum/i)
  })
})
