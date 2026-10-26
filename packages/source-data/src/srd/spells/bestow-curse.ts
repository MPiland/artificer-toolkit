import {
  SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS,
  SRD_ABILITIES
} from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_DIE_RECIPIENT,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  ROLLED_DIE_SIGN,
  SPELL_ATTRIBUTE,
  SPELL_COMPONENT,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { damageTypeId, spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}
const grant = {
  grantKind: GRANT_KIND.MODIFIER_GRANT,
  scope: MODIFIER_SCOPE_KIND.GLOBAL,
  selectionKind: AUTHORING_SELECTION_KIND.GRANTED
} as const
const curseGrants = <Modifier extends object>(
  curseIndex: number,
  modifiers: readonly Modifier[]
) => ({
  effectKind: EFFECT_KIND.APPLY_GRANT,
  grants: {
    modifiers: modifiers.map((modifier, index) => ({
      id: spellChildId(SPELL_IDS.BESTOW_CURSE, 0x230 + curseIndex, index + 1),
      ...modifier,
      order: index + 1
    }))
  }
})
const curseAdjudication = (label: string, instructions: string) => ({
  effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
  label,
  reasonCode: 'GM_CHOICE' as const,
  instructions
})
// The wasted-action curse needs a start-of-turn save repeated every turn whatever its result,
// which no repeat-save option expresses yet, so the GM runs it (D156).
const curses = [
  ...Object.values(SRD_ABILITIES).map(({ code: ability, label }, index) => ({
    label,
    description: `Disadvantage on ${label} checks and ${label} saving throws.`,
    outcome: curseGrants(index, [
      {
        ...grant,
        valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
        domain: { ability },
        modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
        payload: { influence: 'DISADVANTAGE' }
      },
      {
        ...grant,
        valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
        domain: { ability },
        modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
        payload: { influence: 'DISADVANTAGE' }
      }
    ])
  })),
  {
    label: 'Attacks Against You',
    description: 'Disadvantage on attack rolls against you.',
    outcome: curseGrants(
      6,
      Object.values(ATTACK_DOMAIN_CODE).map((attackDomain) => ({
        ...grant,
        valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
        domain: { attackDomain, againstEffectSource: true },
        modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
        payload: { influence: 'DISADVANTAGE' }
      }))
    )
  },
  {
    label: 'Wasted Action',
    description:
      'A Wisdom saving throw at the start of each of its turns; on a failure it wastes its action that turn.',
    outcome: curseAdjudication(
      'Wasted Action',
      'At the start of each of its turns, the target makes a Wisdom saving throw against your spell save DC. If it fails, it wastes its action that turn doing nothing.'
    )
  },
  {
    label: 'Necrotic Damage',
    description: 'Your attacks and spells deal an extra 1d8 necrotic damage to the target.',
    outcome: curseGrants(8, [
      {
        ...grant,
        valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
        domain: {},
        modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
        payload: {
          count: 1,
          faces: 8 as const,
          sign: ROLLED_DIE_SIGN.ADD,
          recipient: DAMAGE_DIE_RECIPIENT.SOURCE_DEALS_TO_HOLDER,
          damageTypeId: damageTypeId('NECROTIC')
        }
      }
    ])
  },
  {
    label: 'Alternative Curse',
    description: 'A GM-approved curse no more powerful than the others.',
    outcome: curseAdjudication(
      'Choose an Alternative Curse',
      'At the GM\u0027s option, you may choose an alternative curse effect, but it should be no more powerful than those described above. The GM has final say on such a curse\u0027s effect.'
    )
  }
]
export const bestowCurse: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.BESTOW_CURSE,
  label: 'Bestow Curse',
  description:
    "<p>You touch a creature, and that creature must succeed on a Wisdom saving throw or become cursed for the duration of the spell. When you cast this spell, choose the nature of the curse from the following options: * Choose one ability score. While cursed, the target has disadvantage on ability checks and saving throws made with that ability score. * While cursed, the target has disadvantage on attack rolls against you. * While cursed, the target must make a Wisdom saving throw at the start of each of its turns. If it fails, it wastes its action that turn doing nothing. * While the target is cursed, your attacks and spells deal an extra 1d8 necrotic damage to the target. A remove curse spell ends this effect. At the GM's option, you may choose an alternative curse effect, but it should be no more powerful than those described above. The GM has final say on such a curse's effect. At Higher Levels. If you cast this spell using a spell slot of 4th level or higher, the duration is concentration, up to 10 minutes. If you use a spell slot of 5th level or higher, the duration is 8 hours. If you use a spell slot of 7th level or higher, the duration is 24 hours. If you use a 9th level spell slot, the spell lasts until it is dispelled. Using a spell slot of 5th level or higher grants a duration that doesn't require concentration.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('NECROMANCY'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.BESTOW_CURSE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.BESTOW_CURSE, 0x214, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.BESTOW_CURSE, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.BESTOW_CURSE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE' as const,
          selectionKind: 'CHOICE' as const,
          options: curses.map((curse, index) => ({
            id: spellChildId(SPELL_IDS.BESTOW_CURSE, 0x220, index + 1),
            order: index + 1,
            label: curse.label,
            description: curse.description,
            resultBlock: {
              id: spellChildId(SPELL_IDS.BESTOW_CURSE, 0x221, index + 1),
              resultKind: 'SINGLE' as const,
              duration: {
                id: spellChildId(SPELL_IDS.BESTOW_CURSE, 0x222, index + 1),
                durationKind: DURATION_KIND.MINUTE,
                amount: 1
              },
              outcomes: [
                { id: spellChildId(SPELL_IDS.BESTOW_CURSE, 0x223, index + 1), ...curse.outcome }
              ]
            }
          }))
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
