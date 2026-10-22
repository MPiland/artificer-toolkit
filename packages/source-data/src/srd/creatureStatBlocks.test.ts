import type { AbilityCode, CreatureAuthored } from '@artificer-toolkit/shared'
import { printCreatureSenses } from '@artificer-toolkit/shared/subjects/core'
import { describe, expect, it } from 'vitest'
import { SRD_CREATURE_DESCRIPTION_ONLY_ACTIONS } from './creatureDescriptionOnlyActions.js'
import { isPrintedMultiattack, printedActionHasMechanics } from './creatureStatBlockAudit.js'
import { SRD_CREATURE_STAT_BLOCK_EXCEPTIONS } from './creatureStatBlockExceptions.js'
import { SRD_CREATURE_STAT_BLOCKS, type SrdCreatureStatBlock } from './creatures/stat-blocks.js'
import { srdBaselineContent } from './index.js'
import { SRD_SENSE_DEFINITIONS } from './senses.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ALIGNMENTS,
  SRD_CHALLENGE_RATINGS,
  SRD_CONDITION_TYPES,
  SRD_CREATURE_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_LANGUAGES,
  SRD_SKILLS,
  SRD_SPEEDS
} from './vocabulary.js'

const codeById = new Map(
  [
    ...SRD_ALIGNMENTS,
    ...SRD_CHALLENGE_RATINGS,
    ...SRD_CONDITION_TYPES,
    ...SRD_CREATURE_TYPES,
    ...SRD_DAMAGE_TYPES,
    ...SRD_LANGUAGES,
    ...SRD_SKILLS,
    ...SRD_SPEEDS
  ].map((entry) => [entry.id, entry.code])
)
const codes = (ids: readonly string[] | undefined) =>
  (ids ?? []).map((id) => codeById.get(id) ?? id).sort()
const sorted = (values: readonly string[] | undefined) => [...(values ?? [])].sort()
const abilityByDefinitionId = new Map(
  Object.entries(SRD_ABILITY_DEFINITION_IDS).map(([ability, id]) => [id, ability as AbilityCode])
)
const skillAbility = new Map(
  SRD_SKILLS.map((skill) => [
    skill.code,
    abilityByDefinitionId.get(skill.governingAbilityDefinitionId)!
  ])
)
const proficiencyBonus = new Map<string, number>(
  SRD_CHALLENGE_RATINGS.map((rating) => [rating.code, rating.proficiencyBonus])
)
const modifier = (score: number) => Math.floor((score - 10) / 2)

/** Features authored from the Languages line rather than printed as a named trait. */
const LANGUAGE_FEATURE_LABELS = new Set([
  'Telepathy',
  'Language Limitation',
  'Language Knowledge',
  'Speech Limitation'
])

type Defense = NonNullable<SrdCreatureStatBlock['damageResistances']>[number]

const senseNameById = new Map(SRD_SENSE_DEFINITIONS.map((sense) => [sense.id, sense.label]))
const senseLabel = (id: string) => senseNameById.get(id) ?? id

/** "blindsight 60 ft. (blind beyond this radius)" read apart from the authored model. */
function parsePrintedSense(printed: string) {
  const match = /^(\w+) (\d+) ft\.(?: (.+))?$/.exec(printed)
  if (!match) throw new Error(`Unreadable printed Sense "${printed}".`)
  return { sense: match[1], feet: Number(match[2]), qualifier: match[3] ?? null }
}

function structuredSense(sense: NonNullable<CreatureAuthored['senses']>[number]) {
  const { range } = sense
  return {
    sense: senseLabel(sense.senseDefinitionId).toLowerCase(),
    feet: range.rangeKind === 'DISTANCE' && range.unit === 'FEET' ? range.amount : null,
    qualifier: sense.qualifier ?? null
  }
}

/** Each field's printed and authored values, compared as JSON. */
function statBlockFields(creature: CreatureAuthored, block: SrdCreatureStatBlock) {
  const proficiencies = [
    ...creature.proficiencies,
    ...creature.features.flatMap((feature) => feature.grants?.proficiencies ?? [])
  ]
  const saveAbilities = proficiencies.flatMap((grant) =>
    grant.proficiencyKind === 'SAVE_ABILITY' && 'abilities' in grant ? (grant.abilities ?? []) : []
  )
  const skillLevels = new Map<string, string>(
    creature.proficiencies.flatMap((grant) =>
      grant.proficiencyKind === 'SKILL' && 'skillIds' in grant
        ? (grant.skillIds ?? []).map((id) => [codeById.get(id)!, grant.level] as const)
        : []
    )
  )
  const challengeRating = codeById.get(creature.challengeRatingId ?? '')
  const bonus = proficiencyBonus.get(challengeRating ?? '') ?? 0
  const authoredSkills = Object.fromEntries(
    [...skillLevels].map(([skill, level]) => [
      skill,
      modifier(creature.abilityScores[skillAbility.get(skill)!]) +
        (level === 'DOUBLE' ? 2 * bonus : bonus)
    ])
  )
  const printedSaves = block.savingThrows ?? {}
  const defenses = (printed: readonly Defense[] | undefined) =>
    sorted(
      (printed ?? [])
        .filter((defense) => !defense.bypassedBy && !defense.qualifier)
        .flatMap((defense) => defense.damageTypes)
    )
  const qualified = (kind: 'RESISTANCE' | 'IMMUNITY', printed: readonly Defense[] | undefined) =>
    (printed ?? [])
      .filter((defense) => defense.bypassedBy)
      .map((defense) => ({
        kind,
        damageTypes: sorted(defense.damageTypes),
        bypassedBy: sorted(defense.bypassedBy)
      }))

  const telepathy = creature.features.find((feature) => feature.label === 'Telepathy')
  // "Speed 0 ft." prints the absence of a walking speed.
  const speeds = Object.fromEntries(
    creature.speeds
      .filter((speed) => speed.amount > 0)
      .map((speed) => [codeById.get(speed.speedId), speed.amount])
  )
  const printedSpeeds = Object.fromEntries(
    Object.entries(block.speeds).filter(([, amount]) => amount > 0)
  )
  const hitDice = creature.hitDice
    ? `${creature.hitDice.count}d${creature.hitDice.die}${creature.hitDice.modifier ? `${creature.hitDice.modifier > 0 ? '+' : ''}${creature.hitDice.modifier}` : ''}`
    : undefined

  return {
    size: [block.size, creature.size],
    creatureType: [block.creatureType, codeById.get(creature.creatureTypeId)],
    // A Creature has no swarm model yet: each swarm's member size is an exception (D60).
    swarmOf: [block.swarmOf, undefined],
    tags: [sorted(block.tags), sorted(creature.tags?.filter((tag) => tag !== 'hover'))],
    hover: [block.hover === true, creature.tags?.includes('hover') === true],
    alignment: [block.alignmentCode, codeById.get(creature.alignmentId ?? '')],
    hitPoints: [block.hitPoints, creature.hitPoints],
    hitDice: [block.hitDice, hitDice],
    speeds: [printedSpeeds, speeds],
    abilityScores: [block.abilityScores, creature.abilityScores],
    savingThrows: [sorted(Object.keys(printedSaves)), sorted(saveAbilities)],
    savingThrowBonuses: [
      printedSaves,
      Object.fromEntries(
        Object.keys(printedSaves).map((ability) => [
          ability,
          modifier(creature.abilityScores[ability as AbilityCode]) + bonus
        ])
      )
    ],
    skills: [block.skills ?? {}, authoredSkills],
    damageVulnerabilities: [
      defenses(block.damageVulnerabilities),
      codes(creature.damageVulnerabilities)
    ],
    damageResistances: [defenses(block.damageResistances), codes(creature.damageResistances)],
    damageImmunities: [defenses(block.damageImmunities), codes(creature.damageImmunities)],
    qualifiedDamageDefenses: [
      [
        ...qualified('RESISTANCE', block.damageResistances),
        ...qualified('IMMUNITY', block.damageImmunities)
      ],
      creature.qualifiedDamageDefenses.map((defense) => ({
        kind: defense.kind,
        damageTypes: codes(defense.damageTypeIds),
        bypassedBy: sorted(defense.bypassedBy)
      }))
    ],
    unrepresentedDamageDefenses: [
      [
        ...(block.damageVulnerabilities ?? []),
        ...(block.damageResistances ?? []),
        ...(block.damageImmunities ?? [])
      ]
        .filter((defense) => defense.qualifier && !defense.bypassedBy)
        .map((defense) => defense.qualifier),
      []
    ],
    conditionImmunities: [sorted(block.conditionImmunities), codes(creature.conditionImmunities)],
    senses: [(block.senses ?? []).map(parsePrintedSense), creature.senses.map(structuredSense)],
    passivePerception: [block.passivePerception, creature.passivePerception],
    languages: [
      sorted(block.languageCodes),
      sorted([
        ...new Set(
          proficiencies.flatMap((grant) =>
            grant.proficiencyKind === 'LANGUAGE' && 'languageIds' in grant
              ? codes(grant.languageIds)
              : []
          )
        )
      ])
    ],
    telepathy: [
      block.telepathy,
      telepathy ? Number(/(\d+) (?:ft|feet)/.exec(telepathy.description ?? '')?.[1]) : undefined
    ],
    challengeRating: [block.challengeRating, challengeRating],
    xp: [block.xp, creature.xp]
  } satisfies Record<string, [unknown, unknown]>
}

/**
 * `features +Name` for each printed trait, action or reaction the Creature does not author, and
 * `features -Name` for each authored one the stat block does not print; likewise legendary actions.
 */
function nameDifferences(creature: CreatureAuthored, block: SrdCreatureStatBlock) {
  const legendary = creature.features.find((feature) => feature.label === 'Legendary Actions')
  const lists = {
    features: [
      [...block.traits, ...block.actions, ...(block.reactions ?? [])],
      creature.features
        .filter((feature) => feature !== legendary && !LANGUAGE_FEATURE_LABELS.has(feature.label))
        .map((feature) => feature.label)
    ],
    legendaryActions: [
      block.legendaryActions ?? [],
      (legendary?.options ?? []).map((option) => option.label)
    ]
  }
  return Object.entries(lists).flatMap(([field, [printed, authored]]) => {
    const unprinted = [...authored]
    const unauthored = printed.filter((name) => {
      const index = unprinted.indexOf(name)
      if (index >= 0) unprinted.splice(index, 1)
      return index < 0
    })
    return [
      ...unauthored.map((name) => `${field} +${name}`),
      ...unprinted.map((name) => `${field} -${name}`)
    ]
  })
}

/** JSON with object keys sorted, so key order never counts as a difference. */
const canonical = (value: unknown) =>
  JSON.stringify(value, (_key, nested: unknown) =>
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.entries(nested).sort(([left], [right]) => left.localeCompare(right))
        )
      : nested
  )

/** `Creature label|field` of every field whose authored value differs from its printed one. */
const mismatches = new Map<string, string>(
  srdBaselineContent.subjects.creatures.flatMap((creature): [string, string][] => {
    const block = SRD_CREATURE_STAT_BLOCKS.get(creature.id)
    if (!block) return [[`${creature.label}|statBlock`, 'no printed stat block']]
    return [
      ...Object.entries(statBlockFields(creature, block))
        .map(([field, [printed, authored]]) => [field, canonical(printed), canonical(authored)])
        .filter(([, printed, authored]) => printed !== authored)
        .map(([field, printed, authored]): [string, string] => [
          `${creature.label}|${field}`,
          `printed ${printed}, authored ${authored}`
        ]),
      ...nameDifferences(creature, block).map((difference): [string, string] => [
        `${creature.label}|${difference}`,
        'names differ'
      ])
    ]
  })
)

/**
 * `Creature label|actions Name` (or `reactions`, `legendaryActions`) of every printed action whose
 * authored Feature or legendary option has no Effect, on itself or on one of its options, and names no
 * action it runs (D51 option B) and authors no attack slots (D93). A printed name with no authored source at all is a name difference
 * above instead.
 */
const descriptionOnlyActions = new Set(
  srdBaselineContent.subjects.creatures.flatMap((creature) => {
    const block = SRD_CREATURE_STAT_BLOCKS.get(creature.id)
    if (!block) return []
    const features = creature.features
    const legendary = features.find((feature) => feature.label === 'Legendary Actions')
    const lists = {
      actions: [block.actions, features],
      reactions: [block.reactions ?? [], features],
      legendaryActions: [block.legendaryActions ?? [], legendary?.options ?? []]
    } as const
    return Object.entries(lists).flatMap(([field, [printed, sources]]) =>
      printed.flatMap((name) => {
        const source = sources.find((candidate) => candidate.label === name)
        return source && !printedActionHasMechanics(name, source)
          ? [`${creature.label}|${field} ${name}`]
          : []
      })
    )
  })
)

describe('SRD Creature stat blocks', () => {
  it('authors an Effect for every printed action, except listed description-only ones', () => {
    expect(
      [...descriptionOnlyActions].filter((key) => !SRD_CREATURE_DESCRIPTION_ONLY_ACTIONS.has(key))
    ).toEqual([])
  })

  it('keeps only description-only actions that still lack an Effect', () => {
    expect(
      [...SRD_CREATURE_DESCRIPTION_ONLY_ACTIONS.keys()].filter(
        (key) => !descriptionOnlyActions.has(key)
      )
    ).toEqual([])
  })

  it('holds every Creature to its printed stat block, except justified exceptions', () => {
    expect(
      [...mismatches]
        .filter(([key]) => !SRD_CREATURE_STAT_BLOCK_EXCEPTIONS.has(key))
        .map(([key, detail]) => `${key}: ${detail}`)
    ).toEqual([])
  })

  it('keeps only exceptions that still apply', () => {
    expect(
      [...SRD_CREATURE_STAT_BLOCK_EXCEPTIONS.keys()].filter((key) => !mismatches.has(key))
    ).toEqual([])
  })

  it('derives every printed Sense line from the structured Senses', () => {
    const differences = srdBaselineContent.subjects.creatures.flatMap((creature) => {
      // The book abbreviates feet "ft."; the unit registry's abbreviation is "ft". Qualifier text is
      // kept as the book words it, so both sides are compared in the registry's form.
      const unabbreviated = (line: string) => line.replaceAll(' ft.', ' ft')
      const printed = (SRD_CREATURE_STAT_BLOCKS.get(creature.id)?.senses ?? []).map(unabbreviated)
      const derived = printCreatureSenses(creature.senses, senseLabel).map(unabbreviated)
      return derived.join('; ') === printed.join('; ')
        ? []
        : [`${creature.label}: printed ${printed.join('; ')}, derived ${derived.join('; ')}`]
    })
    expect(differences).toEqual([])
  })

  it('prints a stat block for every SRD Creature', () => {
    expect(SRD_CREATURE_STAT_BLOCKS.size).toBe(srdBaselineContent.subjects.creatures.length)
  })
})

describe('SRD Creature Multiattacks (D93)', () => {
  const multiattacks = srdBaselineContent.subjects.creatures.flatMap((creature) => {
    const block = SRD_CREATURE_STAT_BLOCKS.get(creature.id)
    return (block?.actions ?? []).filter(isPrintedMultiattack).map((name) => ({
      creature,
      name,
      source: creature.features.find(({ label }) => label === name)
    }))
  })

  it('refuses a Multiattack that authors no attack slots, whatever else it carries', () => {
    const description = { label: 'Multiattack' }
    expect(printedActionHasMechanics('Multiattack', description)).toBe(false)
    expect(printedActionHasMechanics('Multiattack', { ...description, effects: [{}] })).toBe(false)
    expect(printedActionHasMechanics('Multiattack', { ...description, attackSlots: {} })).toBe(true)
    // Any other printed action is satisfied by an Effect.
    expect(printedActionHasMechanics('Bite', { label: 'Bite', effects: [{}] })).toBe(true)
    expect(printedActionHasMechanics('Bite', { label: 'Bite' })).toBe(false)
  })

  it('authors attack slots for every printed Multiattack, with no description-only excuse', () => {
    expect(multiattacks.length).toBeGreaterThan(0)
    expect(
      multiattacks
        .filter(({ source }) => source?.attackSlots === undefined)
        .map(({ creature, name }) => `${creature.label}|${name}`)
    ).toEqual([])
    expect(
      [...SRD_CREATURE_DESCRIPTION_ONLY_ACTIONS.keys()].filter((key) =>
        /actions Multiattack/.test(key)
      )
    ).toEqual([])
  })

  it('fills every slot with another of the Creature’s action Features', () => {
    const dangling = multiattacks.flatMap(({ creature, name, source }) =>
      (source?.attackSlots?.alternatives ?? [])
        .flatMap(({ slots }) => slots.flatMap(({ fillers }) => fillers))
        .flatMap((filler) => {
          if (filler.kind !== 'FEATURE') return []
          const filled = creature.features.find(({ id }) => id === filler.featureId)
          const isAction = (filled?.effects ?? []).some(
            (effect) => effect.invocation.kind !== 'PASSIVE'
          )
          return filled && filled.id !== source?.id && isAction
            ? []
            : [`${creature.label}|${name} -> ${filler.featureId}`]
        })
    )
    expect(dangling).toEqual([])
  })
})
