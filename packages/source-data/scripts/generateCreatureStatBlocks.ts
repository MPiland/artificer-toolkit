/**
 * Authoring tool (D56): extracts every SRD Creature's printed stat-block facts from
 * src/srd/SRD_CC_v5.1.pdf into src/srd/creatures/stat-blocks.ts, so the source-data stat-block audit
 * can hold each authored Creature to its stat block. The output is authored reference data; review
 * its diff after rerunning, and runtime code never parses prose.
 *
 * It reads the PDF with Poppler's `pdftotext` (on PATH), one page column at a time: the committed
 * SRD_CC_v5.1.txt interleaves neighbouring stat blocks' columns and drops some lines.
 *
 * yarn workspace @artificer-toolkit/source-data generate:creature-stat-blocks
 */
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AbilityCode } from '@artificer-toolkit/shared'
import { srdCreatureRecords } from '../src/srd/creatures/index.js'
import {
  SRD_ALIGNMENTS,
  SRD_CHALLENGE_RATINGS,
  SRD_CONDITION_TYPES,
  SRD_CREATURE_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_LANGUAGES,
  SRD_SKILLS
} from '../src/srd/vocabulary.js'

/** SRD stat-block names whose Creature carries another label. */
const LABELS_BY_PRINTED_NAME: Readonly<Record<string, string>> = {
  'Animated Objects Animated Armor': 'Animated Armor',
  'Elf, Drow': 'Drow',
  'Gnome, Deep (Svirfneblin)': 'Deep Gnome (Svirfneblin)'
}

interface PrintedNames {
  traits: string[]
  actions: string[]
  reactions: string[]
  legendaryActions: string[]
}

type SpeedCode = 'WALK' | 'SWIM' | 'CLIMB' | 'FLY' | 'BURROW'
type Bypass = 'MAGICAL' | 'SILVERED' | 'ADAMANTINE'

interface PrintedDamageDefense {
  damageTypes: string[]
  bypassedBy?: Bypass[]
  qualifier?: string
}

interface StatBlock extends PrintedNames {
  name: string
  size: string
  creatureType: string
  swarmOf?: string
  tags: string[]
  alignment: string
  armorClass?: number
  armorClassNote?: string
  hitPoints?: number
  hitDice?: string
  speeds?: Partial<Record<SpeedCode, number>>
  hover?: true
  speedNote?: string
  abilityScores?: Record<AbilityCode, number>
  savingThrows?: Partial<Record<AbilityCode, number>>
  skills?: Record<string, number>
  damageVulnerabilities?: PrintedDamageDefense[]
  damageResistances?: PrintedDamageDefense[]
  damageImmunities?: PrintedDamageDefense[]
  conditionImmunities?: string[]
  senses?: string[]
  passivePerception?: number
  languages?: string
  languageCodes?: string[]
  telepathy?: number
  challengeRating?: string
  xp?: number
}

const ABILITIES: readonly AbilityCode[] = [
  'STRENGTH',
  'DEXTERITY',
  'CONSTITUTION',
  'INTELLIGENCE',
  'WISDOM',
  'CHARISMA'
]
const ABILITY_BY_ABBREVIATION = new Map(
  ABILITIES.map((ability) => [ability.slice(0, 3).toLowerCase(), ability])
)
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']
const SIZE_LINE = new RegExp(
  `^(?:(.*?)\\s+)??(${SIZES.join('|')}) ((?:swarm of (?:Tiny|Small) )?[a-z]+)(?: \\(([^)]*)\\))?, (.+)$`
)
const FIELD_NAMES = [
  'Armor Class',
  'Hit Points',
  'Speed',
  'Saving Throws',
  'Skills',
  'Damage Vulnerabilities',
  'Damage Resistances',
  'Damage Immunities',
  'Condition Immunities',
  'Senses',
  'Languages',
  'Challenge'
] as const
type FieldName = (typeof FIELD_NAMES)[number]
const REQUIRED_FIELDS = [
  'armorClass',
  'hitPoints',
  'speeds',
  'abilityScores',
  'passivePerception',
  'languages',
  'challengeRating'
] as const
/** A field keyword; the Archmage prints "Damage Resistance". */
const FIELD = new RegExp(`(?:^|\\s)(${FIELD_NAMES.join('|')}|Damage Resistance)\\s`, 'g')
const SCORE = /(\d+)\s*\(\s*[+-]?\d+\s*\)/g
const SECTION_HEADERS: Readonly<Record<string, keyof PrintedNames>> = {
  Actions: 'actions',
  Reactions: 'reactions',
  'Legendary Actions': 'legendaryActions'
}
const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with'
])

const damageTypeCodeByLabel = new Map(
  SRD_DAMAGE_TYPES.map((damageType) => [damageType.label.toLowerCase(), damageType.code])
)
const conditionCodeByLabel = new Map(
  SRD_CONDITION_TYPES.map((condition) => [condition.label.toLowerCase(), condition.code])
)
const creatureTypeCodeByLabel = new Map(
  SRD_CREATURE_TYPES.map((type) => [type.label.toLowerCase(), type.code])
)
const skillCodeByLabel = new Map(SRD_SKILLS.map((skill) => [skill.label.toLowerCase(), skill.code]))
const languageCodeByLabel = new Map(
  SRD_LANGUAGES.map((language) => [language.label.toLowerCase(), language.code])
)
const challengeRatingCodeByLabel = new Map(
  SRD_CHALLENGE_RATINGS.map((rating) => [
    rating.code.replace(/^CR_/, '').replace('_', '/'),
    rating.code
  ])
)

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Unrecognized ${what}.`)
  return value
}

/** Splits a comma list, also on a closing ", and"/" and" before the last entry. */
const listOf = (text: string) =>
  text
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

/** A printed damage type list, "nonmagical" first when the qualifier leads. */
const DAMAGE_TYPE_LIST = (() => {
  const type = [...damageTypeCodeByLabel.keys()].join('|')
  return new RegExp(`^(?:nonmagical )?(?:${type})(?:,? (?:and )?(?:${type}))*`)
})()
/** The "from nonmagical attacks" tail that a qualified damage defense's bypass codes represent. */
const BYPASS_TAIL =
  /^from nonmagical attacks(?: that aren't (?:silvered|adamantine)| not made with silvered weapons)?$/

/**
 * Each ";" segment of a printed damage defense list: its damage types, its bypass codes for
 * "from nonmagical attacks …", and any other qualifier ("from spells") verbatim.
 */
function damageDefenses(text: string): PrintedDamageDefense[] {
  return text.split(';').map((segment) => {
    const words = segment.trim()
    const damageTypes = [...words.matchAll(/[a-z]+/g)]
      .map((match) => damageTypeCodeByLabel.get(match[0]))
      .filter((code) => code !== undefined)
    const rest = words.slice(DAMAGE_TYPE_LIST.exec(words)?.[0].length ?? 0).trim()
    const bypassedBy: Bypass[] = /\bnonmagical\b/.test(words)
      ? [
          'MAGICAL',
          ...(/\bsilvered\b/.test(rest) ? (['SILVERED'] as const) : []),
          ...(/\badamantine\b/.test(rest) ? (['ADAMANTINE'] as const) : [])
        ]
      : []
    const qualifier = rest.replace(BYPASS_TAIL, '').trim()
    return {
      damageTypes,
      ...(bypassedBy.length > 0 ? { bypassedBy } : {}),
      ...(qualifier.length > 0 ? { qualifier } : {})
    }
  })
}

function applyField(block: StatBlock, field: FieldName, value: string) {
  const text = value.replace(/\s+/g, ' ').trim()
  switch (field) {
    case 'Armor Class': {
      const [, amount, note] = required(/^(\d+)\s*(.*)$/.exec(text) ?? undefined, `AC "${text}"`)
      block.armorClass = Number(amount)
      const bare = /^\(([^()]*)\)$/.exec(note!)
      if (note) block.armorClassNote = bare ? bare[1] : note
      return
    }
    case 'Hit Points': {
      const [, amount, count, die, sign, modifier] = required(
        /^(\d+) \((\d+)d(\d+)(?: ([+-]) (\d+))?\)$/.exec(text) ?? undefined,
        `HP "${text}"`
      )
      block.hitPoints = Number(amount)
      block.hitDice = `${count}d${die}${modifier ? `${sign}${modifier}` : ''}`
      return
    }
    case 'Speed': {
      const [, main, note] = required(/^(.*?)(?: \(([^)]*)\))?$/.exec(text) ?? undefined, 'speed')
      block.speeds = {}
      for (const part of main!.split(',')) {
        const [, kind, amount] = required(
          /^\s*(?:(swim|climb|fly|burrow) )?(\d+) ft\.$/.exec(part) ?? undefined,
          `speed "${text}"`
        )
        block.speeds[(kind?.toUpperCase() ?? 'WALK') as SpeedCode] = Number(amount)
      }
      if (note === 'hover') block.hover = true
      else if (note) block.speedNote = note
      return
    }
    case 'Saving Throws':
      block.savingThrows = Object.fromEntries(
        listOf(text).map((entry) => {
          const [, ability, bonus] = required(/^(\w+) \+(\d+)$/.exec(entry) ?? undefined, entry)
          return [
            required(ABILITY_BY_ABBREVIATION.get(ability!.toLowerCase()), ability!),
            Number(bonus)
          ]
        })
      )
      return
    case 'Skills':
      block.skills = Object.fromEntries(
        listOf(text).map((entry) => {
          const [, skill, bonus] = required(
            /^(.+?) \+(\d+)(?: \([^)]*\))?$/.exec(entry) ?? undefined,
            entry
          )
          return [
            required(skillCodeByLabel.get(skill!.toLowerCase()), `skill ${skill}`),
            Number(bonus)
          ]
        })
      )
      return
    case 'Damage Vulnerabilities':
      block.damageVulnerabilities = damageDefenses(text)
      return
    case 'Damage Resistances':
      block.damageResistances = damageDefenses(text)
      return
    case 'Damage Immunities':
      block.damageImmunities = damageDefenses(text)
      return
    case 'Condition Immunities':
      block.conditionImmunities = listOf(text).map((condition) =>
        required(conditionCodeByLabel.get(condition.toLowerCase()), `condition ${condition}`)
      )
      return
    case 'Senses': {
      const [, senses, passive] = required(
        /^(?:(.*?),?\s*)?passive Perception (\d+)$/.exec(text) ?? undefined,
        `senses "${text}"`
      )
      if (senses) block.senses = senses.split(/,\s*(?=[a-z]+ \d)/)
      block.passivePerception = Number(passive)
      return
    }
    case 'Languages': {
      block.languages = text
      const telepathy = /telepathy (\d+) ft\./.exec(text)
      if (telepathy) block.telepathy = Number(telepathy[1])
      // Longest labels first, consuming each match, so "Giant Eagle" is not also "Giant".
      let remaining = text
      const codes = [...languageCodeByLabel.entries()]
        .sort(([left], [right]) => right.length - left.length)
        .filter(([label]) => {
          const pattern = new RegExp(`\\b${label}\\b`, 'i')
          if (!pattern.test(remaining)) return false
          remaining = remaining.replace(pattern, '')
          return true
        })
        .map(([, code]) => code)
        .sort()
      if (codes.length > 0) block.languageCodes = codes
      return
    }
    case 'Challenge': {
      const [, rating, xp] = required(
        /^(\d+(?:\/\d+)?) \(([\d,]+) XP\)$/.exec(text) ?? undefined,
        `challenge "${text}"`
      )
      block.challengeRating = required(challengeRatingCodeByLabel.get(rating!), `CR ${rating}`)
      block.xp = Number(xp!.replace(/,/g, ''))
      return
    }
  }
}

/** Whether every word outside parentheses is capitalized, or a minor word such as "of". */
const titleCase = (text: string) =>
  text
    .replace(/\([^)]*\)/g, '')
    .trim()
    .split(/\s+/)
    .every((word) => /^[A-Z0-9'"-]/.test(word) || MINOR_WORDS.has(word))

/** A trait, action or legendary option name: title-case words before the line's first full stop. */
function entryName(line: string): string | undefined {
  const name = /^([A-Z][^.:]{0,70}?)\.(?:\s+\S|$)/.exec(line)?.[1]
  return name && titleCase(name) ? name : undefined
}

/** A spell list line ("1st level (4 slots): …"), which ends without a period. */
const SPELL_LIST_LINE = /^(?:At will|Cantrips|\d+\/day(?: each)?|\d+(?:st|nd|rd|th) level)\b[^:]*:/i
/** Options printed under a parent entry, such as a metallic dragon's breath weapons. */
const SUB_ENTRY =
  /^(?:(?:Acid|Cold|Fire|Lightning|Paralyzing|Repulsion|Sleep|Slowing|Weakening) Breath|(?:First|Second|Third) Roar)$/
/**
 * Reads the stat blocks in `lines`: a block opens at its "Size type, alignment" line (which may wrap)
 * followed by Armor Class, reads keyword fields (which may wrap and share lines) until Challenge,
 * then collects trait, action, reaction and legendary action names until the next block.
 */
function scan(lines: readonly string[]): StatBlock[] {
  const blocks: StatBlock[] = []
  let block: StatBlock | undefined
  let inHeader = false
  let section: keyof PrintedNames = 'traits'
  let pendingField: { field: FieldName; value: string } | undefined
  let scores: number[] | undefined
  let paragraphEnded = false
  let inSpellList = false

  const flushField = () => {
    if (!block || !pendingField) return
    const { field, value } = pendingField
    pendingField = undefined
    try {
      applyField(block, field, value)
    } catch (error) {
      throw new Error(`${block.name}: ${(error as Error).message}`)
    }
    if (field === 'Challenge') {
      inHeader = false
      paragraphEnded = true
    }
  }

  const content = lines.filter((line) => line.length > 0)
  for (let index = 0; index < content.length; index++) {
    const line = content[index]!
    const wrapped = content[index + 1]?.startsWith('Armor Class') ? undefined : content[index + 1]
    const header =
      SIZE_LINE.exec(line) && content[index + 1]?.startsWith('Armor Class')
        ? line
        : wrapped && content[index + 2]?.startsWith('Armor Class')
          ? `${line} ${wrapped}`
          : undefined
    const size = header ? SIZE_LINE.exec(header) : null
    if (size) {
      flushField()
      if (header !== line) index++
      const [, prefix, sizeLabel, typeLabel, subtypes, alignment] = size
      // "swarm of Tiny beasts": a swarm of the named size and creature type.
      const [, swarmOf, memberType] = /^swarm of (\w+) (\w+?)s?$/.exec(typeLabel!) ?? []
      block = {
        name: prefix ?? content[index - (header === line ? 1 : 2)]!,
        size: sizeLabel!.toUpperCase(),
        creatureType: required(
          creatureTypeCodeByLabel.get(memberType ?? typeLabel!),
          `creature type ${typeLabel}`
        ),
        ...(swarmOf ? { swarmOf: swarmOf.toUpperCase() } : {}),
        tags: subtypes ? listOf(subtypes) : [],
        alignment: alignment!.trim(),
        traits: [],
        actions: [],
        reactions: [],
        legendaryActions: []
      }
      blocks.push(block)
      inHeader = true
      section = 'traits'
      continue
    }
    if (!block) continue
    if (inHeader) {
      if (scores) {
        scores.push(...[...line.matchAll(SCORE)].map((match) => Number(match[1])))
        if (scores.length >= 6) {
          block.abilityScores = Object.fromEntries(
            ABILITIES.map((ability, abilityIndex) => [ability, scores![abilityIndex]!])
          ) as Record<AbilityCode, number>
          scores = undefined
        }
        continue
      }
      if (/^STR\b/.test(line)) {
        flushField()
        scores = []
        continue
      }
      // A header line starts fields, possibly several, or continues the previous field.
      const matches = [...line.matchAll(FIELD)]
      const head = line.slice(0, matches[0]?.index ?? line.length).trim()
      if (head.length > 0) {
        if (!pendingField) throw new Error(`${block.name}: stray header text "${line}".`)
        pendingField.value += ` ${head}`
      }
      for (const [matchIndex, match] of matches.entries()) {
        flushField()
        const start = match.index + match[0].length
        const end = matches[matchIndex + 1]?.index ?? line.length
        const field =
          match[1] === 'Damage Resistance' ? 'Damage Resistances' : (match[1] as FieldName)
        pendingField = { field, value: line.slice(start, end) }
      }
      if (pendingField?.field === 'Challenge' && /XP\)$/.test(pendingField.value)) flushField()
      continue
    }
    const sectionHeader = SECTION_HEADERS[line]
    const paragraphStart = paragraphEnded
    inSpellList = SPELL_LIST_LINE.test(line) || (inSpellList && !entryName(line))
    paragraphEnded = sectionHeader !== undefined || inSpellList || /[.:]$/.test(line)
    if (sectionHeader) {
      section = sectionHeader
      continue
    }
    // A usage parenthetical marks a name even where the text omits the previous full stop.
    if (!paragraphStart && !/^[^.]*\((?:Recharges?|\d+\/Day)\b[^)]*\)\./.test(line)) continue
    // A title line after a paragraph ends the block: a group, sidebar or appendix heading.
    if ((!line.includes('.') && titleCase(line)) || line.startsWith('Variant:')) {
      block = undefined
      continue
    }
    const name = entryName(line)
    if (name && !SUB_ENTRY.test(name)) block[section].push(name)
  }
  flushField()
  return blocks
}

const pdf = resolve(import.meta.dirname, '../src/srd/SRD_CC_v5.1.pdf')
/** One half of every Letter page (612 by 792 points), one string per page. */
const column = (x: number) =>
  execFileSync(
    'pdftotext',
    ['-layout', '-x', `${x}`, '-y', '0', '-W', '306', '-H', '792', pdf, '-'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    }
  ).split('\f')
const [left, right] = [column(0), column(306)]
const lines = left
  .flatMap((page, index) => [page, right[index] ?? ''])
  .join('\n')
  // Soft hyphens, hyphens, dashes and minus signs; curly apostrophes.
  .replace(/[\u00AD\u2010-\u2014\u2212-]+/g, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .split(/\r?\n/)
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter((line) => !/^System Reference Document 5\.1 \d+$/.test(line))
const blocks = scan(lines.slice(lines.indexOf('Monsters (A)')))

const creatureByLabel = new Map(srdCreatureRecords.map((creature) => [creature.label, creature]))
const alignmentCodeByLabel = new Map([
  ...SRD_ALIGNMENTS.map((alignment) => [alignment.label.toLowerCase(), alignment.code] as const),
  ['neutral', 'TRUE_NEUTRAL']
])
const unauthored: string[] = []
const entries = blocks.flatMap(
  ({ name, traits, actions, reactions, legendaryActions, ...facts }) => {
    const label = LABELS_BY_PRINTED_NAME[name] ?? name
    const creature = creatureByLabel.get(label)
    if (!creature) {
      unauthored.push(name)
      return []
    }
    creatureByLabel.delete(label)
    const missing = REQUIRED_FIELDS.filter((field) => facts[field] === undefined)
    if (missing.length > 0) throw new Error(`${name} prints no ${missing.join(', ')}.`)
    const alignmentCode = alignmentCodeByLabel.get(facts.alignment)
    const entry = {
      ...facts,
      ...(alignmentCode ? { alignmentCode } : {}),
      traits,
      actions,
      ...(reactions.length > 0 ? { reactions } : {}),
      ...(legendaryActions.length > 0 ? { legendaryActions } : {})
    }
    return [`  ['${creature.id}', ${JSON.stringify(entry)}], // ${creature.label}`]
  }
)
if (creatureByLabel.size > 0)
  throw new Error(`No printed stat block for ${[...creatureByLabel.keys()].join(', ')}.`)

await writeFile(
  resolve(import.meta.dirname, '../src/srd/creatures/stat-blocks.ts'),
  [
    '// Generated by packages/source-data/scripts/generateCreatureStatBlocks.ts; review changes.',
    "import type { AbilityCode } from '@artificer-toolkit/shared'",
    '',
    '/** One ";" segment of a printed damage defense list. */',
    'export interface SrdPrintedDamageDefense {',
    '  damageTypes: readonly string[]',
    '  /** What defeats a "from nonmagical attacks …" defense. */',
    "  bypassedBy?: readonly ('MAGICAL' | 'SILVERED' | 'ADAMANTINE')[]",
    '  /** Any other printed condition, verbatim ("damage from spells"). */',
    '  qualifier?: string',
    '}',
    '',
    '/**',
    ' * The printed facts of one SRD Creature stat block (SRD_CC_v5.1.pdf), with vocabulary codes where',
    ' * the System has them: header fields, and the names of its traits, actions, reactions and',
    ' * legendary actions in printed order.',
    ' */',
    'export interface SrdCreatureStatBlock {',
    '  size: string',
    '  creatureType: string',
    '  /** The size of each creature in a swarm ("swarm of Tiny beasts"). */',
    '  swarmOf?: string',
    '  tags: readonly string[]',
    '  alignment: string',
    '  alignmentCode?: string',
    '  armorClass: number',
    '  armorClassNote?: string',
    '  hitPoints: number',
    '  hitDice: string',
    "  speeds: Readonly<Partial<Record<'WALK' | 'SWIM' | 'CLIMB' | 'FLY' | 'BURROW', number>>>",
    '  hover?: true',
    '  /** Another form\'s speed ("40 ft. in boar form"). */',
    '  speedNote?: string',
    '  abilityScores: Readonly<Record<AbilityCode, number>>',
    '  savingThrows?: Readonly<Partial<Record<AbilityCode, number>>>',
    '  skills?: Readonly<Record<string, number>>',
    '  damageVulnerabilities?: readonly SrdPrintedDamageDefense[]',
    '  damageResistances?: readonly SrdPrintedDamageDefense[]',
    '  damageImmunities?: readonly SrdPrintedDamageDefense[]',
    '  conditionImmunities?: readonly string[]',
    '  senses?: readonly string[]',
    '  passivePerception: number',
    '  languages: string',
    '  languageCodes?: readonly string[]',
    '  telepathy?: number',
    '  challengeRating: string',
    '  xp: number',
    '  traits: readonly string[]',
    '  actions: readonly string[]',
    '  reactions?: readonly string[]',
    '  legendaryActions?: readonly string[]',
    '}',
    '',
    "/** Every authored SRD Creature's printed stat block, keyed by Creature ID. */",
    'export const SRD_CREATURE_STAT_BLOCKS: ReadonlyMap<string, SrdCreatureStatBlock> = new Map<',
    '  string,',
    '  SrdCreatureStatBlock',
    '>([',
    ...entries,
    '])',
    ''
  ].join('\n')
)
console.log(`${entries.length} stat blocks; not authored: ${unauthored.join(', ')}`)
