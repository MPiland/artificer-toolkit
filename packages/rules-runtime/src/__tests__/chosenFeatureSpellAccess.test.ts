import { describe, expect, it } from 'vitest'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'

import {
  buildCharacterSpellRuleFacts,
  findCompiledSpellGrant
} from '../character/characterSpellRuleFacts.js'
import {
  SRD,
  evaluateSrdCharacter,
  srdByLabel,
  srdFeature,
  srdRegistry
} from '../testing/dnd5eSrdCharacter.js'

const chainsGrant = (() => {
  const invocations = srdRegistry.classes[srdByLabel(SRD.classes, 'Warlock').id]?.features?.find(
    (feature) => feature.label === 'Eldritch Invocations'
  )
  const grant = invocations?.options?.find((option) => option.label === 'Chains of Carceri')
    ?.spells?.[0]
  if (!grant) throw new Error('The SRD Warlock offers Chains of Carceri.')
  return grant
})()

describe('chosen-feature spell access (SPELLS-31.T5t)', () => {
  it('reads every SRD option that grants spells, keyed by its acquisition', () => {
    const census: string[] = []
    for (const owner of Object.values(srdRegistry.classes)) {
      const characterClass = SRD.classes.find(
        (entry) => entry.id === (owner?.category === 'SUBCLASS' ? owner.parentClassId : owner?.id)
      )
      if (!owner || !characterClass) continue
      for (const feature of owner.features ?? []) {
        for (const option of feature.options ?? []) {
          if (!option.spells?.length) continue
          const character = evaluateSrdCharacter({
            classes: [
              {
                label: characterClass.label,
                level: 20,
                ...(owner.category === 'SUBCLASS' ? { subclass: owner.label } : {})
              }
            ],
            features: [
              srdFeature({
                owner: owner.category === 'SUBCLASS' ? 'SUBCLASS' : 'CLASS',
                classLabel: characterClass.label,
                subclassLabel: owner.label,
                featureLabel: feature.label,
                level: 20,
                optionLabels: [option.label]
              })
            ]
          })
          const { spellAccessCandidates } = buildCharacterSpellRuleFacts(
            character.snapshot,
            srdRegistry
          )
          const fromOption = spellAccessCandidates.filter(
            (candidate) => candidate.sourceKind === 'OPTION' && candidate.sourceId === option.id
          )
          expect(fromOption.length, `${feature.label} / ${option.label}`).toBeGreaterThan(0)
          for (const candidate of fromOption)
            expect(candidate.acquiredParentId).toBe(`acquired:${feature.id}`)
          census.push(`${owner.label} / ${feature.label} / ${option.label}`)
        }
      }
    }
    expect(census).toContain('Warlock / Eldritch Invocations / Chains of Carceri')
  })

  it('reads a Feat once, whatever number of its features were acquired', () => {
    const featId = 'feat-test'
    const featureId = 'feat-test-feature'
    const registry: CharacterAssemblyRegistry = {
      ...srdRegistry,
      feats: {
        [featId]: {
          id: featId,
          label: 'Test feat',
          spells: [{ ...chainsGrant, id: 'feat-root-grant' }]
        }
      },
      features: {
        ...srdRegistry.features,
        [featureId]: { label: 'Feat feature', spells: [{ ...chainsGrant, id: 'feat-child-grant' }] }
      }
    }
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Fighter', level: 4 }],
      features: [
        {
          acquisitionId: 'a1',
          featureId,
          source: { kind: 'FEAT', featId },
          timing: { kind: 'IMMEDIATE' }
        },
        {
          acquisitionId: 'a2',
          featureId,
          source: { kind: 'FEAT', featId },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    const { spellAccessCandidates } = buildCharacterSpellRuleFacts(character.snapshot, registry)
    const rootGrants = spellAccessCandidates.filter(({ grantId }) => grantId === 'feat-root-grant')
    expect(
      rootGrants.map(({ sourceKind, sourceId, owningClassId, activeSourceLevel }) => ({
        sourceKind,
        sourceId,
        owningClassId,
        activeSourceLevel
      }))
    ).toEqual([{ sourceKind: 'FEAT', sourceId: featId, owningClassId: null, activeSourceLevel: 4 }])
    expect(
      spellAccessCandidates.some(
        ({ grantId, sourceFeatureId }) =>
          grantId === 'feat-child-grant' && sourceFeatureId === featureId
      )
    ).toBe(true)
    for (const candidate of spellAccessCandidates)
      expect(findCompiledSpellGrant(registry, candidate)?.id).toBe(candidate.grantId)
  })

  it('reads a Background feature as character-level access', () => {
    const backgroundId = 'background-test'
    const featureId = 'background-test-feature'
    const registry: CharacterAssemblyRegistry = {
      ...srdRegistry,
      features: {
        ...srdRegistry.features,
        [featureId]: { label: 'Background feature', spells: [chainsGrant] }
      }
    }
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Fighter', level: 3 }],
      features: [
        {
          acquisitionId: 'b1',
          featureId,
          source: { kind: 'BACKGROUND', backgroundId },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    const { spellAccessCandidates } = buildCharacterSpellRuleFacts(character.snapshot, registry)
    expect(spellAccessCandidates).toHaveLength(1)
    expect(spellAccessCandidates[0]).toMatchObject({
      sourceKind: 'BACKGROUND',
      sourceId: backgroundId,
      owningClassId: null,
      activeSourceLevel: 3,
      acquiredParentId: null
    })
    expect(findCompiledSpellGrant(registry, spellAccessCandidates[0]!)).toBe(chainsGrant)
  })
})
