import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SCALING_AMOUNT_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { ABILITY_CODE, SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { closedRuleEffect, gmRulingEffect } from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const WZ = 12

const evocationSchoolId = SRD_MAGIC_SCHOOLS.find((school) => school.code === 'EVOCATION')?.id
if (!evocationSchoolId) throw new Error('SRD evocation magic school vocabulary entry required.')

export const schoolOfEvocation: ClassAuthored = {
  id: SUBCLASS_IDS.EVOCATION_SCHOOL,
  label: 'School of Evocation',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.WIZARD,
  description:
    'You focus your study on magic that creates powerful elemental effects such as bitter cold, searing flame, rolling thunder, crackling lightning, and burning acid. Some evokers find employment in military forces, serving as artillery to blast enemy armies from afar. Others use their spectacular power to protect the weak, while some seek their own gain as bandits, adventurers, or aspiring tyrants.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(WZ, 11, 1),
      label: 'Evocation Savant',
      description:
        'Beginning when you select this school at 2nd level, the gold and time you must spend to copy an evocation spell into your spellbook is halved.',
      availableAtLevel: 2,
      order: 0
    },
    {
      id: classRowId(WZ, 11, 2),
      label: 'Sculpt Spells',
      description:
        "Beginning at 2nd level, you can create pockets of relative safety within the effects of your evocation spells. When you cast an evocation spell that affects other creatures that you can see, you can choose a number of them equal to 1 + the spell's level. The chosen creatures automatically succeed on their saving throws against the spell, and they take no damage if they would normally take half damage on a successful save.",
      availableAtLevel: 2,
      order: 1,
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(WZ, 20, 2),
            range: classRowId(WZ, 21, 2),
            path: classRowId(WZ, 0x80, 2),
            result: classRowId(WZ, 0x81, 2),
            outcome: classRowId(WZ, 0x82, 2)
          },
          label: 'Sculpt Spells',
          instructions: 'Each creature the wizard spares must be one they can see.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          sparesCreatures: { base: 1, plusSpellLevel: true, magicSchoolIds: [evocationSchoolId] }
        })
      ]
    },
    {
      id: classRowId(WZ, 11, 3),
      label: 'Potent Cantrip',
      description:
        "Starting at 6th level, your damaging cantrips affect even creatures that avoid the brunt of the effect. When a creature succeeds on a saving throw against your cantrip, the creature takes half the cantrip's damage (if any) but suffers no additional effect from the cantrip.",
      availableAtLevel: 6,
      order: 2,
      grants: {
        modifiers: [
          {
            id: classRowId(WZ, 20, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
            domain: { attackDomain: 'SPELL' as const },
            modifierKind: MODIFIER_KIND.SAVE_SUCCESS_DAMAGE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { amountKind: SCALING_AMOUNT_KIND.HALF },
            order: 0,
            // Every cantrip you cast: the success path adds only the cantrip's damage, which is
            // the "no additional effect" clause.
            restrictions: {
              id: classRowId(WZ, 21, 3),
              groups: [
                {
                  id: classRowId(WZ, 0x30, 4),
                  order: 0,
                  contexts: [
                    {
                      id: classRowId(WZ, 0x30, 5),
                      order: 0,
                      subject: 'SPELL' as const,
                      authoringModeKind: AUTHORING_MODE_KIND.ALL,
                      conditions: [
                        {
                          id: classRowId(WZ, 0x30, 6),
                          order: 0,
                          kind: 'PREDICATE' as const,
                          constraint: 'INCLUDE' as const,
                          predicateCode: 'SPELL_LEVEL' as const,
                          min: 0,
                          max: 0
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    },
    {
      id: classRowId(WZ, 11, 4),
      label: 'Empowered Evocation',
      description:
        'Beginning at 10th level, you can add your Intelligence modifier to one damage roll of any wizard evocation spell you cast.',
      availableAtLevel: 10,
      order: 3,
      grants: {
        modifiers: [
          {
            id: classRowId(WZ, 20, 4),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
            domain: { attackDomain: 'SPELL' as const },
            modifierKind: MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { ability: ABILITY_CODE.INTELLIGENCE },
            order: 0,
            // Any evocation spell you cast: whether one from another class's list counts as a
            // "wizard" spell is a GM ruling.
            restrictions: {
              id: classRowId(WZ, 21, 4),
              groups: [
                {
                  id: classRowId(WZ, 0x30, 1),
                  order: 0,
                  contexts: [
                    {
                      id: classRowId(WZ, 0x30, 2),
                      order: 0,
                      subject: 'SPELL' as const,
                      authoringModeKind: AUTHORING_MODE_KIND.ALL,
                      conditions: [
                        {
                          id: classRowId(WZ, 0x30, 3),
                          order: 0,
                          kind: 'PREDICATE' as const,
                          constraint: 'INCLUDE' as const,
                          predicateCode: 'MAGIC_SCHOOL' as const,
                          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                          magicSchoolIds: [evocationSchoolId]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    },
    {
      id: classRowId(WZ, 11, 5),
      label: 'Overchannel',
      description:
        'Starting at 14th level, you can increase the power of your simpler spells. When you cast a wizard spell of 1st through 5th level that deals damage, you can deal maximum damage with that spell. The first time you do so, you suffer no adverse effect. If you use this feature again before you finish a long rest, you take 2d12 necrotic damage for each level of the spell, immediately after you cast it. Each time you use this feature again before finishing a long rest, the necrotic damage per spell level increases by 1d12. This damage ignores resistance and immunity.',
      availableAtLevel: 14,
      order: 4,
      effects: [
        closedRuleEffect({
          id: classRowId(WZ, 20, 5),
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.FREE },
            range: { id: classRowId(WZ, 21, 5), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_SCHOOL_OF_EVOCATION_OVERCHANNEL
        })
      ]
    }
  ]
}
