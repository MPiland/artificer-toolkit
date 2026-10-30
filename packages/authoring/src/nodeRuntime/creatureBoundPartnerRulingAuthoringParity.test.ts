import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { ghost } from '@artificer-toolkit/source-data/srd/creatures/ghost.js'
import { nightmare } from '@artificer-toolkit/source-data/srd/creatures/nightmare.js'
import { shieldGuardian } from '@artificer-toolkit/source-data/srd/creatures/shield-guardian.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6g (D187a): partner-bound grants (the Nightmare's rider, the Shield Guardian's amulet
 * bearer) and the Ghost's body-control swap ship as GM rulings written from the MANUAL_ADJUDICATION
 * option a Builder author has on a creature feature. Each must pass the creature node map exactly as
 * authored, and the four closed rule kinds they used are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

/** Every outcome the creature feature authors, found by walking its effects and fixed paths. */
function featureOutcomes(creature: CreatureAuthored, label: string) {
  const feature = creature.features?.find((candidate) => candidate.label === label)
  if (!feature) throw new Error(`The creature must author ${label}.`)
  return (feature.effects ?? []).flatMap((effect) =>
    effect.paths.flatMap((path) =>
      path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
    )
  )
}

describe('partner-bound and body-control riders as GM rulings (D187a)', () => {
  it.each([
    { creature: nightmare, label: 'Confer Fire Resistance' },
    { creature: shieldGuardian, label: 'Bound' },
    { creature: shieldGuardian, label: 'Shield' },
    { creature: ghost, label: 'Possession (Recharge 6)' }
  ])('keeps $label as a GM ruling with no closed rule', async ({ creature, label }) => {
    const outcomes = featureOutcomes(creature, label)
    expect(outcomes.map(({ effectKind }) => effectKind)).toContain('MANUAL_ADJUDICATION')
    expect(outcomes.map(({ effectKind }) => effectKind)).not.toContain('CLOSED_RULE')
    const result = await normalize(creature)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
  })

  it('keeps the Ghost’s automated incapacitation beside the possession ruling', () => {
    expect(
      featureOutcomes(ghost, 'Possession (Recharge 6)').map(({ effectKind }) => effectKind)
    ).toEqual(['CONDITION', 'MANUAL_ADJUDICATION'])
  })

  it('no longer lists the four closed rule kinds', () => {
    for (const kind of [
      'CREATURE_GHOST_POSSESSION_RECHARGE_6',
      'CREATURE_NIGHTMARE_CONFER_FIRE_RESISTANCE',
      'CREATURE_SHIELD_GUARDIAN_BOUND',
      'CREATURE_SHIELD_GUARDIAN_SHIELD'
    ]) {
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
    }
  })
})
