import { describe, expect, it } from 'vitest'

import {
  encounterAttackAgainstContributors,
  encounterSourceConditionImmunities,
  sourceQualifierAdmits,
  type EncounterHolderState
} from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  SRD,
  evaluateSrdCharacter,
  srdByLabel
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { oathOfDevotion } from '@artificer-toolkit/source-data/srd/classes/oath-of-devotion.js'
import {
  conditionTypeId,
  creatureTypeId
} from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-4.T2j1 (D156, D179): a grant limited to attacks and effects from creatures of certain
 * types is one authored option, not a Protection from Evil and Good rule. A feature that gives the
 * paladin's Purity of Spirit grants for a different set of creature types passes the class node
 * map as authored, a type outside the System's creature types is cleared, and the runtime admits
 * only the authored types.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const HOMEBREW_ID = '7e57a000-0000-4000-8000-000000000011'
const HOLDER_ID = '7e57a000-0000-4000-8000-000000000012'

/** Purity of Spirit with every source creature type replaced by `creatureTypeIds`. */
function wardingAgainst(creatureTypeIds: readonly string[]): FeatureAuthored {
  const purity = oathOfDevotion.features?.find(({ label }) => label === 'Purity of Spirit')
  if (!purity?.grants?.modifiers) throw new Error('Oath of Devotion must author Purity of Spirit.')
  return {
    ...structuredClone(purity),
    id: HOMEBREW_ID,
    label: 'Warded',
    grants: {
      modifiers: purity.grants.modifiers.map((modifier) => ({
        ...structuredClone(modifier),
        restrictions: {
          ...structuredClone(modifier.restrictions!),
          groups: modifier.restrictions!.groups.map((group) => ({
            ...group,
            contexts: group.contexts.map((context) => ({
              ...context,
              conditions: context.conditions.map((condition) => ({
                ...condition,
                creatureTypeIds: [...creatureTypeIds]
              }))
            }))
          }))
        }
      }))
    }
  }
}

function normalizeOathWith(feature: FeatureAuthored) {
  const record: ClassAuthored = {
    ...structuredClone(oathOfDevotion),
    features: [...(oathOfDevotion.features ?? []), feature]
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

const PALADIN = srdByLabel(SRD.classes, 'Paladin')
const FIEND = creatureTypeId('FIEND')

describe('an authored source creature type on a grant (SPELLS-4.T2j1)', () => {
  it('keeps a feature that wards against one creature type exactly as authored', async () => {
    const authored = wardingAgainst([FIEND])
    const result = await normalizeOathWith(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(oathOfDevotion.features ?? []),
      authored
    ])
  })

  it('clears a creature type the System does not list', async () => {
    const result = await normalizeOathWith(wardingAgainst(['not-a-creature-type']))
    expect(result.clearedPaths.length).toBeGreaterThan(0)
  })

  it('admits only the authored type to attacks and condition immunity', () => {
    const homebrew = wardingAgainst([FIEND])
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Paladin', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:warded',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: PALADIN.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: PALADIN.id, classLevel: 1 }
        }
      ]
    })
    expect(output.conditionImmunityIds).toEqual([])
    const attacksAgainst = encounterAttackAgainstContributors({
      holderActorId: HOLDER_ID,
      effects: [],
      grantFold: output.grantFold,
      holderState
    })
    expect(attacksAgainst.length).toBeGreaterThan(0)
    for (const { sourceQualifier } of attacksAgainst) {
      expect(sourceQualifierAdmits(sourceQualifier, [FIEND])).toBe(true)
      expect(sourceQualifierAdmits(sourceQualifier, [creatureTypeId('UNDEAD')])).toBe(false)
    }
    const immunities = encounterSourceConditionImmunities({
      effects: [],
      grantFold: output.grantFold,
      holderState
    })
    expect(immunities.map(({ conditionTypeId: id }) => id).sort()).toEqual(
      [conditionTypeId('CHARMED'), conditionTypeId('FRIGHTENED')].sort()
    )
    for (const { sourceQualifier } of immunities) {
      expect(sourceQualifierAdmits(sourceQualifier, [FIEND])).toBe(true)
      expect(sourceQualifierAdmits(sourceQualifier, [])).toBe(false)
    }
  })
})
