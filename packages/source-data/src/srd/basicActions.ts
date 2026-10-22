import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  MOVEMENT_RULE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared'
import { basicActionReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/basicActions'
import { BASIC_ACTION_DEFINITION_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID,
  SRD_CONDITION_TYPES,
  SRD_MEDICINE_SKILL_ID,
  SRD_PASSIVE_PERCEPTION_ID,
  SRD_PERCEPTION_SKILL_ID,
  SRD_STEALTH_SKILL_ID,
  SRD_SYSTEM_ID
} from './vocabulary.js'

/** Stable catalogue identities of the SRD basic combat actions (Q11). */
export const SRD_BASIC_ACTION_IDS = {
  DASH: '00000000-0000-4000-8000-000000000b01',
  DISENGAGE: '00000000-0000-4000-8000-000000000b02',
  DODGE: '00000000-0000-4000-8000-000000000b03',
  HELP: '00000000-0000-4000-8000-000000000b04',
  HIDE: '00000000-0000-4000-8000-000000000b05',
  READY: '00000000-0000-4000-8000-000000000b06',
  SEARCH: '00000000-0000-4000-8000-000000000b07',
  USE_AN_OBJECT: '00000000-0000-4000-8000-000000000b08',
  FIRST_AID: '00000000-0000-4000-8000-000000000b09',
  ROUSE: '00000000-0000-4000-8000-000000000b0a',
  GRAPPLE: '00000000-0000-4000-8000-000000000b0b',
  SHOVE: '00000000-0000-4000-8000-000000000b0c'
} as const

/** Deterministic ids of an authored basic action's nested rows, derived from the entry's id. */
function basicActionChildId(actionId: string, bucket: number, index: number): string {
  const suffix = actionId.slice(-8)
  return `${suffix}-0000-4000-8000-${bucket.toString(16).padStart(4, '0')}${index
    .toString(16)
    .padStart(8, '0')}`
}

function defineBasicAction(input: {
  id: string
  label: string
  rulesText: string
  effects: unknown[]
  actionCost?: 'ACTION' | 'ATTACK'
  restrictions?: unknown
}) {
  const document = basicActionReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'BASIC_ACTION',
    id: input.id,
    gameSystemId: SRD_SYSTEM_ID,
    rulesText: input.rulesText,
    actionCost: input.actionCost ?? 'ACTION',
    restrictions: input.restrictions ?? null,
    effects: input.effects
  })
  return {
    id: input.id,
    definitionFamilyKey: BASIC_ACTION_DEFINITION_FAMILY_KEY,
    label: input.label,
    description: `SRD 5.1 ${input.label} action.`,
    document,
    checksum: checksumRuleDocument(document)
  }
}

/** An Action-cost effect with a single outcome; it targets its user unless `reach` says otherwise. */
function selfActionEffect(
  actionId: string,
  outcome: Record<string, unknown>,
  resultBlockExtras: Record<string, unknown> = {},
  reach?: {
    rangeKind: typeof RANGE_KIND.UNLIMITED | typeof RANGE_KIND.TOUCH
    targeting: Record<string, unknown>
  }
) {
  return {
    id: basicActionChildId(actionId, 0x210, 1),
    order: 1,
    invocation: {
      kind: 'ACTION' as const,
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: {
        id: basicActionChildId(actionId, 0x211, 1),
        rangeKind: reach?.rangeKind ?? RANGE_KIND.SELF
      },
      targeting: reach?.targeting ?? { selectionKind: 'SELF' as const }
    },
    paths: [
      {
        id: basicActionChildId(actionId, 0x212, 1),
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: basicActionChildId(actionId, 0x212, 2),
          resultKind: 'SINGLE' as const,
          ...resultBlockExtras,
          outcomes: [outcome]
        }
      }
    ]
  }
}

/** A logged action: the Action is spent and the GM adjudicates the result. */
function manualActionEffect(actionId: string, label: string, instructions: string) {
  return selfActionEffect(actionId, {
    id: basicActionChildId(actionId, 0x213, 1),
    effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
    label,
    reasonCode: 'PLAYER_DECLARATION' as const,
    instructions
  })
}

/**
 * Holder restrictions met only while every predicate holds: one group for a Character holder and
 * one for a Creature holder, since each facet context gates on the holder's kind (D152).
 */
function holderMeets(
  actionId: string,
  predicateCodes: readonly ('CAN_ACT' | 'SPEED_ABOVE_ZERO' | 'FREE_HAND')[]
) {
  return {
    id: basicActionChildId(actionId, 0x220, 1),
    groups: (['CHARACTER', 'CREATURE'] as const).map((subject, index) => {
      const part = (offset: number) =>
        basicActionChildId(actionId, 0x220, index * (predicateCodes.length + 3) + offset)
      return {
        id: part(2),
        order: index + 1,
        contexts: [
          {
            id: part(3),
            order: 1,
            subject,
            // A Creature context states its authoring mode; any Creature holder qualifies.
            ...(subject === 'CREATURE' ? { authoringModeKind: 'ALL' as const } : {}),
            conditions: predicateCodes.map((predicateCode, conditionIndex) => ({
              id: part(4 + conditionIndex),
              order: conditionIndex + 1,
              kind: 'PREDICATE' as const,
              constraint: 'INCLUDE' as const,
              predicateCode
            }))
          }
        ]
      }
    })
  }
}

/** Dodge's benefits apply only while the holder can act and move. */
const DODGE_HOLDER_PREDICATES = ['CAN_ACT', 'SPEED_ABOVE_ZERO'] as const

function dodgeEffect(actionId: string) {
  const attackDomains = Object.values(ATTACK_DOMAIN_CODE)
  return selfActionEffect(
    actionId,
    {
      id: basicActionChildId(actionId, 0x213, 1),
      effectKind: EFFECT_KIND.APPLY_GRANT,
      grants: {
        modifiers: [
          ...attackDomains.map((attackDomain, index) => ({
            id: basicActionChildId(actionId, 0x214, index + 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ATTACKS_AGAINST,
            domain: { attackDomain, requiresHolderSeesAttacker: true },
            modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
            payload: { influence: 'DISADVANTAGE' },
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: index,
            restrictions: holderMeets(actionId, DODGE_HOLDER_PREDICATES)
          })),
          {
            id: basicActionChildId(actionId, 0x214, attackDomains.length + 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
            domain: { ability: ABILITY_CODE.DEXTERITY },
            modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
            payload: { influence: 'ADVANTAGE' },
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: attackDomains.length,
            restrictions: holderMeets(actionId, DODGE_HOLDER_PREDICATES)
          }
        ]
      }
    },
    {
      duration: {
        id: basicActionChildId(actionId, 0x215, 1),
        durationKind: 'ROUND',
        amount: 1
      },
      lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } }
    }
  )
}

/**
 * Help's grant: one other creature, at any distance, has advantage on the first attack roll or
 * ability check it makes before the start of the helper's next turn.
 */
function helpEffect(actionId: string) {
  const attackDomains = Object.values(ATTACK_DOMAIN_CODE)
  return selfActionEffect(
    actionId,
    {
      id: basicActionChildId(actionId, 0x213, 1),
      effectKind: EFFECT_KIND.APPLY_GRANT,
      grants: {
        modifiers: [
          ...attackDomains.map((attackDomain, index) => ({
            id: basicActionChildId(actionId, 0x214, index + 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
            domain: { attackDomain },
            modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
            payload: { influence: 'ADVANTAGE' },
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: index
          })),
          {
            id: basicActionChildId(actionId, 0x214, attackDomains.length + 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
            domain: {},
            modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
            payload: { influence: 'ADVANTAGE' },
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: attackDomains.length
          }
        ]
      }
    },
    {
      duration: {
        id: basicActionChildId(actionId, 0x215, 1),
        durationKind: 'ROUND',
        amount: 1
      },
      lifecycle: {
        turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' },
        consumeOnFirstEvents: ['ON_ABILITY_CHECK', 'ON_ATTACK_ROLL']
      }
    },
    {
      rangeKind: RANGE_KIND.UNLIMITED,
      targeting: {
        selectionKind: 'SINGLE_TARGET' as const,
        dispositionKind: 'WILLING' as const,
        self: 'REFUSED'
      }
    }
  )
}

/** Disengage's grant: the holder's movement provokes no opportunity attacks until its turn ends. */
function disengageEffect(actionId: string) {
  return selfActionEffect(
    actionId,
    {
      id: basicActionChildId(actionId, 0x213, 1),
      effectKind: EFFECT_KIND.APPLY_GRANT,
      grants: {
        modifiers: [
          {
            id: basicActionChildId(actionId, 0x214, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.OPPORTUNITY_ATTACK_IMMUNITY,
            domain: {},
            modifierKind: MODIFIER_KIND.ENABLE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: 0
          }
        ]
      }
    },
    {
      duration: {
        id: basicActionChildId(actionId, 0x215, 1),
        durationKind: 'TURN',
        amount: 1
      },
      lifecycle: { turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' } }
    }
  )
}

/** First Aid: a touched creature at 0 hit points becomes stable on a DC 10 Wisdom (Medicine) check. */
function firstAidEffect(actionId: string) {
  return {
    id: basicActionChildId(actionId, 0x210, 1),
    order: 1,
    invocation: {
      kind: 'ACTION' as const,
      triggerCode: TRIGGER.CHECK,
      check: {
        checks: { skillIds: [SRD_MEDICINE_SKILL_ID], abilityDefinitionIds: [] },
        dc: { kind: 'FIXED' as const, value: 10 }
      },
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: basicActionChildId(actionId, 0x211, 1), rangeKind: RANGE_KIND.TOUCH },
      targeting: {
        selectionKind: 'SINGLE_TARGET' as const,
        dispositionKind: 'WILLING' as const,
        self: 'REFUSED' as const
      }
    },
    paths: [
      {
        id: basicActionChildId(actionId, 0x212, 1),
        order: 1,
        pathCode: PATH_CODE.ON_CHECK_SUCCESS,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: basicActionChildId(actionId, 0x212, 2),
          resultKind: 'SINGLE' as const,
          outcomes: [
            {
              id: basicActionChildId(actionId, 0x213, 1),
              effectKind: EFFECT_KIND.STABILIZE,
              requiresZeroHitPoints: true as const
            }
          ]
        }
      }
    ]
  }
}

/**
 * A check the actor makes on itself: success applies the one outcome. Its DC is a per-subject
 * contest (observers' passive scores, or the concealments hiding creatures from the actor).
 */
function selfCheckEffect(
  actionId: string,
  check: Record<string, unknown>,
  outcome: Record<string, unknown>,
  resultBlockExtras: Record<string, unknown> = {}
) {
  return {
    id: basicActionChildId(actionId, 0x210, 1),
    order: 1,
    invocation: {
      kind: 'ACTION' as const,
      triggerCode: TRIGGER.CHECK,
      check,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: basicActionChildId(actionId, 0x211, 1), rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: 'SELF' as const }
    },
    paths: [
      {
        id: basicActionChildId(actionId, 0x212, 1),
        order: 1,
        pathCode: PATH_CODE.ON_CHECK_SUCCESS,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: basicActionChildId(actionId, 0x212, 2),
          resultKind: 'SINGLE' as const,
          ...resultBlockExtras,
          outcomes: [outcome]
        }
      }
    ]
  }
}

const ATHLETICS_OR_ACROBATICS = {
  skillIds: [SRD_ACROBATICS_SKILL_ID, SRD_ATHLETICS_SKILL_ID].sort(),
  abilityDefinitionIds: []
}
const ATHLETICS = { skillIds: [SRD_ATHLETICS_SKILL_ID], abilityDefinitionIds: [] }

/**
 * The SRD grapple-and-shove contest (D105): the actor's Athletics against the target's Athletics or
 * Acrobatics, the target choosing, at a creature within reach and at most one size larger.
 */
function athleticsContestInvocation(actionId: string) {
  return {
    kind: 'ACTION' as const,
    triggerCode: TRIGGER.CHECK,
    check: { checks: ATHLETICS, dc: { kind: 'CONTEST' as const, checks: ATHLETICS_OR_ACROBATICS } },
    activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
    range: { id: basicActionChildId(actionId, 0x211, 1), rangeKind: RANGE_KIND.TOUCH },
    targeting: {
      selectionKind: 'SINGLE_TARGET' as const,
      dispositionKind: 'ANY' as const,
      self: 'REFUSED' as const,
      sizeLimit: { stepsAboveActor: 1 }
    }
  }
}

/**
 * Grapple (D105): within reach, a creature at most one size larger is Grappled when the grappler's
 * Athletics check beats the check the target picks, Athletics or Acrobatics. One hold fills one of
 * the grappler's hands, two at once; the held creature escapes with its Action by winning an
 * Athletics or Acrobatics check against the grappler's Athletics.
 */
function grappleEffect(actionId: string) {
  const grappled = SRD_CONDITION_TYPES.find(({ code }) => code === 'GRAPPLED')
  if (!grappled) throw new Error('Missing SRD Grappled condition.')
  return {
    id: basicActionChildId(actionId, 0x210, 1),
    order: 1,
    invocation: athleticsContestInvocation(actionId),
    paths: [
      {
        id: basicActionChildId(actionId, 0x212, 1),
        order: 1,
        pathCode: PATH_CODE.ON_CHECK_SUCCESS,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE' as const,
        selectionKind: 'FIXED' as const,
        resultBlock: {
          id: basicActionChildId(actionId, 0x212, 2),
          resultKind: 'SINGLE' as const,
          outcomes: [
            {
              id: basicActionChildId(actionId, 0x213, 1),
              effectKind: EFFECT_KIND.ACTOR_RELATIONSHIP,
              heldAtOnce: 2,
              modules: [
                {
                  id: basicActionChildId(actionId, 0x216, 1),
                  order: 1,
                  kind: 'SOURCE_OCCUPIES_HAND' as const
                },
                {
                  id: basicActionChildId(actionId, 0x216, 2),
                  order: 2,
                  kind: 'ESCAPE_CHECK' as const,
                  activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                  checks: ATHLETICS_OR_ACROBATICS,
                  dc: { kind: 'CONTEST' as const, checks: ATHLETICS },
                  actorKinds: ['TARGET' as const]
                },
                {
                  id: basicActionChildId(actionId, 0x216, 3),
                  order: 3,
                  kind: 'TARGET_DRAGGED' as const
                }
              ],
              conditions: [
                {
                  id: basicActionChildId(actionId, 0x217, 1),
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: grappled.id
                }
              ]
            }
          ]
        }
      }
    ]
  }
}

/**
 * Shove (D105): the grapple contest, and on a win the shover's pick, made with the attempt (D148):
 * the target has the Prone condition, or is pushed 5 feet straight away (D157).
 */
function shoveEffect(actionId: string) {
  const prone = SRD_CONDITION_TYPES.find(({ code }) => code === 'PRONE')
  if (!prone) throw new Error('Missing SRD Prone condition.')
  const options = [
    {
      label: 'Knock prone',
      description: 'The target has the Prone condition.',
      outcome: { effectKind: EFFECT_KIND.CONDITION, conditionId: prone.id }
    },
    {
      label: 'Push 5 feet away',
      description: 'The target is pushed 5 feet straight away from you.',
      outcome: {
        effectKind: EFFECT_KIND.FORCED_MOVEMENT,
        direction: 'AWAY_FROM_SOURCE' as const,
        actionEconomy: 'NONE' as const,
        distanceMode: 'EXACT' as const,
        amount: 5,
        unit: 'FEET' as const
      }
    }
  ]
  return {
    id: basicActionChildId(actionId, 0x210, 1),
    order: 1,
    invocation: athleticsContestInvocation(actionId),
    paths: [
      {
        id: basicActionChildId(actionId, 0x212, 1),
        order: 1,
        pathCode: PATH_CODE.ON_CHECK_SUCCESS,
        groupType: PATH_GROUP_TYPE.CHOICE,
        originKind: 'SOURCE' as const,
        selectionKind: 'CHOICE' as const,
        options: options.map(({ label, description, outcome }, index) => ({
          id: basicActionChildId(actionId, 0x220, index + 1),
          order: index + 1,
          label,
          description,
          resultBlock: {
            id: basicActionChildId(actionId, 0x221, index + 1),
            resultKind: 'SINGLE' as const,
            outcomes: [{ id: basicActionChildId(actionId, 0x213, index + 1), ...outcome }]
          }
        }))
      }
    ]
  }
}

/**
 * The SRD System's basic combat actions. Names and rules text are authored System data. Dash,
 * Disengage, Dodge, Help, Hide, Search and First Aid are authored effects; Ready and Use an Object
 * spend the Action and leave the result to the GM.
 */
export const SRD_BASIC_ACTION_DEFINITIONS = [
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.DASH,
    label: 'Dash',
    rulesText:
      'You gain extra movement for the current turn, equal to your speed after applying any modifiers.',
    effects: [
      selfActionEffect(SRD_BASIC_ACTION_IDS.DASH, {
        id: basicActionChildId(SRD_BASIC_ACTION_IDS.DASH, 0x213, 1),
        effectKind: EFFECT_KIND.MOVEMENT_RULE,
        ruleKind: MOVEMENT_RULE_KIND.ADD_SPEED_TO_MOVEMENT
      })
    ]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.DISENGAGE,
    label: 'Disengage',
    rulesText: "Your movement doesn't provoke opportunity attacks for the rest of the turn.",
    effects: [disengageEffect(SRD_BASIC_ACTION_IDS.DISENGAGE)]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.DODGE,
    label: 'Dodge',
    rulesText:
      'Until the start of your next turn, any attack roll made against you has disadvantage if you can see the attacker, and you make Dexterity saving throws with advantage. You lose this benefit if you are incapacitated or your speed drops to 0.',
    effects: [dodgeEffect(SRD_BASIC_ACTION_IDS.DODGE)]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.HELP,
    label: 'Help',
    rulesText:
      'You aid an ally. The ally has advantage on the next ability check it makes for the task you help with, or on its first attack roll against a creature within 5 feet of you, if it acts before the start of your next turn.',
    effects: [helpEffect(SRD_BASIC_ACTION_IDS.HELP)]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.HIDE,
    label: 'Hide',
    rulesText:
      'You make a Dexterity (Stealth) check to hide, following the rules for hiding. If you succeed, you gain the benefits of being unseen.',
    effects: [
      selfCheckEffect(
        SRD_BASIC_ACTION_IDS.HIDE,
        {
          checks: { skillIds: [SRD_STEALTH_SKILL_ID], abilityDefinitionIds: [] },
          dc: { kind: 'PASSIVE' as const, passiveDefinitionId: SRD_PASSIVE_PERCEPTION_ID }
        },
        {
          id: basicActionChildId(SRD_BASIC_ACTION_IDS.HIDE, 0x213, 1),
          effectKind: EFFECT_KIND.CONCEAL_FROM_OBSERVERS,
          observers: 'NON_ALLIES' as const
        },
        {
          duration: {
            id: basicActionChildId(SRD_BASIC_ACTION_IDS.HIDE, 0x215, 1),
            durationKind: 'UNTIL_DISPELLED'
          },
          lifecycle: { consumeOnFirstEvents: ['ON_ATTACK_ROLL'] }
        }
      )
    ]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.READY,
    label: 'Ready',
    rulesText:
      'Choose a perceivable trigger and the action or movement you take in response. When the trigger occurs before the start of your next turn, you can use your reaction to act.',
    effects: [
      manualActionEffect(
        SRD_BASIC_ACTION_IDS.READY,
        'Adjudicate Ready',
        'Record the trigger and the readied response; the actor uses its reaction when the trigger occurs.'
      )
    ]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.SEARCH,
    label: 'Search',
    rulesText:
      'You devote your attention to finding something. The GM might have you make a Wisdom (Perception) or Intelligence (Investigation) check.',
    effects: [
      selfCheckEffect(
        SRD_BASIC_ACTION_IDS.SEARCH,
        {
          checks: { skillIds: [SRD_PERCEPTION_SKILL_ID], abilityDefinitionIds: [] },
          dc: { kind: 'CONCEALMENT' as const }
        },
        {
          id: basicActionChildId(SRD_BASIC_ACTION_IDS.SEARCH, 0x213, 1),
          effectKind: EFFECT_KIND.DETECT_CONCEALED
        }
      )
    ]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.USE_AN_OBJECT,
    label: 'Use an Object',
    rulesText:
      'You interact with an object that requires your action to use, or with more than one object this turn.',
    effects: [
      manualActionEffect(
        SRD_BASIC_ACTION_IDS.USE_AN_OBJECT,
        'Adjudicate Use an Object',
        'Rule the result of interacting with the object.'
      )
    ]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.ROUSE,
    label: 'Rouse',
    rulesText:
      'You shake or slap a creature within reach awake. It wakes from any effect that ends when a creature uses an action to rouse it.',
    effects: [
      selfActionEffect(
        SRD_BASIC_ACTION_IDS.ROUSE,
        {
          id: basicActionChildId(SRD_BASIC_ACTION_IDS.ROUSE, 0x213, 1),
          effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
          label: 'Adjudicate Rouse',
          reasonCode: 'PLAYER_DECLARATION' as const,
          instructions: 'The creature wakes from any effect that ends when it is roused.'
        },
        {},
        {
          rangeKind: RANGE_KIND.TOUCH,
          targeting: {
            selectionKind: 'SINGLE_TARGET' as const,
            dispositionKind: 'ANY' as const,
            self: 'REFUSED' as const
          }
        }
      )
    ]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.FIRST_AID,
    label: 'First Aid',
    rulesText:
      'You tend a dying creature within reach. Make a DC 10 Wisdom (Medicine) check; on a success the creature becomes stable.',
    effects: [firstAidEffect(SRD_BASIC_ACTION_IDS.FIRST_AID)]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.GRAPPLE,
    label: 'Grapple',
    rulesText:
      "In place of one attack of the Attack action, you try to seize a creature within your reach that is no more than one size larger than you, using a free hand. Make a Strength (Athletics) check contested by the target's Strength (Athletics) or Dexterity (Acrobatics) check, the target choosing. If you win, the target has the Grappled condition until it escapes or you release it. A grappled creature can use its action to escape by winning an Athletics or Acrobatics check against your Athletics.",
    actionCost: 'ATTACK',
    restrictions: holderMeets(SRD_BASIC_ACTION_IDS.GRAPPLE, ['FREE_HAND']),
    effects: [grappleEffect(SRD_BASIC_ACTION_IDS.GRAPPLE)]
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.SHOVE,
    label: 'Shove',
    rulesText:
      "In place of one attack of the Attack action, you try to shove a creature within your reach that is no more than one size larger than you, either to knock it prone or to push it away from you. Make a Strength (Athletics) check contested by the target's Strength (Athletics) or Dexterity (Acrobatics) check, the target choosing. If you win, you either knock the target prone or push it 5 feet away from you.",
    actionCost: 'ATTACK',
    effects: [shoveEffect(SRD_BASIC_ACTION_IDS.SHOVE)]
  })
]
