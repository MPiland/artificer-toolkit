/**
 * Authoring tool (D54): writes each SRD Creature attack's printed hit damage into
 * src/srd/creatures/attack-damage.ts, so the SRD attack sweep can hold every attack's resolved
 * damage to its stat block. Rerun it after adding attack-triggered Creature actions and review the
 * diff; the output is authored reference data, and runtime code never parses prose.
 *
 * yarn workspace @artificer-toolkit/source-data generate:creature-attack-damage
 */
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ATTACK_TRIGGER_CODES } from '@artificer-toolkit/schema/effects/effect'
import type { FeatureBaseAuthored } from '@artificer-toolkit/shared'
import { srdCreatureRecords } from '../src/srd/creatures/index.js'
import { SRD_DAMAGE_TYPES } from '../src/srd/vocabulary.js'

/** One printed damage part: `2d4+2` or a flat `1`, and its damage type code. */
type PrintedPart = readonly [expression: string, damageType: string]

/** A printed damage part; of a type choice ("lightning or thunder damage") the first type counts. */
const PART =
  /(\d+)(?:\s*\((\d+)\s*d\s*(\d+)(?:\s*([+\-−–])\s*(\d+))?\))?\s+([a-z]+)(?:\s+or\s+[a-z]+)?\s+damage/y
const PLUS = /\s*,?\s*plus\s+/y
/** "…, or 6 (1d8 + 2) …" and a listed "…, 4 (1d8) … if wielded with two hands, or …". */
const ALTERNATIVE = /,?\s+or\s+(?=\d)|,\s+(?=\d+\s+\(\d)/g

const damageTypeCodes = new Set(SRD_DAMAGE_TYPES.map((damageType) => damageType.code))

/** Reads `N (XdY + Z) type damage[ plus …]` from the start of `text`; save damage never follows "plus". */
function leadingParts(text: string): PrintedPart[] {
  const parts: PrintedPart[] = []
  let index = 0
  for (;;) {
    PART.lastIndex = index
    const match = PART.exec(text)
    if (!match) break
    const [, flat, count, die, sign, modifier, type] = match
    const damageType = type!.toUpperCase()
    if (!damageTypeCodes.has(damageType)) break
    const signedModifier = modifier ? (sign === '+' ? 1 : -1) * Number(modifier) : 0
    const expression = count
      ? `${count}d${die}${signedModifier === 0 ? '' : `${signedModifier > 0 ? '+' : ''}${signedModifier}`}`
      : flat!
    parts.push([expression, damageType])
    PLUS.lastIndex = PART.lastIndex
    if (!PLUS.exec(text)) break
    index = PLUS.lastIndex
  }
  return parts
}

/**
 * Each printed alternative of the hit damage: the lead, then every "or …" variant. Damage added
 * after a variant's condition ("…if used with two hands, plus 3 (1d6) fire damage") applies to all.
 */
function printedAlternatives(description: string): PrintedPart[][] {
  const hit = description.match(/Hit:\s*([\s\S]*?)(?:\.(?:\s|$)|$)/)
  if (!hit) return []
  const text = hit[1]!
  const sharedText = text.match(/\b(?:if|while|with)\b[^,]*,\s+plus\s+(\d[\s\S]*)$/)
  const shared = sharedText ? leadingParts(sharedText[1]!) : []
  const starts = [
    0,
    ...[...text.matchAll(ALTERNATIVE)].map((match) => match.index + match[0].length)
  ]
  return starts
    .map((start) => leadingParts(text.slice(start)))
    .filter((parts) => parts.length > 0)
    .map((parts) => [...parts, ...shared])
}

const diceOf = (expression: string) => expression.replace(/[+-]\d+$/, '')

type AuthoredEffect = NonNullable<FeatureBaseAuthored['effects']>[number]
type AuthoredResultBlock = NonNullable<AuthoredEffect['paths'][number]['resultBlock']>

const damageTypeCodeById = new Map(
  SRD_DAMAGE_TYPES.map((damageType) => [damageType.id, damageType.code])
)

/** The authored dice (no modifier) and type of each hit damage outcome in a result block. */
function authoredDice(block: AuthoredResultBlock | undefined): string[] {
  return (block?.outcomes ?? []).flatMap((outcome) =>
    outcome.effectKind !== 'DAMAGE'
      ? []
      : [
          `${'diceConfig' in outcome ? diceOf(outcome.diceConfig) : 'amount' in outcome ? outcome.amount : '?'} ${damageTypeCodeById.get(outcome.damageTypeId)}`
        ]
  )
}

/** The authored dice and type of every hit damage outcome. */
function hitDamageDice(effect: AuthoredEffect): string[] {
  return effect.paths
    .filter((path) => path.pathCode === 'ON_HIT')
    .flatMap((path) => authoredDice(path.resultBlock))
}

/** The authored expression and type of every hit damage outcome, as the stat block prints it. */
function hitDamageExpressions(effect: AuthoredEffect): string[] {
  return effect.paths
    .filter((path) => path.pathCode === 'ON_HIT')
    .flatMap((path) =>
      (path.resultBlock?.outcomes ?? []).flatMap((outcome) =>
        outcome.effectKind !== 'DAMAGE'
          ? []
          : [
              `${'diceConfig' in outcome ? outcome.diceConfig : 'amount' in outcome ? outcome.amount : '?'} ${damageTypeCodeById.get(outcome.damageTypeId)}`
            ]
      )
    )
}

const signature = (parts: readonly string[]) => [...parts].sort().join(', ')
const printedSignature = (parts: readonly PrintedPart[]) =>
  signature(parts.map(([expression, type]) => `${diceOf(expression)} ${type}`))

/**
 * The printed parts an Effect's hit outcomes resolve to. Each Effect authors one alternative
 * (a versatile weapon authors one Effect per grip), selected by its authored dice when the stat
 * block prints several.
 */
function selectPrinted(
  effect: AuthoredEffect,
  alternatives: readonly PrintedPart[][],
  label: string
): PrintedPart[] {
  if (alternatives.length === 1) return alternatives[0]!
  const authored = signature(hitDamageDice(effect))
  const byDice = alternatives.filter((parts) => printedSignature(parts) === authored)
  // Dice alone can tie ("4 (1d8) … or 6 (1d8 + 2) … with shillelagh"); the authored expression
  // then selects the alternative.
  const expressions = signature(hitDamageExpressions(effect))
  const matching =
    byDice.length > 1
      ? byDice.filter(
          (parts) =>
            signature(parts.map(([expression, type]) => `${expression} ${type}`)) === expressions
        )
      : byDice
  if (matching.length !== 1)
    throw new Error(
      `${label} prints ${alternatives.length} damage alternatives and its authored dice (${authored}) select ${matching.length}.`
    )
  return matching[0]!
}

const entries: { entry: string; comment: string }[] = []
const review: string[] = []
for (const creature of srdCreatureRecords) {
  const sources = creature.features.flatMap((feature) => [
    { source: feature, owner: null, path: feature.label },
    ...(feature.options ?? []).map((option) => ({
      source: option,
      owner: feature,
      path: `${feature.label} > ${option.label}`
    }))
  ])
  for (const { source, owner, path } of sources) {
    for (const effect of source.effects ?? []) {
      if (
        effect.invocation.kind !== 'ACTION' ||
        !ATTACK_TRIGGER_CODES.has(effect.invocation.triggerCode ?? '')
      )
        continue
      const label = `${creature.label}: ${path}`
      // An option that prints no damage of its own reads its Feature's.
      let alternatives = printedAlternatives(source.description ?? '')
      if (alternatives.length === 0 && owner)
        alternatives = printedAlternatives(owner.description ?? '')
      if (alternatives.length === 0) {
        review.push(`${label} prints no hit damage`)
        entries.push({ entry: `['${effect.id}', []]`, comment: `${label} (prints no hit damage)` })
        continue
      }
      // A closed-rule companion (the Mimic Pseudopod's adhesion) leaves the hit damage to its sibling Effect.
      const siblingDealsDamage = (source.effects ?? []).some(
        (sibling) => sibling !== effect && hitDamageDice(sibling).length > 0
      )
      if (hitDamageDice(effect).length === 0 && siblingDealsDamage) {
        review.push(`${label} Effect ${effect.order} leaves hit damage to a sibling Effect`)
        entries.push({
          entry: `['${effect.id}', []]`,
          comment: `${label} (a sibling Effect deals the hit damage)`
        })
        continue
      }
      const printed = selectPrinted(effect, alternatives, label)
      if (alternatives.length > 1)
        review.push(
          `${label} prints ${alternatives.length} alternatives; lists ${printed.length} parts`
        )
      entries.push({
        entry: `['${effect.id}', [${printed.map(([expression, type]) => `['${expression}', '${type}']`).join(', ')}]]`,
        comment: label
      })
    }
  }
}

await writeFile(
  resolve(import.meta.dirname, '../src/srd/creatures/attack-damage.ts'),
  [
    '// Generated by packages/source-data/scripts/generateCreatureAttackDamage.ts; review changes.',
    '/**',
    ' * The printed SRD hit damage of every attack-triggered Creature Effect, keyed by Effect ID: one',
    ' * `[expression, damage type code]` per damage part, `XdY±Z` or a flat amount. A versatile or',
    ' * alternate-form attack lists the printed variant its Effect authors.',
    ' */',
    'export const SRD_CREATURE_ATTACK_DAMAGE: ReadonlyMap<',
    '  string,',
    '  readonly (readonly [expression: string, damageType: string])[]',
    '> = new Map([',
    ...entries.map(
      ({ entry, comment }, index) =>
        `  ${entry}${index < entries.length - 1 ? ',' : ''} // ${comment}`
    ),
    '])',
    ''
  ].join('\n')
)
console.log(`${entries.length} attack damage entries; review:\n${review.join('\n')}`)
