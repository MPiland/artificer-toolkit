import { describe, expect, it } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-31.T4k1 (D217): Protection and Giant Killer are authored from the core options a Builder
 * author has on a feature: an `ATTACK_ON_OTHER` or `ATTACK_RESOLVED_ON_SELF` reaction trigger with
 * its predicates, and the `IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL` outcome. The SRD records and a
 * homebrew variant pass the class node map exactly as authored, with no closed rule.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

type ReactionInvocation = { reactionTrigger: Record<string, unknown> }

/** Every authored invocation in the record whose reaction trigger is of `kind`. */
function reactionInvocations(node: unknown, kind: string): ReactionInvocation[] {
  if (typeof node !== 'object' || node === null) return []
  const own: ReactionInvocation[] = []
  if ('reactionTrigger' in node) {
    const trigger = node.reactionTrigger
    if (
      typeof trigger === 'object' &&
      trigger !== null &&
      'kind' in trigger &&
      trigger.kind === kind
    )
      own.push(node as ReactionInvocation)
  }
  return [...own, ...Object.values(node).flatMap((child) => reactionInvocations(child, kind))]
}

async function expectKeptAsAuthored(record: ClassAuthored) {
  const result = await normalize(record)
  expect(result.clearedPaths).toEqual([])
  expect(getValueAtPath(result.values, ['features'])).toEqual(record.features)
}

describe.each([
  ['Fighter', fighter],
  ['Paladin', paladin],
  ['Champion', championMartialArchetype]
] as const)("%s's Protection from core options", (_name, record) => {
  it('authors a shield-holder reaction that imposes disadvantage, with no closed rule', () => {
    const [invocation] = reactionInvocations(record, 'ATTACK_ON_OTHER')
    expect(invocation?.reactionTrigger).toMatchObject({
      requiresSight: true,
      targetWithinFeet: 5,
      holderEquippedCategory: 'SHIELD'
    })
    expect(JSON.stringify(record)).not.toMatch(/FIGHTING_STYLE_PROTECTION|CHAMPION_PROTECTION/)
    expect(JSON.stringify(record)).toContain('IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL')
  })

  it('keeps the SRD record exactly as authored', async () => {
    await expectKeptAsAuthored(record)
  })

  it('keeps a homebrew variant, a longer reach and no equipment requirement, the same way', async () => {
    const variant = structuredClone(record)
    const [invocation] = reactionInvocations(variant, 'ATTACK_ON_OTHER')
    if (!invocation) throw new Error('The record must author Protection.')
    invocation.reactionTrigger.targetWithinFeet = 10
    delete invocation.reactionTrigger.holderEquippedCategory
    await expectKeptAsAuthored(variant)
  })
})

describe("the Hunter's Giant Killer from core options", () => {
  it('authors a reaction to an attack by a Large or larger attacker that hit or missed', () => {
    const [invocation] = reactionInvocations(hunterConclave, 'ATTACK_RESOLVED_ON_SELF')
    expect(invocation?.reactionTrigger).toEqual({
      kind: 'ATTACK_RESOLVED_ON_SELF',
      outcome: 'ANY',
      requiresSight: true,
      attackerWithinFeet: 5,
      attackerSize: { minimumSizeCode: 'LARGE' }
    })
    expect(JSON.stringify(hunterConclave)).not.toContain('GIANT_KILLER')
  })

  it('keeps the SRD Hunter conclave exactly as authored', async () => {
    await expectKeptAsAuthored(hunterConclave)
  })

  it('keeps a homebrew variant, a reaction to hits only by Huge attackers, the same way', async () => {
    const variant = structuredClone(hunterConclave)
    const [invocation] = reactionInvocations(variant, 'ATTACK_RESOLVED_ON_SELF')
    if (!invocation) throw new Error('The record must author Giant Killer.')
    invocation.reactionTrigger.outcome = 'HIT'
    invocation.reactionTrigger.attackerSize = { minimumSizeCode: 'HUGE' }
    await expectKeptAsAuthored(variant)
  })
})
