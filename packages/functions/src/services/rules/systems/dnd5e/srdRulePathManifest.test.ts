import { readFileSync } from 'node:fs'

import {
  readSrdSemanticLedgerEntries,
  srdBaselineContent,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/db'
import { rulePathManifestDtoSchema } from '@artificer-toolkit/schema/shared/rulePathManifest'
import { type EffectAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { describe, expect, it } from 'vitest'

import {
  canonicalRulePathManifestJson,
  generateRulePathManifest,
  generateSrdRulePathManifest,
  assertRulePathManifestFresh,
  validateRulePathManifestCompleteness,
  validateDnd5eExecutionPins
} from './srdRulePathManifest.js'
import { compileDnd5eEffectAction } from './effectActionCompiler.js'

const FIXTURE_SPELL_ID = '00000000-0000-4000-8000-000000000101'
const FIXTURE_EFFECT_ID = '00000000-0000-4000-8000-000000000102'
const FIXTURE_ENTRY_ID = '00000000-0000-4000-8000-000000000103'

function supportedFixtureEffect(): EffectAuthored {
  return {
    id: FIXTURE_EFFECT_ID,
    order: 1,
    invocation: {
      kind: 'ACTION' as const,
      triggerCode: 'ACTIVATED' as const,
      activation: { code: 'ACTION' as const, amount: 1 },
      range: { id: 'fixture-range', rangeKind: 'SELF' as const },
      targeting: { selectionKind: 'SELF' as const }
    },
    paths: [
      {
        id: FIXTURE_ENTRY_ID,
        order: 1,
        pathCode: 'ON_USE' as const,
        groupType: 'SINGLE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: '00000000-0000-4000-8000-000000000104',
          resultKind: 'SINGLE' as const,
          outcomes: [
            {
              id: '00000000-0000-4000-8000-000000000105',
              effectKind: 'HEAL' as const,
              valueKind: 'FIXED' as const,
              scalingKind: 'NONE' as const,
              amount: 7
            }
          ]
        }
      }
    ]
  }
}

function supportedFixtureContent() {
  const spell = {
    kind: 'SPELL' as const,
    id: FIXTURE_SPELL_ID,
    label: 'Fixture Heal',
    description: '',
    castingTime: { unit: 'ROUND' as const, amount: 1 },
    level: 1,
    classIds: [],
    magicSchoolId: 'fixture-school',
    effects: [supportedFixtureEffect()],
    userId: 'fixture-user',
    systemId: SRD_SYSTEM_ID
  }
  return {
    ...srdBaselineContent,
    subjects: {
      backgrounds: [],
      classes: [],
      creatures: [],
      equipment: [],
      feats: [],
      races: [],
      spells: [spell],
      vehicles: []
    }
  } as unknown as typeof srdBaselineContent
}

describe('SRD rule-path manifest', () => {
  it('pins a stable real-SRD dice tracer rather than synthetic fixed fixtures', () => {
    const manifest = generateSrdRulePathManifest()
    const pinned = manifest.leaves.filter((leaf) => leaf.executionPin !== null)
    expect(pinned).toHaveLength(376)
    expect(manifest.leaves.filter((leaf) => leaf.capability === 'AUTOMATIC')).toHaveLength(376)
    const sacredFlameEffectId = '00000020-0000-0210-0105-000000000001'
    const sacredFlame = manifest.leaves.filter(
      (leaf) =>
        leaf.entryPoint.kind === 'EFFECT_ENTRY' && leaf.entryPoint.effectId === sacredFlameEffectId
    )
    expect(sacredFlame).toHaveLength(4)
    expect(sacredFlame.every((leaf) => leaf.executionPin !== null)).toBe(true)
  })

  it('covers every ledger root and exact manual owner deterministically', () => {
    const first = generateSrdRulePathManifest()
    const second = generateSrdRulePathManifest()
    const ledger = readSrdSemanticLedgerEntries()
    expect(canonicalRulePathManifestJson(first)).toBe(canonicalRulePathManifestJson(second))
    expect(first.roots).toHaveLength(1046)
    expect(first.roots).toHaveLength(ledger.length)
    for (const entry of ledger) {
      const root = first.roots.find(
        (candidate) => candidate.domain === entry.domain && candidate.rootId === entry.id
      )
      expect(root).toBeDefined()
      for (const exceptionId of entry.manualExceptionIds) {
        expect(
          first.leaves.some(
            (leaf) =>
              leaf.domain === entry.domain &&
              leaf.rootId === entry.id &&
              leaf.sourcePath.includes(exceptionId) &&
              leaf.reason === 'OPEN_JUDGMENT'
          )
        ).toBe(true)
      }
    }
    expect(
      first.leaves.every(
        (leaf) =>
          leaf.sourcePath[0] === leaf.rootId &&
          leaf.sourcePath.filter((id) => id === leaf.rootId).length === 1
      )
    ).toBe(true)
    expect(first.leaves.some((leaf) => leaf.entryPoint.kind === 'ROOT_OWNED_TYPED_MECHANICS')).toBe(
      true
    )
    const splintRootId = '00000000-0000-0000-0060-003000000000'
    const splintLeaves = first.leaves.filter((leaf) => leaf.rootId === splintRootId)
    expect(
      splintLeaves.some(
        (leaf) =>
          leaf.entryPoint.kind === 'ROOT_OWNED_TYPED_MECHANICS' &&
          leaf.entryPoint.nodeKind === 'ROOT_COMPILED_SEMANTICS'
      )
    ).toBe(true)
    expect(
      splintLeaves.some(
        (leaf) =>
          leaf.entryPoint.kind === 'UUID_BACKED_TYPED_MECHANICS' &&
          leaf.entryPoint.nodeKind === 'MODIFIER_GRANT'
      )
    ).toBe(true)
    expect(splintLeaves.some((leaf) => leaf.entryPoint.kind === 'EFFECT_ENTRY')).toBe(true)
    expect(
      first.leaves.some(
        (leaf) =>
          leaf.entryPoint.kind === 'EFFECT_ENTRY' &&
          leaf.entryPoint.shapeKind !== null &&
          leaf.entryPoint.triggerCode === 'SAVING_THROW' &&
          leaf.capability === 'JUDGMENT_REQUIRED'
      )
    ).toBe(true)
    expect(
      first.leaves.some(
        (leaf) =>
          leaf.entryPoint.kind === 'UUID_BACKED_TYPED_MECHANICS' &&
          leaf.entryPoint.nodeKind === 'SPELL_GRANT'
      )
    ).toBe(true)
    expect([...new Set(first.roots.map((root) => root.domain))].sort()).toEqual([
      'backgrounds',
      'classes',
      'creatures',
      'equipment',
      'feats',
      'races',
      'spells',
      'vehicles'
    ])
    expect(
      first.leaves.some((leaf) => leaf.sourcePath.includes('00000000-0000-4000-8000-0000000000f5'))
    ).toBe(false)
    expect(
      first.leaves.some(
        (leaf) =>
          leaf.entryPoint.kind === 'UUID_BACKED_TYPED_MECHANICS' &&
          leaf.reason === 'UNMODELED_TYPED_MECHANICS' &&
          leaf.executionPin !== null
      )
    ).toBe(false)
    expect(
      first.leaves.some(
        (leaf) =>
          leaf.entryPoint.kind === 'EFFECT_ENTRY' &&
          leaf.reason === 'UNSUPPORTED_SYSTEM_CAPABILITY' &&
          leaf.executionPin !== null
      )
    ).toBe(false)
  }, 30_000)

  it('pins a supported Effect graph and leaves unsupported paths unpinned', () => {
    const effect = supportedFixtureEffect()
    const compiledEffect = compileEffect(effect)
    const published = compileDnd5eEffectAction({
      action: {
        gameSystemId: SRD_SYSTEM_ID,
        entryPointDefinitionId: FIXTURE_EFFECT_ID,
        effectId: FIXTURE_EFFECT_ID,
        compiledEffect
      }
    })
    const manifest = generateRulePathManifest({
      content: supportedFixtureContent(),
      systemId: SRD_SYSTEM_ID,
      ledgerEntries: [
        {
          domain: 'spells',
          id: FIXTURE_SPELL_ID,
          mechanicsStatus: 'COMPLETE',
          manualExceptionIds: []
        }
      ]
    })
    const leaf = manifest.leaves.find((candidate) => candidate.entryPoint.kind === 'EFFECT_ENTRY')
    if (!leaf) throw new Error('Expected the fixture Effect entry leaf.')
    expect(leaf?.executionPin).toEqual({
      kind: 'COMPILED_RULE_GRAPH',
      definitionId: FIXTURE_EFFECT_ID,
      definitionFamilyKey: 'effect-action',
      definitionChecksum: published.checksum,
      definitionSchemaVersion: 1,
      capabilityContractVersion: 1,
      operationContracts: [{ key: 'dnd5e.heal-proposal', contractVersion: 1 }]
    })
  })

  it('rejects malformed root summaries and retains the committed artifact', () => {
    const manifest = generateSrdRulePathManifest()
    const malformed = structuredClone(manifest)
    malformed.roots[0]!.leafCount += 1
    expect(() => rulePathManifestDtoSchema.parse(malformed)).toThrow()
    const malformedEffect = structuredClone(manifest)
    const effectIndex = malformedEffect.leaves.findIndex(
      (leaf) => leaf.entryPoint.kind === 'EFFECT_ENTRY'
    )
    const effect = malformedEffect.leaves[effectIndex]!
    if (effect.entryPoint.kind !== 'EFFECT_ENTRY') throw new Error('Expected effect entry.')
    effect.sourcePath = [effect.rootId, effect.entryPoint.entryId, effect.entryPoint.effectId]
    expect(() => rulePathManifestDtoSchema.parse(malformedEffect)).toThrow()
    const artifact = JSON.parse(
      readFileSync(
        new URL(
          '../../../../../../db/src/source-data/srd/rule-path-manifest.json',
          import.meta.url
        ),
        'utf8'
      )
    )
    expect(canonicalRulePathManifestJson(artifact)).toBe(canonicalRulePathManifestJson(manifest))
  }, 30_000)

  it('rejects D&D execution pins outside the Effect action contract', () => {
    const manifest = generateRulePathManifest({
      content: supportedFixtureContent(),
      systemId: SRD_SYSTEM_ID,
      ledgerEntries: [
        {
          domain: 'spells',
          id: FIXTURE_SPELL_ID,
          mechanicsStatus: 'COMPLETE',
          manualExceptionIds: []
        }
      ]
    })
    const leaf = manifest.leaves.find((candidate) => candidate.executionPin !== null)
    if (!leaf?.executionPin) throw new Error('Expected supported fixture execution pin.')

    const wrongFamily = structuredClone(manifest)
    const wrongFamilyLeaf = wrongFamily.leaves.find((candidate) => candidate.executionPin !== null)
    if (!wrongFamilyLeaf?.executionPin) throw new Error('Expected supported fixture execution pin.')
    wrongFamilyLeaf.executionPin.definitionFamilyKey = 'dnd5e-optional-combat'
    expect(() => validateDnd5eExecutionPins(wrongFamily)).toThrow()

    const wrongContract = structuredClone(manifest)
    const wrongContractLeaf = wrongContract.leaves.find(
      (candidate) => candidate.executionPin !== null
    )
    if (!wrongContractLeaf?.executionPin)
      throw new Error('Expected supported fixture execution pin.')
    wrongContractLeaf.executionPin.capabilityContractVersion = 2
    expect(() => validateDnd5eExecutionPins(wrongContract)).toThrow()
  })

  it('rejects duplicate ledger roots before generation can overwrite one', () => {
    const content = supportedFixtureContent()
    const entry = {
      domain: 'spells',
      id: FIXTURE_SPELL_ID,
      mechanicsStatus: 'COMPLETE' as const,
      manualExceptionIds: []
    }
    expect(() =>
      generateRulePathManifest({ content, systemId: SRD_SYSTEM_ID, ledgerEntries: [entry, entry] })
    ).toThrow('Duplicate semantic ledger root')
  })

  it('rejects duplicate or missing manifest identities and executable leaves without pins', () => {
    const manifest = generateRulePathManifest({
      content: supportedFixtureContent(),
      systemId: SRD_SYSTEM_ID,
      ledgerEntries: [
        {
          domain: 'spells',
          id: FIXTURE_SPELL_ID,
          mechanicsStatus: 'COMPLETE',
          manualExceptionIds: []
        }
      ]
    })
    const duplicateLeaf = structuredClone(manifest)
    duplicateLeaf.leaves.push(structuredClone(duplicateLeaf.leaves[0]!))
    expect(() => validateRulePathManifestCompleteness(duplicateLeaf)).toThrow(
      'Duplicate manifest leaf'
    )

    const missingRoot = structuredClone(manifest)
    missingRoot.roots = []
    expect(() => validateRulePathManifestCompleteness(missingRoot)).toThrow('lacks a root summary')

    const unsupportedExecutable = structuredClone(manifest)
    unsupportedExecutable.leaves[0]!.capability = 'AUTOMATIC'
    unsupportedExecutable.leaves[0]!.reason = 'SUPPORTED_SYSTEM_CAPABILITY'
    unsupportedExecutable.leaves[0]!.executionPin = null
    expect(() => validateRulePathManifestCompleteness(unsupportedExecutable)).toThrow(
      'lacks a supported execution pin'
    )
  })

  it('fails closed when an artifact differs from the generated canonical manifest', () => {
    const manifest = generateRulePathManifest({
      content: supportedFixtureContent(),
      systemId: SRD_SYSTEM_ID,
      ledgerEntries: [
        {
          domain: 'spells',
          id: FIXTURE_SPELL_ID,
          mechanicsStatus: 'COMPLETE',
          manualExceptionIds: []
        }
      ]
    })
    const stale = structuredClone(manifest)
    stale.leaves[0]!.descriptorChecksum = '0'.repeat(64)
    expect(() => assertRulePathManifestFresh(stale, manifest)).toThrow('manifest is stale')
    expect(canonicalRulePathManifestJson(manifest)).toContain(FIXTURE_SPELL_ID)
  })
})
