import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { oni } from '@artificer-toolkit/source-data/srd/creatures/oni.js'
import { shieldGuardian } from '@artificer-toolkit/source-data/srd/creatures/shield-guardian.js'
import { troll } from '@artificer-toolkit/source-data/srd/creatures/troll.js'
import { vampire } from '@artificer-toolkit/source-data/srd/creatures/vampire.js'
import { vampireSpawn } from '@artificer-toolkit/source-data/srd/creatures/vampire-spawn.js'
import * as S from '@artificer-toolkit/source-data/srd/creatures/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues, resolveNodeRuntime } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eVocabularyCapabilityAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/vocabulary'

/**
 * SPELLS-33 T4i1a: the Oni's and Shield Guardian's Regeneration author the generic start-of-turn
 * trigger, the at-least hit-point gate and a fixed heal that a Builder author has on a creature
 * feature, so each must pass the creature node map exactly as authored, as must a variant.
 */

const reader = createSrdNodeRuntimeReader(dnd5eVocabularyCapabilityAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

function regenerationBlocks(creature: CreatureAuthored) {
  const blocks = (creature.features ?? [])
    .filter((feature) => feature.label === 'Regeneration')
    .flatMap((feature) => feature.effects ?? [])
    .flatMap((effect) => effect.paths)
    .flatMap((path) => (path.selectionKind === 'FIXED' ? [path.resultBlock] : []))
  if (blocks.length !== 1) throw new Error('Regeneration must author one result block.')
  return blocks
}

describe.each([
  ['Oni', oni],
  ['Shield Guardian', shieldGuardian]
])('%s Regeneration through the creature node map (SPELLS-33 T4i1a)', (_label, creature) => {
  it('keeps the heal exactly as authored, with no closed rule for it', async () => {
    expect(JSON.stringify(creature)).not.toMatch(/ONI_REGENERATION|SHIELD_GUARDIAN_REGENERATION/)
    expect(regenerationBlocks(creature)).toMatchObject([
      {
        gate: { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 1 },
        outcomes: [{ effectKind: 'HEAL', valueKind: 'FIXED', amount: 10 }]
      }
    ])
    const result = await normalize(creature)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
  })

  it('keeps another heal amount and gate floor the same way', async () => {
    const authored = structuredClone(creature)
    for (const block of regenerationBlocks(authored)) {
      block.gate = { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 5 }
      for (const outcome of block.outcomes)
        if (outcome.effectKind === 'HEAL' && outcome.valueKind === 'FIXED' && 'amount' in outcome)
          outcome.amount = 20
    }
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})

describe.each([
  ['Vampire', vampire, 1],
  ['Vampire Spawn', vampireSpawn, 1],
  ['Troll', troll, 0]
])(
  '%s Regeneration suppression through the creature node map (SPELLS-33 T4i1b2)',
  (_label, creature, floor) => {
    it('keeps the suppressing damage types exactly as authored, with no closed rule for it', async () => {
      expect(JSON.stringify(creature)).not.toMatch(/VAMPIRE_REGENERATION/)
      const [block] = regenerationBlocks(creature)
      expect(block?.suppressedByDamageTypeIds?.length).toBeGreaterThan(0)
      expect(block?.gate && 'amount' in block.gate ? block.gate.amount : 0).toBe(floor)
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    })

    it('keeps another set of suppressing damage types the same way', async () => {
      const authored = structuredClone(creature)
      for (const block of regenerationBlocks(authored))
        block.suppressedByDamageTypeIds = srdSystemRecord.damageTypes
          .filter(({ code }) => code === 'COLD' || code === 'THUNDER')
          .map(({ id }) => id)
      const result = await normalize(authored)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
    })
  }
)

describe('Reduced-to-0 result block gate through the creature node map (SPELLS-33 T4i3a)', () => {
  const damageOutcomeId = S.actionId(211, 901)

  /** A homebrew feature: slashing damage, and an outcome that follows only if that damage dropped the target to 0. */
  function reducedToZeroCreature(followUp: Record<string, unknown>): CreatureAuthored {
    const authored = structuredClone(oni)
    for (const block of regenerationBlocks(authored)) {
      block.gate = { kind: 'REDUCED_TO_ZERO_BY', damageOutcomeId }
      block.outcomes = [
        {
          id: damageOutcomeId,
          effectKind: S.EFFECT_KIND.DAMAGE,
          damageTypeId: S.damageTypeId('SLASHING'),
          valueKind: S.DAMAGE_VALUE_KIND.DICE,
          scalingKind: S.SCALING.NONE,
          diceConfig: '1d8'
        },
        { id: S.actionId(211, 902), ...followUp }
      ] as typeof block.outcomes
    }
    return authored
  }

  it.each([
    ['a kill', { effectKind: S.EFFECT_KIND.KILL }],
    [
      'a fixed heal',
      {
        effectKind: S.EFFECT_KIND.HEAL,
        valueKind: 'FIXED',
        scalingKind: S.SCALING.NONE,
        amount: 5
      }
    ]
  ])('keeps %s that follows the damage exactly as authored', async (_label, followUp) => {
    const authored = reducedToZeroCreature(followUp)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  async function gateFields(authored: CreatureAuthored) {
    const resolved = await resolveNodeRuntime(reader, {
      mapId: 'creature',
      systemId: srdSystemRecord.id,
      values: structuredClone(authored) as unknown as Record<string, unknown>
    })
    const nodes = resolved.scopes
      .filter((scope) => scope.mapId === 'resultBlockGate')
      .flatMap((scope) => scope.steps)
      .flatMap((step) => step.sections.flatMap((section) => section.nodes))
    const field = (name: string) => {
      const matches = nodes.filter((node) => node.path.at(-1) === name)
      if (matches.length !== 1)
        throw new Error(
          `Expected one gate ${name} node, got ${matches.length} of ${[...new Set(resolved.scopes.map((scope) => scope.mapId))]}`
        )
      return matches[0]
    }
    return { amount: field('amount'), damageOutcomeId: field('damageOutcomeId') }
  }

  it('shows and requires only the damage outcome the gate follows', async () => {
    const { amount, damageOutcomeId: outcome } = await gateFields(
      reducedToZeroCreature({ effectKind: S.EFFECT_KIND.KILL })
    )
    expect(outcome).toMatchObject({ visible: true, required: true })
    expect(amount).toMatchObject({ visible: false, required: false })
  })

  it('shows and requires only the hit-point amount for a hit-point gate', async () => {
    const authored = reducedToZeroCreature({ effectKind: S.EFFECT_KIND.KILL })
    for (const block of regenerationBlocks(authored))
      block.gate = { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 5 }
    const { amount, damageOutcomeId: outcome } = await gateFields(authored)
    expect(amount).toMatchObject({ visible: true, required: true })
    expect(outcome).toMatchObject({ visible: false, required: false })
  })
})
