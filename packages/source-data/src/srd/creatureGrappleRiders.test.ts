import { readFileSync } from 'node:fs'
import { ATTACK_TRIGGER_CODES } from '@artificer-toolkit/schema/effects/effect'
import { describe, expect, it } from 'vitest'
import { SRD_CREATURE_ATTACK_DAMAGE } from './creatures/attack-damage.js'
import { srdBaselineContent } from './index.js'
import { SRD_CONDITION_TYPES } from './vocabulary.js'

/** Attacks whose rider holds more than one creature at once (D105); every other rider holds one. */
const HELD_AT_ONCE = new Map([
  ['Chuul: Pincer', 2],
  ['Glabrezu: Pincer', 2],
  ['Giant Crab: Claw', 2],
  ['Giant Scorpion: Claw', 2],
  ['Otyugh: Tentacle', 2],
  ['Kraken: Tentacle', 10],
  ['Roper: Tendril', 6]
])

const conditionCodeById = new Map(SRD_CONDITION_TYPES.map((entry) => [entry.id, entry.code]))
const GRAPPLED_PRINT = /grappled \(escape DC/
/** A grapple's escape DC; the cloaker prints its attached creature's DC as a Strength check. */
const ESCAPE_DC = /(?:escape|succeeding on a) DC (\d+)/
const SIZE_LIMIT = /\b(Tiny|Small|Medium|Large|Huge|Gargantuan)(?: creature)? or smaller\b/
const UNTIL_GRAPPLE_ENDS = /until (?:this|the) grapple ends/i

const STAT_BLOCK_TYPE_LINE = /^(?:Tiny|Small|Medium|Large|Huge|Gargantuan) .+, .+$/

/**
 * The SRD's printed paragraphs, each with the stat block heading above it (the text interleaves a
 * few neighbouring stat blocks, so the heading narrows a paragraph's creature but never proves it).
 * A wrapped line, even across a page's blank line, continues the paragraph before it; a line that
 * starts with a capital begins the next.
 */
const printedLines = readFileSync(new URL('./SRD_CC_v5.1.txt', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
const printedParagraphs = printedLines.reduce<{ text: string; heading: string }[]>(
  (paragraphs, line, index) => {
    const last = paragraphs[paragraphs.length - 1]
    if (STAT_BLOCK_TYPE_LINE.test(printedLines[index + 1] ?? '')) {
      paragraphs.push({ text: line, heading: line })
    } else if (last && /^[a-z]/.test(line)) {
      last.text += ` ${line}`
    } else {
      paragraphs.push({ text: line, heading: last?.heading ?? '' })
    }
    return paragraphs
  },
  []
)

/** An attack's label, attack bonus, reach and first hit damage ("2d6+3 PIERCING", or empty when none). */
const attackKey = (label: string, bonus: number, reach: number, damage: string) =>
  `${label}|${bonus}|${reach}|${damage}`

/** The first printed hit damage in `SRD_CREATURE_ATTACK_DAMAGE`'s notation. */
function printedDamage(paragraph: string) {
  const damage = /Hit: (\d+)(?: \((\d+)d(\d+)(?: ([+\-−–]) (\d+))?\))? ([a-z]+) damage/.exec(
    paragraph
  )
  if (!damage) return ''
  const [, flat, count, die, sign, modifier, type] = damage
  const expression = count
    ? `${count}d${die}${modifier ? `${sign === '+' ? '+' : '-'}${modifier}` : ''}`
    : flat
  return `${expression} ${type!.toUpperCase()}`
}

/** Each printed weapon attack paragraph by its label, attack bonus, reach and first hit damage. */
const printedAttacks = new Map<string, typeof printedParagraphs>()
for (const paragraph of printedParagraphs) {
  const header = /^(.+?)\. (?:Melee|Ranged) Weapon Attack: ([+-]\d+) to hit, reach (\d+) ft\./.exec(
    paragraph.text
  )
  if (!header) continue
  const key = attackKey(
    header[1]!,
    Number(header[2]),
    Number(header[3]),
    printedDamage(paragraph.text)
  )
  printedAttacks.set(key, [...(printedAttacks.get(key) ?? []), paragraph])
}

type Visit = (node: Record<string, unknown>) => void

/** Visits every object under `value`, without entering the subtree of one `visit` returns true for. */
function walk(value: unknown, visit: (node: Record<string, unknown>) => boolean | void) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visit))
  } else if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    if (visit(node) !== true) Object.values(node).forEach((child) => walk(child, visit))
  }
}

const collect = (
  value: unknown,
  visit: (node: Record<string, unknown>, add: Visit) => boolean | void
) => {
  const found: Record<string, unknown>[] = []
  walk(value, (node) => visit(node, (match) => found.push(match)))
  return found
}

const relationshipsIn = (value: unknown) =>
  collect(value, (node, add) => {
    if (node.effectKind !== 'ACTOR_RELATIONSHIP') return
    add(node)
    return true
  })

type Relationship = {
  heldAtOnce: number
  modules: { kind: string; dc?: { kind: string; value?: number }; sizeCode?: string }[]
  conditions?: { conditionId: string }[]
}

/** Every authored attack with a printed attack bonus and reach, and the printed paragraphs sharing its key. */
const keyedAttacks = srdBaselineContent.subjects.creatures.flatMap((creature) =>
  creature.features
    .flatMap((feature) => [feature, ...(feature.options ?? [])])
    .flatMap((source) => {
      const effect = (source.effects ?? []).find(
        (candidate) =>
          candidate.invocation.kind === 'ACTION' &&
          ATTACK_TRIGGER_CODES.has(candidate.invocation.triggerCode ?? '')
      )
      const bonus = (source.rollDefinitions ?? []).find(
        (definition) => definition.kind === 'ATTACK'
      )?.expression.modifier
      if (
        !effect ||
        effect.invocation.kind !== 'ACTION' ||
        effect.invocation.range.rangeKind !== 'DISTANCE' ||
        bonus === undefined
      )
        return []
      const name = `${creature.label}: ${source.label}`
      const [firstDamage] = SRD_CREATURE_ATTACK_DAMAGE.get(effect.id) ?? []
      const damage = firstDamage ? `${firstDamage[0]} ${firstDamage[1]}` : ''
      const candidates =
        printedAttacks.get(
          attackKey(source.label, bonus, effect.invocation.range.amount, damage)
        ) ?? []
      return [
        {
          name,
          candidates,
          underHeading: candidates.filter((paragraph) => paragraph.heading === creature.label),
          relationships: relationshipsIn(effect) as unknown as Relationship[]
        }
      ]
    })
)

/**
 * Attacks that share a key (a Mastiff's and a Giant Frog's bite) take the paragraph under their
 * own Creature's heading; one whose heading the text lost takes the paragraphs no other attack owns.
 */
const ownedParagraphs = new Set(keyedAttacks.flatMap(({ underHeading }) => underHeading))
const authoredAttacks = keyedAttacks.map(({ name, candidates, underHeading, relationships }) => {
  const unowned = candidates.filter((paragraph) => !ownedParagraphs.has(paragraph))
  return {
    name,
    printed: underHeading.length > 0 ? underHeading : unowned.length > 0 ? unowned : candidates,
    relationships
  }
})

/** What the SRD prints about one grapple-like rider, read from its paragraph. */
function printedRider(paragraph: string) {
  const dc = ESCAPE_DC.exec(paragraph)
  if (!dc) return undefined
  const dcEnd = dc.index + dc[0].length
  const sentenceEnd = paragraph.indexOf('. ', dcEnd)
  const sizeLimit = SIZE_LIMIT.exec(
    paragraph.slice(0, sentenceEnd < 0 ? paragraph.length : sentenceEnd)
  )?.[1]
  const untilEnds = paragraph
    .slice(dcEnd)
    .split(/(?<=\.)\s+/)
    .filter((sentence) => UNTIL_GRAPPLE_ENDS.test(sentence))
    .flatMap((sentence) =>
      SRD_CONDITION_TYPES.filter(
        (entry) =>
          entry.code !== 'GRAPPLED' && new RegExp(`\\b${entry.label}\\b`, 'i').test(sentence)
      ).map((entry) => entry.code)
    )
  return {
    dc: Number(dc[1]),
    sizeLimit: sizeLimit?.toUpperCase(),
    conditions: [...(GRAPPLED_PRINT.test(paragraph) ? ['GRAPPLED'] : []), ...untilEnds].sort()
  }
}

function authoredRider(relationship: Relationship) {
  const escape = relationship.modules.find((module) => module.kind === 'ESCAPE_CHECK')
  const size = relationship.modules.find((module) => module.kind === 'TARGET_SIZE_MAXIMUM')
  return {
    dc: escape?.dc?.kind === 'FIXED' ? escape.dc.value : undefined,
    sizeLimit: size?.sizeCode,
    conditions: (relationship.conditions ?? [])
      .map((condition) => conditionCodeById.get(condition.conditionId) ?? condition.conditionId)
      .sort()
  }
}

describe('SRD Creature grapple riders (D105)', () => {
  it('authors the printed escape DC, size limit and conditions of every Actor Relationship', () => {
    const riders = authoredAttacks.flatMap(({ name, printed, relationships }) =>
      relationships.map((relationship) => ({
        name,
        printed:
          printed.length === 1 ? printedRider(printed[0]!.text) : `${printed.length} paragraphs`,
        authored: authoredRider(relationship)
      }))
    )

    expect(riders).toHaveLength(34)
    // The SRD prints the Darkmantle's detach DC in a paragraph of its own, so its Crush paragraph
    // reads no rider; it attaches to a creature of any size, with a DC 13 Strength check to detach.
    // The Shambling Mound prints its grapple in its Multiattack ("if both attacks hit a Medium or smaller
    // target"), so its Slam paragraph reads no rider; the Slam authors the hold behind that gate (D93).
    // The Vampire Spawn's Claws and the Vampire's Unarmed Strike print "can grapple the target"
    // without the word "grappled", so their printed rider names no condition; they author GRAPPLED.
    // The Stirge attaches with no escape check (a creature detaches it with an action), so its Blood
    // Drain reads no rider and authors no escape DC (SPELLS-33.T6a3).
    // The Remorhaz and Tarrasque swallows print their hold in a paragraph of its own, so their Swallow
    // reads no rider; they author the grapple's escape DC with Blinded and Restrained (SPELLS-33.T6n3).
    expect(
      riders.filter(({ printed, authored }) => JSON.stringify(printed) !== JSON.stringify(authored))
    ).toEqual([
      {
        name: 'Darkmantle: Crush',
        printed: undefined,
        authored: { dc: 13, conditions: [] }
      },
      {
        name: 'Remorhaz: Swallow',
        printed: '0 paragraphs',
        authored: { dc: 17, conditions: ['BLINDED', 'RESTRAINED'], sizeLimit: 'MEDIUM' }
      },
      {
        name: 'Shambling Mound: Slam',
        printed: undefined,
        authored: { dc: 14, conditions: ['GRAPPLED'], sizeLimit: 'MEDIUM' }
      },
      {
        name: 'Stirge: Blood Drain',
        printed: undefined,
        authored: { dc: undefined, conditions: [], sizeLimit: undefined }
      },
      {
        name: 'Tarrasque: Swallow',
        printed: '0 paragraphs',
        authored: { dc: 20, conditions: ['BLINDED', 'RESTRAINED'], sizeLimit: 'LARGE' }
      },
      {
        name: 'Vampire: Unarmed Strike (Vampire Form Only)',
        printed: { dc: 18, conditions: [], sizeLimit: undefined },
        authored: { dc: 18, conditions: ['GRAPPLED'], sizeLimit: undefined }
      },
      {
        name: 'Vampire Spawn: Claws',
        printed: { dc: 13, conditions: [], sizeLimit: undefined },
        authored: { dc: 13, conditions: ['GRAPPLED'], sizeLimit: undefined }
      }
    ])
  })

  it('lets every grappler drag the creature it grapples (D105 amendment)', () => {
    const grapples = authoredAttacks.flatMap(({ name, relationships }) =>
      relationships
        .filter(({ conditions }) =>
          (conditions ?? []).some(
            ({ conditionId }) => conditionCodeById.get(conditionId) === 'GRAPPLED'
          )
        )
        .map((relationship) => ({ name, relationship }))
    )
    const undragged = grapples.flatMap(({ name, relationship }) =>
      relationship.modules.some(({ kind }) => kind === 'TARGET_DRAGGED') ? [] : [name]
    )

    // Every Actor Relationship above but the Cloaker's Bite, which attaches without grappling.
    expect(grapples).toHaveLength(29)
    expect(undragged).toEqual([])
  })

  it('authors an Actor Relationship for every attack that prints "grappled (escape DC"', () => {
    const unauthored = authoredAttacks.flatMap(({ name, printed, relationships }) =>
      printed.some((paragraph) => GRAPPLED_PRINT.test(paragraph.text)) && relationships.length === 0
        ? [name]
        : []
    )

    expect(unauthored).toEqual([])
  })

  it('authors an attack for every printed weapon attack that prints "grappled (escape DC"', () => {
    const authoredParagraphs = new Set(authoredAttacks.flatMap(({ printed }) => printed))
    const printedGrapples = [...printedAttacks.values()]
      .flat()
      .filter((paragraph) => GRAPPLED_PRINT.test(paragraph.text))

    expect(
      printedGrapples
        .filter((paragraph) => !authoredParagraphs.has(paragraph))
        .map((paragraph) => `${paragraph.heading}: ${paragraph.text.slice(0, 40)}`)
    ).toEqual([])
  })

  it('holds the printed number of creatures at once, one unless listed', () => {
    const held = authoredAttacks.flatMap(({ name, relationships }) =>
      relationships.map((relationship) => ({
        name,
        heldAtOnce: relationship.heldAtOnce,
        expected: HELD_AT_ONCE.get(name) ?? 1
      }))
    )

    expect(held.filter(({ heldAtOnce, expected }) => heldAtOnce !== expected)).toEqual([])
    expect(
      [...HELD_AT_ONCE.keys()].filter(
        (key) =>
          !authoredAttacks.some(
            ({ name, relationships }) => name === key && relationships.length > 0
          )
      )
    ).toEqual([])
  })

  it('leaves no bare Grappled condition outside an Actor Relationship', () => {
    const grappledId = SRD_CONDITION_TYPES.find((entry) => entry.code === 'GRAPPLED')!.id
    const bare = srdBaselineContent.subjects.creatures.filter(
      (creature) =>
        collect(creature, (node, add) => {
          if (node.effectKind === 'ACTOR_RELATIONSHIP') return true
          if (node.effectKind === 'CONDITION' && node.conditionId === grappledId) add(node)
        }).length > 0
    )

    expect(bare.map((creature) => creature.label)).toEqual([])
  })
  it('authors the Shambling Mound with core options only: a gated Slam hold and a held-only Engulf (ATTACK-7.2)', () => {
    const mound = srdBaselineContent.subjects.creatures.find(
      (creature) => creature.label === 'Shambling Mound'
    )!
    const feature = (label: string) => mound.features.find((candidate) => candidate.label === label)
    const slam = relationshipsIn(feature('Slam'))
    const engulf = relationshipsIn(feature('Engulf'))

    expect(slam).toMatchObject([
      { appliesWhen: { kind: 'EARLIER_SLOTS_HIT_SAME_TARGET' }, heldAtOnce: 1 }
    ])
    expect(engulf).toHaveLength(1)
    expect(engulf[0]).toMatchObject({ heldAtOnce: 1 })
    expect(engulf[0]).not.toHaveProperty('appliesWhen')
    expect(
      collect(feature('Engulf'), (node, add) => {
        if (node.heldBySource === true) add(node)
      })
    ).toHaveLength(1)
  })
})
