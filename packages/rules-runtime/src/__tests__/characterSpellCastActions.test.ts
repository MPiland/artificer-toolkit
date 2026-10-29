import { describe, expect, it } from 'vitest'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import { MAX_ACTIVE_EFFECT_TURNS } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { ManifestComponentAuthored } from '@artificer-toolkit/shared/authored'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import {
  SPELLCASTING_ABILITY_REFERENCE,
  modifierRollInfluence
} from '@artificer-toolkit/shared/core'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { quarterstaff } from '@artificer-toolkit/source-data/srd/equipment/quarterstaff.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import {
  conditionTypeId,
  creatureTypeId
} from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  SRD_ABILITIES,
  SRD_BLINDSIGHT_SENSE_ID,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_PERCEPTION_SKILL_ID,
  SRD_SYSTEM_ID,
  SRD_TRUESIGHT_SENSE_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareNativeCharacterActionState } from '../character/characterNativeActionResources.js'
import { buildCharacterSpellActionRuleFacts } from '../character/characterSpellActionRuleFacts.js'
import { activeEffectEndsOnRest } from '../character/sheetRest.js'
import {
  buildCharacterSpellCastActions,
  RITUAL_CAST_REFUSAL,
  readSpellCastSlot
} from '../character/characterSpellCastActions.js'
import { spellCastActionId } from '../spellCastCandidates.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { encounterActionChoiceTarget, evaluateEncounterZoneTarget } from '../encounterAreaAction.js'
import { planEncounterPlacedZone } from '../encounterPlacedZone.js'
import { evaluateDnd5e2014CharacterActions } from '../systems/dnd5e/characterActions.js'
import { DND5E_SAVE_DC_FACT_KEY } from '../systems/dnd5e/effectActionContracts.js'
import { executeTargetBoundActiveRuleEffectWithPause } from '../targetBoundActiveRuleEffectExecutor.js'
import { createSrdRulesRuntime, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { buildEncounterSummon } from '../encounterSummon.js'
import { buildSheetSpellSummon } from '../character/sheetSpellSummon.js'
import { fixedHealSpell } from '../testing/fixedHealSpell.js'
import { plannedTimedCondition } from '../testing/plannedTimedCondition.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'

type BuildInput = Parameters<typeof buildCharacterSpellCastActions>[0]
type EvaluateInput = Parameters<typeof evaluateDnd5e2014CharacterActions>[0]
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
const GUIDING_BOLT = spell('Guiding Bolt')
const PASS_WITHOUT_TRACE = spell('Pass without Trace')
const MIND_BLANK = spell('Mind Blank')
const SHIELD = spell('Shield')
const SHIELD_OF_FAITH = spell('Shield of Faith')
const INVISIBILITY = spell('Invisibility')
const CHARM_PERSON = spell('Charm Person')
const ANIMAL_FRIENDSHIP = spell('Animal Friendship')
const SLEEP = spell('Sleep')
const HYPNOTIC_PATTERN = spell('Hypnotic Pattern')
const CONTACT_OTHER_PLANE = spell('Contact Other Plane')
const FEAR = spell('Fear')
const PROTECTION_FROM_ENERGY = spell('Protection from Energy')
const BLINDNESS_DEAFNESS = spell('Blindness/Deafness')
const WALL_OF_FIRE = spell('Wall of Fire')
const WALL_OF_THORNS = spell('Wall of Thorns')
const BLADE_BARRIER = spell('Blade Barrier')
const HEROISM = spell('Heroism')
const REGENERATE = spell('Regenerate')
const ENHANCE_ABILITY = spell('Enhance Ability')
const SPIRITUAL_WEAPON = spell('Spiritual Weapon')
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
    slotPoolCode: null,
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
      slotPools: [],
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
  path.resultBlock.lifecycle.endTriggers = [
    ...(path.resultBlock.lifecycle.endTriggers ?? []),
    { event: 'ACTION_TRAIT', trait: 'SPELL_CAST', against: 'ENEMY' },
    { event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: [FIRE_TYPE_ID, FIRE_TYPE_ID] },
    { event: 'ACTION_TRAIT', trait: 'ATTACK_ROLL', against: 'ENEMY' },
    { event: 'DAMAGE_TAKEN', by: 'ANYONE' },
    { event: 'ACTION_TRAIT', trait: 'ATTACK_ROLL', against: 'ENEMY' }
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
/**
 * Hold Person's core options with its repeat save also repeated when the holder takes damage: the
 * triggers are authored out of order and with a repeated damage type, to prove the plan stores them
 * canonically.
 */
const DAMAGE_REPEATED_HOLD: SpellAuthored = (() => {
  const authored = structuredClone(HOLD_PERSON)
  const path = authored.effects?.[0]?.paths?.[0]
  const save = path && 'resultBlock' in path ? path.resultBlock.outcomes?.[1] : undefined
  if (save?.effectKind !== 'FOLLOW_UP_SAVE') throw new Error('Hold Person repeats a save.')
  save.repeatTriggers = [
    { kind: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: [FIRE_TYPE_ID, FIRE_TYPE_ID] },
    { kind: 'DAMAGE_TAKEN', by: 'ANYONE', rollInfluence: 'ADVANTAGE' }
  ]
  return { ...authored, id: '00000000-0000-4000-8000-00000000c005', label: 'Damage Repeated Hold' }
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
              endTriggers: [
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

/** Contact Other Plane written out in core options alone, with no SRD helper (the parity proof). */
const CONTACT_OTHER_PLANE_FROM_CORE_OPTIONS = {
  ...CONTACT_OTHER_PLANE,
  id: testUuid(0x3300),
  effects: [
    {
      id: testUuid(0x3301),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'SAVING_THROW',
        savingThrow: {
          id: testUuid(0x3302),
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: SRD_ABILITIES.find(({ code }) => code === 'INTELLIGENCE')?.id,
          baseDc: 15
        },
        activation: { code: 'ACTION', amount: 1 },
        range: { id: testUuid(0x3303), rangeKind: 'SELF' },
        targeting: { selectionKind: 'SELF' }
      },
      paths: [
        {
          id: testUuid(0x3304),
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          groupType: 'SEQUENTIAL',
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: testUuid(0x3305),
            resultKind: 'SEQUENCE',
            lifecycle: {
              endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_LONG_REST' }]
            },
            outcomes: [
              {
                id: testUuid(0x3306),
                effectKind: 'DAMAGE',
                damageTypeId: SRD_DAMAGE_TYPES.find(({ code }) => code === 'PSYCHIC')?.id,
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '6d6'
              },
              {
                id: testUuid(0x3307),
                effectKind: 'CONDITION',
                conditionId: conditionId('INCAPACITATED')
              }
            ]
          }
        }
      ]
    }
  ]
} as SpellAuthored

/** Protection from Energy cast on its caster alone, so its pick goes with the caster. */
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
    CONTACT_OTHER_PLANE,
    CONTACT_OTHER_PLANE_FROM_CORE_OPTIONS,
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
    SPIRITUAL_WEAPON,
    INVISIBILITY,
    CHARM_PERSON,
    ANIMAL_FRIENDSHIP,
    FEAR,
    PROTECTION_FROM_ENERGY,
    PROTECTION_FROM_ENERGY_ON_SELF,
    BLINDNESS_DEAFNESS,
    WATCHFUL_MIASMA,
    GAPPED_HEAL,
    LATE_HEAL
  ].map((entry) => [entry.id, entry])
)

/** The rules read compiled Spells; the fixtures author them. */
function compiledById(spells: ReadonlyMap<string, SpellAuthored>) {
  return new Map([...spells].map(([id, spell]) => [id, compileSpell(spell)]))
}

function build(
  candidates: readonly SpellCastCandidate[],
  overrides: Partial<BuildInput> = {},
  slotKeyFor?: Parameters<typeof policyFor>[2]
) {
  return buildCharacterSpellCastActions({
    spellCastCandidates: candidates,
    spellAccessCandidates: [],
    castableCandidateIds: new Set(candidates.map((cast) => cast.candidateId)),
    spellsById: compiledById(authoredById),
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
    spellsById: compiledById(documents)
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
      spellsById: new Map([[cantrip.id, compileSpell(cantrip)]])
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

  it('does not offer a ritual, and lists it with the reason an Encounter refuses it (D171)', () => {
    const ritual = candidate(FIREBALL, 3, { castMode: 'RITUAL' })
    const built = build([ritual])
    expect(built.candidates).toEqual([])
    expect(built.unavailable).toEqual([
      {
        id: spellCastActionId(ritual.candidateId),
        label: 'Fireball (3rd level) (ritual)',
        reason: RITUAL_CAST_REFUSAL
      }
    ])
  })

  it('lists only the rituals the Sheet lists as castable', () => {
    const ritual = candidate(FIREBALL, 3, { castMode: 'RITUAL' })
    expect(build([ritual], { castableCandidateIds: new Set() }).unavailable).toEqual([])
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
    expect(build(levels, { spellsById: new Map() }).candidates).toEqual([])
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
      trackAmmunition: false,
      ammunition: null,
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

  it('reads the slot a key names, each slot pool included', () => {
    expect(readSpellCastSlot(policy.spellSlots, 'STANDARD:3')).toEqual({ level: 3, used: 1 })
    expect(readSpellCastSlot(policy.spellSlots, 'STANDARD:9')).toBeNull()
    expect(readSpellCastSlot(policy.spellSlots, 'PACT')).toBeNull()
    const slotPool = (poolCode: string, level: number, rawUsed: number) => ({
      poolCode,
      sourceClassId: 'caster',
      slots: 2,
      level,
      rawUsed,
      effectiveUsed: rawUsed,
      remaining: 2 - rawUsed
    })
    const pooled = {
      ...policy.spellSlots,
      slotPools: [slotPool('PACT', 3, 1), slotPool('RITUAL_POOL', 5, 0)]
    }
    expect(readSpellCastSlot(pooled, 'PACT')).toEqual({ level: 3, used: 1 })
    expect(readSpellCastSlot(pooled, 'RITUAL_POOL')).toEqual({ level: 5, used: 0 })
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
  const pactPool = {
    poolCode: 'PACT',
    sourceClassId: 'warlock',
    slots: 2,
    level: 3,
    rawUsed: 0,
    effectiveUsed: 0,
    remaining: 2
  }
  /** The policy of a pooled cast: its slot is the Pact Magic slot when the cast names that pool. */
  const pooledPolicy = (cast: SpellCastCandidate, rawUsed: number) => {
    const paysPact = cast.slotPoolCode === 'PACT'
    const policy = policyFor([cast], authoredById, () => (paysPact ? 'PACT' : null))
    return {
      ...policy,
      resources: [pool(rawUsed)],
      spellSlots: { ...policy.spellSlots, slotPools: paysPact ? [pactPool] : [] }
    }
  }
  const buildPooled = (cast: SpellCastCandidate, rawUsed = 0) =>
    build([cast], { policyOutput: pooledPolicy(cast, rawUsed) })
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
          ...pooledPolicy(cast, rawUsed),
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
        trackAmmunition: false,
        ammunition: null,
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

  it('spends the Pact Magic slot as well as the pool when the cast names that pool (SPELLS-31.T5p)', () => {
    const pact = { ...pooled('LIMITED_USE'), slotPoolCode: 'PACT' as const }
    const { prepared, built } = prepare(pact, 0, 'ASSISTED')
    expect(built.decisions).toMatchObject([{ resourcePoolId: poolId }])
    expect(prepared.resourceConsumption).toMatchObject({ poolId, afterUsed: 1 })
    expect(prepared.spellConsumption).toMatchObject({ slotKey: 'PACT' })
  })

  describe('whose pool slot the rules decide on (SPELLS-31.T5p)', () => {
    const pact = { ...pooled('LIMITED_USE'), slotPoolCode: 'PACT' as const }
    const decide = (pactSlots: { level: number; remaining: number } | null, rawUsed = 0) =>
      evaluateDnd5e2014CharacterActions({
        candidates: [],
        abilityDefinitions: [],
        spellCandidates: [pact],
        spellSlots: pactSlots
          ? [{ slotKey: 'PACT', label: 'Pact Magic', max: 2, ...pactSlots }]
          : [],
        spellEffects: [],
        spellMechanics: [],
        spellcastingLocked: false,
        proficiencies: [],
        itemAdjustments: [],
        activeSourceIds: [],
        activeEquipmentInstanceIds: [],
        resources: [
          { ...pool(rawUsed), baseContribution: { sourceId: SOURCE_INSTANCE_ID, value: 2 } }
        ],
        modifierGroups: [],
        totalLevel: 1,
        classLevels: [],
        proficiencyBonus: 2,
        abilities: [],
        skills: [],
        spellcasting: null
      }).spellCastDecisions[0]

    it('offers the cast while the pool and a Pact slot of the cast level remain', () => {
      expect(decide({ level: 3, remaining: 1 })).toMatchObject({
        status: 'AVAILABLE',
        reasonCode: 'SPELL_SLOT_REMAINING',
        slotKey: 'PACT'
      })
    })

    it('refuses it once the Pact slots are spent, and names the slot', () => {
      expect(decide({ level: 3, remaining: 0 })).toMatchObject({
        status: 'UNAVAILABLE',
        reasonCode: 'SPELL_SLOT_EXHAUSTED',
        slotKey: 'PACT'
      })
    })

    it('refuses it with no Pact slot, or one below the cast level', () => {
      for (const slots of [null, { level: 2, remaining: 2 }])
        expect(decide(slots)).toMatchObject({
          status: 'UNAVAILABLE',
          reasonCode: 'NO_ELIGIBLE_SPELL_SLOT',
          slotKey: null
        })
    })

    it('refuses it once the pool is spent, whatever the slots', () => {
      expect(decide({ level: 3, remaining: 2 }, 2)).toMatchObject({
        status: 'UNAVAILABLE',
        reasonCode: 'RESOURCE_EXHAUSTED'
      })
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
      spellsById: new Map([[cantrip.id, compileSpell(cantrip)]])
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

  it('stores a repeat save’s damage triggers canonically on the plan, and none when the save authors none', () => {
    expect(compiledCast(DAMAGE_REPEATED_HOLD)?.activeEffectPlan?.lifecycle?.repeatTriggers).toEqual(
      [
        { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null, rollInfluence: 'ADVANTAGE' },
        {
          event: 'DAMAGE_TAKEN',
          by: 'SOURCE_SIDE',
          damageTypeIds: [FIRE_TYPE_ID],
          rollInfluence: null
        }
      ]
    )
    expect(compiledCast(HOLD_PERSON)?.activeEffectPlan?.lifecycle?.repeatTriggers).toBeUndefined()
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
    // SPELLS-4.T2v2a3d: the SRD casts it as a bonus action, not an action.
    { authored: SPIRITUAL_WEAPON, activation: 'BONUS_ACTION' },
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
        endTriggers: [
          { event: 'LIFECYCLE', timing: 'END', code: 'ON_ATTACK_ROLL' },
          { event: 'LIFECYCLE', timing: 'END', code: 'ON_CAST_SPELL' }
        ]
      }
    })
    expect(plan?.maintenance?.definitionId).toBe(SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
  })

  it('carries authored end triggers with explicit filters, unique and in canonical order', () => {
    const plan = compiledCast(SCORCHED_INVISIBILITY)?.activeEffectPlan
    expect(plan?.lifecycle?.endTriggers).toEqual([
      { event: 'ACTION_TRAIT', trait: 'ATTACK_ROLL', against: 'ENEMY' },
      { event: 'ACTION_TRAIT', trait: 'SPELL_CAST', against: 'ENEMY' },
      { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null },
      { event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: [FIRE_TYPE_ID] },
      { event: 'LIFECYCLE', timing: 'END', code: 'ON_ATTACK_ROLL' },
      { event: 'LIFECYCLE', timing: 'END', code: 'ON_CAST_SPELL' }
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
        endTriggers: [{ event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: null }]
      }
    })
  })
  it('owns Animal Friendship’s day-long charmed condition and ends it on harm from the caster’s side', () => {
    expect(compiledCast(ANIMAL_FRIENDSHIP)?.activeEffectPlan).toMatchObject({
      initialRemaining: 14_400,
      conditionContributions: [{ conditionId: conditionId('CHARMED') }],
      lifecycle: {
        endTriggers: [{ event: 'DAMAGE_TAKEN', by: 'SOURCE_SIDE', damageTypeIds: null }]
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
        endTriggers: [],
        modifiers: [{ valueDomainCode: 'SPEED', modifierKind: 'MULTIPLY' }]
      },
      lifecycle: { endTriggers: ROUSE_OR_DAMAGE }
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

/** A touch cast on one creature with `paths`, written out in core options alone (the parity proof). */
function touchSpellFromCoreOptions(
  base: SpellAuthored,
  id: number,
  dispositionKind: 'ANY' | 'WILLING',
  paths: unknown[]
): SpellAuthored {
  return {
    ...base,
    id: testUuid(id),
    label: `${base.label} from core options`,
    effects: [
      {
        id: testUuid(id + 1),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'ACTIVATED',
          activation: { code: 'ACTION', amount: 1 },
          range: { id: testUuid(id + 2), rangeKind: 'TOUCH' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind }
        },
        paths
      }
    ]
  } as SpellAuthored
}
/** One ON_USE path of a SEQUENTIAL cast holding `outcomes` for `duration`. */
const sequentialPath = (
  id: number,
  order: number,
  duration: { durationKind: 'MINUTE' | 'HOUR'; amount: number },
  outcomes: unknown[],
  lifecycle?: { recurringKind: 'START_OF_TURN' }
) => ({
  id: testUuid(id),
  order,
  pathCode: 'ON_USE',
  groupType: 'SEQUENTIAL',
  originKind: 'SOURCE',
  selectionKind: 'FIXED',
  resultBlock: {
    id: testUuid(id + 1),
    resultKind: 'SEQUENCE',
    duration: { id: testUuid(id + 2), ...duration },
    ...(lifecycle && { lifecycle }),
    outcomes
  }
})
const advantageOn = (id: number, ability: string) => ({
  id: testUuid(id),
  effectKind: 'APPLY_GRANT',
  grants: {
    modifiers: [
      {
        id: testUuid(id + 1),
        grantKind: 'MODIFIER_GRANT',
        valueDomainCode: 'ABILITY_CHECK',
        domain: { ability },
        modifierKind: 'ROLL_INFLUENCE',
        payload: { influence: 'ADVANTAGE' },
        scope: 'GLOBAL',
        selectionKind: 'GRANTED',
        order: 1
      }
    ]
  }
})
const HEROISM_FROM_CORE_OPTIONS = touchSpellFromCoreOptions(HEROISM, 0x3200, 'WILLING', [
  sequentialPath(0x3210, 1, { durationKind: 'MINUTE', amount: 1 }, [
    {
      id: testUuid(0x3213),
      effectKind: 'APPLY_GRANT',
      grants: {
        modifiers: [
          {
            id: testUuid(0x3214),
            grantKind: 'MODIFIER_GRANT',
            valueDomainCode: 'CONDITION_IMMUNITY',
            domain: {},
            modifierKind: 'ADD_OPTION',
            scope: 'GLOBAL',
            selectionKind: 'GRANTED',
            payload: { conditionTypeId: conditionId('FRIGHTENED') },
            order: 1
          }
        ]
      }
    }
  ]),
  sequentialPath(
    0x3220,
    2,
    { durationKind: 'MINUTE', amount: 1 },
    [
      {
        id: testUuid(0x3223),
        effectKind: 'HEAL',
        temporary: true,
        valueKind: 'FIXED',
        scalingKind: 'NONE',
        amount: 0,
        bonuses: [
          {
            id: testUuid(0x3224),
            bonusKind: 'ABILITY_BONUS',
            ability: SPELLCASTING_ABILITY_REFERENCE,
            order: 1
          }
        ]
      }
    ],
    { recurringKind: 'START_OF_TURN' }
  )
])
const REGENERATE_FROM_CORE_OPTIONS = touchSpellFromCoreOptions(REGENERATE, 0x3300, 'ANY', [
  sequentialPath(0x3310, 1, { durationKind: 'HOUR', amount: 1 }, [
    {
      id: testUuid(0x3313),
      effectKind: 'HEAL',
      valueKind: 'DICE',
      scalingKind: 'NONE',
      diceConfig: '4d8+15'
    }
  ]),
  sequentialPath(
    0x3320,
    2,
    { durationKind: 'HOUR', amount: 1 },
    [
      {
        id: testUuid(0x3323),
        effectKind: 'HEAL',
        valueKind: 'FIXED',
        scalingKind: 'NONE',
        amount: 1
      }
    ],
    { recurringKind: 'START_OF_TURN' }
  )
])
/** Enhance Ability's Bear's Endurance and Bull's Strength, written out in core options alone. */
const ENHANCE_ABILITY_FROM_CORE_OPTIONS = touchSpellFromCoreOptions(
  ENHANCE_ABILITY,
  0x3400,
  'WILLING',
  [
    {
      id: testUuid(0x3410),
      order: 1,
      pathCode: 'ON_USE',
      groupType: 'CHOICE',
      originKind: 'SOURCE',
      selectionKind: 'CHOICE',
      options: [
        {
          id: testUuid(0x3420),
          order: 1,
          label: "Bear's Endurance",
          resultBlock: {
            id: testUuid(0x3421),
            resultKind: 'SEQUENCE',
            duration: { id: testUuid(0x3422), durationKind: 'HOUR', amount: 1 },
            outcomes: [
              advantageOn(0x3423, 'CONSTITUTION'),
              {
                id: testUuid(0x3425),
                effectKind: 'HEAL',
                temporary: true,
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '2d6'
              }
            ]
          }
        },
        {
          id: testUuid(0x3430),
          order: 2,
          label: "Bull's Strength",
          resultBlock: {
            id: testUuid(0x3431),
            resultKind: 'SINGLE',
            duration: { id: testUuid(0x3432), durationKind: 'HOUR', amount: 1 },
            outcomes: [advantageOn(0x3433, 'STRENGTH')]
          }
        }
      ]
    }
  ]
)
/** The plan fields a parity proof compares, free of the ids each authoring mints. */
const comparablePlan = (
  plan:
    | Pick<
        NonNullable<NonNullable<ReturnType<typeof compiledCast>>['activeEffectPlan']>,
        | 'recurrenceStage'
        | 'initialRemaining'
        | 'castFactKeys'
        | 'recurrenceDeferred'
        | 'ownsTemporaryHitPoints'
        | 'modifierGrantContribution'
        | 'maintenance'
      >
    | null
    | undefined
) =>
  plan && {
    recurrenceStage: plan.recurrenceStage,
    initialRemaining: plan.initialRemaining,
    castFactKeys: plan.castFactKeys,
    recurrenceDeferred: plan.recurrenceDeferred,
    ownsTemporaryHitPoints: plan.ownsTemporaryHitPoints,
    modifiers: plan.modifierGrantContribution?.modifiers.map(
      ({ grantId: _grantId, ...rest }) => rest
    ),
    countedByTurnEffects: plan.modifierGrantContribution?.countedByTurnEffects,
    maintained: plan.maintenance !== null
  }

describe('effect-owned temporary hit points and sequential effects (SPELLS-4.T2t, D156)', () => {
  it('compiles Heroism to one Concentration effect: frightened immunity and temporary hit points each turn, from the cast', () => {
    const compiled = compiledCast(HEROISM)
    expect(compiled?.executionPlan.kind).toBe('SINGLE_GRAPH')
    expect(compiled?.activeEffectPlan).toMatchObject({
      recurrenceStage: 'START_OF_TURN',
      initialRemaining: 10,
      castFactKeys: ['dnd5e.recurring-heal-amount'],
      recurrenceDeferred: true,
      ownsTemporaryHitPoints: true,
      modifierGrantContribution: {
        countedByTurnEffects: true,
        modifiers: [{ valueDomainCode: 'CONDITION_IMMUNITY' }]
      },
      maintenance: { definitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
    })
    const graph = compiled?.activeEffectPlan?.frozenGraph.definition
    expect(graph?.nodes.map(({ inputs }) => inputs.amount)).toEqual([
      { kind: 'FACT', factKey: 'dnd5e.recurring-heal-amount' }
    ])
  })

  it('compiles Regenerate to an immediate heal and a 1 hour effect healing 1 at the start of each turn, without Concentration', () => {
    const compiled = compiledCast(REGENERATE)
    expect(compiled?.activeEffectPlan).toMatchObject({
      recurrenceStage: 'START_OF_TURN',
      initialRemaining: 600,
      recurrenceDeferred: true,
      maintenance: null
    })
    expect(compiled?.activeEffectPlan?.ownsTemporaryHitPoints).toBeUndefined()
    expect(compiled?.activeEffectPlan?.modifierGrantContribution).toBeNull()
    expect(
      compiled?.activeEffectPlan?.frozenGraph.definition.nodes.map(({ inputs }) => inputs.amount)
    ).toEqual([{ kind: 'LITERAL', value: 1 }])
  })

  it('compiles each Enhance Ability option to advantage on its ability, Bear owning its temporary hit points', () => {
    const options = compiledCast(ENHANCE_ABILITY)?.choice?.options ?? []
    expect(options.map(({ label }) => label)).toEqual([
      "Bear's Endurance",
      "Bull's Strength",
      "Cat's Grace",
      "Eagle's Splendor",
      "Fox's Cunning",
      "Owl's Wisdom"
    ])
    for (const [index, code] of [
      'CONSTITUTION',
      'STRENGTH',
      'DEXTERITY',
      'CHARISMA',
      'INTELLIGENCE',
      'WISDOM'
    ].entries()) {
      expect(options[index]?.activeEffectPlan, code).toMatchObject({
        modifierGrantContribution: {
          modifiers: [
            {
              valueDomainCode: 'ABILITY_CHECK',
              modifierKind: 'ROLL_INFLUENCE',
              payload: { influence: 'ADVANTAGE' },
              domain: { ability: code }
            }
          ]
        },
        maintenance: { definitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
      })
      expect(options[index]?.activeEffectPlan?.ownsTemporaryHitPoints, code).toBe(
        index === 0 ? true : undefined
      )
    }
  })

  it.each([
    ['Heroism', HEROISM, HEROISM_FROM_CORE_OPTIONS],
    ['Regenerate', REGENERATE, REGENERATE_FROM_CORE_OPTIONS]
  ])(
    'compiles %s authored from core options only to the same plan as the SRD data',
    (_label, srd, core) => {
      const plan = comparablePlan(compiledCast(core)?.activeEffectPlan)
      expect(plan).toBeTruthy()
      expect(plan).toEqual(comparablePlan(compiledCast(srd)?.activeEffectPlan))
    }
  )

  it('compiles Enhance Ability options authored from core options only to the same plans as the SRD data', () => {
    const srd = compiledCast(ENHANCE_ABILITY)?.choice?.options ?? []
    const core = compiledCast(ENHANCE_ABILITY_FROM_CORE_OPTIONS)?.choice?.options ?? []
    expect(core).toHaveLength(2)
    expect(core.map(({ activeEffectPlan }) => comparablePlan(activeEffectPlan))).toEqual(
      srd.slice(0, 2).map(({ activeEffectPlan }) => comparablePlan(activeEffectPlan))
    )
  })

  it('refuses a composition holding two recurring heals', () => {
    const twice = touchSpellFromCoreOptions(REGENERATE, 0x3500, 'ANY', [
      ...[0x3510, 0x3520].map((id, index) =>
        sequentialPath(
          id,
          index + 1,
          { durationKind: 'HOUR', amount: 1 },
          [
            {
              id: testUuid(id + 3),
              effectKind: 'HEAL',
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 1
            }
          ],
          { recurringKind: 'START_OF_TURN' }
        )
      )
    ])
    expect(compiledCast(twice)?.activeEffectPlan ?? null).toBeNull()
  })
})

describe('a save its caster makes, whose failure holds a condition until a long rest (SPELLS-4.T2a1b)', () => {
  const madness = {
    recurrenceStage: 'NONE',
    initialRemaining: null,
    tickAnchor: 'HOLDER',
    conditionContributions: [{ conditionId: conditionId('INCAPACITATED') }],
    lifecycle: {
      endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_LONG_REST' }]
    },
    maintenance: null
  }

  it('tests Contact Other Plane’s caster alone and owns its incapacitated until a long rest, with no Concentration', () => {
    const compiled = compiledCast(CONTACT_OTHER_PLANE)
    expect(compiled?.executionPlan.kind).toBe('TEST_OUTCOME')
    expect(compiled?.activeEffectPlan).toMatchObject(madness)
  })

  // Parity: the same spell written out in core options alone (no SRD helper) compiles to this plan.
  it('compiles a spell authored from core options only to the same plan as the SRD data', () => {
    const compiled = compiledCast(CONTACT_OTHER_PLANE_FROM_CORE_OPTIONS)
    expect(compiled?.executionPlan.kind).toBe('TEST_OUTCOME')
    expect(compiled?.activeEffectPlan).toMatchObject(madness)
  })

  it('ends the effect a failed save stores on a long rest, not a short one', () => {
    const { definition } = plannedTimedCondition({
      encounterId: testUuid(0xd911),
      sourceActorId: testUuid(0xd912),
      holderActorId: testUuid(0xd912),
      spell: CONTACT_OTHER_PLANE,
      lifetimeScope: 'OWNER'
    })
    expect(definition.recurrence).toMatchObject({
      endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_LONG_REST' }],
      expiration: { kind: 'INDEFINITE' }
    })
    expect(activeEffectEndsOnRest({ definition }, 'LONG')).toBe(true)
    expect(activeEffectEndsOnRest({ definition }, 'SHORT')).toBe(false)
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

  // SPELLS-31.T5k: a cast at its user carries its pick too (Fiendish Resilience).
  it('carries the same pick on a cast at its user', () => {
    const labels = (authored: SpellAuthored) =>
      compiledCastEntry(authored)?.compilation.choice?.options.map(({ label }) => label)
    expect(labels(PROTECTION_FROM_ENERGY_ON_SELF)).toEqual([
      'Acid',
      'Cold',
      'Fire',
      'Lightning',
      'Thunder'
    ])
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

  it('offers Blade Barrier as a 100-foot wall or a 60-foot ring of blades that cost double movement and save against the blades on entry or turn start (SPELLS-30.T2)', () => {
    const { entry, options } = zoneOptions(BLADE_BARRIER)

    expect(
      encounterActionChoiceTarget(entry?.targetPolicy, null, entry?.compilation.zonePlacement)
    ).toEqual({
      kind: 'ZONE_OPTIONS',
      options: [
        {
          id: options[0]!.optionId,
          label: 'Straight Wall',
          target: { kind: 'WALL', area: { maxLength: feet(100), thickness: feet(5) } }
        },
        {
          id: options[1]!.optionId,
          label: 'Ringed Wall',
          target: { kind: 'RING', area: { maxOuterRadius: feet(30), thickness: feet(5) } }
        }
      ]
    })
    for (const { zone } of options) {
      expect(zone).toMatchObject({
        attachment: 'PLACED_SPACE',
        triggerModes: ['ENTER', 'CROSS'],
        turnTriggers: ['START_OF_TURN'],
        movementCostMultiplier: 2,
        maxApplicationsPerTurn: 1,
        blockingRules: ['THREE_QUARTERS_COVER'],
        maintenance: { definitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
      })
      expect(zone.entry.castSaveDcFactKey).toBe(DND5E_SAVE_DC_FACT_KEY)
      // 6d10 on a failed save and 6d10, halved, on a success: each path rolls its own.
      expect(entryDice(zone)).toEqual(Array(12).fill({ kind: 'LITERAL', value: 10 }))
    }
    expect(options[0]?.zone).not.toHaveProperty('ringThickness')
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
      runtime: createSrdRulesRuntime()
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

  it.each([HOLD_PERSON, spell('Hold Monster')])(
    'keeps an ungated repeat save on its plain d20: $label',
    (authored) => {
      const { plan, node } = repeatD20(authored)
      expect(plan?.frozenGraphNodeId).toBe('repeat-save-test')
      expect(Object.keys(plan?.adapterFacts ?? {})).not.toContain(
        'dnd5e.active-effect-repeat-save-attempt-gate'
      )
      expect(node?.operation).toEqual({ key: 'evidence.integer-range', contractVersion: 1 })
    }
  )
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
        endTriggers: [
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

  it('refuses a zone whose appear save excludes a creature type, which its entry saves cannot', () => {
    const grease = structuredClone(spell('Grease'))
    const invocation = grease.effects?.[0]?.invocation
    if (invocation?.kind !== 'ACTION' || invocation.targeting?.selectionKind !== 'AREA_CONTENTS')
      throw new Error('Grease must target the area it covers.')
    invocation.targeting.excludedCreatureTypeIds = [creatureTypeId('UNDEAD')]

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

  it('compiles Guiding Bolt to advantage on the next attack against the target, until the end of the caster’s next turn', () => {
    const plan = compiledCast(GUIDING_BOLT)?.activeEffectPlan
    expect(plan).toMatchObject({
      initialRemaining: 1,
      recurrenceStage: 'END_OF_TURN',
      tickAnchor: 'SOURCE',
      modifierGrantContribution: {
        endTriggers: [{ event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACKED' }]
      }
    })
    expect(
      plan?.modifierGrantContribution?.modifiers.map((modifier) => ({
        valueDomainCode: modifier.valueDomainCode,
        modifierKind: modifier.modifierKind,
        payload: { influence: modifierRollInfluence(modifier) }
      }))
    ).toEqual(
      Array.from({ length: 4 }, () => ({
        valueDomainCode: 'ATTACKS_AGAINST',
        modifierKind: 'ROLL_INFLUENCE',
        payload: { influence: 'ADVANTAGE' }
      }))
    )
  })
})

/** The spell with each GM ruling in its fixed result swapped for a copy of its grant. */
function withRulingsAsGrants(authored: SpellAuthored): SpellAuthored {
  return {
    ...authored,
    effects: authored.effects?.map((effect) => ({
      ...effect,
      paths: effect.paths.map((path) => {
        if (path.selectionKind !== 'FIXED') return path
        const grant = path.resultBlock.outcomes.find(
          (outcome) => outcome.effectKind === 'APPLY_GRANT'
        )
        if (!grant) throw new Error('Expected a grant.')
        return {
          ...path,
          resultBlock: {
            ...path.resultBlock,
            outcomes: path.resultBlock.outcomes.map((outcome) =>
              outcome.effectKind === 'MANUAL_ADJUDICATION' ? { ...grant, id: outcome.id } : outcome
            )
          }
        }
      })
    }))
  }
}

/** Pass without Trace with its list of chosen creatures allowed to name a creature more than once. */
const REPEATING_PASS_WITHOUT_TRACE: SpellAuthored = {
  ...PASS_WITHOUT_TRACE,
  effects: PASS_WITHOUT_TRACE.effects?.map((effect) =>
    effect.invocation.kind === 'ACTION' &&
    effect.invocation.targeting?.selectionKind === 'CHOSEN_CREATURES'
      ? {
          ...effect,
          invocation: {
            ...effect.invocation,
            targeting: { ...effect.invocation.targeting, allowRepeatedTargets: true }
          }
        }
      : effect
  )
}

describe('a grant beside GM rulings, on a list of chosen creatures (SPELLS-4.T2a3, D156)', () => {
  it('compiles the grant for each chosen creature, with its ruling as a manual-adjudication node', () => {
    const entry = compiledCastEntry(PASS_WITHOUT_TRACE)
    // "Each creature you choose" names no cap, so the list is offered without one.
    expect(
      encounterActionChoiceTarget(entry?.targetPolicy, null, null, entry?.compilation.choice)
    ).toEqual({ kind: 'ACTORS', area: null })
    expect(entry?.compilation.activeEffectPlan).toMatchObject({
      initialRemaining: 600,
      modifierGrantContribution: {
        modifiers: [
          {
            valueDomainCode: 'SKILL_MODIFIER',
            modifierKind: 'BONUS',
            payload: { valueKind: 'FIXED', amount: 10 }
          }
        ]
      }
    })
    const plan = entry?.compilation.executionPlan
    if (plan?.kind !== 'SINGLE_GRAPH') throw new Error('Expected one direct graph.')
    const { nodes, sourceEntryBindings } = plan.published.definition
    expect(nodes.map((node) => node.operation.key)).toEqual([
      'dnd5e.modifier-grant-proposal',
      'dnd5e.manual-adjudication-proposal'
    ])
    expect(sourceEntryBindings).toEqual([expect.objectContaining({ nodeId: nodes[1]!.id })])
  })

  it('refuses a sequence with two executable outcomes', () => {
    expect(compiledCast(withRulingsAsGrants(PASS_WITHOUT_TRACE))).toBeNull()
  })

  it('refuses a list with no cap that names a creature more than once', () => {
    expect(compiledCast(REPEATING_PASS_WITHOUT_TRACE)).toBeNull()
  })
})

/** Mind Blank lasting `rounds` rounds instead of 24 hours. */
const mindBlankForRounds = (rounds: number): SpellAuthored => ({
  ...MIND_BLANK,
  effects: MIND_BLANK.effects?.map((effect) => ({
    ...effect,
    paths: effect.paths.map((path) =>
      path.selectionKind === 'FIXED' && path.resultBlock.duration
        ? {
            ...path,
            resultBlock: {
              ...path.resultBlock,
              duration: {
                ...path.resultBlock.duration,
                durationKind: 'ROUND' as const,
                amount: rounds
              }
            }
          }
        : path
    )
  }))
})

describe('a day-long grant (SPELLS-4.T2a3, D156)', () => {
  it('compiles Mind Blank’s 24 hours as 14,400 turns, beside its ruling', () => {
    const entry = compiledCastEntry(MIND_BLANK)
    expect(entry?.compilation.activeEffectPlan).toMatchObject({
      initialRemaining: MAX_ACTIVE_EFFECT_TURNS,
      modifierGrantContribution: {
        modifiers: [
          { valueDomainCode: 'DAMAGE_IMMUNITY' },
          { valueDomainCode: 'CONDITION_IMMUNITY' },
          { valueDomainCode: 'SPELL_SCHOOL_IMMUNITY' }
        ]
      }
    })
    const plan = entry?.compilation.executionPlan
    if (plan?.kind !== 'SINGLE_GRAPH') throw new Error('Expected one direct graph.')
    expect(plan.published.definition.nodes.map((node) => node.operation.key)).toEqual([
      'dnd5e.modifier-grant-proposal',
      'dnd5e.manual-adjudication-proposal'
    ])
  })

  it('compiles a grant of 14,400 turns and refuses one of 14,401', () => {
    expect(MAX_ACTIVE_EFFECT_TURNS).toBe(14_400)
    expect(
      compiledCastEntry(mindBlankForRounds(14_400))?.compilation.activeEffectPlan
    ).toMatchObject({ initialRemaining: 14_400 })
    expect(compiledCast(mindBlankForRounds(14_401))).toBeNull()
  })
})

describe('a zone that only prices movement, placed with no save (SPELLS-4.T2a4, D156)', () => {
  it('places Plant Growth’s overgrowth with no triggers, costing 4 feet for each foot moved', () => {
    const placement = compiledCast(spell('Plant Growth'))?.zonePlacement
    if (!placement || 'options' in placement) throw new Error('Plant Growth places one zone.')

    expect(placement).toMatchObject({
      attachment: 'PLACED_SPACE',
      label: 'Plant Growth',
      triggerModes: [],
      movementCostMultiplier: 4,
      bypassAtHalfSpeed: false,
      grant: null
    })
    expect(placement).not.toHaveProperty('turnTriggers')
    expect(placement).not.toHaveProperty('heldCondition')
  })

  it('keeps an Instantaneous zone with no Concentration until the GM removes it, with no maintenance', () => {
    const placement = compiledCast(spell('Plant Growth'))?.zonePlacement

    expect(placement).toMatchObject({ maintenance: null, entry: { maintenance: null } })
  })

  it('places Earthquake’s shaking ground as difficult terrain held by its Concentration (SPELLS-4.T2q)', () => {
    const placement = compiledCast(spell('Earthquake'))?.zonePlacement
    if (!placement || 'options' in placement) throw new Error('Earthquake places one zone.')

    expect(placement).toMatchObject({
      attachment: 'PLACED_SPACE',
      label: 'Earthquake',
      triggerModes: [],
      movementCostMultiplier: 2,
      maintenance: { definitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
    })
    expect(placement).not.toHaveProperty('turnTriggers')
    expect(placement).not.toHaveProperty('heldCondition')
  })
})

describe('a condition until dispelled that damage ends, beside a GM ruling (SPELLS-4.T2a4, D156)', () => {
  it('owns Sequester’s invisible on a willing creature with no end of turns, ending on anyone’s damage', () => {
    const entry = compiledCastEntry(spell('Sequester'))
    expect(entry?.targetPolicy?.targeting).toMatchObject({ dispositionKind: 'WILLING' })
    expect(entry?.compilation.activeEffectPlan).toMatchObject({
      initialRemaining: null,
      conditionContributions: [{ conditionId: conditionId('INVISIBLE') }],
      lifecycle: { endTriggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }] },
      maintenance: null
    })
    const plan = entry?.compilation.executionPlan
    if (plan?.kind !== 'SINGLE_GRAPH') throw new Error('Expected one direct graph.')
    expect(plan.published.definition.nodes.map((node) => node.operation.key)).toContain(
      'dnd5e.manual-adjudication-proposal'
    )
  })
})

describe('a save cast that owns a bundle of modifiers, repeated at the end of each turn (SPELLS-4.T2a5, D156)', () => {
  it('owns Slow’s six modifiers for a minute under Concentration, with a plain-d20 turn-end save', () => {
    const plan = compiledCast(spell('Slow'))?.activeEffectPlan
    expect(plan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      conditionContributions: [],
      modifierGrantContribution: {
        countedByTurnEffects: true,
        modifiers: [
          { valueDomainCode: 'SPEED', modifierKind: 'MULTIPLY' },
          { valueDomainCode: 'ARMOR_CLASS', modifierKind: 'PENALTY' },
          { valueDomainCode: 'SAVING_THROW_MODIFIER', modifierKind: 'PENALTY' },
          { valueDomainCode: 'REACTION_COUNT', modifierKind: 'SET_VALUE' },
          { valueDomainCode: 'ACTION_BONUS_ACTION_EXCLUSIVITY', modifierKind: 'ENABLE' },
          { valueDomainCode: 'ATTACKS_PER_ATTACK_ACTION', modifierKind: 'CAP_VALUE' }
        ]
      },
      frozenGraphNodeId: 'repeat-save-test'
    })
    expect(plan?.maintenance?.definitionId).toBe(SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
  })
})

describe('a timed grant authored as a sequence of one outcome', () => {
  it('compiles Haste to its minute of grants, extra action and lethargy under Concentration, as a single result would', () => {
    const plan = compiledCast(spell('Haste'))?.activeEffectPlan
    expect(plan).toMatchObject({
      initialRemaining: 10,
      modifierGrantContribution: {
        modifiers: [
          { valueDomainCode: 'SPEED', modifierKind: 'MULTIPLY' },
          { valueDomainCode: 'ARMOR_CLASS', modifierKind: 'BONUS' },
          {
            valueDomainCode: 'SAVING_THROW_MODIFIER',
            modifierKind: 'ROLL_INFLUENCE',
            payload: { influence: 'ADVANTAGE' }
          }
        ],
        grantedActions: [{ activation: 'FREE', usesPerTurn: 1, weaponAttack: true }],
        onEnd: {
          turns: 1,
          modifiers: [
            { valueDomainCode: 'SPEED', modifierKind: 'MULTIPLY' },
            { valueDomainCode: 'ACTION_COUNT', modifierKind: 'SET_VALUE' },
            { valueDomainCode: 'BONUS_ACTION_COUNT', modifierKind: 'SET_VALUE' },
            { valueDomainCode: 'REACTION_COUNT', modifierKind: 'SET_VALUE' }
          ]
        }
      }
    })
    expect(plan?.maintenance?.definitionId).toBe(SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
  })
})

describe('a cast that departs its travelers beside a GM ruling (SPELLS-4.T2a5, D156)', () => {
  it('departs Teleport’s caster and up to eight chosen creatures with the destination ruling riding the commit, and no effect to hold', () => {
    const compiled = compiledCast(spell('Teleport'))
    if (compiled?.executionPlan.kind !== 'SINGLE_GRAPH')
      throw new Error('Teleport must compile to a graph.')
    const keys = compiled.executionPlan.published.definition.nodes.map(
      ({ operation }) => operation.key
    )
    expect(keys).toContain('dnd5e.depart-proposal')
    expect(keys).toContain('dnd5e.manual-adjudication-proposal')
    expect(compiled.activeEffectPlan).toBeNull()
  })
})

describe('a grant bound to the item its cast is used on (SPELLS-4.T2e, D156)', () => {
  const SHILLELAGH = spell('Shillelagh')
  const MAGIC_WEAPON = spell('Magic Weapon')
  const HEAT_METAL = spell('Heat Metal')
  const boundModifier = (valueDomainCode: string, domain: object, modifierKind: string) => ({
    grantKind: 'MODIFIER_GRANT',
    valueDomainCode,
    domain,
    modifierKind,
    scope: 'SOURCE',
    selectionKind: 'GRANTED'
  })

  it('compiles Shillelagh to a minute on a club or quarterstaff that ends when it is let go', () => {
    const plan = compiledCast(SHILLELAGH)?.activeEffectPlan
    expect(plan).toMatchObject({
      initialRemaining: 10,
      chosenItem: {
        category: null,
        requiredProperties: [],
        excludedProperties: [],
        equipmentIds: [club.id, quarterstaff.id].sort(),
        bindsGrant: true,
        releasedOn: null,
        grantUnlessReleased: false
      },
      modifierGrantContribution: {
        endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_CHOSEN_ITEM_RELEASED' }],
        modifiers: [
          {
            valueDomainCode: 'ATTACK_ROLL',
            modifierKind: 'OPTIONAL_ABILITY_MODIFIER_BONUS',
            scope: 'SOURCE',
            payload: { abilities: [SPELLCASTING_ABILITY_REFERENCE] }
          },
          {
            valueDomainCode: 'DAMAGE',
            modifierKind: 'OPTIONAL_ABILITY_MODIFIER_BONUS',
            scope: 'SOURCE',
            payload: { abilities: [SPELLCASTING_ABILITY_REFERENCE] }
          },
          {
            valueDomainCode: 'WEAPON_DAMAGE_DIE',
            modifierKind: 'SET_VALUE',
            payload: { amount: 8 }
          },
          { valueDomainCode: 'ATTACK_TRAIT', modifierKind: 'ENABLE', domain: { trait: 'MAGICAL' } }
        ]
      },
      maintenance: null
    })
  })

  it.each([
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
    [6, 3],
    [9, 3]
  ])(
    'compiles Magic Weapon cast at level %i to a +%i bonus on a nonmagical weapon',
    (level, bonus) => {
      const plan = compiledCast(MAGIC_WEAPON, level)?.activeEffectPlan
      expect(plan?.chosenItem).toEqual({
        category: 'WEAPON',
        requiredProperties: [],
        excludedProperties: ['MAGIC'],
        equipmentIds: [],
        bindsGrant: true,
        releasedOn: null,
        grantUnlessReleased: false
      })
      // The weapon stays magic when it is dropped: no release ends the spell.
      expect(plan?.modifierGrantContribution?.endTriggers).toEqual([])
      expect(
        plan?.modifierGrantContribution?.modifiers.map(({ valueDomainCode, scope, payload }) => [
          valueDomainCode,
          scope,
          payload
        ])
      ).toEqual([
        ['ATTACK_ROLL', 'SOURCE', { valueKind: 'FIXED', amount: bonus }],
        ['ATTACK_ROLL', 'SOURCE', { valueKind: 'FIXED', amount: bonus }],
        ['DAMAGE', 'SOURCE', { valueKind: 'FIXED', amount: bonus }],
        ['DAMAGE', 'SOURCE', { valueKind: 'FIXED', amount: bonus }],
        ['ATTACK_TRAIT', 'SOURCE', undefined]
      ])
    }
  )

  it('compiles Heat Metal to a Constitution save on a metal item, dropped if held on a failure, with disadvantage otherwise', () => {
    const compiled = compiledCast(HEAT_METAL)
    expect(compiled?.executionPlan.kind).toBe('TEST_OUTCOME')
    expect(compiled?.activeEffectPlan).toMatchObject({
      initialRemaining: 1,
      chosenItem: {
        category: null,
        requiredProperties: ['METAL'],
        excludedProperties: [],
        equipmentIds: [],
        bindsGrant: false,
        releasedOn: 'ON_SAVE_FAIL',
        grantUnlessReleased: true
      },
      maintenance: { definitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
    })
    // Owed on either save result, so no authored path narrows it.
    expect(compiled?.activeEffectPlan?.adapterFacts).toEqual({})
    expect(
      compiled?.activeEffectPlan?.modifierGrantContribution?.modifiers.map((modifier) => [
        modifier.valueDomainCode,
        modifier.modifierKind,
        modifierRollInfluence(modifier),
        modifier.scope
      ])
    ).toEqual([
      ...Array.from({ length: 4 }, () => [
        'ATTACK_ROLL',
        'ROLL_INFLUENCE',
        'DISADVANTAGE',
        'GLOBAL'
      ]),
      ['ABILITY_CHECK', 'ROLL_INFLUENCE', 'DISADVANTAGE', 'GLOBAL']
    ])
  })

  // Parity: Shillelagh written out in core options alone compiles to the SRD plan.
  const shillelaghFromCoreOptions = (chosenItem: object, modifiers: unknown[]) =>
    touchSpellFromCoreOptions(SHILLELAGH, 0x3700, 'ANY', [
      {
        id: testUuid(0x3710),
        order: 1,
        pathCode: 'ON_USE',
        groupType: 'SINGLE',
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        chosenItem,
        resultBlock: {
          id: testUuid(0x3711),
          resultKind: 'SINGLE',
          duration: { id: testUuid(0x3712), durationKind: 'MINUTE', amount: 1 },
          // The grant ends when the target lets go of the item it is bound to.
          lifecycle: {
            endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_CHOSEN_ITEM_RELEASED' }]
          },
          outcomes: [
            {
              id: testUuid(0x3713),
              effectKind: 'APPLY_GRANT',
              bindsChosenItem: true,
              grants: {
                modifiers: modifiers.map((modifier, index) => ({
                  id: testUuid(0x3720 + index),
                  order: index + 1,
                  ...(modifier as object)
                }))
              }
            }
          ]
        }
      }
    ])
  const SHILLELAGH_MODIFIERS = [
    {
      ...boundModifier('ATTACK_ROLL', { attackDomain: 'MELEE' }, 'OPTIONAL_ABILITY_MODIFIER_BONUS'),
      payload: { abilities: ['SPELLCASTING'] }
    },
    {
      ...boundModifier('DAMAGE', { attackDomain: 'MELEE' }, 'OPTIONAL_ABILITY_MODIFIER_BONUS'),
      payload: { abilities: ['SPELLCASTING'] }
    },
    { ...boundModifier('WEAPON_DAMAGE_DIE', {}, 'SET_VALUE'), payload: { amount: 8 } },
    boundModifier('ATTACK_TRAIT', { trait: 'MAGICAL' }, 'ENABLE')
  ]

  it('compiles Shillelagh authored from core options only to the same plan as the SRD data', () => {
    const core = shillelaghFromCoreOptions(
      { equipmentIds: [quarterstaff.id, club.id] },
      SHILLELAGH_MODIFIERS
    )
    const plan = compiledCast(core)?.activeEffectPlan
    const srd = compiledCast(SHILLELAGH)?.activeEffectPlan
    expect(comparablePlan(plan)).toBeTruthy()
    expect(comparablePlan(plan)).toEqual(comparablePlan(srd))
    expect(plan?.chosenItem).toEqual(srd?.chosenItem)
  })

  it('refuses a grant bound to the chosen item that reaches past it', () => {
    const global = shillelaghFromCoreOptions({ equipmentIds: [club.id] }, [
      { ...SHILLELAGH_MODIFIERS[2], scope: 'GLOBAL' }
    ])
    expect(compiledCast(global)?.activeEffectPlan ?? null).toBeNull()
  })

  it('refuses a bound grant whose cast names no item', () => {
    const unnamed = shillelaghFromCoreOptions({}, SHILLELAGH_MODIFIERS)
    const withoutItem = {
      ...unnamed,
      effects: unnamed.effects?.map((effect) => ({
        ...effect,
        paths: effect.paths.map(({ chosenItem: _chosenItem, ...path }) => path)
      }))
    } as SpellAuthored
    expect(compiledCast(withoutItem)?.activeEffectPlan ?? null).toBeNull()
  })
})

describe('incoming-attack and perception spells from core options (SPELLS-4.T2k1, D156)', () => {
  it('holds Blur’s disadvantage on attacks against the caster for a minute under Concentration, except for Blindsight and Truesight', () => {
    const plan = compiledCast(spell('Blur'))?.activeEffectPlan
    expect(plan).toMatchObject({ recurrenceStage: 'END_OF_TURN', initialRemaining: 10 })
    expect(plan?.modifierGrantContribution?.modifiers).toHaveLength(4)
    for (const modifier of plan?.modifierGrantContribution?.modifiers ?? [])
      expect(modifier).toMatchObject({
        valueDomainCode: 'ATTACKS_AGAINST',
        modifierKind: 'ROLL_INFLUENCE',
        payload: { influence: 'DISADVANTAGE' },
        domain: {
          requiresHolderSeesAttacker: false,
          exemptAttackerSenseDefinitionIds: [SRD_BLINDSIGHT_SENSE_ID, SRD_TRUESIGHT_SENSE_ID]
        }
      })
    expect(plan?.maintenance?.definitionId).toBe(SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
  })

  it('gives each creature that fails Enthrall’s save disadvantage on Perception checks for a minute', () => {
    const plan = compiledCast(spell('Enthrall'))?.activeEffectPlan
    expect(plan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      modifierGrantContribution: {
        modifiers: [
          {
            valueDomainCode: 'SKILL_MODIFIER',
            modifierKind: 'ROLL_INFLUENCE',
            payload: { influence: 'DISADVANTAGE' },
            domain: { skillId: SRD_PERCEPTION_SKILL_ID }
          }
        ]
      }
    })
    expect(plan?.maintenance).toBeNull()
  })

  it('gives True Strike’s target advantage against the caster’s first attack on the caster’s next turn, under Concentration', () => {
    const plan = compiledCast(spell('True Strike'))?.activeEffectPlan
    expect(plan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 1,
      tickAnchor: 'SOURCE',
      modifierGrantContribution: {
        endTriggers: [{ event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACKED' }],
        fromSourceOnly: true,
        activeOnlyOnFinalAnchorTurn: true
      }
    })
    expect(plan?.modifierGrantContribution?.modifiers).toHaveLength(4)
    for (const modifier of plan?.modifierGrantContribution?.modifiers ?? [])
      expect(modifier).toMatchObject({
        valueDomainCode: 'ATTACKS_AGAINST',
        modifierKind: 'ROLL_INFLUENCE',
        payload: { influence: 'ADVANTAGE' },
        domain: { requiresHolderSeesAttacker: false }
      })
    expect(plan?.maintenance?.definitionId).toBe(SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
  })

  it('compiles Mirror Image into three attack decoys that end the effect after three uses, which the caster can dismiss with an Action', () => {
    const decoySpell = spell('Mirror Image')
    const plan = compiledCast(decoySpell)?.activeEffectPlan
    expect(plan).toMatchObject({
      initialRemaining: 10,
      modifierGrantContribution: { uses: 3, holderEnd: { activation: 'ACTION' } }
    })
    const [decoys, ...others] = plan?.modifierGrantContribution?.modifiers ?? []
    expect(others).toEqual([])
    expect(decoys).toMatchObject({
      valueDomainCode: 'ATTACK_DECOYS',
      modifierKind: 'ENABLE',
      payload: {
        armorClass: { amount: 10, abilities: ['DEXTERITY'] },
        thresholds: [
          { remaining: 3, minimumRoll: 6 },
          { remaining: 2, minimumRoll: 8 },
          { remaining: 1, minimumRoll: 11 }
        ]
      }
    })
    const effect = plannedTimedCondition({
      encounterId: testUuid(0xd921),
      sourceActorId: testUuid(0xd922),
      holderActorId: testUuid(0xd922),
      spell: decoySpell,
      lifetimeScope: 'ENCOUNTER'
    })
    expect(effect.definition.recurrence).toMatchObject({ uses: 3 })
    expect(effect.lifecycle).toMatchObject({ remainingTicks: 10, remainingUses: 3 })
  })
})

describe('a zone that acts per distance moved inside it (SPELLS-4.T1h, D156)', () => {
  const SPIKE_GROWTH = spell('Spike Growth')
  /** The first zone component the spell authors, which a changed copy may edit in place. */
  const firstComponent = (authored: SpellAuthored): ManifestComponentAuthored => {
    const outcome = authored.effects?.[0]?.paths?.flatMap((path) =>
      'resultBlock' in path && path.resultBlock ? path.resultBlock.outcomes : []
    )[0]
    const component = outcome && 'components' in outcome ? outcome.components?.[0] : undefined
    if (!component) throw new Error(`${authored.label} must author a zone component.`)
    return component
  }
  const changed = (edit: (component: ManifestComponentAuthored) => void) => {
    const copy = structuredClone(SPIKE_GROWTH)
    edit(firstComponent(copy))
    return copy
  }

  it('places Spike Growth as a doubled-cost zone dealing its 2d4 per 5 feet, with no closed rule', () => {
    const cast = compiledCast(SPIKE_GROWTH)
    const zone = cast?.zonePlacement

    expect(cast?.activeEffectPlan).toBeNull()
    expect(zone).toMatchObject({
      label: 'Spike Growth',
      triggerModes: ['ENTER', 'CROSS'],
      movementCostMultiplier: 2,
      perDistanceMoved: { amount: 5, unit: 'FEET' }
    })
    if (!zone || 'options' in zone) throw new Error('Spike Growth places one zone.')
    expect(zone).not.toHaveProperty('turnTriggers')
    expect(zone).not.toHaveProperty('maxApplicationsPerTurn')
    expect(
      zone.entry.frozenGraph.definition.nodes
        .filter((node) => node.operation.key === 'evidence.integer-range')
        .map((node) => node.inputs.max)
    ).toEqual([
      { kind: 'LITERAL', value: 4 },
      { kind: 'LITERAL', value: 4 }
    ])
  })

  it('resolves the step in Scene distance and places a zone no teleport passes through', () => {
    const entry = compiledCastEntry(SPIKE_GROWTH)
    const zone = entry?.compilation.zonePlacement
    if (!entry?.targetPolicy || !zone || 'options' in zone)
      throw new Error('Spike Growth places one zone at a point in range.')
    const feetGrid = {
      kind: 'SQUARE' as const,
      cellSize: 100,
      diagonalPolicy: 'EQUAL' as const,
      distancePerCell: 5,
      origin: { x: 0, y: 0 },
      unit: 'FEET' as const
    }
    const aimed = (grid: Parameters<typeof evaluateEncounterZoneTarget>[0]['grid']) =>
      evaluateEncounterZoneTarget({
        zone,
        range: entry.targetPolicy!.range,
        target: {
          kind: 'POINT',
          point: { x: 1000, y: 0 }
        },
        grid,
        sourceToken: { position: { x: 0, y: 0 }, height: 1, width: 1, rotationDegrees: 0 },
        aimSeen: true
      })
    const target = aimed(feetGrid)
    if (!('shape' in target)) throw new Error('Spike Growth must aim at a point in range.')
    const place = (distanceStep: number | undefined) =>
      planEncounterPlacedZone({
        zone,
        id: testUuid(0xb3c1),
        maintainedEffectStateId: null,
        encounterId: testUuid(0xb3c2),
        occurrenceId: testUuid(0xb3c3),
        rootCommandId: testUuid(0xb3c4),
        sourceActorId: testUuid(0xb3c5),
        point: { x: 1000, y: 0 },
        area: target.shape,
        sourceToken: null,
        saveDc: null,
        distanceStep
      })

    expect(target.distanceStep).toBe(5)
    expect(aimed({ ...feetGrid, distancePerCell: 1.5, unit: 'METERS' })).toMatchObject({
      distanceStep: expect.closeTo(1.524)
    })
    expect(place(5).placement).toMatchObject({
      distanceStep: 5,
      movementKinds: ['VOLUNTARY', 'FORCED'],
      movementCostMultiplier: 2
    })
    expect(() => place(undefined)).toThrow('per distance moved')
  })

  it.each([
    [
      'a turn trigger',
      (component: ManifestComponentAuthored) => {
        component.interactionKinds = ['ENTER_OR_PASS_THROUGH', 'END_TURN_IN_SPACE']
      }
    ],
    [
      'a per-turn limit',
      (component: ManifestComponentAuthored) => {
        component.maxApplicationsPerTurn = 1
      }
    ],
    [
      'no entering trigger',
      (component: ManifestComponentAuthored) => {
        component.interactionKinds = ['MOVE_ACROSS']
      }
    ]
  ])('refuses the option beside %s, which compiles without it', (_, edit) => {
    expect(compiledCast(changed(edit))).toBeNull()
    expect(
      compiledCast(
        changed((component) => {
          edit(component)
          delete component.perDistanceMoved
        })
      )
    ).not.toBeNull()
  })

  it('refuses the option on a component whose behavior is a save, which compiles without it', () => {
    // Wall of Thorns' thorns save for half on entry; without their turn end and per-turn limit,
    // only the save stands beside the option.
    const thorns = (perDistanceMoved: boolean) => {
      const copy = structuredClone(WALL_OF_THORNS)
      const choice = copy.effects?.[0]?.paths?.find((path) => 'options' in path)
      for (const option of choice && 'options' in choice ? (choice.options ?? []) : []) {
        const [outcome] = option.resultBlock?.outcomes ?? []
        const component = outcome && 'components' in outcome ? outcome.components?.[0] : undefined
        if (!component) throw new Error('Wall of Thorns must author its thorns.')
        component.interactionKinds = ['ENTER_OR_PASS_THROUGH']
        delete component.maxApplicationsPerTurn
        if (perDistanceMoved) component.perDistanceMoved = { amount: 5, unit: 'FEET' }
      }
      return copy
    }

    expect(compiledCast(thorns(false))).not.toBeNull()
    expect(compiledCast(thorns(true))).toBeNull()
  })
})

describe('the creature a summon spell conjures (SPELLS-4.T2v2a2a)', () => {
  it('compiles Arcane Hand’s stat block and a carrier that ends with its duration', () => {
    const authored = spell('Arcane Hand')
    const cast = compiledCast(authored)
    const path = authored.effects?.[0]?.paths[0]
    const manifest = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
    if (manifest?.effectKind !== 'MANIFEST' || manifest.manifestKind !== 'SUMMON')
      throw new Error('The spell must author a summon.')

    expect(cast?.summonPlacement).toMatchObject({
      summonOutcomeId: manifest.id,
      statBlock: manifest.statBlock,
      entry: { initialRemaining: 10, authoredEffectId: authored.effects?.[0]?.id }
    })
    expect(cast?.zonePlacement).toBeNull()
    expect(cast?.choice).toBeNull()
    expect(cast?.executionPlan).toMatchObject({
      kind: 'SINGLE_GRAPH',
      published: cast?.summonPlacement?.entry.frozenGraph
    })
    expect(cast?.summonPlacement?.entry.maintenance).not.toBeNull()
  })

  it('holds a CONJURED repeat on the carrier of an empty grant beside the summon (SPELLS-4.T2v2a3a)', () => {
    // A homebrew hand whose owner attacks through it: the attack is a sibling Effect, offered back
    // to the caster for as long as the hand lasts and measured from the hand.
    const conjuring = (edit?: (block: { outcomes: unknown[]; lifecycle?: unknown }) => void) => {
      const authored = structuredClone(spell('Arcane Hand'))
      const attack = structuredClone(spell('Flame Blade').effects?.[1])
      const path = authored.effects?.[0]?.paths[0]
      if (!attack || path?.selectionKind !== 'FIXED') throw new Error('The spells must author.')
      // Only the hand itself: its own fist and carrier give way to the homebrew attack.
      authored.effects = [authored.effects![0]!, { ...attack, order: 2 }]
      path.resultBlock.outcomes = path.resultBlock.outcomes.slice(0, 1)
      path.resultBlock.lifecycle = {
        effectOffers: [
          {
            kind: 'REPEAT_SOURCE_PATH',
            offeredTo: 'SOURCE',
            activation: 'BONUS_ACTION',
            effectId: attack.id,
            target: 'INVOCATION',
            origin: 'CONJURED'
          }
        ]
      }
      path.resultBlock.outcomes.push({
        id: testUuid(0xa3a1),
        effectKind: 'APPLY_GRANT',
        grants: {}
      })
      edit?.(path.resultBlock)
      return authored
    }
    const cast = compiledCast(conjuring())

    expect(cast?.summonPlacement?.entry).toMatchObject({
      initialRemaining: 10,
      frozenGraphNodeId: 'modifier-grant',
      modifierGrantContribution: {
        modifiers: [],
        effectOffers: [{ kind: 'REPEAT_SOURCE_PATH', origin: 'CONJURED', target: 'INVOCATION' }]
      }
    })
    expect(cast?.summonPlacement?.entry.maintenance).not.toBeNull()
    expect(cast?.executionPlan).toMatchObject({
      kind: 'SINGLE_GRAPH',
      published: cast?.summonPlacement?.entry.frozenGraph
    })
    // An empty grant that holds no offers, or a third outcome, is refused rather than partly honored.
    expect(
      compiledCastEntry(
        conjuring((block) => {
          delete block.lifecycle
        })
      )
    ).toBeNull()
    expect(
      compiledCastEntry(
        conjuring(({ outcomes }) =>
          outcomes.push({ id: testUuid(0xa3a3), effectKind: 'APPLY_GRANT', grants: {} })
        )
      )
    ).toBeNull()
  })

  it('builds the Sheet’s summon and the Encounter’s from the one compiled plan (D190, SPELLS-34.4)', () => {
    const authored = spell('Arcane Hand')
    const placement = compiledCast(authored)?.summonPlacement
    if (!placement) throw new Error('Arcane Hand must compile a summon plan.')
    const NOW = '2026-10-23T00:00:00.000Z'
    const caster = encounterRunActorStateSchema.parse({
      id: testUuid(1),
      encounterId: testUuid(2),
      sideId: testUuid(3),
      kind: 'CHARACTER',
      sourceId: testUuid(4),
      frozenState: null,
      absence: null,
      form: null,
      label: 'Aria',
      systemId: SRD_SYSTEM_ID,
      stableTieKey: testUuid(5),
      public: true,
      controllerUserIds: [testUuid(6)],
      disposition: 'FRIENDLY',
      healthDisplay: null,
      resources: {},
      gmNotes: null,
      initiative: null,
      manualOrder: null,
      createdAt: NOW,
      updatedAt: NOW,
      snapshot: { kind: 'CHARACTER', id: testUuid(4), label: 'Aria', systemId: SRD_SYSTEM_ID }
    })
    const label = placement.label ?? authored.label
    const { actor } = buildEncounterSummon({
      summon: placement,
      caster,
      casterHitPointMaximum: 40,
      sourceEffectId: testUuid(8),
      label,
      point: { x: 0, y: 0 },
      edgeLength: 100,
      occurredAt: NOW
    })
    const sheetSummon = buildSheetSpellSummon({
      placement,
      casterHitPointMaximum: 40,
      spellId: authored.id,
      label: authored.label,
      id: testUuid(7),
      castAt: NOW
    })
    if (!('maxHitPoints' in actor))
      throw new Error('Expected the summon to hold its own hit points.')

    expect(sheetSummon).toMatchObject({
      label: actor.label,
      maximumHitPoints: actor.maxHitPoints,
      currentHitPoints: actor.currentHitPoints,
      armorClass: 20,
      concentration: true,
      summonOutcomeId: placement.summonOutcomeId,
      size: 'LARGE',
      abilityScores: { STRENGTH: 26 },
      speeds: placement.statBlock.speeds
    })
    expect(sheetSummon).not.toHaveProperty('passivePerception')
    expect(actor.maxHitPoints).toBe(40)
  })

  it('conjures Spiritual Weapon: invulnerable, taking no space, attacked through as a bonus action that is free on the cast turn (SPELLS-4.T2v2a3d)', () => {
    const attack = SPIRITUAL_WEAPON.effects?.[1]
    const cast = compiledCast(SPIRITUAL_WEAPON)

    expect(cast?.summonPlacement).toMatchObject({
      label: 'Spiritual Weapon',
      statBlock: {
        speeds: [{ amount: 20, unit: 'FEET' }],
        damageabilityKind: 'INVULNERABLE',
        occupiesSpace: false
      },
      entry: {
        initialRemaining: 10,
        modifierGrantContribution: {
          effectOffers: [
            {
              kind: 'REPEAT_SOURCE_PATH',
              activation: 'BONUS_ACTION',
              target: 'INVOCATION',
              origin: 'CONJURED',
              castTurnUse: 'FREE_ONCE',
              effect: { id: attack?.id, invocation: { activation: { code: 'BONUS_ACTION' } } }
            }
          ]
        }
      }
    })
    // The spell is not Concentration: it lasts its minute.
    expect(cast?.summonPlacement?.entry.maintenance).toBeNull()
  })

  describe('the Effect Spiritual Weapon’s offer repeats (SPELLS-4.T2v2a3d)', () => {
    const attack = SPIRITUAL_WEAPON.effects?.[1]
    const casts = [2, 4].map((level, sequence) => candidate(SPIRITUAL_WEAPON, level, { sequence }))
    const { spellActionFacts } = buildCharacterSpellActionRuleFacts({
      spellIds: [SPIRITUAL_WEAPON.id],
      spells: [compileSpell(SPIRITUAL_WEAPON)]
    })
    // A +5 spell attack bonus at proficiency +2 is a +3 spellcasting modifier.
    const evaluated = evaluateDnd5e2014CharacterActions({
      candidates: [],
      abilityDefinitions: [],
      spellCandidates: casts,
      spellSlots: [],
      spellEffects: spellActionFacts,
      spellMechanics: [{ source: casts[0]!.source, attackBonus: 5, saveDc: 13, damageBonus: 0 }],
      spellcastingLocked: false,
      proficiencies: [],
      itemAdjustments: [],
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      modifierGroups: [],
      totalLevel: 3,
      classLevels: [],
      proficiencyBonus: 2,
      abilities: [],
      skills: [],
      spellcasting: null
    })

    it('is kept apart from the castable Effects, and only the Effect an offer names is kept', () => {
      expect(spellActionFacts).toEqual([
        expect.objectContaining({
          effects: [expect.objectContaining({ effectId: SPIRITUAL_WEAPON.effects?.[0]?.id })],
          repeatedEffects: [expect.objectContaining({ effectId: attack?.id })]
        })
      ])
      const {
        spellActionFacts: [fireball]
      } = buildCharacterSpellActionRuleFacts({
        spellIds: [FIREBALL.id],
        spells: [compileSpell(FIREBALL)]
      })
      expect(fireball).not.toHaveProperty('repeatedEffects')
    })

    it('is resolved with each cast, at its level and with the caster’s spellcasting modifier', () => {
      expect(
        evaluated.spellCastMechanics.map(({ repeatMechanics }) =>
          repeatMechanics?.flatMap(({ outcomes }) =>
            outcomes.map((outcome) => outcome.kind === 'DAMAGE' && outcome.diceExpression)
          )
        )
      ).toEqual([['1d8 + 3'], ['2d8 + 3']])
    })

    it('makes no cast action of its own', () => {
      const built = build(casts, {
        policyOutput: {
          ...policyFor(casts, authoredById),
          spellCastMechanics: evaluated.spellCastMechanics
        }
      })
      expect(built.candidates.map((entry) => entry.actionId)).toEqual(
        casts.map((cast) => spellCastActionId(cast.candidateId))
      )
      expect(built.candidates.map((entry) => entry.effectId)).not.toContain(attack?.id)
    })
  })

  it('conjures Arcane Hand: a Large hand that takes no space, struck through as a bonus action that is free on the cast turn (SPELLS-4.T2v2b)', () => {
    const authored = spell('Arcane Hand')
    const fist = authored.effects?.[1]
    const cast = compiledCast(authored)

    expect(cast?.summonPlacement).toMatchObject({
      statBlock: {
        size: 'LARGE',
        hitPoints: { kind: 'HIT_POINT_MAXIMUM' },
        speeds: [{ amount: 60, unit: 'FEET' }],
        abilityScores: { STRENGTH: { value: 26 }, DEXTERITY: { value: 10 } },
        damageabilityKind: 'NORMAL',
        occupiesSpace: false
      },
      entry: {
        initialRemaining: 10,
        modifierGrantContribution: {
          effectOffers: [
            {
              kind: 'REPEAT_SOURCE_PATH',
              activation: 'BONUS_ACTION',
              target: 'INVOCATION',
              origin: 'CONJURED',
              castTurnUse: 'FREE_ONCE',
              effect: { id: fist?.id, invocation: { activation: { code: 'BONUS_ACTION' } } }
            }
          ]
        }
      }
    })
    expect(cast?.summonPlacement?.entry.maintenance).not.toBeNull()
  })

  it('resolves the Clenched Fist at each cast’s level: 4d8 force, and 2d8 more per slot above 5th (SPELLS-4.T2v2b)', () => {
    const authored = spell('Arcane Hand')
    const casts = [5, 7].map((level, sequence) => candidate(authored, level, { sequence }))
    const { spellActionFacts } = buildCharacterSpellActionRuleFacts({
      spellIds: [authored.id],
      spells: [compileSpell(authored)]
    })
    const evaluated = evaluateDnd5e2014CharacterActions({
      candidates: [],
      abilityDefinitions: [],
      spellCandidates: casts,
      spellSlots: [],
      spellEffects: spellActionFacts,
      spellMechanics: [{ source: casts[0]!.source, attackBonus: 7, saveDc: 15, damageBonus: 0 }],
      spellcastingLocked: false,
      proficiencies: [],
      itemAdjustments: [],
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      modifierGroups: [],
      totalLevel: 9,
      classLevels: [],
      proficiencyBonus: 4,
      abilities: [],
      skills: [],
      spellcasting: null
    })

    expect(
      evaluated.spellCastMechanics.map(({ repeatMechanics }) =>
        repeatMechanics?.flatMap(({ outcomes }) =>
          outcomes.map((outcome) => outcome.kind === 'DAMAGE' && outcome.diceExpression)
        )
      )
    ).toEqual([['4d8'], ['8d8']])
  })

  it('conjures Mage Hand: an invulnerable hand that takes no space, flies 30 feet and lasts its minute (SPELLS-4.T2v2b)', () => {
    const cast = compiledCast(spell('Mage Hand'))

    expect(cast?.summonPlacement).toMatchObject({
      statBlock: {
        speeds: [{ amount: 30, unit: 'FEET' }],
        damageabilityKind: 'INVULNERABLE',
        occupiesSpace: false
      },
      entry: { initialRemaining: 10, maintenance: null }
    })
    expect(cast?.summonPlacement?.statBlock).not.toHaveProperty('hitPoints')
  })
})

describe('the healing a caster’s HEALING_DEALT bonus adds to a heal spell (SPELLS-31.T4n)', () => {
  const discipleOfLife = (addsSpellLevel: boolean) => ({
    domainKey: `HEALING_DEALT:BONUS${addsSpellLevel ? '|addsSpellLevel=true' : ''}`,
    contributions: [
      {
        sourceId: 'disciple-of-life',
        value: 2,
        ability: null,
        state: 'APPLIED' as const,
        scope: 'GLOBAL' as const,
        deferredRequirements: [],
        scopeSpellIds: []
      }
    ]
  })

  /** The heal expression and per-level scaling of a spell cast at the given levels. */
  function healOf(
    authored: SpellAuthored,
    levels: readonly number[],
    modifierGroups: EvaluateInput['modifierGroups']
  ) {
    const casts = levels.map((level, sequence) => candidate(authored, level, { sequence }))
    const { spellActionFacts } = buildCharacterSpellActionRuleFacts({
      spellIds: [authored.id],
      spells: [compileSpell(authored)]
    })
    const evaluated = evaluateDnd5e2014CharacterActions({
      candidates: [],
      abilityDefinitions: [],
      spellCandidates: casts,
      spellSlots: [],
      spellEffects: spellActionFacts,
      spellMechanics: [{ source: casts[0]!.source, attackBonus: 5, saveDc: 13, damageBonus: 0 }],
      spellcastingLocked: false,
      proficiencies: [],
      itemAdjustments: [],
      activeSourceIds: [],
      activeEquipmentInstanceIds: [],
      resources: [],
      modifierGroups,
      totalLevel: 3,
      classLevels: [],
      proficiencyBonus: 2,
      abilities: [],
      skills: [],
      spellcasting: null
    })
    return evaluated.spellCastMechanics.map(({ mechanics }) =>
      mechanics.flatMap(({ outcomes }) =>
        outcomes.flatMap((outcome) => (outcome.kind === 'HEAL' ? [outcome.expression] : []))
      )
    )
  }
  const tail = (expression: string) => Number(/\+ (\d+)$/.exec(expression)?.[1] ?? 0)

  it('adds its amount and the cast level to a leveled heal, each cast at its own level', () => {
    const base = healOf(CURE_WOUNDS, [1, 3], [])
    const boosted = healOf(CURE_WOUNDS, [1, 3], [discipleOfLife(true)])
    expect(boosted.map(([expression]) => tail(expression!))).toEqual(
      base.map(([expression], index) => tail(expression!) + 2 + [1, 3][index]!)
    )
  })

  it('adds the amount alone when the bonus does not add the cast level', () => {
    const base = healOf(CURE_WOUNDS, [2], [])
    const boosted = healOf(CURE_WOUNDS, [2], [discipleOfLife(false)])
    expect(tail(boosted[0]![0]!)).toBe(tail(base[0]![0]!) + 2)
  })

  it('leaves the heal at its dice and spellcasting modifier without the bonus', () => {
    expect(healOf(CURE_WOUNDS, [1], [])).toEqual([['1d8 + 3']])
  })
})
