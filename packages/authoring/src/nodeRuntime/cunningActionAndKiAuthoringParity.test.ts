import { describe, expect, it } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  SRD,
  evaluateSrdCharacter,
  srdByLabel,
  srdFeature
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { ranger } from '@artificer-toolkit/source-data/srd/classes/ranger.js'
import { rogue } from '@artificer-toolkit/source-data/srd/classes/rogue.js'
import { thiefRoguishArchetype } from '@artificer-toolkit/source-data/srd/classes/thief.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-31.T4l1 (D156, D160, D188, D187a): Cunning Action, Fast Hands and Vanish are standing
 * offers of basic actions, authored from the `grantedActions` option on a passive APPLY_GRANT with
 * no duration; the Ki disciplines are Bonus Actions that spend a ki point and offer their actions
 * until the end of the turn. The Ki clauses the engine does not apply are a GM ruling. A homebrew
 * standing offer passes the class node map unchanged and reaches a Character the same way.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const { DASH, DISENGAGE, DODGE, HIDE, USE_AN_OBJECT } = SRD_BASIC_ACTION_IDS
const HOMEBREW_ID = '7e57a000-0000-4000-8000-000000000041'

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

function effectIds(record: ClassAuthored, label: string) {
  return (srdByLabel(record.features ?? [], label).effects ?? []).map(({ id }) => id)
}

/** A homebrew feature that lets its holder Disengage as a Bonus Action on every turn. */
function homebrewQuickStep(): FeatureAuthored {
  const idFor = (entry: number) => `7e57a000-0000-4000-8041-${entry.toString(16).padStart(12, '0')}`
  return {
    id: HOMEBREW_ID,
    label: 'Quick Step',
    description: 'You can take the Disengage action as a bonus action on each of your turns.',
    availableAtLevel: 1,
    order: 99,
    effects: [
      {
        id: idFor(1),
        order: 1,
        invocation: {
          kind: 'PASSIVE',
          triggerCode: 'ACTIVATED',
          range: { id: idFor(2), rangeKind: 'SELF' },
          targeting: { selectionKind: 'SELF' }
        },
        paths: [
          {
            id: idFor(3),
            order: 1,
            pathCode: 'PASSIVE',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: idFor(4),
              resultKind: 'SINGLE',
              lifecycle: {
                grantedActions: [{ activation: 'BONUS_ACTION', actionDefinitionIds: [DISENGAGE] }]
              },
              outcomes: [{ id: idFor(5), effectKind: 'APPLY_GRANT', grants: {} }]
            }
          }
        ]
      }
    ]
  }
}

describe('Cunning Action, Fast Hands, Vanish and the Ki disciplines (SPELLS-31.T4l1)', () => {
  it('no longer lists their closed rule kinds', () => {
    for (const kind of [
      'CLASS_MONK_KI_DISCIPLINES',
      'CLASS_RANGER_VANISH',
      'CLASS_ROGUE_CUNNING_ACTION',
      'CLASS_THIEF_FAST_HANDS'
    ]) {
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
    }
  })

  it.each([rogue, thiefRoguishArchetype, ranger, monk])(
    'passes the class node map exactly as authored: $label',
    async (record) => {
      const result = await normalize(record)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(record.features)
    }
  )

  it('gives a Thief standing Bonus Action offers of Dash, Disengage, Hide and Use an Object', () => {
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Rogue', level: 3, subclass: 'Thief' }],
      features: [
        srdFeature({
          owner: 'CLASS',
          classLabel: 'Rogue',
          featureLabel: 'Cunning Action',
          level: 2
        }),
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Rogue',
          subclassLabel: 'Thief',
          featureLabel: 'Fast Hands',
          level: 3
        })
      ]
    })
    const [cunningAction] = effectIds(rogue, 'Cunning Action')
    const [fastHands] = effectIds(thiefRoguishArchetype, 'Fast Hands')
    expect(character.standingGrantedActions).toEqual([
      {
        effectId: cunningAction,
        offerIndex: 0,
        offer: { activation: 'BONUS_ACTION', actionDefinitionIds: [DASH, DISENGAGE, HIDE] }
      },
      {
        effectId: fastHands,
        offerIndex: 0,
        offer: { activation: 'BONUS_ACTION', actionDefinitionIds: [USE_AN_OBJECT] }
      }
    ])
    // Neither is an action of its own to take.
    expect(
      character.entryPoints.filter(({ effectId }) => [cunningAction, fastHands].includes(effectId))
    ).toEqual([])
  })

  it('gives a Ranger with Vanish a standing Bonus Action offer of Hide', () => {
    const { standingGrantedActions } = evaluateSrdCharacter({
      classes: [{ label: 'Ranger', level: 14 }],
      features: [
        srdFeature({ owner: 'CLASS', classLabel: 'Ranger', featureLabel: 'Vanish', level: 14 })
      ]
    })
    expect(standingGrantedActions).toEqual([
      {
        effectId: effectIds(ranger, 'Vanish')[0],
        offerIndex: 0,
        offer: { activation: 'BONUS_ACTION', actionDefinitionIds: [HIDE] }
      }
    ])
  })

  it('makes each Ki discipline a ki-paid Bonus Action that offers its actions this turn', () => {
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Monk', level: 2 }],
      features: [srdFeature({ owner: 'CLASS', classLabel: 'Monk', featureLabel: 'Ki', level: 2 })]
    })
    expect(character.standingGrantedActions).toEqual([])
    const [flurry, patientDefense, stepOfTheWind, ruling] = effectIds(monk, 'Ki')
    const disciplines = [flurry, patientDefense, stepOfTheWind].map((id) => {
      const entry = character.entryPoints.find(({ effectId }) => effectId === id)
      if (!entry) throw new Error('Each Ki discipline must be an action to take.')
      const { invocation, entries } = entry.compiledEffect
      return {
        activation: invocation.kind === 'ACTION' ? invocation.activation : null,
        kiCost: invocation.kind === 'ACTION' ? invocation.resourceUse?.cost : null,
        offers: entries.flatMap((compiled) =>
          'outcome' in compiled && compiled.duration
            ? (compiled.lifecycle?.grantedActions ?? [])
            : []
        )
      }
    })
    const bonusAction = { code: 'BONUS_ACTION', amount: 1 }
    expect(disciplines).toEqual([
      {
        activation: bonusAction,
        kiCost: 1,
        offers: [
          { activation: 'FREE', usesPerTurn: 2, actionDefinitionIds: [], weaponAttack: true }
        ]
      },
      {
        activation: bonusAction,
        kiCost: 1,
        offers: [{ activation: 'FREE', usesPerTurn: 1, actionDefinitionIds: [DODGE] }]
      },
      {
        activation: bonusAction,
        kiCost: 1,
        offers: [{ activation: 'FREE', usesPerTurn: 1, actionDefinitionIds: [DASH, DISENGAGE] }]
      }
    ])
    const rulingPath = srdByLabel(monk.features ?? [], 'Ki').effects?.find(
      ({ id }) => id === ruling
    )?.paths[0]
    expect(
      rulingPath?.selectionKind === 'FIXED' ? rulingPath.resultBlock.outcomes[0] : undefined
    ).toMatchObject({ effectKind: 'MANUAL_ADJUDICATION' })
  })

  it('keeps a homebrew standing offer exactly as authored', async () => {
    const authored = homebrewQuickStep()
    const result = await normalize({
      ...structuredClone(rogue),
      features: [...(rogue.features ?? []), authored]
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(rogue.features ?? []),
      authored
    ])
  })

  it('gives a Character the homebrew standing offer as it does Cunning Action', () => {
    const homebrew = homebrewQuickStep()
    const FIGHTER = srdByLabel(SRD.classes, 'Fighter')
    const { standingGrantedActions } = evaluateSrdCharacter({
      classes: [{ label: 'Fighter', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:quick-step',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: FIGHTER.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: FIGHTER.id, classLevel: 1 }
        }
      ]
    })
    expect(standingGrantedActions).toEqual([
      {
        effectId: homebrew.effects![0]!.id,
        offerIndex: 0,
        offer: { activation: 'BONUS_ACTION', actionDefinitionIds: [DISENGAGE] }
      }
    ])
  })
})
