import { describe, expect, it } from 'vitest'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  combatPerceptionContributionDtoSchema,
  combatPerceptionContributionsDtoSchema
} from '../shared/combatPerception.js'

const ids = {
  contribution: '00000000-0000-4000-8000-000000000101',
  contributionTwo: '00000000-0000-4000-8000-000000000102',
  system: '00000000-0000-4000-8000-000000000103',
  sense: '00000000-0000-4000-8000-000000000104',
  otherSense: '00000000-0000-4000-8000-000000000105'
}

function senseGrant() {
  const document = {
    schemaVersion: 1 as const,
    kind: 'SENSE' as const,
    id: ids.sense,
    gameSystemId: ids.system,
    capabilities: [
      {
        channel: 'VISUAL' as const,
        accessGrade: 'PRECISE' as const,
        satisfies: ['SEE' as const],
        illuminationAccess: 'ORDINARY_DARKNESS' as const,
        obscurementAccess: 'NONE' as const,
        perceivesInvisible: false,
        physicalConstraints: []
      }
    ]
  }
  return {
    id: ids.contribution,
    order: 0,
    kind: 'SENSE_GRANT' as const,
    senseDefinitionId: ids.sense,
    definitionVersion: 1,
    definitionContractVersion: 1,
    definitionChecksum: checksumRuleDocument(document),
    document,
    range: { amount: 60, unit: 'FEET' as const }
  }
}

describe('combat perception contribution contracts', () => {
  it('round-trips every closed contribution arm', () => {
    const contributions = combatPerceptionContributionsDtoSchema.parse([
      senseGrant(),
      {
        id: ids.contributionTwo,
        order: 1,
        kind: 'SENSE_SUPPRESS',
        senseDefinitionIds: [ids.otherSense],
        channels: ['AUDITORY']
      },
      {
        id: '00000000-0000-4000-8000-000000000106',
        order: 2,
        kind: 'ACCESS_LIMIT',
        channels: ['VISUAL'],
        maximumAccessGrade: 'LOCATED',
        maximumIlluminationAccess: null,
        maximumObscurementAccess: null,
        perceivesInvisible: null
      },
      {
        id: '00000000-0000-4000-8000-000000000107',
        order: 3,
        kind: 'EMISSION_SUPPRESS',
        channels: ['VISUAL'],
        bypass: 'INVISIBILITY'
      },
      {
        id: '00000000-0000-4000-8000-000000000108',
        order: 4,
        kind: 'ILLUMINATION_EFFECT',
        illumination: 'MAGICAL_DARKNESS',
        obscurement: 'HEAVY',
        precedence: 10
      }
    ])

    expect(contributions).toHaveLength(5)
    expect(contributions[0]).toMatchObject(senseGrant())
  })

  it('rejects malformed, duplicate, unsorted, and cross-identity contributions', () => {
    expect(() =>
      combatPerceptionContributionDtoSchema.parse({
        ...senseGrant(),
        document: { ...senseGrant().document, id: ids.otherSense }
      })
    ).toThrow()
    expect(() =>
      combatPerceptionContributionDtoSchema.parse({
        ...senseGrant(),
        definitionChecksum: 'f'.repeat(64)
      })
    ).toThrow()
    expect(() =>
      combatPerceptionContributionsDtoSchema.parse([senseGrant(), { ...senseGrant(), order: 1 }])
    ).toThrow()
    expect(() =>
      combatPerceptionContributionsDtoSchema.parse([
        { ...senseGrant(), order: 1 },
        { ...senseGrant(), id: ids.contributionTwo, order: 0 }
      ])
    ).toThrow()
    expect(() =>
      combatPerceptionContributionDtoSchema.parse({
        id: ids.contribution,
        order: 0,
        kind: 'ACCESS_LIMIT',
        channels: ['VISUAL'],
        maximumAccessGrade: null,
        maximumIlluminationAccess: null,
        maximumObscurementAccess: null,
        perceivesInvisible: null
      })
    ).toThrow()
  })
})
