import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { encounterActionChoiceRange } from '../encounterActionRange.js'
import {
  buildCompiledActionCompilerSource,
  buildCompiledActionTargetPolicy,
  compileCharacterActionEntryPoints
} from '../encounterActionEntryPointCompiler.js'
import { encounterActionChoiceTarget } from '../encounterAreaAction.js'
import { evaluateEncounterCharacterActionWieldConflict } from '../encounterWieldConflict.js'
import { evaluateDnd5e2014CharacterActions } from '../systems/dnd5e/characterActions.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  type SrdCharacter,
  type SrdCharacterInput,
  damageExpression,
  evaluateSrdCharacter,
  srdFeature
} from '../testing/dnd5eSrdCharacter.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

/**
 * SPELLS-31.T5s (D156): Volley and Whirlwind Attack attack with each wielded weapon that fits,
 * from the generic weapon-attack option on a Feature effect, with no closed rule.
 */

function hunter(
  option: 'Volley' | 'Whirlwind Attack',
  items: NonNullable<SrdCharacterInput['items']>
) {
  return evaluateSrdCharacter({
    abilities: { STRENGTH: 16, DEXTERITY: 16 },
    classes: [{ label: 'Ranger', level: 11, subclass: 'Hunter' }],
    features: [
      srdFeature({
        owner: 'SUBCLASS',
        classLabel: 'Ranger',
        subclassLabel: 'Hunter',
        featureLabel: "Hunter's Multiattack",
        level: 11,
        optionLabels: [option]
      })
    ],
    items
  })
}

/** The option's actions, each with its policy decision. */
function optionActions(character: SrdCharacter, option: string) {
  return character.facts.actionCandidates.flatMap((candidate) => {
    if (!candidate.label.startsWith(`${option} (`)) return []
    const decision = character.output.actionDecisions.find(
      (entry) => entry.actionId === candidate.actionId
    )
    if (!decision) throw new Error(`${candidate.label} has no decision.`)
    return [{ candidate, decision }]
  })
}

/** The Encounter Action one candidate compiles to, as the Encounter builds it. */
function encounterAction(character: SrdCharacter, index: number) {
  const descriptors = discoverCharacterActionCapabilities({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: character.facts.actionCandidates,
    conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    entryPoints: character.entryPoints
  })
  const action = descriptors[index]
  const entry = compileCharacterActionEntryPoints({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: character.facts.actionCandidates,
    descriptors
  })[index]
  if (!action || entry?.kind !== 'CHARACTER_ACTION' || entry.schemaVersion !== 4)
    throw new Error('The attack must compile to a v4 Character action.')
  expect(entry.compilation.kind).toBe('COMPILED')
  const plan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
  const policy = buildCompiledActionTargetPolicy(action)
  return {
    plan,
    target: encounterActionChoiceTarget(policy),
    range: encounterActionChoiceRange(policy)
  }
}

describe('Hunter Volley (SPELLS-31.T5s)', () => {
  it('attacks with the wielded Longbow: its proficiency, damage and range', () => {
    const character = hunter('Volley', [{ label: 'Longbow', equipped: true }])
    const actions = optionActions(character, 'Volley')
    expect(actions.map(({ candidate }) => candidate.label)).toEqual(['Volley (Longbow)'])
    const [{ candidate, decision }] = actions as [(typeof actions)[number]]
    expect(candidate.activationSourceKind).toBe('ACTIVE_SOURCE_AND_EQUIPMENT')
    expect(candidate.equipment?.itemInstanceId).toBe(character.itemInstanceId('Longbow'))
    expect(candidate.mechanicFacts.invocation.activation?.code).toBe('ACTION')
    expect(decision.status).toBe('AVAILABLE')
    expect(decision.mechanic.attackKind).toBe('RANGED')
    expect(decision.mechanic.attackBonus).toBe(7)
    expect(damageExpression(decision)).toBe('1d8 + 3')
  })

  it('carries a magic bow bonus onto the attack', () => {
    const character = hunter('Volley', [{ label: 'Longbow +1', equipped: true }])
    const [{ decision }] = optionActions(character, 'Volley') as [
      ReturnType<typeof optionActions>[number]
    ]
    expect(decision.mechanic.attackBonus).toBe(8)
    expect(damageExpression(decision)).toBe('1d8 + 4')
  })

  it('attacks only with weapons that fire ammunition', () => {
    const character = hunter('Volley', [
      { label: 'Shortbow', equipped: true },
      { label: 'Dart' },
      { label: 'Longsword' }
    ])
    expect(optionActions(character, 'Volley').map(({ candidate }) => candidate.label)).toEqual([
      'Volley (Shortbow)'
    ])
  })

  it('reads the wield state the bow attack reads: a carried bow is drawn and stows a shield', () => {
    const character = hunter('Volley', [{ label: 'Longbow' }, { label: 'Shield', equipped: true }])
    const [volley] = optionActions(character, 'Volley')
    const bowIndex = character.facts.actionCandidates.findIndex(
      (candidate) =>
        candidate.mechanicsOwner.kind === 'EQUIPMENT' &&
        candidate.equipment?.itemInstanceId === character.itemInstanceId('Longbow')
    )
    const bow = character.output.actionDecisions[bowIndex]
    const wieldConflict = (candidate: (typeof character.facts.actionCandidates)[number]) =>
      evaluateEncounterCharacterActionWieldConflict({
        gameSystemId: DND5E_SYSTEM_ID,
        candidate,
        ruleFacts: character.facts,
        policyOutput: character.output
      })
    expect(volley?.decision.status).toBe('AVAILABLE')
    expect(volley?.decision.status).toBe(bow?.status)
    expect(wieldConflict(volley!.candidate)).toEqual(
      expect.objectContaining({
        kind: 'STOW_SHIELD',
        shieldItemInstanceId: character.itemInstanceId('Shield')
      })
    )
    expect(wieldConflict(volley!.candidate)).toEqual(
      wieldConflict(character.facts.actionCandidates[bowIndex]!)
    )
  })

  it.each([
    [true, true, 'AVAILABLE'],
    [true, false, 'UNAVAILABLE'],
    [false, true, 'UNAVAILABLE']
  ] as const)(
    'is available only while both its Feature (%s) and its bow (%s) are active',
    (featureActive, bowActive, status) => {
      const character = hunter('Volley', [{ label: 'Longbow', equipped: true }])
      const [volley] = optionActions(character, 'Volley')
      const { candidate } = volley!
      const output = evaluateDnd5e2014CharacterActions({
        candidates: [candidate],
        abilityDefinitions: [],
        spellCandidates: [],
        spellSlots: [],
        spellMechanics: [],
        proficiencies: [],
        itemAdjustments: [],
        spellcastingLocked: false,
        spellEffects: [],
        activeSourceIds: featureActive ? [candidate.sourceId] : [],
        activeEquipmentInstanceIds: bowActive ? [candidate.equipment!.itemInstanceId] : [],
        resources: [],
        modifierGroups: [],
        totalLevel: 11,
        classLevels: [],
        proficiencyBonus: 4,
        abilities: [],
        skills: [],
        spellcasting: null
      })
      expect(output.actionDecisions.map((decision) => decision.status)).toEqual([status])
    }
  )

  it('compiles to an Encounter attack on any creatures in a 10-foot sphere at a point in range', () => {
    const character = hunter('Volley', [{ label: 'Longbow', equipped: true }])
    const [{ candidate }] = optionActions(character, 'Volley') as [
      ReturnType<typeof optionActions>[number]
    ]
    const { plan, target, range } = encounterAction(
      character,
      character.facts.actionCandidates.indexOf(candidate)
    )
    expect(plan?.kind).toBe('TEST_OUTCOME')
    expect(target).toEqual({
      kind: 'ACTORS',
      area: { kind: 'RADIUS', radius: { amount: 10, unit: 'FEET' } }
    })
    expect(range.rangeLabel).toBe('150/600 ft')
  })
})

describe('Hunter Whirlwind Attack (SPELLS-31.T5s)', () => {
  it("attacks with the weapon's melee Attack action, never its thrown or off-hand attack", () => {
    const character = hunter('Whirlwind Attack', [{ label: 'Dagger', equipped: true }])
    const actions = optionActions(character, 'Whirlwind Attack')
    expect(actions.map(({ decision }) => decision.mechanic.attackKind)).toEqual(['MELEE'])
    expect(damageExpression(actions[0]!.decision)).toBe('1d4 + 3')
  })

  it('holds a reach weapon to creatures within 5 feet', () => {
    const character = hunter('Whirlwind Attack', [{ label: 'Glaive', equipped: true }])
    const actions = optionActions(character, 'Whirlwind Attack')
    expect(actions).toHaveLength(1)
    const { range, target } = encounterAction(
      character,
      character.facts.actionCandidates.indexOf(actions[0]!.candidate)
    )
    expect(range).toEqual({
      range: { kind: 'WITHIN', distance: { amount: 5, unit: 'FEET' } },
      rangeLabel: '5 ft'
    })
    expect(target).toEqual(expect.objectContaining({ kind: 'ACTORS' }))
    expect(damageExpression(actions[0]!.decision)).toBe('1d10 + 3')
  })
})
