import { describe, expect, it } from 'vitest'

import {
  encounterSourceConditionImmunities,
  sourceQualifierAdmits,
  type EncounterHolderState
} from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  SRD,
  evaluateSrdCharacter,
  srdByLabel,
  srdFeature
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { circleOfTheLand } from '@artificer-toolkit/source-data/srd/classes/circle-of-the-land.js'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { ranger } from '@artificer-toolkit/source-data/srd/classes/ranger.js'
import { againstCreatureTypes } from '@artificer-toolkit/source-data/srd/spells/protection-from-evil-and-good.js'
import {
  conditionTypeId,
  creatureTypeId,
  damageTypeId
} from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-31.T4j (D156, D179, D187a): Nature's Ward is authored from the core options a Builder
 * author has on a feature (damage and condition immunity, and condition immunity limited to source
 * creature types); Multiattack Defense and both Land's Stride are GM rulings. A homebrew ward
 * against other types passes the class node map unchanged and resolves the same way.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const HOMEBREW_ID = '7e57a000-0000-4000-8000-000000000031'

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

function feature(record: ClassAuthored, label: string): FeatureAuthored {
  return srdByLabel(record.features ?? [], label)
}

function manualOutcome(authored: FeatureAuthored) {
  const path = authored.effects?.[0]?.paths[0]
  return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
}

/** A homebrew ward: fire immunity, and no charm from fiends, authored as Nature's Ward is. */
function homebrewWard(): FeatureAuthored {
  const idFor = (part: number, entry: number) =>
    `7e57a000-0000-4000-8${part.toString(16).padStart(3, '0')}-${entry.toString(16).padStart(12, '0')}`
  return {
    id: HOMEBREW_ID,
    label: 'Infernal Ward',
    description: 'You are immune to fire, and fiends cannot charm you.',
    availableAtLevel: 1,
    order: 99,
    grants: {
      modifiers: [
        ...againstCreatureTypes(
          idFor,
          [
            {
              valueDomainCode: 'CONDITION_IMMUNITY',
              domain: {},
              modifierKind: 'ADD_OPTION',
              payload: { conditionTypeId: conditionTypeId('CHARMED') }
            }
          ],
          ['FIEND']
        ),
        {
          id: idFor(0x40, 1),
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'DAMAGE_IMMUNITY',
          domain: {},
          modifierKind: 'ADD_OPTION',
          scope: 'GLOBAL',
          selectionKind: 'GRANTED',
          payload: { damageTypeId: damageTypeId('FIRE') },
          order: 2
        }
      ]
    }
  }
}

const holderState: EncounterHolderState = {
  kind: 'CHARACTER',
  creatureTypeIds: [],
  canAct: true,
  speedAboveZero: true,
  freeHand: true,
  stowableHeldItemInstanceId: null,
  turnMovement: { usedFeet: 0, speedFeet: 30 },
  activeAuthoredEffectIds: []
}

describe("Nature's Ward, Multiattack Defense and Land's Stride (SPELLS-31.T4j)", () => {
  // `srdClassNodeMap.test.ts` proves each of these SRD records passes the class node map unchanged.
  it('leaves no closed rule on the SRD Circle of the Land, Hunter or Ranger', () => {
    for (const record of [circleOfTheLand, hunterConclave, ranger]) {
      expect(JSON.stringify(record.features)).not.toMatch(
        /NATURES_WARD|LANDS_STRIDE|MULTIATTACK_DEFENSE/
      )
    }
  })

  it("authors Multiattack Defense and both Land's Stride as GM rulings", () => {
    const multiattackDefense = srdByLabel(
      feature(hunterConclave, 'Defensive Tactics').options ?? [],
      'Multiattack Defense'
    )
    for (const authored of [
      multiattackDefense,
      feature(circleOfTheLand, "Land's Stride"),
      feature(ranger, "Land's Stride")
    ]) {
      expect(manualOutcome(authored)).toMatchObject({ effectKind: 'MANUAL_ADJUDICATION' })
    }
  })

  it('keeps a homebrew ward against other types exactly as authored', async () => {
    const authored = homebrewWard()
    const result = await normalize({
      ...structuredClone(circleOfTheLand),
      features: [...(circleOfTheLand.features ?? []), authored]
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(circleOfTheLand.features ?? []),
      authored
    ])
  })

  it("gives Nature's Ward poison immunity and no charm or fright from elementals or fey", () => {
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Druid', level: 10, subclass: 'Circle of the Land' }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Druid',
          subclassLabel: 'Circle of the Land',
          featureLabel: "Nature's Ward",
          level: 10
        })
      ]
    })
    expect(output.defenses).toContainEqual(
      expect.objectContaining({ kind: 'IMMUNITY', damageTypeId: damageTypeId('POISON') })
    )
    expect(output.conditionImmunityIds).toEqual([conditionTypeId('POISONED')])
    const immunities = encounterSourceConditionImmunities({
      effects: [],
      grantFold: output.grantFold,
      holderState
    })
    expect(immunities.map(({ conditionTypeId: id }) => id).sort()).toEqual(
      [conditionTypeId('CHARMED'), conditionTypeId('FRIGHTENED')].sort()
    )
    for (const { sourceQualifier } of immunities) {
      for (const code of ['ELEMENTAL', 'FEY']) {
        expect(
          sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [creatureTypeId(code)] })
        ).toBe(true)
      }
      expect(
        sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [creatureTypeId('FIEND')] })
      ).toBe(false)
    }
  })

  it('resolves the homebrew ward against its own type and damage', () => {
    const homebrew = homebrewWard()
    const DRUID = srdByLabel(SRD.classes, 'Druid')
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Druid', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:infernal-ward',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: DRUID.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: DRUID.id, classLevel: 1 }
        }
      ]
    })
    expect(output.defenses).toContainEqual(
      expect.objectContaining({ kind: 'IMMUNITY', damageTypeId: damageTypeId('FIRE') })
    )
    const immunities = encounterSourceConditionImmunities({
      effects: [],
      grantFold: output.grantFold,
      holderState
    })
    expect(immunities.map(({ conditionTypeId: id }) => id)).toEqual([conditionTypeId('CHARMED')])
    expect(
      sourceQualifierAdmits(immunities[0]!.sourceQualifier, {
        creatureTypeIds: [creatureTypeId('FIEND')]
      })
    ).toBe(true)
    expect(
      sourceQualifierAdmits(immunities[0]!.sourceQualifier, {
        creatureTypeIds: [creatureTypeId('FEY')]
      })
    ).toBe(false)
  })
})
