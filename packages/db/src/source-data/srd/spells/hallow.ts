import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { spellChildId } from './shared.js'

function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry) {
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  }

  return entry.id
}

export const hallow: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.HALLOW,
  label: 'Hallow',
  description:
    'You touch a point and infuse an area around it with holy or unholy power. The area can have a radius up to 60 feet, and the spell fails if the radius includes an area already under the effect a hallow spell.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 24 },
  level: 5,
  classIds: [CLASS_IDS.CLERIC],
  magicSchoolId: schoolId('EVOCATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.HALLOW, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.HALLOW, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Touch a point to infuse the surrounding area.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.HALLOW, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.HALLOW, 0x213, 1),
            durationKind: DURATION_KIND.UNTIL_DISPELLED
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.ZONE,
          label: 'Hallow',
          detail: 'Infuses the chosen area with holy or unholy power and establishes the ward.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
