import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  DURATION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type ManifestBehaviorAuthored,
  type ManifestAuthored,
  type ManifestComponentAuthored,
  type ManifestDestructionCriterionAuthored,
  type NonManifestOutcomeAuthored,
  type ShapeAuthored,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import {
  conditionTypeId,
  damageTypeId,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'

const createLayerBehavior = (
  formScope: number,
  layer: number,
  failedOutcomes: NonManifestOutcomeAuthored[],
  successfulOutcomes: NonManifestOutcomeAuthored[]
): ManifestBehaviorAuthored => ({
  id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x10, layer),
  order: 1,
  invocation: {
    kind: 'PASSIVE',
    triggerCode: TRIGGER.SAVING_THROW,
    savingThrow: {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x11, layer),
      dcMethod: 'SOURCE_SAVE_DC',
      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY
    },
    range: {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x12, layer),
      rangeKind: RANGE_KIND.SELF
    }
  },
  paths: [
    {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x13, layer),
      order: 1,
      pathCode: PATH_CODE.ON_SAVE_FAIL,
      groupType: PATH_GROUP_TYPE.SEQUENTIAL,
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: `${spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x13, layer)}__result`,
        resultKind: 'SEQUENCE',
        outcomes: failedOutcomes
      }
    },
    ...(successfulOutcomes.length > 0
      ? [
          {
            id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x14, layer),
            order: 2,
            pathCode: PATH_CODE.ON_SAVE_SUCCESS,
            groupType: PATH_GROUP_TYPE.SEQUENTIAL,
            originKind: 'SOURCE' as const,
            selectionKind: 'FIXED' as const,
            resultBlock: {
              id: `${spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x14, layer)}__result`,
              resultKind: 'SEQUENCE' as const,
              outcomes: successfulOutcomes
            }
          }
        ]
      : [])
  ]
})

const createDamageOutcome = (
  formScope: number,
  layer: number,
  damageCode: string,
  half: boolean
): NonManifestOutcomeAuthored => ({
  id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + (half ? 0x30 : 0x20), layer),
  effectKind: EFFECT_KIND.DAMAGE,
  damageTypeId: damageTypeId(damageCode),
  ...(half ? { amountKind: SCALING_AMOUNT_KIND.HALF } : {}),
  valueKind: 'DICE',
  scalingKind: SCALING.NONE,
  diceConfig: '10d6'
})

const createDamageLayer = (
  formScope: number,
  layer: number,
  label: string,
  damageCode: string,
  destructionCriterion: ManifestDestructionCriterionAuthored,
  blockingRules: ManifestComponentAuthored['blockingRules'] = []
): ManifestComponentAuthored => ({
  id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope, layer),
  order: layer,
  label,
  interactionKind: 'ENTER_OR_PASS_THROUGH',
  behaviors: [
    createLayerBehavior(
      formScope,
      layer,
      [createDamageOutcome(formScope, layer, damageCode, false)],
      [createDamageOutcome(formScope, layer, damageCode, true)]
    )
  ],
  blockingRules,
  destructionCriteria: [destructionCriterion]
})

const createIndigoLayer = (formScope: number): ManifestComponentAuthored => {
  const layer = 6
  return {
    id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope, layer),
    order: layer,
    label: 'Indigo',
    interactionKind: 'ENTER_OR_PASS_THROUGH',
    behaviors: [
      createLayerBehavior(
        formScope,
        layer,
        [
          {
            id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x20, layer),
            effectKind: EFFECT_KIND.CONDITION,
            conditionId: conditionTypeId('RESTRAINED')
          },
          {
            id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x21, layer),
            effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
            timing: 'TARGET_TURN_END',
            savingThrow: {
              id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x22, layer),
              dcMethod: 'SOURCE_SAVE_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION
            },
            attempts: {
              kind: 'THRESHOLDS',
              successesToEnd: 3,
              failuresToResolve: 3,
              consecutive: false
            },
            onSuccess: { kind: 'END' },
            onFailure: {
              kind: 'OUTCOMES',
              endCurrent: true,
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x23, layer),
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: conditionTypeId('PETRIFIED')
                }
              ]
            }
          }
        ],
        []
      )
    ],
    blockingRules: ['SPELLS'],
    destructionCriteria: [
      {
        id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x70, layer),
        order: 1,
        kind: 'SPELL_CAPABILITY',
        capability: 'SHED_BRIGHT_LIGHT',
        minimumSpellLevel: 3,
        exampleSpellIds: [SPELL_IDS.DAYLIGHT]
      }
    ]
  }
}

const createVioletLayer = (formScope: number): ManifestComponentAuthored => {
  const layer = 7
  return {
    id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope, layer),
    order: layer,
    label: 'Violet',
    interactionKind: 'ENTER_OR_PASS_THROUGH',
    behaviors: [
      createLayerBehavior(
        formScope,
        layer,
        [
          {
            id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x20, layer),
            effectKind: EFFECT_KIND.CONDITION,
            conditionId: conditionTypeId('BLINDED')
          },
          {
            id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x21, layer),
            effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
            timing: 'SOURCE_NEXT_TURN_START',
            savingThrow: {
              id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x22, layer),
              dcMethod: 'SOURCE_SAVE_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
            },
            attempts: { kind: 'ONCE' },
            onSuccess: { kind: 'END' },
            onFailure: {
              kind: 'OUTCOMES',
              endCurrent: true,
              resultKind: 'SEQUENCE',
              outcomes: [
                {
                  id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x23, layer),
                  effectKind: EFFECT_KIND.TELEPORT,
                  targetKind: 'TARGET',
                  destinationKind: 'SPECIAL'
                },
                {
                  id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x24, layer),
                  effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                  label: 'Choose destination plane',
                  reasonCode: 'GM_CHOICE',
                  instructions:
                    "If it fails that save, the creature is transported to another plane of the GM's choosing and is no longer blinded."
                }
              ]
            }
          }
        ],
        []
      )
    ],
    destructionCriteria: [
      {
        id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x70, layer),
        order: 1,
        kind: 'SPELL_CAPABILITY',
        capability: 'END_SPELL_OR_MAGICAL_EFFECT',
        minimumSpellLevel: 3,
        exampleSpellIds: [SPELL_IDS.DISPEL_MAGIC]
      }
    ]
  }
}

const createLayers = (formScope: number): ManifestComponentAuthored[] => [
  createDamageLayer(
    formScope,
    1,
    'Red',
    'FIRE',
    {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x70, 1),
      order: 1,
      kind: 'DAMAGE_THRESHOLD',
      damageTypeId: damageTypeId('COLD'),
      amount: 25
    },
    ['NONMAGICAL_RANGED_ATTACKS']
  ),
  createDamageLayer(
    formScope,
    2,
    'Orange',
    'ACID',
    {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x70, 2),
      order: 1,
      kind: 'STRONG_WIND'
    },
    ['MAGICAL_RANGED_ATTACKS']
  ),
  createDamageLayer(formScope, 3, 'Yellow', 'LIGHTNING', {
    id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x70, 3),
    order: 1,
    kind: 'DAMAGE_THRESHOLD',
    damageTypeId: damageTypeId('FORCE'),
    amount: 60
  }),
  createDamageLayer(formScope, 4, 'Green', 'POISON', {
    id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x70, 4),
    order: 1,
    kind: 'SPELL_CAPABILITY',
    capability: 'OPEN_PORTAL_ON_SOLID_SURFACE',
    minimumSpellLevel: 5,
    exampleSpellIds: [SPELL_IDS.PASSWALL]
  }),
  createDamageLayer(formScope, 5, 'Blue', 'COLD', {
    id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x70, 5),
    order: 1,
    kind: 'DAMAGE_THRESHOLD',
    damageTypeId: damageTypeId('FIRE'),
    amount: 25
  }),
  createIndigoLayer(formScope),
  createVioletLayer(formScope)
]

const createProximityBehavior = (formScope: number): ManifestBehaviorAuthored => ({
  id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x80, 1),
  order: 1,
  invocation: {
    kind: 'PASSIVE',
    triggerCode: TRIGGER.SAVING_THROW,
    savingThrow: {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x81, 1),
      dcMethod: 'SOURCE_SAVE_DC',
      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION
    },
    range: {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x82, 1),
      rangeKind: RANGE_KIND.SELF
    }
  },
  paths: [
    {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x83, 1),
      order: 1,
      pathCode: PATH_CODE.ON_SAVE_FAIL,
      groupType: PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: `${spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x83, 1)}__result`,
        resultKind: 'SINGLE',
        duration: {
          id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x84, 1),
          durationKind: DURATION_KIND.MINUTE,
          amount: 1
        },
        outcomes: [
          {
            id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x85, 1),
            effectKind: EFFECT_KIND.CONDITION,
            conditionId: conditionTypeId('BLINDED')
          }
        ]
      }
    }
  ]
})

const createPrismaticManifest = (
  formScope: number,
  label: string,
  shape: ShapeAuthored
): ManifestAuthored => ({
  id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope, 0),
  effectKind: EFFECT_KIND.MANIFEST,
  manifestKind: 'ZONE' as const,
  label,
  shape,
  components: createLayers(formScope),
  componentsMustResolveInOrder: true,
  destructionMustResolveInOrder: true,
  destroyedComponentsRemainDestroyed: true,
  placementMustBeUnoccupied: true,
  invalidPlacementConsumesInvocation: true,
  designatedCreatureImmunity: true,
  proximityRule: {
    id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x80, 0),
    events: ['MOVE_WITHIN', 'START_TURN'],
    distance: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET },
    requiresSight: true,
    behavior: createProximityBehavior(formScope)
  },
  light: {
    bright: { amount: 100, unit: MEASUREMENT_UNIT_CODE.FEET },
    dimAdditional: { amount: 100, unit: MEASUREMENT_UNIT_CODE.FEET }
  },
  destructionCriteria: [
    {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, formScope + 0x90, 1),
      order: 1,
      kind: 'NAMED_OBJECT' as const,
      objectLabel: 'Rod of cancellation'
    }
  ],
  suppressionImmunities: ['ANTIMAGIC_FIELD']
})
export const prismaticWall: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PRISMATIC_WALL,
  label: 'Prismatic Wall',
  description:
    "<p>A shimmering, multicolored plane of light forms a vertical opaque wall-up to 90 feet long, 30 feet high, and 1 inch thick-centered on a point you can see within range. Alternatively, you can shape the wall into a sphere up to 30 feet in diameter centered on a point you choose within range. The wall remains in place for the duration. If you position the wall so that it passes through a space occupied by a creature, the spell fails, and your action and the spell slot are wasted. The wall sheds bright light out to a range of 100 feet and dim light for an additional 100 feet. You and creatures you designate at the time you cast the spell can pass through and remain near the wall without harm. If another creature that can see the wall moves to within 20 feet of it or starts its turn there, the creature must succeed on a Constitution saving throw or become blinded for 1 minute. The wall consists of seven layers, each with a different color. When a creature attempts to reach into or pass through the wall, it does so one layer at a time through all the wall's layers. As it passes or reaches through each layer, the creature must make a Dexterity saving throw or be affected by that layer's properties as described below. The wall can be destroyed, also one layer at a time, in order from red to violet, by means specific to each layer. Once a layer is destroyed, it remains so for the duration of the spell. A rod of cancellation destroys a prismatic wall, but an antimagic field has no effect on it. 1. Red. The creature takes 10d6 fire damage on a failed save, or half as much damage on a successful one. While this layer is in place, nonmagical ranged attacks can't pass through the wall. The layer can be destroyed by dealing at least 25 cold damage to it. 2. Orange. The creature takes 10d6 acid damage on a failed save, or half as much damage on a successful one. While this layer is in place, magical ranged attacks can't pass through the wall. The layer is destroyed by a strong wind. 3. Yellow. The creature takes 10d6 lightning damage on a failed save, or half as much damage on a successful one. This layer can be destroyed by dealing at least 60 force damage to it. 4. Green. The creature takes 10d6 poison damage on a failed save, or half as much damage on a successful one. A passwall spell, or another spell of equal or greater level that can open a portal on a solid surface, destroys this layer. 5. Blue. The creature takes 10d6 cold damage on a failed save, or half as much damage on a successful one. This layer can be destroyed by dealing at least 25 fire damage to it. 6. Indigo. On a failed save, the creature is restrained. It must then make a Constitution saving throw at the end of each of its turns. If it successfully saves three times, the spell ends. If it fails its save three times, it permanently turns to stone and is subjected to the petrified condition. The successes and failures don't need to be consecutive; keep track of both until the creature collects three of a kind. While this layer is in place, spells can't be cast through the wall. The layer is destroyed by bright light shed by a daylight spell or a similar spell of equal or higher level. 7. Violet. On a failed save, the creature is blinded. It must then make a Wisdom saving throw at the start of your next turn. A successful save ends the blindness. If it fails that save, the creature is transported to another plane of the GM's choosing and is no longer blinded. (Typically, a creature that is on a plane that isn't its home plane is banished home, while other creatures are usually cast into the Astral or Ethereal planes.) This layer is destroyed by a dispel magic spell or a similar spell of equal or higher level that can end spells and magical effects.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 9,
  classIds: [CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('ABJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE' as const,
          selectionKind: 'CHOICE' as const,
          options: [
            {
              id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x212, 1),
              order: 1,
              label: 'Wall',
              description:
                'A shimmering, multicolored plane of light forms a vertical opaque wall-up to 90 feet long, 30 feet high, and 1 inch thick-centered on a point you can see within range.',
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x212, 1)}__result`,
                resultKind: 'SINGLE' as const,
                duration: {
                  id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x213, 1),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 10
                },
                outcomes: [
                  createPrismaticManifest(0x400, 'Prismatic Wall', {
                    id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x214, 1),
                    shapeKind: SHAPE_KIND.WALL,
                    length: { amount: 90, unit: MEASUREMENT_UNIT_CODE.FEET },
                    height: { amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET },
                    thickness: { amount: 1, unit: MEASUREMENT_UNIT_CODE.INCHES }
                  })
                ]
              }
            },
            {
              id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x212, 2),
              order: 2,
              label: 'Sphere',
              description:
                'Alternatively, you can shape the wall into a sphere up to 30 feet in diameter centered on a point you choose within range.',
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x212, 2)}__result`,
                resultKind: 'SINGLE' as const,
                duration: {
                  id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x213, 2),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 10
                },
                outcomes: [
                  createPrismaticManifest(0x500, 'Prismatic Sphere', {
                    id: spellChildId(SPELL_IDS.PRISMATIC_WALL, 0x214, 2),
                    shapeKind: SHAPE_KIND.SPHERE,
                    radius: { amount: 15, unit: MEASUREMENT_UNIT_CODE.FEET }
                  })
                ]
              }
            }
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
