import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CHALLENGE_RATINGS,
  SRD_MAGIC_SCHOOLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'
import { creatureTypeId, spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}
export const animalShapes: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ANIMAL_SHAPES,
  label: 'Animal Shapes',
  description:
    "<p>Your magic turns others into beasts. Choose any number of willing creatures that you can see within range. You transform each target into the form of a Large or smaller beast with a challenge rating of 4 or lower. On subsequent turns, you can use your action to transform affected creatures into new forms. The transformation lasts for the duration for each target, or until the target drops to 0 hit points or dies. You can choose a different form for each target. A target's game statistics are replaced by the statistics of the chosen beast, though the target retains its alignment and Intelligence, Wisdom, and Charisma scores. The target assumes the hit points of its new form, and when it reverts to its normal form, it returns to the number of hit points it had before it transformed. If it reverts as a result of dropping to 0 hit points, any excess damage carries over to its normal form. As long as the excess damage doesn't reduce the creature's normal form to 0 hit points, it isn't knocked unconscious. The creature is limited in the actions it can perform by the nature of its new form, and it can't speak or cast spells. The target's gear melds into the new form. The target can't activate, wield, or otherwise benefit from any of its equipment.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 8,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.ANIMAL_SHAPES, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ANIMAL_SHAPES, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.ANIMAL_SHAPES, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.ANIMAL_SHAPES, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.ANIMAL_SHAPES, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 24
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.ANIMAL_SHAPES, 0x212, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.CREATURE,
                excessDamageCarriesOver: true,
                retainedAbilityDefinitionIds: [
                  SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE,
                  SRD_ABILITY_DEFINITION_IDS.WISDOM,
                  SRD_ABILITY_DEFINITION_IDS.CHARISMA
                ],
                formFilter: {
                  id: spellChildId(SPELL_IDS.ANIMAL_SHAPES, 0x214, 1),
                  creatureTypeId: creatureTypeId('BEAST'),
                  challengeRatingCapKind: 'FIXED',
                  maxChallengeRatingId: SRD_CHALLENGE_RATINGS.find(({ code }) => code === 'CR_4')!
                    .id
                }
              },
              {
                id: spellChildId(SPELL_IDS.ANIMAL_SHAPES, 0x2f0, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Animal Shapes Limits',
                reasonCode: 'GM_CHOICE' as const,
                instructions:
                  'The GM checks that each form is Large or smaller, lets each target take a different form, and lets the caster use an action on a later turn to give a target a new form.'
              }
            ]
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
