import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'

import { collectOnHitRiders } from '../character/characterOnHitRiders.js'
import { compiledTestSpellCast } from '../testing/plannedTimedCondition.js'

const spell = (label: string): SpellAuthored => {
  const found = srdSpells.find((entry) => entry.label === label)
  if (!found) throw new Error(`SRD spell "${label}" is missing.`)
  return found
}

/** The SRD invocation as authored: the rider the Warlock owes its Eldritch Blast casts. */
function repellingBlastRiders() {
  const feature = warlock.features
    ?.flatMap((each) => each.options ?? [])
    .find((option) => option.label === 'Repelling Blast')
  if (!feature) throw new Error('Repelling Blast is missing from the SRD Warlock.')
  return collectOnHitRiders(
    (feature.effects ?? []).map((effect) => compileEffect(effect)),
    feature.id,
    feature.label
  )
}

function castOf(authored: SpellAuthored, onHitRiders = repellingBlastRiders()) {
  const sourceInstanceId = `class-${authored.id}`
  return compiledTestSpellCast({
    spell: authored,
    onHitRiders,
    cast: {
      sequence: 0,
      candidateId: `CLASS:${sourceInstanceId}:${authored.id}:level:${authored.level}`,
      spellId: authored.id,
      source: { spellId: authored.id, sourceKind: 'CLASS', sourceInstanceId },
      spellLevel: authored.level,
      castMode: 'AT_WILL',
      castLevel: authored.level,
      resourceOwnerKey: null
    } as never,
    decision: { status: 'AVAILABLE', reasonCode: null } as never
  }).entry
}

/** Every forced movement the cast's compiled Effect carries, wherever it sits in the compilation. */
function forcedMovements(entry: ReturnType<typeof castOf>): unknown[] {
  const found: unknown[] = []
  JSON.stringify(entry.compilation, (_key, value: unknown) => {
    if (typeof value === 'object' && value !== null && 'effectKind' in value)
      if (value.effectKind === 'FORCED_MOVEMENT') found.push(value)
    return value
  })
  return found
}

describe('spell-scoped on-hit riders (SPELLS-31.T5i2)', () => {
  it('no longer lists the closed rule kind', () => {
    expect(CLOSED_RULE_KIND).not.toHaveProperty('CLASS_WARLOCK_REPELLING_BLAST')
  })

  it('collects the authored invocation as a rider scoped to Eldritch Blast', () => {
    expect(repellingBlastRiders()).toMatchObject([
      { triggerCode: 'RANGED_SPELL_ATTACK', ridesSpellIds: [spell('Eldritch Blast').id] }
    ])
  })

  it('pushes the target up to 10 feet on a hit with Eldritch Blast', () => {
    expect(forcedMovements(castOf(spell('Eldritch Blast')))).toMatchObject([
      { direction: 'AWAY_FROM_SOURCE', distanceMode: 'UP_TO', amount: 10, unit: 'FEET' }
    ])
  })

  it('rides no other spell, however its trigger matches', () => {
    expect(forcedMovements(castOf(spell('Fire Bolt')))).toEqual([])
  })

  it('pushes nothing without the invocation', () => {
    expect(forcedMovements(castOf(spell('Eldritch Blast'), []))).toEqual([])
  })
})
