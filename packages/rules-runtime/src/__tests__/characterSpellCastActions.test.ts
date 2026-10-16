import { describe, expect, it } from 'vitest'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareNativeCharacterActionState } from '../character/characterNativeActionResources.js'
import {
  buildCharacterSpellCastActions,
  readSpellCastSlot,
  spellCastActionId
} from '../character/characterSpellCastActions.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscoveryRegistry.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { fixedHealSpell } from '../testing/fixedHealSpell.js'
import { evaluateSrdCharacter } from './dnd5eSrdCharacter.js'

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
const authoredById = new Map(
  [
    FIREBALL,
    MEND,
    FLY,
    HOLD_PERSON,
    DERIVED_FLY,
    PLAIN_HOLD,
    CURE_WOUNDS,
    HEALING_WORD,
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
    policyOutput: policyFor(candidates, authoredById, slotKeyFor),
    spellDocumentsById: authoredById,
    firstSequence: 10,
    ...overrides
  })
}

/** The compiled entry the Encounter would run for the spell's cast, or null when it stays manual. */
function compiledCast(authored: SpellAuthored, castLevel = authored.level) {
  const built = build([candidate(authored, castLevel)])
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
    ? entry.compilation
    : null
}

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

  it.each([
    ['a ritual', { castMode: 'RITUAL' as const }],
    ['a limited-use cast', { castMode: 'LIMITED_USE' as const }],
    [
      'a fixed-level cast paid from a resource',
      { castMode: 'FIXED_LEVEL' as const, resourceOwnerKey: 'AUTHORED_GRANT:pool' }
    ]
  ])('does not offer %s', (_name, overrides) => {
    expect(build([candidate(FIREBALL, 3, overrides)]).candidates).toEqual([])
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
    expect(plan?.conditionContribution).not.toBeNull()
  })

  it('starts no Concentration for a spell that is not a Concentration spell', () => {
    const plan = compiledCast(PLAIN_HOLD)?.activeEffectPlan
    expect(plan).toBeDefined()
    expect(plan?.maintenance).toBeNull()
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
