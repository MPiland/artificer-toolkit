import {
  basicActionReusableDefinitionDocumentDtoSchema,
  type BasicActionReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/basicActions'
import { BASIC_ACTION_DEFINITION_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { SRD_ABILITY_DEFINITION_IDS, SRD_MEDICINE_SKILL_ID, SRD_SYSTEM_ID } from './vocabulary.js'

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

function defineBasicAction(input: {
  id: string
  label: string
  rulesText: string
  mechanics: BasicActionReusableDefinitionDocumentDto['mechanics']
  saveAbilityIds?: string[]
  suspendedWhileUnableToActOrMove?: boolean
  check?: BasicActionReusableDefinitionDocumentDto['check']
}) {
  const document = basicActionReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'BASIC_ACTION',
    id: input.id,
    gameSystemId: SRD_SYSTEM_ID,
    rulesText: input.rulesText,
    actionCost: 'ACTION',
    mechanics: input.mechanics,
    saveAbilityIds: input.saveAbilityIds ?? [],
    suspendedWhileUnableToActOrMove: input.suspendedWhileUnableToActOrMove ?? false,
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

/**
 * The SRD System's basic combat actions. Names and rules text are authored System data; only the
 * listed mechanics execute. Hide, Ready, Search and Use an Object are logged, not automated.
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
    mechanics: ['DISADVANTAGE_ON_ATTACKS_AGAINST', 'SAVE_ADVANTAGE'],
    saveAbilityIds: [SRD_ABILITY_DEFINITION_IDS.DEXTERITY],
    suspendedWhileUnableToActOrMove: true
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
    mechanics: []
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.READY,
    label: 'Ready',
    rulesText:
      'Choose a perceivable trigger and the action or movement you take in response. When the trigger occurs before the start of your next turn, you can use your reaction to act.',
    mechanics: []
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.SEARCH,
    label: 'Search',
    rulesText:
      'You devote your attention to finding something. The GM might have you make a Wisdom (Perception) or Intelligence (Investigation) check.',
    mechanics: []
  }),
  defineBasicAction({
    id: SRD_BASIC_ACTION_IDS.USE_AN_OBJECT,
    label: 'Use an Object',
    rulesText:
      'You interact with an object that requires your action to use, or with more than one object this turn.',
    mechanics: []
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
