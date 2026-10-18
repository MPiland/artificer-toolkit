import { describe, expect, it } from 'vitest'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { ManifestComponentAuthored } from '@artificer-toolkit/shared/authored'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import { conditionTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareNativeCharacterActionState } from '../character/characterNativeActionResources.js'
import {
  buildCharacterSpellCastActions,
  readSpellCastSlot,
  spellCastActionId
} from '../character/characterSpellCastActions.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscoveryRegistry.js'
import { characterRuleActionSystemAdapterRegistry } from '../characterRuleActionSystemAdapterRegistry.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { encounterActionChoiceTarget, evaluateEncounterZoneTarget } from '../encounterAreaAction.js'
import { DND5E_SAVE_DC_FACT_KEY } from '../systems/dnd5e/effectActionCompiler.js'
import { executeTargetBoundActiveRuleEffectWithPause } from '../targetBoundActiveRuleEffectExecutor.js'
import { createSrdRulesRuntime, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { fixedHealSpell } from '../testing/fixedHealSpell.js'
import { plannedTimedCondition } from '../testing/plannedTimedCondition.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'

type BuildInput = Parameters<typeof buildCharacterSpellCastActions>[0]
type SpellCastCandidate = BuildInput['spellCastCandidates'][number]
type Mechanic = CharacterRulePolicyOutput['spellCastMechanics'][number]['mechanics'][number]

const CHARACTER_ID = '00000000-0000-4000-8000-00000000b101'
const STREAM_VERSION = 3
const SLOT_ENTRY = { sourceIds: [] as string[], rawUsed: 0, effectiveUsed: 0, remaining: 2 }

const spell = (label: string): SpellAuthored => {
  const found = srdSpells.find((entry) => entry.label === label)
  if (!found) throw new Error(`SRD spell "${label}" is missing.`)
  return found
}
const FIREBALL = spell('Fireball')
const FLY = spell('Fly')
const HOLD_PERSON = spell('Hold Person')
const CURE_WOUNDS = spell('Cure Wounds')
const HEALING_WORD = spell('Healing Word')
const MAGE_ARMOR = spell('Mage Armor')
const SHIELD = spell('Shield')
const SHIELD_OF_FAITH = spell('Shield of Faith')
const INVISIBILITY = spell('Invisibility')
const CHARM_PERSON = spell('Charm Person')
const SLEEP = spell('Sleep')
const HYPNOTIC_PATTERN = spell('Hypnotic Pattern')
const FEAR = spell('Fear')
const PROTECTION_FROM_ENERGY = spell('Protection from Energy')
const BLINDNESS_DEAFNESS = spell('Blindness/Deafness')
const WALL_OF_FIRE = spell('Wall of Fire')
const WALL_OF_THORNS = spell('Wall of Thorns')
const MEND = { ...fixedHealSpell(), id: '00000000-0000-4000-8000-00000000c0de', label: 'Mend' }

/** The cast candidate of a spell at a level, the way the policy lists it. */
function candidate(
  authored: SpellAuthored,
  castLevel: number,
  overrides: Partial<SpellCastCandidate> = {}
): SpellCastCandidate {
  const sourceInstanceId = `class-${authored.id}`
  return {
    sequence: 0,
    candidateId: `CLASS:${sourceInstanceId}:${authored.id}:level:${castLevel}`,
    spellId: authored.id,
    source: { spellId: authored.id, sourceKind: 'CLASS', sourceInstanceId },
    spellLevel: authored.level,
    castMode: 'SPELL_SLOT',
    castLevel,
    baseEntry: castLevel === authored.level,
    resourceOwnerKey: null,
    ...overrides
  }
}

/** The mechanics the policy resolves for a spell: one per Effect, no outcomes needed to offer it. */
function mechanics(authored: SpellAuthored): Mechanic[] {
  return (compileSpell(authored).effects ?? []).map((effect) => ({
    effectId: effect.id,
    trigger: effect.invocation.triggerCode,
    activation: null,
    rangeLabel: null,
    attackKind: null,
    attackAbility: null,
    attackBonus: null,
    attackRollMode: null,
    save: null,
    outcomes: []
  }))
}

function policyFor(
  candidates: readonly SpellCastCandidate[],
  authoredById: ReadonlyMap<string, SpellAuthored>,
  slotKeyFor: (cast: SpellCastCandidate) => string | null = (cast) => `STANDARD:${cast.castLevel}`
) {
  return {
    spellCastDecisions: candidates.map(
      (cast): CharacterRulePolicyOutput['spellCastDecisions'][number] => ({
        candidateId: cast.candidateId,
        status: 'AVAILABLE',
        reasonCode: 'SPELL_SLOT_REMAINING',
        slotKey: slotKeyFor(cast)
      })
    ),
    spellCastMechanics: candidates.map((cast, sequence) => ({
      sequence,
      candidateId: cast.candidateId,
      spellId: cast.spellId,
      source: cast.source,
      castLevel: cast.castLevel,
      mechanics: mechanics(authoredById.get(cast.spellId)!)
    })),
    resources: [],
    spellSlots: {
      calculationId: 'slots',
      sourceClassIds: [],
      maxByLevel: [3, 4].map((spellLevel) => ({
        spellLevel,
        slotCount: 2,
        ...SLOT_ENTRY,
        ...(spellLevel === 3 ? { rawUsed: 1, effectiveUsed: 1, remaining: 1 } : {})
      })),
      pactMagic: null,
      fusionStrategy: 'NONE' as const
    }
  }
}

/** The spell with no explicit maintenance definition, as an author who only ticks Concentration writes it. */
function withoutExplicitMaintenance(authored: SpellAuthored): SpellAuthored {
  return JSON.parse(JSON.stringify(authored), (key, value) =>
    key === 'maintenanceDefinitionId' ? undefined : value
  )
}
const DERIVED_FLY = {
  ...withoutExplicitMaintenance(FLY),
  id: '00000000-0000-4000-8000-00000000f1a1'
}
const PLAIN_HOLD = {
  ...HOLD_PERSON,
  id: '00000000-0000-4000-8000-00000000b01d',
  attributes: [] as SpellAuthored['attributes']
}
/** Cure Wounds with the dice rows `rows` name instead of the SRD's, as `[level, order, dice]`. */
function healWithRows(
  id: string,
  rows: readonly (readonly [number, number, string])[]
): SpellAuthored {
  const authored = structuredClone(CURE_WOUNDS)
  const path = authored.effects?.[0]?.paths?.[0]
  const outcome = path && 'resultBlock' in path ? path.resultBlock.outcomes?.[0] : undefined
  if (outcome?.effectKind !== 'HEAL' || outcome.valueKind !== 'DICE' || !('levels' in outcome))
    throw new Error('Cure Wounds heals with scaling dice.')
  outcome.levels = rows.map(([level, order, diceConfig], index) => ({
    id: `00000000-0000-4000-8000-0000000000b${index}`,
    level,
    order,
    diceConfig
  }))
  return { ...authored, id, label: `Rows ${rows.map(([level]) => level).join(',')}` }
}
/** Rows at levels 1 and 3, and a second level-3 row that a higher `order` ranks behind the first. */
const GAPPED_HEAL = healWithRows('00000000-0000-4000-8000-00000000c001', [
  [1, 0, '1d4'],
  [3, 0, '3d4'],
  [3, 1, '9d4']
])
/** The first row sits above the spell's own level, so no row applies to a cast at it. */
const LATE_HEAL = healWithRows('00000000-0000-4000-8000-00000000c002', [[3, 0, '3d4']])
const FIRE_TYPE_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')!.id
/** Invisibility whose condition also ends when its holder takes fire damage from the caster's side. */
const SCORCHED_INVISIBILITY = (() => {
  const authored = structuredClone(INVISIBILITY)
  const path = authored.effects?.[0]?.paths?.[0]
  if (!path || !('resultBlock' in path) || !path.resultBlock.lifecycle)
    throw new Error('Invisibility ends through its authored lifecycle.')
  path.resultBlock.lifecycle.endOnTriggers = [
    { event: 'SPELL_CAST', against: 'ENEMY' },
    { event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: [FIRE_TYPE_ID, FIRE_TYPE_ID] },
    { event: 'ATTACK_ROLL', against: 'ENEMY' },
    { event: 'DAMAGE_TAKEN', by: 'ANYONE' },
    { event: 'ATTACK_ROLL', against: 'ENEMY' }
  ]
  return { ...authored, id: '00000000-0000-4000-8000-00000000c003', label: 'Scorched Invisibility' }
})()
const conditionId = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)?.id
/**
 * A homebrew spell built from Hold Person's core options: Poisoned for 1 minute, re-saved only
 * while the target can see its caster, no Concentration. Nothing in it is Fear-specific.
 */
const WATCHFUL_MIASMA: SpellAuthored = (() => {
  const authored = structuredClone(HOLD_PERSON)
  const path = authored.effects?.[0]?.paths?.[0]
  const [condition, save] = path && 'resultBlock' in path ? (path.resultBlock.outcomes ?? []) : []
  if (condition?.effectKind !== 'CONDITION' || save?.effectKind !== 'FOLLOW_UP_SAVE')
    throw new Error('Hold Person fails into a condition and a repeat save.')
  condition.conditionId = conditionId('POISONED')!
  save.repeatAttemptGate = {
    allow: 'WHEN_MET',
    when: { kind: 'PERCEPTION', observer: 'TARGET', subject: 'SOURCE', requirement: 'SEE' }
  }
  return {
    ...authored,
    id: '00000000-0000-4000-8000-00000000c004',
    label: 'Watchful Miasma',
    attributes: []
  }
})()
const srdEffect = HYPNOTIC_PATTERN.effects?.[0]
if (!srdEffect) throw new Error('Hypnotic Pattern has no effect.')
/** Hypnotic Pattern written out in core options alone, with no SRD helper (the parity proof). */
const HYPNOTIC_PATTERN_FROM_CORE_OPTIONS = {
  ...HYPNOTIC_PATTERN,
  id: testUuid(0x30ff),
  effects: [
    {
      id: testUuid(0x3100),
      order: 1,
      invocation: {
        ...srdEffect.invocation,
        range: { id: testUuid(0x3101), rangeKind: 'DISTANCE', amount: 120, unit: 'FEET' },
        shape: {
          id: testUuid(0x3102),
          shapeKind: 'CUBE',
          edgeLength: { amount: 30, unit: 'FEET' }
        },
        savingThrow: {
          id: testUuid(0x3103),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_ABILITIES.find(({ code }) => code === 'WISDOM')?.id
        }
      },
      paths: [
        {
          id: testUuid(0x3104),
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: testUuid(0x3105),
            resultKind: 'SINGLE',
            duration: { id: testUuid(0x3106), durationKind: 'MINUTE', amount: 1 },
            lifecycle: {
              endOnTriggers: [
                { event: 'DAMAGE_TAKEN', by: 'ANYONE' },
                {
                  event: 'ACTION_USED_ON_HOLDER',
                  actionDefinitionIds: [SRD_BASIC_ACTION_IDS.ROUSE]
                }
              ]
            },
            outcomes: [
              {
                id: testUuid(0x3107),
                effectKind: 'CONDITION',
                conditionId: conditionId('CHARMED')
              },
              {
                id: testUuid(0x3108),
                effectKind: 'CONDITION',
                conditionId: conditionId('INCAPACITATED')
              },
              {
                id: testUuid(0x3109),
                effectKind: 'APPLY_GRANT',
                grants: {
                  modifiers: [
                    {
                      id: testUuid(0x310a),
                      grantKind: 'MODIFIER_GRANT',
                      valueDomainCode: 'SPEED',
                      domain: {},
                      modifierKind: 'MULTIPLY',
                      scope: 'GLOBAL',
                      selectionKind: 'GRANTED',
                      payload: { numerator: 0, denominator: 1 },
                      order: 1
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
  ]
} as SpellAuthored

/** Protection from Energy cast on its caster alone, so its pick has no chosen creature to go with. */
const PROTECTION_FROM_ENERGY_ON_SELF = {
  ...PROTECTION_FROM_ENERGY,
  id: testUuid(0x3200),
  effects: PROTECTION_FROM_ENERGY.effects?.map((effect) => ({
    ...effect,
    invocation: {
      ...effect.invocation,
      range: { ...effect.invocation.range, rangeKind: 'SELF' },
      targeting: { selectionKind: 'SELF' }
    }
  }))
} as SpellAuthored

const authoredById = new Map(
  [
    SLEEP,
    WALL_OF_FIRE,
    WALL_OF_THORNS,
    HYPNOTIC_PATTERN,
    HYPNOTIC_PATTERN_FROM_CORE_OPTIONS,
    SCORCHED_INVISIBILITY,
    FIREBALL,
    MEND,
    FLY,
    HOLD_PERSON,
    DERIVED_FLY,
    PLAIN_HOLD,
    CURE_WOUNDS,
    HEALING_WORD,
    SHIELD,
    SHIELD_OF_FAITH,
    INVISIBILITY,
    CHARM_PERSON,
    FEAR,
    PROTECTION_FROM_ENERGY,
    PROTECTION_FROM_ENERGY_ON_SELF,
    BLINDNESS_DEAFNESS,
    WATCHFUL_MIASMA,
    GAPPED_HEAL,
    LATE_HEAL
  ].map((entry) => [entry.id, entry])
)

function build(
  candidates: readonly SpellCastCandidate[],
  overrides: Partial<BuildInput> = {},
  slotKeyFor?: Parameters<typeof policyFor>[2]
) {
  return buildCharacterSpellCastActions({
    spellCastCandidates: candidates,
    castableCandidateIds: new Set(candidates.map((cast) => cast.candidateId)),
    spellDocumentsById: authoredById,
    firstSequence: 10,
    characterLevel: 1,
    ...overrides,
    policyOutput: overrides.policyOutput ?? policyFor(candidates, authoredById, slotKeyFor)
  })
}

/** The compiled entry the Encounter would run for the spell's cast, or null when it stays manual. */
function compiledCastEntry(authored: SpellAuthored, castLevel = authored.level) {
  const cast = candidate(authored, castLevel)
  // The spell as given, which may be a changed copy of a listed one.
  const documents = new Map([...authoredById, [authored.id, authored]])
  const built = build([cast], {
    policyOutput: policyFor([cast], documents),
    spellDocumentsById: documents
  })
  const compiled = compileCharacterActionEntryPoints({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: built.candidates,
    descriptors: discoverCharacterActionCapabilities({
      gameSystemId: SRD_SYSTEM_ID,
      candidates: built.candidates,
      conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
      abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
      entryPoints: built.entryPoints
    })
  })
  const [entry] = compiled
  return entry?.kind === 'CHARACTER_ACTION' &&
    entry.schemaVersion === 4 &&
    entry.compilation.kind === 'COMPILED'
    ? entry
    : null
}

/** The compiled plans the Encounter would run for the spell's cast, or null when it stays manual. */
const compiledCast = (authored: SpellAuthored, castLevel = authored.level) =>
  compiledCastEntry(authored, castLevel)?.compilation ?? null

describe('the cast choices an Encounter offers a Character', () => {
  const levels = [3, 4].map((level) => candidate(FIREBALL, level))

  it('offers one action per cast level, titled by the level', () => {
    const built = build(levels)
    expect(built.candidates.map((entry) => entry.label)).toEqual([
      'Fireball (3rd level)',
      'Fireball (4th level)'
    ])
    expect(built.candidates.map((entry) => entry.sequence)).toEqual([10, 11])
    expect(new Set(built.candidates.map((entry) => entry.actionId)).size).toBe(2)
    expect(built.decisions.map((entry) => entry.actionId)).toEqual(
      built.candidates.map((entry) => entry.actionId)
    )
    expect(built.entryPoints.map((entry) => entry.actionId)).toEqual(
      built.candidates.map((entry) => entry.actionId)
    )
  })

  it('titles a cantrip by its name alone', () => {
    const cantrip = { ...FIREBALL, level: 0 }
    const built = build([candidate(cantrip, 0)], {
      spellDocumentsById: new Map([[cantrip.id, cantrip]])
    })
    expect(built.candidates.map((entry) => entry.label)).toEqual(['Fireball'])
  })

  it('keeps an action id a fixed length however long the candidate id is', () => {
    const long = candidate(FIREBALL, 3, { candidateId: `CLASS:${'x'.repeat(900)}:level:3` })
    const [built] = build([long]).candidates
    expect(built?.actionId).toBe(spellCastActionId(long.candidateId))
    expect(built?.actionId).toHaveLength(spellCastActionId(levels[0]!.candidateId).length)
    expect(spellCastActionId(long.candidateId)).not.toBe(spellCastActionId(`${long.candidateId}.`))
  })

  it('does not offer a ritual', () => {
    expect(build([candidate(FIREBALL, 3, { castMode: 'RITUAL' })]).candidates).toEqual([])
  })

  it('does not offer a cast the Sheet does not list as castable', () => {
    expect(
      build(levels, { castableCandidateIds: new Set([levels[1]!.candidateId]) }).candidates.map(
        (entry) => entry.sourceId
      )
    ).toEqual([levels[1]!.candidateId])
  })

  it('does not offer a cast whose decision is unavailable or whose spell is missing', () => {
    const unavailable = policyFor(levels, authoredById)
    unavailable.spellCastDecisions[0] = {
      candidateId: levels[0]!.candidateId,
      status: 'UNAVAILABLE',
      reasonCode: 'SPELL_SLOT_EXHAUSTED',
      slotKey: null
    }
    expect(
      build(levels, { policyOutput: unavailable }).candidates.map((entry) => entry.sourceId)
    ).toEqual([levels[1]!.candidateId])
    expect(build(levels, { spellDocumentsById: new Map() }).candidates).toEqual([])
  })
})

describe('what a leveled cast carries into the Encounter action', () => {
  const candidates = [candidate(FIREBALL, 3), candidate(MEND, 4)]
  const built = build(candidates)
  const policy = policyFor(candidates, authoredById)
  const character = evaluateSrdCharacter({ classes: [{ label: 'Fighter', level: 1 }] })
  const policyOutput: CharacterRulePolicyOutput = {
    ...character.output,
    ...policy,
    actionDecisions: built.decisions
  }
  const compiled = compileCharacterActionEntryPoints({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: built.candidates,
    descriptors: discoverCharacterActionCapabilities({
      gameSystemId: SRD_SYSTEM_ID,
      candidates: built.candidates,
      conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
      abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
      entryPoints: built.entryPoints
    })
  })

  function prepare(index: number, automationMode: 'ASSISTED' | 'MANUAL') {
    const cast = built.candidates[index]!
    const entry = compiled.find(
      (value) =>
        value.kind === 'CHARACTER_ACTION' &&
        value.schemaVersion === 4 &&
        value.compilation.kind === 'COMPILED' &&
        value.actionId === cast.actionId
    )
    if (entry?.kind !== 'CHARACTER_ACTION' || entry.schemaVersion !== 4)
      throw new Error('The spell cast must compile to a v4 entry.')
    if (entry.compilation.kind !== 'COMPILED') throw new Error('The spell cast must compile.')
    return prepareNativeCharacterActionState({
      entry: { ...entry, compilation: entry.compilation },
      candidate: cast,
      policyOutput,
      resourceUsage: [],
      inventory: [],
      itemUsage: [],
      characterId: CHARACTER_ID,
      expectedStreamVersion: STREAM_VERSION,
      classLevels: character.facts.grantFoldFacts.base.classes,
      automationMode,
      overridable: true
    })
  }

  it.each([
    ['a damage spell', 0, 3],
    ['a non-damage spell', 1, 4]
  ])('names the cast level of %s on the action mechanic', (_name, index, castLevel) => {
    expect(prepare(index, 'ASSISTED').actionMechanic.spellCastLevel).toBe(castLevel)
  })

  it('spends the slot its decision names, from the uses already spent, in Assisted play', () => {
    expect(prepare(0, 'ASSISTED').spellConsumption).toEqual({
      characterId: CHARACTER_ID,
      spellId: FIREBALL.id,
      candidateId: candidates[0]!.candidateId,
      slotKey: 'STANDARD:3',
      beforeUsed: 1,
      afterUsed: 2,
      expectedStreamVersion: STREAM_VERSION
    })
  })

  it('spends nothing in Manual play, though the cast is still offered at its level', () => {
    const manual = prepare(0, 'MANUAL')
    expect(manual.spellConsumption).toBeNull()
    expect(manual.actionMechanic.spellCastLevel).toBe(3)
  })

  it('reads the slot a key names, a pact slot included', () => {
    expect(readSpellCastSlot(policy.spellSlots, 'STANDARD:3')).toEqual({ level: 3, used: 1 })
    expect(readSpellCastSlot(policy.spellSlots, 'STANDARD:9')).toBeNull()
    expect(readSpellCastSlot(policy.spellSlots, 'PACT')).toBeNull()
    expect(
      readSpellCastSlot(
        {
          ...policy.spellSlots,
          pactMagic: {
            sourceClassId: 'warlock',
            slots: 2,
            level: 3,
            rawUsed: 1,
            effectiveUsed: 1,
            remaining: 1
          }
        },
        'PACT'
      )
    ).toEqual({ level: 3, used: 1 })
  })
})

describe('a cast paid from a spell-source pool', () => {
  const GRANT_ID = 'grant-1'
  const SOURCE_INSTANCE_ID = 'feature-1'
  const CHARGE_ID = 'charge-1'
  const source = {
    spellId: FIREBALL.id,
    sourceKind: 'FEATURE' as const,
    sourceInstanceId: SOURCE_INSTANCE_ID
  }
  const owner = {
    kind: 'SPELL_SOURCE' as const,
    resourceGrantId: GRANT_ID,
    spellId: FIREBALL.id,
    sourceKind: 'FEATURE' as const,
    sourceInstanceId: SOURCE_INSTANCE_ID
  }
  const poolId = createCharacterResourceOwnerKey(owner)
  const pool = (rawUsed: number): CharacterRulePolicyOutput['resources'][number] => ({
    ownerKind: 'SPELL_SOURCE',
    sequence: 0,
    poolId,
    resourceDefinitionId: CHARGE_ID,
    chargeId: CHARGE_ID,
    chargeCalculationId: poolId,
    accessId: GRANT_ID,
    sourceInstanceId: SOURCE_INSTANCE_ID,
    spellId: FIREBALL.id,
    state: 'RESOLVED',
    maximum: 2,
    rawUsed,
    effectiveUsed: rawUsed,
    remaining: 2 - rawUsed,
    reasonCode: 'CALCULATED',
    baseContribution: null,
    bonusContributions: [],
    resetKind: 'LONG_REST',
    resetResolution: { baseResetKind: 'LONG_REST', appliedGrantId: null, source: null }
  })
  const pooled = (castMode: 'LIMITED_USE' | 'FIXED_LEVEL', authored = FIREBALL) =>
    candidate(authored, authored.level, {
      candidateId: `FEATURE:${SOURCE_INSTANCE_ID}:${authored.id}:level:${authored.level}`,
      source,
      castMode,
      resourceOwnerKey: poolId
    })
  const buildPooled = (cast: SpellCastCandidate, rawUsed = 0) =>
    build([cast], {
      policyOutput: { ...policyFor([cast], authoredById, () => null), resources: [pool(rawUsed)] }
    })
  const character = evaluateSrdCharacter({ classes: [{ label: 'Fighter', level: 1 }] })

  function prepare(
    cast: SpellCastCandidate,
    rawUsed: number,
    automationMode: 'ASSISTED' | 'MANUAL'
  ) {
    const built = buildPooled(cast, rawUsed)
    const [entry] = compileCharacterActionEntryPoints({
      gameSystemId: SRD_SYSTEM_ID,
      candidates: built.candidates,
      descriptors: discoverCharacterActionCapabilities({
        gameSystemId: SRD_SYSTEM_ID,
        candidates: built.candidates,
        conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
        abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
        entryPoints: built.entryPoints
      })
    })
    if (entry?.kind !== 'CHARACTER_ACTION' || entry.schemaVersion !== 4)
      throw new Error('The spell cast must compile to a v4 entry.')
    if (entry.compilation.kind !== 'COMPILED') throw new Error('The spell cast must compile.')
    const [offered] = built.candidates
    if (!offered) throw new Error('The spell cast must be offered.')
    return {
      entry,
      built,
      prepared: prepareNativeCharacterActionState({
        entry: { ...entry, compilation: entry.compilation },
        candidate: offered,
        policyOutput: {
          ...character.output,
          ...policyFor([cast], authoredById, () => null),
          resources: [pool(rawUsed)],
          actionDecisions: built.decisions
        },
        resourceUsage:
          rawUsed === 0
            ? []
            : [
                {
                  id: 'usage-1',
                  characterId: CHARACTER_ID,
                  owner,
                  used: rawUsed,
                  createdBy: 'user',
                  updatedBy: 'user',
                  createdAt: '2026-01-01T00:00:00.000Z',
                  updatedAt: '2026-01-01T00:00:00.000Z'
                }
              ],
        inventory: [],
        itemUsage: [],
        characterId: CHARACTER_ID,
        expectedStreamVersion: STREAM_VERSION,
        classLevels: character.facts.grantFoldFacts.base.classes,
        automationMode,
        overridable: false
      })
    }
  }

  it.each(['LIMITED_USE', 'FIXED_LEVEL'] as const)(
    'offers a %s cast bound to its pool at the cost of one use',
    (castMode) => {
      const { entry, built } = prepare(pooled(castMode), 0, 'ASSISTED')
      const binding = { poolId, chargeId: CHARGE_ID, cost: 1 }
      expect(built.candidates.map((value) => value.resourceUse)).toEqual([binding])
      expect(built.decisions).toMatchObject([{ resourcePoolId: poolId, resourceCost: 1 }])
      expect(entry.compilation.resourceBinding).toEqual(binding)
    }
  )

  it('spends one use of the pool and no slot, from the uses already spent, in Assisted play', () => {
    const { prepared } = prepare(pooled('LIMITED_USE'), 1, 'ASSISTED')
    expect(prepared.spellConsumption).toBeNull()
    expect(prepared.resourceConsumption).toMatchObject({
      poolId,
      chargeId: CHARGE_ID,
      cost: 1,
      owner,
      usageId: 'usage-1',
      beforeUsed: 1,
      afterUsed: 2,
      beforeRemaining: 1,
      afterRemaining: 0,
      characterId: CHARACTER_ID,
      expectedStreamVersion: STREAM_VERSION
    })
  })

  it('spends nothing in Manual play', () => {
    const { prepared } = prepare(pooled('LIMITED_USE'), 0, 'MANUAL')
    expect(prepared.resourceConsumption).toBeNull()
    expect(prepared.spellConsumption).toBeNull()
  })

  it('spends nothing for a cantrip, which is free as on the Sheet', () => {
    const cantrip = { ...FIREBALL, level: 0 }
    const cast = candidate(cantrip, 0, {
      castMode: 'LIMITED_USE',
      resourceOwnerKey: poolId,
      source
    })
    const [offered] = build([cast], {
      spellDocumentsById: new Map([[cantrip.id, cantrip]])
    }).candidates
    expect(offered?.resourceUse).toBeNull()
  })
})

describe('the Concentration a cast starts', () => {
  it('marks the Effect group of a Concentration spell and no other', () => {
    expect(compileSpell(HOLD_PERSON).effects?.map((group) => group.requiresConcentration)).toEqual([
      true
    ])
    expect(compileSpell(PLAIN_HOLD).effects?.map((group) => group.requiresConcentration)).toEqual([
      undefined
    ])
    expect(compileSpell(FIREBALL).effects?.some((group) => group.requiresConcentration)).toBe(false)
  })

  it('derives the maintenance from the CONCENTRATION attribute when the author names none', () => {
    const maintenance = compiledCast(DERIVED_FLY)?.activeEffectPlan?.maintenance
    expect(maintenance).toEqual({
      definitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
      definitionChecksum: null,
      owner: 'SOURCE_ACTOR',
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    })
    expect(maintenance).toEqual(compiledCast(FLY)?.activeEffectPlan?.maintenance)
  })

  it('compiles Hold Person with the Concentration maintenance and the caster save DC', () => {
    const plan = compiledCast(HOLD_PERSON)?.activeEffectPlan
    expect(plan?.maintenance?.definitionId).toBe(SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
    expect(plan?.conditionContributions).toHaveLength(1)
  })

  it('plans the Frightened of SRD Fear as recording its caster; Hold Person records none (SPELLS-29)', () => {
    expect(compiledCast(FEAR)?.activeEffectPlan?.conditionContributions).toMatchObject([
      { recordsSource: true }
    ])
    expect(compiledCast(HOLD_PERSON)?.activeEffectPlan?.conditionContributions).toMatchObject([
      { recordsSource: false }
    ])
  })

  it('plans the Frightened of SRD Fear as fleeing its caster; Hold Person flees none (SPELLS-29.T2)', () => {
    expect(compiledCast(FEAR)?.activeEffectPlan?.conditionContributions).toMatchObject([
      { fleesSource: true }
    ])
    expect(compiledCast(HOLD_PERSON)?.activeEffectPlan?.conditionContributions).toMatchObject([
      { fleesSource: false }
    ])
  })

  it('starts no Concentration for a spell that is not a Concentration spell', () => {
    const plan = compiledCast(PLAIN_HOLD)?.activeEffectPlan
    expect(plan).toBeDefined()
    expect(plan?.maintenance).toBeNull()
  })
})

describe('the activation a cast carries', () => {
  it.each([
    { authored: CURE_WOUNDS, activation: 'ACTION' },
    { authored: HEALING_WORD, activation: 'BONUS_ACTION' },
    { authored: SHIELD_OF_FAITH, activation: 'BONUS_ACTION' },
    { authored: SHIELD, activation: 'REACTION' }
  ])(
    'offers $authored.label with the $activation its Effect authors, ready to run',
    ({ authored, activation }) => {
      const [offered] = build([candidate(authored, authored.level)]).candidates
      expect(offered?.mechanicFacts.invocation.activation).toEqual({ code: activation, amount: 1 })
      expect(compiledCast(authored)).not.toBeNull()
    }
  )
})

describe('the timed condition a cast owns with no save', () => {
  const invisibleId = SRD_CONDITION_TYPES.find(({ code }) => code === 'INVISIBLE')?.id

  it('owns Invisibility’s condition for 600 turns and carries its authored end events', () => {
    const plan = compiledCast(INVISIBILITY)?.activeEffectPlan
    expect(plan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 600,
      conditionContributions: [{ conditionId: invisibleId }],
      lifecycle: {
        consumeOnFirstEvents: [],
        endOnEvents: ['ON_ATTACK_ROLL', 'ON_CAST_SPELL']
      }
    })
    expect(plan?.maintenance?.definitionId).toBe(SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
  })

  it('carries authored end triggers with explicit filters, unique and in canonical order', () => {
    const plan = compiledCast(SCORCHED_INVISIBILITY)?.activeEffectPlan
    expect(plan?.lifecycle?.endOnTriggers).toEqual([
      { event: 'ATTACK_ROLL', against: 'ENEMY' },
      { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null },
      { event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: [FIRE_TYPE_ID] },
      { event: 'SPELL_CAST', against: 'ENEMY' }
    ])
  })
})

describe('the timed condition a save cast owns (SPELLS-27.T5)', () => {
  it('owns Charm Person’s one-hour charmed condition and ends it on damage from the caster’s side', () => {
    const charmedId = SRD_CONDITION_TYPES.find(({ code }) => code === 'CHARMED')?.id
    expect(compiledCast(CHARM_PERSON)?.activeEffectPlan).toMatchObject({
      initialRemaining: 600,
      conditionContributions: [{ conditionId: charmedId }],
      lifecycle: {
        endOnTriggers: [{ event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: null }]
      }
    })
  })
})

describe('the conditions and speed a save cast owns together (SPELLS-27.T9)', () => {
  const ROUSE_OR_DAMAGE = [
    { event: 'ACTION_USED_ON_HOLDER', actionDefinitionIds: [SRD_BASIC_ACTION_IDS.ROUSE] },
    { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }
  ]

  it('owns Hypnotic Pattern’s charmed, incapacitated and speed of 0 as one effect that ends on damage or a rousing', () => {
    const plan = compiledCast(HYPNOTIC_PATTERN)?.activeEffectPlan
    expect(plan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      conditionContributions: [
        { conditionId: conditionId('CHARMED') },
        { conditionId: conditionId('INCAPACITATED') }
      ],
      modifierGrantContribution: {
        countedByTurnEffects: true,
        consumeOnFirstEvents: [],
        endOnEvents: [],
        modifiers: [{ valueDomainCode: 'SPEED', modifierKind: 'MULTIPLY' }]
      },
      lifecycle: { endOnTriggers: ROUSE_OR_DAMAGE }
    })
    expect(plan?.maintenance?.definitionId).toBe(SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
  })

  // Parity: the same spell written out in core options alone (no SRD helper) compiles to this plan.
  it('compiles a spell authored from core options only to the same plan as the SRD data', () => {
    const srd = compiledCast(HYPNOTIC_PATTERN)?.activeEffectPlan
    const plan = compiledCast(HYPNOTIC_PATTERN_FROM_CORE_OPTIONS)?.activeEffectPlan
    expect(plan).not.toBeNull()
    expect(plan).toMatchObject({
      recurrenceStage: srd?.recurrenceStage,
      initialRemaining: srd?.initialRemaining,
      conditionContributions: srd?.conditionContributions,
      lifecycle: srd?.lifecycle,
      modifierGrantContribution: {
        modifiers: srd?.modifierGrantContribution?.modifiers.map(({ grantId, ...rest }) =>
          expect.objectContaining(rest)
        ),
        countedByTurnEffects: true
      }
    })
  })
})

describe('a cast that picks what it does to its targets (SPELLS-30.T1, D148)', () => {
  const damageTypeId = (code: string) => SRD_DAMAGE_TYPES.find((entry) => entry.code === code)?.id

  it('compiles Protection from Energy to one resistance grant per damage type, each under the cast’s Concentration', () => {
    const options = compiledCast(PROTECTION_FROM_ENERGY)?.choice?.options ?? []

    expect(options.map(({ label }) => label)).toEqual([
      'Acid',
      'Cold',
      'Fire',
      'Lightning',
      'Thunder'
    ])
    for (const [index, code] of ['ACID', 'COLD', 'FIRE', 'LIGHTNING', 'THUNDER'].entries()) {
      expect(options[index]?.activeEffectPlan, code).toMatchObject({
        modifierGrantContribution: {
          modifiers: [
            { valueDomainCode: 'DAMAGE_RESISTANCE', payload: { damageTypeId: damageTypeId(code) } }
          ]
        },
        maintenance: { definitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
      })
    }
  })

  it('runs the first option at the top level and offers every option on the creature it touches', () => {
    const entry = compiledCastEntry(PROTECTION_FROM_ENERGY)
    const options = entry?.compilation.choice?.options ?? []

    expect(entry?.compilation.activeEffectPlan).toEqual(options[0]?.activeEffectPlan)
    expect(entry?.compilation.executionPlan).toEqual(options[0]?.executionPlan)
    expect(
      encounterActionChoiceTarget(entry?.targetPolicy, null, null, entry?.compilation.choice)
    ).toMatchObject({
      kind: 'ACTOR',
      choiceOptions: options.map(({ optionId, label }) => ({ id: optionId, label }))
    })
  })

  it('compiles Blindness/Deafness to the picked condition on a failed save, repeated at the end of each of its turns', () => {
    const options = compiledCast(BLINDNESS_DEAFNESS)?.choice?.options ?? []

    expect(options.map(({ label }) => label)).toEqual(['Blindness', 'Deafness'])
    for (const [index, code] of ['BLINDED', 'DEAFENED'].entries()) {
      expect(options[index]?.executionPlan.kind, code).toBe('TEST_OUTCOME')
      expect(options[index]?.activeEffectPlan, code).toMatchObject({
        recurrenceStage: 'END_OF_TURN',
        initialRemaining: 10,
        conditionContributions: [{ conditionId: conditionId(code) }],
        maintenance: null
      })
    }
  })

  it('reaches one more creature for each slot level above 2nd, each offered both options', () => {
    const second = compiledCastEntry(BLINDNESS_DEAFNESS, 2)
    const third = compiledCastEntry(BLINDNESS_DEAFNESS, 3)

    expect(second?.targetPolicy?.targeting).toMatchObject({ maxTargets: 1 })
    expect(
      encounterActionChoiceTarget(third?.targetPolicy, null, null, third?.compilation.choice)
    ).toMatchObject({
      kind: 'ACTORS',
      maxTargets: 2,
      choiceOptions: [{ label: 'Blindness' }, { label: 'Deafness' }]
    })
  })

  it('stays manual when its pick has no chosen creature to travel with', () => {
    expect(compiledCastEntry(PROTECTION_FROM_ENERGY)?.compilation.choice).not.toBeNull()
    expect(compiledCastEntry(PROTECTION_FROM_ENERGY_ON_SELF)).toBeNull()
  })
})

describe('a wall cast as a straight wall or a ring (SPELLS-4.T1b, D154)', () => {
  const feet = (amount: number) => ({ amount, unit: 'FEET' })
  const zoneOptions = (authored: SpellAuthored, castLevel = authored.level) => {
    const entry = compiledCastEntry(authored, castLevel)
    const placement = entry?.compilation.zonePlacement
    if (!placement || !('options' in placement)) throw new Error('The wall must offer two zones.')
    return { entry, options: placement.options }
  }
  /** The damage dice a zone's entry rolls, by their size; a save's d20 is not one. */
  const entryDice = (
    zone: Pick<ReturnType<typeof zoneOptions>['options'][number]['zone'], 'entry'>
  ) =>
    zone.entry.frozenGraph.definition.nodes
      .filter(
        (node) =>
          node.id !== 'd20' &&
          ['evidence.integer-range', 'evidence.optional-integer-range'].includes(node.operation.key)
      )
      .map((node) => node.inputs.max)

  it('offers Wall of Fire as a straight wall or a ring to pick, then aim', () => {
    const { entry, options } = zoneOptions(WALL_OF_FIRE)

    expect(
      encounterActionChoiceTarget(entry?.targetPolicy, null, entry?.compilation.zonePlacement)
    ).toEqual({
      kind: 'ZONE_OPTIONS',
      options: [
        {
          id: options[0]!.optionId,
          label: 'Straight Wall',
          target: {
            kind: 'WALL',
            area: { maxLength: feet(60), thickness: feet(1) },
            sideBand: { distance: feet(10) }
          }
        },
        {
          id: options[1]!.optionId,
          label: 'Ringed Wall',
          target: {
            kind: 'RING',
            area: { maxOuterRadius: feet(10), thickness: feet(1) },
            sideBand: { distance: feet(10) }
          }
        }
      ]
    })
  })

  it('burns, with no save, a creature entering or crossing Wall of Fire once a turn, and one ending its turn in the wall or within 10 feet on its burning side, through its Concentration', () => {
    const { options } = zoneOptions(WALL_OF_FIRE)
    for (const { zone } of options) {
      expect(zone).not.toHaveProperty('turnTriggers')
      expect(zone).toMatchObject({
        attachment: 'PLACED_SPACE',
        triggerModes: ['ENTER', 'CROSS'],
        maxApplicationsPerTurn: 1,
        blockingRules: ['BLOCKS_SIGHT'],
        maintenance: { definitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
      })
      // The band of the burning side (the D154 amendment) shares the wall's Concentration.
      expect(zone.regionComponents).toMatchObject([
        {
          region: { kind: 'SIDE_BAND', distance: feet(10) },
          label: 'Wall of Fire Burning Side',
          triggerModes: [],
          turnTriggers: ['END_OF_TURN']
        }
      ])
      expect(zone.regionComponents?.[0]).not.toHaveProperty('maintenance')
      expect(entryDice(zone.regionComponents![0]!)).toEqual(entryDice(zone))
    }
    expect(options[0]?.zone.entry.castSaveDcFactKey).toBeNull()
    expect(options[0]?.zone).not.toHaveProperty('ringThickness')
    expect(options[1]?.zone.ringThickness).toEqual(feet(1))
    expect(entryDice(options[0]!.zone)).toEqual(Array(5).fill({ kind: 'LITERAL', value: 8 }))
    expect(entryDice(zoneOptions(WALL_OF_FIRE, 6).options[1]!.zone)).toEqual(
      Array(7).fill({ kind: 'LITERAL', value: 8 })
    )
  })

  /** Wall of Fire with each of its zones' components, the wall and its band, changed by `change`. */
  function withFireComponents(
    change: (
      wall: ManifestComponentAuthored,
      band: ManifestComponentAuthored
    ) => ManifestComponentAuthored[]
  ) {
    const authored = structuredClone(WALL_OF_FIRE)
    const path = authored.effects?.[0]?.paths[0]
    if (path?.selectionKind !== 'CHOICE') throw new Error('Wall of Fire must offer its zones.')
    for (const { resultBlock } of path.options)
      for (const outcome of resultBlock.outcomes) {
        if (!('components' in outcome)) continue
        const [wall, band] = outcome.components ?? []
        if (!wall || !band) throw new Error('Each Wall of Fire zone must author its wall and band.')
        outcome.components = change(wall, band)
      }
    return authored
  }

  it.each([
    {
      name: 'a band on the wall itself',
      change: (wall: ManifestComponentAuthored, band: ManifestComponentAuthored) => [
        { ...wall, region: band.region },
        band
      ]
    },
    {
      name: 'a second component with no band',
      change: (
        wall: ManifestComponentAuthored,
        { region: _region, ...band }: ManifestComponentAuthored
      ) => [wall, band]
    },
    {
      name: 'two bands beside one wall',
      change: (wall: ManifestComponentAuthored, band: ManifestComponentAuthored) => [
        wall,
        band,
        { ...band, id: testUuid(0xb3a9), order: 3 }
      ]
    },
    {
      name: 'a band that spares creatures its caster chooses',
      change: (wall: ManifestComponentAuthored, band: ManifestComponentAuthored) => [
        wall,
        { ...band, choosesUnaffected: true }
      ]
    }
  ])('casts no zone for $name (D154 amendment)', ({ change }) => {
    expect(compiledCastEntry(withFireComponents(change))).toBeNull()
  })

  it('takes a side only for a wall whose zone reaches a band beside it (D154 amendment)', () => {
    const aimedWall = (authored: SpellAuthored, side?: 'LEFT' | 'RIGHT') => {
      const { entry, options } = zoneOptions(authored)
      if (!entry?.targetPolicy) throw new Error(`${authored.label} must compile with its range.`)
      return evaluateEncounterZoneTarget({
        zone: options[0]!.zone,
        range: entry.targetPolicy.range,
        target: {
          kind: 'WALL',
          sceneId: testUuid(0xb3b0),
          expectedSceneVersion: 1,
          from: { x: 0, y: 0 },
          to: { x: 0, y: 600 },
          ...(side ? { side } : {})
        },
        grid: {
          kind: 'SQUARE',
          cellSize: 100,
          diagonalPolicy: 'EQUAL',
          distancePerCell: 5,
          origin: { x: 0, y: 0 },
          unit: 'FEET'
        },
        sourceToken: { position: { x: 0, y: 0 }, height: 1, width: 1, rotationDegrees: 0 },
        aimSeen: true
      })
    }

    expect(aimedWall(WALL_OF_FIRE)).toEqual({ refusal: 'SIDE_REQUIRED' })
    expect(aimedWall(WALL_OF_FIRE, 'LEFT')).toMatchObject({
      regions: [{ side: 'LEFT', distance: 200 }]
    })
    expect(aimedWall(WALL_OF_THORNS, 'LEFT')).toEqual({ refusal: 'SIDE_NOT_OFFERED' })
    expect(aimedWall(WALL_OF_THORNS)).toMatchObject({ regions: [] })
  })

  it('makes a creature spend four times the movement through Wall of Thorns and save against its thorns', () => {
    const { entry, options } = zoneOptions(WALL_OF_THORNS)

    expect(
      encounterActionChoiceTarget(entry?.targetPolicy, null, entry?.compilation.zonePlacement)
    ).toMatchObject({
      kind: 'ZONE_OPTIONS',
      options: [
        { label: 'Straight Wall', target: { kind: 'WALL', area: { maxLength: feet(60) } } },
        { label: 'Circle', target: { kind: 'RING', area: { maxOuterRadius: feet(10) } } }
      ]
    })
    for (const { zone } of options) {
      expect(zone).toMatchObject({
        triggerModes: ['ENTER', 'CROSS'],
        turnTriggers: ['END_OF_TURN'],
        movementCostMultiplier: 4,
        maxApplicationsPerTurn: 1,
        blockingRules: ['BLOCKS_SIGHT']
      })
      expect(zone.entry.castSaveDcFactKey).toBe(DND5E_SAVE_DC_FACT_KEY)
      // 7d8 on a failed save and 7d8, halved, on a success: each path rolls its own.
      expect(entryDice(zone)).toEqual(Array(14).fill({ kind: 'LITERAL', value: 8 }))
    }
    expect(options[1]?.zone.ringThickness).toEqual(feet(5))
  })
})

describe('a repeat save attempted only by what the target perceives (SPELLS-29.T1a)', () => {
  /** The d20 node of the frozen repeat-save graph, and the fact that enables it if it is gated. */
  function repeatD20(authored: SpellAuthored) {
    const plan = compiledCast(authored)?.activeEffectPlan
    const node = plan?.frozenGraph.definition.nodes.find(({ id }) => id === 'repeat-save-d20')
    return { plan, node }
  }

  it.each([
    {
      authored: FEAR,
      condition: 'FRIGHTENED',
      recordsSource: true,
      concentration: true,
      allow: 'WHEN_UNMET'
    },
    {
      authored: WATCHFUL_MIASMA,
      condition: 'POISONED',
      recordsSource: false,
      concentration: false,
      allow: 'WHEN_MET'
    }
  ])(
    'runs $authored.label as a turn-end repeat save on $condition, attempted $allow the target sees its caster',
    ({ authored, condition, recordsSource, concentration, allow }) => {
      const { plan, node } = repeatD20(authored)
      expect(plan).toMatchObject({
        frozenGraphNodeId: 'repeat-save-test',
        recurrenceStage: 'END_OF_TURN',
        initialRemaining: 10,
        conditionContributions: [{ conditionId: conditionId(condition), recordsSource }],
        adapterFacts: expect.objectContaining({
          'dnd5e.active-effect-repeat-save-attempt-gate': allow,
          'dnd5e.active-effect-repeat-save-perception-requirement': 'SEE'
        })
      })
      expect(plan?.maintenance?.definitionId ?? null).toBe(
        concentration ? SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID : null
      )
      // The die is asked for only while the perception gate allows the attempt.
      expect(node).toMatchObject({
        operation: { key: 'evidence.optional-integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 },
          enabled: { kind: 'FACT', factKey: 'dnd5e.repeat-save-attempt-allowed' }
        }
      })
    }
  )

  /**
   * One end-of-turn tick of the spell's planned effect on a holder with a +0 Wisdom save, given
   * whether it sees the caster now.
   */
  async function tickGatedSave(input: {
    authored: SpellAuthored
    condition: string
    seesSource: boolean
    remainingTicks: number
  }) {
    const { definition } = plannedTimedCondition({
      encounterId: testUuid(0xd901),
      sourceActorId: testUuid(0xd902),
      holderActorId: testUuid(0xd903),
      spell: input.authored,
      lifetimeScope: 'ENCOUNTER'
    })
    const lifecycle = { schemaVersion: 1 as const, remainingTicks: input.remainingTicks }
    return executeTargetBoundActiveRuleEffectWithPause({
      activeEffectId: testUuid(0xd904),
      activeEffectVersion: 1,
      definition,
      lifecycle,
      lifecycleChecksum: checksumRuleDocument(lifecycle),
      occurrenceId: testUuid(0xd905),
      targetActorId: testUuid(0xd903),
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      targetScalarValues: {},
      targetConditionIds: [conditionId(input.condition)!],
      targetDerivedFacts: {
        savingThrowDefinitions: [
          {
            abilityDefinitionId: SRD_ABILITIES.find(({ code }) => code === 'WISDOM')?.id,
            modifier: 0,
            rollMode: 'NORMAL',
            contributors: []
          }
        ]
      },
      defenses: [],
      perception: { requirement: 'SEE', satisfied: input.seesSource, checksum: 'a'.repeat(64) },
      runtime: createSrdRulesRuntime(),
      adapters: characterRuleActionSystemAdapterRegistry
    })
  }

  it.each([
    { authored: FEAR, condition: 'FRIGHTENED', seesSource: false },
    { authored: WATCHFUL_MIASMA, condition: 'POISONED', seesSource: true }
  ])(
    'asks $authored.label’s holder for its d20 when the gate allows the attempt',
    async ({ authored, condition, seesSource }) => {
      const paused = await tickGatedSave({ authored, condition, seesSource, remainingTicks: 10 })
      expect(paused).toMatchObject({ evidencePolicy: { requestNodeId: 'repeat-save-d20', dc: 15 } })
    }
  )

  it.each([
    { authored: FEAR, condition: 'FRIGHTENED', seesSource: true },
    { authored: WATCHFUL_MIASMA, condition: 'POISONED', seesSource: false }
  ])(
    'refuses $authored.label’s attempt without a roll and keeps its $condition',
    async ({ authored, condition, seesSource }) => {
      const refused = await tickGatedSave({ authored, condition, seesSource, remainingTicks: 10 })
      expect(refused).toMatchObject({ terminal: false, applications: [], d20: null })
      expect(refused).not.toHaveProperty('continuation')
    }
  )

  it('ends Fear on its last turn even when the gate refuses the attempt', async () => {
    const expired = await tickGatedSave({
      authored: FEAR,
      condition: 'FRIGHTENED',
      seesSource: true,
      remainingTicks: 1
    })
    expect(expired).toMatchObject({
      terminal: true,
      d20: null,
      applications: [
        {
          kind: 'CONDITION_REMOVE',
          conditionId: conditionId('FRIGHTENED'),
          authoredPath: null,
          resolvedPath: null
        }
      ]
    })
  })

  it('keeps an ungated repeat save on its plain d20: Hold Person', () => {
    const { plan, node } = repeatD20(HOLD_PERSON)
    expect(plan?.frozenGraphNodeId).toBe('repeat-save-test')
    expect(Object.keys(plan?.adapterFacts ?? {})).not.toContain(
      'dnd5e.active-effect-repeat-save-attempt-gate'
    )
    expect(node?.operation).toEqual({ key: 'evidence.integer-range', contractVersion: 1 })
  })
})

describe('the scaling heal a cast carries', () => {
  /** The dice the spell's authored scaling row names for a cast level, read from the SRD data. */
  function authoredDice(authored: SpellAuthored, castLevel: number) {
    const entry = compileSpell(authored).effects?.[0]?.entries[0]
    const outcome = entry && 'outcome' in entry ? entry.outcome : undefined
    if (outcome?.effectKind !== 'HEAL' || outcome.valueKind !== 'DICE' || !('levels' in outcome))
      throw new Error(`${authored.label} has no scaling dice heal.`)
    const row = outcome.levels.find((level) => level.level === castLevel)
    const match = /^(\d+)d(\d+)$/.exec(row && 'diceConfig' in row ? row.diceConfig : '')
    if (!match) throw new Error(`${authored.label} has no dice row for level ${castLevel}.`)
    return { count: Number(match[1]), die: Number(match[2]) }
  }

  /** The dice the compiled heal graph rolls. */
  function rolledDice(authored: SpellAuthored, castLevel: number) {
    const plan = compiledCast(authored, castLevel)?.executionPlan
    if (plan?.kind !== 'SINGLE_GRAPH') throw new Error(`${authored.label} must compile to a graph.`)
    return plan.published.definition.nodes
      .filter((node) => node.operation.key === 'evidence.integer-range')
      .map((node) => node.inputs.max)
  }

  it.each([
    { authored: CURE_WOUNDS, castLevel: 1 },
    { authored: CURE_WOUNDS, castLevel: 3 },
    { authored: CURE_WOUNDS, castLevel: 9 },
    { authored: HEALING_WORD, castLevel: 1 },
    { authored: HEALING_WORD, castLevel: 4 }
  ])('rolls the dice $authored.label names at cast level $castLevel', ({ authored, castLevel }) => {
    const { count, die } = authoredDice(authored, castLevel)
    expect(rolledDice(authored, castLevel)).toEqual(
      Array.from({ length: count }, () => ({ kind: 'LITERAL', value: die }))
    )
  })

  const d4s = (count: number) =>
    Array.from({ length: count }, () => ({ kind: 'LITERAL', value: 4 }))

  it.each([
    { castLevel: 1, dice: 1 },
    { castLevel: 2, dice: 1 },
    { castLevel: 3, dice: 3 },
    { castLevel: 8, dice: 3 }
  ])(
    'takes the nearest row at or below cast level $castLevel, the lower order on a tie',
    ({ castLevel, dice }) => {
      expect(rolledDice(GAPPED_HEAL, castLevel)).toEqual(d4s(dice))
    }
  )

  it('hands the compiler the authored rows and the cast level, not one flattened row', () => {
    const [entryPoint] = build([candidate(GAPPED_HEAL, 3)]).entryPoints
    const entry = entryPoint?.compiledEffect.entries[0]
    const outcome = entry && 'outcome' in entry ? entry.outcome : undefined
    expect(entryPoint?.spellCastLevel).toBe(3)
    expect(outcome).toMatchObject({
      effectKind: 'HEAL',
      scalingKind: 'PER_LEVEL',
      scalingSource: 'SPELL_CAST_LEVEL'
    })
  })

  it('is not offered for a cast no row applies to', () => {
    expect(compiledCast(LATE_HEAL, 1)).toBeNull()
  })
})

describe('the timed condition a hit-point pool cast owns (SPELLS-27.T8)', () => {
  it('owns Sleep’s one-minute unconscious condition and ends it on anyone’s damage or a creature rousing it', () => {
    expect(compiledCast(SLEEP)?.activeEffectPlan).toMatchObject({
      initialRemaining: 10,
      conditionContributions: [{ conditionId: conditionId('UNCONSCIOUS') }],
      lifecycle: {
        endOnTriggers: [
          { event: 'ACTION_USED_ON_HOLDER', actionDefinitionIds: [SRD_BASIC_ACTION_IDS.ROUSE] },
          { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }
        ]
      }
    })
  })
})

describe('the save each creature in the area makes as a zone appears (SPELLS-4.T1g, D154)', () => {
  const zoneOf = (authored: SpellAuthored) => {
    const placement = compiledCast(authored)?.zonePlacement
    if (!placement) throw new Error('The cast must place a zone.')
    return 'options' in placement ? placement.options.map(({ zone }) => zone) : [placement]
  }

  it.each([
    ['Insect Plague', ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']],
    ['Incendiary Cloud', ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']],
    ['Grease', ['ON_SAVE_FAIL']],
    ['Wall of Fire', ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']],
    ['Wall of Thorns', ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']],
    ['Entangle', ['ON_SAVE_FAIL']],
    ['Wind Wall', ['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS']]
  ])(
    'runs %s’s cast as its save over the area it aims, beside the zone it places',
    (label, paths) => {
      const cast = compiledCast(spell(label))

      expect(cast?.zonePlacement).not.toBeNull()
      expect(cast?.activeEffectPlan).toBeNull()
      expect(cast?.executionPlan.kind).toBe('TEST_OUTCOME')
      if (cast?.executionPlan.kind !== 'TEST_OUTCOME') return
      expect(cast.executionPlan.outcomes.map(({ pathCode }) => pathCode)).toEqual(paths)
    }
  )

  it('keeps the entry save of a zone that also saves as it appears', () => {
    for (const label of ['Insect Plague', 'Incendiary Cloud', 'Grease'])
      for (const zone of zoneOf(spell(label))) expect(zone.triggerModes).toEqual(['ENTER', 'CROSS'])
  })

  it('holds Entangle’s restraint by its inert zone through its Concentration, with its Strength escape', () => {
    const [zone] = zoneOf(spell('Entangle'))

    expect(zone).toMatchObject({
      triggerModes: [],
      heldCondition: {
        conditionId: conditionTypeId('RESTRAINED'),
        escape: {
          activation: { code: 'ACTION', amount: 1 },
          checks: { skillIds: [], abilityDefinitionIds: [SRD_ABILITY_DEFINITION_IDS.STRENGTH] },
          dc: { kind: 'SOURCE_SAVE_DC' }
        }
      },
      maintenance: { definitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
    })
    expect(zone).not.toHaveProperty('turnTriggers')
  })

  it('places Wind Wall as a zone no creature interacts with', () => {
    for (const zone of zoneOf(spell('Wind Wall'))) {
      expect(zone.triggerModes).toEqual([])
      expect(zone).not.toHaveProperty('turnTriggers')
      expect(zone).not.toHaveProperty('heldCondition')
    }
  })

  it('refuses a zone with components whose appear save holds its condition', () => {
    const grease = structuredClone(spell('Grease'))
    const failure = grease.effects?.[0]?.paths?.find(({ pathCode }) => pathCode === 'ON_SAVE_FAIL')
    if (!failure || !('resultBlock' in failure) || !failure.resultBlock)
      throw new Error('Grease must author its appear save.')
    failure.resultBlock.lifecycle = { heldBySource: true }

    expect(compiledCast(grease)).toBeNull()
  })
})

describe('a closed rule converted to a core option grant (SPELLS-4.T2a3, D156)', () => {
  it('compiles Mage Armor to an eight-hour 13 + Dexterity armor class formula for an unarmored target', () => {
    const plan = compiledCast(MAGE_ARMOR)?.activeEffectPlan
    expect(plan).toMatchObject({
      initialRemaining: 4800,
      maintenance: null,
      modifierGrantContribution: {
        modifiers: [
          {
            valueDomainCode: 'ARMOR_CLASS',
            modifierKind: 'SET_VALUE',
            payload: { amount: 13, abilities: ['DEXTERITY'] },
            restrictions: [
              {
                conditions: expect.arrayContaining([
                  expect.objectContaining({
                    kind: 'EQUIPMENT_EQUIPPED',
                    constraint: 'EXCLUDE',
                    category: 'ARMOR'
                  })
                ])
              }
            ]
          }
        ]
      }
    })
  })
})
