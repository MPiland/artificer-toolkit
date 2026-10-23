import type { SpellAuthored } from '@artificer-toolkit/shared'
import {
  SRD_MAGIC_SCHOOLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { conditionTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'

const id = (n: number) => `00000000-0000-4000-8000-0000000fd${n.toString(16).padStart(3, '0')}`

export const FRESH_REPEAT_SPELL_ID = id(0)
export const FRESH_REPEAT_EFFECT_ID = id(1)
/** The save result that frightens until the Concentration ends, and the one the repeat re-runs. */
export const FRESH_REPEAT_FAIL_PATH_ID = id(2)
export const FRESH_REPEAT_SUCCESS_PATH_ID = id(3)

/** The authored carrier: no grants, ends with the Concentration, offers one fresh repeat of the paths. */
function carrierPath(pathCode: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS', n: number, order: number) {
  return {
    id: id(n),
    order,
    pathCode,
    groupType: 'SEQUENTIAL' as const,
    originKind: 'SOURCE' as const,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: id(n + 3),
      resultKind: 'SEQUENCE' as const,
      duration: { id: id(n + 1), durationKind: 'MINUTE' as const, amount: 1 },
      lifecycle: {
        effectOffers: [
          {
            kind: 'REPEAT_SOURCE_PATH' as const,
            offeredTo: 'SOURCE' as const,
            target: 'FRESH' as const,
            activation: 'ACTION' as const,
            pathIds: [FRESH_REPEAT_FAIL_PATH_ID, FRESH_REPEAT_SUCCESS_PATH_ID]
          }
        ]
      },
      outcomes: [{ id: id(n + 2), effectKind: 'APPLY_GRANT' as const, grants: {} }]
    }
  }
}

/**
 * Homebrew "Dread Gaze": a Concentration spell whose failed Wisdom save frightens the target, whose
 * successful save makes it immune for the Concentration, and which the caster repeats on a fresh
 * creature each turn with an action. Authored from core options only, with nothing specific to it.
 */
export function freshRepeatSpell(
  range: { amount: number } | 'TOUCH' = { amount: 60 }
): SpellAuthored {
  const school = SRD_MAGIC_SCHOOLS.find((entry) => entry.code === 'NECROMANCY')
  if (!school) throw new Error('The SRD necromancy school is required.')
  return {
    kind: 'SPELL',
    id: FRESH_REPEAT_SPELL_ID,
    label: 'Dread Gaze',
    description: '<p>Homebrew: frighten a creature, then pick a new one each turn.</p>',
    castingTime: { unit: 'ROUND', amount: 1 },
    level: 6,
    classIds: [],
    components: ['VERBAL', 'SOMATIC'],
    magicSchoolId: school.id,
    attributes: ['CONCENTRATION'],
    effects: [
      {
        id: FRESH_REPEAT_EFFECT_ID,
        order: 1,
        invocation: {
          kind: 'ACTION' as const,
          triggerCode: 'SAVING_THROW',
          savingThrow: {
            id: id(4),
            dcMethod: 'SOURCE_SAVE_DC',
            abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM
          },
          activation: { code: 'ACTION', amount: 1 },
          range:
            range === 'TOUCH'
              ? { id: id(5), rangeKind: 'TOUCH' }
              : { id: id(5), rangeKind: 'DISTANCE', amount: range.amount, unit: 'FEET' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: [
          {
            id: FRESH_REPEAT_FAIL_PATH_ID,
            order: 1,
            pathCode: 'ON_SAVE_FAIL' as const,
            groupType: 'SINGLE' as const,
            originKind: 'SOURCE' as const,
            selectionKind: 'FIXED' as const,
            resultBlock: {
              id: id(11),
              resultKind: 'SEQUENCE' as const,
              duration: { id: id(6), durationKind: 'MINUTE' as const, amount: 1 },
              outcomes: [
                {
                  id: id(7),
                  effectKind: 'CONDITION' as const,
                  conditionId: conditionTypeId('FRIGHTENED')
                },
                {
                  id: id(9),
                  effectKind: 'FOLLOW_UP_SAVE' as const,
                  timing: 'TARGET_TURN_END' as const,
                  savingThrow: {
                    id: id(10),
                    dcMethod: 'SOURCE_SAVE_DC' as const,
                    abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM
                  },
                  attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                  onSuccess: { kind: 'END' as const },
                  onFailure: { kind: 'CONTINUE' as const }
                }
              ]
            }
          },
          {
            id: FRESH_REPEAT_SUCCESS_PATH_ID,
            order: 2,
            pathCode: 'ON_SAVE_SUCCESS' as const,
            groupType: 'SINGLE' as const,
            originKind: 'SOURCE' as const,
            selectionKind: 'FIXED' as const,
            resultBlock: {
              id: id(12),
              resultKind: 'SINGLE' as const,
              outcomes: [
                {
                  id: id(8),
                  effectKind: 'SOURCE_IMMUNITY' as const,
                  lifetime: 'CONCENTRATION' as const
                }
              ]
            }
          },
          carrierPath('ON_SAVE_FAIL', 0x10, 3),
          carrierPath('ON_SAVE_SUCCESS', 0x20, 4)
        ]
      }
    ],
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID
  }
}
