import { describe, expect, it } from 'vitest'

import {
  encounterAttackAgainstContributors,
  type EncounterHolderState
} from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import {
  encounterAttackSightContributors,
  type EncounterAttackPerception
} from '@artificer-toolkit/rules-runtime/encounterAttackPerception'
import { ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID } from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { dnd5eVocabularyCapabilityAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/vocabulary'
import {
  SRD,
  evaluateSrdCharacter,
  srdByLabel
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { rogue } from '@artificer-toolkit/source-data/srd/classes/rogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * RULES-2.T9b: suppressing a roll influence is one authored option, not an Elusive rule. An
 * author-built feature that suppresses DISADVANTAGE on attacks against its holder passes the class
 * node map as authored, a code outside the System's rollInfluence list is cleared, and the
 * runtime drops the suppressed influence through the same path that drops Elusive's advantage.
 */

const reader = createSrdNodeRuntimeReader(dnd5eVocabularyCapabilityAdapter.lists)
const HOMEBREW_ID = '7e57a000-0000-4000-8000-000000000001'
const HOLDER_ID = '7e57a000-0000-4000-8000-000000000002'

/** Elusive as a homebrew feature that suppresses `influence` instead of advantage. */
function suppressing(influence: string): FeatureAuthored {
  const elusive = rogue.features?.find(({ label }) => label === 'Elusive')
  if (!elusive?.grants?.modifiers) throw new Error('The Rogue must author Elusive grants.')
  return {
    ...structuredClone(elusive),
    id: HOMEBREW_ID,
    label: 'Unshaken',
    grants: {
      modifiers: elusive.grants.modifiers.map((modifier, index) => {
        if (modifier.modifierKind !== 'SUPPRESS_ROLL_INFLUENCE')
          throw new Error('Elusive must suppress a roll influence.')
        return {
          ...structuredClone(modifier),
          id: `7e57a000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
          payload: { influence }
        }
      })
    }
  }
}

function normalizeRogueWith(feature: FeatureAuthored) {
  const record: ClassAuthored = {
    ...structuredClone(rogue),
    features: [...(rogue.features ?? []), feature]
  }
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

const holderState: EncounterHolderState = {
  kind: 'CHARACTER',
  creatureTypeIds: [],
  canAct: true,
  speedAboveZero: true,
  freeHand: true,
  stowableHeldItemInstanceId: null,
  turnMovement: { usedFeet: 0, speedFeet: 30 }
}

const ROGUE = srdByLabel(SRD.classes, 'Rogue')

describe('an authored suppression of a roll influence (RULES-2.T9b)', () => {
  it('keeps a feature that suppresses disadvantage exactly as authored', async () => {
    const authored = suppressing('DISADVANTAGE')
    const result = await normalizeRogueWith(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(rogue.features ?? []),
      authored
    ])
  })

  it('clears an influence the System does not list', async () => {
    const result = await normalizeRogueWith(suppressing('NOT_AN_INFLUENCE'))
    expect(result.clearedPaths.length).toBeGreaterThan(0)
    expect(result.clearedPaths.every((path) => path.at(-1) === 'influence')).toBe(true)
  })

  it('drops the suppressed disadvantage and keeps the advantage through the Elusive path', () => {
    const homebrew = suppressing('DISADVANTAGE')
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Rogue', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:unshaken',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: ROGUE.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: ROGUE.id, classLevel: 1 }
        }
      ]
    })
    const attacksAgainst = encounterAttackAgainstContributors({
      holderActorId: HOLDER_ID,
      effects: [],
      grantFold: output.grantFold,
      holderState
    })
    expect(attacksAgainst.length).toBeGreaterThan(0)
    for (const entry of attacksAgainst) {
      expect(entry).toMatchObject({ contributor: null, suppressedInfluence: 'DISADVANTAGE' })
    }
    const contributors = (value: Partial<EncounterAttackPerception>) =>
      encounterAttackSightContributors({
        perception: {
          targetSeesAttacker: 'SEES',
          attackerSeesTarget: 'SEES',
          targetSenseLabels: [],
          attackerSenseLabels: [],
          attackerSenseDefinitionIds: [],
          ...value
        },
        attacksAgainst
      }).map((contributor) => contributor.sourceId)
    expect(contributors({ attackerSeesTarget: 'UNSEEN' })).toEqual([])
    expect(contributors({ targetSeesAttacker: 'UNSEEN' })).toEqual([
      ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID
    ])
  })
})
