import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

import { combatPerceptionIlluminationDtoSchema } from '@artificer-toolkit/schema/shared/combatPerception'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

/**
 * RULES-2.T9o (ADR 0038): a System's vocabulary is authored data. No production file outside
 * `source-data` holds a list of vocabulary codes or compares a code from the System record to a
 * literal; code reads a definition's ID, a property on its entry, or a `defaults` entry instead.
 */

const REPO = join(__dirname, '..', '..', '..', '..')
const SCANNED_ROOTS = ['apps', 'packages']
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '_generated',
  '__tests__',
  'testing',
  'test',
  'tests',
  'stories',
  'source-data',
  'e2e',
  '.storybook'
])
const NON_PRODUCTION_FILE =
  /(\.d\.ts|\.test\.tsx?|\.testUtils\.tsx?|\.stories\.tsx?|\.fixtures?\.tsx?|\.fixture\.tsx?)$/

function productionFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory())
      return SKIPPED_DIRECTORIES.has(name) ? [] : productionFiles(path)
    return /\.tsx?$/.test(name) && !NON_PRODUCTION_FILE.test(name) ? [path] : []
  })
}

const vocabularyDomains: Record<string, readonly { code: string }[]> = Object.fromEntries(
  Object.entries(srdSystemRecord).filter(
    (entry): entry is [string, { code: string }[]] =>
      Array.isArray(entry[1]) &&
      entry[1].length > 0 &&
      entry[1].every((item) => typeof (item as { code?: unknown }).code === 'string')
  )
)
const vocabularyCodes = new Set(
  Object.values(vocabularyDomains).flatMap((entries) => entries.map(({ code }) => code))
)

/**
 * Ability code lists (the `AbilityCode` enum, the class and creature pages) move with RULES-2.T9f, which
 * owns the ability literals across about 70 files. Ability code comparisons are guarded already.
 */
const DEFERRED_LIST_DOMAIN = 'abilities'

const codeBeforeLiteral = /[Cc]ode\s*[!=]==?\s*(['"`])([A-Z][A-Z0-9_]*)\1/g
const literalBeforeCode = /(['"`])([A-Z][A-Z0-9_]*)\1\s*[!=]==?\s*[\w.?]*[Cc]ode\b/g
const quotedList = /\[\s*(?:(['"])[A-Z][A-Z0-9_]*\1\s*,\s*){2,}(['"])[A-Z][A-Z0-9_]*\2\s*,?\s*\]/g
const codeTemplate = /`[A-Z]+_\$\{/g

/**
 * RULES-2.T9d: the illumination codes stay a shared enum, but their rank, light suppression, render
 * class and label belong to the System's `illuminationLevels`. Only a System module under
 * `rules-runtime/src/systems/` reads an illumination code directly.
 */
const illuminationCodes = new Set<string>(combatPerceptionIlluminationDtoSchema.options)
const illuminationBeforeLiteral = /[iI]llumination\s*[!=]==?\s*(['"`])([A-Z][A-Z_]*)\1/g
const literalBeforeIllumination = /(['"`])([A-Z][A-Z_]*)\1\s*[!=]==?\s*[\w.?]*[iI]llumination\b/g
const SYSTEM_MODULE = /packages[\\/]rules-runtime[\\/]src[\\/]systems[\\/]/

/**
 * RULES-2.T9e: which ability a derived statistic adds, and which speed is a creature's walk, are
 * System data (`derivedStatisticAbilityCodes`, `defaults`). Outside a System module, no value is
 * compared to an ability or speed code, whatever the compared variable is named.
 */
const statisticCodes = new Set(
  [...srdSystemRecord.abilities, ...srdSystemRecord.speeds].map(({ code }) => code)
)
const comparedBeforeLiteral = /[!=]==?\s*(['"`])([A-Z][A-Z0-9_]*)\1/g
const literalBeforeCompared = /(['"`])([A-Z][A-Z0-9_]*)\1\s*[!=]==?/g

function violations(source: string, path = ''): string[] {
  const found: string[] = []
  if (!SYSTEM_MODULE.test(path))
    for (const match of [
      ...source.matchAll(illuminationBeforeLiteral),
      ...source.matchAll(literalBeforeIllumination)
    ])
      if (illuminationCodes.has(match[2]!)) found.push(`compares illumination ${match[2]}`)
  for (const match of [
    ...source.matchAll(codeBeforeLiteral),
    ...source.matchAll(literalBeforeCode)
  ])
    if (vocabularyCodes.has(match[2]!)) found.push(`compares code ${match[2]}`)
  if (!SYSTEM_MODULE.test(path))
    for (const match of [
      ...source.matchAll(comparedBeforeLiteral),
      ...source.matchAll(literalBeforeCompared)
    ])
      if (statisticCodes.has(match[2]!) && !found.includes(`compares code ${match[2]}`))
        found.push(`compares ${match[2]}`)
  for (const [list] of source.matchAll(quotedList)) {
    const members = [...list.matchAll(/['"]([A-Z][A-Z0-9_]*)['"]/g)].map((member) => member[1]!)
    const domain = Object.entries(vocabularyDomains).some(([key, entries]) => {
      if (key === DEFERRED_LIST_DOMAIN) return false
      const codes = new Set(entries.map(({ code }) => code))
      return members.every((member) => codes.has(member))
    })
    if (domain) found.push(`holds the vocabulary list ${members.join(', ')}`)
  }
  for (const [template] of source.matchAll(codeTemplate))
    if ([...vocabularyCodes].some((code) => code.startsWith(template.slice(1, -2))))
      found.push(`builds a code from ${template}`)
  return found
}

describe('System vocabulary boundary (RULES-2.T9o)', () => {
  it('detects a code comparison, a code list and a built code', () => {
    expect(violations("speed.code === 'WALK'")).toEqual(['compares code WALK'])
    expect(violations("['FIRE', 'COLD', 'ACID']")).toHaveLength(1)
    expect(violations('`CR_${level}`')).toHaveLength(1)
    expect(violations("kind === 'SPELL_CAST'")).toEqual([])
  })

  it('detects an illumination code comparison outside a System module (RULES-2.T9d)', () => {
    const comparison = "if (zone.mechanicalIllumination === 'MAGICAL_DARKNESS') outline()"
    expect(violations(comparison)).toEqual(['compares illumination MAGICAL_DARKNESS'])
    expect(violations("'DIM' !== scene.ambientIllumination")).toEqual(['compares illumination DIM'])
    expect(violations(comparison, 'packages/rules-runtime/src/systems/dnd5e/lighting.ts')).toEqual(
      []
    )
    expect(violations("renderClass === 'DIM'")).toEqual([])
  })

  it('detects an ability or speed comparison outside a System module (RULES-2.T9e)', () => {
    const comparison = "(resolveAbilityAlias(abilityId) ?? abilityId) === 'DEXTERITY'"
    expect(violations(comparison)).toEqual(['compares DEXTERITY'])
    expect(violations("'CONSTITUTION' !== ability.ability")).toEqual(['compares CONSTITUTION'])
    expect(
      violations(comparison, 'packages/rules-runtime/src/systems/dnd5e/armorClass.ts')
    ).toEqual([])
    expect(violations("kind === 'ARMOR'")).toEqual([])
  })

  it('keeps production files free of vocabulary lists and code comparisons', () => {
    const offenders = SCANNED_ROOTS.flatMap((root) => productionFiles(join(REPO, root)))
      .flatMap((path) =>
        violations(readFileSync(path, 'utf8'), path).map(
          (reason) => `${relative(REPO, path).split(sep).join('/')} ${reason}`
        )
      )
      .sort()
    expect(offenders).toEqual([])
  }, 30_000)
})
