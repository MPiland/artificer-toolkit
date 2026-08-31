import { describe, expect, it } from 'vitest'

import { rulePathManifestDtoSchema } from '../shared/rulePathManifest.js'

const ROOT_ID = '00000000-0000-4000-8000-000000000001'
const EFFECT_ID = '00000000-0000-4000-8000-000000000002'
const ENTRY_ID = '00000000-0000-4000-8000-000000000003'

function supportedLeaf() {
  return {
    domain: 'spells',
    rootId: ROOT_ID,
    rootChecksum: 'a'.repeat(64),
    sourcePath: [ROOT_ID, EFFECT_ID, ENTRY_ID],
    descriptorChecksum: 'b'.repeat(64),
    entryPoint: {
      kind: 'EFFECT_ENTRY' as const,
      effectId: EFFECT_ID,
      entryId: ENTRY_ID,
      resultBlockId: ENTRY_ID,
      pathGroupId: ENTRY_ID,
      pathCode: 'ON_USE',
      resolutionKind: 'DIRECT',
      groupKind: 'SINGLE',
      triggerCode: 'ACTIVATED',
      activationCode: 'ACTION',
      targetSelectionKind: 'SELF',
      rangeKind: 'SELF',
      shapeKind: null,
      outcomeKind: 'HEAL'
    },
    capability: 'AUTOMATIC' as const,
    reason: 'SUPPORTED_SYSTEM_CAPABILITY' as const,
    executionPin: {
      kind: 'COMPILED_RULE_GRAPH' as const,
      definitionId: EFFECT_ID,
      definitionFamilyKey: 'effect-action',
      definitionChecksum: 'c'.repeat(64),
      definitionSchemaVersion: 1 as const,
      capabilityContractVersion: 1,
      operationContracts: [{ key: 'dnd5e.heal-proposal', contractVersion: 1 }]
    }
  }
}

function manifest(leaf: unknown = supportedLeaf()) {
  return {
    version: 1 as const,
    systemId: '00000000-0000-4000-8000-000000000004',
    leaves: [leaf],
    roots: [
      {
        domain: 'spells',
        rootId: ROOT_ID,
        rootChecksum: 'a'.repeat(64),
        coverage: 'MECHANICS' as const,
        leafCount: 1,
        capabilities: { AUTOMATIC: 1, ASSISTED: 0, MANUAL: 0, JUDGMENT_REQUIRED: 0 }
      }
    ]
  }
}

describe('rule-path manifest execution pins', () => {
  it('accepts a complete compiled-rule-graph pin', () => {
    expect(rulePathManifestDtoSchema.parse(manifest()).leaves[0]?.executionPin).toEqual(
      supportedLeaf().executionPin
    )
  })

  it('rejects missing or non-executable execution pins', () => {
    const missing = { ...supportedLeaf(), executionPin: null }
    expect(() => rulePathManifestDtoSchema.parse(manifest(missing))).toThrow()

    const manual = {
      ...supportedLeaf(),
      capability: 'MANUAL',
      reason: 'NO_MECHANICAL_OUTCOME'
    }
    expect(() => rulePathManifestDtoSchema.parse(manifest(manual))).toThrow()
  })

  it('rejects invalid compiled-rule-graph pin identities and contracts', () => {
    const cases = [
      () => ({
        ...supportedLeaf(),
        executionPin: { ...supportedLeaf().executionPin, definitionId: 'not-a-uuid' }
      }),
      () => ({
        ...supportedLeaf(),
        executionPin: { ...supportedLeaf().executionPin, definitionChecksum: 'not-a-checksum' }
      }),
      () => ({
        ...supportedLeaf(),
        executionPin: { ...supportedLeaf().executionPin, definitionSchemaVersion: 2 }
      }),
      () => ({
        ...supportedLeaf(),
        executionPin: { ...supportedLeaf().executionPin, operationContracts: [] }
      }),
      () => ({
        ...supportedLeaf(),
        executionPin: {
          ...supportedLeaf().executionPin,
          operationContracts: [
            { key: 'dnd5e.heal-proposal', contractVersion: 1 },
            { key: 'dnd5e.heal-proposal', contractVersion: 1 }
          ]
        }
      }),
      () => ({
        ...supportedLeaf(),
        executionPin: {
          ...supportedLeaf().executionPin,
          operationContracts: [
            { key: 'z.operation', contractVersion: 1 },
            { key: 'a.operation', contractVersion: 1 }
          ]
        }
      })
    ]
    for (const buildInvalidLeaf of cases)
      expect(() => rulePathManifestDtoSchema.parse(manifest(buildInvalidLeaf()))).toThrow()
  })

  it('binds execution pins only to their exact Effect entry', () => {
    const mismatchedEffect = {
      ...supportedLeaf(),
      executionPin: {
        ...supportedLeaf().executionPin,
        definitionId: '00000000-0000-4000-8000-000000000099'
      }
    }
    expect(() => rulePathManifestDtoSchema.parse(manifest(mismatchedEffect))).toThrow()

    const typedMechanics = {
      ...supportedLeaf(),
      sourcePath: [ROOT_ID, ENTRY_ID],
      entryPoint: {
        kind: 'UUID_BACKED_TYPED_MECHANICS' as const,
        sourceId: ENTRY_ID,
        nodeKind: 'FEATURE',
        outcomeKind: null
      }
    }
    expect(() => rulePathManifestDtoSchema.parse(manifest(typedMechanics))).toThrow()
  })
})
