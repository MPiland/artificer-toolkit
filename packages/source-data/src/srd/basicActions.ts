import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared'
import {
  basicActionReusableDefinitionDocumentDtoSchema,
  type BasicActionReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/basicActions'
import { BASIC_ACTION_DEFINITION_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { SRD_MEDICINE_SKILL_ID, SRD_SYSTEM_ID } from './vocabulary.js'

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
  FIRST_AID: '00000000-0000-4000-8000-000000000b09'
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
  mechanics?: BasicActionReusableDefinitionDocumentDto['mechanics']
  effects?: unknown[]
  check?: BasicActionReusableDefinitionDocumentDto['check']
}) {
  const document = basicActionReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'BASIC_ACTION',
    id: input.id,
    gameSystemId: SRD_SYSTEM_ID,
    rulesText: input.rulesText,
    actionCost: 'ACTION',
    mechanics: input.mechanics ?? [],
    restrictions: null,
    effects: input.effects ?? [],
    check: input.check ?? null
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

/** An Action-cost self effect with a single outcome. */
function selfActionEffect(
  actionId: string,
  outcome: Record<string, unknown>,
  resultBlockExtras: Record<string, unknown> = {}
) {
  return {
    id: basicActionChildId(actionId, 0x210, 1),
    order: 1,
    invocation: {
      kind: 'ACTION' as const,
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: basicActionChildId(actionId, 0x211, 1), rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: 'SELF' as const }
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

/** Dodge's benefits apply only while the holder can act and move. */
function holderCanActAndMove(actionId: string) {
  return {
    id: basicActionChildId(actionId, 0x220, 1),
    groups: [
      {
        id: basicActionChildId(actionId, 0x220, 2),
        order: 1,
        contexts: [
          {
            id: basicActionChildId(actionId, 0x220, 3),
            order: 1,
            subject: 'CHARACTER' as const,
            conditions: [
              {
                id: basicActionChildId(actionId, 0x220, 4),
                order: 1,
                kind: 'PREDICATE' as const,
                constraint: 'INCLUDE' as const,
                predicateCode: 'CAN_ACT' as const
              },
              {
                id: basicActionChildId(actionId, 0x220, 5),
                order: 2,
                kind: 'PREDICATE' as const,
                constraint: 'INCLUDE' as const,
                predicateCode: 'SPEED_ABOVE_ZERO' as const
              }
            ]
          }
        ]
      }
    ]
  }
}

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
            modifierKind: MODIFIER_KIND.DISADVANTAGE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: index,
            restrictions: holderCanActAndMove(actionId)
          })),
          {
            id: basicActionChildId(actionId, 0x214, attackDomains.length + 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
            domain: { ability: ABILITY_CODE.DEXTERITY },
            modifierKind: MODIFIER_KIND.ADVANTAGE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: attackDomains.length,
            restrictions: holderCanActAndMove(actionId)
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
 * The SRD System's basic combat actions. Names and rules text are authored System data; only the
 * listed mechanics execute. Dodge is an authored grant; Hide, Ready, Search and Use an Object spend the Action and leave
 * the result to the GM.
 */
export const SRD_BASIC_ACTION_DEFINITIONS = [
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.DASH,
    label: 'Dash',
    rulesText:
      'You gain extra movement for the current turn, equal to your speed after applying any modifiers.',
    mechanics: ['SPEED_MOVEMENT_BONUS']
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.DISENGAGE,
    label: 'Disengage',
    rulesText: "Your movement doesn't provoke opportunity attacks for the rest of the turn.",
    mechanics: ['NO_OPPORTUNITY_ATTACKS']
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
    mechanics: ['ALLY_ADVANTAGE']
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.HIDE,
    label: 'Hide',
    rulesText:
      'You make a Dexterity (Stealth) check to hide, following the rules for hiding. If you succeed, you gain the benefits of being unseen.',
    effects: [
      manualActionEffect(
        SRD_BASIC_ACTION_IDS.HIDE,
        'Adjudicate Hide',
        'Resolve the Dexterity (Stealth) check to hide and rule whether the actor becomes unseen.'
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
      manualActionEffect(
        SRD_BASIC_ACTION_IDS.SEARCH,
        'Adjudicate Search',
        'Call for the Wisdom (Perception) or Intelligence (Investigation) check and rule what is found.'
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
    id: SRD_BASIC_ACTION_IDS.FIRST_AID,
    label: 'First Aid',
    rulesText:
      'You tend a dying creature within reach. Make a DC 10 Wisdom (Medicine) check; on a success the creature becomes stable.',
    mechanics: ['STABILIZE_TARGET'],
    check: { checkDefinitionId: SRD_MEDICINE_SKILL_ID, dc: 10 }
  })
]
