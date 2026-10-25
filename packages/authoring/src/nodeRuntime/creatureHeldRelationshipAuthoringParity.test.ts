import { describe, expect, it } from 'vitest'

import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { barbedDevil } from '@artificer-toolkit/source-data/srd/creatures/barbed-devil.js'
import { chainDevil } from '@artificer-toolkit/source-data/srd/creatures/chain-devil.js'
import { chuul } from '@artificer-toolkit/source-data/srd/creatures/chuul.js'
import { cloaker } from '@artificer-toolkit/source-data/srd/creatures/cloaker.js'
import { marilith } from '@artificer-toolkit/source-data/srd/creatures/marilith.js'
import { mimic } from '@artificer-toolkit/source-data/srd/creatures/mimic.js'
import { roper } from '@artificer-toolkit/source-data/srd/creatures/roper.js'
import { stirge } from '@artificer-toolkit/source-data/srd/creatures/stirge.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33 T6a3 (D187a): held-creature riders are written from the options a Builder author has
 * on a creature feature: a grapple's start-of-turn damage (relationship recurrence), an action
 * restricted to the held creature (`heldBySource`), an attach (ACTOR_RELATIONSHIP) and GM rulings
 * (MANUAL_ADJUDICATION). Passive riders with no action stay in the description. Each creature must
 * pass the creature node map exactly as authored, and the eight closed rule kinds are gone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

function feature(creature: CreatureAuthored, label: string) {
  const found = creature.features?.find((candidate) => candidate.label === label)
  if (!found) throw new Error(`The creature must author ${label}.`)
  return found
}

/** Every outcome the creature feature authors, found by walking its effects and fixed paths. */
function featureOutcomes(creature: CreatureAuthored, label: string) {
  return (feature(creature, label).effects ?? []).flatMap((effect) =>
    effect.paths.flatMap((path) =>
      path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
    )
  )
}

describe('held-creature riders from core options (D187a)', () => {
  it.each([
    { creature: chainDevil, label: 'Chain', kinds: ['DAMAGE', 'ACTOR_RELATIONSHIP'] },
    { creature: chuul, label: 'Tentacles', kinds: ['CONDITION', 'CONDITION', 'FOLLOW_UP_SAVE'] },
    {
      creature: marilith,
      label: 'Tail',
      kinds: ['DAMAGE', 'ACTOR_RELATIONSHIP', 'MANUAL_ADJUDICATION']
    },
    { creature: roper, label: 'Reel', kinds: ['MANUAL_ADJUDICATION'] },
    {
      creature: stirge,
      label: 'Blood Drain',
      kinds: ['DAMAGE', 'ACTOR_RELATIONSHIP', 'MANUAL_ADJUDICATION']
    }
  ])(
    'authors $creature.label $label from core options and passes the node map unchanged',
    async ({ creature, label, kinds }) => {
      expect(featureOutcomes(creature, label).map(({ effectKind }) => effectKind)).toEqual(kinds)
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it('deals the Chain Devil grapple’s 2d6 piercing at the start of each of the target’s turns', () => {
    const hold = featureOutcomes(chainDevil, 'Chain').find(
      (outcome) => outcome.effectKind === 'ACTOR_RELATIONSHIP'
    )
    expect(hold).toMatchObject({
      recurrence: {
        turnAnchor: { actor: 'TARGET', boundary: 'START_OF_TURN' },
        damage: { effectKind: 'DAMAGE', diceConfig: '2d6' }
      }
    })
  })

  it.each([
    {
      label: 'a fixed-DC save on the held creature’s turns',
      turnAnchor: { actor: 'TARGET', boundary: 'START_OF_TURN' },
      savingThrow: {
        id: '00000000-0000-4000-8000-00000000a001',
        dcMethod: 'FIXED_DC',
        abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
        baseDc: 14
      }
    },
    {
      label: 'the holder’s turn ends',
      turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' },
      savingThrow: undefined
    }
  ] as const)(
    'authors a hold recurrence with $label from core options (SPELLS-33.T6n1)',
    async ({ turnAnchor, savingThrow }) => {
      const creature = structuredClone(chainDevil)
      const hold = featureOutcomes(creature, 'Chain').find(
        (outcome) => outcome.effectKind === 'ACTOR_RELATIONSHIP'
      )
      if (hold?.effectKind !== 'ACTOR_RELATIONSHIP' || !hold.recurrence)
        throw new Error('The Chain Devil’s Chain must recur.')
      hold.recurrence.turnAnchor = turnAnchor
      if (savingThrow) hold.recurrence.savingThrow = savingThrow
      const result = await normalize(creature)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    }
  )

  it('lets the Chuul Tentacles target only a creature the chuul holds', () => {
    const [tentacles] = feature(chuul, 'Tentacles').effects ?? []
    expect(tentacles?.invocation.targeting).toMatchObject({ heldBySource: true })
  })

  it.each([
    { creature: barbedDevil, label: 'Barbed Hide' },
    { creature: cloaker, label: 'Damage Transfer' },
    { creature: mimic, label: 'Adhesive (Object Form Only)' }
  ])('keeps the passive $creature.label $label in the description', async ({ creature, label }) => {
    expect(feature(creature, label).effects ?? []).toEqual([])
    const result = await normalize(creature)
    expect(result.clearedPaths).toEqual([])
  })

  it('no longer lists the eight held-creature closed rule kinds', () => {
    for (const kind of [
      'CREATURE_BARBED_HIDE',
      'CREATURE_CHAIN_DEVIL_CHAIN',
      'CREATURE_CHUUL_TENTACLES',
      'CREATURE_CLOAKER_DAMAGE_TRANSFER',
      'CREATURE_MARILITH_TAIL',
      'CREATURE_MIMIC_ADHESIVE',
      'CREATURE_STIRGE_BLOOD_DRAIN',
      'ROPER_REEL'
    ]) {
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
    }
  })
})
