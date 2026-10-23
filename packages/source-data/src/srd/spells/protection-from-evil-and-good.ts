import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import type { ModifierGrantAuthored } from '@artificer-toolkit/shared/authored'
import { sourceCreatureTypeRestriction } from '../classes/mechanics.js'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import {
  conditionTypeId,
  creatureTypeId,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'

const PROTECTED_AGAINST_CREATURE_TYPES = [
  'ABERRATION',
  'CELESTIAL',
  'ELEMENTAL',
  'FEY',
  'FIEND',
  'UNDEAD'
] as const

/**
 * What protection from evil and good gives its holder against aberrations, celestials,
 * elementals, fey, fiends and undead: their attacks have disadvantage and the holder can't be
 * charmed or frightened by them. The spell and Purity of Spirit share it; `idFor` keeps each
 * one's ids its own. Possession and the advantage on a new save against an existing charm or
 * fright stay in the description.
 */
export function protectionFromEvilAndGoodGrants(
  idFor: (part: number, entry: number) => string
): ModifierGrantAuthored[] {
  return againstCreatureTypes(
    idFor,
    [
      ...attackDisadvantageAgainstHolder,
      ...(['CHARMED', 'FRIGHTENED'] as const).map((condition) => ({
        valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
        domain: {},
        modifierKind: MODIFIER_KIND.ADD_OPTION,
        payload: { conditionTypeId: conditionTypeId(condition) }
      }))
    ],
    PROTECTED_AGAINST_CREATURE_TYPES
  )
}

/** Disadvantage on every kind of attack roll against the holder. */
export const attackDisadvantageAgainstHolder = Object.values(ATTACK_DOMAIN_CODE).map(
  (attackDomain) => ({
    valueDomainCode: VALUE_DOMAIN_CODE.ATTACKS_AGAINST,
    domain: { attackDomain, requiresHolderSeesAttacker: false },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'DISADVANTAGE' as const }
  })
)

/** Grants that hold only against a source creature of one of these types. */
export function againstCreatureTypes(
  idFor: (part: number, entry: number) => string,
  grants: readonly Pick<
    ModifierGrantAuthored,
    'valueDomainCode' | 'domain' | 'modifierKind' | 'payload'
  >[],
  creatureTypeCodes: readonly string[]
): ModifierGrantAuthored[] {
  const creatureTypeIds = creatureTypeCodes.map(creatureTypeId)
  return grants.map((grant, index) => ({
    id: idFor(0x30, index + 1),
    order: index + 1,
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    ...grant,
    restrictions: sourceCreatureTypeRestriction(
      (entry) => idFor(0x31 + index, entry + 1),
      'INCLUDE',
      creatureTypeIds
    )
  })) as ModifierGrantAuthored[]
}

export const protectionFromEvilAndGood: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PROTECTION_FROM_EVIL_AND_GOOD,
  label: 'Protection from Evil and Good',
  description:
    "<p>Until the spell ends, one willing creature you touch is protected against certain types of creatures: aberrations, celestials, elementals, fey, fiends, and undead. The protection grants several benefits. Creatures of those types have disadvantage on attack rolls against the target. The target also can't be charmed, frightened, or possessed by them. If the target is already charmed, frightened, or possessed by such a creature, the target has advantage on any new saving throw against the relevant effect.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'holy water or powdered silver and iron, which the spell consumes',
  magicSchoolId: schoolId('ABJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.PROTECTION_FROM_EVIL_AND_GOOD, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PROTECTION_FROM_EVIL_AND_GOOD, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.PROTECTION_FROM_EVIL_AND_GOOD, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.PROTECTION_FROM_EVIL_AND_GOOD, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.PROTECTION_FROM_EVIL_AND_GOOD, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 10
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.PROTECTION_FROM_EVIL_AND_GOOD, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: protectionFromEvilAndGoodGrants((part, entry) =>
                    spellChildId(SPELL_IDS.PROTECTION_FROM_EVIL_AND_GOOD, 0x200 + part, entry)
                  )
                }
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
