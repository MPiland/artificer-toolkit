import { describe, expect, it } from 'vitest'
import { SRD_REUSABLE_DEFINITIONS, SRD_RULES_CATALOGUE } from './catalogue.js'
import { srdBaselineContent } from './index.js'
import { prepareSrdDefinitions, prepareSrdImport } from './import.js'
import {
  SRD_DND5E_CONCENTRATION_CHECK_DEFINITION_ID,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from './concentration.js'
import { ABILITY_CODE, ATTACK_DOMAIN_CODE } from '@artificer-toolkit/shared'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_BASIC_ACTION_IDS } from './basicActions.js'
import { SRD_MEDICINE_SKILL_ID } from './vocabulary.js'
import type { BaselineContentBundle } from '../content.js'

function emptySubjectBundle(): BaselineContentBundle {
  return {
    ...structuredClone(srdBaselineContent),
    subjects: {
      backgrounds: [],
      classes: [],
      creatures: [],
      equipment: [],
      feats: [],
      races: [],
      spells: [],
      vehicles: []
    }
  }
}

/** The reusable definitions alone: no authored subject needs preparing to read them. */
function preparedDefinitions() {
  return prepareSrdDefinitions(
    SRD_REUSABLE_DEFINITIONS,
    new Set(srdBaselineContent.vocabulary.systems.map((system) => system.id))
  )
}

describe('canonical Convex import preparation', () => {
  it('publishes the SRD basic-action catalogue as System data (Q11)', () => {
    const catalogue = preparedDefinitions().filter(
      (definition) => definition.definitionFamilyKey === 'basic-action'
    )
    expect(
      Object.fromEntries(
        catalogue.map((definition) => [
          definition.label,
          definition.document.kind === 'BASIC_ACTION'
            ? [
                definition.document.actionCost,
                definition.document.effects.flatMap((effect) =>
                  effect.paths.flatMap((path) =>
                    path.resultBlock.outcomes.map((outcome) => outcome.effectKind)
                  )
                )
              ]
            : null
        ])
      )
    ).toEqual({
      Dash: ['ACTION', ['MOVEMENT_RULE']],
      Disengage: ['ACTION', ['APPLY_GRANT']],
      Dodge: ['ACTION', ['APPLY_GRANT']],
      Help: ['ACTION', ['APPLY_GRANT']],
      Hide: ['ACTION', ['CONCEAL_FROM_OBSERVERS']],
      Ready: ['ACTION', ['MANUAL_ADJUDICATION']],
      Search: ['ACTION', ['DETECT_CONCEALED']],
      'Use an Object': ['ACTION', ['MANUAL_ADJUDICATION']],
      'First Aid': ['ACTION', ['STABILIZE']]
    })
    expect(catalogue.map((definition) => definition.id).sort()).toEqual(
      Object.values(SRD_BASIC_ACTION_IDS).sort()
    )
    // Dodge is authored: attacks against its holder have disadvantage and its Dexterity saves
    // advantage, both only while the holder can act and has speed above 0.
    const dodgeModifiers =
      catalogue.find((definition) => definition.label === 'Dodge')?.document.kind === 'BASIC_ACTION'
        ? catalogue
            .find((definition) => definition.label === 'Dodge')!
            .document.effects.flatMap((effect) =>
              effect.paths.flatMap((path) =>
                path.resultBlock.outcomes.flatMap((outcome) =>
                  outcome.effectKind === 'APPLY_GRANT' ? (outcome.grants.modifiers ?? []) : []
                )
              )
            )
        : []
    expect(dodgeModifiers.map((modifier) => modifier.valueDomainCode)).toEqual([
      ...Array(4).fill('ATTACKS_AGAINST'),
      'SAVING_THROW_MODIFIER'
    ])
    const attacksAgainst = dodgeModifiers.filter(
      (modifier) => modifier.valueDomainCode === 'ATTACKS_AGAINST'
    )
    // Every attack kind has disadvantage, and only when the holder can see the attacker.
    expect(attacksAgainst.map((modifier) => modifier.modifierKind)).toEqual(
      Array(4).fill('DISADVANTAGE')
    )
    expect(attacksAgainst.map((modifier) => modifier.domain)).toEqual(
      Object.values(ATTACK_DOMAIN_CODE).map((attackDomain) => ({
        attackDomain,
        requiresHolderSeesAttacker: true
      }))
    )
    // The one save modifier is advantage on Dexterity saves only.
    const saves = dodgeModifiers.filter(
      (modifier) => modifier.valueDomainCode === 'SAVING_THROW_MODIFIER'
    )
    expect(saves.map((modifier) => [modifier.modifierKind, modifier.domain])).toEqual([
      ['ADVANTAGE', { ability: ABILITY_CODE.DEXTERITY }]
    ])
    for (const modifier of dodgeModifiers)
      expect(
        modifier.restrictions?.groups.flatMap((group) =>
          group.contexts.flatMap((context) =>
            context.conditions.map((condition) =>
              condition.kind === 'PREDICATE' ? condition.predicateCode : condition.kind
            )
          )
        )
      ).toEqual(['CAN_ACT', 'SPEED_ABOVE_ZERO'])
    // Help is authored: an attack-roll advantage per attack kind plus one ability-check advantage,
    // all used up by the first attack roll or ability check, on one other willing creature.
    const helpEffect = catalogue.find((definition) => definition.label === 'Help')!.document
    const helpBlocks =
      helpEffect.kind === 'BASIC_ACTION'
        ? helpEffect.effects.flatMap((effect) => effect.paths.map((path) => path.resultBlock))
        : []
    const helpModifiers = helpBlocks.flatMap((block) =>
      block.outcomes.flatMap((outcome) =>
        outcome.effectKind === 'APPLY_GRANT' ? (outcome.grants.modifiers ?? []) : []
      )
    )
    expect(helpModifiers.map((modifier) => [modifier.valueDomainCode, modifier.domain])).toEqual([
      ...Object.values(ATTACK_DOMAIN_CODE).map((attackDomain) => ['ATTACK_ROLL', { attackDomain }]),
      ['ABILITY_CHECK', {}]
    ])
    expect(helpModifiers.map((modifier) => modifier.modifierKind)).toEqual(
      Array(helpModifiers.length).fill('ADVANTAGE')
    )
    expect(helpBlocks.map((block) => block.lifecycle)).toEqual([
      {
        turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' },
        consumeOnFirstEvents: ['ON_ABILITY_CHECK', 'ON_ATTACK_ROLL']
      }
    ])
    expect(
      helpEffect.kind === 'BASIC_ACTION' && helpEffect.effects[0]?.invocation.targeting
    ).toEqual({
      selectionKind: 'SINGLE_TARGET',
      dispositionKind: 'WILLING',
      self: 'REFUSED'
    })
    // First Aid is a CHECK action: a DC 10 Wisdom (Medicine) check whose success stabilizes the target.
    const firstAid = catalogue.find((definition) => definition.label === 'First Aid')?.document
    expect(firstAid?.kind === 'BASIC_ACTION' && firstAid.effects[0]?.invocation.targeting).toEqual({
      selectionKind: 'SINGLE_TARGET',
      dispositionKind: 'WILLING',
      self: 'REFUSED'
    })
    expect(firstAid?.kind === 'BASIC_ACTION' && firstAid.effects[0]?.invocation).toMatchObject({
      triggerCode: 'CHECK',
      check: {
        checks: { skillIds: [SRD_MEDICINE_SKILL_ID], abilityDefinitionIds: [] },
        dc: { kind: 'FIXED', value: 10 }
      }
    })
    for (const definition of catalogue) {
      expect(definition.document.gameSystemId).toBe(srdBaselineContent.vocabulary.systems[0]!.id)
      expect(definition.checksum).toBe(checksumRuleDocument(definition.document))
    }
  })

  it('authors Danger Sense as a sight-gated Dexterity save advantage held while the barbarian can act', () => {
    const dangerSense = srdBaselineContent.subjects.classes
      .find(({ label }) => label === 'Barbarian')
      ?.features?.find(({ label }) => label === 'Danger Sense')
    const [modifier, ...others] = dangerSense?.grants?.modifiers ?? []
    expect(others).toEqual([])
    expect(modifier).toMatchObject({
      valueDomainCode: 'SAVING_THROW_MODIFIER',
      domain: { ability: ABILITY_CODE.DEXTERITY, requiresHolderSeesSource: true },
      modifierKind: 'ADVANTAGE',
      scope: 'GLOBAL'
    })
    expect(
      modifier?.restrictions?.groups.flatMap((group) =>
        group.contexts.flatMap((context) =>
          context.conditions.map((condition) =>
            condition.kind === 'PREDICATE' ? condition.predicateCode : condition.kind
          )
        )
      )
    ).toEqual(['CAN_ACT'])
  })

  it('preserves every authored root and separate policy definition deterministically', () => {
    const result = prepareSrdImport()
    expect(result.subjects).toHaveLength(Object.values(srdBaselineContent.subjects).flat().length)
    expect(result.definitions).toHaveLength(SRD_REUSABLE_DEFINITIONS.length)
    expect(result.systems).toHaveLength(srdBaselineContent.vocabulary.systems.length)
    expect(result.manifestChecksum).toMatch(/^[a-f0-9]{64}$/)
    const reordered = structuredClone(srdBaselineContent)
    for (const records of Object.values(reordered.subjects)) records.reverse()
    expect(
      prepareSrdImport(reordered, [...SRD_REUSABLE_DEFINITIONS].reverse()).manifestChecksum
    ).toBe(result.manifestChecksum)
  }, 20_000)

  it('publishes the canonical concentration maintenance definition with its damage graph link', () => {
    const definitions = preparedDefinitions()
    const maintenance = definitions.find(
      (definition) => definition.id === SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
    )
    expect(maintenance).toMatchObject({
      definitionFamilyKey: 'rule-maintenance',
      document: {
        kind: 'RULE_MAINTENANCE',
        gameSystemId: SRD_RULES_CATALOGUE.gameSystemId,
        replacementPolicy: 'REPLACE_SAME_DEFINITION',
        emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY',
        damageCheckDefinitionId: SRD_DND5E_CONCENTRATION_CHECK_DEFINITION_ID
      }
    })
    expect(maintenance?.checksum).toBe(checksumRuleDocument(maintenance?.document))
    expect(
      definitions.some(
        (definition) => definition.id === SRD_DND5E_CONCENTRATION_CHECK_DEFINITION_ID
      )
    ).toBe(true)
  })

  it('rejects duplicate roots before persistence', () => {
    const bundle = emptySubjectBundle()
    bundle.subjects.backgrounds.push(
      srdBaselineContent.subjects.backgrounds[0],
      srdBaselineContent.subjects.backgrounds[0]
    )
    expect(() => prepareSrdImport(bundle)).toThrow('Duplicate canonical authored UUID')
  })

  it('rejects missing typed references and forged definition checksums', () => {
    const bundle = emptySubjectBundle()
    bundle.subjects.spells.push(structuredClone(srdBaselineContent.subjects.spells[0]))
    bundle.subjects.spells[0].classIds = ['ffffffff-ffff-4fff-8fff-ffffffffffff']
    expect(() => prepareSrdImport(bundle)).toThrow('references missing')
    const definitions = structuredClone(SRD_REUSABLE_DEFINITIONS)
    definitions[0].checksum = '0'.repeat(64)
    expect(() => prepareSrdImport(emptySubjectBundle(), definitions)).toThrow(
      'Invalid canonical definition'
    )
  })

  it('does not silently strip unknown canonical fields', () => {
    const bundle = emptySubjectBundle()
    bundle.subjects.backgrounds.push(structuredClone(srdBaselineContent.subjects.backgrounds[0]))
    Object.assign(bundle.subjects.backgrounds[0], { unknownMechanic: true })
    expect(() => prepareSrdImport(bundle)).toThrow('would change canonical source')
  })
})
