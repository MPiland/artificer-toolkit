import { describe, expect, it } from 'vitest'

import {
  MAX_COMBAT_PERCEPTION_CAPABILITY_INSTANCES,
  resolveCombatPerception,
  resolveCombatPerceptionWithContributions,
  type CombatPerceptionContribution,
  type CombatPerceptionContributionSource,
  type CombatPerceptionSenseDefinitionDocument
} from '../domains/rules/combatPerception.js'
import { checksumRuleDocument } from '../domains/rules/checksum.js'

const visualDefinitionId = '11111111-1111-4111-8111-111111111111'
const otherDefinitionId = '22222222-2222-4222-8222-222222222222'
const seededDefinitionId = '00000000-0000-0000-0000-000000000001'
const instanceId = '33333333-3333-4333-8333-333333333333'
const checksum = 'a'.repeat(64)
const otherChecksum = 'b'.repeat(64)

function source(
  contribution: CombatPerceptionContribution,
  overrides: Partial<Omit<CombatPerceptionContributionSource, 'contribution'>> = {}
): CombatPerceptionContributionSource {
  return {
    instanceId: contribution.id,
    source: {
      kind: 'ACTIVE_EFFECT',
      activeEffectId: '44444444-4444-4444-8444-444444444444',
      activeEffectVersion: 1,
      activeEffectDefinitionChecksum: otherChecksum
    },
    sourceOrdinal: 1,
    contribution,
    ...overrides
  }
}

function senseDocument(
  overrides: Partial<CombatPerceptionSenseDefinitionDocument> = {}
): CombatPerceptionSenseDefinitionDocument {
  return {
    schemaVersion: 1,
    kind: 'SENSE',
    id: otherDefinitionId,
    gameSystemId: seededDefinitionId,
    capabilities: [
      {
        channel: 'AUDITORY',
        accessGrade: 'PRECISE',
        satisfies: ['DETECT', 'LOCATE', 'PRECISE'],
        illuminationAccess: 'IGNORE',
        obscurementAccess: 'IGNORE',
        perceivesInvisible: false,
        physicalConstraints: []
      }
    ],
    ...overrides
  }
}

function environment(overrides = {}) {
  return {
    distance: 30,
    lineOfEffect: true,
    sharedSurface: true,
    illumination: 'ORDINARY_DARKNESS' as const,
    obscurement: 'NONE' as const,
    invisibleChannels: [] as const,
    suppressedChannels: [] as const,
    ...overrides
  }
}

function capability(overrides = {}) {
  return {
    instanceId,
    definitionId: visualDefinitionId,
    checksum,
    capabilityOrdinal: 0,
    range: 60,
    capability: {
      channel: 'VISUAL' as const,
      accessGrade: 'PRECISE' as const,
      satisfies: ['SEE'] as const,
      illuminationAccess: 'ORDINARY_DARKNESS' as const,
      obscurementAccess: 'LIGHT' as const,
      perceivesInvisible: false,
      physicalConstraints: ['LINE_OF_EFFECT'] as const
    },
    ...overrides
  }
}

describe('combat perception', () => {
  it('resolves arbitrary UUID-backed visual, nonvisual, vibration, and high-access configurations', () => {
    expect(
      resolveCombatPerception({
        requirement: 'SEE',
        environment: environment({ illumination: 'BRIGHT' }),
        capabilities: [
          capability({
            capability: { ...capability().capability, illuminationAccess: 'BRIGHT_ONLY' }
          })
        ]
      }).satisfied
    ).toBe(true)
    expect(
      resolveCombatPerception({
        requirement: 'SEE',
        environment: environment({ invisibleChannels: ['NONVISUAL'], obscurement: 'HEAVY' }),
        capabilities: [
          capability({
            capability: {
              ...capability().capability,
              channel: 'NONVISUAL',
              illuminationAccess: 'IGNORE',
              obscurementAccess: 'IGNORE',
              perceivesInvisible: true
            }
          })
        ]
      }).satisfied
    ).toBe(true)
    expect(
      resolveCombatPerception({
        requirement: 'LOCATE',
        environment: environment({ sharedSurface: true, invisibleChannels: ['VIBRATION'] }),
        capabilities: [
          capability({
            capability: {
              ...capability().capability,
              channel: 'VIBRATION',
              accessGrade: 'LOCATED',
              satisfies: ['LOCATE'],
              illuminationAccess: 'IGNORE',
              obscurementAccess: 'IGNORE',
              perceivesInvisible: true,
              physicalConstraints: ['SHARED_SURFACE']
            }
          })
        ]
      }).satisfied
    ).toBe(true)
    expect(
      resolveCombatPerception({
        requirement: 'SEE',
        environment: environment({
          illumination: 'MAGICAL_DARKNESS',
          obscurement: 'HEAVY',
          invisibleChannels: ['VISUAL']
        }),
        capabilities: [
          capability({
            capability: {
              ...capability().capability,
              illuminationAccess: 'MAGICAL_DARKNESS',
              obscurementAccess: 'HEAVY',
              perceivesInvisible: true
            }
          })
        ]
      }).satisfied
    ).toBe(true)
  })

  it('returns closed negative reasons for range, suppression, physical constraints, invisibility, and environment', () => {
    const result = resolveCombatPerception({
      requirement: 'SEE',
      environment: environment({
        distance: 61,
        lineOfEffect: false,
        invisibleChannels: ['VISUAL'],
        illumination: 'MAGICAL_DARKNESS',
        obscurement: 'HEAVY',
        suppressedChannels: ['VISUAL']
      }),
      capabilities: [capability()]
    })
    expect(result).toMatchObject({ satisfied: false })
    expect(result.rejected[0]?.reasons).toEqual([
      'CHANNEL_SUPPRESSED',
      'OUT_OF_RANGE',
      'LINE_OF_EFFECT_REQUIRED',
      'INVISIBLE_SUBJECT',
      'ILLUMINATION_INSUFFICIENT',
      'OBSCUREMENT_INSUFFICIENT'
    ])
    expect(
      resolveCombatPerception({
        requirement: 'LOCATE',
        environment: environment({ sharedSurface: false }),
        capabilities: [
          capability({
            capability: {
              ...capability().capability,
              channel: 'VIBRATION',
              accessGrade: 'LOCATED',
              satisfies: ['LOCATE'],
              illuminationAccess: 'IGNORE',
              obscurementAccess: 'IGNORE',
              physicalConstraints: ['SHARED_SURFACE']
            }
          })
        ]
      }).rejected[0]?.reasons
    ).toContain('SHARED_SURFACE_REQUIRED')
  })

  it('orders exact identities deterministically and rejects duplicate identities or malformed range data', () => {
    const lower = capability({ definitionId: otherDefinitionId, capabilityOrdinal: 2 })
    const higher = capability({ definitionId: visualDefinitionId, capabilityOrdinal: 1 })
    expect(
      resolveCombatPerception({
        requirement: 'SEE',
        environment: environment(),
        capabilities: [higher, lower]
      }).qualifying
    ).toEqual([
      { instanceId, definitionId: visualDefinitionId, checksum, capabilityOrdinal: 1 },
      { instanceId, definitionId: otherDefinitionId, checksum, capabilityOrdinal: 2 }
    ])
    expect(() =>
      resolveCombatPerception({
        requirement: 'SEE',
        environment: environment(),
        capabilities: [higher, higher]
      })
    ).toThrow(/identities must be unique/)
    expect(() =>
      resolveCombatPerception({
        requirement: 'SEE',
        environment: environment(),
        capabilities: [capability({ range: Number.NaN })]
      })
    ).toThrow(/range must be null or a finite nonnegative number/)
    expect(
      resolveCombatPerception({
        requirement: 'SEE',
        environment: environment(),
        capabilities: [capability({ definitionId: seededDefinitionId.toUpperCase() })]
      }).qualifying
    ).toEqual([{ instanceId, definitionId: seededDefinitionId, checksum, capabilityOrdinal: 0 }])
  })

  it('fails closed before qualification for malformed capability and environment values', () => {
    const invalidInputs: readonly unknown[] = [
      {
        requirement: 'SEE',
        environment: environment(),
        capabilities: [
          capability({ capability: { ...capability().capability, accessGrade: 'UNKNOWN' } })
        ]
      },
      {
        requirement: 'SEE',
        environment: environment(),
        capabilities: [
          capability({
            capability: { ...capability().capability, illuminationAccess: 'UNKNOWN' }
          })
        ]
      },
      {
        requirement: 'SEE',
        environment: environment(),
        capabilities: [
          capability({ capability: { ...capability().capability, obscurementAccess: 'UNKNOWN' } })
        ]
      },
      {
        requirement: 'UNKNOWN',
        environment: environment(),
        capabilities: [capability()]
      },
      {
        requirement: 'SEE',
        environment: environment({ suppressedChannels: ['UNKNOWN'] }),
        capabilities: [capability()]
      },
      {
        requirement: 'SEE',
        environment: environment({ illumination: 'UNKNOWN' }),
        capabilities: [capability()]
      },
      {
        requirement: 'SEE',
        environment: environment({ obscurement: 'UNKNOWN', lineOfEffect: 'true' }),
        capabilities: [
          capability({
            capability: { ...capability().capability, physicalConstraints: ['UNKNOWN'] }
          })
        ]
      },
      {
        requirement: 'SEE',
        environment: environment({ extra: true }),
        capabilities: [capability()]
      },
      {
        requirement: 'SEE',
        environment: environment(),
        capabilities: [capability({ extra: true })]
      },
      {
        requirement: 'SEE',
        environment: environment(),
        capabilities: [
          capability({
            capability: {
              ...capability().capability,
              accessGrade: 'DETECTED',
              satisfies: ['SEE']
            }
          })
        ]
      },
      {
        requirement: 'SEE',
        environment: environment(),
        capabilities: Array.from({ length: MAX_COMBAT_PERCEPTION_CAPABILITY_INSTANCES + 1 }, () =>
          capability()
        )
      }
    ]

    for (const input of invalidInputs) {
      expect(() => resolveCombatPerception(input as never)).toThrow()
    }
  })

  it('makes invisibility channel-specific while hard suppression remains non-bypassable', () => {
    const auditory = capability({
      instanceId: '33333333-3333-4333-8333-333333333334',
      capability: {
        ...capability().capability,
        channel: 'AUDITORY',
        illuminationAccess: 'IGNORE',
        obscurementAccess: 'IGNORE',
        physicalConstraints: []
      }
    })
    const vibration = capability({
      instanceId: '33333333-3333-4333-8333-333333333335',
      capability: {
        ...capability().capability,
        channel: 'VIBRATION',
        illuminationAccess: 'IGNORE',
        obscurementAccess: 'IGNORE',
        physicalConstraints: []
      }
    })
    expect(
      resolveCombatPerception({
        requirement: 'SEE',
        environment: environment({ invisibleChannels: ['VISUAL'] }),
        capabilities: [auditory, vibration]
      }).satisfied
    ).toBe(true)
    expect(
      resolveCombatPerception({
        requirement: 'SEE',
        environment: environment({ suppressedChannels: ['AUDITORY'] }),
        capabilities: [auditory]
      }).rejected[0]?.reasons
    ).toContain('CHANNEL_SUPPRESSED')
  })

  it('keeps same-definition capabilities from distinct instances and composes grants, suppressions, and limits', () => {
    const twin = capability({ instanceId: '33333333-3333-4333-8333-333333333334' })
    expect(
      resolveCombatPerception({
        requirement: 'SEE',
        environment: environment(),
        capabilities: [capability(), twin]
      }).qualifying
    ).toHaveLength(2)

    const result = resolveCombatPerceptionWithContributions({
      requirement: 'DETECT',
      environment: environment(),
      capabilities: [capability()],
      observerContributions: [
        source({
          id: '55555555-5555-4555-8555-555555555551',
          order: 0,
          kind: 'SENSE_SUPPRESS',
          senseDefinitionIds: [visualDefinitionId],
          channels: []
        }),
        source(
          {
            id: '55555555-5555-4555-8555-555555555552',
            order: 1,
            kind: 'SENSE_GRANT',
            senseDefinitionId: otherDefinitionId,
            definitionVersion: 1,
            definitionContractVersion: 1,
            definitionChecksum: checksumRuleDocument(senseDocument()),
            document: senseDocument(),
            range: 90
          },
          {
            source: {
              kind: 'ACTIVE_EFFECT',
              activeEffectId: '44444444-4444-4444-8444-444444444445',
              activeEffectVersion: 1,
              activeEffectDefinitionChecksum: otherChecksum
            },
            sourceOrdinal: 2
          }
        ),
        source(
          {
            id: '55555555-5555-4555-8555-555555555553',
            order: 2,
            kind: 'ACCESS_LIMIT',
            channels: ['AUDITORY'],
            maximumAccessGrade: 'DETECTED',
            maximumIlluminationAccess: null,
            maximumObscurementAccess: null,
            perceivesInvisible: false
          },
          {
            source: {
              kind: 'ACTIVE_EFFECT',
              activeEffectId: '44444444-4444-4444-8444-444444444446',
              activeEffectVersion: 1,
              activeEffectDefinitionChecksum: otherChecksum
            },
            sourceOrdinal: 3
          }
        )
      ],
      subjectContributions: [],
      localAreaContributions: []
    })
    expect(result.satisfied).toBe(true)
    expect(result.finalCapabilities).toEqual([
      expect.objectContaining({
        instanceId: '55555555-5555-4555-8555-555555555552',
        definitionId: otherDefinitionId,
        range: 90,
        capability: expect.objectContaining({ accessGrade: 'DETECTED', perceivesInvisible: false })
      })
    ])

    const repeatedGrant = {
      id: '55555555-5555-4555-8555-555555555554',
      order: 0,
      kind: 'SENSE_GRANT' as const,
      senseDefinitionId: otherDefinitionId,
      definitionVersion: 1,
      definitionContractVersion: 1,
      definitionChecksum: checksumRuleDocument(senseDocument()),
      document: senseDocument(),
      range: 90
    }
    const repeated = resolveCombatPerceptionWithContributions({
      requirement: 'DETECT',
      environment: environment(),
      capabilities: [],
      observerContributions: [
        source(repeatedGrant, {
          instanceId: '77777777-7777-4777-8777-777777777771',
          source: {
            kind: 'ACTIVE_EFFECT',
            activeEffectId: '44444444-4444-4444-8444-444444444447',
            activeEffectVersion: 1,
            activeEffectDefinitionChecksum: otherChecksum
          },
          sourceOrdinal: 4
        }),
        source(repeatedGrant, {
          instanceId: '77777777-7777-4777-8777-777777777772',
          source: {
            kind: 'ACTIVE_EFFECT',
            activeEffectId: '44444444-4444-4444-8444-444444444448',
            activeEffectVersion: 1,
            activeEffectDefinitionChecksum: otherChecksum
          },
          sourceOrdinal: 5
        })
      ],
      subjectContributions: [],
      localAreaContributions: []
    })
    expect(repeated.finalCapabilities.map((entry) => entry.instanceId)).toEqual([
      '77777777-7777-4777-8777-777777777771',
      '77777777-7777-4777-8777-777777777772'
    ])
  })

  it('distinguishes bypassable invisibility from hard subject suppression and resolves local precedence deterministically', () => {
    const bypassable = resolveCombatPerceptionWithContributions({
      requirement: 'SEE',
      environment: environment(),
      capabilities: [
        capability({ capability: { ...capability().capability, perceivesInvisible: true } })
      ],
      observerContributions: [],
      subjectContributions: [
        source({
          id: '55555555-5555-4555-8555-555555555554',
          order: 0,
          kind: 'EMISSION_SUPPRESS',
          channels: ['VISUAL'],
          bypass: 'INVISIBILITY'
        })
      ],
      localAreaContributions: []
    })
    expect(bypassable.satisfied).toBe(true)
    const hard = resolveCombatPerceptionWithContributions({
      requirement: 'SEE',
      environment: environment(),
      capabilities: [
        capability({ capability: { ...capability().capability, perceivesInvisible: true } })
      ],
      observerContributions: [],
      subjectContributions: [
        source({
          id: '55555555-5555-4555-8555-555555555555',
          order: 0,
          kind: 'EMISSION_SUPPRESS',
          channels: ['VISUAL'],
          bypass: 'NONE'
        })
      ],
      localAreaContributions: []
    })
    expect(hard.rejected[0]?.reasons).toContain('CHANNEL_SUPPRESSED')

    const local = resolveCombatPerceptionWithContributions({
      requirement: 'DETECT',
      environment: environment({ illumination: 'BRIGHT', obscurement: 'NONE' }),
      capabilities: [capability()],
      observerContributions: [],
      subjectContributions: [],
      localAreaContributions: [
        source(
          {
            id: '55555555-5555-4555-8555-555555555556',
            order: 1,
            kind: 'ILLUMINATION_EFFECT',
            illumination: 'DIM',
            obscurement: 'LIGHT',
            precedence: 4
          },
          {
            source: {
              kind: 'ACTIVE_EFFECT',
              activeEffectId: '44444444-4444-4444-8444-444444444447',
              activeEffectVersion: 1,
              activeEffectDefinitionChecksum: otherChecksum
            },
            sourceOrdinal: 2
          }
        ),
        source(
          {
            id: '55555555-5555-4555-8555-555555555557',
            order: 0,
            kind: 'ILLUMINATION_EFFECT',
            illumination: 'ORDINARY_DARKNESS',
            obscurement: 'HEAVY',
            precedence: 4
          },
          {
            source: {
              kind: 'ACTIVE_EFFECT',
              activeEffectId: '44444444-4444-4444-8444-444444444446',
              activeEffectVersion: 1,
              activeEffectDefinitionChecksum: otherChecksum
            },
            sourceOrdinal: 1
          }
        )
      ]
    })
    expect(local.finalEnvironment).toMatchObject({
      illumination: 'ORDINARY_DARKNESS',
      obscurement: 'HEAVY'
    })
    expect(local.appliedContributionSources.map((entry) => entry.source)).toEqual([
      expect.objectContaining({
        kind: 'ACTIVE_EFFECT',
        activeEffectId: '44444444-4444-4444-8444-444444444446'
      }),
      expect.objectContaining({
        kind: 'ACTIVE_EFFECT',
        activeEffectId: '44444444-4444-4444-8444-444444444447'
      })
    ])
    expect(local.appliedContributionSources[0]).not.toHaveProperty('contribution')
  })

  it('fails closed for malformed, wrong-relation, and overflowing contribution sources', () => {
    const valid = source({
      id: '55555555-5555-4555-8555-555555555558',
      order: 0,
      kind: 'EMISSION_SUPPRESS',
      channels: ['VISUAL'],
      bypass: 'NONE'
    })
    const base = {
      requirement: 'SEE' as const,
      environment: environment(),
      capabilities: [capability()],
      observerContributions: [],
      subjectContributions: [],
      localAreaContributions: []
    }
    expect(() =>
      resolveCombatPerceptionWithContributions({ ...base, observerContributions: [valid] })
    ).toThrow(/another relation/)
    expect(() =>
      resolveCombatPerceptionWithContributions({
        ...base,
        subjectContributions: [
          {
            ...valid,
            source: {
              kind: 'ACTIVE_EFFECT',
              activeEffectId: '44444444-4444-4444-8444-444444444444',
              activeEffectVersion: 0,
              activeEffectDefinitionChecksum: otherChecksum
            }
          }
        ]
      })
    ).toThrow(/positive safe integer/)
    expect(() =>
      resolveCombatPerceptionWithContributions({
        ...base,
        observerContributions: [
          source({
            id: '55555555-5555-4555-8555-555555555559',
            order: 0,
            kind: 'SENSE_GRANT',
            senseDefinitionId: otherDefinitionId,
            definitionVersion: 1,
            definitionContractVersion: 1,
            definitionChecksum: checksum,
            document: senseDocument(),
            range: null
          })
        ]
      })
    ).toThrow(/checksum must match/)
    expect(() =>
      resolveCombatPerceptionWithContributions({
        ...base,
        observerContributions: [
          source({
            id: '55555555-5555-4555-8555-555555555560',
            order: 0,
            kind: 'SENSE_GRANT',
            senseDefinitionId: otherDefinitionId,
            definitionVersion: 1,
            definitionContractVersion: 10_001,
            definitionChecksum: checksumRuleDocument(senseDocument()),
            document: senseDocument(),
            range: null
          })
        ]
      })
    ).toThrow(/at most 10000/)
    expect(() =>
      resolveCombatPerceptionWithContributions({
        ...base,
        subjectContributions: [
          {
            ...valid,
            source: {
              kind: 'ACTIVE_EFFECT',
              activeEffectId: '44444444-4444-4444-8444-444444444444',
              activeEffectVersion: 1,
              activeEffectDefinitionChecksum: otherChecksum.toUpperCase()
            }
          }
        ]
      })
    ).toThrow(/lowercase SHA-256/)
    expect(() =>
      resolveCombatPerceptionWithContributions({
        ...base,
        subjectContributions: [{ ...valid, contribution: { ...valid.contribution, order: 10_000 } }]
      })
    ).toThrow(/at most 9999/)
    expect(() =>
      resolveCombatPerceptionWithContributions({
        ...base,
        subjectContributions: Array.from({ length: 257 }, () => valid)
      })
    ).toThrow(/at most 256/)
  })
})
